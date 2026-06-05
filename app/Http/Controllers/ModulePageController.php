<?php

namespace App\Http\Controllers;

use App\Support\NavPermission;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ModulePageController extends Controller
{
    public function show(Request $request, string $module): Response
    {
        $titles = [
            'cashier' => 'Kasir',
            'products' => 'Produk',
            'stock' => 'Stok',
            'expenses' => 'Keuangan Shift',
            'waste' => 'Waste',
            'reports' => 'Laporan',
            'receipts' => 'Struk',
            'outlets' => 'Outlet',
            'owner' => 'Owner',
            'users' => 'Pengguna',
        ];

        if (! isset($titles[$module]) || ! NavPermission::canSee($request->user(), $module)) {
            abort(403);
        }

        return Inertia::render('Module/Placeholder', [
            'title' => $titles[$module],
            'module' => $module,
        ]);
    }
}
