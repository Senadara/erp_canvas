<?php

namespace App\Http\Controllers;

use App\Models\Outlet;
use App\Models\Investment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class OutletSessionController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'outlet_id' => 'required|string',
            'redirect_to' => 'nullable|string|max:255',
        ]);

        $user = $request->user();
        $outletId = (string) $data['outlet_id'];

        if (! $user->isOwner()) {
            $allowed = $user->outlets()->where('outlets.id', $outletId)->exists();
            if (! $allowed && $user->isPartner()) {
                $allowed = Investment::where('user_id', $user->id)
                    ->where('outlet_id', $outletId)
                    ->where('status', 'APPROVED')
                    ->exists();
            }
            if (! $allowed) {
                abort(403);
            }
        } elseif (! Outlet::where('id', $outletId)->exists()) {
            abort(404);
        }

        $request->session()->put('outlet_id', $outletId);

        $redirectTo = $data['redirect_to'] ?? null;
        if (is_string($redirectTo) && str_starts_with($redirectTo, '/') && ! str_starts_with($redirectTo, '//')) {
            return redirect($redirectTo);
        }

        return back();
    }
}
