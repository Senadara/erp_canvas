<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TransactionStockMovement extends Model
{
    use HasUlidPrimary;

    public $timestamps = false;

    protected $fillable = [
        'outlet_id',
        'transaction_id',
        'stock_item_id',
        'qty',
        'type',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'decimal:4',
            'created_at' => 'datetime',
        ];
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    public function stockItem(): BelongsTo
    {
        return $this->belongsTo(StockItem::class);
    }
}
