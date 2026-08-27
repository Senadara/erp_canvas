<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MitraStockUsageAdjustment extends Model
{
    use HasUlidPrimary;

    public const TYPE_MANUAL_USAGE = 'MANUAL_USAGE';
    public const TYPE_STOCK_OPNAME = 'STOCK_OPNAME';

    protected $fillable = [
        'outlet_id',
        'mitra_id',
        'stock_item_id',
        'warehouse_stock_item_id',
        'usage_type',
        'quantity',
        'note',
        'reported_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'reported_at' => 'datetime',
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

    public function warehouseStockItem(): BelongsTo
    {
        return $this->belongsTo(WarehouseStockItem::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
