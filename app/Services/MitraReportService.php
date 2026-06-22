<?php

namespace App\Services;

use App\Models\Conversion;
use App\Models\MitraSettlement;
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
        $transactions = Transaction::with('items')
            ->where('outlet_id', $outletId)
            ->where('payment_status', 'PAID')
            ->whereBetween('created_at', [$startDate->startOfDay(), clone $endDate->endOfDay()])
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

        // 3. Calculate already-settled (PAID) qty per stock item in overlapping periods
        $settledPerStock = $this->getSettledQtyPerStock($outletId, $mitra->id, $mitraStockIds, $startDate, $endDate);

        // 4. Combine Data with proportional pricing
        $reportData = [];
        foreach ($mitraStockItems as $stockId => $stockItem) {
            $restockQty = $restocks->has($stockId) ? (float) $restocks->get($stockId)->total_restock : 0;
            $salesQty = $salesPerStock[$stockId] ?? 0;
            $restockPrice = (float) ($stockItem->restock_price ?? 0);
            $minRestockQty = $stockItem->min_restock_qty > 0 ? (float) $stockItem->min_restock_qty : 1;
            $settledQty = $settledPerStock[$stockId] ?? 0;

            // Proportional subtotal: (qty / min_restock_qty) * restock_price
            $restockSubtotal = ($restockQty / $minRestockQty) * $restockPrice;
            $salesSubtotal = ($salesQty / $minRestockQty) * $restockPrice;

            $reportData[] = [
                'stock_item_id' => $stockId,
                'name' => $stockItem->name,
                'unit_name' => $stockItem->unit_name,
                'current_stock' => (float) $stockItem->current_stock_biji,
                'restock_price' => $restockPrice,
                'min_restock_qty' => $minRestockQty,
                'restock_qty' => round($restockQty, 2),
                'sales_qty' => round($salesQty, 2),
                'settled_qty' => round($settledQty, 2),
                'restock_subtotal' => round($restockSubtotal),
                'sales_subtotal' => round($salesSubtotal),
            ];
        }

        return $reportData;
    }

    /**
     * Get the total qty already settled (PAID) per stock item for the given mitra in overlapping periods.
     */
    private function getSettledQtyPerStock(string $outletId, string $mitraId, array $stockIds, Carbon $startDate, Carbon $endDate): array
    {
        $settledPerStock = array_fill_keys($stockIds, 0);

        $paidSettlements = MitraSettlement::where('outlet_id', $outletId)
            ->where('mitra_id', $mitraId)
            ->where('status', 'PAID')
            ->where(function ($q) use ($startDate, $endDate) {
                // Settlements whose period overlaps with the report period
                $q->where('period_start', '<=', $endDate->endOfDay())
                  ->where('period_end', '>=', $startDate->startOfDay());
            })
            ->get();

        foreach ($paidSettlements as $settlement) {
            if (is_array($settlement->receipt_data)) {
                foreach ($settlement->receipt_data as $item) {
                    $stockId = $item['stock_item_id'] ?? null;
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
