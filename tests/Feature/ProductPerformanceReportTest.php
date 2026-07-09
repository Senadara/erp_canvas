<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Services\ReportService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
    ): void {
        $transaction = Transaction::create([
            'outlet_id' => $outletId,
            'invoice_number' => $invoice,
            'total_amount' => collect($items)->sum(fn (array $item) => $item[2]),
            'payment_method' => 'CASH',
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
}
