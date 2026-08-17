<?php

namespace App\Http\Controllers;

use App\Models\FinanceWithdrawalSnapshot;
use App\Models\Outlet;
use App\Models\PettyCash;
use App\Models\ShiftRecord;
use App\Models\Transaction;
use App\Services\PettyCashService;
use App\Services\ProductCostService;
use App\Services\ShiftService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class FinanceController extends Controller
{
    private const FINANCE_TIMEZONE = 'Asia/Jakarta';

    public function __construct(
        private PettyCashService $pettyCashService,
        private ShiftService $shiftService,
        private ProductCostService $productCostService,
    ) {}

    public function index(Request $request)
    {
        abort_if(! $request->user()?->isOwner(), 403, 'Hanya owner yang dapat membuka menu keuangan.');

        $outletId = $request->session()->get('outlet_id');
        $outlet = $outletId ? Outlet::find($outletId) : null;

        $start = $request->filled('date_from')
            ? $this->financeDate($request->query('date_from'))->startOfDay()
            : $this->financeNow()->startOfMonth();
        $end = $request->filled('date_to')
            ? $this->financeDate($request->query('date_to'))->endOfDay()
            : $this->financeNow()->endOfDay();
        [$startForQuery, $endForQuery] = $this->storageWindow($start, $end);

        $paidTransactions = Transaction::query()
            ->where('outlet_id', $outletId)
            ->where('payment_status', 'PAID')
            ->tap(fn ($query) => $this->applyPaidTransactionWindow($query, $start, $end, false))
            ->with('items.product')
            ->get();

        $unpaidTransactions = Transaction::query()
            ->where('outlet_id', $outletId)
            ->where('payment_status', 'UNPAID')
            ->whereBetween('created_at', [$startForQuery, $endForQuery])
            ->with('items')
            ->get();

        $canceledTransactions = Transaction::query()
            ->where('outlet_id', $outletId)
            ->where('payment_status', 'CANCELED')
            ->whereBetween('canceled_at', [$startForQuery, $endForQuery])
            ->get();

        $cashMovements = PettyCash::query()
            ->where('outlet_id', $outletId)
            ->whereBetween('created_at', [$startForQuery, $endForQuery])
            ->orderByDesc('created_at')
            ->get();

        $periodSummary = $this->enrichSummaryWithCashPosition(
            $this->buildSummary($paidTransactions, $unpaidTransactions, $canceledTransactions, $cashMovements),
            $start,
            $end,
            [],
            $outletId,
            false
        );

        $currentEnd = $this->financeNow();
        $openShift = $this->shiftService->getOpenShift($outletId);
        $currentPeriod = $this->resolveCurrentCashPeriod($outletId, $currentEnd, $openShift);
        $currentPaidTransactions = $this->paidTransactionsBetween(
            $outletId,
            $currentPeriod['start'],
            $currentEnd,
            $currentPeriod['exclusive_start']
        );
        $currentCashMovements = $this->cashMovementsBetween(
            $outletId,
            $currentPeriod['start'],
            $currentEnd,
            $currentPeriod['exclusive_start']
        );
        $summary = $this->enrichSummaryWithCashPosition(
            $this->buildSummary($currentPaidTransactions, collect(), collect(), $currentCashMovements),
            $currentPeriod['start'],
            $currentEnd,
            $currentPeriod['carry'],
            $outletId,
            $currentPeriod['exclusive_start']
        );
        $summary['lastWithdrawalAt'] = $this->toFinanceIso($currentPeriod['last_withdrawal_at']);
        $summary['resetAfterWithdrawal'] = false;
        $summary['hasOpenShift'] = (bool) $openShift;
        $summary['currentPeriodMode'] = $currentPeriod['mode'];
        $summary['currentShift'] = $openShift ? [
            'id' => $openShift->id,
            'name' => $openShift->name,
            'opened_at' => $this->storedToFinanceIso($openShift->opened_at),
            'opening_cash' => (float) $openShift->opening_cash,
        ] : null;

        $daily = $this->buildDailySeries($start, $end, $paidTransactions, $cashMovements);
        $topProducts = $this->buildTopProducts($paidTransactions);
        $expenseByCategory = $this->buildExpenseByCategory($cashMovements);
        $withdrawalHistory = $this->buildWithdrawalHistory($outletId, $start, $end);

        return Inertia::render('Finance/Index', [
            'outlet' => $outlet,
            'filters' => [
                'date_from' => $start->toDateString(),
                'date_to' => $end->toDateString(),
            ],
            'summary' => $summary,
            'periodSummary' => $periodSummary,
            'daily' => $daily,
            'topProducts' => $topProducts,
            'expenseByCategory' => $expenseByCategory,
            'cashMovements' => $cashMovements->take(80)->values(),
            'withdrawals' => $cashMovements->where('category', 'Penarikan')->take(50)->values(),
            'withdrawalHistory' => $withdrawalHistory,
        ]);
    }

    private function financeNow(): Carbon
    {
        return Carbon::now(self::FINANCE_TIMEZONE);
    }

    private function financeDate(string $value): Carbon
    {
        return Carbon::parse($value, self::FINANCE_TIMEZONE);
    }

    private function storageTimezone(): string
    {
        return config('app.timezone') ?: 'UTC';
    }

    private function toStorageTime(Carbon $date): Carbon
    {
        return $date->copy()->setTimezone($this->storageTimezone());
    }

    private function toFinanceTime(Carbon|string $date): Carbon
    {
        if ($date instanceof Carbon) {
            return $date->copy()->setTimezone(self::FINANCE_TIMEZONE);
        }

        return Carbon::parse($date, $this->storageTimezone())
            ->setTimezone(self::FINANCE_TIMEZONE);
    }

    private function storedToFinanceTime(Carbon|string $date): Carbon
    {
        $value = $date instanceof Carbon
            ? $date->format('Y-m-d H:i:s.u')
            : $date;

        return Carbon::parse($value, $this->storageTimezone())
            ->setTimezone(self::FINANCE_TIMEZONE);
    }

    private function toFinanceIso(Carbon|string|null $date): ?string
    {
        if (! $date) {
            return null;
        }

        return $this->toFinanceTime($date)->toIso8601String();
    }

    private function storedToFinanceIso(Carbon|string|null $date): ?string
    {
        if (! $date) {
            return null;
        }

        return $this->storedToFinanceTime($date)->toIso8601String();
    }

    private function storageWindow(Carbon $start, Carbon $end): array
    {
        return [$this->toStorageTime($start), $this->toStorageTime($end)];
    }

    private function paidTransactionsBetween(?string $outletId, Carbon $start, Carbon $end, bool $exclusiveStart)
    {
        return Transaction::query()
            ->where('outlet_id', $outletId)
            ->where('payment_status', 'PAID')
            ->tap(fn ($query) => $this->applyPaidTransactionWindow($query, $start, $end, $exclusiveStart))
            ->with('items.product')
            ->get();
    }

    private function applyPaidTransactionWindow($query, Carbon $start, Carbon $end, bool $exclusiveStart): void
    {
        $operator = $exclusiveStart ? '>' : '>=';
        [$startForQuery, $endForQuery] = $this->storageWindow($start, $end);

        $query->where(function ($dateQuery) use ($startForQuery, $endForQuery, $operator) {
            $dateQuery
                ->where(function ($paidAtQuery) use ($startForQuery, $endForQuery, $operator) {
                    $paidAtQuery->whereNotNull('paid_at')
                        ->where('paid_at', '<=', $endForQuery)
                        ->where('paid_at', $operator, $startForQuery);
                })
                ->orWhere(function ($legacyQuery) use ($startForQuery, $endForQuery, $operator) {
                    $legacyQuery->whereNull('paid_at')
                        ->where('created_at', '<=', $endForQuery)
                        ->where('created_at', $operator, $startForQuery);
                });
        });
    }

    private function cashMovementsBetween(?string $outletId, Carbon $start, Carbon $end, bool $exclusiveStart)
    {
        [$startForQuery, $endForQuery] = $this->storageWindow($start, $end);
        $query = PettyCash::query()
            ->where('outlet_id', $outletId)
            ->where('created_at', '<=', $endForQuery);

        if ($exclusiveStart) {
            $query->where('created_at', '>', $startForQuery);
        } else {
            $query->where('created_at', '>=', $startForQuery);
        }

        return $query->orderByDesc('created_at')->get();
    }

    private function resolveCurrentCashPeriod(?string $outletId, Carbon $periodEnd, ?ShiftRecord $openShift = null): array
    {
        $baseCarry = $this->emptyCashCarry();
        $periodEndForQuery = $this->toStorageTime($periodEnd);

        $lastWithdrawal = $outletId ? PettyCash::query()
            ->where('outlet_id', $outletId)
            ->where('category', 'Penarikan')
            ->where('created_at', '<=', $periodEndForQuery)
            ->orderByDesc('created_at')
            ->first() : null;

        if ($lastWithdrawal) {
            $withdrawalAt = $this->storedToFinanceTime($lastWithdrawal->created_at);
            $carry = $this->carryAfterWithdrawal($lastWithdrawal, $outletId);
            $carry = $this->withActiveShiftTopupCarry($carry, $outletId, $openShift, $withdrawalAt);

            return [
                'start' => $withdrawalAt,
                'exclusive_start' => true,
                'mode' => 'SINCE_LAST_WITHDRAWAL',
                'last_withdrawal_at' => $withdrawalAt,
                'carry' => $carry,
            ];
        }

        $firstActivityAt = $this->firstFinanceActivityAt($outletId, $periodEnd);

        if ($openShift && (! $firstActivityAt || $this->storedToFinanceTime($openShift->opened_at)->lte($firstActivityAt))) {
            return [
                'start' => $this->storedToFinanceTime($openShift->opened_at),
                'exclusive_start' => false,
                'mode' => 'OPEN_SHIFT',
                'last_withdrawal_at' => null,
                'carry' => $baseCarry,
            ];
        }

        return [
            'start' => $firstActivityAt ?: $periodEnd->copy()->startOfDay(),
            'exclusive_start' => false,
            'mode' => $firstActivityAt ? 'ALL_UNWITHDRAWN' : 'TODAY',
            'last_withdrawal_at' => null,
            'carry' => $baseCarry,
        ];
    }

    private function emptyCashCarry(): array
    {
        return [
            'cash_net' => 0,
            'qris_balance' => 0,
            'cashier_topups' => 0,
            'outside_cashier_topups' => 0,
        ];
    }

    private function latestWithdrawalBefore(?string $outletId, Carbon $date): ?PettyCash
    {
        if (! $outletId) {
            return null;
        }

        return PettyCash::query()
            ->where('outlet_id', $outletId)
            ->where('category', 'Penarikan')
            ->where('created_at', '<', $this->toStorageTime($date))
            ->orderByDesc('created_at')
            ->first();
    }

    private function carryAfterWithdrawal(PettyCash $withdrawal, ?string $outletId): array
    {
        $snapshot = FinanceWithdrawalSnapshot::query()
            ->where('petty_cash_id', $withdrawal->id)
            ->first();

        if ($snapshot) {
            return $this->carryAfterWithdrawalSnapshot($snapshot);
        }

        $withdrawalAt = $this->storedToFinanceTime($withdrawal->created_at);
        $previousWithdrawal = $this->latestWithdrawalBefore($outletId, $withdrawalAt);

        if ($previousWithdrawal) {
            $periodStart = $this->storedToFinanceTime($previousWithdrawal->created_at);
            $exclusiveStart = true;
            $carry = $this->carryAfterWithdrawal($previousWithdrawal, $outletId);
        } else {
            $periodStart = $this->firstFinanceActivityAt($outletId, $withdrawalAt) ?: $withdrawalAt->copy()->startOfDay();
            $exclusiveStart = false;
            $carry = $this->emptyCashCarry();
        }

        $summary = $this->buildWithdrawalPeriodSummary(
            $outletId,
            $periodStart,
            $withdrawalAt,
            $exclusiveStart,
            $withdrawal->id,
            $carry
        );

        return $this->carryAfterWithdrawalSummary(
            (float) $summary['cashDrawerNet'],
            (float) $summary['qrisBalanceActual'],
            $this->normalizePaymentMethod($withdrawal),
            (float) $withdrawal->amount
        );
    }

    private function carryAfterWithdrawalSnapshot(FinanceWithdrawalSnapshot $snapshot): array
    {
        $meta = $snapshot->meta ?? [];

        if (array_key_exists('cash_net_after', $meta) && array_key_exists('qris_balance_after', $meta)) {
            return array_merge($this->emptyCashCarry(), [
                'cash_net' => (float) ($meta['cash_net_after'] ?? 0),
                'qris_balance' => (float) ($meta['qris_balance_after'] ?? 0),
            ]);
        }

        $openingCash = (float) ($meta['standard_opening_cash'] ?? ShiftService::STANDARD_OPENING_CASH);
        $cashNetBefore = (float) $snapshot->cash_balance_before - $openingCash - (float) $snapshot->cashier_topups;

        return $this->carryAfterWithdrawalSummary(
            $cashNetBefore,
            (float) $snapshot->qris_balance_before,
            $snapshot->withdrawal_method,
            (float) $snapshot->withdrawal_amount
        );
    }

    private function carryAfterWithdrawalSummary(float $cashNetBefore, float $qrisBalanceBefore, string $method, float $amount): array
    {
        $cashNetAfter = $cashNetBefore;
        $qrisBalanceAfter = $qrisBalanceBefore;

        if ($method === 'QRIS') {
            $qrisBalanceAfter -= $amount;
        } else {
            $cashNetAfter -= $amount;
        }

        return array_merge($this->emptyCashCarry(), [
            'cash_net' => $cashNetAfter,
            'qris_balance' => $qrisBalanceAfter,
        ]);
    }

    private function withActiveShiftTopupCarry(array $carry, ?string $outletId, ?ShiftRecord $openShift, Carbon $until): array
    {
        if (! $outletId || ! $openShift) {
            return $carry;
        }

        $openedAt = $this->storedToFinanceTime($openShift->opened_at);
        if ($openedAt->gt($until)) {
            return $carry;
        }
        [$openedAtForQuery, $untilForQuery] = $this->storageWindow($openedAt, $until);

        $topups = PettyCash::query()
            ->where('outlet_id', $outletId)
            ->whereIn('category', ['Tambah Modal', 'Tambah Kas'])
            ->where('created_at', '>=', $openedAtForQuery)
            ->where('created_at', '<=', $untilForQuery)
            ->get(['amount', 'payment_method']);

        $cashierTopups = (float) $topups->sum('amount');
        $outsideTopups = (float) $topups
            ->filter(fn (PettyCash $movement) => $this->normalizePaymentMethod($movement) === 'PRIVATE')
            ->sum('amount');

        return array_merge($carry, [
            'cashier_topups' => (float) ($carry['cashier_topups'] ?? 0) + $cashierTopups,
            'outside_cashier_topups' => (float) ($carry['outside_cashier_topups'] ?? 0) + $outsideTopups,
        ]);
    }

    private function firstFinanceActivityAt(?string $outletId, Carbon $periodEnd): ?Carbon
    {
        if (! $outletId) {
            return null;
        }

        $periodEndForQuery = $this->toStorageTime($periodEnd);
        $dates = collect([
            Transaction::query()
                ->where('outlet_id', $outletId)
                ->where('payment_status', 'PAID')
                ->whereNotNull('paid_at')
                ->where('paid_at', '<=', $periodEndForQuery)
                ->min('paid_at'),
            Transaction::query()
                ->where('outlet_id', $outletId)
                ->where('payment_status', 'PAID')
                ->whereNull('paid_at')
                ->where('created_at', '<=', $periodEndForQuery)
                ->min('created_at'),
            PettyCash::query()
                ->where('outlet_id', $outletId)
                ->where('created_at', '<=', $periodEndForQuery)
                ->min('created_at'),
            ShiftRecord::query()
                ->where('outlet_id', $outletId)
                ->where('opened_at', '<=', $periodEndForQuery)
                ->min('opened_at'),
        ])->filter();

        if ($dates->isEmpty()) {
            return null;
        }

        return $dates
            ->map(fn ($date) => $this->storedToFinanceTime($date))
            ->sort()
            ->first();
    }

    public function withdraw(Request $request)
    {
        abort_if(! $request->user()?->isOwner(), 403, 'Hanya owner yang dapat melakukan penarikan.');

        $outletId = $request->session()->get('outlet_id');
        $data = $request->validate([
            'amount' => 'required|numeric|min:1',
            'payment_method' => 'required|in:CASH,QRIS',
            'description' => 'nullable|string|max:255',
            'date' => 'nullable|date',
        ]);

        $withdrawDate = isset($data['date']) && $data['date']
            ? $this->financeDate($data['date'])
            : $this->financeNow();

        DB::transaction(function () use ($outletId, $data, $withdrawDate) {
            $period = $this->resolveWithdrawalPeriod($outletId, $withdrawDate);
            $periodSummary = $this->buildWithdrawalPeriodSummary(
                $outletId,
                $period['start'],
                $withdrawDate,
                $period['exclusive_start'],
                null,
                $period['carry']
            );

            $availableForMethod = $data['payment_method'] === 'QRIS'
                ? (float) $periodSummary['withdrawableQris']
                : (float) $periodSummary['withdrawableCash'];

            if ((float) $data['amount'] > $availableForMethod) {
                $label = $data['payment_method'] === 'QRIS' ? 'QRIS' : 'cash bersih';

                throw ValidationException::withMessages([
                    'amount' => "Nominal penarikan melebihi saldo {$label} yang tersedia.",
                ]);
            }

            $withdrawal = $this->pettyCashService->createExpense([
                'outlet_id' => $outletId,
                'amount' => $data['amount'],
                'category' => 'Penarikan',
                'payment_method' => $data['payment_method'],
                'cash_flow' => 'OUT',
                'description' => $data['description'] ?? null,
                'date' => $this->toStorageTime($withdrawDate),
            ]);

            $this->storeWithdrawalSnapshot($withdrawal, $period['start'], $withdrawDate, $periodSummary);
        });

        return redirect()->back()->with('success', 'Penarikan saldo berhasil dicatat.');
    }

    private function resolveWithdrawalPeriod(?string $outletId, Carbon $periodEnd): array
    {
        $openShift = $outletId ? $this->shiftService->getOpenShift($outletId) : null;

        if ($openShift && $this->storedToFinanceTime($openShift->opened_at)->gt($periodEnd)) {
            $openShift = null;
        }

        return $this->resolveCurrentCashPeriod($outletId, $periodEnd, $openShift);
    }

    private function buildWithdrawalPeriodSummary(
        ?string $outletId,
        Carbon $periodStart,
        Carbon $periodEnd,
        bool $exclusiveStart,
        ?string $excludeMovementId = null,
        array $carry = []
    ): array {
        $paidQuery = Transaction::query()
            ->where('outlet_id', $outletId)
            ->where('payment_status', 'PAID')
            ->tap(fn ($query) => $this->applyPaidTransactionWindow($query, $periodStart, $periodEnd, $exclusiveStart))
            ->with('items.product');

        [$periodStartForQuery, $periodEndForQuery] = $this->storageWindow($periodStart, $periodEnd);
        $movementQuery = PettyCash::query()
            ->where('outlet_id', $outletId)
            ->where('created_at', '<=', $periodEndForQuery);

        $exclusiveStart
            ? $movementQuery->where('created_at', '>', $periodStartForQuery)
            : $movementQuery->where('created_at', '>=', $periodStartForQuery);

        if ($excludeMovementId) {
            $movementQuery->where('id', '!=', $excludeMovementId);
        }

        $summary = $this->buildSummary(
            $paidQuery->get(),
            collect(),
            collect(),
            $movementQuery->orderByDesc('created_at')->get()
        );
        $summary = $this->enrichSummaryWithCashPosition($summary, $periodStart, $periodEnd, $carry, $outletId, $exclusiveStart);
        $cashBalanceBefore = (float) $summary['cashDrawerActual'];
        $qrisBalanceBefore = (float) $summary['qrisBalanceActual'];
        $availableBefore = (float) $summary['cleanFinance'];

        return array_merge($summary, [
            'cashBalanceBefore' => $cashBalanceBefore,
            'qrisBalanceBefore' => $qrisBalanceBefore,
            'availableBefore' => $availableBefore,
        ]);
    }

    private function storeWithdrawalSnapshot(PettyCash $withdrawal, Carbon $periodStart, Carbon $periodEnd, array $summary): void
    {
        $withdrawalAmount = (float) $withdrawal->amount;
        $withdrawalMethod = $this->normalizePaymentMethod($withdrawal);
        $cashNetBefore = (float) $summary['cashDrawerNet'];
        $qrisBalanceBefore = (float) $summary['qrisBalanceActual'];
        $afterCarry = $this->carryAfterWithdrawalSummary(
            $cashNetBefore,
            $qrisBalanceBefore,
            $withdrawalMethod,
            $withdrawalAmount
        );

        FinanceWithdrawalSnapshot::updateOrCreate(
            ['petty_cash_id' => $withdrawal->id],
            [
                'outlet_id' => $withdrawal->outlet_id,
                'period_start' => $this->toStorageTime($periodStart),
                'period_end' => $this->toStorageTime($periodEnd),
                'withdrawal_amount' => $withdrawalAmount,
                'withdrawal_method' => $withdrawalMethod,
                'omzet_total' => $summary['omzet'],
                'cash_sales' => $summary['cashSales'],
                'qris_sales' => $summary['qrisSales'],
                'hpp_total' => $summary['hpp'],
                'gross_profit' => $summary['grossProfit'],
                'expense_total' => $summary['expenseTotal'],
                'cash_expense' => $summary['cashExpense'],
                'qris_expense' => $summary['qrisExpense'],
                'outside_expense' => $summary['outsideExpense'],
                'cashier_topups' => $summary['cashierTopups'],
                'net_profit' => $summary['netProfit'],
                'net_after_allocations' => $summary['netAfterAllocations'],
                'cash_balance_before' => $summary['cashBalanceBefore'],
                'qris_balance_before' => $summary['qrisBalanceBefore'],
                'available_before' => $summary['availableBefore'],
                'remaining_after' => (float) $summary['availableBefore'] - $withdrawalAmount,
                'transaction_count' => $summary['transactionCount'],
                'meta' => [
                    'standard_opening_cash' => $summary['standardOpeningCash'],
                    'cash_restock_expense' => $summary['cashRestockExpense'],
                    'qris_restock_expense' => $summary['qrisRestockExpense'],
                    'private_restock_expense' => $summary['privateRestockExpense'],
                    'drawer_cashier_topups' => $summary['drawerCashierTopups'],
                    'outside_cashier_topups' => $summary['outsideCashierTopups'],
                    'cash_net_before' => $cashNetBefore,
                    'qris_balance_before' => $qrisBalanceBefore,
                    'cash_net_after' => $afterCarry['cash_net'],
                    'qris_balance_after' => $afterCarry['qris_balance'],
                ],
            ]
        );
    }

    private function buildWithdrawalHistory(?string $outletId, Carbon $start, Carbon $end): array
    {
        [$startForQuery, $endForQuery] = $this->storageWindow($start, $end);
        $withdrawals = PettyCash::query()
            ->where('outlet_id', $outletId)
            ->where('category', 'Penarikan')
            ->whereBetween('created_at', [$startForQuery, $endForQuery])
            ->orderByDesc('created_at')
            ->take(80)
            ->get();

        $snapshots = FinanceWithdrawalSnapshot::query()
            ->whereIn('petty_cash_id', $withdrawals->pluck('id'))
            ->get()
            ->keyBy('petty_cash_id');

        return $withdrawals->map(function (PettyCash $withdrawal) use ($outletId, $snapshots) {
            $snapshot = $snapshots->get($withdrawal->id);

            if ($snapshot) {
                return $this->formatWithdrawalSnapshotHistory($withdrawal, $snapshot);
            }

            $periodEnd = $this->storedToFinanceTime($withdrawal->created_at);
            $period = $this->resolveWithdrawalPeriod($outletId, $periodEnd);
            $summary = $this->buildWithdrawalPeriodSummary(
                $outletId,
                $period['start'],
                $periodEnd,
                $period['exclusive_start'],
                $withdrawal->id,
                $period['carry']
            );

            return $this->formatWithdrawalComputedHistory($withdrawal, $period['start'], $periodEnd, $summary);
        })->values()->all();
    }

    private function formatWithdrawalSnapshotHistory(PettyCash $withdrawal, FinanceWithdrawalSnapshot $snapshot): array
    {
        return [
            'id' => $withdrawal->id,
            'date' => $this->storedToFinanceIso($withdrawal->created_at),
            'description' => $withdrawal->description,
            'method' => $snapshot->withdrawal_method,
            'amount' => (float) $snapshot->withdrawal_amount,
            'period_start' => $this->storedToFinanceIso($snapshot->period_start),
            'period_end' => $this->storedToFinanceIso($snapshot->period_end),
            'omzet' => (float) $snapshot->omzet_total,
            'cash_sales' => (float) $snapshot->cash_sales,
            'qris_sales' => (float) $snapshot->qris_sales,
            'hpp' => (float) $snapshot->hpp_total,
            'gross_profit' => (float) $snapshot->gross_profit,
            'expense_total' => (float) $snapshot->expense_total,
            'cash_expense' => (float) $snapshot->cash_expense,
            'qris_expense' => (float) $snapshot->qris_expense,
            'outside_expense' => (float) $snapshot->outside_expense,
            'cashier_topups' => (float) $snapshot->cashier_topups,
            'drawer_cashier_topups' => (float) ($snapshot->meta['drawer_cashier_topups'] ?? $snapshot->cashier_topups),
            'outside_cashier_topups' => (float) ($snapshot->meta['outside_cashier_topups'] ?? 0),
            'net_profit' => (float) $snapshot->net_profit,
            'net_after_allocations' => (float) $snapshot->net_after_allocations,
            'cash_balance_before' => (float) $snapshot->cash_balance_before,
            'qris_balance_before' => (float) $snapshot->qris_balance_before,
            'available_before' => (float) $snapshot->available_before,
            'remaining_after' => (float) $snapshot->remaining_after,
            'transaction_count' => (int) $snapshot->transaction_count,
            'source' => 'SNAPSHOT',
        ];
    }

    private function formatWithdrawalComputedHistory(PettyCash $withdrawal, Carbon $periodStart, Carbon $periodEnd, array $summary): array
    {
        $withdrawalAmount = (float) $withdrawal->amount;

        return [
            'id' => $withdrawal->id,
            'date' => $this->storedToFinanceIso($withdrawal->created_at),
            'description' => $withdrawal->description,
            'method' => $this->normalizePaymentMethod($withdrawal),
            'amount' => $withdrawalAmount,
            'period_start' => $this->toFinanceIso($periodStart),
            'period_end' => $this->toFinanceIso($periodEnd),
            'omzet' => (float) $summary['omzet'],
            'cash_sales' => (float) $summary['cashSales'],
            'qris_sales' => (float) $summary['qrisSales'],
            'hpp' => (float) $summary['hpp'],
            'gross_profit' => (float) $summary['grossProfit'],
            'expense_total' => (float) $summary['expenseTotal'],
            'cash_expense' => (float) $summary['cashExpense'],
            'qris_expense' => (float) $summary['qrisExpense'],
            'outside_expense' => (float) $summary['outsideExpense'],
            'cashier_topups' => (float) $summary['cashierTopups'],
            'drawer_cashier_topups' => (float) $summary['drawerCashierTopups'],
            'outside_cashier_topups' => (float) $summary['outsideCashierTopups'],
            'net_profit' => (float) $summary['netProfit'],
            'net_after_allocations' => (float) $summary['netAfterAllocations'],
            'cash_balance_before' => (float) $summary['cashBalanceBefore'],
            'qris_balance_before' => (float) $summary['qrisBalanceBefore'],
            'available_before' => (float) $summary['availableBefore'],
            'remaining_after' => (float) $summary['availableBefore'] - $withdrawalAmount,
            'transaction_count' => (int) $summary['transactionCount'],
            'source' => 'COMPUTED',
        ];
    }

    private function buildSummary($paidTransactions, $unpaidTransactions, $canceledTransactions, $cashMovements): array
    {
        $omzet = 0;
        $cashSales = 0;
        $qrisSales = 0;
        $hpp = 0;

        foreach ($paidTransactions as $transaction) {
            $omzet += (float) $transaction->total_amount;
            if ($this->normalizeTransactionPaymentMethod($transaction->payment_method) === 'QRIS') {
                $qrisSales += (float) $transaction->total_amount;
            } else {
                $cashSales += (float) $transaction->total_amount;
            }

            foreach ($transaction->items as $item) {
                $hpp += $this->productCostService->itemHppTotal($item);
            }
        }

        $expenseTotal = 0;
        $cashExpense = 0;
        $qrisExpense = 0;
        $outsideExpense = 0;
        $cashRestockExpense = 0;
        $qrisRestockExpense = 0;
        $privateRestockExpense = 0;
        $cashAdditions = 0;
        $withdrawCash = 0;
        $withdrawQris = 0;
        $cashierTopups = 0;
        $drawerCashierTopups = 0;
        $outsideCashierTopups = 0;
        $standardOpeningCash = ShiftService::STANDARD_OPENING_CASH;

        foreach ($cashMovements as $movement) {
            $amount = (float) $movement->amount;
            $method = $this->normalizePaymentMethod($movement);

            if (in_array($movement->category, ['Tambah Modal', 'Tambah Kas'], true)) {
                $cashierTopups += $amount;
                if ($method === 'PRIVATE') {
                    $outsideCashierTopups += $amount;
                } else {
                    $drawerCashierTopups += $amount;
                }
                continue;
            }

            if ($movement->cash_flow === 'IN') {
                $cashAdditions += $amount;
                continue;
            }

            if ($movement->category === 'Penarikan') {
                if ($method === 'QRIS') {
                    $withdrawQris += $amount;
                } elseif ($method === 'CASH') {
                    $withdrawCash += $amount;
                }
                continue;
            }

            $expenseTotal += $amount;
            if ($movement->category === 'RESTOCK') {
                if ($method === 'PRIVATE') {
                    $privateRestockExpense += $amount;
                } elseif ($method === 'QRIS') {
                    $qrisRestockExpense += $amount;
                } else {
                    $cashRestockExpense += $amount;
                }
            }

            match ($method) {
                'QRIS' => $qrisExpense += $amount,
                'PRIVATE' => $outsideExpense += $amount,
                default => $cashExpense += $amount,
            };
        }

        $grossProfit = $omzet - $hpp;
        $inventoryExpenseTotal = $cashRestockExpense + $qrisRestockExpense + $privateRestockExpense;
        $operatingExpenseTotal = max(0, $expenseTotal - $inventoryExpenseTotal);
        $netProfit = $grossProfit - $operatingExpenseTotal;
        $netAfterAllocations = $netProfit - $drawerCashierTopups;

        return [
            'omzet' => $omzet,
            'cashSales' => $cashSales,
            'qrisSales' => $qrisSales,
            'hpp' => $hpp,
            'grossProfit' => $grossProfit,
            'expenseTotal' => $expenseTotal,
            'cashExpense' => $cashExpense,
            'qrisExpense' => $qrisExpense,
            'outsideExpense' => $outsideExpense,
            'operatingExpenseTotal' => $operatingExpenseTotal,
            'inventoryExpenseTotal' => $inventoryExpenseTotal,
            'cashRestockExpense' => $cashRestockExpense,
            'qrisRestockExpense' => $qrisRestockExpense,
            'privateRestockExpense' => $privateRestockExpense,
            'netProfit' => $netProfit,
            'netAfterAllocations' => $netAfterAllocations,
            'cashAdditions' => $cashAdditions,
            'standardOpeningCash' => $standardOpeningCash,
            'cashierTopups' => $cashierTopups,
            'drawerCashierTopups' => $drawerCashierTopups,
            'outsideCashierTopups' => $outsideCashierTopups,
            'allocationTotal' => $drawerCashierTopups,
            'withdrawCash' => $withdrawCash,
            'withdrawQris' => $withdrawQris,
            'withdrawTotal' => $withdrawCash + $withdrawQris,
            'transactionCount' => $paidTransactions->count(),
            'unpaidCount' => $unpaidTransactions->count(),
            'unpaidTotal' => $unpaidTransactions->sum('total_amount'),
            'canceledCount' => $canceledTransactions->count(),
            'canceledTotal' => $canceledTransactions->sum('total_amount'),
        ];
    }

    private function enrichSummaryWithCashPosition(
        array $summary,
        Carbon $periodStart,
        Carbon $periodEnd,
        array $carry = [],
        ?string $outletId = null,
        bool $exclusiveStart = false
    ): array
    {
        $defaultOpeningCash = ShiftService::STANDARD_OPENING_CASH;
        $openingCash = $this->resolveOpeningCash($outletId, $periodStart, $periodEnd);
        $summary['standardOpeningCash'] = $openingCash;
        $summary['defaultOpeningCash'] = $defaultOpeningCash;
        $summary['openingCash'] = $openingCash;
        $carryCashNet = (float) ($carry['cash_net'] ?? 0);
        $carryQrisBalance = (float) ($carry['qris_balance'] ?? 0);
        $carryCashierTopups = (float) ($carry['cashier_topups'] ?? 0);
        $carryOutsideCashierTopups = (float) ($carry['outside_cashier_topups'] ?? 0);
        $cashierTopups = (float) $summary['cashierTopups'];
        $activeCashierTopups = $carryCashierTopups + $cashierTopups;
        $activeOutsideCashierTopups = $carryOutsideCashierTopups + (float) $summary['outsideCashierTopups'];
        $activeDrawerCashierTopups = $activeCashierTopups - $activeOutsideCashierTopups;
        $cashRestockExpense = (float) ($summary['cashRestockExpense'] ?? 0);
        $cashDrawerSavingsExpense = max(0, (float) $summary['cashExpense'] - $cashRestockExpense);
        $closedShiftDiscrepancy = $this->closedShiftDiscrepancyTotal($outletId, $periodStart, $periodEnd, $exclusiveStart);
        $cashDrawerNet = $carryCashNet
            + (float) $summary['cashSales']
            + (float) $summary['cashAdditions']
            - $cashRestockExpense
            - $cashDrawerSavingsExpense
            - (float) $summary['withdrawCash']
            - (float) $summary['drawerCashierTopups']
            + $closedShiftDiscrepancy;
        $cashDrawerActual = $openingCash + $cashDrawerNet + $activeCashierTopups;
        $qrisBalanceActual = $carryQrisBalance
            + (float) $summary['qrisSales']
            - (float) $summary['qrisExpense']
            - (float) $summary['withdrawQris'];
        $cleanFinance = $cashDrawerNet + $qrisBalanceActual;
        $periodDays = max(1, $periodStart->copy()->startOfDay()->diffInDays($periodEnd->copy()->startOfDay()) + 1);

        return array_merge($summary, [
            'periodStart' => $this->toFinanceIso($periodStart),
            'periodEnd' => $this->toFinanceIso($periodEnd),
            'periodDays' => $periodDays,
            'cashDrawerActual' => $cashDrawerActual,
            'cashDrawerNet' => $cashDrawerNet,
            'qrisBalanceActual' => $qrisBalanceActual,
            'cleanFinance' => $cleanFinance,
            'withdrawableCash' => max(0, $cashDrawerNet),
            'withdrawableQris' => max(0, $qrisBalanceActual),
            'withdrawableTotal' => max(0, $cashDrawerNet) + max(0, $qrisBalanceActual),
            'carryCashDrawerNet' => $carryCashNet,
            'carryQrisBalance' => $carryQrisBalance,
            'carryCashierTopups' => $carryCashierTopups,
            'activeCashierTopups' => $activeCashierTopups,
            'activeDrawerCashierTopups' => $activeDrawerCashierTopups,
            'activeOutsideCashierTopups' => $activeOutsideCashierTopups,
            'cashDrawerSavingsExpense' => $cashDrawerSavingsExpense,
            'closedShiftDiscrepancy' => $closedShiftDiscrepancy,
            'dailySalesAverage' => (float) $summary['omzet'] / $periodDays,
            'dailyExpenseAverage' => (float) $summary['expenseTotal'] / $periodDays,
        ]);
    }

    private function closedShiftDiscrepancyTotal(?string $outletId, Carbon $periodStart, Carbon $periodEnd, bool $exclusiveStart = false): float
    {
        if (! $outletId) {
            return 0.0;
        }

        [$periodStartForQuery, $periodEndForQuery] = $this->storageWindow($periodStart, $periodEnd);
        $query = ShiftRecord::query()
            ->where('outlet_id', $outletId)
            ->where('status', 'CLOSED')
            ->whereNotNull('closed_at')
            ->where('closed_at', '<=', $periodEndForQuery);

        $exclusiveStart
            ? $query->where('closed_at', '>', $periodStartForQuery)
            : $query->where('closed_at', '>=', $periodStartForQuery);

        return (float) $query->sum('discrepancy');
    }

    private function resolveOpeningCash(?string $outletId, Carbon $periodStart, Carbon $periodEnd): float
    {
        if (! $outletId) {
            return ShiftService::STANDARD_OPENING_CASH;
        }

        [$periodStartForQuery, $periodEndForQuery] = $this->storageWindow($periodStart, $periodEnd);
        $shift = ShiftRecord::where('outlet_id', $outletId)
            ->where('opened_at', '<=', $periodEndForQuery)
            ->where(function ($query) use ($periodStartForQuery) {
                $query->whereNull('closed_at')
                    ->orWhere('closed_at', '>=', $periodStartForQuery);
            })
            ->orderByDesc('opened_at')
            ->first(['opening_cash']);

        return $shift ? (float) $shift->opening_cash : ShiftService::STANDARD_OPENING_CASH;
    }

    private function buildDailySeries(Carbon $start, Carbon $end, $paidTransactions, $cashMovements): array
    {
        $days = [];
        $cursor = $start->copy();
        while ($cursor->lte($end)) {
            $key = $cursor->toDateString();
            $days[$key] = [
                'date' => $key,
                'omzet' => 0,
                'expenses' => 0,
                'cashier_expenses' => 0,
                'private_expenses' => 0,
                'cashier_topups' => 0,
                'drawer_cashier_topups' => 0,
                'outside_cashier_topups' => 0,
                'profit_expenses' => 0,
                'profit' => 0,
            ];
            $cursor->addDay();
        }

        foreach ($paidTransactions as $transaction) {
            $key = $this->transactionFinanceDate($transaction)->toDateString();
            if (isset($days[$key])) {
                $days[$key]['omzet'] += (float) $transaction->total_amount;
                foreach ($transaction->items as $item) {
                    $days[$key]['profit'] -= $this->productCostService->itemHppTotal($item);
                }
            }
        }

        foreach ($cashMovements as $movement) {
            if ($movement->category === 'Penarikan') {
                continue;
            }

            $key = $this->storedToFinanceTime($movement->created_at)->toDateString();
            if (! isset($days[$key])) {
                continue;
            }

            if (in_array($movement->category, ['Tambah Modal', 'Tambah Kas'], true)) {
                $days[$key]['cashier_topups'] += (float) $movement->amount;
                if ($this->normalizePaymentMethod($movement) === 'PRIVATE') {
                    $days[$key]['outside_cashier_topups'] += (float) $movement->amount;
                } else {
                    $days[$key]['drawer_cashier_topups'] += (float) $movement->amount;
                }
                continue;
            }

            if ($movement->cash_flow === 'OUT') {
                $amount = (float) $movement->amount;
                $days[$key]['expenses'] += $amount;

                if ($this->normalizePaymentMethod($movement) === 'PRIVATE') {
                    $days[$key]['private_expenses'] += $amount;
                } else {
                    $days[$key]['cashier_expenses'] += $amount;
                    if ($movement->category !== 'RESTOCK') {
                        $days[$key]['profit_expenses'] += $amount;
                    }
                }
            }
        }

        foreach ($days as &$day) {
            $day['profit'] += $day['omzet'] - $day['profit_expenses'] - $day['drawer_cashier_topups'];
        }

        return array_values($days);
    }

    private function transactionFinanceDate(Transaction $transaction): Carbon
    {
        return $this->storedToFinanceTime($transaction->paid_at ?: $transaction->created_at);
    }

    private function buildTopProducts($paidTransactions): array
    {
        $products = [];
        foreach ($paidTransactions as $transaction) {
            foreach ($transaction->items as $item) {
                $key = $item->product_id;
                if (! isset($products[$key])) {
                    $products[$key] = [
                        'name' => $item->product_name,
                        'qty' => 0,
                        'revenue' => 0,
                    ];
                }
                $products[$key]['qty'] += (int) $item->qty_porsi;
                $products[$key]['revenue'] += (float) $item->subtotal;
            }
        }

        usort($products, fn ($a, $b) => $b['revenue'] <=> $a['revenue']);

        return array_slice($products, 0, 10);
    }

    private function buildExpenseByCategory($cashMovements): array
    {
        $categories = [];
        foreach ($cashMovements as $movement) {
            if ($movement->cash_flow !== 'OUT' || $movement->category === 'Penarikan') {
                continue;
            }
            if (in_array($movement->category, ['Tambah Modal', 'Tambah Kas'], true)) {
                continue;
            }

            $categories[$movement->category] = ($categories[$movement->category] ?? 0) + (float) $movement->amount;
        }

        arsort($categories);

        return collect($categories)->map(fn ($amount, $category) => [
            'category' => $category,
            'amount' => $amount,
        ])->values()->all();
    }

    private function normalizePaymentMethod(PettyCash $movement): string
    {
        return match (strtoupper((string) $movement->payment_method)) {
            'QRIS' => 'QRIS',
            'PRIVATE' => 'PRIVATE',
            default => 'CASH',
        };
    }

    private function normalizeTransactionPaymentMethod(?string $paymentMethod): string
    {
        return strtoupper((string) $paymentMethod) === 'QRIS' ? 'QRIS' : 'CASH';
    }
}
