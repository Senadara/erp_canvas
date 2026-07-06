<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\Product;
use App\Models\TransactionItem;
use App\Models\User;
use App\Services\TransactionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProductLifecycleTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_destroy_route_deactivates_product_without_deleting_transaction_history(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Utama']);
        $owner = User::create([
            'email' => 'owner@karsa.local',
            'password_hash' => Hash::make('password'),
            'display_name' => 'Owner',
            'role' => 'OWNER',
            'is_active' => true,
        ]);

        $product = Product::create([
            'outlet_id' => $outlet->id,
            'name' => 'Dimsum Ori',
            'category' => 'Makanan',
            'price' => 15000,
            'hpp' => 7000,
            'is_active' => true,
        ]);

        $transaction = app(TransactionService::class)->processSale([
            'outlet_id' => $outlet->id,
            'items' => [[
                'product_id' => $product->id,
                'product_name' => $product->name,
                'qty_porsi' => 1,
                'price_per_porsi' => 15000,
            ]],
            'payment_status' => 'PAID',
            'payment_method' => 'CASH',
            'cash_received' => 20000,
        ]);

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->delete(route('products.destroy', $product->id))
            ->assertRedirect()
            ->assertSessionHas('success', 'Produk berhasil dinonaktifkan. Histori transaksi dan struk tetap aman.');

        $this->assertFalse($product->fresh()->is_active);
        $this->assertDatabaseHas('products', ['id' => $product->id, 'name' => 'Dimsum Ori']);
        $this->assertSame($product->id, TransactionItem::where('transaction_id', $transaction->id)->firstOrFail()->product_id);

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('products.store'), [
                'id' => $product->id,
                'name' => $product->name,
                'category' => $product->category,
                'price' => $product->price,
                'hpp' => $product->hpp,
                'is_active' => true,
                'display_group_id' => '',
                'image_url' => '',
            ])
            ->assertRedirect()
            ->assertSessionHas('success', 'Produk berhasil disimpan.');

        $this->assertTrue($product->fresh()->is_active);
    }
}
