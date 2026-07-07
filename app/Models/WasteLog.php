<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WasteLog extends Model
{
    use HasUlidPrimary;

    public const SOURCE_STOCK = 'STOCK';
    public const SOURCE_PRODUCT = 'PRODUCT';

    public const TYPE_EXPIRED = 'EXPIRED';
    public const TYPE_OWNER_REQUEST = 'OWNER_REQUEST';
    public const TYPE_DAMAGED = 'DAMAGED';
    public const TYPE_OTHER = 'OTHER';

    public const UPDATED_AT = null; // Only uses created_at

    protected $fillable = [
        'outlet_id', 'stock_item_id', 'source_type', 'product_id', 'product_name',
        'qty_biji', 'qty_porsi', 'reason', 'waste_type', 'loss_amount',
        'affects_mitra_settlement', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'qty_biji' => 'decimal:4',
            'qty_porsi' => 'decimal:4',
            'loss_amount' => 'decimal:4',
            'affects_mitra_settlement' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function stockItem(): BelongsTo
    {
        return $this->belongsTo(StockItem::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
