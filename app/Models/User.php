<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasUlidPrimary, Notifiable;

    protected $fillable = [
        'email',
        'password_hash',
        'display_name',
        'role',
        'is_active',
        'feature_overrides',
        'mitra_can_view_sales',
    ];

    protected $hidden = [
        'password_hash',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'feature_overrides' => 'array',
            'mitra_can_view_sales' => 'boolean',
        ];
    }

    public function getAuthPassword(): string
    {
        return $this->password_hash;
    }

    public function outlets(): BelongsToMany
    {
        return $this->belongsToMany(Outlet::class, 'user_outlets');
    }

    public function mitraProducts(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'mitra_product_scopes');
    }

    public function mitraStockItems(): BelongsToMany
    {
        return $this->belongsToMany(StockItem::class, 'mitra_stock_scopes')
                    ->withPivot('price');
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(UserActivityLog::class);
    }

    public function isOwner(): bool
    {
        return $this->role === 'OWNER';
    }

    public function isMitra(): bool
    {
        return $this->role === 'MITRA';
    }

    /**
     * Get the product IDs this mitra is scoped to.
     */
    public function getMitraProductIds(): array
    {
        if (!$this->isMitra()) return [];
        return $this->mitraProducts()->pluck('products.id')->toArray();
    }

    /**
     * Get the stock item IDs this mitra is scoped to.
     */
    public function getMitraStockIds(): array
    {
        if (!$this->isMitra()) return [];
        return $this->mitraStockItems()->pluck('stock_items.id')->toArray();
    }
}
