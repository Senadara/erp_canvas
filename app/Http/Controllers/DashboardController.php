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

        $chartData = [];
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

            // Last 7 days revenue for chart
            for ($i = 6; $i >= 0; $i--) {
                $date = now()->subDays($i)->startOfDay();
                $end = now()->subDays($i)->endOfDay();
                
                $dailySum = Transaction::query()
                    ->where('outlet_id', $outletId)
                    ->where('payment_status', 'PAID')
                    ->whereBetween('created_at', [$date, $end])
                    ->sum('total_amount');
                
                $chartData[] = [
                    'name' => $date->format('D'), // short day name
                    'date' => $date->format('Y-m-d'),
                    'revenue' => (float) $dailySum
                ];
            }
        }

        return Inertia::render('Dashboard', [
            'stats' => $stats,
            'chartData' => $chartData,
        ]);
    }
}
