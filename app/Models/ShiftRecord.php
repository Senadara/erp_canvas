<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShiftRecord extends Model
{
    use HasUlidPrimary;

    protected $table = 'shift_records';

    public $timestamps = false;

    protected $fillable = [
        'outlet_id', 'name', 'opened_at', 'closed_at', 'opening_cash', 'expected_cash', 'actual_cash',
        'discrepancy', 'total_sales_cash', 'total_sales_qris', 'total_expenses', 'note', 'status',
    ];

    protected function casts(): array
    {
        return [
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
            'opening_cash' => 'decimal:4',
            'expected_cash' => 'decimal:4',
            'actual_cash' => 'decimal:4',
            'discrepancy' => 'decimal:4',
            'total_sales_cash' => 'decimal:4',
            'total_sales_qris' => 'decimal:4',
            'total_expenses' => 'decimal:4',
        ];
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function transactions()
    {
        return $this->hasMany(Transaction::class, 'shift_id');
    }
}
