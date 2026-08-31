<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PartnerCapitalLoan extends Model
{
    use HasUlidPrimary;

    public const STATUS_ACTIVE = 'ACTIVE';
    public const STATUS_PAID = 'PAID';
    public const STATUS_CANCELED = 'CANCELED';

    protected $fillable = [
        'borrower_user_id',
        'lender_user_id',
        'investment_id',
        'principal_amount',
        'remaining_amount',
        'status',
        'note',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'principal_amount' => 'decimal:4',
            'remaining_amount' => 'decimal:4',
        ];
    }

    public function borrower(): BelongsTo
    {
        return $this->belongsTo(User::class, 'borrower_user_id');
    }

    public function lender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'lender_user_id');
    }

    public function investment(): BelongsTo
    {
        return $this->belongsTo(Investment::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function financeItems(): HasMany
    {
        return $this->hasMany(OwnerFinanceItem::class, 'partner_capital_loan_id');
    }
}
