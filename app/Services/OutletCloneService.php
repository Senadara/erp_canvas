<?php

namespace App\Services;

use App\Models\Conversion;
use App\Models\DisplayGroup;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\StockItem;
use Illuminate\Support\Facades\DB;

class OutletCloneService
{
    public function copyCatalog(Outlet $sourceOutlet, Outlet $targetOutlet): void
    {
        DB::transaction(function () use ($sourceOutlet, $targetOutlet) {
            $groupMap = $this->copyDisplayGroups($sourceOutlet, $targetOutlet);
            $stockMap = $this->copyStockItems($sourceOutlet, $targetOutlet, $groupMap);
            $productMap = $this->copyProducts($sourceOutlet, $targetOutlet, $groupMap);

            $sourceConversions = Conversion::whereIn('product_id', array_keys($productMap))->get();
            foreach ($sourceConversions as $conversion) {
                if (! isset($stockMap[$conversion->stock_item_id])) {
                    continue;
                }

                Conversion::create([
                    'product_id' => $productMap[$conversion->product_id],
                    'stock_item_id' => $stockMap[$conversion->stock_item_id],
                    'ratio' => $conversion->ratio,
                ]);
            }
        });
    }

    private function copyDisplayGroups(Outlet $sourceOutlet, Outlet $targetOutlet): array
    {
        $map = [];
        $groups = DisplayGroup::where('outlet_id', $sourceOutlet->id)->get();

        foreach ($groups as $group) {
            $copy = DisplayGroup::create([
                'name' => $group->name,
                'sort_order' => $group->sort_order,
                'context' => $group->context,
                'outlet_id' => $targetOutlet->id,
            ]);
            $map[$group->id] = $copy->id;
        }

        return $map;
    }

    private function copyStockItems(Outlet $sourceOutlet, Outlet $targetOutlet, array $groupMap): array
    {
        $map = [];
        $items = StockItem::where('outlet_id', $sourceOutlet->id)->get();

        foreach ($items as $item) {
            $copy = StockItem::create([
                'outlet_id' => $targetOutlet->id,
                'name' => $item->name,
                'current_stock_biji' => $item->current_stock_biji,
                'unit_name' => $item->unit_name,
                'min_stock_alert' => $item->min_stock_alert,
                'supplier_id' => $item->supplier_id,
                'trackable' => $item->trackable,
                'counting_basis' => $item->counting_basis,
                'display_group_id' => $item->display_group_id ? ($groupMap[$item->display_group_id] ?? null) : null,
                'min_restock_qty' => $item->min_restock_qty,
                'restock_price' => $item->restock_price,
            ]);
            $map[$item->id] = $copy->id;
        }

        return $map;
    }

    private function copyProducts(Outlet $sourceOutlet, Outlet $targetOutlet, array $groupMap): array
    {
        $map = [];
        $products = Product::where('outlet_id', $sourceOutlet->id)->get();

        foreach ($products as $product) {
            $copy = Product::create([
                'outlet_id' => $targetOutlet->id,
                'name' => $product->name,
                'category' => $product->category,
                'price' => $product->price,
                'hpp' => $product->hpp,
                'image_url' => $product->image_url,
                'is_active' => $product->is_active,
                'display_group_id' => $product->display_group_id ? ($groupMap[$product->display_group_id] ?? null) : null,
            ]);
            $map[$product->id] = $copy->id;
        }

        return $map;
    }
}
