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
        'outlet_id', 'name', 'opened_by', 'closed_by', 'opened_at', 'closed_at', 'opening_cash', 'expected_cash', 'actual_cash',
        'expected_qris', 'discrepancy', 'total_sales_cash', 'total_sales_qris', 'total_expenses',
        'note', 'edited_by_owner_at', 'edited_by_owner_id', 'status',
    ];

    protected function casts(): array
    {
        return [
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
            'opening_cash' => 'decimal:4',
            'expected_cash' => 'decimal:4',
            'expected_qris' => 'decimal:4',
            'actual_cash' => 'decimal:4',
            'discrepancy' => 'decimal:4',
            'total_sales_cash' => 'decimal:4',
            'total_sales_qris' => 'decimal:4',
            'total_expenses' => 'decimal:4',
            'edited_by_owner_at' => 'datetime',
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

    public function opener(): BelongsTo
    {
        return $this->belongsTo(User::class, 'opened_by');
    }

    public function closer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }
}
