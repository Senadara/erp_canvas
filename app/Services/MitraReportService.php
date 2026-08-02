<?php

namespace App\Services;

use App\Models\Conversion;
use App\Models\MitraSettlement;
use App\Models\MitraStockDelivery;
use App\Models\Outlet;
use App\Models\RestockLog;
use App\Models\StockItem;
use App\Models\Transaction;
use App\Models\User;
use App\Models\WasteLog;
use App\Models\WarehouseStockItem;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class MitraReportService
{
    public function getMitraWarehouseRestockData(User $mitra, Carbon $startDate, Carbon $endDate): array
    {
        $periodStart = $startDate->copy()->startOfDay();
        $periodEnd = $endDate->copy()->endOfDay();
        $warehouseItems = WarehouseStockItem::with('warehouse:id,name')
            ->where('mitra_id', $mitra->id)
            ->orderBy('name')
            ->get();
        $warehouseItemIds = $warehouseItems->pluck('id')->all();

        if (empty($warehouseItemIds)) {
            return [];
        }

        $received = MitraStockDelivery::where('mitra_id', $mitra->id)
            ->whereIn('warehouse_stock_item_id', $warehouseItemIds)
            ->whereIn('status', [
                MitraStockDelivery::STATUS_RECEIVED_MATCH,
                MitraStockDelivery::STATUS_RECEIVED_DIFFERENCE,
            ])
            ->whereBetween('received_at', [$periodStart, $periodEnd])
            ->groupBy('warehouse_stock_item_id')
            ->select('warehouse_stock_item_id', DB::raw('SUM(qty_received) as total_received'))
            ->get()
            ->keyBy('warehouse_stock_item_id');
        $itemKeys = collect($warehouseItemIds)
            ->map(fn (string $id) => "warehouse:{$id}")
            ->all();
        $settled = $this->getSettlementQtyByItemKey(
            $mitra->id,
            $itemKeys,
            $periodStart,
            $periodEnd,
            [MitraSettlement::STATUS_PAID],
            null,
        );
        $pending = $this->getSettlementQtyByItemKey(
            $mitra->id,
            $itemKeys,
            $periodStart,
            $periodEnd,
            [MitraSettlement::STATUS_PENDING, MitraSettlement::STATUS_APPROVED],
            null,
        );
        $sameMethodCommitted = $this->getSettlementQtyByItemKey(
            $mitra->id,
            $itemKeys,
            $periodStart,
            $periodEnd,
            [MitraSettlement::STATUS_PENDING, MitraSettlement::STATUS_APPROVED, MitraSettlement::STATUS_PAID],
            'RESTOCK',
        );

        return $warehouseItems->map(function (WarehouseStockItem $item) use ($received, $settled, $pending, $sameMethodCommitted) {
            $itemKey = "warehouse:{$item->id}";
            $receivedQty = (float) ($received->get($item->id)?->total_received ?? 0);
            $settledQty = (float) ($settled[$itemKey] ?? 0);
            $pendingQty = (float) ($pending[$itemKey] ?? 0);
            $sameCommittedQty = (float) ($sameMethodCommitted[$itemKey] ?? 0);
            $committedQty = $settledQty + $pendingQty;
            $crossCommittedQty = max(0, $committedQty - $sameCommittedQty);
            $minQty = (float) $item->min_restock_qty > 0 ? (float) $item->min_restock_qty : 1;

            return [
                'item_key' => $itemKey,
                'settlement_item_key' => $itemKey,
                'stock_item_id' => null,
                'warehouse_stock_item_id' => $item->id,
                'warehouse_id' => $item->warehouse_id,
                'name' => $item->name,
                'unit_name' => $item->unit_name,
                'outlet_id' => null,
                'outlet_name' => $item->warehouse?->name ?? 'Gudang Pusat',
                'current_stock' => (float) $item->current_stock,
                'restock_price' => (float) $item->restock_price,
                'min_restock_qty' => $minQty,
                'restock_qty' => round($receivedQty, 2),
                'sold_qty' => 0,
                'waste_qty' => 0,
                'personal_use_qty' => 0,
                'expired_waste_qty' => 0,
                'damaged_waste_qty' => 0,
                'other_waste_qty' => 0,
                'product_waste_qty' => 0,
                'stock_waste_qty' => 0,
                'waste_breakdown' => [],
                'sales_qty' => 0,
                'gross_qty' => round($receivedQty, 2),
                'settled_qty' => round($settledQty, 2),
                'pending_settlement_qty' => round($pendingQty, 2),
                'same_method_committed_qty' => round($sameCommittedQty, 2),
                'cross_committed_qty' => round($crossCommittedQty, 2),
                'committed_qty' => round($committedQty, 2),
                'remaining_qty' => round(max(0, $receivedQty - $committedQty), 2),
                'restock_subtotal' => round(($receivedQty / $minQty) * (float) $item->restock_price),
                'sales_subtotal' => 0,
            ];
        })->values()->all();
    }

    public function getMitraReportDataAcrossOutlets(User $mitra, Carbon $startDate, Carbon $endDate): array
    {
        $outletIds = $mitra->mitraStockItems()
            ->pluck('stock_items.outlet_id')
            ->unique()
            ->values();
        $outlets = Outlet::whereIn('id', $outletIds)
            ->orderBy('name')
            ->get(['id', 'name']);

        $rows = $outlets
            ->flatMap(function (Outlet $outlet) use ($mitra, $startDate, $endDate) {
                return collect($this->getMitraReportData(
                    $outlet->id,
                    $mitra,
                    $startDate->copy(),
                    $endDate->copy(),
                ))->map(fn (array $item) => [
                    ...$item,
                    'outlet_id' => $outlet->id,
                    'outlet_name' => $outlet->name,
                ]);
            })
            ->sortBy([
                ['outlet_name', 'asc'],
                ['name', 'asc'],
            ])
            ->values()
            ->all();

        return $this->allocateCommittedQuantitiesAcrossRows($rows, 'sales_qty');
    }

    public function getMitraReportOverview(string $outletId, User $mitra, Carbon $startDate, Carbon $endDate): array
    {
        $reportData = $this->getMitraReportData($outletId, $mitra, $startDate, $endDate);
        $stockIds = collect($reportData)->pluck('stock_item_id')->all();
        $periodStart = $startDate->copy()->startOfDay();
        $periodEnd = $endDate->copy()->endOfDay();
        $productUsage = $this->getProductUsageOverview($outletId, $stockIds, $periodStart, $periodEnd);

        $deliveries = MitraStockDelivery::with([
            'warehouse:id,name',
            'warehouseStockItem:id,name,unit_name',
            'receiver:id,display_name',
        ])
            ->where('mitra_id', $mitra->id)
            ->whereBetween('sent_at', [$periodStart, $periodEnd])
            ->orderByDesc('sent_at')
            ->get()
            ->map(fn (MitraStockDelivery $delivery) => [
                'id' => $delivery->id,
                'stock_item_id' => $delivery->stock_item_id,
                'warehouse_stock_item_id' => $delivery->warehouse_stock_item_id,
                'stock_name' => $delivery->warehouseStockItem?->name,
                'unit_name' => $delivery->warehouseStockItem?->unit_name,
                'warehouse_name' => $delivery->warehouse?->name,
                'qty_sent' => (float) $delivery->qty_sent,
                'qty_received' => $delivery->qty_received !== null ? (float) $delivery->qty_received : null,
                'difference' => $delivery->qty_received !== null
                    ? round((float) $delivery->qty_received - (float) $delivery->qty_sent, 4)
                    : null,
                'status' => $delivery->status,
                'sender_note' => $delivery->sender_note,
                'receiver_note' => $delivery->receiver_note,
                'sent_at' => $delivery->sent_at?->toIso8601String(),
                'received_at' => $delivery->received_at?->toIso8601String(),
                'receiver_name' => $delivery->receiver?->display_name,
            ])
            ->values()
            ->all();

        $restockHistory = empty($stockIds)
            ? collect()
            : RestockLog::with('stockItem:id,name,unit_name')
                ->where('outlet_id', $outletId)
                ->whereIn('stock_item_id', $stockIds)
                ->whereBetween('created_at', [$periodStart, $periodEnd])
                ->orderByDesc('created_at')
                ->get()
                ->map(fn (RestockLog $log) => [
                    'id' => $log->id,
                    'stock_name' => $log->stockItem?->name,
                    'unit_name' => $log->stockItem?->unit_name,
                    'qty_added' => (float) $log->qty_added,
                    'stock_before' => (float) $log->stock_before,
                    'stock_after' => (float) $log->stock_after,
                    'source' => $log->fund_source,
                    'created_at' => $log->created_at?->toIso8601String(),
                ]);

        $settlements = MitraSettlement::where('mitra_id', $mitra->id)
            ->orderByDesc('created_at')
            ->take(50)
            ->get()
            ->map(fn (MitraSettlement $settlement) => [
                'id' => $settlement->id,
                'period_start' => $settlement->period_start?->format('Y-m-d'),
                'period_end' => $settlement->period_end?->format('Y-m-d'),
                'calculation_method' => $settlement->calculation_method,
                'total_amount' => (float) $settlement->total_amount,
                'status' => $settlement->status,
                'validation_note' => $settlement->validation_note,
                'created_at' => $settlement->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();

        $rows = collect($reportData);
        $deliveryRows = collect($deliveries);
        $settlementRows = collect($settlements);

        return [
            'items' => $reportData,
            'summary' => [
                'stock_item_count' => $rows->count(),
                'used_stock_item_count' => $rows->filter(fn ($row) => (float) $row['sales_qty'] > 0)->count(),
                'restock_event_count' => $restockHistory->count(),
                'current_stock' => round((float) $rows->sum('current_stock'), 2),
                'raw_material_out' => round((float) $rows->sum('sales_qty'), 2),
                'sold_usage' => round((float) $rows->sum('sold_qty'), 2),
                'waste' => round((float) $rows->sum('waste_qty'), 2),
                'restocked' => round((float) $rows->sum('restock_qty'), 2),
                'sent' => round((float) $deliveryRows->sum('qty_sent'), 2),
                'received' => round((float) $deliveryRows->sum(fn ($row) => $row['qty_received'] ?? 0), 2),
                'pending_deliveries' => $deliveryRows->where('status', MitraStockDelivery::STATUS_SENT)->count(),
                'different_deliveries' => $deliveryRows->where('status', MitraStockDelivery::STATUS_RECEIVED_DIFFERENCE)->count(),
                'pending_settlements' => $settlementRows->where('status', MitraSettlement::STATUS_PENDING)->count(),
                'paid_settlements' => round((float) $settlementRows
                    ->where('status', MitraSettlement::STATUS_PAID)
                    ->sum('total_amount')),
                'products_used' => count($productUsage),
                'product_waste' => round((float) collect($productUsage)->sum('waste_qty'), 2),
            ],
            'product_usage' => $productUsage,
            'deliveries' => $deliveries,
            'restock_history' => $restockHistory->values()->all(),
            'settlements' => $settlements,
        ];
    }

    private function getProductUsageOverview(
        string $outletId,
        array $stockIds,
        Carbon $periodStart,
        Carbon $periodEnd
    ): array {
        if (empty($stockIds)) {
            return [];
        }

        $conversionsByProduct = Conversion::with([
            'product:id,name',
            'stockItem:id,name,unit_name',
        ])
            ->whereIn('stock_item_id', $stockIds)
            ->get()
            ->groupBy('product_id');
        $productIds = $conversionsByProduct->keys()->all();

        if (empty($productIds)) {
            return [];
        }

        $usage = [];
        foreach ($conversionsByProduct as $productId => $conversions) {
            $usage[$productId] = [
                'product_id' => $productId,
                'name' => $conversions->first()?->product?->name ?? 'Produk',
                'sold_qty' => 0.0,
                'waste_qty' => 0.0,
                'total_usage_qty' => 0.0,
                'revenue' => 0.0,
                'transaction_ids' => [],
                'waste_by_type' => [],
                'materials' => [],
            ];

            foreach ($conversions as $conversion) {
                $usage[$productId]['materials'][$conversion->stock_item_id] = [
                    'stock_item_id' => $conversion->stock_item_id,
                    'name' => $conversion->stockItem?->name ?? 'Bahan',
                    'unit_name' => $conversion->stockItem?->unit_name ?? 'unit',
                    'sold_usage' => 0.0,
                    'waste_usage' => 0.0,
                    'total_usage' => 0.0,
                ];
            }
        }

        $transactions = Transaction::with(['items' => fn ($query) => $query->whereIn('product_id', $productIds)])
            ->where('outlet_id', $outletId)
            ->where('payment_status', 'PAID')
            ->whereBetween('created_at', [$periodStart, $periodEnd])
            ->whereHas('items', fn ($query) => $query->whereIn('product_id', $productIds))
            ->get();

        foreach ($transactions as $transaction) {
            foreach ($transaction->items as $item) {
                if (! isset($usage[$item->product_id])) {
                    continue;
                }

                $quantity = (float) $item->qty_porsi;
                $usage[$item->product_id]['name'] = $item->product_name ?: $usage[$item->product_id]['name'];
                $usage[$item->product_id]['sold_qty'] += $quantity;
                $usage[$item->product_id]['revenue'] += (float) $item->subtotal;
                $usage[$item->product_id]['transaction_ids'][$transaction->id] = true;

                foreach ($conversionsByProduct->get($item->product_id, collect()) as $conversion) {
                    $materialUsage = $quantity * (float) $conversion->ratio;
                    $usage[$item->product_id]['materials'][$conversion->stock_item_id]['sold_usage'] += $materialUsage;
                    $usage[$item->product_id]['materials'][$conversion->stock_item_id]['total_usage'] += $materialUsage;
                }
            }
        }

        $productWaste = WasteLog::where('outlet_id', $outletId)
            ->where('source_type', WasteLog::SOURCE_PRODUCT)
            ->where('affects_mitra_settlement', true)
            ->whereIn('stock_item_id', $stockIds)
            ->whereIn('product_id', $productIds)
            ->whereBetween('created_at', [$periodStart, $periodEnd])
            ->get();

        foreach ($productWaste->groupBy('product_id') as $productId => $rows) {
            if (! isset($usage[$productId])) {
                continue;
            }

            $scopedConversionCount = max(1, $conversionsByProduct->get($productId, collect())->count());
            $wasteQuantity = (float) $rows->sum('qty_porsi') / $scopedConversionCount;
            $usage[$productId]['waste_qty'] = $wasteQuantity;
            $usage[$productId]['name'] = $rows->first()?->product_name ?: $usage[$productId]['name'];

            foreach ($rows->groupBy('waste_type') as $type => $typeRows) {
                $usage[$productId]['waste_by_type'][] = [
                    'type' => $type,
                    'quantity' => round((float) $typeRows->sum('qty_porsi') / $scopedConversionCount, 2),
                ];
            }

            foreach ($rows->groupBy('stock_item_id') as $stockItemId => $stockRows) {
                if (! isset($usage[$productId]['materials'][$stockItemId])) {
                    continue;
                }

                $materialWaste = (float) $stockRows->sum('qty_biji');
                $usage[$productId]['materials'][$stockItemId]['waste_usage'] += $materialWaste;
                $usage[$productId]['materials'][$stockItemId]['total_usage'] += $materialWaste;
            }
        }

        return collect($usage)
            ->map(function (array $row) {
                $row['sold_qty'] = round($row['sold_qty'], 2);
                $row['waste_qty'] = round($row['waste_qty'], 2);
                $row['total_usage_qty'] = round($row['sold_qty'] + $row['waste_qty'], 2);
                $row['revenue'] = round($row['revenue']);
                $row['transaction_count'] = count($row['transaction_ids']);
                $row['materials'] = collect($row['materials'])
                    ->map(function (array $material) {
                        $material['sold_usage'] = round($material['sold_usage'], 2);
                        $material['waste_usage'] = round($material['waste_usage'], 2);
                        $material['total_usage'] = round($material['total_usage'], 2);

                        return $material;
                    })
                    ->values()
                    ->all();
                unset($row['transaction_ids']);

                return $row;
            })
            ->filter(fn (array $row) => $row['total_usage_qty'] > 0)
            ->sortByDesc('total_usage_qty')
            ->values()
            ->all();
    }

    public function getMitraReportData(string $outletId, User $mitra, Carbon $startDate, Carbon $endDate)
    {
        $periodStart = $startDate->copy()->startOfDay();
        $periodEnd = $endDate->copy()->endOfDay();
        $mitraStockItems = $mitra->mitraStockItems()
            ->where('stock_items.outlet_id', $outletId)
            ->get()
            ->keyBy('id');
        $mitraStockIds = $mitraStockItems->keys()->toArray();
        $itemKeysByStockId = $mitraStockItems
            ->mapWithKeys(fn (StockItem $item) => [$item->id => $this->settlementItemKeyForStock($item)])
            ->all();
        $settlementItemKeys = array_values(array_unique(array_values($itemKeysByStockId)));

        if (empty($mitraStockIds)) {
            return [];
        }

        // 1. Calculate Restock Qty
        $restocks = DB::table('restock_logs')
            ->where('outlet_id', $outletId)
            ->whereIn('stock_item_id', $mitraStockIds)
            ->whereBetween('created_at', [$periodStart, $periodEnd])
            ->groupBy('stock_item_id')
            ->select('stock_item_id', DB::raw('SUM(qty_added) as total_restock'))
            ->get()
            ->keyBy('stock_item_id');

        // 2. Calculate Sales Qty (Menu -> Conversion -> Stock Item)
        $transactions = Transaction::with('items')
            ->where('outlet_id', $outletId)
            ->where('payment_status', 'PAID')
            ->whereBetween('created_at', [$periodStart, $periodEnd])
            ->get();

        $conversions = Conversion::whereIn('stock_item_id', $mitraStockIds)->get()->groupBy('product_id');

        $salesPerStock = [];
        foreach ($mitraStockIds as $id) {
            $salesPerStock[$id] = 0;
        }

        foreach ($transactions as $t) {
            foreach ($t->items as $item) {
                if ($conversions->has($item->product_id)) {
                    foreach ($conversions->get($item->product_id) as $conv) {
                        $stockId = $conv->stock_item_id;
                        $qtyUsed = $item->qty_porsi * $conv->ratio;
                        $salesPerStock[$stockId] += $qtyUsed;
                    }
                }
            }
        }

        $wasteRows = DB::table('waste_logs')
            ->where('outlet_id', $outletId)
            ->whereIn('stock_item_id', $mitraStockIds)
            ->where('affects_mitra_settlement', true)
            ->whereBetween('created_at', [$periodStart, $periodEnd])
            ->groupBy('stock_item_id')
            ->select('stock_item_id', DB::raw('SUM(qty_biji) as total_waste'))
            ->get()
            ->keyBy('stock_item_id');
        $wasteBreakdowns = DB::table('waste_logs')
            ->where('outlet_id', $outletId)
            ->whereIn('stock_item_id', $mitraStockIds)
            ->where('affects_mitra_settlement', true)
            ->whereBetween('created_at', [$periodStart, $periodEnd])
            ->groupBy('stock_item_id', 'waste_type', 'source_type')
            ->select(
                'stock_item_id',
                'waste_type',
                'source_type',
                DB::raw('SUM(qty_biji) as total_qty')
            )
            ->get()
            ->groupBy('stock_item_id');

        // 3. Track paid quantities and quantities reserved by active proposals.
        $settledPerItemKey = $this->getSettlementQtyByItemKey(
            $mitra->id,
            $settlementItemKeys,
            $periodStart,
            $periodEnd,
            [MitraSettlement::STATUS_PAID],
            null,
        );
        $pendingSettlementPerItemKey = $this->getSettlementQtyByItemKey(
            $mitra->id,
            $settlementItemKeys,
            $periodStart,
            $periodEnd,
            [MitraSettlement::STATUS_PENDING, MitraSettlement::STATUS_APPROVED],
            null,
        );
        $sameMethodCommittedPerItemKey = $this->getSettlementQtyByItemKey(
            $mitra->id,
            $settlementItemKeys,
            $periodStart,
            $periodEnd,
            [MitraSettlement::STATUS_PENDING, MitraSettlement::STATUS_APPROVED, MitraSettlement::STATUS_PAID],
            'SALES',
        );

        // 4. Combine Data with proportional pricing
        $reportData = [];
        foreach ($mitraStockItems as $stockId => $stockItem) {
            $restockQty = $restocks->has($stockId) ? (float) $restocks->get($stockId)->total_restock : 0;
            $soldQty = $salesPerStock[$stockId] ?? 0;
            $wasteQty = $wasteRows->has($stockId) ? (float) $wasteRows->get($stockId)->total_waste : 0;
            $stockWasteBreakdown = collect($wasteBreakdowns->get($stockId, collect()))
                ->map(fn ($row) => [
                    'type' => $row->waste_type,
                    'source_type' => $row->source_type,
                    'quantity' => round((float) $row->total_qty, 2),
                ])
                ->values();
            $wasteQtyByType = fn (string $type) => (float) $stockWasteBreakdown
                ->where('type', $type)
                ->sum('quantity');
            $wasteQtyBySource = fn (string $source) => (float) $stockWasteBreakdown
                ->where('source_type', $source)
                ->sum('quantity');
            $salesQty = $soldQty + $wasteQty;
            $restockPrice = (float) ($stockItem->restock_price ?? 0);
            $minRestockQty = $stockItem->min_restock_qty > 0 ? (float) $stockItem->min_restock_qty : 1;
            $settlementItemKey = $itemKeysByStockId[$stockId] ?? "stock:{$stockId}";
            $settledQty = $settledPerItemKey[$settlementItemKey] ?? 0;
            $pendingSettlementQty = $pendingSettlementPerItemKey[$settlementItemKey] ?? 0;
            $sameCommittedQty = $sameMethodCommittedPerItemKey[$settlementItemKey] ?? 0;
            $committedQty = $settledQty + $pendingSettlementQty;
            $crossCommittedQty = max(0, $committedQty - $sameCommittedQty);

            // Proportional subtotal: (qty / min_restock_qty) * restock_price
            $restockSubtotal = ($restockQty / $minRestockQty) * $restockPrice;
            $salesSubtotal = ($salesQty / $minRestockQty) * $restockPrice;

            $reportData[] = [
                'stock_item_id' => $stockId,
                'warehouse_stock_item_id' => $stockItem->warehouse_stock_item_id,
                'settlement_item_key' => $settlementItemKey,
                'item_key' => $settlementItemKey,
                'name' => $stockItem->name,
                'unit_name' => $stockItem->unit_name,
                'current_stock' => (float) $stockItem->current_stock_biji,
                'restock_price' => $restockPrice,
                'min_restock_qty' => $minRestockQty,
                'restock_qty' => round($restockQty, 2),
                'sold_qty' => round($soldQty, 2),
                'waste_qty' => round($wasteQty, 2),
                'personal_use_qty' => round($wasteQtyByType(WasteLog::TYPE_OWNER_REQUEST), 2),
                'expired_waste_qty' => round($wasteQtyByType(WasteLog::TYPE_EXPIRED), 2),
                'damaged_waste_qty' => round($wasteQtyByType(WasteLog::TYPE_DAMAGED), 2),
                'other_waste_qty' => round($wasteQtyByType(WasteLog::TYPE_OTHER), 2),
                'product_waste_qty' => round($wasteQtyBySource(WasteLog::SOURCE_PRODUCT), 2),
                'stock_waste_qty' => round($wasteQtyBySource(WasteLog::SOURCE_STOCK), 2),
                'waste_breakdown' => $stockWasteBreakdown->all(),
                'sales_qty' => round($salesQty, 2),
                'gross_qty' => round($salesQty, 2),
                'settled_qty' => round($settledQty, 2),
                'pending_settlement_qty' => round($pendingSettlementQty, 2),
                'same_method_committed_qty' => round($sameCommittedQty, 2),
                'cross_committed_qty' => round($crossCommittedQty, 2),
                'committed_qty' => round($committedQty, 2),
                'remaining_qty' => round(max(0, $salesQty - $committedQty), 2),
                'restock_subtotal' => round($restockSubtotal),
                'sales_subtotal' => round($salesSubtotal),
            ];
        }

        return $reportData;
    }

    /**
     * Get the total qty already settled (PAID) per stock item for the given mitra in overlapping periods.
     */
    private function settlementItemKeyForStock(StockItem $stockItem): string
    {
        return $stockItem->warehouse_stock_item_id
            ? "warehouse:{$stockItem->warehouse_stock_item_id}"
            : "stock:{$stockItem->id}";
    }

    private function allocateCommittedQuantitiesAcrossRows(array $rows, string $quantityKey): array
    {
        $remainingCommittedByKey = [];
        $remainingPaidByKey = [];
        $remainingPendingByKey = [];
        $remainingSameByKey = [];
        $remainingCrossByKey = [];

        foreach ($rows as $row) {
            $key = $row['settlement_item_key'] ?? $row['item_key'] ?? $row['stock_item_id'] ?? null;
            if (! $key || isset($remainingCommittedByKey[$key])) {
                continue;
            }

            $remainingCommittedByKey[$key] = (float) ($row['committed_qty'] ?? 0);
            $remainingPaidByKey[$key] = (float) ($row['settled_qty'] ?? 0);
            $remainingPendingByKey[$key] = (float) ($row['pending_settlement_qty'] ?? 0);
            $remainingSameByKey[$key] = (float) ($row['same_method_committed_qty'] ?? 0);
            $remainingCrossByKey[$key] = (float) ($row['cross_committed_qty'] ?? 0);
        }

        return collect($rows)->map(function (array $row) use (
            $quantityKey,
            &$remainingCommittedByKey,
            &$remainingPaidByKey,
            &$remainingPendingByKey,
            &$remainingSameByKey,
            &$remainingCrossByKey
        ) {
            $key = $row['settlement_item_key'] ?? $row['item_key'] ?? $row['stock_item_id'] ?? null;
            if (! $key) {
                return $row;
            }

            $grossQty = (float) ($row[$quantityKey] ?? 0);
            $allocatedCommitted = min($grossQty, max(0, $remainingCommittedByKey[$key] ?? 0));
            $remainingCommittedByKey[$key] = max(0, ($remainingCommittedByKey[$key] ?? 0) - $allocatedCommitted);

            $allocatedPaid = min($grossQty, max(0, $remainingPaidByKey[$key] ?? 0));
            $remainingPaidByKey[$key] = max(0, ($remainingPaidByKey[$key] ?? 0) - $allocatedPaid);
            $remainingForPending = max(0, $grossQty - $allocatedPaid);
            $allocatedPending = min($remainingForPending, max(0, $remainingPendingByKey[$key] ?? 0));
            $remainingPendingByKey[$key] = max(0, ($remainingPendingByKey[$key] ?? 0) - $allocatedPending);

            $allocatedSame = min($allocatedCommitted, max(0, $remainingSameByKey[$key] ?? 0));
            $remainingSameByKey[$key] = max(0, ($remainingSameByKey[$key] ?? 0) - $allocatedSame);
            $remainingForCross = max(0, $allocatedCommitted - $allocatedSame);
            $allocatedCross = min($remainingForCross, max(0, $remainingCrossByKey[$key] ?? 0));
            $remainingCrossByKey[$key] = max(0, ($remainingCrossByKey[$key] ?? 0) - $allocatedCross);

            return [
                ...$row,
                'total_committed_qty' => round((float) ($row['committed_qty'] ?? 0), 2),
                'total_settled_qty' => round((float) ($row['settled_qty'] ?? 0), 2),
                'total_pending_settlement_qty' => round((float) ($row['pending_settlement_qty'] ?? 0), 2),
                'settled_qty' => round($allocatedPaid, 2),
                'pending_settlement_qty' => round($allocatedPending, 2),
                'same_method_committed_qty' => round($allocatedSame, 2),
                'cross_committed_qty' => round($allocatedCross, 2),
                'committed_qty' => round($allocatedCommitted, 2),
                'remaining_qty' => round(max(0, $grossQty - $allocatedCommitted), 2),
            ];
        })->all();
    }

    private function getSettlementQtyByItemKey(
        string $mitraId,
        array $itemKeys,
        Carbon $startDate,
        Carbon $endDate,
        array $statuses,
        ?string $calculationMethod,
    ): array {
        $settledPerKey = array_fill_keys($itemKeys, 0);
        if (empty($itemKeys)) {
            return $settledPerKey;
        }

        $query = MitraSettlement::where('mitra_id', $mitraId)
            ->whereIn('status', $statuses)
            ->where(function ($q) use ($startDate, $endDate) {
                $q->where('period_start', '<=', $endDate->copy()->endOfDay())
                    ->where('period_end', '>=', $startDate->copy()->startOfDay());
            });

        if ($calculationMethod !== null) {
            $query->where('calculation_method', $calculationMethod);
        }

        $settlements = $query->get();
        $receiptRows = $settlements
            ->flatMap(fn (MitraSettlement $settlement) => is_array($settlement->receipt_data) ? $settlement->receipt_data : [])
            ->filter(fn ($item) => is_array($item));
        $stockIds = $receiptRows
            ->pluck('stock_item_id')
            ->filter()
            ->unique()
            ->values()
            ->all();
        $stockWarehouseIds = empty($stockIds)
            ? []
            : StockItem::whereIn('id', $stockIds)
                ->pluck('warehouse_stock_item_id', 'id')
                ->all();

        foreach ($receiptRows as $item) {
            $itemKey = $this->receiptSettlementItemKey($item, $stockWarehouseIds);
            if ($itemKey && array_key_exists($itemKey, $settledPerKey)) {
                $settledPerKey[$itemKey] += (float) ($item['calculated_qty'] ?? 0);
            }
        }

        return $settledPerKey;
    }

    private function receiptSettlementItemKey(array $item, array $stockWarehouseIds): ?string
    {
        if (! empty($item['settlement_item_key'])) {
            return (string) $item['settlement_item_key'];
        }

        if (! empty($item['warehouse_stock_item_id'])) {
            return "warehouse:{$item['warehouse_stock_item_id']}";
        }

        if (! empty($item['stock_item_id'])) {
            $stockId = (string) $item['stock_item_id'];
            $warehouseId = $stockWarehouseIds[$stockId] ?? null;

            return $warehouseId ? "warehouse:{$warehouseId}" : "stock:{$stockId}";
        }

        return null;
    }

    private function getSettlementQtyPerStock(
        string $outletId,
        string $mitraId,
        array $stockIds,
        Carbon $startDate,
        Carbon $endDate,
        array $statuses,
        string $calculationMethod,
    ): array
    {
        return $this->getSettlementQtyPerReceiptKey(
            $mitraId,
            $stockIds,
            'stock_item_id',
            $startDate,
            $endDate,
            $statuses,
            $calculationMethod,
        );
    }

    private function getSettlementQtyPerReceiptKey(
        string $mitraId,
        array $itemIds,
        string $receiptKey,
        Carbon $startDate,
        Carbon $endDate,
        array $statuses,
        string $calculationMethod,
    ): array {
        $settledPerStock = array_fill_keys($itemIds, 0);
        $paidSettlements = MitraSettlement::where('mitra_id', $mitraId)
            ->whereIn('status', $statuses)
            ->where('calculation_method', $calculationMethod)
            ->where(function ($q) use ($startDate, $endDate) {
                // Settlements whose period overlaps with the report period
                $q->where('period_start', '<=', $endDate->endOfDay())
                  ->where('period_end', '>=', $startDate->startOfDay());
            })
            ->get();

        foreach ($paidSettlements as $settlement) {
            if (is_array($settlement->receipt_data)) {
                foreach ($settlement->receipt_data as $item) {
                    $stockId = $item[$receiptKey] ?? null;
                    if ($stockId && isset($settledPerStock[$stockId])) {
                        // Use the qty that was used for calculation at the time of settlement
                        $settledPerStock[$stockId] += (float) ($item['calculated_qty'] ?? 0);
                    }
                }
            }
        }

        return $settledPerStock;
    }
}
