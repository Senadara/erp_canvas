<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\TransactionStockMovement;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TransactionService
{
    public function __construct(private ConversionOutletResolver $conversionOutletResolver) {}

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
        $shiftId = $payload['shift_id'] ?? null;
        $items = $payload['items'];
        $paymentStatus = $payload['payment_status'] ?? 'PAID';
        $paymentMethod = isset($payload['payment_method']) && $payload['payment_method'] !== null
            ? strtoupper((string) $payload['payment_method'])
            : null;
        $note = $payload['note'] ?? null;
        $cashReceived = $payload['cash_received'] ?? null;

        if (empty($items)) {
            throw new \Exception("Keranjang kosong.");
        }
        if ($paymentStatus === 'PAID' && empty($paymentMethod)) {
            throw new \Exception("Pilih metode pembayaran (tunai / QRIS).");
        }

        return DB::transaction(function () use ($outletId, $shiftId, $items, $paymentStatus, $paymentMethod, $note, $cashReceived) {
            $invoiceNumber = $this->nextInvoiceNumber();

            $lockPlan = [];
            $productIds = collect($items)->pluck('product_id')->filter()->unique()->values();
            $products = Product::where('outlet_id', $outletId)
                ->whereIn('id', $productIds)
                ->with('conversions.stockItem')
                ->get()
                ->keyBy('id');

            foreach ($items as $line) {
                $product = $products->get($line['product_id']);
                if (! $product) {
                    throw new \Exception("Produk tidak valid untuk outlet ini.");
                }

                foreach ($product->conversions as $c) {
                    $c = $this->conversionOutletResolver->resolveForSale($c, $outletId, $product->name);
                    if (! $c) continue;

                    if (! $c->stockItem) {
                        throw new \Exception("Konversi produk {$product->name} memiliki bahan yang tidak ditemukan.");
                    }
                    if (! $c->stockItem->trackable) continue;

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
                $stock = DB::table('stock_items')
                    ->where('id', $stockItemId)
                    ->where('outlet_id', $outletId)
                    ->lockForUpdate()
                    ->first();

                if (!$stock) {
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
                $product = $products->get($line['product_id']);
                $price = $product->price;
                $sub = $price * $line['qty_porsi'];
                $total += $sub;
                
                $itemCreates[] = [
                    'id' => Str::ulid(),
                    'product_id' => $product->id,
                    'product_name' => $product->name,
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
                'shift_id' => $shiftId,
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

            if (! empty($lockPlan)) {
                $movementCreates = [];
                foreach ($lockPlan as $stockItemId => $needed) {
                    $movementCreates[] = [
                        'id' => (string) Str::ulid(),
                        'outlet_id' => $outletId,
                        'transaction_id' => $transaction->id,
                        'stock_item_id' => $stockItemId,
                        'qty' => $needed,
                        'type' => 'SALE_DEDUCTION',
                        'created_at' => Carbon::now(),
                    ];
                }
                TransactionStockMovement::insert($movementCreates);
            }

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

    public function getShiftTransactions(string $shiftId)
    {
        return Transaction::where('shift_id', $shiftId)
            ->with('items')
            ->orderByDesc('created_at')
            ->get();
    }

    public function getUnpaidTransactions(string $outletId)
    {
        return Transaction::where('outlet_id', $outletId)
            ->where('payment_status', 'UNPAID')
            ->with('items')
            ->orderByDesc('created_at')
            ->get();
    }

    public function payDebt(string $transactionId, string $outletId, string $paymentMethod, ?float $cashReceived)
    {
        $paymentMethod = strtoupper($paymentMethod);

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
            if ($transaction->payment_status === 'CANCELED') {
                throw new \Exception("Transaksi sudah dibatalkan.");
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

    public function cancelOrder(string $transactionId, string $outletId, ?string $reason = null, ?string $userId = null)
    {
        return DB::transaction(function () use ($transactionId, $outletId, $reason, $userId) {
            $transaction = Transaction::where('id', $transactionId)
                ->where('outlet_id', $outletId)
                ->with('items')
                ->lockForUpdate()
                ->first();

            if (! $transaction) {
                throw new \Exception("Transaksi tidak ditemukan.");
            }
            if ($transaction->payment_status === 'CANCELED' || $transaction->canceled_at) {
                throw new \Exception("Transaksi sudah dibatalkan.");
            }

            $restorePlan = $this->stockRestorePlan($transaction, $outletId);
            $sortedIds = array_keys($restorePlan);
            sort($sortedIds);

            foreach ($sortedIds as $stockItemId) {
                $stock = DB::table('stock_items')
                    ->where('id', $stockItemId)
                    ->where('outlet_id', $outletId)
                    ->lockForUpdate()
                    ->first();

                if (! $stock) {
                    throw new \Exception("Stok tidak valid untuk outlet ini.");
                }
            }

            foreach ($restorePlan as $stockItemId => $qty) {
                DB::table('stock_items')
                    ->where('id', $stockItemId)
                    ->where('outlet_id', $outletId)
                    ->increment('current_stock_biji', $qty);
            }

            if (! empty($restorePlan)) {
                $movementCreates = [];
                foreach ($restorePlan as $stockItemId => $qty) {
                    $movementCreates[] = [
                        'id' => (string) Str::ulid(),
                        'outlet_id' => $outletId,
                        'transaction_id' => $transaction->id,
                        'stock_item_id' => $stockItemId,
                        'qty' => $qty,
                        'type' => 'CANCEL_RESTORE',
                        'created_at' => Carbon::now(),
                    ];
                }
                TransactionStockMovement::insert($movementCreates);
            }

            $transaction->update([
                'payment_status' => 'CANCELED',
                'canceled_at' => Carbon::now(),
                'canceled_by' => $userId,
                'cancel_reason' => $reason,
            ]);

            return $transaction->fresh()->load('items');
        });
    }

    private function stockRestorePlan(Transaction $transaction, string $outletId): array
    {
        $movements = TransactionStockMovement::where('transaction_id', $transaction->id)
            ->where('type', 'SALE_DEDUCTION')
            ->get();

        $restorePlan = [];
        foreach ($movements as $movement) {
            $restorePlan[$movement->stock_item_id] = ($restorePlan[$movement->stock_item_id] ?? 0) + (float) $movement->qty;
        }

        if (! empty($restorePlan)) {
            return $restorePlan;
        }

        $products = Product::whereIn('id', $transaction->items->pluck('product_id')->unique())
            ->with('conversions.stockItem')
            ->get()
            ->keyBy('id');

        foreach ($transaction->items as $item) {
            $product = $products->get($item->product_id);
            if (! $product) continue;

            foreach ($product->conversions as $conversion) {
                if (! $conversion->stockItem || $conversion->stockItem->outlet_id !== $outletId) {
                    continue;
                }
                if (! $conversion->stockItem->trackable) continue;

                $restorePlan[$conversion->stock_item_id] = ($restorePlan[$conversion->stock_item_id] ?? 0)
                    + ((float) $conversion->ratio * (int) $item->qty_porsi);
            }
        }

        return $restorePlan;
    }
}
