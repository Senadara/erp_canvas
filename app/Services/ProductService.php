<?php

namespace App\Services;

use App\Models\Conversion;
use App\Models\Product;
use Illuminate\Support\Facades\DB;

class ProductService
{
    public function listProducts(string $outletId)
    {
        return Product::with([
            'displayGroup:id,name,sort_order',
            'conversions.stockItem:id,name,outlet_id'
        ])
        ->where('outlet_id', $outletId)
        ->orderBy('category')
        ->orderBy('name')
        ->get();
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
        
        DB::transaction(function () use ($productId, $rows, $outletId, $stockService, $product) {
            Conversion::where('product_id', $productId)->delete();
            foreach ($rows as $row) {
                Conversion::create([
                    'product_id' => $productId,
                    'stock_item_id' => $row['stock_item_id'],
                    'ratio' => $row['ratio'],
                ]);
                
                if (isset($row['initial_stock']) && $row['initial_stock'] > 0 && $stockService) {
                    $stockService->addRestockLog(
                        $outletId,
                        $row['stock_item_id'],
                        $row['initial_stock'],
                        $row['initial_stock'] * ($row['hpp'] ?? 0),
                        "Stok awal dari produk $product->name",
                        null
                    );
                }
            }
        });
    }

    public function deleteProduct(string $id, string $outletId)
    {
        $product = Product::where('id', $id)->where('outlet_id', $outletId)->firstOrFail();
        return $product->delete();
    }
}
