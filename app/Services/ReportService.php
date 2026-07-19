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

    public function getESettlementReport(
        string $outletId,
        Carbon $startDate,
        Carbon $endDate,
        ?array $mitraProductIds = null
    ): array {
        $start = $startDate->copy()->startOfDay();
        $end = $endDate->copy()->endOfDay();

        $transactionQuery = Transaction::where('outlet_id', $outletId)
            ->where('payment_status', 'PAID')
            ->where(function ($query) use ($start, $end) {
                $query->whereBetween('paid_at', [$start, $end])
                    ->orWhere(function ($legacyQuery) use ($start, $end) {
                        $legacyQuery->whereNull('paid_at')
                            ->whereBetween('created_at', [$start, $end]);
                    });
            })
            ->with('items');

        if ($mitraProductIds !== null) {
            $transactionQuery->whereHas('items', function ($query) use ($mitraProductIds) {
                $query->whereIn('product_id', $mitraProductIds);
            });
        }

        $transactions = $transactionQuery
            ->orderBy('created_at')
            ->get();

        $movementQuery = PettyCash::where('outlet_id', $outletId)
            ->whereBetween('created_at', [$start, $end])
            ->orderBy('created_at');

        $movements = $mitraProductIds === null ? $movementQuery->get() : collect();

        $summary = [
            'sales_total' => 0.0,
            'cash_sales' => 0.0,
            'qris_sales' => 0.0,
            'transaction_count' => $transactions->count(),
            'movement_count' => $movements->count(),
            'cash_in' => 0.0,
            'qris_in' => 0.0,
            'outside_in' => 0.0,
            'cash_out' => 0.0,
            'qris_out' => 0.0,
            'outside_out' => 0.0,
            'operating_expenses' => 0.0,
            'restock_expenses' => 0.0,
            'cashier_topups' => 0.0,
            'drawer_cashier_topups' => 0.0,
            'outside_cashier_topups' => 0.0,
            'withdraw_cash' => 0.0,
            'withdraw_qris' => 0.0,
        ];

        $daily = [];
        $categorySummary = [];
        $ensureDay = function (Carbon $date) use (&$daily): string {
            $key = $date->toDateString();

            if (! isset($daily[$key])) {
                $daily[$key] = [
                    'date' => $key,
                    'sales_total' => 0.0,
                    'cash_sales' => 0.0,
                    'qris_sales' => 0.0,
                    'cash_in' => 0.0,
                    'qris_in' => 0.0,
                    'outside_in' => 0.0,
                    'cash_out' => 0.0,
                    'qris_out' => 0.0,
                    'outside_out' => 0.0,
                    'net_cash' => 0.0,
                    'net_qris' => 0.0,
                    'transaction_count' => 0,
                    'movement_count' => 0,
                ];
            }

            return $key;
        };
        $addCategorySummary = function (string $category, string $method, string $flow, float $amount) use (&$categorySummary): void {
            $key = "{$category}|{$method}";

            if (! isset($categorySummary[$key])) {
                $categorySummary[$key] = [
                    'category' => $category,
                    'payment_method' => $method,
                    'cash_in' => 0.0,
                    'qris_in' => 0.0,
                    'outside_in' => 0.0,
                    'cash_out' => 0.0,
                    'qris_out' => 0.0,
                    'outside_out' => 0.0,
                    'total_in' => 0.0,
                    'total_out' => 0.0,
                    'net' => 0.0,
                    'count' => 0,
                ];
            }

            $bucket = match ($method) {
                'QRIS' => 'qris',
                'PRIVATE' => 'outside',
                default => 'cash',
            };
            $direction = $flow === 'IN' ? 'in' : 'out';

            $categorySummary[$key]["{$bucket}_{$direction}"] += $amount;
            $categorySummary[$key]["total_{$direction}"] += $amount;
            $categorySummary[$key]['net'] += $flow === 'IN' ? $amount : -$amount;
            $categorySummary[$key]['count']++;
        };

        $transactionRows = [];
        foreach ($transactions as $transaction) {
            $amount = 0.0;
            foreach ($transaction->items as $item) {
                if ($mitraProductIds === null || in_array($item->product_id, $mitraProductIds, true)) {
                    $amount += (float) $item->subtotal;
                }
            }

            if ($amount <= 0) {
                continue;
            }

            $method = $this->normalizePaymentMethod($transaction->payment_method);
            $settledAt = $transaction->paid_at ?: $transaction->created_at;
            $paidAt = Carbon::parse($settledAt);
            $dayKey = $ensureDay($paidAt);

            $summary['sales_total'] += $amount;
            $daily[$dayKey]['sales_total'] += $amount;
            $daily[$dayKey]['transaction_count']++;

            if ($method === 'QRIS') {
                $summary['qris_sales'] += $amount;
                $daily[$dayKey]['qris_sales'] += $amount;
                $daily[$dayKey]['net_qris'] += $amount;
            } else {
                $summary['cash_sales'] += $amount;
                $daily[$dayKey]['cash_sales'] += $amount;
                $daily[$dayKey]['net_cash'] += $amount;
            }
            $addCategorySummary('Penjualan', $method, 'IN', $amount);

            $transactionRows[] = [
                'id' => $transaction->id,
                'invoice_number' => $transaction->invoice_number,
                'paid_at' => $settledAt?->toIso8601String(),
                'payment_method' => $method,
                'amount' => $amount,
            ];
        }

        $movementRows = [];
        foreach ($movements as $movement) {
            $amount = (float) $movement->amount;
            $method = $this->normalizePaymentMethod($movement->payment_method);
            $isCashierTopup = in_array($movement->category, ['Tambah Modal', 'Tambah Kas'], true);
            $isDrawerCashierTopup = $isCashierTopup && $method !== 'PRIVATE';
            $isWithdrawal = $movement->category === 'Penarikan';
            $flow = $movement->cash_flow === 'IN' ? 'IN' : 'OUT';
            $settlementFlow = $isDrawerCashierTopup ? 'OUT' : ($isCashierTopup ? 'IN' : $flow);
            $createdAt = Carbon::parse($movement->created_at);
            $dayKey = $ensureDay($createdAt);

            $daily[$dayKey]['movement_count']++;

            if ($isCashierTopup) {
                $summary['cashier_topups'] += $amount;
                if ($method === 'PRIVATE') {
                    $summary['outside_cashier_topups'] += $amount;
                } else {
                    $summary['drawer_cashier_topups'] += $amount;
                }
            }

            if ($isWithdrawal) {
                if ($method === 'QRIS') {
                    $summary['withdraw_qris'] += $amount;
                } else {
                    $summary['withdraw_cash'] += $amount;
                }
            }

            if ($settlementFlow === 'IN') {
                if ($method === 'QRIS') {
                    $summary['qris_in'] += $amount;
                    $daily[$dayKey]['qris_in'] += $amount;
                    $daily[$dayKey]['net_qris'] += $amount;
                } elseif ($method === 'PRIVATE') {
                    $summary['outside_in'] += $amount;
                    $daily[$dayKey]['outside_in'] += $amount;
                } else {
                    $summary['cash_in'] += $amount;
                    $daily[$dayKey]['cash_in'] += $amount;
                    $daily[$dayKey]['net_cash'] += $amount;
                }
            } else {
                if (! $isWithdrawal && ! $isCashierTopup) {
                    $summary['operating_expenses'] += $amount;
                    if ($movement->category === 'RESTOCK') {
                        $summary['restock_expenses'] += $amount;
                    }
                }

                if ($method === 'QRIS') {
                    $summary['qris_out'] += $amount;
                    $daily[$dayKey]['qris_out'] += $amount;
                    $daily[$dayKey]['net_qris'] -= $amount;
                } elseif ($method === 'PRIVATE') {
                    $summary['outside_out'] += $amount;
                    $daily[$dayKey]['outside_out'] += $amount;
                } else {
                    $summary['cash_out'] += $amount;
                    $daily[$dayKey]['cash_out'] += $amount;
                    $daily[$dayKey]['net_cash'] -= $amount;
                }
            }
            $addCategorySummary($movement->category, $method, $settlementFlow, $amount);

            $movementRows[] = [
                'id' => $movement->id,
                'created_at' => $movement->created_at?->toIso8601String(),
                'category' => $movement->category,
                'payment_method' => $method,
                'cash_flow' => $settlementFlow,
                'amount' => $amount,
                'description' => $movement->description,
            ];
        }

        $summary['cash_net'] = $summary['cash_sales'] + $summary['cash_in'] - $summary['cash_out'];
        $summary['qris_net'] = $summary['qris_sales'] + $summary['qris_in'] - $summary['qris_out'];
        $summary['outside_net'] = $summary['outside_in'] - $summary['outside_out'];
        $summary['settlement_net'] = $summary['cash_net'] + $summary['qris_net'];
        $summary['money_in_total'] = $summary['cash_sales'] + $summary['qris_sales'] + $summary['cash_in'] + $summary['qris_in'] + $summary['outside_in'];
        $summary['money_out_total'] = $summary['cash_out'] + $summary['qris_out'] + $summary['outside_out'];

        return [
            'start_date' => $start->format('Y-m-d'),
            'end_date' => $end->format('Y-m-d'),
            'summary' => $summary,
            'category_summary' => collect($categorySummary)
                ->sortBy([
                    ['category', 'asc'],
                    ['payment_method', 'asc'],
                ])
                ->values()
                ->all(),
            'daily' => collect($daily)->sortKeys()->values()->all(),
            'transactions' => collect($transactionRows)->sortByDesc('paid_at')->values()->all(),
            'movements' => collect($movementRows)->sortByDesc('created_at')->values()->all(),
        ];
    }

    private function normalizePaymentMethod(?string $paymentMethod): string
    {
        return strtoupper((string) $paymentMethod) === 'QRIS'
            ? 'QRIS'
            : (strtoupper((string) $paymentMethod) === 'PRIVATE' ? 'PRIVATE' : 'CASH');
    }
}
