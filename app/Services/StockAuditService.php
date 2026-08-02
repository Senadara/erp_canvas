<?php

namespace App\Services;

use App\Models\Product;
use App\Models\RestockLog;
use App\Models\StockAuditCount;
use App\Models\StockItem;
use App\Models\Transaction;
use App\Models\TransactionStockMovement;
use App\Models\WasteLog;
use Carbon\Carbon;

class StockAuditService
{
    public function getReport(string $outletId, Carbon $startDate, Carbon $endDate, ?string $selectedStockId = null): array
    {
        $start = $startDate->copy()->startOfDay();
        $end = $endDate->copy()->endOfDay();
        if ($end->lt($start)) {
            $end = $start->copy()->endOfDay();
        }

        $stockItems = StockItem::with([
            'displayGroup:id,name',
            'warehouseStockItem:id,name,unit_name,current_stock',
        ])
            ->where('outlet_id', $outletId)
            ->where('trackable', true)
            ->orderBy('name')
            ->get();

        $stockIds = $stockItems->pluck('id')->values()->all();
        $selectedStockId = in_array($selectedStockId, $stockIds, true) ? $selectedStockId : ($stockIds[0] ?? null);

        $expectedUsage = $this->expectedProductUsage($outletId, $stockIds, $start, $end);
        $periodEvents = $this->stockEventTotals($outletId, $stockIds, $start, $end);
        $afterEvents = $this->stockEventTotals($outletId, $stockIds, $end->copy()->addSecond(), Carbon::now()->endOfDay());
        $latestCounts = $this->latestPhysicalCounts($outletId, $stockIds, $end);

        $rows = $stockItems->map(function (StockItem $stock) use ($expectedUsage, $periodEvents, $afterEvents, $latestCounts) {
            $stockId = $stock->id;
            $currentStock = (float) $stock->current_stock_biji;
            $stockAtEnd = $currentStock
                - $afterEvents['restock'][$stockId]
                - $afterEvents['cancel_restore'][$stockId]
                + $afterEvents['sale_deduction'][$stockId]
                + $afterEvents['waste'][$stockId];
            $stockAtStart = $stockAtEnd
                - $periodEvents['restock'][$stockId]
                - $periodEvents['cancel_restore'][$stockId]
                + $periodEvents['sale_deduction'][$stockId]
                + $periodEvents['waste'][$stockId];
            $estimatedSalesUsage = $expectedUsage['usage'][$stockId];
            $loggedSalesDeduction = $periodEvents['sale_deduction'][$stockId];
            $wasteQty = $periodEvents['waste'][$stockId];
            $restockQty = $periodEvents['restock'][$stockId];
            $cancelRestoreQty = $periodEvents['cancel_restore'][$stockId];
            $expectedEnding = $stockAtStart + $restockQty + $cancelRestoreQty - $estimatedSalesUsage - $wasteQty;
            $salesMovementGap = $loggedSalesDeduction - $estimatedSalesUsage;
            $endingStockGap = $stockAtEnd - $expectedEnding;
            $latestCount = $latestCounts[$stockId] ?? null;
            $countDifference = $latestCount ? (float) $latestCount->difference : null;

            $status = $this->auditStatus($endingStockGap, $salesMovementGap, $countDifference);

            return [
                'stock_item_id' => $stockId,
                'name' => $stock->name,
                'unit_name' => $stock->unit_name,
                'display_group' => $stock->displayGroup?->name,
                'warehouse_stock' => $stock->warehouseStockItem ? [
                    'id' => $stock->warehouseStockItem->id,
                    'name' => $stock->warehouseStockItem->name,
                    'current_stock' => (float) $stock->warehouseStockItem->current_stock,
                    'unit_name' => $stock->warehouseStockItem->unit_name,
                ] : null,
                'stock_start' => round($stockAtStart, 4),
                'restock_qty' => round($restockQty, 4),
                'estimated_sales_usage' => round($estimatedSalesUsage, 4),
                'logged_sales_deduction' => round($loggedSalesDeduction, 4),
                'sales_movement_gap' => round($salesMovementGap, 4),
                'waste_qty' => round($wasteQty, 4),
                'cancel_restore_qty' => round($cancelRestoreQty, 4),
                'expected_ending_stock' => round($expectedEnding, 4),
                'system_ending_stock' => round($stockAtEnd, 4),
                'current_stock' => round($currentStock, 4),
                'ending_stock_gap' => round($endingStockGap, 4),
                'product_qty_sold' => round($expectedUsage['product_qty'][$stockId], 4),
                'transaction_count' => count($expectedUsage['transaction_ids'][$stockId] ?? []),
                'latest_count' => $latestCount ? $this->formatCount($latestCount) : null,
                'status' => $status,
                'status_label' => $this->statusLabel($status),
            ];
        })->values();

        $selectedRow = $selectedStockId
            ? $rows->firstWhere('stock_item_id', $selectedStockId)
            : null;

        return [
            'start_date' => $start->toDateString(),
            'end_date' => $end->toDateString(),
            'stock_options' => $stockItems->map(fn (StockItem $stock) => [
                'id' => $stock->id,
                'name' => $stock->name,
                'unit_name' => $stock->unit_name,
                'current_stock' => (float) $stock->current_stock_biji,
            ])->values()->all(),
            'summary' => [
                'stock_count' => $rows->count(),
                'ok_count' => $rows->where('status', 'OK')->count(),
                'warning_count' => $rows->where('status', 'WARNING')->count(),
                'critical_count' => $rows->where('status', 'CRITICAL')->count(),
                'estimated_sales_usage' => round((float) $rows->sum('estimated_sales_usage'), 4),
                'logged_sales_deduction' => round((float) $rows->sum('logged_sales_deduction'), 4),
                'restock_qty' => round((float) $rows->sum('restock_qty'), 4),
                'waste_qty' => round((float) $rows->sum('waste_qty'), 4),
                'absolute_gap' => round((float) $rows->sum(fn (array $row) => abs((float) $row['ending_stock_gap'])), 4),
            ],
            'rows' => $rows->all(),
            'selected_stock_id' => $selectedStockId,
            'selected_stock' => $selectedRow ? $this->selectedStockDetail(
                $outletId,
                $selectedRow,
                $expectedUsage,
                $periodEvents,
                $start,
                $end
            ) : null,
        ];
    }

