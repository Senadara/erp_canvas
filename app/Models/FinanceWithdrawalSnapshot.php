<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinanceWithdrawalSnapshot extends Model
{
    use HasUlidPrimary;

    protected $fillable = [
        'outlet_id',
        'petty_cash_id',
        'period_start',
        'period_end',
        'withdrawal_amount',
        'withdrawal_method',
        'omzet_total',
        'cash_sales',
        'qris_sales',
        'hpp_total',
        'gross_profit',
        'expense_total',
        'cash_expense',
        'qris_expense',
        'outside_expense',
        'cashier_topups',
        'net_profit',
        'net_after_allocations',
        'cash_balance_before',
        'qris_balance_before',
        'available_before',
        'remaining_after',
        'transaction_count',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'datetime',
            'period_end' => 'datetime',
            'withdrawal_amount' => 'decimal:4',
            'omzet_total' => 'decimal:4',
            'cash_sales' => 'decimal:4',
            'qris_sales' => 'decimal:4',
            'hpp_total' => 'decimal:4',
            'gross_profit' => 'decimal:4',
            'expense_total' => 'decimal:4',
            'cash_expense' => 'decimal:4',
            'qris_expense' => 'decimal:4',
            'outside_expense' => 'decimal:4',
            'cashier_topups' => 'decimal:4',
            'net_profit' => 'decimal:4',
            'net_after_allocations' => 'decimal:4',
            'cash_balance_before' => 'decimal:4',
            'qris_balance_before' => 'decimal:4',
            'available_before' => 'decimal:4',
            'remaining_after' => 'decimal:4',
            'meta' => 'array',
        ];
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function withdrawal(): BelongsTo
    {
        return $this->belongsTo(PettyCash::class, 'petty_cash_id');
    }
}
