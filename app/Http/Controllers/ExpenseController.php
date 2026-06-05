<?php

namespace App\Http\Controllers;

use App\Services\PettyCashService;
use App\Services\ShiftService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ExpenseController extends Controller
{
    public function __construct(
        private PettyCashService $pettyCashService,
        private ShiftService $shiftService
    ) {}

    public function index(Request $request)
    {
        $outletId = $request->session()->get('outlet_id');
        $expenses = $this->pettyCashService->listExpenses($outletId);
        $openShift = $this->shiftService->getOpenShift($outletId);

        return Inertia::render('Expenses/Index', [
            'expenses' => $expenses,
            'openShift' => $openShift,
        ]);
    }

    public function store(Request $request)
    {
        $outletId = $request->session()->get('outlet_id');
        
        $data = $request->validate([
            'amount' => 'required|numeric|min:1',
            'category' => 'required|string',
            'description' => 'nullable|string',
            'date' => 'nullable|date',
        ]);

        $data['outlet_id'] = $outletId;

        $this->pettyCashService->createExpense($data);

        return redirect()->back()->with('success', 'Pengeluaran berhasil dicatat.');
    }

    public function update(Request $request, string $id)
    {
        $outletId = $request->session()->get('outlet_id');
        
        $data = $request->validate([
            'amount' => 'required|numeric|min:1',
            'category' => 'required|string',
            'description' => 'nullable|string',
            'date' => 'nullable|date',
        ]);

        $this->pettyCashService->updateExpense($id, $outletId, $data);

        return redirect()->back()->with('success', 'Pengeluaran berhasil diubah.');
    }

    public function destroy(Request $request, string $id)
    {
        $outletId = $request->session()->get('outlet_id');
        $this->pettyCashService->deleteExpense($id, $outletId);

        return redirect()->back()->with('success', 'Pengeluaran berhasil dihapus.');
    }
}
