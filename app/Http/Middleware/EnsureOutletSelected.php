<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureOutletSelected
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user) {
            return redirect()->route('login');
        }

        if ($user->isOwner()) {
            if (! $request->session()->get('outlet_id')) {
                $first = \App\Models\Outlet::orderBy('name')->first();
                if ($first) {
                    $request->session()->put('outlet_id', $first->id);
                }
            }

            return $next($request);
        }

        $outletId = $request->session()->get('outlet_id');
        if (! $outletId) {
            $first = $user->outlets()->orderBy('name')->first();
            if ($first) {
                $request->session()->put('outlet_id', $first->id);
            }
        }

        return $next($request);
    }
}
