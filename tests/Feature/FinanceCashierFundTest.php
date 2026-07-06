<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\Transaction;
use App\Models\User;
use App\Services\PettyCashService;
use App\Services\ShiftService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class FinanceCashierFundTest extends TestCase
{
    use RefreshDatabase;

    public function test_cashier_fund_is_fixed_per_shift_and_reduces_container_cash(): void
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

            Transaction::create([
                'outlet_id' => $outlet->id,
                'shift_id' => $shift->id,
                'invoice_number' => 'INV-FINANCE-001',
                'total_amount' => 200000,
                'payment_method' => 'CASH',
                'payment_status' => 'PAID',
                'paid_at' => Carbon::now(),
                'created_at' => Carbon::now(),
            ]);

            $cashierTopup = app(PettyCashService::class)->createExpense([
                'outlet_id' => $outlet->id,
                'amount' => 20000,
                'category' => 'Tambah Kas',
                'payment_method' => 'CASH',
                'cash_flow' => 'IN',
                'description' => 'Tambahan pecahan kecil',
            ]);

            app(PettyCashService::class)->createExpense([
                'outlet_id' => $outlet->id,
                'amount' => 30000,
                'category' => 'Operasional',
                'payment_method' => 'CASH',
                'cash_flow' => 'OUT',
                'description' => 'Beli es batu',
            ]);

            $this->assertSame('Tambah Kas', $cashierTopup->category);
            $this->assertSame('OUT', $cashierTopup->cash_flow);

            $shiftSummary = app(ShiftService::class)->moneySummary($shift->fresh());

            $this->assertSame(20000.0, $shiftSummary['cash']['cashier_topups']);
            $this->assertSame(200000.0, $shiftSummary['cash']['expected']);

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
                    ->where('summary.shiftCount', 1)
                    ->where('summary.standardCashierFund', 50000)
                    ->where('summary.cashierTopups', 20000)
                    ->where('summary.cashierFundTotal', 70000)
                    ->where('summary.expenseTotal', 30000)
                    ->where('summary.cashContainerAfterWithdrawals', 100000)
                );
        } finally {
            Carbon::setTestNow();
        }
    }
}
