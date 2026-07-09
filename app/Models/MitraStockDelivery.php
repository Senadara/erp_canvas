<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MitraStockDelivery extends Model
{
    use HasUlidPrimary;

    public const STATUS_SENT = 'SENT';
    public const STATUS_RECEIVED_MATCH = 'RECEIVED_MATCH';
    public const STATUS_RECEIVED_DIFFERENCE = 'RECEIVED_DIFFERENCE';

    protected $fillable = [
        'outlet_id',
        'mitra_id',
        'stock_item_id',
        'qty_sent',
        'qty_received',
        'status',
        'sender_note',
        'receiver_note',
        'sent_at',
        'received_at',
        'received_by',
        'restock_log_id',
    ];

    protected function casts(): array
    {
        return [
            'qty_sent' => 'decimal:4',
            'qty_received' => 'decimal:4',
            'sent_at' => 'datetime',
            'received_at' => 'datetime',
        ];
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function mitra(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mitra_id');
    }

    public function stockItem(): BelongsTo
    {
        return $this->belongsTo(StockItem::class);
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function restockLog(): BelongsTo
    {
        return $this->belongsTo(RestockLog::class);
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_SENT;
    }
}
