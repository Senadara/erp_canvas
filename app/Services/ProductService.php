<?php

namespace App\Services;

use App\Models\Conversion;
use App\Models\Product;
use App\Models\StockItem;
use Illuminate\Support\Facades\DB;

class ProductService
{
    public function __construct(private ConversionOutletResolver $conversionOutletResolver) {}

    public function listProducts(string $outletId)
    {
        $products = Product::with([
            'displayGroup:id,name,sort_order',
            'conversions.stockItem:id,name,outlet_id,current_stock_biji,unit_name,trackable,counting_basis'
        ])
        ->where('outlet_id', $outletId)
        ->orderBy('category')
        ->orderBy('name')
        ->get();

        $products->each(function (Product $product) use ($outletId) {
            $product->setRelation(
                'conversions',
                $product->conversions
                    ->map(fn (Conversion $conversion) => $this->conversionOutletResolver->repairForListing($conversion, $outletId))
                    ->filter()
                    ->values()
            );
        });

        return $products;
    }

    public function upsertProduct(array $data)
    {
        $id = $data['id'] ?? null;
        
        if ($id) {
            $product = Product::where('id', $id)->where('outlet_id', $data['outlet_id'])->firstOrFail();
            $product->update([
                'name' => $data['name'],
                'category' => $data['category'],
                'price' => $data['price'],
                'hpp' => $data['hpp'] ?? 0,
                'image_url' => $data['image_url'] ?? null,
                'is_active' => $data['is_active'] ?? true,
                'display_group_id' => $data['display_group_id'] ?? null,
            ]);
            return $product;
        }

        return Product::create([
            'outlet_id' => $data['outlet_id'],
            'name' => $data['name'],
            'category' => $data['category'],
            'price' => $data['price'],
            'hpp' => $data['hpp'] ?? 0,
            'image_url' => $data['image_url'] ?? null,
            'is_active' => $data['is_active'] ?? true,
            'display_group_id' => $data['display_group_id'] ?? null,
        ]);
    }

    public function setProductConversions(string $productId, string $outletId, array $rows, ?StockService $stockService = null)
    {
        $product = Product::where('id', $productId)->where('outlet_id', $outletId)->firstOrFail();
        $stockIds = collect($rows)->pluck('stock_item_id')->filter()->unique()->values();
        $validStockIds = StockItem::where('outlet_id', $outletId)
            ->whereIn('id', $stockIds)
            ->pluck('id')
            ->all();

        $invalidStockIds = $stockIds->diff($validStockIds)->values();
        if ($invalidStockIds->isNotEmpty()) {
            throw new \InvalidArgumentException('Konversi produk hanya boleh memakai bahan dari outlet yang sama.');
        }
        
        DB::transaction(function () use ($productId, $rows, $outletId, $stockService, $product) {
            Conversion::where('product_id', $productId)->delete();
            foreach ($rows as $row) {
                Conversion::create([
                    'product_id' => $productId,
                    'stock_item_id' => $row['stock_item_id'],
                    'ratio' => $row['ratio'],
                ]);
                
                if (isset($row['initial_stock']) && $row['initial_stock'] > 0 && $stockService) {
                    $stockService->addStock(
                        $row['stock_item_id'],
                        $row['initial_stock'],
                        "Stok awal dari produk {$product->name}"
                    );
                }
            }
        });
    }

    public function deactivateProduct(string $id, string $outletId): Product
    {
        $product = Product::where('id', $id)->where('outlet_id', $outletId)->firstOrFail();
        $product->update(['is_active' => false]);

        return $product;
    }
}
