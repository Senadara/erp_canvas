<?php

namespace Tests\Feature;

use App\Models\Conversion;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\StockItem;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UserMitraSupplierSyncTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_links_mitra_user_to_supplier_and_scopes_are_synced_from_supplier_stock(): void
    {
        [$outlet, $owner, $supplier, $supplierStock, $supplierProduct, $otherStock, $otherProduct] = $this->createContext();

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('users.store'), [
                'email' => 'mitra-supplier@karsa.local',
                'password' => 'password',
                'display_name' => 'Mitra Supplier',
                'role' => 'MITRA',
                'supplier_id' => $supplier->id,
                'is_active' => true,
                'outlet_ids' => [],
                'mitra_stock_ids' => [$otherStock->id],
                'mitra_product_ids' => [$otherProduct->id],
                'mitra_can_view_sales' => true,
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $mitra = User::where('email', 'mitra-supplier@karsa.local')->firstOrFail();

        $this->assertSame($supplier->id, $mitra->supplier_id);
        $this->assertSame([$outlet->id], $mitra->outlets()->pluck('outlets.id')->all());
        $this->assertSame(
            [$supplierStock->id],
            DB::table('mitra_stock_scopes')->where('user_id', $mitra->id)->pluck('stock_item_id')->all()
        );
        $this->assertSame(
            [$supplierProduct->id],
            DB::table('mitra_product_scopes')->where('user_id', $mitra->id)->pluck('product_id')->all()
        );
    }

    public function test_supplier_stock_changes_resync_linked_mitra_user_scopes(): void
    {
        [$outlet, $owner, $supplier, $supplierStock, $supplierProduct] = $this->createContext();
        [$secondStock, $secondProduct] = $this->createStockAndProduct($outlet->id, 'Kulit Dimsum', null);

        $mitra = User::create([
            'email' => 'linked-mitra@karsa.local',
            'password_hash' => Hash::make('password'),
            'display_name' => 'Linked Mitra',
            'role' => 'MITRA',
            'supplier_id' => $supplier->id,
            'is_active' => true,
        ]);
        $mitra->outlets()->attach($outlet->id);
        $mitra->mitraStockItems()->attach($supplierStock->id, ['price' => 50000]);
        $mitra->mitraProducts()->attach($supplierProduct->id);

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('suppliers.store'), [
                'id' => $supplier->id,
                'name' => $supplier->name,
                'phone' => $supplier->phone,
                'address' => $supplier->address,
                'stock_item_ids' => [$supplierStock->id, $secondStock->id],
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertEqualsCanonicalizing(
            [$supplierStock->id, $secondStock->id],
            DB::table('mitra_stock_scopes')->where('user_id', $mitra->id)->pluck('stock_item_id')->all()
        );
        $this->assertEqualsCanonicalizing(
            [$supplierProduct->id, $secondProduct->id],
            DB::table('mitra_product_scopes')->where('user_id', $mitra->id)->pluck('product_id')->all()
        );
    }

    public function test_users_page_exposes_supplier_options_for_mitra_configuration(): void
    {
        [$outlet, $owner, $supplier] = $this->createContext();

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->get(route('users'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Users/Index')
                ->has('suppliers', 1)
                ->where('suppliers.0.id', $supplier->id)
                ->where('suppliers.0.name', $supplier->name)
                ->where('suppliers.0.stock_items_count', 1)
                ->has('suppliers.0.stock_item_ids', 1)
                ->has('suppliers.0.product_ids', 1)
            );
    }

    private function createContext(): array
    {
        $outlet = Outlet::create(['name' => 'Outlet Supplier Sync']);
        $owner = User::create([
            'email' => 'owner-supplier-sync@karsa.local',
            'password_hash' => Hash::make('password'),
            'display_name' => 'Owner Supplier Sync',
            'role' => 'OWNER',
            'is_active' => true,
        ]);
        $supplier = Supplier::create([
            'name' => 'Supplier Dimsum',
            'phone' => '08123456789',
            'address' => 'Gudang utama',
        ]);

        [$supplierStock, $supplierProduct] = $this->createStockAndProduct($outlet->id, 'Dimsum Frozen', $supplier->id);
        [$otherStock, $otherProduct] = $this->createStockAndProduct($outlet->id, 'Minyak Goreng', null);

        return [$outlet, $owner, $supplier, $supplierStock, $supplierProduct, $otherStock, $otherProduct];
    }

    private function createStockAndProduct(string $outletId, string $name, ?string $supplierId): array
    {
        $stock = StockItem::create([
            'outlet_id' => $outletId,
            'name' => $name,
            'current_stock_biji' => 10,
            'unit_name' => 'pcs',
            'min_stock_alert' => 5,
            'supplier_id' => $supplierId,
            'trackable' => true,
            'counting_basis' => 'BIJI',
            'min_restock_qty' => 10,
            'restock_price' => 50000,
        ]);
        $product = Product::create([
            'outlet_id' => $outletId,
            'name' => "Produk {$name}",
            'category' => 'Dimsum',
            'price' => 15000,
            'hpp' => 5000,
            'is_active' => true,
        ]);
        Conversion::create([
            'product_id' => $product->id,
            'stock_item_id' => $stock->id,
            'ratio' => 1,
        ]);

        return [$stock, $product];
    }
}
