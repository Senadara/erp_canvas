<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Supplier extends Model
{
    use HasUlidPrimary;

    protected $fillable = [
        'name', 'phone', 'address',
    ];

    public function stockItems()
    {
        return $this->hasMany(StockItem::class);
    }
}
