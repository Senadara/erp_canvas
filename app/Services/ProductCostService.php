<?php

namespace App\Services;

use App\Models\Conversion;
use App\Models\EmployeeSalaryPayment;
use App\Models\Product;
use App\Models\ShiftRecord;
use App\Models\StockItem;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ProductCostService
{
    public const CATEGORY_MATERIAL = 'MATERIAL';
    public const CATEGORY_PACKAGING = 'PACKAGING';
    public const CATEGORY_SUPPLY = 'SUPPLY';

    public const SOURCE_BOM_LATEST = 'BOM_LATEST';
    public const SOURCE_MANUAL_FALLBACK = 'MANUAL_FALLBACK';
    public const SOURCE_LEGACY_MANUAL = 'LEGACY_MANUAL';
    public const SOURCE_FIXED_MANUAL = 'FIXED_MANUAL';

    public const HPP_MODE_AUTO = 'AUTO';
    public const HPP_MODE_FIXED = 'FIXED';

    public function __construct(private ConversionOutletResolver $conversionOutletResolver) {}

    public function stockUnitCost(?StockItem $stockItem): float
    {
        $minQty = (float) ($stockItem?->min_restock_qty ?? 0);
        $price = (float) ($stockItem?->restock_price ?? 0);

        if ($minQty <= 0 || $price <= 0) {
            return 0.0;
        }

        return $price / $minQty;
    }

    public function calculateProduct(Product $product, ?string $outletId = null, bool $strictOutlet = false): array
    {
        if (! $product->relationLoaded('conversions')) {
            $product->load('conversions.stockItem');
        }

        $components = $this->resolvedConversions($product, $outletId, $strictOutlet)
            ->map(function (Conversion $conversion) {
                $stockItem = $conversion->stockItem;
                $category = strtoupper((string) ($stockItem?->cost_category ?: self::CATEGORY_MATERIAL));
                $ratio = (float) $conversion->ratio;
                $unitCost = $this->stockUnitCost($stockItem);
                $componentCost = $ratio * $unitCost;

                return [
                    'conversion_id' => $conversion->id,
                    'stock_item_id' => $stockItem?->id,
                    'name' => $stockItem?->name ?? 'Bahan tidak ditemukan',
                    'cost_category' => $category,
                    'ratio' => $ratio,
                    'unit_name' => $stockItem?->unit_name,
                    'unit_cost' => round($unitCost, 4),
                    'component_cost' => round($componentCost, 4),
                    'trackable' => (bool) ($stockItem?->trackable ?? false),
                    'has_price' => $unitCost > 0,
                ];
            })
            ->values();

        $manualHpp = (float) $product->hpp;
        $materialHpp = (float) $components->sum('component_cost');
        $hasBom = $components->isNotEmpty();
        $hppMode = strtoupper((string) ($product->hpp_mode ?: self::HPP_MODE_AUTO));
        $usesFixedHpp = $hppMode === self::HPP_MODE_FIXED;
        $effectiveHpp = $usesFixedHpp ? $manualHpp : ($hasBom ? $materialHpp : $manualHpp);
        $source = match (true) {
            $usesFixedHpp => self::SOURCE_FIXED_MANUAL,
            $hasBom => self::SOURCE_BOM_LATEST,
            default => self::SOURCE_MANUAL_FALLBACK,
        };
        $price = (float) $product->price;
        $warnings = $usesFixedHpp ? [] : $this->costWarnings($components);
        $marginAmount = $price - $effectiveHpp;

        return [
            'product_id' => $product->id,
            'product_name' => $product->name,
            'hpp_mode' => $usesFixedHpp ? self::HPP_MODE_FIXED : self::HPP_MODE_AUTO,
            'uses_fixed_hpp' => $usesFixedHpp,
            'material_hpp' => round($materialHpp, 4),
            'manual_hpp' => round($manualHpp, 4),
            'effective_hpp' => round($effectiveHpp, 4),
            'hpp_source' => $source,
            'margin_amount' => round($marginAmount, 4),
            'margin_percent' => $price > 0 ? round(($marginAmount / $price) * 100, 2) : 0.0,
            'cost_warnings' => $warnings,
            'formula_status' => empty($warnings) ? 'COMPLETE' : 'NEEDS_ATTENTION',
            'components' => $components->all(),
        ];
    }

    public function snapshotForSale(Product $product, string $outletId, float $quantity): array
    {
        $cost = $this->calculateProduct($product, $outletId, true);
        $hppPerPorsi = (float) $cost['effective_hpp'];
        $hppTotal = $hppPerPorsi * $quantity;

        return [
            'hpp_per_porsi' => round($hppPerPorsi, 4),
            'hpp_total' => round($hppTotal, 4),
            'hpp_source' => $cost['hpp_source'],
            'hpp_snapshot' => [
                'source' => $cost['hpp_source'],
                'pricing_method' => $cost['hpp_source'] === self::SOURCE_FIXED_MANUAL
                    ? 'FIXED_PRODUCT_HPP'
                    : 'LATEST_STOCK_MASTER',
                'calculated_at' => now()->toIso8601String(),
                'product_id' => $product->id,
                'product_name' => $product->name,
                'quantity' => $quantity,
                'sale_price' => (float) $product->price,
                'hpp_mode' => $cost['hpp_mode'],
                'material_hpp' => $cost['material_hpp'],
                'manual_hpp' => $cost['manual_hpp'],
                'effective_hpp' => $cost['effective_hpp'],
                'cost_warnings' => $cost['cost_warnings'],
                'components' => $cost['components'],
            ],
        ];
    }

    public function itemHppTotal(TransactionItem $item): float
    {
        if ($item->hpp_source || $item->hpp_total !== null) {
            return (float) $item->hpp_total;
        }

        return (float) ($item->product?->hpp ?? 0) * (float) $item->qty_porsi;
    }

    public function bulkUpsertComponents(string $outletId, string $stockItemId, array $productIds, float $ratio): int
    {
        $rows = collect($productIds)
            ->filter()
            ->unique()
            ->map(fn (string $productId) => [
                'product_id' => $productId,
                'stock_item_id' => $stockItemId,
                'ratio' => $ratio,
            ])
            ->values()
            ->all();

        return $this->bulkUpsertComponentRows($outletId, $rows);
    }

    public function bulkUpsertComponentRows(string $outletId, array $rows): int
    {
        $rows = collect($rows)
            ->filter(fn (array $row) => ! empty($row['product_id']) && ! empty($row['stock_item_id']) && (float) ($row['ratio'] ?? 0) > 0)
            ->values();

        if ($rows->isEmpty()) {
            return 0;
        }

        $productIds = $rows->pluck('product_id')->unique()->values();
        $stockItemIds = $rows->pluck('stock_item_id')->unique()->values();
        $validProductIds = Product::where('outlet_id', $outletId)
            ->whereIn('id', $productIds)
            ->pluck('id')
            ->all();
        $validStockItemIds = StockItem::where('outlet_id', $outletId)
            ->whereIn('id', $stockItemIds)
            ->pluck('id')
            ->all();

        $missingProductIds = $productIds->diff($validProductIds);
        $missingStockItemIds = $stockItemIds->diff($validStockItemIds);
        if ($missingProductIds->isNotEmpty() || $missingStockItemIds->isNotEmpty()) {
            throw new \InvalidArgumentException('Produk atau stok komponen tidak valid untuk outlet ini.');
        }

        return DB::transaction(function () use ($rows) {
            $count = 0;
            foreach ($rows as $row) {
                Conversion::updateOrCreate(
                    [
                        'product_id' => $row['product_id'],
                        'stock_item_id' => $row['stock_item_id'],
                    ],
                    ['ratio' => (float) $row['ratio']]
                );
                $count++;
            }

            return $count;
        });
    }

    public function dashboardData(string $outletId, Carbon $startDate, Carbon $endDate, ?float $customSalaryTotal = null): array
    {
        $products = Product::with([
            'displayGroup:id,name,sort_order',
            'conversions.stockItem:id,outlet_id,name,unit_name,trackable,counting_basis,min_restock_qty,restock_price,cost_category',
        ])
            ->where('outlet_id', $outletId)
            ->orderBy('name')
            ->get();

        $productRows = $products
            ->map(function (Product $product) use ($outletId) {
                $cost = $this->calculateProduct($product, $outletId);

                return [
                    'id' => $product->id,
                    'name' => $product->name,
                    'category' => $product->category,
                    'price' => (float) $product->price,
                    'is_active' => (bool) $product->is_active,
                    'display_group' => $product->displayGroup ? [
                        'id' => $product->displayGroup->id,
                        'name' => $product->displayGroup->name,
                    ] : null,
                    ...$cost,
                ];
            })
            ->values();

        $componentStocks = StockItem::where('outlet_id', $outletId)
            ->whereIn('cost_category', [self::CATEGORY_MATERIAL, self::CATEGORY_PACKAGING, self::CATEGORY_SUPPLY])
            ->orderBy('name')
            ->get(['id', 'name', 'unit_name', 'min_restock_qty', 'restock_price', 'current_stock_biji', 'trackable', 'cost_category'])
            ->map(fn (StockItem $stockItem) => [
                'id' => $stockItem->id,
                'name' => $stockItem->name,
                'cost_category' => $stockItem->cost_category ?: self::CATEGORY_MATERIAL,
                'unit_name' => $stockItem->unit_name,
                'unit_cost' => round($this->stockUnitCost($stockItem), 4),
                'min_restock_qty' => (float) $stockItem->min_restock_qty,
                'restock_price' => (float) $stockItem->restock_price,
                'current_stock_biji' => (float) $stockItem->current_stock_biji,
                'trackable' => (bool) $stockItem->trackable,
            ])
            ->values();
        $packagingStocks = $componentStocks
            ->filter(fn (array $stock) => $stock['cost_category'] === self::CATEGORY_PACKAGING)
            ->values();

        return [
            'summary' => [
                'product_count' => $productRows->count(),
                'active_count' => $productRows->where('is_active', true)->count(),
                'needs_attention_count' => $productRows->filter(fn (array $row) => ! empty($row['cost_warnings']))->count(),
                'without_packaging_count' => $productRows->filter(fn (array $row) => in_array('Kemasan belum masuk ke BOM', $row['cost_warnings'], true))->count(),
                'average_margin_percent' => $productRows->count() > 0 ? round($productRows->avg('margin_percent'), 2) : 0.0,
            ],
            'products' => $productRows->all(),
            'packaging_stocks' => $packagingStocks->all(),
            'component_stocks' => $componentStocks->all(),
            'payroll_evaluation' => $this->payrollEvaluation($outletId, $startDate, $endDate, $customSalaryTotal),
        ];
    }

    private function resolvedConversions(Product $product, ?string $outletId, bool $strictOutlet): Collection
    {
        return $product->conversions
            ->map(function (Conversion $conversion) use ($outletId, $product, $strictOutlet) {
                if (! $outletId) {
                    return $conversion->stockItem ? $conversion : null;
                }

                return $strictOutlet
                    ? $this->conversionOutletResolver->resolveForSale($conversion, $outletId, $product->name)
                    : $this->conversionOutletResolver->repairForListing($conversion, $outletId);
            })
            ->filter()
            ->values();
    }

    private function costWarnings(Collection $components): array
    {
        $warnings = [];

        if ($components->isEmpty()) {
            $warnings[] = 'BOM belum diisi';

            return $warnings;
        }

        if ($components->contains(fn (array $component) => ! $component['has_price'])) {
            $warnings[] = 'Harga bahan belum lengkap';
        }

        if (! $components->contains(fn (array $component) => $component['cost_category'] === self::CATEGORY_PACKAGING)) {
            $warnings[] = 'Kemasan belum masuk ke BOM';
        }

        return $warnings;
    }

    private function payrollEvaluation(string $outletId, Carbon $startDate, Carbon $endDate, ?float $customSalaryTotal = null): array
    {
        $employeeIds = ShiftRecord::where('outlet_id', $outletId)
            ->whereNotNull('opened_by')
            ->where('opened_at', '<=', $endDate)
            ->where(function ($query) use ($startDate) {
                $query->whereNull('closed_at')
                    ->orWhere('closed_at', '>=', $startDate);
            })
            ->pluck('opened_by')
            ->filter()
            ->unique()
            ->values();

        $recordedSalaryTotal = 0.0;
        if ($employeeIds->isNotEmpty()) {
            $salaryPayments = EmployeeSalaryPayment::whereIn('employee_id', $employeeIds)
                ->where('period_start', '<=', $endDate)
                ->where('period_end', '>=', $startDate)
                ->get();
            $recordedSalaryTotal = $this->allocatedSalaryTotal($salaryPayments, $startDate, $endDate);
        }

        $staffUsers = User::where('role', 'STAFF')
            ->where(function ($q) use ($outletId, $employeeIds) {
                $q->whereHas('outlets', fn ($sub) => $sub->where('outlets.id', $outletId))
                    ->orWhereIn('id', $employeeIds);
            })
            ->where('is_active', true)
            ->get(['id', 'display_name']);

        if ($staffUsers->isEmpty()) {
            $staffUsers = User::where('role', 'STAFF')
                ->where('is_active', true)
                ->get(['id', 'display_name']);
        }

        $shiftsInPeriod = ShiftRecord::where('outlet_id', $outletId)
            ->whereNotNull('closed_at')
            ->whereBetween('opened_at', [$startDate, $endDate])
            ->whereIn('opened_by', $staffUsers->pluck('id'))
            ->get(['id', 'opened_by', 'opened_at', 'closed_at']);

        $latestPayments = EmployeeSalaryPayment::whereIn('employee_id', $staffUsers->pluck('id'))
            ->whereNotNull('daily_rate')
            ->where('daily_rate', '>', 0)
            ->orderByDesc('paid_at')
            ->orderByDesc('created_at')
            ->get()
            ->groupBy('employee_id')
            ->map(fn ($rows) => (float) $rows->first()->daily_rate);

        $staffShifts = $staffUsers->map(function ($staff) use ($shiftsInPeriod, $latestPayments) {
            $userShifts = $shiftsInPeriod->where('opened_by', $staff->id);
            $workDates = $userShifts->map(fn ($s) => $s->opened_at?->toDateString())->filter()->unique();

            return [
                'id' => $staff->id,
                'name' => $staff->display_name,
                'shift_count' => $userShifts->count(),
                'work_days' => $workDates->count(),
                'default_daily_rate' => (float) ($latestPayments->get($staff->id) ?? 0),
            ];
        })->values();

        $customSalaryTotal = $customSalaryTotal !== null ? max(0, $customSalaryTotal) : null;
        $salaryTotal = $customSalaryTotal ?? $recordedSalaryTotal;

        $transactions = Transaction::where('outlet_id', $outletId)
            ->where('payment_status', 'PAID')
            ->where(function ($query) use ($startDate, $endDate) {
                $query->whereBetween('paid_at', [$startDate, $endDate])
                    ->orWhere(function ($legacyQuery) use ($startDate, $endDate) {
                        $legacyQuery->whereNull('paid_at')
                            ->whereBetween('created_at', [$startDate, $endDate]);
                    });
            })
            ->with('items.product')
            ->get();

        $soldPortions = 0.0;
        $revenue = 0.0;
        $hpp = 0.0;
        foreach ($transactions as $transaction) {
            foreach ($transaction->items as $item) {
                $soldPortions += (float) $item->qty_porsi;
                $revenue += (float) $item->subtotal;
                $hpp += $this->itemHppTotal($item);
            }
        }

        $grossProfit = $revenue - $hpp;
        $laborCostPerPortion = $soldPortions > 0 ? $salaryTotal / $soldPortions : 0.0;

        return [
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'salary_total' => round($salaryTotal),
            'recorded_salary_total' => round($recordedSalaryTotal),
            'custom_salary_total' => $customSalaryTotal !== null ? round($customSalaryTotal) : null,
            'custom_salary_enabled' => $customSalaryTotal !== null,
            'sold_portions' => round($soldPortions, 2),
            'revenue' => round($revenue),
            'estimated_hpp' => round($hpp),
            'gross_profit' => round($grossProfit),
            'labor_cost_per_portion' => round($laborCostPerPortion, 2),
            'profit_after_labor' => round($grossProfit - $salaryTotal),
            'staff_shifts' => $staffShifts->all(),
        ];
    }

    private function allocatedSalaryTotal(Collection $payments, Carbon $startDate, Carbon $endDate): float
    {
        $total = 0.0;
        $rangeStart = $startDate->copy()->startOfDay();
        $rangeEnd = $endDate->copy()->endOfDay();

        foreach ($payments as $payment) {
            $periodStart = $payment->period_start?->copy()->startOfDay();
            $periodEnd = $payment->period_end?->copy()->endOfDay();
            if (! $periodStart || ! $periodEnd) {
                continue;
            }

            $overlapStart = $periodStart->greaterThan($rangeStart) ? $periodStart->copy() : $rangeStart->copy();
            $overlapEnd = $periodEnd->lessThan($rangeEnd) ? $periodEnd->copy() : $rangeEnd->copy();
            if ($overlapEnd->lt($overlapStart)) {
                continue;
            }

            $paymentTotal = (float) $payment->total_amount;
            $overlapDays = $this->inclusiveDayCount($overlapStart, $overlapEnd);

            if (strtoupper((string) $payment->salary_type) === 'DAILY') {
                $snapshotWorkDates = collect($payment->shift_snapshot ?? [])
                    ->pluck('work_date')
                    ->filter()
                    ->unique()
                    ->values();

                if ($snapshotWorkDates->isNotEmpty()) {
                    $overlapStartDate = $overlapStart->toDateString();
                    $overlapEndDate = $overlapEnd->toDateString();
                    $overlapWorkDates = $snapshotWorkDates
                        ->filter(fn (string $date) => $date >= $overlapStartDate && $date <= $overlapEndDate)
                        ->count();

                    $total += $paymentTotal * ($overlapWorkDates / max(1, $snapshotWorkDates->count()));
                    continue;
                }

                $payableDays = max(0, (int) $payment->payable_days);
                if ($payableDays > 0) {
                    $total += ($paymentTotal / $payableDays) * min($payableDays, $overlapDays);
                    continue;
                }
            }

            $periodDays = $this->inclusiveDayCount($periodStart, $periodEnd);
            $total += $paymentTotal * ($overlapDays / max(1, $periodDays));
        }

        return $total;
    }

    private function inclusiveDayCount(Carbon $startDate, Carbon $endDate): int
    {
        return max(1, (int) floor($startDate->copy()->startOfDay()->diffInDays($endDate->copy()->startOfDay())) + 1);
    }
}
