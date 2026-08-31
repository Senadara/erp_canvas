<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\User;
use App\Services\ShiftService;
use App\Services\TransactionService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ShiftReceivableVisibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_debt_payment_on_next_day_is_reported_on_payment_shift_without_changing_previous_shift_discrepancy(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Toast']);
        $owner = User::create([
            'email' => 'owner-shift-receivable@karsa.local',
            'password_hash' => Hash::make('password'),
            'display_name' => 'Owner Shift Receivable',
            'role' => 'OWNER',
            'is_active' => true,
        ]);
        $product = Product::create([
            'outlet_id' => $outlet->id,
            'name' => 'Roti Toast',
            'category' => 'Makanan',
            'price' => 10000,
            'hpp' => 0,
            'is_active' => true,
        ]);

        Carbon::setTestNow(Carbon::parse('2026-08-31 08:00:00', 'Asia/Jakarta'));

        try {
            $yesterdayShift = app(ShiftService::class)->openShift($outlet->id, 50000, 'Shift Kemarin', $owner->id);

            Carbon::setTestNow(Carbon::parse('2026-08-31 09:00:00', 'Asia/Jakarta'));
            app(TransactionService::class)->processSale([
                'outlet_id' => $outlet->id,
                'shift_id' => $yesterdayShift->id,
                'payment_status' => 'PAID',
                'payment_method' => 'CASH',
                'cash_received' => 20000,
                'items' => [
                    ['product_id' => $product->id, 'product_name' => $product->name, 'qty_porsi' => 2, 'price_per_porsi' => 10000],
                ],
            ]);

            Carbon::setTestNow(Carbon::parse('2026-08-31 09:10:00', 'Asia/Jakarta'));
            $debtTransaction = app(TransactionService::class)->processSale([
                'outlet_id' => $outlet->id,
                'shift_id' => $yesterdayShift->id,
                'payment_status' => 'UNPAID',
                'items' => [
                    ['product_id' => $product->id, 'product_name' => $product->name, 'qty_porsi' => 1, 'price_per_porsi' => 10000],
                ],
            ]);

            Carbon::setTestNow(Carbon::parse('2026-08-31 12:00:00', 'Asia/Jakarta'));
            app(ShiftService::class)->closeShift($yesterdayShift->id, 70000, 'Tutup tanpa selisih', $owner->id);

            $yesterdaySummaryBeforePayment = app(ShiftService::class)->moneySummary($yesterdayShift->fresh());
            $this->assertSame(70000.0, (float) $yesterdaySummaryBeforePayment['cash']['expected']);
            $this->assertSame(20000.0, (float) $yesterdaySummaryBeforePayment['cash']['current_sales']);
            $this->assertSame(10000.0, (float) $yesterdaySummaryBeforePayment['receivables']['created_total']);
            $this->assertSame(10000.0, (float) $yesterdaySummaryBeforePayment['receivables']['remaining_total']);

            Carbon::setTestNow(Carbon::parse('2026-09-01 08:00:00', 'Asia/Jakarta'));
            $todayShift = app(ShiftService::class)->openShift($outlet->id, 50000, 'Shift Hari Ini', $owner->id);

            Carbon::setTestNow(Carbon::parse('2026-09-01 09:00:00', 'Asia/Jakarta'));
            app(TransactionService::class)->processSale([
                'outlet_id' => $outlet->id,
                'shift_id' => $todayShift->id,
                'payment_status' => 'PAID',
                'payment_method' => 'CASH',
                'cash_received' => 10000,
                'items' => [
                    ['product_id' => $product->id, 'product_name' => $product->name, 'qty_porsi' => 1, 'price_per_porsi' => 10000],
                ],
            ]);

            Carbon::setTestNow(Carbon::parse('2026-09-01 09:15:00', 'Asia/Jakarta'));
            $this->actingAs($owner)
                ->withSession(['outlet_id' => $outlet->id])
                ->post(route('cashier.pay-debt', $debtTransaction->id), [
                    'payment_method' => 'CASH',
                    'cash_received' => 10000,
                ])
                ->assertRedirect()
                ->assertSessionHasNoErrors();

            $paidDebt = $debtTransaction->fresh();
            $this->assertSame($todayShift->id, $paidDebt->payment_shift_id);

            $yesterdayShift = app(ShiftService::class)->applyComputedMoneySummary($yesterdayShift->fresh());
            $todaySummary = app(ShiftService::class)->moneySummary($todayShift->fresh());

            $this->assertSame(70000.0, (float) $yesterdayShift->expected_cash);
            $this->assertSame(0.0, (float) $yesterdayShift->discrepancy);
            $this->assertSame(70000.0, (float) $todaySummary['cash']['expected']);
            $this->assertSame(10000.0, (float) $todaySummary['cash']['current_sales']);
            $this->assertSame(10000.0, (float) $todaySummary['cash']['debt_collections']);
            $this->assertSame(10000.0, (float) $todaySummary['receivables']['collected_total']);

            $this->actingAs($owner)
                ->withSession(['outlet_id' => $outlet->id])
                ->get(route('shifts.show', $yesterdayShift->id))
                ->assertOk()
                ->assertJsonPath('cash_summary.cash.expected', 70000)
                ->assertJsonPath('cash_summary.cash.current_sales', 20000)
                ->assertJsonPath('cash_summary.cash.debt_collections', 0)
                ->assertJsonPath('receivable_summary.created_total', 10000)
                ->assertJsonPath('receivable_summary.settled_later_total', 10000)
                ->assertJsonPath('receivable_summary.remaining_total', 0);

            $this->actingAs($owner)
                ->withSession(['outlet_id' => $outlet->id])
                ->get(route('shifts.show', $todayShift->id))
                ->assertOk()
                ->assertJsonPath('cash_summary.cash.expected', 70000)
                ->assertJsonPath('cash_summary.cash.current_sales', 10000)
                ->assertJsonPath('cash_summary.cash.debt_collections', 10000)
                ->assertJsonPath('cash_received_total', 20000)
                ->assertJsonPath('receivable_summary.collected_total', 10000)
                ->assertJsonPath('receivable_summary.collected.0.invoice_number', $paidDebt->invoice_number);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_debt_payment_requires_an_open_shift(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Tanpa Shift']);
        $owner = User::create([
            'email' => 'owner-no-open-shift@karsa.local',
            'password_hash' => Hash::make('password'),
            'display_name' => 'Owner No Open Shift',
            'role' => 'OWNER',
            'is_active' => true,
        ]);
        $transaction = Transaction::create([
            'outlet_id' => $outlet->id,
            'invoice_number' => 'INV-NO-SHIFT-001',
            'total_amount' => 10000,
            'payment_status' => 'UNPAID',
            'created_at' => Carbon::parse('2026-09-01 08:00:00', 'Asia/Jakarta'),
        ]);

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('cashier.pay-debt', $transaction->id), [
                'payment_method' => 'CASH',
                'cash_received' => 10000,
            ])
            ->assertSessionHasErrors('error');

        $this->assertSame('UNPAID', $transaction->fresh()->payment_status);
    }
}
