<?php

namespace App\Http\Controllers;

use App\Models\Investment;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Carbon\Carbon;

class InvestmentController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        abort_if(! $user?->isOwner() && ! $user?->isPartner(), 403, 'Hanya owner dan partner yang dapat membuka modal partner.');
        
        // Query based on role
        if ($user->role === 'OWNER') {
            $investments = Investment::with(['outlet:id,name', 'user:id,display_name,role'])->orderByDesc('created_at')->get();
            $outlets = Outlet::all();
            $partners = User::whereIn('role', ['OWNER', 'PARTNER'])
                ->where('is_active', true)
                ->orderBy('display_name')
                ->get(['id', 'display_name', 'email', 'role']);
        } elseif ($user->isPartner()) {
            $investments = Investment::with(['outlet:id,name', 'user:id,display_name,role'])
                ->where('user_id', $user->id)
                ->orderByDesc('created_at')
                ->get();
            $outlets = Outlet::orderBy('name')->get(['id', 'name']);
            $partners = collect();
        } else {
            $investments = Investment::with(['outlet:id,name', 'user:id,display_name,role'])->where('user_id', $user->id)->orderByDesc('created_at')->get();
            $outlets = $user->outlets;
            $partners = collect();
        }

        return Inertia::render('Investments/Index', [
            'investments' => $investments,
            'outlets' => $outlets,
            'partners' => $partners,
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        abort_if(! $user?->isOwner() && ! $user?->isPartner(), 403, 'Hanya owner dan partner yang dapat mencatat modal partner.');

        $data = $request->validate([
            'outlet_id' => 'required|string|exists:outlets,id',
            'user_id' => 'nullable|string|exists:users,id',
            'lots' => 'required|integer|min:1',
            'lot_value' => 'required|numeric|min:0',
            'note' => 'nullable|string',
        ]);

        $targetUser = $user;
        if ($user->isOwner() && ! empty($data['user_id'])) {
            $targetUser = User::whereIn('role', ['OWNER', 'PARTNER'])->findOrFail($data['user_id']);
        } elseif (! $user->isOwner()) {
            $data['user_id'] = $user->id;
        }

        $data['user_id'] = $targetUser->id;
        $data['total_value'] = $data['lots'] * $data['lot_value'];
        $data['status'] = $user->role === 'OWNER' ? 'APPROVED' : 'PENDING';
        if ($data['status'] === 'APPROVED') {
            $data['approved_at'] = Carbon::now();
        }

        Investment::create($data);
        if ($data['status'] === 'APPROVED' && ! $targetUser->isOwner()) {
            $targetUser->outlets()->syncWithoutDetaching([$data['outlet_id']]);
        }

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
        $investment->load('user');
        if ($investment->user && ! $investment->user->isOwner()) {
            $investment->user->outlets()->syncWithoutDetaching([$investment->outlet_id]);
        }

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
