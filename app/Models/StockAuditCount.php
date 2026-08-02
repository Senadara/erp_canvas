<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockAuditCount extends Model
{
    use HasUlidPrimary;

    protected $fillable = [
        'outlet_id',
        'stock_item_id',
        'counted_stock',
        'system_stock',
        'difference',
        'counted_at',
        'counted_by',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'counted_stock' => 'decimal:4',
            'system_stock' => 'decimal:4',
            'difference' => 'decimal:4',
            'counted_at' => 'datetime',
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

    public function counter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'counted_by');
    }
}
