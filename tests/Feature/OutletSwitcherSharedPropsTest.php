<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class OutletSwitcherSharedPropsTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_costs_keeps_outlet_switcher_context_when_page_has_outlet_prop(): void
    {
        $activeOutlet = Outlet::create(['name' => 'Outlet Aktif']);
        $otherOutlet = Outlet::create(['name' => 'Outlet Lain']);
        $owner = $this->createOwner('owner-product-cost-switcher@karsa.local');

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $activeOutlet->id])
            ->get(route('product-costs'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('ProductCosts/Index')
                ->where('outlet.id', $activeOutlet->id)
                ->where('outletContext.currentId', $activeOutlet->id)
                ->where('outletContext.list', fn ($outlets) => $outlets->count() === 2
                    && $outlets->contains(fn ($outlet) => $outlet['id'] === $activeOutlet->id)
                    && $outlets->contains(fn ($outlet) => $outlet['id'] === $otherOutlet->id))
            );
    }

    public function test_finance_keeps_outlet_switcher_context_when_page_has_outlet_prop(): void
    {
        $activeOutlet = Outlet::create(['name' => 'Outlet Finance']);
        $otherOutlet = Outlet::create(['name' => 'Outlet Pembanding']);
        $owner = $this->createOwner('owner-finance-switcher@karsa.local');

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $activeOutlet->id])
            ->get(route('finance'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Finance/Index')
                ->where('outlet.id', $activeOutlet->id)
                ->where('outletContext.currentId', $activeOutlet->id)
                ->where('outletContext.list', fn ($outlets) => $outlets->count() === 2
                    && $outlets->contains(fn ($outlet) => $outlet['id'] === $activeOutlet->id)
                    && $outlets->contains(fn ($outlet) => $outlet['id'] === $otherOutlet->id))
            );
    }

    private function createOwner(string $email): User
    {
        return User::create([
            'email' => $email,
            'password_hash' => Hash::make('password'),
            'display_name' => 'Owner Switcher',
            'role' => 'OWNER',
            'is_active' => true,
        ]);
    }
}
