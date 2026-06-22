<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Transaction extends Model
{
    use HasUlidPrimary;

    public $timestamps = false;

    protected $fillable = [
        'outlet_id', 'shift_id', 'invoice_number', 'total_amount', 'payment_method',
        'cash_received', 'change_amount', 'note', 'payment_status', 'paid_at', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'paid_at' => 'datetime',
            'total_amount' => 'decimal:4',
            'cash_received' => 'decimal:4',
            'change_amount' => 'decimal:4',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(TransactionItem::class);
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(ShiftRecord::class, 'shift_id');
    }
}
