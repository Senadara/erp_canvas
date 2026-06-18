<?php

namespace App\Services;

use App\Models\Conversion;
use App\Models\StockItem;
use App\Models\Transaction;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class MitraReportService
{
    public function getMitraReportData(string $outletId, User $mitra, Carbon $startDate, Carbon $endDate)
    {
        $mitraStockItems = $mitra->mitraStockItems()->get()->keyBy('id');
        $mitraStockIds = $mitraStockItems->keys()->toArray();

        if (empty($mitraStockIds)) {
            return [];
        }

        // 1. Calculate Restock Qty
        $restocks = DB::table('restock_logs')
            ->where('outlet_id', $outletId)
            ->whereIn('stock_item_id', $mitraStockIds)
            ->whereBetween('created_at', [$startDate->startOfDay(), clone $endDate->endOfDay()])
            ->groupBy('stock_item_id')
            ->select('stock_item_id', DB::raw('SUM(qty_added) as total_restock'))
            ->get()
            ->keyBy('stock_item_id');

        // 2. Calculate Sales Qty (Menu -> Conversion -> Stock Item)
        // First, get all relevant transactions and items
        $transactions = Transaction::with('items')
            ->where('outlet_id', $outletId)
            ->where('payment_status', 'PAID')
            ->whereBetween('created_at', [$startDate->startOfDay(), clone $endDate->endOfDay()])
            ->get();

        // Get conversions that map to mitra's stock items
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

        // 3. Combine Data
        $reportData = [];
        foreach ($mitraStockItems as $stockId => $stockItem) {
            $restockQty = $restocks->has($stockId) ? (float) $restocks->get($stockId)->total_restock : 0;
            $salesQty = $salesPerStock[$stockId] ?? 0;
            $price = $stockItem->pivot->price ?? 0;

            $reportData[] = [
                'stock_item_id' => $stockId,
                'name' => $stockItem->name,
                'unit_name' => $stockItem->unit_name,
                'current_stock' => (float) $stockItem->current_stock_biji,
                'mitra_price' => (float) $price,
                'restock_qty' => $restockQty,
                'sales_qty' => $salesQty,
            ];
        }

        return $reportData;
    }
}
