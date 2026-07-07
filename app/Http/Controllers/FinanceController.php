<?php

namespace App\Http\Controllers;

use App\Models\FinanceWithdrawalSnapshot;
use App\Models\Outlet;
use App\Models\PettyCash;
use App\Models\Transaction;
use App\Services\PettyCashService;
use App\Services\ShiftService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class FinanceController extends Controller
{
    private const FINANCE_TIMEZONE = 'Asia/Jakarta';

    public function __construct(
        private PettyCashService $pettyCashService,
        private ShiftService $shiftService
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

        $paidTransactions = Transaction::query()
            ->where('outlet_id', $outletId)
            ->where('payment_status', 'PAID')
            ->whereBetween('paid_at', [$start, $end])
            ->with('items.product')
            ->get();

        $unpaidTransactions = Transaction::query()
            ->where('outlet_id', $outletId)
            ->where('payment_status', 'UNPAID')
            ->whereBetween('created_at', [$start, $end])
            ->with('items')
            ->get();

        $canceledTransactions = Transaction::query()
            ->where('outlet_id', $outletId)
            ->where('payment_status', 'CANCELED')
            ->whereBetween('canceled_at', [$start, $end])
            ->get();

        $cashMovements = PettyCash::query()
            ->where('outlet_id', $outletId)
            ->whereBetween('created_at', [$start, $end])
            ->orderByDesc('created_at')
            ->get();

        $periodSummary = $this->enrichSummaryWithCashPosition(
            $this->buildSummary($paidTransactions, $unpaidTransactions, $canceledTransactions, $cashMovements),
            $start,
            $end
        );

        $currentEnd = $this->financeNow();
        $currentPeriod = $this->resolveCurrentCashPeriod($currentEnd);
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
            $currentPeriod['carry']
        );
        $summary['lastWithdrawalAt'] = null;
        $summary['resetAfterWithdrawal'] = false;

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

    private function paidTransactionsBetween(?string $outletId, Carbon $start, Carbon $end, bool $exclusiveStart)
    {
        $query = Transaction::query()
            ->where('outlet_id', $outletId)
            ->where('payment_status', 'PAID')
            ->where('paid_at', '<=', $end)
            ->with('items.product');

        if ($exclusiveStart) {
            $query->where('paid_at', '>', $start);
        } else {
            $query->where('paid_at', '>=', $start);
        }

        return $query->get();
    }

    private function cashMovementsBetween(?string $outletId, Carbon $start, Carbon $end, bool $exclusiveStart)
    {
        $query = PettyCash::query()
            ->where('outlet_id', $outletId)
            ->where('created_at', '<=', $end);

        if ($exclusiveStart) {
            $query->where('created_at', '>', $start);
        } else {
            $query->where('created_at', '>=', $start);
        }

        return $query->orderByDesc('created_at')->get();
    }

    private function resolveCurrentCashPeriod(Carbon $periodEnd): array
    {
        $dayStart = $periodEnd->copy()->startOfDay();

        return [
            'start' => $dayStart,
            'exclusive_start' => false,
            'carry' => [
                'cash_net' => 0,
                'qris_balance' => 0,
                'cashier_topups' => 0,
                'outside_cashier_topups' => 0,
            ],
        ];
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

            $withdrawal = $this->pettyCashService->createExpense([
                'outlet_id' => $outletId,
                'amount' => $data['amount'],
                'category' => 'Penarikan',
                'payment_method' => $data['payment_method'],
                'cash_flow' => 'OUT',
                'description' => $data['description'] ?? null,
                'date' => $withdrawDate,
            ]);

            $this->storeWithdrawalSnapshot($withdrawal, $period['start'], $withdrawDate, $periodSummary);
        });

        return redirect()->back()->with('success', 'Penarikan saldo berhasil dicatat.');
    }

    private function resolveWithdrawalPeriod(?string $outletId, Carbon $periodEnd): array
    {
        $dayStart = $periodEnd->copy()->startOfDay();
        return [
            'start' => $dayStart,
            'exclusive_start' => false,
            'carry' => [
                'cash_net' => 0,
                'qris_balance' => 0,
                'cashier_topups' => 0,
                'outside_cashier_topups' => 0,
            ],
        ];
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
            ->where('paid_at', '<=', $periodEnd)
            ->with('items.product');

        $movementQuery = PettyCash::query()
            ->where('outlet_id', $outletId)
            ->where('created_at', '<=', $periodEnd);

        if ($exclusiveStart) {
            $paidQuery->where('paid_at', '>', $periodStart);
            $movementQuery->where('created_at', '>', $periodStart);
        } else {
            $paidQuery->where('paid_at', '>=', $periodStart);
            $movementQuery->where('created_at', '>=', $periodStart);
        }

        if ($excludeMovementId) {
            $movementQuery->where('id', '!=', $excludeMovementId);
        }

        $summary = $this->buildSummary(
            $paidQuery->get(),
            collect(),
            collect(),
            $movementQuery->orderByDesc('created_at')->get()
        );
        $summary = $this->enrichSummaryWithCashPosition($summary, $periodStart, $periodEnd, $carry);
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

        FinanceWithdrawalSnapshot::updateOrCreate(
            ['petty_cash_id' => $withdrawal->id],
            [
                'outlet_id' => $withdrawal->outlet_id,
                'period_start' => $periodStart,
                'period_end' => $periodEnd,
                'withdrawal_amount' => $withdrawalAmount,
                'withdrawal_method' => $this->normalizePaymentMethod($withdrawal),
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
                ],
            ]
        );
    }

    private function buildWithdrawalHistory(?string $outletId, Carbon $start, Carbon $end): array
    {
        $withdrawals = PettyCash::query()
            ->where('outlet_id', $outletId)
            ->where('category', 'Penarikan')
            ->whereBetween('created_at', [$start, $end])
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

            $periodEnd = $withdrawal->created_at instanceof Carbon
                ? $withdrawal->created_at
                : Carbon::parse($withdrawal->created_at);
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
            'date' => $withdrawal->created_at?->toIso8601String(),
            'description' => $withdrawal->description,
            'method' => $snapshot->withdrawal_method,
            'amount' => (float) $snapshot->withdrawal_amount,
            'period_start' => $snapshot->period_start?->toIso8601String(),
            'period_end' => $snapshot->period_end?->toIso8601String(),
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
            'date' => $withdrawal->created_at?->toIso8601String(),
            'description' => $withdrawal->description,
            'method' => $this->normalizePaymentMethod($withdrawal),
            'amount' => $withdrawalAmount,
            'period_start' => $periodStart->toIso8601String(),
            'period_end' => $periodEnd->toIso8601String(),
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
                $hpp += (float) ($item->product?->hpp ?? 0) * (int) $item->qty_porsi;
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
        $netProfit = $grossProfit - $expenseTotal;
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

    private function enrichSummaryWithCashPosition(array $summary, Carbon $periodStart, Carbon $periodEnd, array $carry = []): array
    {
        $standardOpeningCash = (float) $summary['standardOpeningCash'];
        $carryCashNet = (float) ($carry['cash_net'] ?? 0);
        $carryQrisBalance = (float) ($carry['qris_balance'] ?? 0);
        $carryCashierTopups = (float) ($carry['cashier_topups'] ?? 0);
        $carryOutsideCashierTopups = (float) ($carry['outside_cashier_topups'] ?? 0);
        $cashierTopups = (float) $summary['cashierTopups'];
        $activeCashierTopups = $carryCashierTopups + $cashierTopups;
        $activeOutsideCashierTopups = $carryOutsideCashierTopups + (float) $summary['outsideCashierTopups'];
        $activeDrawerCashierTopups = $activeCashierTopups - $activeOutsideCashierTopups;
        $cashDrawerActual = $standardOpeningCash
            + $carryCashNet
            + (float) $summary['cashSales']
            + $activeOutsideCashierTopups
            + (float) $summary['cashAdditions']
            - (float) $summary['cashExpense']
            - (float) $summary['withdrawCash'];
        $cashDrawerNet = $cashDrawerActual - $standardOpeningCash - $activeCashierTopups;
        $qrisBalanceActual = $carryQrisBalance
            + (float) $summary['qrisSales']
            - (float) $summary['qrisExpense']
            - (float) $summary['withdrawQris'];
        $cleanFinance = $cashDrawerNet + $qrisBalanceActual;
        $periodDays = max(1, $periodStart->copy()->startOfDay()->diffInDays($periodEnd->copy()->startOfDay()) + 1);

        return array_merge($summary, [
            'periodStart' => $periodStart->toIso8601String(),
            'periodEnd' => $periodEnd->toIso8601String(),
            'periodDays' => $periodDays,
            'cashDrawerActual' => $cashDrawerActual,
            'cashDrawerNet' => $cashDrawerNet,
            'qrisBalanceActual' => $qrisBalanceActual,
            'cleanFinance' => $cleanFinance,
            'carryCashDrawerNet' => $carryCashNet,
            'carryQrisBalance' => $carryQrisBalance,
            'carryCashierTopups' => $carryCashierTopups,
            'activeCashierTopups' => $activeCashierTopups,
            'activeDrawerCashierTopups' => $activeDrawerCashierTopups,
            'activeOutsideCashierTopups' => $activeOutsideCashierTopups,
            'dailySalesAverage' => (float) $summary['omzet'] / $periodDays,
            'dailyExpenseAverage' => (float) $summary['expenseTotal'] / $periodDays,
        ]);
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
                'cashier_topups' => 0,
                'drawer_cashier_topups' => 0,
                'outside_cashier_topups' => 0,
                'profit' => 0,
            ];
            $cursor->addDay();
        }

        foreach ($paidTransactions as $transaction) {
            $key = Carbon::parse($transaction->paid_at)->toDateString();
            if (isset($days[$key])) {
                $days[$key]['omzet'] += (float) $transaction->total_amount;
                foreach ($transaction->items as $item) {
                    $days[$key]['profit'] -= (float) ($item->product?->hpp ?? 0) * (int) $item->qty_porsi;
                }
            }
        }

        foreach ($cashMovements as $movement) {
            if ($movement->category === 'Penarikan') {
                continue;
            }

            $key = Carbon::parse($movement->created_at)->toDateString();
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
                $days[$key]['expenses'] += (float) $movement->amount;
            }
        }

        foreach ($days as &$day) {
            $day['profit'] += $day['omzet'] - $day['expenses'] - $day['drawer_cashier_topups'];
        }

        return array_values($days);
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
