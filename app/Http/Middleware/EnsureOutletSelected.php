<?php

namespace App\Http\Middleware;

use Closure;
use App\Models\Investment;
use App\Models\Outlet;
use App\Models\User;
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
                $first = Outlet::orderBy('name')->first();
                if ($first) {
                    $request->session()->put('outlet_id', $first->id);
                }
            }

            return $next($request);
        }

        $outletId = $request->session()->get('outlet_id');
        if (! $outletId) {
            $first = $user->isPartner()
                ? $this->firstPartnerOutlet($user)
                : $user->outlets()->orderBy('name')->first();
            if ($first) {
                $request->session()->put('outlet_id', $first->id);
            }
        }

        return $next($request);
    }

    private function firstPartnerOutlet(User $user): ?Outlet
    {
        $outletIds = $user->outlets()->pluck('outlets.id')
            ->merge(Investment::where('user_id', $user->id)->where('status', 'APPROVED')->pluck('outlet_id'))
            ->filter()
            ->unique()
            ->values();

        if (! $outletIds || $outletIds->isEmpty()) {
            return null;
        }

        return Outlet::whereIn('id', $outletIds)->orderBy('name')->first();
    }
}
