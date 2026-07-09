<?php

namespace App\Services;

use App\Models\PettyCash;
use App\Models\Product;
use App\Models\StockItem;
use App\Models\Transaction;
use Carbon\Carbon;

class ReportService
{
    public function getMonthlyReport(string $outletId, int $month, int $year, ?array $mitraProductIds = null)
    {
        $start = Carbon::create($year, $month, 1)->startOfMonth();
        $end = Carbon::create($year, $month, 1)->endOfMonth();

        $query = Transaction::where('outlet_id', $outletId)
            ->where('payment_status', 'PAID')
            ->whereBetween('created_at', [$start, $end])
            ->with(['items.product']);

        if ($mitraProductIds !== null) {
            $query->whereHas('items', function ($q) use ($mitraProductIds) {
                $q->whereIn('product_id', $mitraProductIds);
            });
        }

        $transactions = $query->get();

        $omzet = 0;
        $hpp = 0;

        foreach ($transactions as $t) {
            $hasMitraProduct = false;
            foreach ($t->items as $it) {
                if ($mitraProductIds === null || in_array($it->product_id, $mitraProductIds)) {
                    $hasMitraProduct = true;
                    if ($it->product) {
                        $hpp += ($it->product->hpp * $it->qty_porsi);
                    }
                    $omzet += $it->subtotal; // Use subtotal instead of total_amount for specific items
                }
            }
        }

        $pengeluaran = 0;
        if ($mitraProductIds === null) {
            $pengeluaran = PettyCash::where('outlet_id', $outletId)
                ->whereBetween('created_at', [$start, $end])
                ->where('cash_flow', 'OUT')
                ->whereNotIn('category', ['Tambah Modal', 'Tambah Kas', 'Penarikan'])
                ->sum('amount');
        }

        $netProfit = $omzet - $hpp - $pengeluaran;

        return [
            'omzet' => $omzet,
            'hpp' => $hpp,
            'pengeluaran' => $pengeluaran,
            'netProfit' => $netProfit,
            'transactionCount' => $transactions->count(),
        ];
    }

    public function getDailySummary(string $outletId, Carbon $date, ?array $mitraProductIds = null)
    {
        $start = clone $date;
        $start->startOfDay();
        $end = clone $date;
        $end->endOfDay();

        $query = Transaction::where('outlet_id', $outletId)
            ->where('payment_status', 'PAID')
            ->whereBetween('created_at', [$start, $end])
            ->with('items');

        if ($mitraProductIds !== null) {
            $query->whereHas('items', function ($q) use ($mitraProductIds) {
                $q->whereIn('product_id', $mitraProductIds);
            });
        }

        $transactions = $query->get();

        $total = 0;
        $cash = 0;
        $qris = 0;

        foreach ($transactions as $t) {
            $tTotal = 0;
            foreach ($t->items as $it) {
                 if ($mitraProductIds === null || in_array($it->product_id, $mitraProductIds)) {
                     $tTotal += $it->subtotal;
                 }
            }

            $total += $tTotal;
            if ($t->payment_method === 'CASH') $cash += $tTotal;
            elseif ($t->payment_method === 'QRIS') $qris += $tTotal;
        }

        $expenses = 0;
        if ($mitraProductIds === null) {
            $expenses = PettyCash::where('outlet_id', $outletId)
                ->whereBetween('created_at', [$start, $end])
                ->where('cash_flow', 'OUT')
                ->whereNotIn('category', ['Tambah Modal', 'Tambah Kas', 'Penarikan'])
                ->sum('amount');
        }

        return [
            'transactionCount' => $transactions->count(),
            'totalSales' => $total,
            'cashSales' => $cash,
            'qrisSales' => $qris,
            'expenses' => $expenses,
        ];
    }

    public function getLast7DaysRevenue(string $outletId, ?array $mitraProductIds = null)
    {
        $end = Carbon::now()->endOfDay();
        $start = clone $end;
        $start->subDays(6)->startOfDay();

        $query = Transaction::where('outlet_id', $outletId)
            ->where('payment_status', 'PAID')
            ->whereBetween('created_at', [$start, $end])
            ->with('items');

        if ($mitraProductIds !== null) {
            $query->whereHas('items', function ($q) use ($mitraProductIds) {
                $q->whereIn('product_id', $mitraProductIds);
            });
        }

        $transactions = $query->get();

        $byDay = [];
        for ($i = 0; $i < 7; $i++) {
            $d = clone $start;
            $d->addDays($i);
            $key = $d->format('Y-m-d');
            $byDay[$key] = ['date' => $key, 'total' => 0, 'cash' => 0, 'qris' => 0];
        }

        foreach ($transactions as $t) {
            $key = $t->created_at->format('Y-m-d');
            if (isset($byDay[$key])) {
                $tTotal = 0;
                foreach ($t->items as $it) {
                    if ($mitraProductIds === null || in_array($it->product_id, $mitraProductIds)) {
                        $tTotal += $it->subtotal;
                    }
                }

                $byDay[$key]['total'] += $tTotal;
                if ($t->payment_method === 'CASH') {
                    $byDay[$key]['cash'] += $tTotal;
                } else {
                    $byDay[$key]['qris'] += $tTotal;
                }
            }
        }

        return array_values($byDay);
    }

    public function getLowStockCount(string $outletId, ?array $mitraStockIds = null)
    {
        $query = StockItem::where('outlet_id', $outletId)
            ->where('trackable', true);

        if ($mitraStockIds !== null) {
            $query->whereIn('id', $mitraStockIds);
        }

        $items = $query->get();
            
        $n = 0;
        foreach ($items as $it) {
            if ($it->current_stock_biji <= $it->min_stock_alert) {
                $n++;
            }
        }
        return $n;
    }