    public function recordPhysicalCount(string $outletId, string $stockItemId, float $countedStock, Carbon $countedAt, ?string $note = null, ?string $countedBy = null): StockAuditCount
    {
        $stock = StockItem::where('outlet_id', $outletId)
            ->where('id', $stockItemId)
            ->firstOrFail();
        $systemStock = (float) $stock->current_stock_biji;

        return StockAuditCount::create([
            'outlet_id' => $outletId,
            'stock_item_id' => $stockItemId,
            'counted_stock' => $countedStock,
            'system_stock' => $systemStock,
            'difference' => $countedStock - $systemStock,
            'counted_at' => $countedAt,
            'counted_by' => $countedBy,
            'note' => $note,
        ]);
    }

    private function expectedProductUsage(string $outletId, array $stockIds, Carbon $start, Carbon $end): array
    {
        $usage = $this->zeroMap($stockIds);
        $productQty = $this->zeroMap($stockIds);
        $daily = [];
        $productBreakdown = [];
        $transactionDetails = [];
        $transactionIds = [];

        if (empty($stockIds)) {
            return [
                'usage' => $usage,
                'product_qty' => $productQty,
                'daily' => $daily,
                'product_breakdown' => $productBreakdown,
                'transaction_details' => $transactionDetails,
                'transaction_ids' => $transactionIds,
            ];
        }

        $products = Product::where('outlet_id', $outletId)
            ->with(['conversions' => fn ($query) => $query->whereIn('stock_item_id', $stockIds)])
            ->get(['id', 'name', 'is_active'])
            ->keyBy('id');

        $transactions = Transaction::where('outlet_id', $outletId)
            ->whereBetween('created_at', [$start, $end])
            ->where(function ($query) use ($end) {
                $query->where(function ($activeQuery) {
                    $activeQuery->where('payment_status', '!=', 'CANCELED')
                        ->orWhereNull('payment_status');
                })
                    ->orWhere(function ($canceledAfterQuery) use ($end) {
                        $canceledAfterQuery->where('payment_status', 'CANCELED')
                            ->where('canceled_at', '>', $end);
                    });
            })
            ->with('items')
            ->orderBy('created_at')
            ->get();

        foreach ($transactions as $transaction) {
            $date = Carbon::parse($transaction->created_at)->toDateString();

            foreach ($transaction->items as $item) {
                $product = $products->get($item->product_id);
                if (! $product || $product->conversions->isEmpty()) {
                    continue;
                }

                $qtyPorsi = (float) $item->qty_porsi;
                foreach ($product->conversions as $conversion) {
                    $stockId = $conversion->stock_item_id;
                    $usageQty = $qtyPorsi * (float) $conversion->ratio;
                    if ($usageQty <= 0 || ! in_array($stockId, $stockIds, true)) {
                        continue;
                    }

                    $usage[$stockId] += $usageQty;
                    $productQty[$stockId] += $qtyPorsi;
                    $transactionIds[$stockId][$transaction->id] = true;
                    $daily[$stockId][$date]['estimated_sales_usage'] = ($daily[$stockId][$date]['estimated_sales_usage'] ?? 0) + $usageQty;
                    $daily[$stockId][$date]['product_qty_sold'] = ($daily[$stockId][$date]['product_qty_sold'] ?? 0) + $qtyPorsi;

                    if (! isset($productBreakdown[$stockId][$product->id])) {
                        $productBreakdown[$stockId][$product->id] = [
                            'product_id' => $product->id,
                            'product_name' => $product->name ?: $item->product_name,
                            'is_active' => (bool) $product->is_active,
                            'qty_porsi' => 0.0,
                            'estimated_usage' => 0.0,
                            'transaction_ids' => [],
                        ];
                    }

                    $productBreakdown[$stockId][$product->id]['qty_porsi'] += $qtyPorsi;
                    $productBreakdown[$stockId][$product->id]['estimated_usage'] += $usageQty;
                    $productBreakdown[$stockId][$product->id]['transaction_ids'][$transaction->id] = true;

                    $transactionDetails[$stockId][] = [
                        'transaction_id' => $transaction->id,
                        'invoice_number' => $transaction->invoice_number,
                        'date' => Carbon::parse($transaction->created_at)->toIso8601String(),
                        'payment_status' => $transaction->payment_status,
                        'payment_method' => $transaction->payment_method,
                        'product_id' => $product->id,
                        'product_name' => $product->name ?: $item->product_name,
                        'qty_porsi' => $qtyPorsi,
                        'conversion_ratio' => (float) $conversion->ratio,
                        'estimated_usage' => $usageQty,
                    ];
                }
            }
        }

        foreach ($productBreakdown as $stockId => $rows) {
            $productBreakdown[$stockId] = collect($rows)
                ->map(function (array $row) {
                    $row['transaction_count'] = count($row['transaction_ids']);
                    unset($row['transaction_ids']);

                    return $this->roundRow($row, ['qty_porsi', 'estimated_usage']);
                })
                ->sortByDesc('estimated_usage')
                ->values()
                ->all();
        }

        return [
            'usage' => $usage,
            'product_qty' => $productQty,
            'daily' => $daily,
            'product_breakdown' => $productBreakdown,
            'transaction_details' => $transactionDetails,
            'transaction_ids' => $transactionIds,
        ];
    }

