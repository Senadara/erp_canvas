<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Supplier extends Model
{
    use HasUlidPrimary;

    protected $fillable = [
        'name', 'phone', 'address',
    ];

    public function stockItems(): HasMany
    {
        return $this->hasMany(StockItem::class);
    }

    public function mitraUsers(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
