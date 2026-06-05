<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use HasUlidPrimary;

    protected $fillable = [
        'outlet_id', 'name', 'category', 'price', 'hpp', 'image_url', 'is_active', 'display_group_id',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'price' => 'decimal:4', 'hpp' => 'decimal:4'];
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function conversions(): HasMany
    {
        return $this->hasMany(Conversion::class);
    }

    public function displayGroup(): BelongsTo
    {
        return $this->belongsTo(DisplayGroup::class);
    }
}
