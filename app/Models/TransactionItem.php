<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TransactionItem extends Model
{
    use HasUlidPrimary;

    public $timestamps = false;

    protected $fillable = [
        'transaction_id', 'product_id', 'product_name', 'qty_porsi',
        'price_per_porsi', 'subtotal', 'note', 'hpp_per_porsi', 'hpp_total',
        'hpp_source', 'hpp_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'price_per_porsi' => 'decimal:4',
            'subtotal' => 'decimal:4',
            'hpp_per_porsi' => 'decimal:4',
            'hpp_total' => 'decimal:4',
            'hpp_snapshot' => 'array',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
