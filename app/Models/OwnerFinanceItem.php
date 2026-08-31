<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OwnerFinanceItem extends Model
{
    use HasUlidPrimary;

    public const TYPE_SALARY = 'SALARY';
    public const TYPE_DIVIDEND = 'DIVIDEND';
    public const TYPE_LOAN_REPAYMENT = 'LOAN_REPAYMENT';
    public const TYPE_RETAINED = 'RETAINED';

    protected $fillable = [
        'owner_finance_batch_id',
        'source_user_id',
        'recipient_user_id',
        'partner_capital_loan_id',
        'petty_cash_id',
        'type',
        'payment_method',
        'amount',
        'note',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:4',
            'meta' => 'array',
        ];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(OwnerFinanceBatch::class, 'owner_finance_batch_id');
    }

    public function sourceUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'source_user_id');
    }

    public function recipientUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_user_id');
    }

    public function loan(): BelongsTo
    {
        return $this->belongsTo(PartnerCapitalLoan::class, 'partner_capital_loan_id');
    }

    public function pettyCash(): BelongsTo
    {
        return $this->belongsTo(PettyCash::class);
    }
}
