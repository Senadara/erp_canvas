<?php

namespace App\Services;

use App\Models\PettyCash;
use Carbon\Carbon;

class PettyCashService
{
    private const BUSINESS_TIMEZONE = 'Asia/Jakarta';
    public const OWNER_DISTRIBUTION_CATEGORY = 'Distribusi Owner';

    public const DEFAULT_CATEGORIES = [
        'Operasional',
        'Bahan Baku',
        'RESTOCK',
        'Gaji',
        'Listrik/Air',
        'Sewa',
        'Internet/Telepon',
        'Transportasi',
        'Peralatan',
        'Maintenance',
        'Kebersihan',
        'Marketing',
        'Pajak/Retribusi',
        'Kasbon',
        'Tambah Kas',
        'Penarikan',
        self::OWNER_DISTRIBUTION_CATEGORY,
        'Lainnya',
    ];

    private const CASHIER_FUND_CATEGORIES = ['Tambah Modal', 'Tambah Kas'];

    private const WITHDRAWAL_CATEGORY = 'Penarikan';

    public function listExpenses(
        string $outletId,
        ?string $category = null,
        ?int $limit = 100,
        ?Carbon $startDate = null,
        ?Carbon $endDate = null
    ) {
        $query = PettyCash::where('outlet_id', $outletId)
            ->orderByDesc('created_at');

        if ($category !== null && $category !== '') {
            $query->whereRaw('LOWER(category) = ?', [strtolower($category)]);
        }

        $this->applyDateRange($query, $startDate, $endDate);

        if ($limit !== null) {
            $query->take($limit);
        }

        return $query->get();
    }

    public function listCategories(string $outletId): array
    {
        $storedCategories = PettyCash::where('outlet_id', $outletId)
            ->whereNotNull('category')
            ->distinct()
            ->pluck('category')
            ->all();

        return $this->sortCategories([
            ...self::DEFAULT_CATEGORIES,
            ...$storedCategories,
        ]);
    }

    public function summarizeCategories(string $outletId, ?Carbon $startDate = null, ?Carbon $endDate = null): array
    {
        $summaries = [];

        foreach ($this->listCategories($outletId) as $category) {
            $summaries[$category] = $this->emptyCategorySummary($category);
        }

        $categoryLookup = [];
        foreach (array_keys($summaries) as $category) {
            $categoryLookup[strtolower($category)] = $category;
        }

        $this->applyDateRange(PettyCash::where('outlet_id', $outletId), $startDate, $endDate)
            ->get(['category', 'amount', 'cash_flow', 'payment_method'])
            ->each(function (PettyCash $movement) use (&$summaries, &$categoryLookup) {
                $category = trim((string) $movement->category);
                if ($category === '') {
                    $category = 'Lainnya';
                }

                $categoryKey = strtolower($category);
                $category = $categoryLookup[$categoryKey] ?? $category;

                if (! isset($summaries[$category])) {
                    $summaries[$category] = $this->emptyCategorySummary($category);
                    $categoryLookup[$categoryKey] = $category;
                }

                $amount = (float) $movement->amount;
                $cashFlow = $movement->cash_flow === 'IN' ? 'IN' : 'OUT';
                $isPrivateMoney = strtoupper((string) $movement->payment_method) === 'PRIVATE';

                $summaries[$category]['movement_count']++;

                if ($cashFlow === 'IN') {
                    $summaries[$category]['incoming_total'] += $amount;

                    return;
                }

                $summaries[$category]['outgoing_total'] += $amount;
                $summaries[$category]['outgoing_count']++;

                if ($isPrivateMoney) {
                    $summaries[$category]['private_total'] += $amount;
                    $summaries[$category]['private_count']++;
                }

                if ($this->isOperatingExpenseCategory($category)) {
                    $summaries[$category]['expense_total'] += $amount;
                    $summaries[$category]['expense_count']++;

                    if (! $isPrivateMoney) {
                        $summaries[$category]['cashier_expense_total'] += $amount;
                    }
                }
            });

        return array_values($summaries);
    }

    public function createExpense(array $data)
    {
        $date = $this->movementDate($data['date'] ?? null);
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

        if (isset($data['date']) && ! empty($data['date'])) {
            $updateData['created_at'] = $this->movementDate($data['date']);
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
        $category = trim((string) ($data['category'] ?? ''));
        if ($category === '') {
            $category = 'Lainnya';
        }

        $paymentMethod = strtoupper((string) ($data['payment_method'] ?? 'CASH'));
        $cashFlow = $data['cash_flow'] ?? 'OUT';

        if ($this->isCashierFundCategory($category)) {
            $category = 'Tambah Kas';
            $cashFlow = 'IN';
            $paymentMethod = $paymentMethod === 'PRIVATE' ? 'PRIVATE' : 'CASH';
        }

        if (in_array($category, [self::WITHDRAWAL_CATEGORY, self::OWNER_DISTRIBUTION_CATEGORY], true)) {
            $cashFlow = 'OUT';
        }

        return [
            'category' => $category,
            'payment_method' => in_array($paymentMethod, ['CASH', 'QRIS', 'PRIVATE'], true) ? $paymentMethod : 'CASH',
            'cash_flow' => $cashFlow === 'IN' ? 'IN' : 'OUT',
        ];
    }

    private function movementDate(mixed $value = null): Carbon
    {
        $timezone = config('app.timezone') ?: 'UTC';

        if ($value instanceof Carbon) {
            return $value->copy()->setTimezone($timezone);
        }

        if ($value instanceof \DateTimeInterface) {
            return Carbon::instance($value)->setTimezone($timezone);
        }

        if ($value !== null && $value !== '') {
            return Carbon::parse($value, self::BUSINESS_TIMEZONE)->setTimezone($timezone);
        }

        return Carbon::now($timezone);
    }

    private function emptyCategorySummary(string $category): array
    {
        return [
            'category' => $category,
            'movement_count' => 0,
            'expense_count' => 0,
            'outgoing_count' => 0,
            'private_count' => 0,
            'expense_total' => 0.0,
            'cashier_expense_total' => 0.0,
            'private_total' => 0.0,
            'outgoing_total' => 0.0,
            'incoming_total' => 0.0,
        ];
    }

    private function applyDateRange($query, ?Carbon $startDate, ?Carbon $endDate)
    {
        if ($startDate) {
            $query->where('created_at', '>=', $startDate);
        }

        if ($endDate) {
            $query->where('created_at', '<=', $endDate);
        }

        return $query;
    }

    private function sortCategories(array $categories): array
    {
        $defaultOrder = array_flip(self::DEFAULT_CATEGORIES);
        $cleanCategories = [];
        $seen = [];

        foreach ($categories as $category) {
            $category = trim((string) $category);
            if ($category === '') {
                continue;
            }

            $key = strtolower($category);
            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $cleanCategories[] = $category;
        }

        usort($cleanCategories, function (string $a, string $b) use ($defaultOrder) {
            $aRank = $defaultOrder[$a] ?? PHP_INT_MAX;
            $bRank = $defaultOrder[$b] ?? PHP_INT_MAX;

            if ($aRank !== $bRank) {
                return $aRank <=> $bRank;
            }

            return strcasecmp($a, $b);
        });

        return $cleanCategories;
    }

    private function isCashierFundCategory(string $category): bool
    {
        return in_array($category, self::CASHIER_FUND_CATEGORIES, true);
    }

    private function isOperatingExpenseCategory(string $category): bool
    {
        return ! $this->isCashierFundCategory($category)
            && $category !== self::WITHDRAWAL_CATEGORY
            && $category !== self::OWNER_DISTRIBUTION_CATEGORY;
    }
}
