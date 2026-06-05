<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;

class Conversion extends Model
{
    use HasUlidPrimary;

    public $timestamps = false;

    protected $fillable = ['product_id', 'stock_item_id', 'ratio'];

    protected function casts(): array
    {
        return ['ratio' => 'decimal:4'];
    }

    public function product(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function stockItem(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(StockItem::class);
    }
}
