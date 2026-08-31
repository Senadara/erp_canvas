<?php

namespace Tests\Feature;

use App\Models\Conversion;
use App\Models\EmployeeSalaryPayment;
use App\Models\Outlet;
use App\Models\PettyCash;
use App\Models\Product;
use App\Models\ShiftRecord;
use App\Models\StockItem;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use App\Services\ProductCostService;
use App\Services\ReportService;
use App\Services\TransactionService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ProductCostManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_sales_snapshot_uses_latest_bom_cost_and_preserves_old_transactions(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-01 09:00:00'));

        try {
            $outlet = Outlet::create(['name' => 'Outlet HPP']);
            $product = $this->createProduct($outlet->id, 'Dimsum Ori', 10000, 4000);
            $material = $this->createStock($outlet->id, 'Adonan Dimsum', 100, 10, 10000, 'MATERIAL');
            $packaging = $this->createStock($outlet->id, 'Wadah Mika', 100, 100, 50000, 'PACKAGING');

            Conversion::create(['product_id' => $product->id, 'stock_item_id' => $material->id, 'ratio' => 2]);
            Conversion::create(['product_id' => $product->id, 'stock_item_id' => $packaging->id, 'ratio' => 1]);

            $first = app(TransactionService::class)->processSale([
                'outlet_id' => $outlet->id,
                'items' => [['product_id' => $product->id, 'qty_porsi' => 2]],
                'payment_status' => 'PAID',
                'payment_method' => 'CASH',
            ]);
            $firstItem = $first->items->first();

            $this->assertSame(2500.0, (float) $firstItem->hpp_per_porsi);
            $this->assertSame(5000.0, (float) $firstItem->hpp_total);
            $this->assertSame(ProductCostService::SOURCE_BOM_LATEST, $firstItem->hpp_source);

            $material->update(['restock_price' => 20000]);
            Carbon::setTestNow(Carbon::parse('2026-08-01 10:00:00'));

            $second = app(TransactionService::class)->processSale([
                'outlet_id' => $outlet->id,
                'items' => [['product_id' => $product->id, 'qty_porsi' => 1]],
                'payment_status' => 'PAID',
                'payment_method' => 'CASH',
            ]);
            $secondItem = $second->items->first();

            $this->assertSame(5000.0, (float) $firstItem->fresh()->hpp_total);
            $this->assertSame(4500.0, (float) $secondItem->hpp_per_porsi);
            $this->assertSame(4500.0, (float) $secondItem->hpp_total);

            $report = app(ReportService::class)->getProductPerformance(
                $outlet->id,
                Carbon::parse('2026-08-01'),
                Carbon::parse('2026-08-01'),
            );

            $this->assertSame(3, $report['best_seller']['quantity_sold']);
            $this->assertSame(9500.0, (float) $report['best_seller']['estimated_hpp']);
            $this->assertSame(20500.0, (float) $report['best_seller']['gross_profit']);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_product_cost_page_and_bulk_packaging_component_are_owner_scoped(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Biaya Produk']);
        $owner = $this->createUser('owner-product-cost@karsa.local', 'OWNER');
        $staff = $this->createUser('staff-product-cost@karsa.local', 'STAFF');
        $product = $this->createProduct($outlet->id, 'Dimsum Ayam', 12000, 3000);
        $material = $this->createStock($outlet->id, 'Adonan Ayam', 100, 10, 10000, 'MATERIAL');
        $packaging = $this->createStock($outlet->id, 'Paper Bowl', 100, 100, 30000, 'PACKAGING');

        Conversion::create(['product_id' => $product->id, 'stock_item_id' => $material->id, 'ratio' => 2]);

        $this->actingAs($staff)
            ->withSession(['outlet_id' => $outlet->id])
            ->get(route('product-costs'))
            ->assertForbidden();

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->get(route('product-costs'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('ProductCosts/Index')
                ->where('report.summary.product_count', 1)
                ->where('report.summary.without_packaging_count', 1)
                ->has('report.packaging_stocks', 1)
            );

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('product-costs.bulk-components'), [
                'stock_item_id' => $packaging->id,
                'product_ids' => [$product->id],
                'ratio' => 1,
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('conversions', [
            'product_id' => $product->id,
            'stock_item_id' => $packaging->id,
            'ratio' => 1,
        ]);

        $cost = app(ProductCostService::class)->calculateProduct($product->fresh('conversions.stockItem'), $outlet->id);

        $this->assertSame([], $cost['cost_warnings']);
        $this->assertSame(2300.0, (float) $cost['material_hpp']);
    }

    public function test_bulk_components_can_use_different_container_per_product(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Wadah Berbeda']);
        $owner = $this->createUser('owner-different-container@karsa.local', 'OWNER');
        $smallProduct = $this->createProduct($outlet->id, 'Dimsum Mini', 10000, 0);
        $largeProduct = $this->createProduct($outlet->id, 'Dimsum Jumbo', 18000, 0);
        $smallContainer = $this->createStock($outlet->id, 'Wadah Kecil', 100, 100, 30000, 'PACKAGING');
        $largeContainer = $this->createStock($outlet->id, 'Wadah Besar', 100, 100, 80000, 'PACKAGING');

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->get(route('product-costs'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('report.component_stocks', 2)
                ->has('report.packaging_stocks', 2)
            );

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('product-costs.bulk-components'), [
                'items' => [
                    ['product_id' => $smallProduct->id, 'stock_item_id' => $smallContainer->id, 'ratio' => 1],
                    ['product_id' => $largeProduct->id, 'stock_item_id' => $largeContainer->id, 'ratio' => 1],
                ],
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('conversions', [
            'product_id' => $smallProduct->id,
            'stock_item_id' => $smallContainer->id,
            'ratio' => 1,
        ]);
        $this->assertDatabaseHas('conversions', [
            'product_id' => $largeProduct->id,
            'stock_item_id' => $largeContainer->id,
            'ratio' => 1,
        ]);

        $smallCost = app(ProductCostService::class)->calculateProduct($smallProduct->fresh('conversions.stockItem'), $outlet->id);
        $largeCost = app(ProductCostService::class)->calculateProduct($largeProduct->fresh('conversions.stockItem'), $outlet->id);

        $this->assertSame(300.0, (float) $smallCost['material_hpp']);
        $this->assertSame(800.0, (float) $largeCost['material_hpp']);
    }

    public function test_finance_profit_uses_snapshot_hpp_without_double_counting_restock_cashflow(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-03 23:00:00', 'Asia/Jakarta'));

        try {
            $outlet = Outlet::create(['name' => 'Outlet Finance HPP']);
            $owner = $this->createUser('owner-finance-product-cost@karsa.local', 'OWNER');
            $product = $this->createProduct($outlet->id, 'Dimsum Profit', 10000, 1000);

            $transaction = Transaction::create([
                'outlet_id' => $outlet->id,
                'invoice_number' => 'INV-HPP-001',
                'total_amount' => 100000,
                'payment_method' => 'CASH',
                'payment_status' => 'PAID',
                'paid_at' => Carbon::parse('2026-08-03 09:00:00'),
                'created_at' => Carbon::parse('2026-08-03 09:00:00'),
            ]);

            TransactionItem::create([
                'transaction_id' => $transaction->id,
                'product_id' => $product->id,
                'product_name' => $product->name,
                'qty_porsi' => 10,
                'price_per_porsi' => 10000,
                'subtotal' => 100000,
                'hpp_per_porsi' => 3000,
                'hpp_total' => 30000,
                'hpp_source' => ProductCostService::SOURCE_BOM_LATEST,
                'hpp_snapshot' => ['source' => ProductCostService::SOURCE_BOM_LATEST],
            ]);

            PettyCash::create([
                'outlet_id' => $outlet->id,
                'amount' => 50000,
                'category' => 'RESTOCK',
                'payment_method' => 'CASH',
                'cash_flow' => 'OUT',
                'description' => 'Restok bahan',
                'created_at' => Carbon::parse('2026-08-03 10:00:00'),
            ]);
            PettyCash::create([
                'outlet_id' => $outlet->id,
                'amount' => 10000,
                'category' => 'Operasional',
                'payment_method' => 'CASH',
                'cash_flow' => 'OUT',
                'description' => 'Operasional',
                'created_at' => Carbon::parse('2026-08-03 11:00:00'),
            ]);

            $this->actingAs($owner)
                ->withSession(['outlet_id' => $outlet->id])
                ->get(route('finance', [
                    'date_from' => '2026-08-03',
                    'date_to' => '2026-08-03',
                ]))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Finance/Index')
                    ->where('summary.hpp', 30000)
                    ->where('summary.grossProfit', 70000)
                    ->where('summary.expenseTotal', 60000)
                    ->where('summary.inventoryExpenseTotal', 50000)
                    ->where('summary.operatingExpenseTotal', 10000)
                    ->where('summary.netProfit', 60000)
                    ->where('summary.cashDrawerNet', 40000)
                );
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_product_cost_payroll_evaluation_prorates_monthly_salary_for_period(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Evaluasi Gaji']);
        $staff = $this->createUser('staff-cost-payroll@karsa.local', 'STAFF');

        ShiftRecord::create([
            'outlet_id' => $outlet->id,
            'name' => 'Shift Evaluasi',
            'opened_by' => $staff->id,
            'closed_by' => $staff->id,
            'opened_at' => Carbon::parse('2026-07-01 08:00:00'),
            'closed_at' => Carbon::parse('2026-07-01 16:00:00'),
            'opening_cash' => 50000,
            'expected_cash' => 100000,
            'actual_cash' => 100000,
            'status' => 'CLOSED',
        ]);

        EmployeeSalaryPayment::create([
            'employee_id' => $staff->id,
            'employee_name' => $staff->display_name,
            'period_start' => Carbon::parse('2026-07-01'),
            'period_end' => Carbon::parse('2026-07-31'),
            'salary_type' => 'MONTHLY',
            'monthly_amount' => 3100000,
            'payable_days' => 1,
            'work_days' => 1,
            'shift_count' => 1,
            'base_amount' => 3100000,
            'bonus_amount' => 0,
            'deduction_amount' => 0,
            'total_amount' => 3100000,
            'shift_snapshot' => [],
            'paid_at' => Carbon::parse('2026-07-31'),
        ]);

        $report = app(ProductCostService::class)->dashboardData(
            $outlet->id,
            Carbon::parse('2026-07-01')->startOfDay(),
            Carbon::parse('2026-07-01')->endOfDay(),
        );

        $this->assertEquals(100000, $report['payroll_evaluation']['salary_total']);
    }

    public function test_product_cost_payroll_evaluation_includes_daily_salary_with_hpp_snapshot(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Simulasi Gaji HPP']);
        $staff = $this->createUser('staff-daily-cost@karsa.local', 'STAFF');
        $product = $this->createProduct($outlet->id, 'Dimsum Simulasi', 10000, 4000);

        $shiftSnapshot = [];
        foreach (['2026-07-01', '2026-07-03', '2026-07-07'] as $date) {
            $shift = ShiftRecord::create([
                'outlet_id' => $outlet->id,
                'name' => 'Shift Simulasi',
                'opened_by' => $staff->id,
                'closed_by' => $staff->id,
                'opened_at' => Carbon::parse("{$date} 08:00:00"),
                'closed_at' => Carbon::parse("{$date} 16:00:00"),
                'opening_cash' => 50000,
                'expected_cash' => 100000,
                'actual_cash' => 100000,
                'status' => 'CLOSED',
            ]);
            $shiftSnapshot[] = [
                'id' => $shift->id,
                'name' => $shift->name,
                'outlet_name' => $outlet->name,
                'work_date' => $date,
                'duration_minutes' => 480,
                'duration_label' => '8j 0m',
            ];
        }

        EmployeeSalaryPayment::create([
            'employee_id' => $staff->id,
            'employee_name' => $staff->display_name,
            'period_start' => Carbon::parse('2026-07-01'),
            'period_end' => Carbon::parse('2026-07-07'),
            'salary_type' => 'DAILY',
            'daily_rate' => 75000,
            'payable_days' => 3,
            'work_days' => 3,
            'shift_count' => 3,
            'total_minutes' => 1440,
            'average_minutes' => 480,
            'longest_shift_minutes' => 480,
            'shortest_shift_minutes' => 480,
            'base_amount' => 225000,
            'bonus_amount' => 5000,
            'deduction_amount' => 10000,
            'total_amount' => 220000,
            'shift_snapshot' => $shiftSnapshot,
            'paid_at' => Carbon::parse('2026-07-08'),
        ]);

        $transaction = Transaction::create([
            'outlet_id' => $outlet->id,
            'invoice_number' => 'INV-SIM-GAJI-HPP',
            'total_amount' => 100000,
            'payment_method' => 'CASH',
            'payment_status' => 'PAID',
            'paid_at' => Carbon::parse('2026-07-03 12:00:00'),
            'created_at' => Carbon::parse('2026-07-03 12:00:00'),
        ]);

        TransactionItem::create([
            'transaction_id' => $transaction->id,
            'product_id' => $product->id,
            'product_name' => $product->name,
            'qty_porsi' => 10,
            'price_per_porsi' => 10000,
            'subtotal' => 100000,
            'hpp_per_porsi' => 4000,
            'hpp_total' => 40000,
            'hpp_source' => ProductCostService::SOURCE_LEGACY_MANUAL,
            'hpp_snapshot' => ['source' => ProductCostService::SOURCE_LEGACY_MANUAL],
        ]);

        $report = app(ProductCostService::class)->dashboardData(
            $outlet->id,
            Carbon::parse('2026-07-01')->startOfDay(),
            Carbon::parse('2026-07-07')->endOfDay(),
        );

        $this->assertSame(220000.0, (float) $report['payroll_evaluation']['salary_total']);
        $this->assertSame(10.0, (float) $report['payroll_evaluation']['sold_portions']);
        $this->assertSame(100000.0, (float) $report['payroll_evaluation']['revenue']);
        $this->assertSame(40000.0, (float) $report['payroll_evaluation']['estimated_hpp']);
        $this->assertSame(60000.0, (float) $report['payroll_evaluation']['gross_profit']);
        $this->assertSame(22000.0, (float) $report['payroll_evaluation']['labor_cost_per_portion']);
        $this->assertSame(-160000.0, (float) $report['payroll_evaluation']['profit_after_labor']);
    }

    public function test_product_cost_payroll_evaluation_can_use_custom_salary_total(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Gaji Custom']);
        $staff = $this->createUser('staff-custom-salary@karsa.local', 'STAFF');
        $product = $this->createProduct($outlet->id, 'Dimsum Gaji Custom', 10000, 3000);

        ShiftRecord::create([
            'outlet_id' => $outlet->id,
            'name' => 'Shift Gaji Custom',
            'opened_by' => $staff->id,
            'closed_by' => $staff->id,
            'opened_at' => Carbon::parse('2026-07-15 08:00:00'),
            'closed_at' => Carbon::parse('2026-07-15 16:00:00'),
            'opening_cash' => 50000,
            'expected_cash' => 100000,
            'actual_cash' => 100000,
            'status' => 'CLOSED',
        ]);

        EmployeeSalaryPayment::create([
            'employee_id' => $staff->id,
            'employee_name' => $staff->display_name,
            'period_start' => Carbon::parse('2026-07-15'),
            'period_end' => Carbon::parse('2026-07-15'),
            'salary_type' => 'MONTHLY',
            'monthly_amount' => 100000,
            'payable_days' => 1,
            'work_days' => 1,
            'shift_count' => 1,
            'base_amount' => 100000,
            'bonus_amount' => 0,
            'deduction_amount' => 0,
            'total_amount' => 100000,
            'shift_snapshot' => [],
            'paid_at' => Carbon::parse('2026-07-15'),
        ]);

        $transaction = Transaction::create([
            'outlet_id' => $outlet->id,
            'invoice_number' => 'INV-GAJI-CUSTOM',
            'total_amount' => 200000,
            'payment_method' => 'CASH',
            'payment_status' => 'PAID',
            'paid_at' => Carbon::parse('2026-07-15 12:00:00'),
            'created_at' => Carbon::parse('2026-07-15 12:00:00'),
        ]);

        TransactionItem::create([
            'transaction_id' => $transaction->id,
            'product_id' => $product->id,
            'product_name' => $product->name,
            'qty_porsi' => 20,
            'price_per_porsi' => 10000,
            'subtotal' => 200000,
            'hpp_per_porsi' => 2500,
            'hpp_total' => 50000,
            'hpp_source' => ProductCostService::SOURCE_BOM_LATEST,
            'hpp_snapshot' => ['source' => ProductCostService::SOURCE_BOM_LATEST],
        ]);

        $report = app(ProductCostService::class)->dashboardData(
            $outlet->id,
            Carbon::parse('2026-07-01')->startOfDay(),
            Carbon::parse('2026-07-31')->endOfDay(),
            300000,
        );

        $this->assertSame(100000.0, (float) $report['payroll_evaluation']['recorded_salary_total']);
        $this->assertSame(300000.0, (float) $report['payroll_evaluation']['custom_salary_total']);
        $this->assertTrue($report['payroll_evaluation']['custom_salary_enabled']);
        $this->assertSame(300000.0, (float) $report['payroll_evaluation']['salary_total']);
        $this->assertSame(15000.0, (float) $report['payroll_evaluation']['labor_cost_per_portion']);
        $this->assertSame(-150000.0, (float) $report['payroll_evaluation']['profit_after_labor']);
    }

    public function test_owner_can_save_fixed_hpp_and_return_product_to_auto_bom_cost(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet HPP Fix']);
        $owner = $this->createUser('owner-fixed-hpp@karsa.local', 'OWNER');
        $product = $this->createProduct($outlet->id, 'Dimsum HPP Fix', 15000, 5000);
        $material = $this->createStock($outlet->id, 'Adonan HPP Fix', 100, 10, 10000, 'MATERIAL');
        $packaging = $this->createStock($outlet->id, 'Box HPP Fix', 100, 100, 50000, 'PACKAGING');

        Conversion::create(['product_id' => $product->id, 'stock_item_id' => $material->id, 'ratio' => 2]);
        Conversion::create(['product_id' => $product->id, 'stock_item_id' => $packaging->id, 'ratio' => 1]);

        $autoCost = app(ProductCostService::class)->calculateProduct($product->fresh('conversions.stockItem'), $outlet->id);

        $this->assertSame(2500.0, (float) $autoCost['effective_hpp']);
        $this->assertSame(ProductCostService::SOURCE_BOM_LATEST, $autoCost['hpp_source']);

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->put(route('product-costs.fixed-hpp', $product->id), [
                'hpp' => 6500,
                'hpp_mode' => ProductCostService::HPP_MODE_FIXED,
            ])
            ->assertRedirect();

        $fixedCost = app(ProductCostService::class)->calculateProduct($product->fresh('conversions.stockItem'), $outlet->id);

        $this->assertSame(6500.0, (float) $fixedCost['effective_hpp']);
        $this->assertSame(ProductCostService::SOURCE_FIXED_MANUAL, $fixedCost['hpp_source']);
        $this->assertTrue($fixedCost['uses_fixed_hpp']);

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->put(route('product-costs.fixed-hpp', $product->id), [
                'hpp' => 6500,
                'hpp_mode' => ProductCostService::HPP_MODE_AUTO,
            ])
            ->assertRedirect();

        $latestCost = app(ProductCostService::class)->calculateProduct($product->fresh('conversions.stockItem'), $outlet->id);

        $this->assertSame(2500.0, (float) $latestCost['effective_hpp']);
        $this->assertSame(ProductCostService::SOURCE_BOM_LATEST, $latestCost['hpp_source']);
        $this->assertFalse($latestCost['uses_fixed_hpp']);
    }

    private function createUser(string $email, string $role): User
    {
        return User::create([
            'email' => $email,
            'password_hash' => Hash::make('password'),
            'display_name' => ucfirst(strtolower($role)),
            'role' => $role,
            'is_active' => true,
        ]);
    }

    private function createProduct(string $outletId, string $name, int $price, int $manualHpp): Product
    {
        return Product::create([
            'outlet_id' => $outletId,
            'name' => $name,
            'category' => 'Makanan',
            'price' => $price,
            'hpp' => $manualHpp,
            'is_active' => true,
        ]);
    }

    private function createStock(
        string $outletId,
        string $name,
        float $currentStock,
        float $minRestockQty,
        float $restockPrice,
        string $costCategory,
    ): StockItem {
        return StockItem::create([
            'outlet_id' => $outletId,
            'name' => $name,
            'current_stock_biji' => $currentStock,
            'unit_name' => 'pcs',
            'min_stock_alert' => 0,
            'trackable' => true,
            'counting_basis' => 'BIJI',
            'min_restock_qty' => $minRestockQty,
            'restock_price' => $restockPrice,
            'cost_category' => $costCategory,
        ]);
    }
}
