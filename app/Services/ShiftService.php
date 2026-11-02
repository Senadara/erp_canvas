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
        $summary = $this->calculateMoneySummary($shift);
        $receivables = $summary['receivables'] ?? $this->emptyReceivableSummary();
        $shift->setAttribute('receivable_created_total', $receivables['created_total']);
        $shift->setAttribute('receivable_created_count', $receivables['created_count']);
        $shift->setAttribute('receivable_collected_total', $receivables['collected_total']);
        $shift->setAttribute('receivable_collected_count', $receivables['collected_count']);
        $shift->setAttribute('receivable_remaining_total', $receivables['remaining_total']);
        $shift->setAttribute('receivable_remaining_count', $receivables['remaining_count']);

        $totalIncome = (float) $summary['cash']['sales'] + (float) $summary['qris']['sales'];
        $shift->setAttribute('total_income', $totalIncome);
        $shift->setAttribute('total_sales_cash', $summary['cash']['sales']);
        $shift->setAttribute('total_sales_qris', $summary['qris']['sales']);

        if ($shift->status !== 'CLOSED') {
            return $shift;
        }

        $shift->setAttribute('expected_cash', $summary['cash']['expected']);
        $shift->setAttribute('expected_qris', $summary['qris']['expected']);
        $shift->setAttribute('discrepancy', (float) ($shift->actual_cash ?? 0) - (float) $summary['cash']['expected']);
        $shift->setAttribute('total_expenses', $this->operatingExpenseTotal($summary));

        return $shift;
    }

    public function receivableActivity(ShiftRecord $shift): array
    {
        return $this->receivableSummary($shift, true);
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
                ->whereNotIn('category', ['Penarikan', PettyCashService::OWNER_DISTRIBUTION_CATEGORY])
                ->count();

            if ($shift->transactions_count > 0 || $expenseCount > 0) {
                throw new \Exception("Shift yang sudah memiliki transaksi atau mutasi kas tidak dapat dihapus.");
            }

            $shift->delete();
        });
    }

    private function calculateMoneySummary(ShiftRecord $shift): array
    {
        [$start, $end] = $this->shiftBounds($shift);

        $transactions = Transaction::where('outlet_id', $shift->outlet_id)
            ->where('payment_status', 'PAID')
            ->where(function ($query) use ($shift, $start, $end) {
                $query->where('payment_shift_id', $shift->id)
                    ->orWhere(function ($legacyQuery) use ($shift, $start, $end) {
                        $legacyQuery->whereNull('payment_shift_id')
                            ->where(function ($legacyPaymentQuery) use ($shift, $start, $end) {
                                $legacyPaymentQuery->whereBetween('paid_at', [$start, $end])
                                    ->orWhere(function ($untrackedPaymentQuery) use ($shift) {
                                        $untrackedPaymentQuery->whereNull('paid_at')
                                            ->where('shift_id', $shift->id);
                                    });
                            });
                    })
                    ->orWhere(function ($sameShiftLegacyQuery) use ($shift, $end) {
                        $sameShiftLegacyQuery->whereNull('payment_shift_id')
                            ->where('shift_id', $shift->id);

                        if ($shift->closed_at) {
                            $sameShiftLegacyQuery->where(function ($paymentTimeQuery) use ($end) {
                                $paymentTimeQuery->whereNull('paid_at')
                                    ->orWhere('paid_at', '<=', $end);
                            });
                        }
                    });
            })
            ->get();

        $summary = $this->emptyMoneySummary();
        $summary['cash']['opening'] = (float) $shift->opening_cash;

        foreach ($transactions as $transaction) {
            $method = $transaction->payment_method === 'QRIS' ? 'qris' : 'cash';
            $amount = (float) $transaction->total_amount;
            $summary[$method]['sales'] += $amount;

            if ($this->isDebtCollectionForShift($transaction, $shift, $start)) {
                $summary[$method]['debt_collections'] += $amount;
            } else {
                $summary[$method]['current_sales'] += $amount;
            }
        }

        $movements = PettyCash::where('outlet_id', $shift->outlet_id)
            ->whereBetween('created_at', [$start, $end])
            ->get();

        foreach ($movements as $movement) {
            $method = $this->resolvePaymentBucket($movement);
            $flow = $this->resolveCashFlow($movement);
            $amount = (float) $movement->amount;

            if (in_array($movement->category, ['Penarikan', PettyCashService::OWNER_DISTRIBUTION_CATEGORY], true)) {
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
        $summary['receivables'] = $this->receivableSummary($shift);

        return $summary;
    }

    private function shiftBounds(ShiftRecord $shift): array
    {
        return [
            $this->storedTime($shift->opened_at),
            $shift->closed_at ? $this->storedTime($shift->closed_at) : $this->storageNow(),
        ];
    }

    private function isDebtCollectionForShift(Transaction $transaction, ShiftRecord $shift, Carbon $start): bool
    {
        if ($transaction->shift_id && $transaction->shift_id !== $shift->id) {
            return true;
        }

        return $transaction->created_at && $this->storedTime($transaction->created_at)->lt($start);
    }

    private function receivableSummary(ShiftRecord $shift, bool $withRows = false): array
    {
        [$start, $end] = $this->shiftBounds($shift);

        $createdQuery = Transaction::where('outlet_id', $shift->outlet_id)
            ->where('shift_id', $shift->id)
            ->where('payment_status', '!=', 'CANCELED')
            ->where(function ($query) use ($shift, $end) {
                $query->where('payment_status', 'UNPAID')
                    ->orWhereNull('paid_at');

                if ($shift->closed_at) {
                    $query->orWhere('paid_at', '>', $end);
                }
            });

        $collectedQuery = Transaction::where('outlet_id', $shift->outlet_id)
            ->where('payment_status', 'PAID')
            ->where(function ($query) use ($shift, $start, $end) {
                $query->where('payment_shift_id', $shift->id)
                    ->orWhere(function ($legacyQuery) use ($start, $end) {
                        $legacyQuery->whereNull('payment_shift_id')
                            ->whereBetween('paid_at', [$start, $end]);
                    });
            })
            ->where(function ($query) use ($shift, $start) {
                $query->where(function ($shiftQuery) use ($shift) {
                    $shiftQuery->whereNotNull('shift_id')
                        ->where('shift_id', '!=', $shift->id);
                })->orWhere('created_at', '<', $start);
            });

        if ($withRows) {
            $created = $createdQuery
                ->with(['items', 'paymentShift:id,name,opened_at,closed_at'])
                ->orderBy('created_at')
                ->get();
            $collected = $collectedQuery
                ->with(['items', 'shift:id,name,opened_at,closed_at'])
                ->orderBy('paid_at')
                ->get();
        } else {
            $created = $createdQuery->get();
            $collected = $collectedQuery->get();
        }

        $remaining = $created->filter(fn (Transaction $transaction) => $transaction->payment_status === 'UNPAID');
        $settledLater = $created->filter(fn (Transaction $transaction) => $transaction->payment_status === 'PAID');

        return [
            ...$this->emptyReceivableSummary(),
            'created_count' => $created->count(),
            'created_total' => round((float) $created->sum('total_amount')),
            'remaining_count' => $remaining->count(),
            'remaining_total' => round((float) $remaining->sum('total_amount')),
            'settled_later_count' => $settledLater->count(),
            'settled_later_total' => round((float) $settledLater->sum('total_amount')),
            'collected_count' => $collected->count(),
            'collected_total' => round((float) $collected->sum('total_amount')),
            'collected_cash' => round((float) $collected->where('payment_method', 'CASH')->sum('total_amount')),
            'collected_qris' => round((float) $collected->where('payment_method', 'QRIS')->sum('total_amount')),
            'created' => $withRows ? $created->map(fn (Transaction $transaction) => $this->formatReceivableTransaction($transaction))->values()->all() : [],
            'collected' => $withRows ? $collected->map(fn (Transaction $transaction) => $this->formatReceivableTransaction($transaction))->values()->all() : [],
        ];
    }

    private function formatReceivableTransaction(Transaction $transaction): array
    {
        return [
            'id' => $transaction->id,
            'invoice_number' => $transaction->invoice_number,
            'total_amount' => (float) $transaction->total_amount,
            'payment_method' => $transaction->payment_method,
            'payment_status' => $transaction->payment_status,
            'note' => $transaction->note,
            'created_at' => $transaction->created_at?->toIso8601String(),
            'paid_at' => $transaction->paid_at?->toIso8601String(),
            'sale_shift' => $transaction->relationLoaded('shift') && $transaction->shift ? [
                'id' => $transaction->shift->id,
                'name' => $transaction->shift->name,
                'opened_at' => $transaction->shift->opened_at?->toIso8601String(),
                'closed_at' => $transaction->shift->closed_at?->toIso8601String(),
            ] : null,
            'payment_shift' => $transaction->relationLoaded('paymentShift') && $transaction->paymentShift ? [
                'id' => $transaction->paymentShift->id,
                'name' => $transaction->paymentShift->name,
                'opened_at' => $transaction->paymentShift->opened_at?->toIso8601String(),
                'closed_at' => $transaction->paymentShift->closed_at?->toIso8601String(),
            ] : null,
            'items' => $transaction->relationLoaded('items')
                ? $transaction->items->map(fn ($item) => [
                    'product_name' => $item->product_name,
                    'qty_porsi' => $item->qty_porsi,
                    'subtotal' => (float) $item->subtotal,
                ])->values()->all()
                : [],
        ];
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
            'current_sales' => 0,
            'debt_collections' => 0,
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
            'receivables' => $this->emptyReceivableSummary(),
        ];
    }

    private function emptyReceivableSummary(): array
    {
        return [
            'created_count' => 0,
            'created_total' => 0,
            'remaining_count' => 0,
            'remaining_total' => 0,
            'settled_later_count' => 0,
            'settled_later_total' => 0,
            'collected_count' => 0,
            'collected_total' => 0,
            'collected_cash' => 0,
            'collected_qris' => 0,
            'created' => [],
            'collected' => [],
        ];
    }
}
