<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PartnerProfile extends Model
{
    use HasUlidPrimary;

    protected $fillable = [
        'user_id',
        'default_salary',
        'is_active',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'default_salary' => 'decimal:4',
            'is_active' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
