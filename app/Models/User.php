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
}
