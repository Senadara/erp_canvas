<?php

namespace Tests\Feature;

use App\Models\Conversion;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\StockItem;
use App\Models\User;
use App\Models\WasteLog;
use App\Services\MitraReportService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class WasteProductTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_waste_deducts_recipe_stock_records_loss_and_counts_for_mitra_settlement(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-07 12:00:00'));

        try {
            $outlet = Outlet::create(['name' => 'Outlet Utama']);
            $owner = User::create([
                'email' => 'owner-waste@karsa.local',
                'password_hash' => Hash::make('password'),
                'display_name' => 'Owner Waste',
                'role' => 'OWNER',
                'is_active' => true,
            ]);
            $mitra = User::create([
                'email' => 'mitra-waste@karsa.local',
                'password_hash' => Hash::make('password'),
                'display_name' => 'Mitra Waste',
                'role' => 'MITRA',
                'is_active' => true,
            ]);

            $stock = StockItem::create([
                'outlet_id' => $outlet->id,
                'name' => 'Dimsum Ori',
                'current_stock_biji' => 20,
                'unit_name' => 'pcs',
                'min_stock_alert' => 2,
                'trackable' => true,
                'counting_basis' => 'BIJI',
                'min_restock_qty' => 10,
                'restock_price' => 50000,
            ]);
            $product = Product::create([
                'outlet_id' => $outlet->id,
                'name' => 'Dimsum Isi 2',
                'category' => 'Makanan',
                'price' => 15000,
                'hpp' => 10000,
                'is_active' => true,
            ]);
            Conversion::create([
                'product_id' => $product->id,
                'stock_item_id' => $stock->id,
                'ratio' => 2,
            ]);
            $mitra->mitraStockItems()->attach($stock->id);

            $this->actingAs($owner)
                ->withSession(['outlet_id' => $outlet->id])
                ->post(route('waste.store'), [
                    'source_type' => 'PRODUCT',
                    'product_id' => $product->id,
                    'qty_porsi' => 3,
                    'waste_type' => 'OWNER_REQUEST',
                    'reason' => 'Permintaan pribadi owner',
                ])
                ->assertRedirect()
                ->assertSessionHas('success', 'Waste produk berhasil dicatat dan stok bahan dikurangi.');

            $this->assertSame(14.0, (float) $stock->fresh()->current_stock_biji);
            $this->assertDatabaseHas('waste_logs', [
                'source_type' => 'PRODUCT',
                'product_id' => $product->id,
                'stock_item_id' => $stock->id,
                'qty_biji' => 6,
                'qty_porsi' => 3,
                'waste_type' => 'OWNER_REQUEST',
                'loss_amount' => 30000,
                'affects_mitra_settlement' => true,
            ]);

            $report = app(MitraReportService::class)->getMitraReportData(
                $outlet->id,
                $mitra,
                Carbon::parse('2026-07-07'),
                Carbon::parse('2026-07-07')
            );

            $this->assertCount(1, $report);
            $this->assertSame(6.0, (float) $report[0]['waste_qty']);
            $this->assertSame(6.0, (float) $report[0]['sales_qty']);
            $this->assertSame(30000.0, (float) $report[0]['sales_subtotal']);
            $this->assertSame(30000.0, (float) WasteLog::firstOrFail()->loss_amount);
        } finally {
            Carbon::setTestNow();
        }
    }
}
