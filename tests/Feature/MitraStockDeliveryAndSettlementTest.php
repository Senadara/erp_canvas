<?php

namespace Tests\Feature;

use App\Models\MitraSettlement;
use App\Models\MitraStockDelivery;
use App\Models\MitraStockUsageAdjustment;
use App\Models\Outlet;
use App\Models\PettyCash;
use App\Models\Product;
use App\Models\RestockLog;
use App\Models\StockItem;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use App\Models\WarehouseStockItem;
use App\Models\WarehouseStockTransfer;
use App\Models\Conversion;
use App\Services\MitraStockDeliveryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class MitraStockDeliveryAndSettlementTest extends TestCase
{
    use RefreshDatabase;

    public function test_mitra_delivery_enters_warehouse_then_outlet_takes_stock_without_cash_expense(): void
    {
        [$outlet, $owner, $staff, $mitra, $stock] = $this->createContext();

        $this->actingAs($mitra)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('mitra-stock-deliveries.store'), [
                'stock_item_id' => $stock->id,
                'qty_sent' => 100,
                'sender_note' => 'Surat jalan SJ-01',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $delivery = MitraStockDelivery::firstOrFail();
        $this->assertSame(MitraStockDelivery::STATUS_SENT, $delivery->status);

        $this->actingAs($staff)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('mitra-stock-deliveries.receive', $delivery->id), [
                'qty_received' => 98,
                'receiver_note' => 'Dua kemasan rusak',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $delivery->refresh();
        $this->assertSame(MitraStockDelivery::STATUS_RECEIVED_DIFFERENCE, $delivery->status);
        $this->assertSame(98.0, (float) $delivery->qty_received);
        $warehouseStock = WarehouseStockItem::findOrFail($delivery->warehouse_stock_item_id);
        $this->assertSame(98.0, (float) $warehouseStock->current_stock);
        $this->assertSame(10.0, (float) $stock->fresh()->current_stock_biji);
        $this->assertNull($delivery->restock_log_id);
        $this->assertSame(0, RestockLog::count());
        $this->assertSame(0, PettyCash::count());

        $this->actingAs($staff)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('mitra-stock-deliveries.receive', $delivery->id), [
                'qty_received' => 98,
            ])
            ->assertSessionHasErrors('delivery');

        $this->assertSame(98.0, (float) $warehouseStock->fresh()->current_stock);

        $this->actingAs($staff)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('stock.transfer-from-warehouse', $stock->id), [
                'qty' => 50,
                'note' => 'Kebutuhan hari ini',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertSame(48.0, (float) $warehouseStock->fresh()->current_stock);
        $this->assertSame(60.0, (float) $stock->fresh()->current_stock_biji);
        $this->assertSame(1, WarehouseStockTransfer::count());
        $this->assertDatabaseHas('restock_logs', [
            'stock_item_id' => $stock->id,
            'fund_source' => RestockLog::FUND_SOURCE_WAREHOUSE_TRANSFER,
            'qty_added' => 50,
            'restock_cost' => 0,
        ]);
        $this->assertSame(0, PettyCash::count());

        $this->actingAs($staff)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('stock.transfer-from-warehouse', $stock->id), ['qty' => 49])
            ->assertSessionHasErrors('warehouse_transfer');
        $this->assertSame(48.0, (float) $warehouseStock->fresh()->current_stock);
        $this->assertSame(60.0, (float) $stock->fresh()->current_stock_biji);

        $this->actingAs($staff)
            ->withSession(['outlet_id' => $outlet->id])
            ->get(route('stock'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('warehouseItems', 1)
                ->where('warehouseItems.0.current_stock', '48.0000')
                ->has('transfers', 1)
                ->where('transfers.0.outlet.id', $outlet->id)
            );
    }

    public function test_mitra_cannot_send_stock_outside_its_scope_or_validate_another_mitra_settlement(): void
    {
        [$outlet, $owner, $staff, $mitra, $stock] = $this->createContext();
        $otherStock = StockItem::create([
            'outlet_id' => $outlet->id,
            'name' => 'Bahan Owner',
            'current_stock_biji' => 0,
            'unit_name' => 'pcs',
            'min_stock_alert' => 0,
            'trackable' => true,
            'counting_basis' => 'BIJI',
            'min_restock_qty' => 10,
            'restock_price' => 50000,
        ]);

        $this->actingAs($mitra)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('mitra-stock-deliveries.store'), [
                'stock_item_id' => $otherStock->id,
                'qty_sent' => 10,
            ])
            ->assertSessionHasErrors('delivery');

        $this->assertSame(0, MitraStockDelivery::count());
    }

    public function test_owner_submission_requires_mitra_approval_before_payment(): void
    {
        [$outlet, $owner, $staff, $mitra, $stock] = $this->createContext();

        $deliveryService = app(MitraStockDeliveryService::class);
        $delivery = $deliveryService->create($mitra, $stock->id, 20, null);
        $deliveryService->receive($delivery->id, $staff, 20, null);

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.store'), [
                'mitra_id' => $mitra->id,
                'start_date' => now()->startOfMonth()->format('Y-m-d'),
                'end_date' => now()->endOfMonth()->format('Y-m-d'),
                'calculation_method' => 'RESTOCK',
                'total_amount' => 1,
                'receipt_data' => [],
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $settlement = MitraSettlement::firstOrFail();
        $this->assertSame(MitraSettlement::STATUS_PENDING, $settlement->status);
        $this->assertSame(100000.0, (float) $settlement->total_amount);
        $this->assertSame(20.0, (float) $settlement->receipt_data[0]['calculated_qty']);

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.store'), [
                'mitra_id' => $mitra->id,
                'start_date' => now()->startOfMonth()->format('Y-m-d'),
                'end_date' => now()->endOfMonth()->format('Y-m-d'),
                'calculation_method' => 'RESTOCK',
            ])
            ->assertSessionHasErrors('settlement');

        $this->assertSame(1, MitraSettlement::count());

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.pay', $settlement->id))
            ->assertSessionHasErrors('settlement');

        $this->actingAs($mitra)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.validate', $settlement->id), [
                'decision' => 'APPROVE',
                'validation_note' => 'Jumlah sesuai',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertSame(MitraSettlement::STATUS_APPROVED, $settlement->fresh()->status);
        $this->assertSame($mitra->id, $settlement->fresh()->validated_by);

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.pay', $settlement->id))
            ->assertRedirect()
            ->assertSessionHas('success');

        $settlement->refresh();
        $this->assertSame(MitraSettlement::STATUS_PAID, $settlement->status);
        $this->assertSame($owner->id, $settlement->paid_by);
        $this->assertNotNull($settlement->paid_at);

        $singlePdf = $this->actingAs($mitra)
            ->withSession(['outlet_id' => $outlet->id])
            ->get(route('settlements.pdf', $settlement->id))
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
        $this->assertStringStartsWith('%PDF-', $singlePdf->getContent());
        $this->assertStringStartsWith('inline;', $singlePdf->headers->get('content-disposition'));
        $this->assertStringContainsString('setoran-mitra-'.now()->format('Ymd').'.pdf', $singlePdf->headers->get('content-disposition'));

        $singlePdfPayload = $this->actingAs($mitra)
            ->withSession(['outlet_id' => $outlet->id])
            ->get(route('settlements.pdf', [
                'id' => $settlement->id,
                'browser_pdf' => 1,
            ]))
            ->assertOk()
            ->assertJsonPath('mime', 'application/pdf');
        $this->assertStringStartsWith('%PDF-', base64_decode($singlePdfPayload->json('base64'), true));

        $periodPdf = $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->get(route('settlements.export-pdf', [
                'start_date' => now()->startOfMonth()->format('Y-m-d'),
                'end_date' => now()->endOfMonth()->format('Y-m-d'),
                'mitra_id' => $mitra->id,
            ]))
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
        $this->assertStringStartsWith('%PDF-', $periodPdf->getContent());
        $this->assertStringStartsWith('inline;', $periodPdf->headers->get('content-disposition'));
        $this->assertStringContainsString(
            'rekap-setoran-'.now()->startOfMonth()->format('Ymd').'-'.now()->endOfMonth()->format('Ymd').'.pdf',
            $periodPdf->headers->get('content-disposition')
        );

        $periodPdfPayload = $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->get(route('settlements.export-pdf', [
                'start_date' => now()->startOfMonth()->format('Y-m-d'),
                'end_date' => now()->endOfMonth()->format('Y-m-d'),
                'mitra_id' => $mitra->id,
                'browser_pdf' => 1,
            ]))
            ->assertOk()
            ->assertJsonPath('mime', 'application/pdf');
        $this->assertStringStartsWith('%PDF-', base64_decode($periodPdfPayload->json('base64'), true));

        $otherMitra = $this->createUser('other-mitra@delivery.test', 'MITRA');
        $otherMitra->outlets()->attach($outlet->id);

        $this->actingAs($otherMitra)
            ->withSession(['outlet_id' => $outlet->id])
            ->get(route('settlements.pdf', $settlement->id))
            ->assertNotFound();
    }

    public function test_owner_can_cancel_unpaid_settlement_and_submit_again(): void
    {
        [$outlet, $owner, $staff, $mitra, $stock] = $this->createContext();

        $deliveryService = app(MitraStockDeliveryService::class);
        $delivery = $deliveryService->create($mitra, $stock->id, 20, null);
        $deliveryService->receive($delivery->id, $staff, 20, null);

        $payload = [
            'mitra_id' => $mitra->id,
            'start_date' => now()->startOfMonth()->format('Y-m-d'),
            'end_date' => now()->endOfMonth()->format('Y-m-d'),
            'calculation_method' => 'RESTOCK',
        ];

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.store'), $payload)
            ->assertRedirect()
            ->assertSessionHas('success');

        $firstSettlement = MitraSettlement::firstOrFail();
        $this->assertSame(MitraSettlement::STATUS_PENDING, $firstSettlement->status);
        $this->assertSame(20.0, (float) $firstSettlement->receipt_data[0]['calculated_qty']);

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.store'), $payload)
            ->assertSessionHasErrors('settlement');

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.cancel', $firstSettlement->id), [
                'cancel_note' => 'Salah periode input',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $firstSettlement->refresh();
        $this->assertSame(MitraSettlement::STATUS_CANCELED, $firstSettlement->status);
        $this->assertStringContainsString('Salah periode input', $firstSettlement->validation_note);

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.store'), $payload)
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertSame(2, MitraSettlement::count());
        $newSettlement = MitraSettlement::where('status', MitraSettlement::STATUS_PENDING)->firstOrFail();
        $this->assertSame(20.0, (float) $newSettlement->receipt_data[0]['calculated_qty']);

        $this->actingAs($mitra)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.validate', $firstSettlement->id), [
                'decision' => 'APPROVE',
            ])
            ->assertSessionHasErrors('settlement');
    }

    public function test_restock_settlement_counts_one_central_warehouse_instead_of_each_outlet_transfer(): void
    {
        [$firstOutlet, $owner, $staff, $mitra, $firstStock] = $this->createContext();
        $secondOutlet = Outlet::create(['name' => 'Outlet Kedua']);
        $mitra->outlets()->attach($secondOutlet->id);
        $secondStock = StockItem::create([
            'outlet_id' => $secondOutlet->id,
            'name' => 'Dimsum Frozen',
            'current_stock_biji' => 30,
            'unit_name' => 'pcs',
            'min_stock_alert' => 5,
            'trackable' => true,
            'counting_basis' => 'BIJI',
            'min_restock_qty' => 10,
            'restock_price' => 40000,
        ]);
        $mitra->mitraStockItems()->attach($secondStock->id, ['price' => 40000]);

        $deliveryService = app(MitraStockDeliveryService::class);
        $delivery = $deliveryService->create($mitra, $firstStock->id, 50, null);
        $deliveryService->receive($delivery->id, $staff, 50, null);

        $this->actingAs($staff)
            ->withSession(['outlet_id' => $firstOutlet->id])
            ->post(route('stock.transfer-from-warehouse', $firstStock->id), ['qty' => 20])
            ->assertSessionHas('success');
        $this->actingAs($owner)
            ->withSession(['outlet_id' => $secondOutlet->id])
            ->post(route('stock.transfer-from-warehouse', $secondStock->id), ['qty' => 30])
            ->assertSessionHas('success');

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $firstOutlet->id])
            ->post(route('settlements.store'), [
                'mitra_id' => $mitra->id,
                'start_date' => now()->startOfMonth()->format('Y-m-d'),
                'end_date' => now()->endOfMonth()->format('Y-m-d'),
                'calculation_method' => 'RESTOCK',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $settlement = MitraSettlement::firstOrFail();
        $items = collect($settlement->receipt_data);
        $this->assertCount(1, $items);
        $this->assertSame('Gudang Pusat', $items->first()['outlet_name']);
        $this->assertNull($items->first()['outlet_id']);
        $this->assertNotNull($items->first()['warehouse_stock_item_id']);
        $this->assertSame(50.0, (float) $items->first()['calculated_qty']);
        $this->assertSame(250000.0, (float) $settlement->total_amount);

        $warehouseReport = app(\App\Services\MitraReportService::class)->getMitraWarehouseRestockData(
            $mitra,
            now()->startOfMonth(),
            now()->endOfMonth(),
        );
        $this->assertSame(50.0, (float) $warehouseReport[0]['pending_settlement_qty']);
        $this->assertSame(0.0, (float) WarehouseStockItem::firstOrFail()->current_stock);

        $this->actingAs($mitra)
            ->withSession(['outlet_id' => $secondOutlet->id])
            ->get(route('settlements'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('settlements', 1)
                ->where('settlements.0.id', $settlement->id)
                ->has('settlements.0.receipt_data', 1)
            );
    }

    public function test_restock_settlement_locks_sales_settlement_for_the_same_warehouse_stock(): void
    {
        [$outlet, $owner, $staff, $mitra, $stock] = $this->createContext();
        $deliveryService = app(MitraStockDeliveryService::class);
        $delivery = $deliveryService->create($mitra, $stock->id, 20, null);
        $deliveryService->receive($delivery->id, $staff, 20, null);
        $product = $this->createProductForStock($outlet->id, $stock->id);
        $this->createPaidSale($outlet->id, $product, 10, 100000);

        $period = [
            'mitra_id' => $mitra->id,
            'start_date' => now()->startOfMonth()->format('Y-m-d'),
            'end_date' => now()->endOfMonth()->format('Y-m-d'),
        ];

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.store'), [
                ...$period,
                'calculation_method' => 'RESTOCK',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $restockSettlement = MitraSettlement::firstOrFail();
        $this->assertSame(20.0, (float) $restockSettlement->receipt_data[0]['calculated_qty']);
        $this->assertSame(100000.0, (float) $restockSettlement->total_amount);

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.store'), [
                ...$period,
                'calculation_method' => 'SALES',
            ])
            ->assertSessionHasErrors('settlement');

        $this->assertSame(1, MitraSettlement::count());
    }

    public function test_sales_settlement_locks_only_the_matching_restock_quantity(): void
    {
        [$outlet, $owner, $staff, $mitra, $stock] = $this->createContext();
        $deliveryService = app(MitraStockDeliveryService::class);
        $delivery = $deliveryService->create($mitra, $stock->id, 20, null);
        $deliveryService->receive($delivery->id, $staff, 20, null);
        $product = $this->createProductForStock($outlet->id, $stock->id);
        $this->createPaidSale($outlet->id, $product, 8, 80000);

        $period = [
            'mitra_id' => $mitra->id,
            'start_date' => now()->startOfMonth()->format('Y-m-d'),
            'end_date' => now()->endOfMonth()->format('Y-m-d'),
        ];

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.store'), [
                ...$period,
                'calculation_method' => 'SALES',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $salesSettlement = MitraSettlement::firstOrFail();
        $this->assertSame(8.0, (float) $salesSettlement->receipt_data[0]['calculated_qty']);
        $this->assertSame(40000.0, (float) $salesSettlement->total_amount);

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.store'), [
                ...$period,
                'calculation_method' => 'RESTOCK',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $restockSettlement = MitraSettlement::where('calculation_method', 'RESTOCK')->firstOrFail();
        $this->assertSame(12.0, (float) $restockSettlement->receipt_data[0]['calculated_qty']);
        $this->assertSame(60000.0, (float) $restockSettlement->total_amount);
        $this->assertSame(2, MitraSettlement::count());
    }

    public function test_custom_settlement_can_adjust_without_stock_or_lock_a_stock_credit(): void
    {
        [$outlet, $owner, $staff, $mitra, $stock] = $this->createContext();
        $deliveryService = app(MitraStockDeliveryService::class);
        $delivery = $deliveryService->create($mitra, $stock->id, 20, null);
        $deliveryService->receive($delivery->id, $staff, 20, null);
        $warehouseKey = 'warehouse:'.WarehouseStockItem::firstOrFail()->id;

        $period = [
            'mitra_id' => $mitra->id,
            'start_date' => now()->startOfMonth()->format('Y-m-d'),
            'end_date' => now()->endOfMonth()->format('Y-m-d'),
        ];

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.store'), [
                ...$period,
                'calculation_method' => 'CUSTOM',
                'custom_kind' => 'ADJUSTMENT_ONLY',
                'custom_amount' => 25000,
                'custom_description' => 'Penyesuaian pembulatan',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $adjustment = MitraSettlement::firstOrFail();
        $this->assertSame(25000.0, (float) $adjustment->total_amount);
        $this->assertNull($adjustment->receipt_data[0]['settlement_item_key']);
        $this->assertSame(0.0, (float) $adjustment->receipt_data[0]['calculated_qty']);

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.store'), [
                ...$period,
                'calculation_method' => 'CUSTOM',
                'custom_kind' => 'STOCK_CREDIT',
                'custom_amount' => 50000,
                'custom_stock_key' => $warehouseKey,
                'custom_quantity' => 10,
                'custom_description' => 'Pelunasan manual bahan',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $stockCredit = MitraSettlement::get()
            ->first(fn (MitraSettlement $settlement) => ($settlement->receipt_data[0]['custom_kind'] ?? null) === 'STOCK_CREDIT');
        $this->assertNotNull($stockCredit);
        $this->assertSame('CUSTOM', $stockCredit->calculation_method);
        $this->assertSame($warehouseKey, $stockCredit->receipt_data[0]['settlement_item_key']);
        $this->assertSame(10.0, (float) $stockCredit->receipt_data[0]['calculated_qty']);

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.store'), [
                ...$period,
                'calculation_method' => 'RESTOCK',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $restockSettlement = MitraSettlement::where('calculation_method', 'RESTOCK')->firstOrFail();
        $this->assertSame(10.0, (float) $restockSettlement->receipt_data[0]['calculated_qty']);
        $this->assertSame(50000.0, (float) $restockSettlement->total_amount);
        $this->assertSame(3, MitraSettlement::count());
    }

    public function test_custom_stock_credit_can_lock_multiple_stock_items(): void
    {
        [$outlet, $owner, $staff, $mitra, $stock] = $this->createContext();
        $secondStock = StockItem::create([
            'outlet_id' => $outlet->id,
            'name' => 'Siomay Frozen',
            'current_stock_biji' => 0,
            'unit_name' => 'pcs',
            'min_stock_alert' => 5,
            'trackable' => true,
            'counting_basis' => 'BIJI',
            'min_restock_qty' => 5,
            'restock_price' => 25000,
        ]);
        $mitra->mitraStockItems()->attach($secondStock->id, ['price' => 25000]);

        $deliveryService = app(MitraStockDeliveryService::class);
        $deliveryService->receive($deliveryService->create($mitra, $stock->id, 20, null)->id, $staff, 20, null);
        $deliveryService->receive($deliveryService->create($mitra, $secondStock->id, 10, null)->id, $staff, 10, null);

        $firstKey = 'warehouse:'.$stock->fresh()->warehouse_stock_item_id;
        $secondKey = 'warehouse:'.$secondStock->fresh()->warehouse_stock_item_id;
        $period = [
            'mitra_id' => $mitra->id,
            'start_date' => now()->startOfMonth()->format('Y-m-d'),
            'end_date' => now()->endOfMonth()->format('Y-m-d'),
        ];

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.store'), [
                ...$period,
                'calculation_method' => 'CUSTOM',
                'custom_kind' => 'STOCK_CREDIT',
                'custom_description' => 'Pelunasan beberapa bahan',
                'custom_items' => [
                    ['stock_key' => $firstKey, 'quantity' => 10],
                    ['stock_key' => $secondKey, 'quantity' => 5],
                ],
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $settlement = MitraSettlement::firstOrFail();
        $this->assertSame(75000.0, (float) $settlement->total_amount);
        $this->assertCount(2, $settlement->receipt_data);
        $this->assertSame([$firstKey, $secondKey], collect($settlement->receipt_data)->pluck('settlement_item_key')->all());
        $this->assertSame([10.0, 5.0], collect($settlement->receipt_data)->pluck('calculated_qty')->map(fn ($qty) => (float) $qty)->all());
    }

    public function test_paid_custom_advance_reduces_future_restock_settlement_total(): void
    {
        [$outlet, $owner, $staff, $mitra, $stock] = $this->createContext();
        $deliveryService = app(MitraStockDeliveryService::class);
        $deliveryService->receive($deliveryService->create($mitra, $stock->id, 20, null)->id, $staff, 20, null);

        $period = [
            'mitra_id' => $mitra->id,
            'start_date' => now()->startOfMonth()->format('Y-m-d'),
            'end_date' => now()->endOfMonth()->format('Y-m-d'),
        ];

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.store'), [
                ...$period,
                'calculation_method' => 'CUSTOM',
                'custom_kind' => 'ADJUSTMENT_ONLY',
                'custom_amount' => 30000,
                'custom_description' => 'Bon sebelum stok datang',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $advance = MitraSettlement::firstOrFail();
        $this->assertTrue((bool) ($advance->receipt_data[0]['advance_credit'] ?? false));

        $this->actingAs($mitra)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.validate', $advance->id), ['decision' => 'APPROVE'])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.pay', $advance->id))
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.store'), [
                ...$period,
                'calculation_method' => 'RESTOCK',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $restockSettlement = MitraSettlement::where('calculation_method', 'RESTOCK')->firstOrFail();
        $advanceRow = collect($restockSettlement->receipt_data)
            ->first(fn (array $item) => ($item['custom_kind'] ?? null) === 'ADVANCE_APPLIED');

        $this->assertSame(70000.0, (float) $restockSettlement->total_amount);
        $this->assertNotNull($advanceRow);
        $this->assertSame(-30000.0, (float) $advanceRow['subtotal']);
    }

    public function test_manual_usage_for_untrackable_stock_is_counted_in_sales_settlement(): void
    {
        [$outlet, $owner, $staff, $mitra, $stock] = $this->createContext();
        $stock->update([
            'name' => 'Saus Mentai',
            'trackable' => false,
            'settlement_usage_method' => StockItem::SETTLEMENT_USAGE_MANUAL,
            'min_restock_qty' => 10,
            'restock_price' => 50000,
        ]);

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.usage-adjustments.store'), [
                'mitra_id' => $mitra->id,
                'stock_item_id' => $stock->id,
                'usage_type' => MitraStockUsageAdjustment::TYPE_MANUAL_USAGE,
                'quantity' => 12,
                'reported_at' => now()->toDateString(),
                'note' => 'Sisa saus dipakai promo',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.store'), [
                'mitra_id' => $mitra->id,
                'start_date' => now()->startOfMonth()->format('Y-m-d'),
                'end_date' => now()->endOfMonth()->format('Y-m-d'),
                'calculation_method' => 'SALES',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $settlement = MitraSettlement::firstOrFail();
        $this->assertSame(60000.0, (float) $settlement->total_amount);
        $this->assertSame('Saus Mentai', $settlement->receipt_data[0]['name']);
        $this->assertSame(12.0, (float) $settlement->receipt_data[0]['calculated_qty']);
        $this->assertSame(12.0, (float) $settlement->receipt_data[0]['manual_usage_qty']);
        $this->assertSame(StockItem::SETTLEMENT_USAGE_MANUAL, $settlement->receipt_data[0]['settlement_usage_method']);
        $this->assertStringContainsString('Manual', $settlement->receipt_data[0]['usage_source_note']);
    }

    public function test_untrackable_stock_can_treat_restock_as_used_for_sales_settlement(): void
    {
        [$outlet, $owner, $staff, $mitra, $stock] = $this->createContext();
        $stock->update([
            'name' => 'Saus Mentai',
            'trackable' => false,
            'settlement_usage_method' => StockItem::SETTLEMENT_USAGE_RESTOCK_AS_USED,
            'min_restock_qty' => 10,
            'restock_price' => 50000,
        ]);

        RestockLog::create([
            'outlet_id' => $outlet->id,
            'stock_item_id' => $stock->id,
            'qty_added' => 30,
            'stock_before' => 0,
            'stock_after' => 30,
            'note' => 'Restok saus periode ini',
            'fund_source' => RestockLog::FUND_SOURCE_WAREHOUSE_TRANSFER,
            'restock_cost' => 0,
            'created_at' => now(),
        ]);

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post(route('settlements.store'), [
                'mitra_id' => $mitra->id,
                'start_date' => now()->startOfMonth()->format('Y-m-d'),
                'end_date' => now()->endOfMonth()->format('Y-m-d'),
                'calculation_method' => 'SALES',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $settlement = MitraSettlement::firstOrFail();
        $this->assertSame(150000.0, (float) $settlement->total_amount);
        $this->assertSame(30.0, (float) $settlement->receipt_data[0]['calculated_qty']);
        $this->assertSame(StockItem::SETTLEMENT_USAGE_RESTOCK_AS_USED, $settlement->receipt_data[0]['settlement_usage_method']);
        $this->assertStringContainsString('dianggap habis', $settlement->receipt_data[0]['usage_source_note']);
    }

    private function createContext(): array
    {
        $outlet = Outlet::create(['name' => 'Outlet Utama']);
        $owner = $this->createUser('owner@delivery.test', 'OWNER');
        $staff = $this->createUser('staff@delivery.test', 'STAFF');
        $mitra = $this->createUser('mitra@delivery.test', 'MITRA');

        $staff->outlets()->attach($outlet->id);
        $mitra->outlets()->attach($outlet->id);

        $stock = StockItem::create([
            'outlet_id' => $outlet->id,
            'name' => 'Dimsum Frozen',
            'current_stock_biji' => 10,
            'unit_name' => 'pcs',
            'min_stock_alert' => 5,
            'trackable' => true,
            'counting_basis' => 'BIJI',
            'min_restock_qty' => 10,
            'restock_price' => 50000,
        ]);

        $mitra->mitraStockItems()->attach($stock->id, ['price' => 50000]);

        return [$outlet, $owner, $staff, $mitra, $stock];
    }

    private function createProductForStock(string $outletId, string $stockItemId): Product
    {
        $product = Product::create([
            'outlet_id' => $outletId,
            'name' => 'Dimsum Ori',
            'category' => 'Makanan',
            'price' => 10000,
            'hpp' => 4000,
            'is_active' => true,
        ]);

        Conversion::create([
            'product_id' => $product->id,
            'stock_item_id' => $stockItemId,
            'ratio' => 1,
        ]);

        return $product;
    }

    private function createPaidSale(string $outletId, Product $product, int $quantity, int $subtotal): void
    {
        $transaction = Transaction::create([
            'outlet_id' => $outletId,
            'invoice_number' => 'INV-'.uniqid(),
            'total_amount' => $subtotal,
            'payment_method' => 'CASH',
            'payment_status' => 'PAID',
            'paid_at' => now(),
            'created_at' => now(),
        ]);

        TransactionItem::create([
            'transaction_id' => $transaction->id,
            'product_id' => $product->id,
            'product_name' => $product->name,
            'qty_porsi' => $quantity,
            'price_per_porsi' => $subtotal / $quantity,
            'subtotal' => $subtotal,
        ]);
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
}