    private function stockEventTotals(string $outletId, array $stockIds, Carbon $start, Carbon $end): array
    {
        $totals = [
            'restock' => $this->zeroMap($stockIds),
            'sale_deduction' => $this->zeroMap($stockIds),
            'cancel_restore' => $this->zeroMap($stockIds),
            'waste' => $this->zeroMap($stockIds),
            'daily' => [],
        ];

        if (empty($stockIds) || $end->lt($start)) {
            return $totals;
        }

        RestockLog::where('outlet_id', $outletId)
            ->whereIn('stock_item_id', $stockIds)
            ->whereBetween('created_at', [$start, $end])
            ->get(['stock_item_id', 'qty_added', 'created_at'])
            ->each(function (RestockLog $log) use (&$totals) {
                $stockId = $log->stock_item_id;
                $date = Carbon::parse($log->created_at)->toDateString();
                $qty = (float) $log->qty_added;
                $totals['restock'][$stockId] += $qty;
                $totals['daily'][$stockId][$date]['restock_qty'] = ($totals['daily'][$stockId][$date]['restock_qty'] ?? 0) + $qty;
            });

        TransactionStockMovement::where('outlet_id', $outletId)
            ->whereIn('stock_item_id', $stockIds)
            ->whereIn('type', ['SALE_DEDUCTION', 'CANCEL_RESTORE'])
            ->whereBetween('created_at', [$start, $end])
            ->get(['stock_item_id', 'qty', 'type', 'created_at'])
            ->each(function (TransactionStockMovement $movement) use (&$totals) {
                $stockId = $movement->stock_item_id;
                $date = Carbon::parse($movement->created_at)->toDateString();
                $qty = (float) $movement->qty;
                $bucket = $movement->type === 'CANCEL_RESTORE' ? 'cancel_restore' : 'sale_deduction';
                $dailyKey = $movement->type === 'CANCEL_RESTORE' ? 'cancel_restore_qty' : 'logged_sales_deduction';
                $totals[$bucket][$stockId] += $qty;
                $totals['daily'][$stockId][$date][$dailyKey] = ($totals['daily'][$stockId][$date][$dailyKey] ?? 0) + $qty;
            });

        WasteLog::where('outlet_id', $outletId)
            ->whereIn('stock_item_id', $stockIds)
            ->whereBetween('created_at', [$start, $end])
            ->get(['stock_item_id', 'qty_biji', 'created_at'])
            ->each(function (WasteLog $log) use (&$totals) {
                $stockId = $log->stock_item_id;
                $date = Carbon::parse($log->created_at)->toDateString();
                $qty = (float) $log->qty_biji;
                $totals['waste'][$stockId] += $qty;
                $totals['daily'][$stockId][$date]['waste_qty'] = ($totals['daily'][$stockId][$date]['waste_qty'] ?? 0) + $qty;
            });

        return $totals;
    }

