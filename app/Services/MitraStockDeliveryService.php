<?php

namespace App\Services;

use App\Models\MitraStockDelivery;
use App\Models\StockItem;
use App\Models\User;
use App\Models\WarehouseStockItem;
use Illuminate\Support\Facades\DB;

class MitraStockDeliveryService
{
    public function __construct(private WarehouseInventoryService $warehouseInventory) {}

    public function create(User $mitra, string $stockItemId, float $quantity, ?string $note): MitraStockDelivery
    {
        if (! $mitra->isMitra()) {
            throw new \InvalidArgumentException('Hanya mitra yang dapat mencatat pengiriman.');
        }

        if ($quantity <= 0) {
            throw new \InvalidArgumentException('Jumlah kirim harus lebih dari 0.');
        }

        $sourceItem = StockItem::findOrFail($stockItemId);
        $warehouseStockItem = $this->warehouseInventory->ensureWarehouseStockItem($mitra, $sourceItem);

        return MitraStockDelivery::create([
            'outlet_id' => null,
            'warehouse_id' => $warehouseStockItem->warehouse_id,
            'warehouse_stock_item_id' => $warehouseStockItem->id,
            'mitra_id' => $mitra->id,
            'stock_item_id' => $sourceItem->id,
            'qty_sent' => $quantity,
            'status' => MitraStockDelivery::STATUS_SENT,
            'sender_note' => $note,
            'sent_at' => now(),
        ]);
    }

    public function receive(
        string $deliveryId,
        User $receiver,
        float $quantityReceived,
        ?string $note
    ): MitraStockDelivery {
        if ($receiver->isMitra()) {
            throw new \InvalidArgumentException('Mitra tidak dapat memvalidasi penerimaan outlet.');
        }

        if ($quantityReceived < 0) {
            throw new \InvalidArgumentException('Jumlah diterima tidak boleh kurang dari 0.');
        }

        return DB::transaction(function () use ($deliveryId, $receiver, $quantityReceived, $note) {
            $delivery = MitraStockDelivery::where('id', $deliveryId)
                ->lockForUpdate()
                ->firstOrFail();

            if (! $delivery->isPending()) {
                throw new \InvalidArgumentException('Pengiriman ini sudah pernah diperiksa.');
            }

            $warehouseStockItem = WarehouseStockItem::where('id', $delivery->warehouse_stock_item_id)
                ->lockForUpdate()
                ->firstOrFail();

            $before = (float) $warehouseStockItem->current_stock;
            $after = $before + $quantityReceived;
            $warehouseStockItem->update(['current_stock' => $after]);

            $matches = abs((float) $delivery->qty_sent - $quantityReceived) < 0.0001;
            $delivery->update([
                'qty_received' => $quantityReceived,
                'status' => $matches
                    ? MitraStockDelivery::STATUS_RECEIVED_MATCH
                    : MitraStockDelivery::STATUS_RECEIVED_DIFFERENCE,
                'receiver_note' => $note,
                'received_at' => now(),
                'received_by' => $receiver->id,
                'restock_log_id' => null,
            ]);

            return $delivery->fresh(['warehouseStockItem', 'warehouse', 'mitra', 'receiver']);
        });
    }
}
