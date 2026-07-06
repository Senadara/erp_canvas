<?php

namespace App\Http\Controllers;

use App\Models\Outlet;
use App\Models\PettyCash;
use App\Models\ShiftRecord;
use App\Models\Transaction;
use App\Services\PettyCashService;
use App\Services\ShiftService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class FinanceController extends Controller
{
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
            ? Carbon::parse($request->query('date_from'))->startOfDay()
            : Carbon::now()->startOfMonth();
        $end = $request->filled('date_to')
            ? Carbon::parse($request->query('date_to'))->endOfDay()
            : Carbon::now()->endOfDay();

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

        $shifts = ShiftRecord::query()
            ->where('outlet_id', $outletId)
            ->whereBetween('opened_at', [$start, $end])
            ->orderByDesc('opened_at')
            ->get();

        $summary = $this->buildSummary($paidTransactions, $unpaidTransactions, $canceledTransactions, $cashMovements, $shifts);
        $daily = $this->buildDailySeries($start, $end, $paidTransactions, $cashMovements, $shifts);
        $topProducts = $this->buildTopProducts($paidTransactions);
        $expenseByCategory = $this->buildExpenseByCategory($cashMovements);

        $openShift = $outletId
            ? ShiftRecord::where('outlet_id', $outletId)->where('status', 'OPEN')->orderByDesc('opened_at')->first()
            : null;

        return Inertia::render('Finance/Index', [
            'outlet' => $outlet,
            'filters' => [
                'date_from' => $start->toDateString(),
                'date_to' => $end->toDateString(),
            ],
            'summary' => $summary,
            'daily' => $daily,
            'topProducts' => $topProducts,
            'expenseByCategory' => $expenseByCategory,
            'cashMovements' => $cashMovements->take(80)->values(),
            'withdrawals' => $cashMovements->where('category', 'Penarikan')->take(50)->values(),
            'currentShiftBalance' => $this->shiftService->moneySummary($openShift),
        ]);
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

        $this->pettyCashService->createExpense([
            'outlet_id' => $outletId,
            'amount' => $data['amount'],
            'category' => 'Penarikan',
            'payment_method' => $data['payment_method'],
            'cash_flow' => 'OUT',
            'description' => $data['description'] ?? null,
            'date' => $data['date'] ?? null,
        ]);

        return redirect()->back()->with('success', 'Penarikan saldo berhasil dicatat.');
    }

    private function buildSummary($paidTransactions, $unpaidTransactions, $canceledTransactions, $cashMovements, $shifts): array
    {
        $omzet = 0;
        $cashSales = 0;
        $qrisSales = 0;
        $hpp = 0;

        foreach ($paidTransactions as $transaction) {
            $omzet += (float) $transaction->total_amount;
            if ($transaction->payment_method === 'QRIS') {
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
        $cashAdditions = 0;
        $withdrawCash = 0;
        $withdrawQris = 0;
        $cashierTopups = 0;
        $standardOpeningCash = ShiftService::STANDARD_OPENING_CASH;
        $shiftCount = $shifts->count();
        $standardCashierFund = $shiftCount * $standardOpeningCash;

        foreach ($cashMovements as $movement) {
            $amount = (float) $movement->amount;
            $method = $movement->payment_method === 'QRIS' ? 'QRIS' : 'CASH';

            if (in_array($movement->category, ['Tambah Modal', 'Tambah Kas'], true)) {
                $cashierTopups += $amount;
                continue;
            }

            if ($movement->cash_flow === 'IN') {
                $cashAdditions += $amount;
                continue;
            }

            if ($movement->category === 'Penarikan') {
                if ($method === 'QRIS') {
                    $withdrawQris += $amount;
                } else {
                    $withdrawCash += $amount;
                }
                continue;
            }

            $expenseTotal += $amount;
            if ($method === 'QRIS') {
                $qrisExpense += $amount;
            } else {
                $cashExpense += $amount;
            }
        }

        $grossProfit = $omzet - $hpp;
        $netProfit = $grossProfit - $expenseTotal;
        $cashierFundTotal = $standardCashierFund + $cashierTopups;
        $cashContainerBeforeWithdrawals = $cashSales + $cashAdditions - $cashExpense - $cashierFundTotal;
        $cashContainerAfterWithdrawals = $cashContainerBeforeWithdrawals - $withdrawCash;
        $qrisAvailableBeforeWithdrawals = $qrisSales - $qrisExpense;
        $qrisAvailableAfterWithdrawals = $qrisAvailableBeforeWithdrawals - $withdrawQris;

        return [
            'omzet' => $omzet,
            'cashSales' => $cashSales,
            'qrisSales' => $qrisSales,
            'hpp' => $hpp,
            'grossProfit' => $grossProfit,
            'expenseTotal' => $expenseTotal,
            'cashExpense' => $cashExpense,
            'qrisExpense' => $qrisExpense,
            'netProfit' => $netProfit,
            'cashAdditions' => $cashAdditions,
            'standardOpeningCash' => $standardOpeningCash,
            'shiftCount' => $shiftCount,
            'standardCashierFund' => $standardCashierFund,
            'cashierTopups' => $cashierTopups,
            'cashierFundTotal' => $cashierFundTotal,
            'cashContainerBeforeWithdrawals' => $cashContainerBeforeWithdrawals,
            'cashContainerAfterWithdrawals' => $cashContainerAfterWithdrawals,
            'qrisAvailableBeforeWithdrawals' => $qrisAvailableBeforeWithdrawals,
            'qrisAvailableAfterWithdrawals' => $qrisAvailableAfterWithdrawals,
            'availableBeforeWithdrawals' => $cashContainerBeforeWithdrawals + $qrisAvailableBeforeWithdrawals,
            'availableAfterWithdrawals' => $cashContainerAfterWithdrawals + $qrisAvailableAfterWithdrawals,
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

    private function buildDailySeries(Carbon $start, Carbon $end, $paidTransactions, $cashMovements, $shifts): array
    {
        $days = [];
        $cursor = $start->copy();
        while ($cursor->lte($end)) {
            $key = $cursor->toDateString();
            $days[$key] = ['date' => $key, 'omzet' => 0, 'expenses' => 0, 'cashier_fund' => 0, 'profit' => 0];
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
                $days[$key]['cashier_fund'] += (float) $movement->amount;
                continue;
            }

            if ($movement->cash_flow === 'OUT') {
                $days[$key]['expenses'] += (float) $movement->amount;
            }
        }

        foreach ($shifts as $shift) {
            $key = Carbon::parse($shift->opened_at)->toDateString();
            if (isset($days[$key])) {
                $days[$key]['cashier_fund'] += ShiftService::STANDARD_OPENING_CASH;
            }
        }

        foreach ($days as &$day) {
            $day['profit'] += $day['omzet'] - $day['expenses'] - $day['cashier_fund'];
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
}
