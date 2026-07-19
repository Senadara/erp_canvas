<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WarehouseStockTransfer extends Model
{
    use HasUlidPrimary;

    public const UPDATED_AT = null;

    protected $fillable = [
        'warehouse_id',
        'warehouse_stock_item_id',
        'outlet_id',
        'stock_item_id',
        'quantity',
        'warehouse_stock_before',
        'warehouse_stock_after',
        'outlet_stock_before',
        'outlet_stock_after',
        'note',
        'transferred_by',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'warehouse_stock_before' => 'decimal:4',
            'warehouse_stock_after' => 'decimal:4',
            'outlet_stock_before' => 'decimal:4',
            'outlet_stock_after' => 'decimal:4',
            'created_at' => 'datetime',
        ];
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function warehouseStockItem(): BelongsTo
    {
        return $this->belongsTo(WarehouseStockItem::class);
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function stockItem(): BelongsTo
    {
        return $this->belongsTo(StockItem::class);
    }

    public function transferredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'transferred_by');
    }
}
