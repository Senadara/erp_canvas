<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;

class TransactionItem extends Model
{
    use HasUlidPrimary;

    public $timestamps = false;

    protected $fillable = [
        'transaction_id', 'product_id', 'product_name', 'qty_porsi',
        'price_per_porsi', 'subtotal', 'note',
    ];

    protected function casts(): array
    {
        return [
            'price_per_porsi' => 'decimal:4',
            'subtotal' => 'decimal:4',
        ];
    }
}
