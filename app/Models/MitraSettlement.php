<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MitraSettlement extends Model
{
    use HasUlidPrimary;

    protected $fillable = [
        'outlet_id',
        'mitra_id',
        'period_start',
        'period_end',
        'calculation_method',
        'total_amount',
        'status',
        'receipt_data',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'datetime',
            'period_end' => 'datetime',
            'total_amount' => 'decimal:4',
            'receipt_data' => 'array',
        ];
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function mitra(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mitra_id');
    }
}
