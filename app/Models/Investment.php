<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Investment extends Model
{
    use HasUlidPrimary;

    protected $fillable = [
        'outlet_id', 'user_id', 'lots', 'lot_value', 'total_value', 'status', 'note', 'approved_at'
    ];

    protected function casts(): array
    {
        return [
            'approved_at' => 'datetime',
            'lot_value' => 'decimal:4',
            'total_value' => 'decimal:4',
        ];
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