    private function selectedStockDetail(
        string $outletId,
        array $selectedRow,
        array $expectedUsage,
        array $periodEvents,
        Carbon $start,
        Carbon $end
    ): array {
        $stockId = $selectedRow['stock_item_id'];
        $stock = StockItem::where('outlet_id', $outletId)->where('id', $stockId)->firstOrFail();

        return [
            ...$selectedRow,
            'timeline' => $this->timelineRows($selectedRow, $expectedUsage['daily'][$stockId] ?? [], $periodEvents['daily'][$stockId] ?? [], $start, $end),
            'product_breakdown' => $expectedUsage['product_breakdown'][$stockId] ?? [],
            'transaction_details' => collect($expectedUsage['transaction_details'][$stockId] ?? [])
                ->sortByDesc('date')
                ->values()
                ->take(150)
                ->all(),
            'restock_details' => $this->restockDetails($outletId, $stockId, $start, $end),
            'waste_details' => $this->wasteDetails($outletId, $stockId, $start, $end),
            'movement_details' => $this->movementDetails($outletId, $stockId, $start, $end),
            'count_history' => $this->countHistory($outletId, $stockId, $start, $end),
            'current_system_stock' => (float) $stock->current_stock_biji,
        ];
    }

    private function timelineRows(array $row, array $expectedDaily, array $eventDaily, Carbon $start, Carbon $end): array
    {
        $timeline = [];
        $running = (float) $row['stock_start'];
        $cursor = $start->copy()->startOfDay();

        while ($cursor->lte($end)) {
            $date = $cursor->toDateString();
            $expected = (float) ($expectedDaily[$date]['estimated_sales_usage'] ?? 0);
            $productQty = (float) ($expectedDaily[$date]['product_qty_sold'] ?? 0);
            $logged = (float) ($eventDaily[$date]['logged_sales_deduction'] ?? 0);
            $restock = (float) ($eventDaily[$date]['restock_qty'] ?? 0);
            $waste = (float) ($eventDaily[$date]['waste_qty'] ?? 0);
            $cancel = (float) ($eventDaily[$date]['cancel_restore_qty'] ?? 0);
            $opening = $running;
            $endingSystem = $opening + $restock + $cancel - $logged - $waste;
            $endingEstimated = $opening + $restock + $cancel - $expected - $waste;

            $timeline[] = [
                'date' => $date,
                'stock_start' => round($opening, 4),
                'product_qty_sold' => round($productQty, 4),
                'estimated_sales_usage' => round($expected, 4),
                'logged_sales_deduction' => round($logged, 4),
                'restock_qty' => round($restock, 4),
                'waste_qty' => round($waste, 4),
                'cancel_restore_qty' => round($cancel, 4),
                'system_ending_stock' => round($endingSystem, 4),
                'expected_ending_stock' => round($endingEstimated, 4),
                'ending_stock_gap' => round($endingSystem - $endingEstimated, 4),
            ];

            $running = $endingSystem;
            $cursor->addDay();
        }

        return $timeline;
    }

