<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MitraSettlement extends Model
{
    use HasUlidPrimary;

    public const STATUS_PENDING = 'PENDING';
    public const STATUS_APPROVED = 'APPROVED';
    public const STATUS_REJECTED = 'REJECTED';
    public const STATUS_PAID = 'PAID';

    protected $fillable = [
        'outlet_id',
        'mitra_id',
        'period_start',
        'period_end',
        'calculation_method',
        'total_amount',
        'status',
        'validated_at',
        'validated_by',
        'validation_note',
        'paid_at',
        'paid_by',
        'receipt_data',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'datetime',
            'period_end' => 'datetime',
            'total_amount' => 'decimal:4',
            'receipt_data' => 'array',
            'validated_at' => 'datetime',
            'paid_at' => 'datetime',
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

    public function validator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'validated_by');
    }

    public function payer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }
}
