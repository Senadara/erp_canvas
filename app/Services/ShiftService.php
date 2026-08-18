<?php

namespace App\Services;

use App\Models\PettyCash;
use App\Models\ShiftRecord;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ShiftService
{
    public const STANDARD_OPENING_CASH = 50000;

    public function getOpenShift(string $outletId)
    {
        return ShiftRecord::where('outlet_id', $outletId)
            ->where('status', 'OPEN')
            ->orderByDesc('opened_at')
            ->first();
    }

    public function openShift(string $outletId, float $openingCash, ?string $name = null, ?string $openedBy = null)
    {
        $open = $this->getOpenShift($outletId);
        if ($open) {
            throw new \Exception("Shift masih terbuka. Tutup shift terlebih dahulu.");
        }
        if ($openingCash < 0) {
            throw new \Exception("Kas awal tidak valid.");
        }
        $name = trim((string) $name);
        if ($name === '') {
            throw new \Exception("Nama shift wajib diisi.");
        }

        return ShiftRecord::create([
            'outlet_id' => $outletId,
            'name' => $name,
            'opening_cash' => $openingCash,
            'status' => 'OPEN',
            'opened_at' => $this->storageNow(),
            'opened_by' => $openedBy,
        ]);
    }

    public function closeShift(string $shiftId, float $actualCash, ?string $note = null, ?string $closedBy = null)
    {
        return DB::transaction(function () use ($shiftId, $actualCash, $note, $closedBy) {
            $shift = ShiftRecord::lockForUpdate()->findOrFail($shiftId);
            
            if ($shift->status !== 'OPEN') {
                throw new \Exception("Shift sudah ditutup.");
            }

            $openedAt = $shift->opened_at;
            $outletId = $shift->outlet_id;
            $shift->closed_at = $this->storageNow();
            $summary = $this->calculateMoneySummary($shift);
            $expectedCash = $summary['cash']['expected'];
            $discrepancy = $actualCash - $expectedCash;
            $totalExpenses = $this->operatingExpenseTotal($summary);

            $shift->update([
                'closed_at' => $shift->closed_at,
                'status' => 'CLOSED',
                'actual_cash' => $actualCash,
                'expected_cash' => $expectedCash,
                'expected_qris' => $summary['qris']['expected'],
                'discrepancy' => $discrepancy,
                'total_sales_cash' => $summary['cash']['sales'],
                'total_sales_qris' => $summary['qris']['sales'],
                'total_expenses' => $totalExpenses,
                'note' => $note,
                'closed_by' => $closedBy,
            ]);

            return $shift;
        });
    }

    public function listShifts(string $outletId, int $limit = 50)
    {
        return ShiftRecord::where('outlet_id', $outletId)
            ->with(['opener:id,display_name', 'closer:id,display_name'])
            ->orderByDesc('opened_at')
            ->take($limit)
            ->get()
            ->each(fn (ShiftRecord $shift) => $this->applyComputedMoneySummary($shift));
    }

    public function moneySummary(?ShiftRecord $shift): array
    {
        if (! $shift) {
            return $this->emptyMoneySummary();
        }

        return $this->calculateMoneySummary($shift);
    }

    public function applyComputedMoneySummary(ShiftRecord $shift): ShiftRecord
    {
        if ($shift->status !== 'CLOSED') {
            return $shift;
        }

        $summary = $this->calculateMoneySummary($shift);
        $shift->setAttribute('expected_cash', $summary['cash']['expected']);
        $shift->setAttribute('expected_qris', $summary['qris']['expected']);
        $shift->setAttribute('discrepancy', (float) ($shift->actual_cash ?? 0) - (float) $summary['cash']['expected']);
        $shift->setAttribute('total_sales_cash', $summary['cash']['sales']);
        $shift->setAttribute('total_sales_qris', $summary['qris']['sales']);
        $shift->setAttribute('total_expenses', $this->operatingExpenseTotal($summary));

        return $shift;
    }

    public function ownerUpdateShift(string $shiftId, string $outletId, array $data, string $ownerId): ShiftRecord
    {
        return DB::transaction(function () use ($shiftId, $outletId, $data, $ownerId) {
            $shift = ShiftRecord::where('id', $shiftId)
                ->where('outlet_id', $outletId)
                ->lockForUpdate()
                ->firstOrFail();

            $name = trim((string) $data['name']);
            if ($name === '') {
                throw new \Exception("Nama shift wajib diisi.");
            }

            $openedAt = Carbon::parse($data['opened_at']);
            $closedAt = ! empty($data['closed_at']) ? Carbon::parse($data['closed_at']) : null;
            if ($closedAt && $closedAt->lt($openedAt)) {
                throw new \Exception("Waktu tutup tidak boleh sebelum waktu buka.");
            }

            if (! $closedAt) {
                $otherOpen = ShiftRecord::where('outlet_id', $outletId)
                    ->where('status', 'OPEN')
                    ->where('id', '!=', $shift->id)
                    ->exists();
                if ($otherOpen) {
                    throw new \Exception("Outlet ini sudah memiliki shift terbuka lain.");
                }
            }

            $shift->fill([
                'name' => $name,
                'opened_at' => $openedAt,
                'closed_at' => $closedAt,
                'opening_cash' => $data['opening_cash'],
                'actual_cash' => $closedAt ? ($data['actual_cash'] ?? 0) : null,
                'note' => $data['note'] ?? null,
                'status' => $closedAt ? 'CLOSED' : 'OPEN',
                'edited_by_owner_at' => Carbon::now(),
                'edited_by_owner_id' => $ownerId,
            ]);

            if ($closedAt) {
                $summary = $this->calculateMoneySummary($shift);
                $shift->expected_cash = $summary['cash']['expected'];
                $shift->expected_qris = $summary['qris']['expected'];
                $shift->discrepancy = $shift->actual_cash - $summary['cash']['expected'];
                $shift->total_sales_cash = $summary['cash']['sales'];
                $shift->total_sales_qris = $summary['qris']['sales'];
                $shift->total_expenses = $this->operatingExpenseTotal($summary);
            } else {
                $shift->expected_cash = null;
                $shift->expected_qris = null;
                $shift->actual_cash = null;
                $shift->discrepancy = null;
                $shift->total_sales_cash = null;
                $shift->total_sales_qris = null;
                $shift->total_expenses = null;
            }

            $shift->save();

            return $shift;
        });
    }

    public function ownerDeleteShift(string $shiftId, string $outletId): void
    {
        DB::transaction(function () use ($shiftId, $outletId) {
            $shift = ShiftRecord::where('id', $shiftId)
                ->where('outlet_id', $outletId)
                ->withCount('transactions')
                ->lockForUpdate()
                ->firstOrFail();

            $end = $shift->closed_at ? $this->storedTime($shift->closed_at) : $this->storageNow();
            $expenseCount = PettyCash::where('outlet_id', $outletId)
                ->whereBetween('created_at', [$this->storedTime($shift->opened_at), $end])
                ->where('category', '!=', 'Penarikan')
                ->count();

            if ($shift->transactions_count > 0 || $expenseCount > 0) {
                throw new \Exception("Shift yang sudah memiliki transaksi atau mutasi kas tidak dapat dihapus.");
            }

            $shift->delete();
        });
    }

    private function calculateMoneySummary(ShiftRecord $shift): array
    {
        $start = $this->storedTime($shift->opened_at);
        $end = $shift->closed_at ? $this->storedTime($shift->closed_at) : $this->storageNow();

        $transactions = Transaction::where('outlet_id', $shift->outlet_id)
            ->where('payment_status', 'PAID')
            ->whereNotNull('paid_at')
            ->where(function ($query) use ($shift, $start, $end) {
                $query->whereBetween('paid_at', [$start, $end])
                    ->orWhere('shift_id', $shift->id);
            })
            ->get();

        $summary = $this->emptyMoneySummary();
        $summary['cash']['opening'] = (float) $shift->opening_cash;

        foreach ($transactions as $transaction) {
            $method = $transaction->payment_method === 'QRIS' ? 'qris' : 'cash';
            $summary[$method]['sales'] += (float) $transaction->total_amount;
        }

        $movements = PettyCash::where('outlet_id', $shift->outlet_id)
            ->whereBetween('created_at', [$start, $end])
            ->get();

        foreach ($movements as $movement) {
            $method = $this->resolvePaymentBucket($movement);
            $flow = $this->resolveCashFlow($movement);
            $amount = (float) $movement->amount;

            if ($movement->category === 'Penarikan') {
                continue;
            }

            if (in_array($movement->category, ['Tambah Modal', 'Tambah Kas'], true)) {
                $summary['cash']['cashier_topups'] += $amount;
                $summary['cash']['additions'] += $amount;
                if ($movement->payment_method === 'PRIVATE') {
                    $summary['cash']['outside_cashier_topups'] += $amount;
                } else {
                    $summary['cash']['drawer_cashier_topups'] += $amount;
                }
                continue;
            }

            if ($method === 'outside') {
                if ($flow === 'IN') {
                    $summary['outside']['additions'] += $amount;
                } else {
                    $summary['outside']['expenses'] += $amount;
                }
                continue;
            }

            if ($flow === 'IN') {
                $summary[$method]['additions'] += $amount;
                continue;
            }

            if ($this->usesActiveShiftFunds($movement)) {
                $summary[$method]['expenses'] += $amount;
            } else {
                $summary[$method]['drawer_expenses'] += $amount;
            }
        }

        foreach (['cash', 'qris', 'outside'] as $method) {
            $summary[$method]['expected'] =
                $summary[$method]['opening']
                + $summary[$method]['sales']
                + $summary[$method]['additions']
                - $summary[$method]['expenses']
                - $summary[$method]['withdrawals'];
        }

        $summary['total_expected'] = $summary['cash']['expected'] + $summary['qris']['expected'];

        return $summary;
    }

    private function resolveCashFlow(PettyCash $movement): string
    {
        if (in_array($movement->category, ['Tambah Modal', 'Tambah Kas'], true)) {
            return 'IN';
        }

        return $movement->cash_flow === 'IN' ? 'IN' : 'OUT';
    }

    private function storageNow(): Carbon
    {
        return Carbon::now(config('app.timezone') ?: 'UTC');
    }

    private function storedTime(Carbon|string $date): Carbon
    {
        $value = $date instanceof Carbon
            ? $date->format('Y-m-d H:i:s.u')
            : $date;

        return Carbon::parse($value, config('app.timezone') ?: 'UTC');
    }

    private function operatingExpenseTotal(array $summary): float
    {
        return (float) $summary['cash']['expenses']
            + (float) ($summary['cash']['drawer_expenses'] ?? 0)
            + (float) $summary['qris']['expenses']
            + (float) ($summary['qris']['drawer_expenses'] ?? 0)
            + (float) $summary['outside']['expenses'];
    }

    private function usesActiveShiftFunds(PettyCash $movement): bool
    {
        return false;
    }

    private function resolvePaymentBucket(PettyCash $movement): string
    {
        return match ($movement->payment_method) {
            'QRIS' => 'qris',
            'PRIVATE' => 'outside',
            default => 'cash',
        };
    }

    private function emptyMoneySummary(): array
    {
        $empty = [
            'opening' => 0,
            'sales' => 0,
            'additions' => 0,
            'expenses' => 0,
            'drawer_expenses' => 0,
            'cashier_topups' => 0,
            'drawer_cashier_topups' => 0,
            'outside_cashier_topups' => 0,
            'withdrawals' => 0,
            'expected' => 0,
        ];

        return [
            'cash' => $empty,
            'qris' => $empty,
            'outside' => $empty,
            'total_expected' => 0,
        ];
    }
}
