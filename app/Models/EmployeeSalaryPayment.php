<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeSalaryPayment extends Model
{
    use HasUlidPrimary;

    protected $fillable = [
        'employee_id',
        'employee_name',
        'period_start',
        'period_end',
        'salary_type',
        'daily_rate',
        'payable_days',
        'monthly_amount',
        'work_days',
        'shift_count',
        'total_minutes',
        'average_minutes',
        'longest_shift_minutes',
        'shortest_shift_minutes',
        'base_amount',
        'bonus_amount',
        'deduction_amount',
        'total_amount',
        'note',
        'shift_snapshot',
        'paid_at',
        'paid_by',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'datetime',
            'period_end' => 'datetime',
            'daily_rate' => 'decimal:4',
            'payable_days' => 'integer',
            'monthly_amount' => 'decimal:4',
            'work_days' => 'integer',
            'shift_count' => 'integer',
            'total_minutes' => 'integer',
            'average_minutes' => 'integer',
            'longest_shift_minutes' => 'integer',
            'shortest_shift_minutes' => 'integer',
            'base_amount' => 'decimal:4',
            'bonus_amount' => 'decimal:4',
            'deduction_amount' => 'decimal:4',
            'total_amount' => 'decimal:4',
            'shift_snapshot' => 'array',
            'paid_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'employee_id');
    }

    public function payer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }
}
