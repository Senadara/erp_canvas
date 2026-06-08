<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Outlet extends Model
{
    use HasUlidPrimary;

    protected $fillable = ['name', 'address', 'phone', 'logo'];

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_outlets');
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function stockItems(): HasMany
    {
        return $this->hasMany(StockItem::class);
    }
}
