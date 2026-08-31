<?php

namespace App\Http\Controllers;

use App\Models\PettyCash;
use App\Models\ShiftRecord;
use App\Models\Transaction;
use App\Services\PettyCashService;
use App\Services\ShiftService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ShiftController extends Controller
{
    public function __construct(private ShiftService $shiftService) {}

    public function index(Request $request)
    {
        $outletId = $request->session()->get('outlet_id');
        $shifts = $this->shiftService->listShifts($outletId);
        $openShift = $this->shiftService->getOpenShift($outletId);
        $cashSummary = $this->shiftService->moneySummary($openShift);

        $expenses = [];
        if ($openShift) {
            $expenses = PettyCash::where('outlet_id', $outletId)
                ->where('created_at', '>=', $openShift->opened_at)
                ->whereNotIn('category', ['Penarikan', PettyCashService::OWNER_DISTRIBUTION_CATEGORY])
                ->orderByDesc('created_at')
                ->get();
        }

        return Inertia::render('Shifts/Index', [
            'shifts' => $shifts,
            'openShift' => $openShift,
            'expenses' => $expenses,
            'cashSummary' => $cashSummary,
            'standardOpeningCash' => ShiftService::STANDARD_OPENING_CASH,
        ]);
    }

    public function show(Request $request, string $id)
    {
        $shift = $this->shiftService->applyComputedMoneySummary(
            ShiftRecord::with(['opener:id,display_name', 'closer:id,display_name'])->findOrFail($id)
        );
        $outletId = $shift->outlet_id;

        $endTime = $shift->closed_at ?? Carbon::now();
        $openedAt = Carbon::parse($shift->opened_at);

        // Duration
        $durationMinutes = $openedAt->diffInMinutes($endTime);
        $durationHours = floor($durationMinutes / 60);
        $durationMins = $durationMinutes % 60;

        // Transactions during shift
        $txQuery = Transaction::where('shift_id', $shift->id);
        $transactions = $txQuery->with('items')->get();
        $salesTransactions = $transactions->where('payment_status', '!=', 'CANCELED');

        $totalTransactions = $transactions->count();

        $totalRevenue = $salesTransactions->sum('total_amount');
        $avgTransaction = $salesTransactions->count() > 0 ? $totalRevenue / $salesTransactions->count() : 0;

        // Category breakdown from items
        $categoryBreakdown = [];
        foreach ($salesTransactions as $tx) {
            foreach ($tx->items as $item) {
                $name = $item->product_name;
                if (!isset($categoryBreakdown[$name])) {
                    $categoryBreakdown[$name] = ['name' => $name, 'qty' => 0, 'revenue' => 0];
                }
                $categoryBreakdown[$name]['qty'] += $item->qty_porsi;
                $categoryBreakdown[$name]['revenue'] += $item->subtotal;
            }
        }
        // Sort by revenue descending
        usort($categoryBreakdown, fn($a, $b) => $b['revenue'] <=> $a['revenue']);

        // Expenses during shift
        $expQuery = PettyCash::where('outlet_id', $outletId)
            ->where('created_at', '>=', $shift->opened_at)
            ->whereNotIn('category', ['Penarikan', PettyCashService::OWNER_DISTRIBUTION_CATEGORY]);
        if ($shift->closed_at) {
            $expQuery->where('created_at', '<=', $shift->closed_at);
        }
        $shiftExpenses = $expQuery->get();
        $cashSummary = $this->shiftService->moneySummary($shift);
        $receivableSummary = $this->shiftService->receivableActivity($shift);

        $expenseByCategory = [];
        foreach ($shiftExpenses as $exp) {
            if (in_array($exp->category, ['Tambah Modal', 'Tambah Kas'], true)) {
                continue;
            }
            $cat = $exp->category;
            if (!isset($expenseByCategory[$cat])) {
                $expenseByCategory[$cat] = 0;
            }
            $expenseByCategory[$cat] += $exp->amount;
        }

        $totalOperatingExpenses = (float) $cashSummary['cash']['expenses']
            + (float) ($cashSummary['cash']['drawer_expenses'] ?? 0)
            + (float) $cashSummary['qris']['expenses']
            + (float) ($cashSummary['qris']['drawer_expenses'] ?? 0)
            + (float) ($cashSummary['outside']['expenses'] ?? 0);

        return response()->json([
            'shift' => $shift,
            'duration' => "{$durationHours}j {$durationMins}m",
            'duration_minutes' => $durationMinutes,
            'total_transactions' => $totalTransactions,
            'paid_count' => $salesTransactions->where('payment_status', 'PAID')->count(),
            'unpaid_count' => $receivableSummary['remaining_count'],
            'unpaid_total' => $receivableSummary['remaining_total'],
            'total_revenue' => $totalRevenue,
            'cash_received_total' => (float) $cashSummary['cash']['sales'] + (float) $cashSummary['qris']['sales'],
            'avg_transaction' => round($avgTransaction),
            'product_breakdown' => array_slice($categoryBreakdown, 0, 15),
            'expense_by_category' => $expenseByCategory,
            'total_expenses' => $totalOperatingExpenses,
            'cash_summary' => $cashSummary,
            'receivable_summary' => $receivableSummary,
        ]);
    }

    public function store(Request $request)
    {
        $outletId = $request->session()->get('outlet_id');
        if (!$outletId) {
            return redirect()->back()->withErrors(['error' => 'Pilih outlet terlebih dahulu sebelum membuka shift.']);
        }

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'opening_cash' => 'nullable|numeric|min:0',
        ]);

        try {
            $this->shiftService->openShift(
                $outletId,
                $data['opening_cash'] ?? ShiftService::STANDARD_OPENING_CASH,
                $data['name'] ?? null,
                $request->user()?->id
            );
            return redirect()->back()->with('success', 'Shift berhasil dibuka.');
        } catch (\Throwable $e) {
            return redirect()->back()->withErrors(['error' => $e->getMessage()]);
        }
    }

    public function update(Request $request, string $id)
    {
        $request->validate([
            'actual_cash' => 'required|numeric|min:0',
            'note' => 'nullable|string',
        ]);

        try {
            $this->shiftService->closeShift($id, $request->input('actual_cash'), $request->input('note'), $request->user()?->id);
            return redirect()->back()->with('success', 'Shift berhasil ditutup.');
        } catch (\Throwable $e) {
            return redirect()->back()->withErrors(['error' => $e->getMessage()]);
        }
    }

    public function ownerUpdate(Request $request, string $id)
    {
        abort_if(! $request->user()?->isOwner(), 403, 'Hanya owner yang dapat mengoreksi shift.');
        $outletId = $request->session()->get('outlet_id');

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'opened_at' => 'required|date',
            'closed_at' => 'nullable|date',
            'opening_cash' => 'required|numeric|min:0',
            'actual_cash' => 'nullable|numeric|min:0',
            'note' => 'nullable|string',
        ]);

        try {
            $this->shiftService->ownerUpdateShift($id, $outletId, $data, $request->user()->id);
            return redirect()->back()->with('success', 'Shift berhasil dikoreksi owner.');
        } catch (\Throwable $e) {
            return redirect()->back()->withErrors(['error' => $e->getMessage()]);
        }
    }

    public function destroy(Request $request, string $id)
    {
        abort_if(! $request->user()?->isOwner(), 403, 'Hanya owner yang dapat menghapus shift.');
        $outletId = $request->session()->get('outlet_id');

        try {
            $this->shiftService->ownerDeleteShift($id, $outletId);
            return redirect()->back()->with('success', 'Shift berhasil dihapus.');
        } catch (\Throwable $e) {
            return redirect()->back()->withErrors(['error' => $e->getMessage()]);
        }
    }
}
