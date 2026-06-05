<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockItem extends Model
{
    use HasUlidPrimary;

    protected $table = 'stock_items';

    protected $fillable = [
        'outlet_id', 'name', 'current_stock_biji', 'unit_name', 'min_stock_alert',
        'supplier_id', 'trackable', 'counting_basis', 'display_group_id',
    ];

    protected function casts(): array
    {
        return [
            'trackable' => 'boolean',
            'current_stock_biji' => 'decimal:4',
            'min_stock_alert' => 'decimal:4',
        ];
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function displayGroup(): BelongsTo
    {
        return $this->belongsTo(DisplayGroup::class);
    }

    public function conversions(): HasMany
    {
        return $this->hasMany(Conversion::class);
    }

    public function restockLogs(): HasMany
    {
        return $this->hasMany(RestockLog::class);
    }

    public function wasteLogs(): HasMany
    {
        return $this->hasMany(WasteLog::class);
    }
}
