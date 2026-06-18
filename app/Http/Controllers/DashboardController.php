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
        $user = $request->user();
        $today = now()->startOfDay();

        $mitraProductIds = null;
        if ($user && $user->isMitra()) {
            $mitraProductIds = $user->getMitraProductIds();
        }

        $stats = [
            'productCount' => 0,
            'todaySales' => '0',
            'openShift' => false,
        ];

        if ($outletId) {
            $productQuery = Product::where('outlet_id', $outletId)->where('is_active', true);
            if ($mitraProductIds !== null) {
                $productQuery->whereIn('id', $mitraProductIds);
            }
            $stats['productCount'] = $productQuery->count();

            $stats['openShift'] = ShiftRecord::query()
                ->where('outlet_id', $outletId)
                ->where('status', 'OPEN')
                ->exists();
        }

        $chartData = [];
        if ($outletId) {
            $todayQuery = Transaction::query()
                ->where('outlet_id', $outletId)
                ->where('payment_status', 'PAID')
                ->where('created_at', '>=', $today)
                ->with('items');

            if ($mitraProductIds !== null) {
                $todayQuery->whereHas('items', function ($q) use ($mitraProductIds) {
                    $q->whereIn('product_id', $mitraProductIds);
                });
            }

            $todayTransactions = $todayQuery->get();
            $todaySum = 0;
            foreach ($todayTransactions as $t) {
                foreach ($t->items as $it) {
                    if ($mitraProductIds === null || in_array($it->product_id, $mitraProductIds)) {
                        $todaySum += $it->subtotal;
                    }
                }
            }
            $stats['todaySales'] = (string) $todaySum;

            // Last 7 days revenue for chart
            for ($i = 6; $i >= 0; $i--) {
                $date = now()->subDays($i)->startOfDay();
                $end = now()->subDays($i)->endOfDay();
                
                $dailyQuery = Transaction::query()
                    ->where('outlet_id', $outletId)
                    ->where('payment_status', 'PAID')
                    ->whereBetween('created_at', [$date, $end])
                    ->with('items');

                if ($mitraProductIds !== null) {
                    $dailyQuery->whereHas('items', function ($q) use ($mitraProductIds) {
                        $q->whereIn('product_id', $mitraProductIds);
                    });
                }
                
                $dailyTransactions = $dailyQuery->get();
                $dailySum = 0;
                foreach ($dailyTransactions as $t) {
                    foreach ($t->items as $it) {
                        if ($mitraProductIds === null || in_array($it->product_id, $mitraProductIds)) {
                            $dailySum += $it->subtotal;
                        }
                    }
                }
                
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
