<?php

namespace Tests\Feature;

use App\Models\FinanceWithdrawalSnapshot;
use App\Models\Outlet;
use App\Models\PettyCash;
use App\Models\Product;
use App\Models\StockItem;
use App\Models\Transaction;
use App\Models\User;
use App\Services\PettyCashService;
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

    public function test_cashier_topup_increases_shift_cash_but_reduces_outlet_finance_allocation(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-06 10:00:00'));

        try {
            $outlet = Outlet::create(['name' => 'Outlet Utama']);
            $owner = User::create([
                'email' => 'owner-topup@karsa.local',
                'password_hash' => Hash::make('password'),
                'display_name' => 'Owner Topup',
                'role' => 'OWNER',
                'is_active' => true,
            ]);

            $shift = app(ShiftService::class)->openShift($outlet->id, 50000, 'Shift Pagi');
            $topup = app(PettyCashService::class)->createExpense([
                'outlet_id' => $outlet->id,
                'amount' => 20000,
                'category' => 'Tambah Kas',
                'payment_method' => 'CASH',
                'cash_flow' => 'OUT',
                'description' => 'Tambah pecahan kecil',
            ]);

            $this->assertSame('IN', $topup->cash_flow);

            $shiftSummary = app(ShiftService::class)->moneySummary($shift->fresh());

            $this->assertSame(20000.0, $shiftSummary['cash']['cashier_topups']);
            $this->assertSame(20000.0, $shiftSummary['cash']['additions']);
            $this->assertSame(70000.0, $shiftSummary['cash']['expected']);

            $this->actingAs($owner)
                ->withSession(['outlet_id' => $outlet->id])
                ->get(route('finance', [
                    'date_from' => '2026-07-06',
                    'date_to' => '2026-07-06',
                ]))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->where('summary.omzet', 0)
                    ->where('summary.cashierTopups', 20000)
                    ->where('summary.expenseTotal', 0)
                    ->where('summary.netAfterAllocations', -20000)
                    ->where('summary.cashDrawerNet', 0)
                    ->where('summary.cleanFinance', 0)
                );
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_owner_withdrawal_creates_finance_history_snapshot(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-07 12:00:00'));

        try {
            $outlet = Outlet::create(['name' => 'Outlet Utama']);
            $owner = User::create([
                'email' => 'owner-withdrawal-history@karsa.local',
                'password_hash' => Hash::make('password'),
                'display_name' => 'Owner Withdrawal',
                'role' => 'OWNER',
                'is_active' => true,
            ]);
            $product = Product::create([
                'outlet_id' => $outlet->id,
                'name' => 'Dimsum Ori',
                'category' => 'Dimsum',
                'price' => 20000,
                'hpp' => 8000,
                'is_active' => true,
            ]);
            $transaction = Transaction::create([
                'outlet_id' => $outlet->id,
                'invoice_number' => 'INV-WD-001',
                'total_amount' => 100000,
                'payment_method' => 'CASH',
                'payment_status' => 'PAID',
                'paid_at' => Carbon::parse('2026-07-07 09:00:00'),
                'created_at' => Carbon::parse('2026-07-07 09:00:00'),
            ]);
            $transaction->items()->create([
                'product_id' => $product->id,
                'product_name' => $product->name,
                'qty_porsi' => 5,
                'price_per_porsi' => 20000,
                'subtotal' => 100000,
            ]);

            app(PettyCashService::class)->createExpense([
                'outlet_id' => $outlet->id,
                'amount' => 20000,
                'category' => 'Operasional',
                'payment_method' => 'CASH',
                'cash_flow' => 'OUT',
                'description' => 'Beli plastik',
                'date' => Carbon::parse('2026-07-07 10:00:00'),
            ]);

            $this->actingAs($owner)
                ->withSession(['outlet_id' => $outlet->id])
                ->post(route('finance.withdraw'), [
                    'amount' => 50000,
                    'payment_method' => 'CASH',
                    'description' => 'Setoran siang',
                    'date' => '2026-07-07 12:00:00',
                ])
                ->assertRedirect();

            $snapshot = FinanceWithdrawalSnapshot::firstOrFail();

            $this->assertSame(100000.0, (float) $snapshot->omzet_total);
            $this->assertSame(20000.0, (float) $snapshot->expense_total);
            $this->assertSame(40000.0, (float) $snapshot->hpp_total);
            $this->assertSame(40000.0, (float) $snapshot->net_after_allocations);
            $this->assertSame(130000.0, (float) $snapshot->cash_balance_before);
            $this->assertSame(80000.0, (float) $snapshot->available_before);
            $this->assertSame(30000.0, (float) $snapshot->remaining_after);

            $this->actingAs($owner)
                ->withSession(['outlet_id' => $outlet->id])
                ->get(route('finance', [
                    'date_from' => '2026-07-07',
                    'date_to' => '2026-07-07',
                ]))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Finance/Index')
                    ->where('summary.omzet', 100000)
                    ->where('summary.expenseTotal', 20000)
                    ->where('summary.cashDrawerNet', 30000)
                    ->where('summary.cleanFinance', 30000)
                    ->where('summary.dailySalesAverage', 100000)
                    ->where('summary.dailyExpenseAverage', 20000)
                    ->where('summary.resetAfterWithdrawal', false)
                    ->where('periodSummary.omzet', 100000)
                    ->where('periodSummary.expenseTotal', 20000)
                    ->where('periodSummary.withdrawTotal', 50000)
                    ->where('withdrawalHistory.0.amount', 50000)
                    ->where('withdrawalHistory.0.omzet', 100000)
                    ->where('withdrawalHistory.0.expense_total', 20000)
                    ->where('withdrawalHistory.0.net_after_allocations', 40000)
                    ->where('withdrawalHistory.0.available_before', 80000)
                    ->where('withdrawalHistory.0.remaining_after', 30000)
                    ->where('withdrawalHistory.0.source', 'SNAPSHOT')
                );
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_multiple_owner_withdrawals_reduce_remaining_cash_drawer_balance(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-07 13:10:00'));

        try {
            $outlet = Outlet::create(['name' => 'Outlet Utama']);
            $owner = User::create([
                'email' => 'owner-withdrawal-balance@karsa.local',
                'password_hash' => Hash::make('password'),
                'display_name' => 'Owner Balance',
                'role' => 'OWNER',
                'is_active' => true,
            ]);
            $product = Product::create([
                'outlet_id' => $outlet->id,
                'name' => 'Dimsum Ori',
                'category' => 'Dimsum',
                'price' => 20000,
                'hpp' => 8000,
                'is_active' => true,
            ]);
            $transaction = Transaction::create([
                'outlet_id' => $outlet->id,
                'invoice_number' => 'INV-WD-002',
                'total_amount' => 100000,
                'payment_method' => 'CASH',
                'payment_status' => 'PAID',
                'paid_at' => Carbon::parse('2026-07-07 09:00:00'),
                'created_at' => Carbon::parse('2026-07-07 09:00:00'),
            ]);
            $transaction->items()->create([
                'product_id' => $product->id,
                'product_name' => $product->name,
                'qty_porsi' => 5,
                'price_per_porsi' => 20000,
                'subtotal' => 100000,
            ]);

            app(PettyCashService::class)->createExpense([
                'outlet_id' => $outlet->id,
                'amount' => 20000,
                'category' => 'Operasional',
                'payment_method' => 'CASH',
                'cash_flow' => 'OUT',
                'description' => 'Beli plastik',
                'date' => Carbon::parse('2026-07-07 10:00:00'),
            ]);

            $this->actingAs($owner)
                ->withSession(['outlet_id' => $outlet->id])
                ->post(route('finance.withdraw'), [
                    'amount' => 50000,
                    'payment_method' => 'CASH',
                    'description' => 'Setoran pertama',
                    'date' => '2026-07-07 12:00:00',
                ])
                ->assertRedirect();

            $this->actingAs($owner)
                ->withSession(['outlet_id' => $outlet->id])
                ->post(route('finance.withdraw'), [
                    'amount' => 10000,
                    'payment_method' => 'CASH',
                    'description' => 'Setoran kedua',
                    'date' => '2026-07-07 13:00:00',
                ])
                ->assertRedirect();

            $secondSnapshot = FinanceWithdrawalSnapshot::query()
                ->orderByDesc('period_end')
                ->firstOrFail();

            $this->assertSame(30000.0, (float) $secondSnapshot->available_before);
            $this->assertSame(20000.0, (float) $secondSnapshot->remaining_after);

            $this->actingAs($owner)
                ->withSession(['outlet_id' => $outlet->id])
                ->get(route('finance', [
                    'date_from' => '2026-07-07',
                    'date_to' => '2026-07-07',
                ]))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Finance/Index')
                    ->where('summary.cashDrawerNet', 20000)
                    ->where('summary.cleanFinance', 20000)
                    ->where('summary.omzet', 100000)
                    ->where('summary.expenseTotal', 20000)
                    ->where('summary.dailySalesAverage', 100000)
                    ->where('summary.dailyExpenseAverage', 20000)
                    ->where('summary.resetAfterWithdrawal', false)
                    ->where('periodSummary.withdrawTotal', 60000)
                    ->where('withdrawalHistory.0.amount', 10000)
                    ->where('withdrawalHistory.0.available_before', 30000)
                    ->where('withdrawalHistory.0.remaining_after', 20000)
                );
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_current_cashier_tab_uses_local_finance_time_after_withdrawal(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-07 05:10:00', 'UTC'));

        try {
            $outlet = Outlet::create(['name' => 'Outlet Utama']);
            $owner = User::create([
                'email' => 'owner-local-time@karsa.local',
                'password_hash' => Hash::make('password'),
                'display_name' => 'Owner Local Time',
                'role' => 'OWNER',
                'is_active' => true,
            ]);
            $product = Product::create([
                'outlet_id' => $outlet->id,
                'name' => 'Dimsum Ori',
                'category' => 'Dimsum',
                'price' => 20000,
                'hpp' => 8000,
                'is_active' => true,
            ]);
            $transaction = Transaction::create([
                'outlet_id' => $outlet->id,
                'invoice_number' => 'INV-WD-LOCAL',
                'total_amount' => 100000,
                'payment_method' => 'CASH',
                'payment_status' => 'PAID',
                'paid_at' => Carbon::parse('2026-07-07 09:00:00'),
                'created_at' => Carbon::parse('2026-07-07 09:00:00'),
            ]);
            $transaction->items()->create([
                'product_id' => $product->id,
                'product_name' => $product->name,
                'qty_porsi' => 5,
                'price_per_porsi' => 20000,
                'subtotal' => 100000,
            ]);

            app(PettyCashService::class)->createExpense([
                'outlet_id' => $outlet->id,
                'amount' => 20000,
                'category' => 'Operasional',
                'payment_method' => 'CASH',
                'cash_flow' => 'OUT',
                'description' => 'Beli plastik',
                'date' => Carbon::parse('2026-07-07 10:00:00'),
            ]);

            $this->actingAs($owner)
                ->withSession(['outlet_id' => $outlet->id])
                ->post(route('finance.withdraw'), [
                    'amount' => 50000,
                    'payment_method' => 'CASH',
                    'description' => 'Setoran jam lokal',
                    'date' => '2026-07-07 12:00:00',
                ])
                ->assertRedirect();

            $this->actingAs($owner)
                ->withSession(['outlet_id' => $outlet->id])
                ->get(route('finance', [
                    'date_from' => '2026-07-07',
                    'date_to' => '2026-07-07',
                ]))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Finance/Index')
                    ->where('summary.cashDrawerNet', 30000)
                    ->where('summary.cleanFinance', 30000)
                    ->where('summary.omzet', 100000)
                    ->where('summary.expenseTotal', 20000)
                    ->where('summary.dailySalesAverage', 100000)
                    ->where('summary.dailyExpenseAverage', 20000)
                    ->where('summary.resetAfterWithdrawal', false)
                    ->where('periodSummary.withdrawTotal', 50000)
                    ->where('withdrawalHistory.0.remaining_after', 30000)
                );
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_qris_balance_updates_on_current_cashier_tab_after_withdrawal(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-07 13:10:00', 'Asia/Jakarta'));

        try {
            $outlet = Outlet::create(['name' => 'Outlet Utama']);
            $owner = User::create([
                'email' => 'owner-qris-balance@karsa.local',
                'password_hash' => Hash::make('password'),
                'display_name' => 'Owner QRIS',
                'role' => 'OWNER',
                'is_active' => true,
            ]);
            $product = Product::create([
                'outlet_id' => $outlet->id,
                'name' => 'Dimsum Ori',
                'category' => 'Dimsum',
                'price' => 20000,
                'hpp' => 8000,
                'is_active' => true,
            ]);

            $cashTransaction = Transaction::create([
                'outlet_id' => $outlet->id,
                'invoice_number' => 'INV-QRIS-CASH',
                'total_amount' => 80000,
                'payment_method' => 'CASH',
                'payment_status' => 'PAID',
                'paid_at' => Carbon::parse('2026-07-07 09:00:00'),
                'created_at' => Carbon::parse('2026-07-07 09:00:00'),
            ]);
            $cashTransaction->items()->create([
                'product_id' => $product->id,
                'product_name' => $product->name,
                'qty_porsi' => 4,
                'price_per_porsi' => 20000,
                'subtotal' => 80000,
            ]);

            $qrisTransaction = Transaction::create([
                'outlet_id' => $outlet->id,
                'invoice_number' => 'INV-QRIS-LOWER',
                'total_amount' => 100000,
                'payment_method' => 'qris',
                'payment_status' => 'PAID',
                'paid_at' => Carbon::parse('2026-07-07 09:30:00'),
                'created_at' => Carbon::parse('2026-07-07 09:30:00'),
            ]);
            $qrisTransaction->items()->create([
                'product_id' => $product->id,
                'product_name' => $product->name,
                'qty_porsi' => 5,
                'price_per_porsi' => 20000,
                'subtotal' => 100000,
            ]);

            $this->actingAs($owner)
                ->withSession(['outlet_id' => $outlet->id])
                ->post(route('finance.withdraw'), [
                    'amount' => 50000,
                    'payment_method' => 'CASH',
                    'description' => 'Tarik cash saja',
                    'date' => '2026-07-07 12:00:00',
                ])
                ->assertRedirect();

            $newQrisTransaction = Transaction::create([
                'outlet_id' => $outlet->id,
                'invoice_number' => 'INV-QRIS-AFTER',
                'total_amount' => 40000,
                'payment_method' => 'QRIS',
                'payment_status' => 'PAID',
                'paid_at' => Carbon::parse('2026-07-07 12:30:00'),
                'created_at' => Carbon::parse('2026-07-07 12:30:00'),
            ]);
            $newQrisTransaction->items()->create([
                'product_id' => $product->id,
                'product_name' => $product->name,
                'qty_porsi' => 2,
                'price_per_porsi' => 20000,
                'subtotal' => 40000,
            ]);

            $this->actingAs($owner)
                ->withSession(['outlet_id' => $outlet->id])
                ->get(route('finance', [
                    'date_from' => '2026-07-07',
                    'date_to' => '2026-07-07',
                ]))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Finance/Index')
                    ->where('summary.cashDrawerNet', 30000)
                    ->where('summary.qrisSales', 140000)
                    ->where('summary.qrisBalanceActual', 140000)
                    ->where('summary.cleanFinance', 170000)
                    ->where('summary.omzet', 220000)
                    ->where('summary.dailySalesAverage', 220000)
                    ->where('periodSummary.qrisSales', 140000)
                    ->where('periodSummary.withdrawTotal', 50000)
                    ->where('withdrawalHistory.0.qris_sales', 100000)
                );
        } finally {
            Carbon::setTestNow();
        }
    }

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
