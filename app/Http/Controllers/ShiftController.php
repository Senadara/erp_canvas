<?php

namespace App\Http\Controllers;

use App\Services\ShiftService;
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

        $expenses = [];
        if ($openShift) {
            $expenses = \App\Models\PettyCash::where('outlet_id', $outletId)
                ->where('created_at', '>=', $openShift->opened_at)
                ->orderByDesc('created_at')
                ->get();
        }

        return Inertia::render('Shifts/Index', [
            'shifts' => $shifts,
            'openShift' => $openShift,
            'expenses' => $expenses,
        ]);
    }

    public function store(Request $request)
    {
        $outletId = $request->session()->get('outlet_id');
        $data = $request->validate([
            'opening_cash' => 'required|numeric|min:0',
        ]);

        try {
            $this->shiftService->openShift($outletId, $data['opening_cash']);
            return redirect()->back()->with('success', 'Shift berhasil dibuka.');
        } catch (\Exception $e) {
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
            $this->shiftService->closeShift($id, $request->input('actual_cash'), $request->input('note'));
            return redirect()->back()->with('success', 'Shift berhasil ditutup.');
        } catch (\Exception $e) {
            return redirect()->back()->withErrors(['error' => $e->getMessage()]);
        }
    }
}
