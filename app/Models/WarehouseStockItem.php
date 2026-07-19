<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WarehouseStockItem extends Model
{
    use HasUlidPrimary;

    protected $fillable = [
        'warehouse_id',
        'mitra_id',
        'name',
        'normalized_name',
        'unit_name',
        'current_stock',
        'min_stock_alert',
        'min_restock_qty',
        'restock_price',
    ];

    protected function casts(): array
    {
        return [
            'current_stock' => 'decimal:4',
            'min_stock_alert' => 'decimal:4',
            'min_restock_qty' => 'decimal:4',
            'restock_price' => 'decimal:4',
        ];
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function mitra(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mitra_id');
    }

    public function outletStockItems(): HasMany
    {
        return $this->hasMany(StockItem::class);
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(MitraStockDelivery::class);
    }

    public function transfers(): HasMany
    {
        return $this->hasMany(WarehouseStockTransfer::class);
    }
}
