<?php

namespace App\Services;

use App\Models\PettyCash;
use App\Models\ShiftRecord;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ShiftService
{
    public function getOpenShift(string $outletId)
    {
        return ShiftRecord::where('outlet_id', $outletId)
            ->where('status', 'OPEN')
            ->orderByDesc('opened_at')
            ->first();
    }

    public function openShift(string $outletId, float $openingCash)
    {
        $open = $this->getOpenShift($outletId);
        if ($open) {
            throw new \Exception("Shift masih terbuka. Tutup shift terlebih dahulu.");
        }
        if ($openingCash < 0) {
            throw new \Exception("Kas awal tidak valid.");
        }

        return ShiftRecord::create([
            'outlet_id' => $outletId,
            'opening_cash' => $openingCash,
            'status' => 'OPEN',
            'opened_at' => Carbon::now(),
        ]);
    }

    public function closeShift(string $shiftId, float $actualCash, ?string $note = null)
    {
        return DB::transaction(function () use ($shiftId, $actualCash, $note) {
            $shift = ShiftRecord::lockForUpdate()->findOrFail($shiftId);
            
            if ($shift->status !== 'OPEN') {
                throw new \Exception("Shift sudah ditutup.");
            }

            $openedAt = $shift->opened_at;
            $outletId = $shift->outlet_id;

            $transactions = Transaction::where('outlet_id', $outletId)
                ->where('created_at', '>=', $openedAt)
                ->where('payment_status', 'PAID')
                ->get();

            $totalSalesCash = 0;
            $totalSalesQris = 0;

            foreach ($transactions as $t) {
                if ($t->payment_method === 'CASH') {
                    $totalSalesCash += $t->total_amount;
                } elseif ($t->payment_method === 'QRIS') {
                    $totalSalesQris += $t->total_amount;
                }
            }

            $expenses = PettyCash::where('outlet_id', $outletId)
                ->where('created_at', '>=', $openedAt)
                ->get();

            $totalExpenses = 0;
            $totalTambahan = 0;

            foreach ($expenses as $e) {
                if ($e->category === 'Tambah Modal') {
                    $totalTambahan += $e->amount;
                } else {
                    $totalExpenses += $e->amount;
                }
            }

            $opening = $shift->opening_cash;
            $expectedCash = $opening + $totalSalesCash + $totalTambahan - $totalExpenses;
            $discrepancy = $actualCash - $expectedCash;

            $shift->update([
                'closed_at' => Carbon::now(),
                'status' => 'CLOSED',
                'actual_cash' => $actualCash,
                'expected_cash' => $expectedCash,
                'discrepancy' => $discrepancy,
                'total_sales_cash' => $totalSalesCash,
                'total_sales_qris' => $totalSalesQris,
                'total_expenses' => $totalExpenses,
                'note' => $note,
            ]);

            return $shift;
        });
    }

    public function listShifts(string $outletId, int $limit = 50)
    {
        return ShiftRecord::where('outlet_id', $outletId)
            ->orderByDesc('opened_at')
            ->take($limit)
            ->get();
    }
}
