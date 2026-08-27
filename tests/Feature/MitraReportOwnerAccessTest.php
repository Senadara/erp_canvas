<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\StockItem;
use App\Models\User;
use App\Support\NavPermission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class MitraReportOwnerAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_nav_does_not_include_setoran_mitra(): void
    {
        $staff = $this->user('STAFF', 'Staff Outlet');

        $features = collect(NavPermission::allowedNavFor($staff))->pluck('feature')->all();
        $labels = collect(NavPermission::allowedNavFor($staff))->pluck('label')->all();

        $this->assertNotContains('settlements', $features);
        $this->assertNotContains('Setoran Mitra', $labels);
    }

    public function test_owner_can_filter_laporan_mitra_by_mitra_across_outlets(): void
    {
        $outletA = Outlet::create(['name' => 'Outlet A']);
        $outletB = Outlet::create(['name' => 'Outlet B']);
        $owner = $this->user('OWNER', 'Owner');
        $mitraAlpha = $this->user('MITRA', 'Mitra Alpha', 'alpha@mitra.test');
        $mitraBeta = $this->user('MITRA', 'Mitra Beta', 'beta@mitra.test');

        $alphaStockA = $this->stock($outletA, 'Dimsum Alpha A');
        $alphaStockB = $this->stock($outletB, 'Dimsum Alpha B');
        $betaStock = $this->stock($outletA, 'Dimsum Beta');

        $mitraAlpha->mitraStockItems()->attach([$alphaStockA->id, $alphaStockB->id]);
        $mitraBeta->mitraStockItems()->attach($betaStock->id);

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outletA->id])
            ->get(route('mitra-reports', ['mitra_id' => $mitraAlpha->id]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('MitraReports/Index')
                ->where('isOwner', true)
                ->has('mitras', 2)
                ->where('selectedMitraId', $mitraAlpha->id)
                ->where('selectedMitra.display_name', 'Mitra Alpha')
                ->has('overview.items', 2)
                ->where('overview.items.0.outlet_name', 'Outlet A')
                ->where('overview.items.1.outlet_name', 'Outlet B')
            );
    }

    private function user(string $role, string $name, ?string $email = null): User
    {
        return User::create([
            'email' => $email ?: strtolower($role).'-mitra-report@test.local',
            'password_hash' => Hash::make('password'),
            'display_name' => $name,
            'role' => $role,
            'is_active' => true,
        ]);
    }

    private function stock(Outlet $outlet, string $name): StockItem
    {
        return StockItem::create([
            'outlet_id' => $outlet->id,
            'name' => $name,
            'current_stock_biji' => 100,
            'unit_name' => 'pcs',
            'min_stock_alert' => 10,
            'trackable' => true,
            'counting_basis' => 'BIJI',
            'min_restock_qty' => 10,
            'restock_price' => 50000,
        ]);
    }
}