    private function restockDetails(string $outletId, string $stockId, Carbon $start, Carbon $end): array
    {
        return RestockLog::where('outlet_id', $outletId)
            ->where('stock_item_id', $stockId)
            ->whereBetween('created_at', [$start, $end])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (RestockLog $log) => [
                'id' => $log->id,
                'date' => $log->created_at?->toIso8601String(),
                'qty_added' => (float) $log->qty_added,
                'stock_before' => (float) $log->stock_before,
                'stock_after' => (float) $log->stock_after,
                'fund_source' => $log->fund_source,
                'note' => $log->note,
            ])
            ->values()
            ->all();
    }

    private function wasteDetails(string $outletId, string $stockId, Carbon $start, Carbon $end): array
    {
        return WasteLog::with('product:id,name')
            ->where('outlet_id', $outletId)
            ->where('stock_item_id', $stockId)
            ->whereBetween('created_at', [$start, $end])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (WasteLog $log) => [
                'id' => $log->id,
                'date' => $log->created_at?->toIso8601String(),
                'source_type' => $log->source_type,
                'product_name' => $log->product_name ?: $log->product?->name,
                'qty_biji' => (float) $log->qty_biji,
                'qty_porsi' => (float) $log->qty_porsi,
                'waste_type' => $log->waste_type,
                'reason' => $log->reason,
            ])
            ->values()
            ->all();
    }

    private function movementDetails(string $outletId, string $stockId, Carbon $start, Carbon $end): array
    {
        return TransactionStockMovement::with('transaction:id,invoice_number,payment_status,payment_method,created_at,canceled_at')
            ->where('outlet_id', $outletId)
            ->where('stock_item_id', $stockId)
            ->whereBetween('created_at', [$start, $end])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (TransactionStockMovement $movement) => [
                'id' => $movement->id,
                'date' => $movement->created_at?->toIso8601String(),
                'type' => $movement->type,
                'qty' => (float) $movement->qty,
                'invoice_number' => $movement->transaction?->invoice_number,
                'payment_status' => $movement->transaction?->payment_status,
            ])
            ->values()
            ->all();
    }

    private function countHistory(string $outletId, string $stockId, Carbon $start, Carbon $end): array
    {
        return StockAuditCount::with('counter:id,display_name')
            ->where('outlet_id', $outletId)
            ->where('stock_item_id', $stockId)
            ->whereBetween('counted_at', [$start, $end])
            ->orderByDesc('counted_at')
            ->get()
            ->map(fn (StockAuditCount $count) => $this->formatCount($count))
            ->values()
            ->all();
    }

    private function latestPhysicalCounts(string $outletId, array $stockIds, Carbon $end): array
    {
        if (empty($stockIds)) {
            return [];
        }

        return StockAuditCount::with('counter:id,display_name')
            ->where('outlet_id', $outletId)
            ->whereIn('stock_item_id', $stockIds)
            ->where('counted_at', '<=', $end)
            ->orderBy('counted_at')
            ->get()
            ->groupBy('stock_item_id')
            ->map(fn ($rows) => $rows->last())
            ->all();
    }

    private function auditStatus(float $endingStockGap, float $salesMovementGap, ?float $countDifference): string
    {
        $maxGap = max(abs($endingStockGap), abs($salesMovementGap), abs($countDifference ?? 0));

        if ($maxGap > 1.0001) {
            return 'CRITICAL';
        }

        if ($maxGap > 0.0001) {
            return 'WARNING';
        }

        return 'OK';
    }

    private function statusLabel(string $status): string
    {
        return match ($status) {
            'CRITICAL' => 'Perlu dicek',
            'WARNING' => 'Ada selisih kecil',
            default => 'Sesuai',
        };
    }

    private function formatCount(StockAuditCount $count): array
    {
        return [
            'id' => $count->id,
            'date' => $count->counted_at?->toIso8601String(),
            'counted_stock' => (float) $count->counted_stock,
            'system_stock' => (float) $count->system_stock,
            'difference' => (float) $count->difference,
            'note' => $count->note,
            'counted_by' => $count->counter?->display_name ?: 'Tidak diketahui',
        ];
    }

    private function zeroMap(array $ids): array
    {
        return array_fill_keys($ids, 0.0);
    }

    private function roundRow(array $row, array $keys): array
    {
        foreach ($keys as $key) {
            $row[$key] = round((float) ($row[$key] ?? 0), 4);
        }

        return $row;
    }
}
