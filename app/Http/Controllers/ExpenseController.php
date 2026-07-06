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
        if ($request->user()?->isMitra()) {
            abort(403, 'Mitra tidak dapat mencatat mutasi kas.');
        }
        
        $data = $request->validate([
            'amount' => 'required|numeric|min:1',
            'category' => 'required|string',
            'payment_method' => 'nullable|in:CASH,QRIS,PRIVATE',
            'cash_flow' => 'nullable|in:IN,OUT',
            'description' => 'nullable|string',
            'date' => 'nullable|date',
        ]);
        if (($data['category'] ?? null) === 'Penarikan' && ! $request->user()?->isOwner()) {
            abort(403, 'Hanya owner yang dapat melakukan penarikan kas.');
        }

        $data['outlet_id'] = $outletId;

        $this->pettyCashService->createExpense($data);

        return redirect()->back()->with('success', 'Pengeluaran berhasil dicatat.');
    }

    public function update(Request $request, string $id)
    {
        abort_if(! $request->user()?->isOwner(), 403, 'Hanya owner yang dapat mengubah mutasi kas.');
        $outletId = $request->session()->get('outlet_id');
        
        $data = $request->validate([
            'amount' => 'required|numeric|min:1',
            'category' => 'required|string',
            'payment_method' => 'nullable|in:CASH,QRIS,PRIVATE',
            'cash_flow' => 'nullable|in:IN,OUT',
            'description' => 'nullable|string',
            'date' => 'nullable|date',
        ]);
        if (($data['category'] ?? null) === 'Penarikan' && ! $request->user()?->isOwner()) {
            abort(403, 'Hanya owner yang dapat melakukan penarikan kas.');
        }

        $this->pettyCashService->updateExpense($id, $outletId, $data, $request->user()->id);

        return redirect()->back()->with('success', 'Pengeluaran berhasil diubah.');
    }

    public function destroy(Request $request, string $id)
    {
        abort_if(! $request->user()?->isOwner(), 403, 'Hanya owner yang dapat menghapus mutasi kas.');
        $outletId = $request->session()->get('outlet_id');
        $this->pettyCashService->deleteExpense($id, $outletId);

        return redirect()->back()->with('success', 'Pengeluaran berhasil dihapus.');
    }
}
