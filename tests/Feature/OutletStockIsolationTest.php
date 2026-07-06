<?php

namespace Tests\Feature;

use App\Models\Conversion;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\StockItem;
use App\Services\OutletCloneService;
use App\Services\ProductService;
use App\Services\TransactionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OutletStockIsolationTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_conversion_rejects_stock_from_different_outlet(): void
    {
        $outletA = Outlet::create(['name' => 'Outlet A']);
        $outletB = Outlet::create(['name' => 'Outlet B']);

        $product = Product::create([
            'outlet_id' => $outletA->id,
            'name' => 'Nasi Goreng',
            'category' => 'Makanan',
            'price' => 15000,
            'hpp' => 7000,
            'is_active' => true,
        ]);

        $otherOutletStock = StockItem::create([
            'outlet_id' => $outletB->id,
            'name' => 'Beras',
            'current_stock_biji' => 20,
            'unit_name' => 'porsi',
            'min_stock_alert' => 2,
            'trackable' => true,
            'counting_basis' => 'BIJI',
        ]);

        $this->expectException(\InvalidArgumentException::class);

        app(ProductService::class)->setProductConversions($product->id, $outletA->id, [
            ['stock_item_id' => $otherOutletStock->id, 'ratio' => 2],
        ]);
    }

    public function test_cloned_outlet_stock_is_isolated_when_sale_deducts_stock(): void
    {
        $sourceOutlet = Outlet::create(['name' => 'Outlet Sumber']);
        $targetOutlet = Outlet::create(['name' => 'Outlet Baru']);

        $sourceStock = StockItem::create([
            'outlet_id' => $sourceOutlet->id,
            'name' => 'Beras',
            'current_stock_biji' => 20,
            'unit_name' => 'porsi',
            'min_stock_alert' => 2,
            'trackable' => true,
            'counting_basis' => 'BIJI',
        ]);

        $sourceProduct = Product::create([
            'outlet_id' => $sourceOutlet->id,
            'name' => 'Nasi Goreng',
            'category' => 'Makanan',
            'price' => 15000,
            'hpp' => 7000,
            'is_active' => true,
        ]);

        Conversion::create([
            'product_id' => $sourceProduct->id,
            'stock_item_id' => $sourceStock->id,
            'ratio' => 2,
        ]);

        app(OutletCloneService::class)->copyCatalog($sourceOutlet, $targetOutlet);

        $targetProduct = Product::where('outlet_id', $targetOutlet->id)->where('name', 'Nasi Goreng')->firstOrFail();
        $targetStock = StockItem::where('outlet_id', $targetOutlet->id)->where('name', 'Beras')->firstOrFail();
        $targetConversion = Conversion::where('product_id', $targetProduct->id)->firstOrFail();

        $this->assertNotSame($sourceStock->id, $targetStock->id);
        $this->assertSame($targetStock->id, $targetConversion->stock_item_id);

        app(TransactionService::class)->processSale([
            'outlet_id' => $targetOutlet->id,
            'items' => [[
                'product_id' => $targetProduct->id,
                'product_name' => $targetProduct->name,
                'qty_porsi' => 3,
                'price_per_porsi' => 15000,
            ]],
            'payment_status' => 'PAID',
            'payment_method' => 'CASH',
            'cash_received' => 50000,
        ]);

        $this->assertEquals('20.0000', $sourceStock->fresh()->current_stock_biji);
        $this->assertEquals('14.0000', $targetStock->fresh()->current_stock_biji);
    }

    public function test_product_listing_repairs_conversion_that_points_to_matching_stock_in_another_outlet(): void
    {
        $sourceOutlet = Outlet::create(['name' => 'Outlet Sumber']);
        $targetOutlet = Outlet::create(['name' => 'Outlet Baru']);

        $sourceStock = StockItem::create([
            'outlet_id' => $sourceOutlet->id,
            'name' => 'Dimsum Ori',
            'current_stock_biji' => 20,
            'unit_name' => 'pcs',
            'min_stock_alert' => 2,
            'trackable' => true,
            'counting_basis' => 'BIJI',
        ]);

        $targetStock = StockItem::create([
            'outlet_id' => $targetOutlet->id,
            'name' => 'Dimsum Ori',
            'current_stock_biji' => 12,
            'unit_name' => 'pcs',
            'min_stock_alert' => 2,
            'trackable' => true,
            'counting_basis' => 'BIJI',
        ]);

        $targetProduct = Product::create([
            'outlet_id' => $targetOutlet->id,
            'name' => 'Dimsum Ori',
            'category' => 'Makanan',
            'price' => 15000,
            'hpp' => 7000,
            'is_active' => true,
        ]);

        $conversion = Conversion::create([
            'product_id' => $targetProduct->id,
            'stock_item_id' => $sourceStock->id,
            'ratio' => 1,
        ]);

        $products = app(ProductService::class)->listProducts($targetOutlet->id);
        $listedConversion = $products->first()->conversions->first();

        $this->assertSame($targetStock->id, $listedConversion->stock_item_id);
        $this->assertSame($targetStock->id, $conversion->fresh()->stock_item_id);
    }

    public function test_sale_repairs_conversion_that_points_to_matching_stock_in_another_outlet(): void
    {
        $sourceOutlet = Outlet::create(['name' => 'Outlet Sumber']);
        $targetOutlet = Outlet::create(['name' => 'Outlet Baru']);

        $sourceStock = StockItem::create([
            'outlet_id' => $sourceOutlet->id,
            'name' => 'Dimsum Ori',
            'current_stock_biji' => 20,
            'unit_name' => 'pcs',
            'min_stock_alert' => 2,
            'trackable' => true,
            'counting_basis' => 'BIJI',
        ]);

        $targetStock = StockItem::create([
            'outlet_id' => $targetOutlet->id,
            'name' => 'Dimsum Ori',
            'current_stock_biji' => 12,
            'unit_name' => 'pcs',
            'min_stock_alert' => 2,
            'trackable' => true,
            'counting_basis' => 'BIJI',
        ]);

        $targetProduct = Product::create([
            'outlet_id' => $targetOutlet->id,
            'name' => 'Dimsum Ori',
            'category' => 'Makanan',
            'price' => 15000,
            'hpp' => 7000,
            'is_active' => true,
        ]);

        $conversion = Conversion::create([
            'product_id' => $targetProduct->id,
            'stock_item_id' => $sourceStock->id,
            'ratio' => 2,
        ]);

        app(TransactionService::class)->processSale([
            'outlet_id' => $targetOutlet->id,
            'items' => [[
                'product_id' => $targetProduct->id,
                'product_name' => $targetProduct->name,
                'qty_porsi' => 3,
                'price_per_porsi' => 15000,
            ]],
            'payment_status' => 'PAID',
            'payment_method' => 'CASH',
            'cash_received' => 50000,
        ]);

        $this->assertSame($targetStock->id, $conversion->fresh()->stock_item_id);
        $this->assertEquals('20.0000', $sourceStock->fresh()->current_stock_biji);
        $this->assertEquals('6.0000', $targetStock->fresh()->current_stock_biji);
    }

    public function test_cancel_order_restores_deducted_stock(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Utama']);
        $stock = StockItem::create([
            'outlet_id' => $outlet->id,
            'name' => 'Ayam',
            'current_stock_biji' => 10,
            'unit_name' => 'porsi',
            'min_stock_alert' => 1,
            'trackable' => true,
            'counting_basis' => 'BIJI',
        ]);
        $product = Product::create([
            'outlet_id' => $outlet->id,
            'name' => 'Ayam Geprek',
            'category' => 'Makanan',
            'price' => 12000,
            'hpp' => 6000,
            'is_active' => true,
        ]);
        Conversion::create([
            'product_id' => $product->id,
            'stock_item_id' => $stock->id,
            'ratio' => 1,
        ]);

        $service = app(TransactionService::class);
        $transaction = $service->processSale([
            'outlet_id' => $outlet->id,
            'items' => [[
                'product_id' => $product->id,
                'product_name' => $product->name,
                'qty_porsi' => 4,
                'price_per_porsi' => 12000,
            ]],
            'payment_status' => 'PAID',
            'payment_method' => 'QRIS',
        ]);

        $this->assertEquals('6.0000', $stock->fresh()->current_stock_biji);

        $service->cancelOrder($transaction->id, $outlet->id, 'Input salah');

        $this->assertEquals('10.0000', $stock->fresh()->current_stock_biji);
        $this->assertSame('CANCELED', $transaction->fresh()->payment_status);
    }
}
