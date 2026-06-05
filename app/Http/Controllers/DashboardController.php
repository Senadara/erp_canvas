<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\ShiftRecord;
use App\Models\Transaction;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $outletId = $request->session()->get('outlet_id');
        $today = now()->startOfDay();

        $stats = [
            'productCount' => $outletId ? Product::where('outlet_id', $outletId)->where('is_active', true)->count() : 0,
            'todaySales' => '0',
            'openShift' => false,
        ];

        if ($outletId) {
            $sum = Transaction::query()
                ->where('outlet_id', $outletId)
                ->where('payment_status', 'PAID')
                ->where('created_at', '>=', $today)
                ->sum('total_amount');
            $stats['todaySales'] = (string) $sum;
            $stats['openShift'] = ShiftRecord::query()
                ->where('outlet_id', $outletId)
                ->where('status', 'OPEN')
                ->exists();
        }

        return Inertia::render('Dashboard', [
            'stats' => $stats,
        ]);
    }
}
