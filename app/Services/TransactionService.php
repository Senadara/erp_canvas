<?php

namespace App\Services;

use App\Models\Conversion;
use App\Models\StockItem;
use App\Models\Transaction;
use App\Models\TransactionItem;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TransactionService
{
    private function startOfDayLocal()
    {
        return Carbon::now()->startOfDay();
    }

    private function endOfDayLocal()
    {
        return Carbon::now()->endOfDay();
    }

    private function nextInvoiceNumber()
    {
        $now = Carbon::now();
        $prefix = 'KG-' . $now->format('Ymd') . '-';
        
        $last = Transaction::whereBetween('created_at', [$this->startOfDayLocal(), $this->endOfDayLocal()])
            ->where('invoice_number', 'LIKE', $prefix . '%')
            ->orderBy('invoice_number', 'desc')
            ->first();

        $seq = 1;
        if ($last) {
            $part = str_replace($prefix, '', $last->invoice_number);
            $seq = (int)$part + 1;
        }

        return $prefix . str_pad($seq, 4, '0', STR_PAD_LEFT);
    }

    public function processSale(array $payload)
    {
        $outletId = $payload['outlet_id'];
        $items = $payload['items'];
        $paymentStatus = $payload['payment_status'] ?? 'PAID';
        $paymentMethod = $payload['payment_method'] ?? null;
        $note = $payload['note'] ?? null;
        $cashReceived = $payload['cash_received'] ?? null;

        if (empty($items)) {
            throw new \Exception("Keranjang kosong.");
        }
        if ($paymentStatus === 'PAID' && empty($paymentMethod)) {
            throw new \Exception("Pilih metode pembayaran (tunai / QRIS).");
        }

        return DB::transaction(function () use ($outletId, $items, $paymentStatus, $paymentMethod, $note, $cashReceived) {
            $invoiceNumber = $this->nextInvoiceNumber();

            $lockPlan = [];

            foreach ($items as $line) {
                $conversions = Conversion::where('product_id', $line['product_id'])
                    ->with('stockItem')
                    ->get();
                
                $relevant = $conversions->filter(fn($c) => $c->stockItem->outlet_id === $outletId);
                
                if ($relevant->isEmpty()) {
                    continue; // Jika tidak ada BOM, tidak perlu memotong stok bahan
                }

                foreach ($relevant as $c) {
                    if (!$c->stockItem->trackable) continue;
                    $need = $c->ratio * $line['qty_porsi'];
                    if (!isset($lockPlan[$c->stock_item_id])) {
                        $lockPlan[$c->stock_item_id] = 0;
                    }
                    $lockPlan[$c->stock_item_id] += $need;
                }
            }

            // Lock and verify stock
            $sortedIds = array_keys($lockPlan);
            sort($sortedIds);

            foreach ($sortedIds as $stockItemId) {
                $stock = clone DB::table('stock_items')->where('id', $stockItemId)->lockForUpdate()->first();
                if (!$stock || $stock->outlet_id !== $outletId) {
                    throw new \Exception("Stok tidak valid untuk outlet ini.");
                }
                if ($stock->current_stock_biji < $lockPlan[$stockItemId]) {
                    throw new \Exception("Stok tidak cukup untuk ID bahan {$stockItemId}.");
                }
            }

            // Deduct stock
            foreach ($lockPlan as $stockItemId => $needed) {
                DB::table('stock_items')->where('id', $stockItemId)->decrement('current_stock_biji', $needed);
            }

            $total = 0;
            $itemCreates = [];

            foreach ($items as $line) {
                $price = $line['price_per_porsi'];
                $sub = $price * $line['qty_porsi'];
                $total += $sub;
                
                $itemCreates[] = [
                    'id' => Str::ulid(),
                    'product_id' => $line['product_id'],
                    'product_name' => $line['product_name'],
                    'qty_porsi' => $line['qty_porsi'],
                    'price_per_porsi' => $price,
                    'subtotal' => $sub,
                    'note' => $line['note'] ?? null,
                ];
            }

            if ($paymentStatus === 'PAID' && $paymentMethod === 'CASH' && $cashReceived !== null && $cashReceived < $total) {
                throw new \Exception("Uang tunai kurang dari total.");
            }

            $changeAmount = null;
            if ($paymentStatus === 'PAID' && $paymentMethod === 'CASH' && $cashReceived !== null) {
                $changeAmount = $cashReceived - $total;
            }

            $transaction = Transaction::create([
                'outlet_id' => $outletId,
                'invoice_number' => $invoiceNumber,
                'total_amount' => $total,
                'payment_method' => $paymentStatus === 'PAID' ? $paymentMethod : null,
                'cash_received' => $paymentStatus === 'PAID' && $paymentMethod === 'CASH' ? $cashReceived : null,
                'change_amount' => $changeAmount,
                'note' => $note,
                'payment_status' => $paymentStatus,
                'paid_at' => $paymentStatus === 'PAID' ? Carbon::now() : null,
                'created_at' => Carbon::now(),
            ]);

            foreach ($itemCreates as &$ic) {
                $ic['transaction_id'] = $transaction->id;
            }
            TransactionItem::insert($itemCreates);

            return $transaction->load('items');
        });
    }

    public function listTransactions(string $outletId, int $limit = 50)
    {
        return Transaction::where('outlet_id', $outletId)
            ->with('items')
            ->orderByDesc('created_at')
            ->take($limit)
            ->get();
    }

    public function getShiftTransactions(string $outletId, Carbon $openedAt)
    {
        return Transaction::where('outlet_id', $outletId)
            ->where('created_at', '>=', $openedAt)
            ->with('items')
            ->orderByDesc('created_at')
            ->get();
    }

    public function payDebt(string $transactionId, string $outletId, string $paymentMethod, ?float $cashReceived)
    {
        return DB::transaction(function () use ($transactionId, $outletId, $paymentMethod, $cashReceived) {
            $transaction = Transaction::where('id', $transactionId)
                ->where('outlet_id', $outletId)
                ->lockForUpdate()
                ->first();

            if (!$transaction) {
                throw new \Exception("Transaksi tidak ditemukan.");
            }
            if ($transaction->payment_status === 'PAID') {
                throw new \Exception("Transaksi sudah lunas.");
            }

            if ($paymentMethod === 'CASH' && $cashReceived !== null && $cashReceived < $transaction->total_amount) {
                throw new \Exception("Uang tunai kurang dari total tagihan.");
            }

            $changeAmount = null;
            if ($paymentMethod === 'CASH' && $cashReceived !== null) {
                $changeAmount = $cashReceived - $transaction->total_amount;
            }

            $transaction->update([
                'payment_status' => 'PAID',
                'payment_method' => $paymentMethod,
                'cash_received' => $cashReceived,
                'change_amount' => $changeAmount,
                'paid_at' => Carbon::now(),
            ]);

            return $transaction->load('items');
        });
    }
}
