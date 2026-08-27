<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\PettyCash;
use App\Models\Product;
use App\Models\StockItem;
use App\Models\Transaction;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class DashboardRoleTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_gets_owner_dashboard_payload(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Utama']);
        $owner = $this->user('OWNER');

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard')
                ->where('dashboard.role', 'OWNER')
                ->where('dashboard.title', 'Dashboard Owner')
                ->where('dashboard.quickActions.0.label', 'Buka Kasir')
            );
    }

    public function test_owner_dashboard_daily_view_uses_selected_single_date(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Utama']);
        $owner = $this->user('OWNER');

        $coffee = Product::create([
            'outlet_id' => $outlet->id,
            'name' => 'Kopi Susu',
            'category' => 'Minuman',
            'price' => 15000,
            'hpp' => 7000,
            'is_active' => true,
        ]);
        $toast = Product::create([
            'outlet_id' => $outlet->id,
            'name' => 'Roti Panggang',
            'category' => 'Makanan',
            'price' => 20000,
            'hpp' => 9000,
            'is_active' => true,
        ]);

        $this->paidTransaction($outlet, Carbon::parse('2026-08-25 10:00:00'), [
            ['product' => $coffee, 'qty' => 2, 'price' => 15000],
            ['product' => $toast, 'qty' => 1, 'price' => 20000],
        ]);
        $this->paidTransaction($outlet, Carbon::parse('2026-08-24 10:00:00'), [
            ['product' => $coffee, 'qty' => 5, 'price' => 15000],
        ]);

        PettyCash::create([
            'outlet_id' => $outlet->id,
            'amount' => 12000,
            'category' => 'Operasional',
            'payment_method' => 'CASH',
            'cash_flow' => 'OUT',
            'description' => 'Gas',
            'created_at' => Carbon::parse('2026-08-25 11:00:00'),
        ]);
        PettyCash::create([
            'outlet_id' => $outlet->id,
            'amount' => 50000,
            'category' => 'Operasional',
            'payment_method' => 'CASH',
            'cash_flow' => 'OUT',
            'description' => 'Belanja kemarin',
            'created_at' => Carbon::parse('2026-08-24 11:00:00'),
        ]);

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->get('/dashboard?date=2026-08-25')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard')
                ->where('dashboard.cards.0.label', 'Pendapatan')
                ->where('dashboard.cards.1.label', 'Pengeluaran')
                ->where('dashboard.dailyView.date', '2026-08-25')
                ->where('dashboard.dailyView.show_expenses', true)
                ->where('dashboard.dailyView.summary.transactionCount', 1)
                ->where('dashboard.dailyView.summary.totalSales', fn ($value) => (float) $value === 50000.0)
                ->where('dashboard.dailyView.summary.expenses', fn ($value) => (float) $value === 12000.0)
                ->where('dashboard.dailyView.summary.soldProductCount', 2)
                ->where('dashboard.dailyView.summary.soldQuantity', fn ($value) => (float) $value === 3.0)
                ->has('dashboard.dailyView.soldProducts', 2)
                ->where('dashboard.dailyView.soldProducts.0.product_name', 'Kopi Susu')
                ->where('dashboard.dailyView.soldProducts.0.quantity_sold', fn ($value) => (float) $value === 2.0)
                ->where('dashboard.dailyView.soldProducts.0.revenue', fn ($value) => (float) $value === 30000.0)
                ->where('dashboard.dailyView.soldProducts.1.product_name', 'Roti Panggang')
            );
    }

    public function test_staff_gets_staff_dashboard_payload(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Utama']);
        $staff = $this->user('STAFF');
        $staff->outlets()->attach($outlet->id);

        PettyCash::create([
            'outlet_id' => $outlet->id,
            'amount' => 25000,
            'category' => 'Operasional',
            'payment_method' => 'CASH',
            'cash_flow' => 'OUT',
            'created_at' => Carbon::now(),
        ]);

        $this->actingAs($staff)
            ->withSession(['outlet_id' => $outlet->id])
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard')
                ->where('dashboard.role', 'STAFF')
                ->where('dashboard.title', 'Dashboard Staff')
                ->where('dashboard.cards.0.label', 'Status Shift')
                ->where('dashboard.quickActions.0.label', 'Kasir')
                ->where('dashboard.dailyView.show_expenses', false)
                ->where('dashboard.dailyView.summary.expenses', fn ($value) => (float) $value === 0.0)
            );
    }

    public function test_mitra_gets_mitra_dashboard_payload(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Utama']);
        $mitra = $this->user('MITRA');
        $mitra->outlets()->attach($outlet->id);

        $stock = StockItem::create([
            'outlet_id' => $outlet->id,
            'name' => 'Dimsum Ori',
            'current_stock_biji' => 20,
            'unit_name' => 'pcs',
            'min_stock_alert' => 2,
            'trackable' => true,
            'counting_basis' => 'BIJI',
        ]);

        $product = Product::create([
            'outlet_id' => $outlet->id,
            'name' => 'Dimsum Ori',
            'category' => 'Makanan',
            'price' => 15000,
            'hpp' => 7000,
            'is_active' => true,
        ]);

        $mitra->mitraStockItems()->attach($stock->id);
        $mitra->mitraProducts()->attach($product->id);

        $this->actingAs($mitra)
            ->withSession(['outlet_id' => $outlet->id])
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard')
                ->where('dashboard.role', 'MITRA')
                ->where('dashboard.title', 'Dashboard Mitra')
                ->where('dashboard.cards.0.label', 'Stok Dalam Scope')
                ->where('dashboard.quickActions.0.label', 'Stok Saya')
            );
    }

    private function user(string $role): User
    {
        return User::create([
            'email' => strtolower($role).'@karsa.local',
            'password_hash' => Hash::make('password'),
            'display_name' => ucfirst(strtolower($role)),
            'role' => $role,
            'is_active' => true,
        ]);
    }

    private function paidTransaction(Outlet $outlet, Carbon $createdAt, array $items): Transaction
    {
        $total = collect($items)->sum(fn (array $item) => $item['qty'] * $item['price']);

        $transaction = Transaction::create([
            'outlet_id' => $outlet->id,
            'invoice_number' => 'INV-'.$createdAt->format('YmdHis'),
            'total_amount' => $total,
            'payment_method' => 'CASH',
            'payment_status' => 'PAID',
            'created_at' => $createdAt,
            'paid_at' => $createdAt,
        ]);

        foreach ($items as $item) {
            $transaction->items()->create([
                'product_id' => $item['product']->id,
                'product_name' => $item['product']->name,
                'qty_porsi' => $item['qty'],
                'price_per_porsi' => $item['price'],
                'subtotal' => $item['qty'] * $item['price'],
            ]);
        }

        return $transaction;
    }
}
