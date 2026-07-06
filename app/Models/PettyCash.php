<?php

namespace App\Models;

use App\Models\Concerns\HasUlidPrimary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PettyCash extends Model
{
    use HasUlidPrimary;

    protected $table = 'petty_cash';
    public $timestamps = false; // Only has created_at

    protected $fillable = [
        'outlet_id', 'amount', 'category', 'payment_method', 'cash_flow', 'description',
        'created_at', 'edited_by_owner_at', 'edited_by_owner_id',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:4',
            'created_at' => 'datetime',
            'edited_by_owner_at' => 'datetime',
        ];
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }
}
