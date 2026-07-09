<?php

namespace App\Services;

use App\Models\MitraStockDelivery;
use App\Models\RestockLog;
use App\Models\StockItem;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class MitraStockDeliveryService
{
    public function create(User $mitra, string $outletId, string $stockItemId, float $quantity, ?string $note): MitraStockDelivery
    {
        if (! $mitra->isMitra()) {
            throw new \InvalidArgumentException('Hanya mitra yang dapat mencatat pengiriman.');
        }

        if ($quantity <= 0) {
            throw new \InvalidArgumentException('Jumlah kirim harus lebih dari 0.');
        }

        $isScoped = $mitra->mitraStockItems()
            ->where('stock_items.id', $stockItemId)
            ->where('stock_items.outlet_id', $outletId)
            ->exists();

        if (! $isScoped) {
            throw new \InvalidArgumentException('Bahan tidak terhubung ke mitra atau outlet aktif.');
        }

        return MitraStockDelivery::create([
            'outlet_id' => $outletId,
            'mitra_id' => $mitra->id,
            'stock_item_id' => $stockItemId,
            'qty_sent' => $quantity,
            'status' => MitraStockDelivery::STATUS_SENT,
            'sender_note' => $note,
            'sent_at' => now(),
        ]);
    }

    public function receive(
        string $deliveryId,
        string $outletId,
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

        return DB::transaction(function () use ($deliveryId, $outletId, $receiver, $quantityReceived, $note) {
            $delivery = MitraStockDelivery::where('id', $deliveryId)
                ->where('outlet_id', $outletId)
                ->lockForUpdate()
                ->firstOrFail();

            if (! $delivery->isPending()) {
                throw new \InvalidArgumentException('Pengiriman ini sudah pernah diperiksa.');
            }

            $stockItem = StockItem::where('id', $delivery->stock_item_id)
                ->where('outlet_id', $outletId)
                ->lockForUpdate()
                ->firstOrFail();

            $before = (float) $stockItem->current_stock_biji;
            $after = $before + $quantityReceived;
            $cost = 0.0;

            if ((float) $stockItem->min_restock_qty > 0 && (float) $stockItem->restock_price > 0) {
                $cost = ($quantityReceived / (float) $stockItem->min_restock_qty) * (float) $stockItem->restock_price;
            }

            $stockItem->update(['current_stock_biji' => $after]);

            $restockLog = RestockLog::create([
                'outlet_id' => $outletId,
                'stock_item_id' => $stockItem->id,
                'qty_added' => $quantityReceived,
                'stock_before' => $before,
                'stock_after' => $after,
                'note' => 'Penerimaan kiriman mitra'.$this->appendNote($note),
                'fund_source' => RestockLog::FUND_SOURCE_MITRA_DELIVERY,
                'restock_cost' => $cost,
                'created_at' => now(),
            ]);

            $matches = abs((float) $delivery->qty_sent - $quantityReceived) < 0.0001;
            $delivery->update([
                'qty_received' => $quantityReceived,
                'status' => $matches
                    ? MitraStockDelivery::STATUS_RECEIVED_MATCH
                    : MitraStockDelivery::STATUS_RECEIVED_DIFFERENCE,
                'receiver_note' => $note,
                'received_at' => now(),
                'received_by' => $receiver->id,
                'restock_log_id' => $restockLog->id,
            ]);

            return $delivery->fresh(['stockItem', 'mitra', 'receiver']);
        });
    }

    private function appendNote(?string $note): string
    {
        return $note ? " - {$note}" : '';
    }
}
