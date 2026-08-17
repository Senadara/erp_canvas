<?php

namespace App\Http\Controllers;

use App\Models\Outlet;
use App\Models\StockItem;
use App\Models\User;
use App\Services\ProductCostService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class ProductCostController extends Controller
{
    public function __construct(private ProductCostService $productCostService) {}

    public function index(Request $request)
    {
        abort_if(! $this->canView($request->user()), 403, 'Anda tidak memiliki akses ke menu Biaya Produk.');

        $outletId = $request->session()->get('outlet_id');
        $startDate = $request->query('start_date')
            ? Carbon::parse($request->query('start_date'))->startOfDay()
            : now()->startOfMonth();
        $endDate = $request->query('end_date')
            ? Carbon::parse($request->query('end_date'))->endOfDay()
            : now()->endOfDay();

        if ($endDate->lt($startDate)) {
            $endDate = $startDate->copy()->endOfDay();
        }

        return Inertia::render('ProductCosts/Index', [
            'outlet' => Outlet::find($outletId),
            'filters' => [
                'start_date' => $startDate->format('Y-m-d'),
                'end_date' => $endDate->format('Y-m-d'),
            ],
            'report' => $this->productCostService->dashboardData($outletId, $startDate, $endDate),
        ]);
    }

    public function bulkComponents(Request $request)
    {
        abort_if(! $request->user()?->isOwner(), 403, 'Hanya owner yang dapat mengubah komponen biaya produk.');

        $outletId = $request->session()->get('outlet_id');
        $data = $request->validate([
            'stock_item_id' => ['nullable', 'string'],
            'product_ids' => ['nullable', 'array'],
            'product_ids.*' => ['required', 'string'],
            'ratio' => ['nullable', 'numeric', 'min:0.0001'],
            'items' => ['nullable', 'array'],
            'items.*.product_id' => ['required_with:items', 'string'],
            'items.*.stock_item_id' => ['required_with:items', 'string'],
            'items.*.ratio' => ['required_with:items', 'numeric', 'min:0.0001'],
        ]);

        $rows = collect($data['items'] ?? [])
            ->filter(fn (array $row) => ! empty($row['product_id']) && ! empty($row['stock_item_id']) && (float) ($row['ratio'] ?? 0) > 0)
            ->values()
            ->all();

        if (empty($rows)) {
            if (empty($data['stock_item_id']) || empty($data['product_ids']) || empty($data['ratio'])) {
                throw ValidationException::withMessages([
                    'items' => 'Pilih minimal satu produk dan komponen HPP.',
                ]);
            }

            $rows = collect($data['product_ids'])
                ->map(fn (string $productId) => [
                    'product_id' => $productId,
                    'stock_item_id' => $data['stock_item_id'],
                    'ratio' => (float) $data['ratio'],
                ])
                ->values()
                ->all();
        }

        $stockItemIds = collect($rows)->pluck('stock_item_id')->unique()->values();
        $invalidStockCount = StockItem::where('outlet_id', $outletId)
            ->whereIn('id', $stockItemIds)
            ->whereNotIn('cost_category', [
                ProductCostService::CATEGORY_MATERIAL,
                ProductCostService::CATEGORY_PACKAGING,
                ProductCostService::CATEGORY_SUPPLY,
            ])
            ->count();
        if ($invalidStockCount > 0) {
            throw ValidationException::withMessages([
                'items' => 'Komponen HPP hanya boleh memakai stok kategori bahan, kemasan, atau supply.',
            ]);
        }

        try {
            $count = $this->productCostService->bulkUpsertComponentRows($outletId, $rows);
        } catch (\InvalidArgumentException $exception) {
            throw ValidationException::withMessages([
                'items' => $exception->getMessage(),
            ]);
        }

        return redirect()->back()->with('success', "Komponen HPP berhasil diterapkan ke {$count} produk.");
    }

    private function canView(?User $user): bool
    {
        return (bool) ($user && ($user->isOwner() || ($user->feature_overrides['product_costs'] ?? false)));
    }
}
