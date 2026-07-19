<?php

namespace Tests\Feature;

use App\Models\MitraSettlement;
use App\Models\MitraStockDelivery;
use App\Models\Outlet;
use App\Models\PettyCash;
use App\Models\RestockLog;
use App\Models\StockItem;
use App\Models\User;
use App\Models\WarehouseStockItem;
use App\Models\WarehouseStockTransfer;
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
        $singlePdf->assertDownload('setoran-mitra-'.now()->format('Ymd').'.pdf');

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

        $otherMitra = $this->createUser('other-mitra@delivery.test', 'MITRA');
        $otherMitra->outlets()->attach($outlet->id);

        $this->actingAs($otherMitra)
            ->withSession(['outlet_id' => $outlet->id])
            ->get(route('settlements.pdf', $settlement->id))
            ->assertNotFound();
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
