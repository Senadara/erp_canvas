<?php

namespace App\Services;

use App\Models\Conversion;
use App\Models\Product;
use App\Models\RestockLog;
use App\Models\StockItem;
use App\Models\WasteLog;
use Illuminate\Support\Facades\DB;

class StockService
{
    public function addStock(string $stockItemId, float $qty, ?string $note = null)
    {
        if ($qty <= 0) {
            throw new \InvalidArgumentException("Jumlah harus lebih dari 0.");
        }

        return DB::transaction(function () use ($stockItemId, $qty, $note) {
            $row = StockItem::findOrFail($stockItemId);
            $before = $row->current_stock_biji;
            $next = $before + $qty;

            $row->update(['current_stock_biji' => $next]);

            RestockLog::create([
                'outlet_id' => $row->outlet_id,
                'stock_item_id' => $stockItemId,
                'qty_added' => $qty,
                'stock_before' => $before,
                'stock_after' => $next,
                'note' => $note,
            ]);

            if ($row->restock_price > 0 && $row->min_restock_qty > 0) {
                $cost = ($qty / $row->min_restock_qty) * $row->restock_price;
                if ($cost > 0) {
                    \App\Models\PettyCash::create([
                        'outlet_id' => $row->outlet_id,
                        'amount' => $cost,
                        'category' => 'RESTOCK',
                        'description' => "Restok {$row->name} ({$qty} {$row->unit_name})" . ($note ? " - {$note}" : ""),
                    ]);
                }
            }

            return $row;
        });
    }

    public function recordWaste(string $outletId, string $stockItemId, float $qtyBiji, string $reason)
    {
        if ($qtyBiji <= 0) {
            throw new \InvalidArgumentException("Jumlah harus lebih dari 0.");
        }

        return DB::transaction(function () use ($outletId, $stockItemId, $qtyBiji, $reason) {
            $row = StockItem::where('id', $stockItemId)->where('outlet_id', $outletId)->firstOrFail();
            $have = $row->current_stock_biji;

            if ($row->trackable && $have < $qtyBiji) {
                throw new \InvalidArgumentException("Stok tidak cukup untuk waste.");
            }

            $next = $have - $qtyBiji;
            $row->update(['current_stock_biji' => $next]);

            return WasteLog::create([
                'outlet_id' => $outletId,
                'stock_item_id' => $stockItemId,
                'qty_biji' => $qtyBiji,
                'reason' => $reason,
            ]);
        });
    }

    public function getStockInPorsi(string $outletId, string $productId): int
    {
        $conversions = Conversion::where('product_id', $productId)->with('stockItem')->get();
        $relevant = $conversions->filter(fn($c) => $c->stockItem->outlet_id === $outletId);
        
        if ($relevant->isEmpty()) {
            return 0;
        }

        $minPorsi = INF;
        $anyTrackable = false;
        
        foreach ($relevant as $c) {
            if (!$c->stockItem->trackable) continue;
            
            $anyTrackable = true;
            $stock = $c->stockItem->current_stock_biji;
            $ratio = $c->ratio;
            
            if ($ratio <= 0) continue;
            
            $porsi = floor($stock / $ratio);
            if ($porsi < $minPorsi) {
                $minPorsi = $porsi;
            }
        }
        
        if (!$anyTrackable) return 1000000;
        if ($minPorsi === INF) return 0;
        
        return (int) $minPorsi;
    }

    public function getProductStockSummary(string $outletId): array
    {
        $products = Product::where('outlet_id', $outletId)->where('is_active', true)->get(['id']);
        $map = [];
        foreach ($products as $p) {
            $map[$p->id] = $this->getStockInPorsi($outletId, $p->id);
        }
        return $map;
    }

    public function createStockItem(array $data)
    {
        return StockItem::create([
            'outlet_id' => $data['outlet_id'],
            'name' => $data['name'],
            'current_stock_biji' => $data['current_stock_biji'] ?? 0,
            'unit_name' => $data['unit_name'] ?? 'biji',
            'min_stock_alert' => $data['min_stock_alert'] ?? 0,
            'trackable' => $data['trackable'] ?? true,
            'counting_basis' => $data['counting_basis'] ?? 'BIJI',
            'display_group_id' => $data['display_group_id'] ?? null,
            'min_restock_qty' => $data['min_restock_qty'] ?? 1,
            'restock_price' => $data['restock_price'] ?? 0,
        ]);
    }

    public function updateStockItem(string $id, string $outletId, array $data)
    {
        $item = StockItem::where('id', $id)->where('outlet_id', $outletId)->firstOrFail();
        
        $item->update([
            'name' => $data['name'],
            'current_stock_biji' => $data['current_stock_biji'],
            'unit_name' => $data['unit_name'] ?? $item->unit_name,
            'min_stock_alert' => $data['min_stock_alert'] ?? $item->min_stock_alert,
            'trackable' => $data['trackable'] ?? $item->trackable,
            'counting_basis' => $data['counting_basis'] ?? $item->counting_basis,
            'display_group_id' => array_key_exists('display_group_id', $data) ? $data['display_group_id'] : $item->display_group_id,
            'min_restock_qty' => $data['min_restock_qty'] ?? $item->min_restock_qty,
            'restock_price' => $data['restock_price'] ?? $item->restock_price,
        ]);

        return $item;
    }

    public function deleteStockItem(string $outletId, string $stockItemId)
    {
        $item = StockItem::where('id', $stockItemId)->where('outlet_id', $outletId)->withCount('conversions')->firstOrFail();
        
        if ($item->conversions_count > 0) {
            throw new \Exception("Bahan masih dipakai di menu produk. Hapus konversi produk dulu.");
        }

        DB::transaction(function () use ($stockItemId, $item) {
            DB::table('mitra_stock_scopes')->where('stock_item_id', $stockItemId)->delete();
            WasteLog::where('stock_item_id', $stockItemId)->delete();
            RestockLog::where('stock_item_id', $stockItemId)->delete();
            $item->delete();
        });
    }

    public function listStockItems(string $outletId)
    {
        return StockItem::with([
            'supplier',
            'displayGroup:id,name,sort_order',
            'conversions.product:id,name'
        ])
        ->where('outlet_id', $outletId)
        ->orderBy('name')
        ->get();
    }

    public function listRestockLogs(string $outletId, int $take = 120)
    {
        return RestockLog::with('stockItem:id,name,trackable')
            ->where('outlet_id', $outletId)
            ->orderByDesc('created_at')
            ->take($take)
            ->get();
    }

    public function listWasteLogs(string $outletId, int $take = 50)
    {
        return WasteLog::with('stockItem:id,name,trackable')
            ->where('outlet_id', $outletId)
            ->orderByDesc('created_at')
            ->take($take)
            ->get();
    }
}
