<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OwnerFinanceBatch extends Model
{
    use HasUlidPrimary;

    public const STATUS_DRAFT = 'DRAFT';
    public const STATUS_POSTED = 'POSTED';
    public const STATUS_VOID = 'VOID';

    protected $fillable = [
        'outlet_id',
        'period_start',
        'period_end',
        'status',
        'payout_method',
        'total_salary',
        'total_dividend',
        'total_loan_repayment',
        'total_payout',
        'retained_amount',
        'summary_snapshot',
        'note',
        'created_by',
        'posted_by',
        'posted_at',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'datetime',
            'period_end' => 'datetime',
            'posted_at' => 'datetime',
            'total_salary' => 'decimal:4',
            'total_dividend' => 'decimal:4',
            'total_loan_repayment' => 'decimal:4',
            'total_payout' => 'decimal:4',
            'retained_amount' => 'decimal:4',
            'summary_snapshot' => 'array',
        ];
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function poster(): BelongsTo
    {
        return $this->belongsTo(User::class, 'posted_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OwnerFinanceItem::class, 'owner_finance_batch_id');
    }
}
