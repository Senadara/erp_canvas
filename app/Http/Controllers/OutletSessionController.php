<?php

namespace App\Http\Controllers;

use App\Models\Outlet;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class OutletSessionController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $request->validate(['outlet_id' => 'required|string']);

        $user = $request->user();
        $outletId = $request->string('outlet_id');

        if (! $user->isOwner()) {
            $allowed = $user->outlets()->where('outlets.id', $outletId)->exists();
            if (! $allowed) {
                abort(403);
            }
        } elseif (! Outlet::where('id', $outletId)->exists()) {
            abort(404);
        }

        $request->session()->put('outlet_id', $outletId);

        return back();
    }
}
