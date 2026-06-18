<?php

namespace App\Http\Middleware;

use App\Models\Outlet;
use App\Support\NavPermission;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        $user = $request->user();
        $outletId = $request->session()->get('outlet_id');
        $outlet = $outletId ? Outlet::find($outletId) : null;

        $outlets = [];
        if ($user) {
            $outlets = $user->isOwner()
                ? Outlet::orderBy('name')->get(['id', 'name'])
                : $user->outlets()->orderBy('name')->get(['outlets.id', 'outlets.name']);
        }

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'email' => $user->email,
                    'displayName' => $user->display_name,
                    'role' => $user->role,
                    'mitra_can_view_sales' => $user->mitra_can_view_sales ?? false,
                ] : null,
            ],
            'nav' => $user ? NavPermission::allowedNavFor($user) : [],
            'outlet' => [
                'currentId' => $outletId,
                'currentName' => $outlet?->name,
                'list' => $outlets,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'new_transaction' => fn () => $request->session()->get('new_transaction'),
            ],
            'pwa' => [
                'offline' => false,
            ],
        ];
    }
}
