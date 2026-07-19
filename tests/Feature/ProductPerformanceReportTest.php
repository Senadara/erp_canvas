<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\PettyCash;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use App\Services\ReportService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ProductPerformanceReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_performance_ranks_sales_and_returns_daily_selected_product_details(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Utama']);
        $otherOutlet = Outlet::create(['name' => 'Outlet Lain']);

        $bestSeller = $this->createProduct($outlet->id, 'Dimsum Ori', 6000);
        $mostProfitable = $this->createProduct($outlet->id, 'Dimsum Premium', 5000);
        $otherProduct = $this->createProduct($otherOutlet->id, 'Produk Outlet Lain', 1000);

        $this->createSale($outlet->id, 'INV-001', '2026-07-01 10:00:00', [
            [$bestSeller, 5, 50000],
            [$mostProfitable, 2, 50000],
        ]);
        $this->createSale($outlet->id, 'INV-002', '2026-07-02 11:00:00', [
            [$bestSeller, 3, 30000],
            [$mostProfitable, 2, 50000],
        ]);
        $this->createSale($outlet->id, 'INV-PENDING', '2026-07-02 12:00:00', [
            [$bestSeller, 100, 1000000],
        ], 'UNPAID');
        $this->createSale($otherOutlet->id, 'INV-OTHER', '2026-07-02 13:00:00', [
            [$otherProduct, 100, 1000000],
        ]);

        $report = app(ReportService::class)->getProductPerformance(
            $outlet->id,
            Carbon::parse('2026-07-01'),
            Carbon::parse('2026-07-31'),
            null,
            $bestSeller->id,
        );

        $this->assertSame($bestSeller->id, $report['best_seller']['id']);
        $this->assertSame(8, $report['best_seller']['quantity_sold']);
        $this->assertSame($mostProfitable->id, $report['most_profitable']['id']);
        $this->assertSame(80000.0, $report['best_seller']['revenue']);
        $this->assertSame(32000.0, $report['best_seller']['gross_profit']);

        $selected = $report['selected_product'];
        $this->assertSame($bestSeller->id, $selected['id']);
        $this->assertSame(8, $selected['summary']['quantity_sold']);
        $this->assertSame(2, $selected['summary']['transaction_count']);
        $this->assertCount(2, $selected['daily_sales']);
        $this->assertSame('2026-07-02', $selected['daily_sales'][0]['date']);
        $this->assertSame(3, $selected['daily_sales'][0]['quantity_sold']);
    }

    public function test_product_performance_respects_mitra_scope_and_rejects_cross_outlet_selection(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Utama']);
        $otherOutlet = Outlet::create(['name' => 'Outlet Lain']);
        $allowed = $this->createProduct($outlet->id, 'Produk Mitra', 4000);
        $notAllowed = $this->createProduct($outlet->id, 'Produk Owner', 3000);
        $crossOutlet = $this->createProduct($otherOutlet->id, 'Produk Outlet Lain', 2000);

        $this->createSale($outlet->id, 'INV-SCOPE', '2026-07-03 09:00:00', [
            [$allowed, 2, 20000],
            [$notAllowed, 10, 100000],
        ]);

        $report = app(ReportService::class)->getProductPerformance(
            $outlet->id,
            Carbon::parse('2026-07-01'),
            Carbon::parse('2026-07-31'),
            [$allowed->id],
            $crossOutlet->id,
        );

        $this->assertCount(1, $report['products']);
        $this->assertSame($allowed->id, $report['ranking'][0]['id']);
        $this->assertSame(2, $report['ranking'][0]['quantity_sold']);
        $this->assertNull($report['selected_product_id']);
        $this->assertNull($report['selected_product']);
    }

    public function test_e_settlement_report_summarizes_sales_and_cash_movements_by_payment_bucket(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Settlement']);
        $product = $this->createProduct($outlet->id, 'Dimsum Ori', 3000);

        $legacyPaidSale = Transaction::create([
            'outlet_id' => $outlet->id,
            'invoice_number' => 'INV-SET-LEGACY',
            'total_amount' => 30000,
            'payment_method' => 'CASH',
            'payment_status' => 'PAID',
            'paid_at' => null,
            'created_at' => '2026-07-10 08:00:00',
        ]);
        TransactionItem::create([
            'transaction_id' => $legacyPaidSale->id,
            'product_id' => $product->id,
            'product_name' => $product->name,
            'qty_porsi' => 3,
            'price_per_porsi' => 10000,
            'subtotal' => 30000,
        ]);

        $this->createSale($outlet->id, 'INV-SET-CASH', '2026-07-10 09:00:00', [
            [$product, 10, 100000],
        ]);
        $this->createSale($outlet->id, 'INV-SET-QRIS', '2026-07-10 10:00:00', [
            [$product, 4, 40000],
        ], 'PAID', 'QRIS');

        $this->createMovement($outlet->id, 'Operasional', 'CASH', 'OUT', 20000, '2026-07-10 11:00:00');
        $this->createMovement($outlet->id, 'RESTOCK', 'CASH', 'OUT', 15000, '2026-07-10 11:10:00');
        $this->createMovement($outlet->id, 'Tambah Kas', 'CASH', 'IN', 5000, '2026-07-10 11:20:00');
        $this->createMovement($outlet->id, 'Penarikan', 'QRIS', 'OUT', 10000, '2026-07-10 11:30:00');
        $this->createMovement($outlet->id, 'RESTOCK', 'PRIVATE', 'OUT', 7000, '2026-07-10 11:40:00');

        $report = app(ReportService::class)->getESettlementReport(
            $outlet->id,
            Carbon::parse('2026-07-10'),
            Carbon::parse('2026-07-10'),
        );

        $summary = $report['summary'];

        $this->assertSame(170000.0, $summary['sales_total']);
        $this->assertSame(130000.0, $summary['cash_sales']);
        $this->assertSame(40000.0, $summary['qris_sales']);
        $this->assertSame(40000.0, $summary['cash_out']);
        $this->assertSame(10000.0, $summary['qris_out']);
        $this->assertSame(7000.0, $summary['outside_out']);
        $this->assertSame(5000.0, $summary['drawer_cashier_topups']);
        $this->assertSame(90000.0, $summary['cash_net']);
        $this->assertSame(30000.0, $summary['qris_net']);
        $this->assertSame(120000.0, $summary['settlement_net']);
        $this->assertSame(170000.0, $summary['money_in_total']);
        $this->assertSame(57000.0, $summary['money_out_total']);

        $this->assertCount(1, $report['daily']);
        $this->assertSame(90000.0, $report['daily'][0]['net_cash']);
        $this->assertSame(30000.0, $report['daily'][0]['net_qris']);

        $legacyRow = collect($report['transactions'])->firstWhere('invoice_number', 'INV-SET-LEGACY');
        $this->assertNotNull($legacyRow);
        $this->assertStringStartsWith('2026-07-10T08:00:00', $legacyRow['paid_at']);

        $topupRow = collect($report['movements'])->firstWhere('category', 'Tambah Kas');
        $this->assertSame('OUT', $topupRow['cash_flow']);
    }

    public function test_e_settlement_page_and_pdf_are_separate_from_regular_report_page(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-10 12:00:00'));

        try {
            $outlet = Outlet::create(['name' => 'Outlet PDF Settlement']);
            $owner = User::create([
                'email' => 'owner-settlement-report@karsa.local',
                'password_hash' => Hash::make('password'),
                'display_name' => 'Owner Settlement Report',
                'role' => 'OWNER',
                'is_active' => true,
            ]);
            $product = $this->createProduct($outlet->id, 'Dimsum Ori', 3000);

            $this->createSale($outlet->id, 'INV-EST-CASH', '2026-07-10 09:00:00', [
                [$product, 10, 100000],
            ]);
            $this->createSale($outlet->id, 'INV-EST-QRIS', '2026-07-10 10:00:00', [
                [$product, 5, 50000],
            ], 'PAID', 'QRIS');
            $this->createMovement($outlet->id, 'Operasional', 'CASH', 'OUT', 10000, '2026-07-10 11:00:00');

            $this->actingAs($owner)
                ->withSession(['outlet_id' => $outlet->id])
                ->get(route('reports'))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Reports/Index')
                    ->has('productPerformance')
                    ->missing('eSettlementReport')
                );

            $this->actingAs($owner)
                ->withSession(['outlet_id' => $outlet->id])
                ->get(route('reports.e-settlement', [
                    'start_date' => '2026-07-10',
                    'end_date' => '2026-07-10',
                ]))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Reports/ESettlement')
                    ->where('filters.start_date', '2026-07-10')
                    ->where('filters.end_date', '2026-07-10')
                    ->where('report.summary.sales_total', 150000)
                    ->where('report.summary.cash_net', 90000)
                    ->where('report.summary.qris_net', 50000)
                    ->where('report.summary.settlement_net', 140000)
                    ->has('report.category_summary', 3)
                );

            $pdf = $this->actingAs($owner)
                ->withSession(['outlet_id' => $outlet->id])
                ->get(route('reports.e-settlement.pdf', [
                    'start_date' => '2026-07-10',
                    'end_date' => '2026-07-10',
                ]))
                ->assertOk()
                ->assertHeader('content-type', 'application/pdf');

            $this->assertStringStartsWith('%PDF-', $pdf->getContent());
            $pdf->assertDownload('e-settlement-20260710-20260710.pdf');
        } finally {
            Carbon::setTestNow();
        }
    }

    private function createProduct(string $outletId, string $name, int $hpp): Product
    {
        return Product::create([
            'outlet_id' => $outletId,
            'name' => $name,
            'category' => 'Makanan',
            'price' => 10000,
            'hpp' => $hpp,
            'is_active' => true,
        ]);
    }

    private function createSale(
        string $outletId,
        string $invoice,
        string $createdAt,
        array $items,
        string $paymentStatus = 'PAID',
        string $paymentMethod = 'CASH',
    ): void {
        $transaction = Transaction::create([
            'outlet_id' => $outletId,
            'invoice_number' => $invoice,
            'total_amount' => collect($items)->sum(fn (array $item) => $item[2]),
            'payment_method' => $paymentMethod,
            'payment_status' => $paymentStatus,
            'paid_at' => $paymentStatus === 'PAID' ? $createdAt : null,
            'created_at' => $createdAt,
        ]);

        foreach ($items as [$product, $quantity, $subtotal]) {
            TransactionItem::create([
                'transaction_id' => $transaction->id,
                'product_id' => $product->id,
                'product_name' => $product->name,
                'qty_porsi' => $quantity,
                'price_per_porsi' => $subtotal / $quantity,
                'subtotal' => $subtotal,
            ]);
        }
    }

    private function createMovement(
        string $outletId,
        string $category,
        string $paymentMethod,
        string $cashFlow,
        int $amount,
        string $createdAt,
    ): void {
        PettyCash::create([
            'outlet_id' => $outletId,
            'amount' => $amount,
            'category' => $category,
            'payment_method' => $paymentMethod,
            'cash_flow' => $cashFlow,
            'description' => $category,
            'created_at' => $createdAt,
        ]);
    }
}
