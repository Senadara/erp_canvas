<?php

namespace App\Http\Controllers;

use App\Models\Investment;
use App\Models\Outlet;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Carbon\Carbon;

class InvestmentController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        
        // Query based on role
        if ($user->role === 'OWNER') {
            $investments = Investment::with(['outlet:id,name', 'user:id,name'])->orderByDesc('created_at')->get();
            $outlets = Outlet::all();
        } else {
            $investments = Investment::with(['outlet:id,name'])->where('user_id', $user->id)->orderByDesc('created_at')->get();
            $outlets = $user->outlets;
        }

        return Inertia::render('Investments/Index', [
            'investments' => $investments,
            'outlets' => $outlets,
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'outlet_id' => 'required|string|exists:outlets,id',
            'lots' => 'required|integer|min:1',
            'lot_value' => 'required|numeric|min:0',
            'note' => 'nullable|string',
        ]);

        $data['user_id'] = $user->id;
        $data['total_value'] = $data['lots'] * $data['lot_value'];
        $data['status'] = $user->role === 'OWNER' ? 'APPROVED' : 'PENDING';
        if ($data['status'] === 'APPROVED') {
            $data['approved_at'] = Carbon::now();
        }

        Investment::create($data);

        return redirect()->back()->with('success', 'Investasi berhasil dicatat.');
    }

    public function approve(Request $request, string $id)
    {
        if ($request->user()->role !== 'OWNER') {
            abort(403);
        }

        $investment = Investment::findOrFail($id);
        $investment->update([
            'status' => 'APPROVED',
            'approved_at' => Carbon::now(),
        ]);

        return redirect()->back()->with('success', 'Investasi disetujui.');
    }

    public function reject(Request $request, string $id)
    {
        if ($request->user()->role !== 'OWNER') {
            abort(403);
        }

        $investment = Investment::findOrFail($id);
        $investment->update([
            'status' => 'REJECTED',
        ]);

        return redirect()->back()->with('success', 'Investasi ditolak.');
    }
}