    public function getProductPerformance(
        string $outletId,
        Carbon $startDate,
        Carbon $endDate,
        ?array $mitraProductIds = null,
        ?string $selectedProductId = null
    ): array {
        $productQuery = Product::where('outlet_id', $outletId)
            ->orderBy('name');

        if ($mitraProductIds !== null) {
            $productQuery->whereIn('id', $mitraProductIds);
        }

        $products = $productQuery->get(['id', 'name', 'hpp', 'is_active']);
        $productsById = $products->keyBy('id');
        $allowedProductIds = $products->pluck('id')->all();
        $selectedProduct = $products->firstWhere('id', $selectedProductId);

        if ($selectedProductId && ! $selectedProduct) {
            $selectedProductId = null;
        }

        $transactions = Transaction::where('outlet_id', $outletId)
            ->where('payment_status', 'PAID')
            ->whereBetween('created_at', [
                $startDate->copy()->startOfDay(),
                $endDate->copy()->endOfDay(),
            ])
            ->whereHas('items', function ($query) use ($allowedProductIds) {
                $query->whereIn('product_id', $allowedProductIds);
            })
            ->with(['items' => function ($query) use ($allowedProductIds) {
                $query->whereIn('product_id', $allowedProductIds);
            }])
            ->orderBy('created_at')
            ->get();

        $performance = [];
        $dailySales = [];

        foreach ($transactions as $transaction) {
            foreach ($transaction->items as $item) {
                $product = $productsById->get($item->product_id);
                if (! $product) {
                    continue;
                }

                if (! isset($performance[$item->product_id])) {
                    $performance[$item->product_id] = [
                        'id' => $item->product_id,
                        'name' => $product->name ?: $item->product_name,
                        'is_active' => (bool) $product->is_active,
                        'quantity_sold' => 0,
                        'revenue' => 0.0,
                        'estimated_hpp' => 0.0,
                        'gross_profit' => 0.0,
                        'transaction_ids' => [],
                    ];
                }

                $quantity = (int) $item->qty_porsi;
                $revenue = (float) $item->subtotal;
                $estimatedHpp = (float) $product->hpp * $quantity;
                $grossProfit = $revenue - $estimatedHpp;

                $performance[$item->product_id]['quantity_sold'] += $quantity;
                $performance[$item->product_id]['revenue'] += $revenue;
                $performance[$item->product_id]['estimated_hpp'] += $estimatedHpp;
                $performance[$item->product_id]['gross_profit'] += $grossProfit;
                $performance[$item->product_id]['transaction_ids'][$transaction->id] = true;

                if ($selectedProductId === $item->product_id) {
                    $date = $transaction->created_at->format('Y-m-d');

                    if (! isset($dailySales[$date])) {
                        $dailySales[$date] = [
                            'date' => $date,
                            'quantity_sold' => 0,
                            'revenue' => 0.0,
                            'estimated_hpp' => 0.0,
                            'gross_profit' => 0.0,
                            'transaction_ids' => [],
                        ];
                    }

                    $dailySales[$date]['quantity_sold'] += $quantity;
                    $dailySales[$date]['revenue'] += $revenue;
                    $dailySales[$date]['estimated_hpp'] += $estimatedHpp;
                    $dailySales[$date]['gross_profit'] += $grossProfit;
                    $dailySales[$date]['transaction_ids'][$transaction->id] = true;
                }
            }
        }

        $performance = collect($performance)
            ->map(function (array $row) {
                $row['transaction_count'] = count($row['transaction_ids']);
                $row['margin_percent'] = $row['revenue'] > 0
                    ? round(($row['gross_profit'] / $row['revenue']) * 100, 1)
                    : 0.0;
                unset($row['transaction_ids']);

                return $row;
            })
            ->values();

        $rankedProducts = $performance
            ->sort(function (array $a, array $b) {
                return [$b['quantity_sold'], $b['revenue']] <=> [$a['quantity_sold'], $a['revenue']];
            })
            ->values();

        $mostProfitable = $performance
            ->sort(function (array $a, array $b) {
                return [$b['gross_profit'], $b['revenue']] <=> [$a['gross_profit'], $a['revenue']];
            })
            ->first();

        $selectedSummary = $selectedProductId
            ? $performance->firstWhere('id', $selectedProductId)
            : null;

        $dailySales = collect($dailySales)
            ->map(function (array $row) {
                $row['transaction_count'] = count($row['transaction_ids']);
                unset($row['transaction_ids']);

                return $row;
            })
            ->sortByDesc('date')
            ->values()
            ->all();

        return [
            'start_date' => $startDate->format('Y-m-d'),
            'end_date' => $endDate->format('Y-m-d'),
            'products' => $products->map(fn (Product $product) => [
                'id' => $product->id,
                'name' => $product->name,
                'is_active' => (bool) $product->is_active,
            ])->values()->all(),
            'ranking' => $rankedProducts->all(),
            'best_seller' => $rankedProducts->first(),
            'most_profitable' => $mostProfitable,
            'selected_product_id' => $selectedProductId,
            'selected_product' => $selectedProduct ? [
                'id' => $selectedProduct->id,
                'name' => $selectedProduct->name,
                'is_active' => (bool) $selectedProduct->is_active,
                'summary' => $selectedSummary ?: [
                    'quantity_sold' => 0,
                    'revenue' => 0.0,
                    'estimated_hpp' => 0.0,
                    'gross_profit' => 0.0,
                    'transaction_count' => 0,
                    'margin_percent' => 0.0,
                ],
                'daily_sales' => $dailySales,
            ] : null,
        ];
    }
}
