<?php

namespace Tests\Feature;

use App\Models\Conversion;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\RestockLog;
use App\Models\StockItem;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\TransactionStockMovement;
use App\Models\User;
use App\Models\WasteLog;
use App\Services\StockAuditService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class StockAuditTest extends TestCase
{
    use RefreshDatabase;

    public function test_stock_audit_compares_sales_restock_waste_current_stock_and_physical_count(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-10 18:00:00', 'Asia/Jakarta'));

        try {
            $outlet = Outlet::create(['name' => 'Outlet Audit']);
            $owner = $this->user('OWNER');
            $stock = $this->stock($outlet->id, 'Dimsum Ori', 119);
            $product = $this->product($outlet->id, 'Dimsum Ori');
            Conversion::create([
                'product_id' => $product->id,
                'stock_item_id' => $stock->id,
                'ratio' => 2,
            ]);

            RestockLog::create([
                'outlet_id' => $outlet->id,
                'stock_item_id' => $stock->id,
                'qty_added' => 30,
                'stock_before' => 100,
                'stock_after' => 130,
                'fund_source' => RestockLog::FUND_SOURCE_WAREHOUSE_TRANSFER,
                'restock_cost' => 0,
                'created_at' => Carbon::parse('2026-07-10 08:00:00', 'Asia/Jakarta'),
            ]);

            $transaction = $this->sale($outlet->id, $product, 5, '2026-07-10 09:00:00');
            TransactionStockMovement::create([
                'outlet_id' => $outlet->id,
                'transaction_id' => $transaction->id,
                'stock_item_id' => $stock->id,
                'qty' => 10,
                'type' => 'SALE_DEDUCTION',
                'created_at' => Carbon::parse('2026-07-10 09:00:00', 'Asia/Jakarta'),
            ]);

            WasteLog::create([
                'outlet_id' => $outlet->id,
                'stock_item_id' => $stock->id,
                'source_type' => WasteLog::SOURCE_STOCK,
                'qty_biji' => 1,
                'reason' => 'Basi',
                'waste_type' => WasteLog::TYPE_EXPIRED,
                'loss_amount' => 1000,
                'affects_mitra_settlement' => true,
                'created_at' => Carbon::parse('2026-07-10 11:00:00', 'Asia/Jakarta'),
            ]);

            $this->actingAs($owner)
                ->withSession(['outlet_id' => $outlet->id])
                ->post(route('stock-audit.counts'), [
                    'stock_item_id' => $stock->id,
                    'counted_stock' => 117,
                    'counted_at' => '2026-07-10 17:00:00',
                    'note' => 'Cek fisik freezer',
                ])
                ->assertRedirect()
                ->assertSessionHasNoErrors();

            $this->assertDatabaseHas('stock_audit_counts', [
                'stock_item_id' => $stock->id,
                'counted_stock' => 117,
                'system_stock' => 119,
                'difference' => -2,
            ]);

            $this->actingAs($owner)
                ->withSession(['outlet_id' => $outlet->id])
                ->get(route('stock-audit', [
                    'start_date' => '2026-07-10',
                    'end_date' => '2026-07-10',
                    'stock_item_id' => $stock->id,
                ]))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('StockAudit/Index')
                    ->where('report.summary.stock_count', 1)
                    ->where('report.summary.estimated_sales_usage', 10)
                    ->where('report.summary.logged_sales_deduction', 10)
                    ->where('report.rows.0.stock_start', 100)
                    ->where('report.rows.0.restock_qty', 30)
                    ->where('report.rows.0.waste_qty', 1)
                    ->where('report.rows.0.system_ending_stock', 119)
                    ->where('report.rows.0.latest_count.difference', -2)
                    ->where('report.rows.0.status', 'CRITICAL')
                    ->where('report.selected_stock.product_breakdown.0.product_name', 'Dimsum Ori')
                    ->where('report.selected_stock.product_breakdown.0.qty_porsi', 5)
                    ->where('report.selected_stock.timeline.0.date', '2026-07-10')
                    ->where('report.selected_stock.timeline.0.stock_start', 100)
                    ->where('report.selected_stock.timeline.0.system_ending_stock', 119)
                    ->where('report.selected_stock.count_history.0.difference', -2)
                );
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_stock_audit_flags_when_sales_estimate_and_stock_movement_do_not_match(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-11 12:00:00', 'Asia/Jakarta'));

        try {
            $outlet = Outlet::create(['name' => 'Outlet Audit Selisih']);
            $stock = $this->stock($outlet->id, 'Dimsum Mentai', 122);
            $product = $this->product($outlet->id, 'Dimsum Mentai');
            Conversion::create([
                'product_id' => $product->id,
                'stock_item_id' => $stock->id,
                'ratio' => 2,
            ]);

            $transaction = $this->sale($outlet->id, $product, 5, '2026-07-11 09:00:00');
            TransactionStockMovement::create([
                'outlet_id' => $outlet->id,
                'transaction_id' => $transaction->id,
                'stock_item_id' => $stock->id,
                'qty' => 8,
                'type' => 'SALE_DEDUCTION',
                'created_at' => Carbon::parse('2026-07-11 09:00:00', 'Asia/Jakarta'),
            ]);

            $report = app(StockAuditService::class)->getReport(
                $outlet->id,
                Carbon::parse('2026-07-11', 'Asia/Jakarta'),
                Carbon::parse('2026-07-11', 'Asia/Jakarta'),
                $stock->id
            );

            $row = $report['rows'][0];

            $this->assertSame(10.0, $row['estimated_sales_usage']);
            $this->assertSame(8.0, $row['logged_sales_deduction']);
            $this->assertSame(-2.0, $row['sales_movement_gap']);
            $this->assertSame(2.0, $row['ending_stock_gap']);
            $this->assertSame('CRITICAL', $row['status']);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_stock_audit_can_inspect_a_specific_stock_item_from_the_list(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Audit Pilihan']);
        $owner = $this->user('OWNER');
        $firstStock = $this->stock($outlet->id, 'Dimsum Ayam', 80);
        $secondStock = $this->stock($outlet->id, 'Kulit Pangsit', 200);
        $secondProduct = $this->product($outlet->id, 'Pangsit Goreng');

        Conversion::create([
            'product_id' => $secondProduct->id,
            'stock_item_id' => $secondStock->id,
            'ratio' => 1.5,
        ]);

        $this->sale($outlet->id, $secondProduct, 4, '2026-07-12 10:00:00');

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->get(route('stock-audit', [
                'start_date' => '2026-07-12',
                'end_date' => '2026-07-12',
                'stock_item_id' => $secondStock->id,
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.stock_item_id', $secondStock->id)
                ->where('report.selected_stock_id', $secondStock->id)
                ->where('report.selected_stock.name', 'Kulit Pangsit')
                ->where('report.selected_stock.product_breakdown.0.product_name', 'Pangsit Goreng')
                ->where('report.selected_stock.product_breakdown.0.qty_porsi', 4)
                ->where('report.selected_stock.product_breakdown.0.estimated_usage', 6)
                ->where('report.rows.0.stock_item_id', $firstStock->id)
                ->where('report.rows.1.stock_item_id', $secondStock->id)
            );
    }

    public function test_mitra_cannot_open_stock_audit_page(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Audit']);
        $mitra = $this->user('MITRA');
        $mitra->outlets()->attach($outlet->id);

        $this->actingAs($mitra)
            ->withSession(['outlet_id' => $outlet->id])
            ->get(route('stock-audit'))
            ->assertForbidden();
    }

    private function user(string $role): User
    {
        return User::create([
            'email' => strtolower($role).'-stock-audit@karsa.local',
            'password_hash' => Hash::make('password'),
            'display_name' => ucfirst(strtolower($role)).' Audit',
            'role' => $role,
            'is_active' => true,
        ]);
    }

    private function stock(string $outletId, string $name, float $currentStock): StockItem
    {
        return StockItem::create([
            'outlet_id' => $outletId,
            'name' => $name,
            'current_stock_biji' => $currentStock,
            'unit_name' => 'pcs',
            'min_stock_alert' => 5,
            'trackable' => true,
            'counting_basis' => 'BIJI',
            'min_restock_qty' => 10,
            'restock_price' => 10000,
        ]);
    }

    private function product(string $outletId, string $name): Product
    {
        return Product::create([
            'outlet_id' => $outletId,
            'name' => $name,
            'category' => 'Dimsum',
            'price' => 15000,
            'hpp' => 5000,
            'is_active' => true,
        ]);
    }

    private function sale(string $outletId, Product $product, int $qty, string $date): Transaction
    {
        $transaction = Transaction::create([
            'outlet_id' => $outletId,
            'invoice_number' => 'INV-AUDIT-'.str_replace(['-', ':', ' '], '', $date),
            'total_amount' => $qty * 15000,
            'payment_method' => 'CASH',
            'payment_status' => 'PAID',
            'paid_at' => Carbon::parse($date, 'Asia/Jakarta'),
            'created_at' => Carbon::parse($date, 'Asia/Jakarta'),
        ]);

        TransactionItem::create([
            'transaction_id' => $transaction->id,
            'product_id' => $product->id,
            'product_name' => $product->name,
            'qty_porsi' => $qty,
            'price_per_porsi' => 15000,
            'subtotal' => $qty * 15000,
        ]);

        return $transaction;
    }
}
