<?php

namespace App\Services;

use App\Models\RestockLog;
use App\Models\StockItem;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WarehouseStockItem;
use App\Models\WarehouseStockTransfer;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class WarehouseInventoryService
{
    public function defaultWarehouse(): Warehouse
    {
        return Warehouse::where('is_active', true)->orderBy('created_at')->firstOrFail();
    }

    public function ensureWarehouseStockItem(User $mitra, StockItem $sourceItem): WarehouseStockItem
    {
        $isScoped = $mitra->mitraStockItems()
            ->where('stock_items.id', $sourceItem->id)
            ->exists();

        if (! $mitra->isMitra() || ! $isScoped) {
            throw new \InvalidArgumentException('Bahan tidak terhubung ke mitra.');
        }

        $warehouse = $this->defaultWarehouse();
        $normalizedName = $this->normalizeName($sourceItem->name);
        $warehouseItem = WarehouseStockItem::firstOrCreate(
            [
                'warehouse_id' => $warehouse->id,
                'mitra_id' => $mitra->id,
                'normalized_name' => $normalizedName,
                'unit_name' => $sourceItem->unit_name,
            ],
            [
                'name' => $sourceItem->name,
                'current_stock' => 0,
                'min_stock_alert' => $sourceItem->min_stock_alert,
                'min_restock_qty' => $sourceItem->min_restock_qty,
                'restock_price' => $sourceItem->restock_price,
            ],
        );

        $matchingStockIds = $mitra->mitraStockItems()
            ->get(['stock_items.id', 'stock_items.name', 'stock_items.unit_name'])
            ->filter(fn (StockItem $item) => $this->normalizeName($item->name) === $normalizedName
                && Str::lower($item->unit_name) === Str::lower($sourceItem->unit_name))
            ->pluck('id');

        StockItem::whereIn('id', $matchingStockIds)
            ->where(function ($query) use ($warehouseItem) {
                $query->whereNull('warehouse_stock_item_id')
                    ->orWhere('warehouse_stock_item_id', $warehouseItem->id);
            })
            ->update(['warehouse_stock_item_id' => $warehouseItem->id]);

        return $warehouseItem->fresh(['warehouse', 'mitra']);
    }

    public function transferToOutlet(
        string $outletId,
        string $stockItemId,
        User $user,
        float $quantity,
        ?string $note
    ): WarehouseStockTransfer {
        if ($user->isMitra()) {
            throw new \InvalidArgumentException('Mitra tidak dapat mengambil stok untuk outlet.');
        }

        if ($quantity <= 0) {
            throw new \InvalidArgumentException('Jumlah pengambilan harus lebih dari 0.');
        }

        return DB::transaction(function () use ($outletId, $stockItemId, $user, $quantity, $note) {
            $outletStock = StockItem::where('id', $stockItemId)
                ->where('outlet_id', $outletId)
                ->lockForUpdate()
                ->firstOrFail();

            if (! $outletStock->warehouse_stock_item_id) {
                throw new \InvalidArgumentException('Bahan outlet ini belum terhubung dengan stok gudang.');
            }

            $warehouseStock = WarehouseStockItem::where('id', $outletStock->warehouse_stock_item_id)
                ->lockForUpdate()
                ->firstOrFail();
            $warehouseBefore = (float) $warehouseStock->current_stock;

            if ($warehouseBefore + 0.0001 < $quantity) {
                throw new \InvalidArgumentException(
                    "Stok gudang tidak cukup. Tersedia {$warehouseBefore} {$warehouseStock->unit_name}."
                );
            }

            $outletBefore = (float) $outletStock->current_stock_biji;
            $warehouseAfter = $warehouseBefore - $quantity;
            $outletAfter = $outletBefore + $quantity;

            $warehouseStock->update(['current_stock' => $warehouseAfter]);
            $outletStock->update(['current_stock_biji' => $outletAfter]);

            $transfer = WarehouseStockTransfer::create([
                'warehouse_id' => $warehouseStock->warehouse_id,
                'warehouse_stock_item_id' => $warehouseStock->id,
                'outlet_id' => $outletId,
                'stock_item_id' => $outletStock->id,
                'quantity' => $quantity,
                'warehouse_stock_before' => $warehouseBefore,
                'warehouse_stock_after' => $warehouseAfter,
                'outlet_stock_before' => $outletBefore,
                'outlet_stock_after' => $outletAfter,
                'note' => $note,
                'transferred_by' => $user->id,
                'created_at' => now(),
            ]);

            RestockLog::create([
                'outlet_id' => $outletId,
                'stock_item_id' => $outletStock->id,
                'qty_added' => $quantity,
                'stock_before' => $outletBefore,
                'stock_after' => $outletAfter,
                'note' => 'Pengambilan dari gudang'.($note ? " - {$note}" : ''),
                'fund_source' => RestockLog::FUND_SOURCE_WAREHOUSE_TRANSFER,
                'restock_cost' => 0,
                'created_at' => now(),
            ]);

            return $transfer->fresh([
                'warehouseStockItem',
                'outlet',
                'stockItem',
                'transferredBy',
            ]);
        });
    }

    private function normalizeName(string $name): string
    {
        return Str::lower(trim((string) preg_replace('/\s+/', ' ', $name)));
    }
}
