<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\PettyCash;
use App\Models\StockItem;
use App\Models\User;
use App\Services\ShiftService;
use App\Services\StockService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class FinanceCashierFundTest extends TestCase
{
    use RefreshDatabase;

    public function test_restock_funding_source_keeps_cashier_and_private_money_separate(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-06 09:00:00'));

        try {
            $outlet = Outlet::create(['name' => 'Outlet Utama']);
            $owner = User::create([
                'email' => 'owner-finance@karsa.local',
                'password_hash' => Hash::make('password'),
                'display_name' => 'Owner Finance',
                'role' => 'OWNER',
                'is_active' => true,
            ]);

            $shift = app(ShiftService::class)->openShift($outlet->id, 125000, 'Shift Pagi');

            $this->assertSame(ShiftService::STANDARD_OPENING_CASH, (int) $shift->opening_cash);

            $stock = StockItem::create([
                'outlet_id' => $outlet->id,
                'name' => 'Dimsum Ori',
                'current_stock_biji' => 0,
                'unit_name' => 'pcs',
                'min_stock_alert' => 5,
                'trackable' => true,
                'counting_basis' => 'BIJI',
                'min_restock_qty' => 10,
                'restock_price' => 50000,
            ]);

            app(StockService::class)->addStock($stock->id, 10, 'Bayar dari laci', $outlet->id, 'CASHIER_CASH');
            app(StockService::class)->addStock($stock->id, 10, 'Talangan owner', $outlet->id, 'PRIVATE_CASH');

            $shiftSummary = app(ShiftService::class)->moneySummary($shift->fresh());

            $this->assertSame(50000.0, $shiftSummary['cash']['expenses']);
            $this->assertSame(50000.0, $shiftSummary['outside']['expenses']);
            $this->assertSame(0.0, $shiftSummary['cash']['expected']);

            $this->assertDatabaseHas('restock_logs', [
                'stock_item_id' => $stock->id,
                'fund_source' => 'CASHIER_CASH',
                'restock_cost' => 50000,
            ]);
            $this->assertDatabaseHas('restock_logs', [
                'stock_item_id' => $stock->id,
                'fund_source' => 'PRIVATE_CASH',
                'restock_cost' => 50000,
            ]);
            $this->assertSame(1, PettyCash::where('category', 'RESTOCK')->where('payment_method', 'CASH')->count());
            $this->assertSame(1, PettyCash::where('category', 'RESTOCK')->where('payment_method', 'PRIVATE')->count());

            $this->actingAs($owner)
                ->withSession(['outlet_id' => $outlet->id])
                ->get(route('finance', [
                    'date_from' => '2026-07-06',
                    'date_to' => '2026-07-06',
                ]))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Finance/Index')
                    ->where('summary.standardOpeningCash', 50000)
                    ->where('summary.expenseTotal', 100000)
                    ->where('summary.cashExpense', 50000)
                    ->where('summary.outsideExpense', 50000)
                    ->where('summary.cashRestockExpense', 50000)
                    ->where('summary.privateRestockExpense', 50000)
                );
        } finally {
            Carbon::setTestNow();
        }
    }
}
