<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RestockLog extends Model
{
    use HasUlidPrimary;

    public const UPDATED_AT = null; // Only uses created_at

    protected $fillable = [
        'outlet_id', 'stock_item_id', 'qty_added', 'stock_before', 'stock_after', 'note', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'qty_added' => 'decimal:4',
            'stock_before' => 'decimal:4',
            'stock_after' => 'decimal:4',
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
}
