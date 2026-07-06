<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\Product;
use App\Models\StockItem;
use App\Models\User;
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

    public function test_staff_gets_staff_dashboard_payload(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Utama']);
        $staff = $this->user('STAFF');
        $staff->outlets()->attach($outlet->id);

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
}
