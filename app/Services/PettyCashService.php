<?php

namespace App\Services;

use App\Models\PettyCash;
use Carbon\Carbon;

class PettyCashService
{
    public function listExpenses(string $outletId, int $limit = 100)
    {
        return PettyCash::where('outlet_id', $outletId)
            ->orderByDesc('created_at')
            ->take($limit)
            ->get();
    }

    public function createExpense(array $data)
    {
        $date = isset($data['date']) && !empty($data['date']) 
            ? Carbon::parse($data['date']) 
            : Carbon::now();

        return PettyCash::create([
            'outlet_id' => $data['outlet_id'],
            'amount' => $data['amount'],
            'category' => $data['category'],
            'description' => $data['description'] ?? null,
            'created_at' => $date,
        ]);
    }

    public function updateExpense(string $id, string $outletId, array $data)
    {
        $expense = PettyCash::where('id', $id)->where('outlet_id', $outletId)->firstOrFail();
        
        $updateData = [
            'amount' => $data['amount'],
            'category' => $data['category'],
            'description' => $data['description'] ?? null,
        ];

        if (isset($data['date']) && !empty($data['date'])) {
            $updateData['created_at'] = Carbon::parse($data['date']);
        }

        $expense->update($updateData);

        return $expense;
    }

    public function deleteExpense(string $id, string $outletId)
    {
        $expense = PettyCash::where('id', $id)->where('outlet_id', $outletId)->firstOrFail();
        return $expense->delete();
    }
}
