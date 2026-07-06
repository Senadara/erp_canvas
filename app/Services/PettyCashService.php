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
        $normalized = $this->normalizeCashMovement($data);

        return PettyCash::create([
            'outlet_id' => $data['outlet_id'],
            'amount' => $data['amount'],
            'category' => $normalized['category'],
            'payment_method' => $normalized['payment_method'],
            'cash_flow' => $normalized['cash_flow'],
            'description' => $data['description'] ?? null,
            'created_at' => $date,
        ]);
    }

    public function updateExpense(string $id, string $outletId, array $data, ?string $ownerId = null)
    {
        $expense = PettyCash::where('id', $id)->where('outlet_id', $outletId)->firstOrFail();
        $normalized = $this->normalizeCashMovement($data);
        
        $updateData = [
            'amount' => $data['amount'],
            'category' => $normalized['category'],
            'payment_method' => $normalized['payment_method'],
            'cash_flow' => $normalized['cash_flow'],
            'description' => $data['description'] ?? null,
        ];

        if (isset($data['date']) && !empty($data['date'])) {
            $updateData['created_at'] = Carbon::parse($data['date']);
        }
        if ($ownerId) {
            $updateData['edited_by_owner_at'] = Carbon::now();
            $updateData['edited_by_owner_id'] = $ownerId;
        }

        $expense->update($updateData);

        return $expense;
    }

    public function deleteExpense(string $id, string $outletId)
    {
        $expense = PettyCash::where('id', $id)->where('outlet_id', $outletId)->firstOrFail();
        return $expense->delete();
    }

    private function normalizeCashMovement(array $data): array
    {
        $category = $data['category'];
        $paymentMethod = $data['payment_method'] ?? 'CASH';
        $cashFlow = $data['cash_flow'] ?? 'OUT';

        if (in_array($category, ['Tambah Modal', 'Tambah Kas'], true)) {
            $category = 'Tambah Kas';
            $cashFlow = 'OUT';
            $paymentMethod = 'CASH';
        }

        if ($category === 'Penarikan') {
            $cashFlow = 'OUT';
        }

        return [
            'category' => $category,
            'payment_method' => $paymentMethod === 'QRIS' ? 'QRIS' : 'CASH',
            'cash_flow' => $cashFlow === 'IN' ? 'IN' : 'OUT',
        ];
    }
}
