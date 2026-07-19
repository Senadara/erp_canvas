<?php

namespace App\Http\Controllers;

use App\Services\DisplayGroupService;
use App\Services\StockService;
use App\Services\WarehouseInventoryService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class StockController extends Controller
{
    public function __construct(
        private StockService $stockService,
        private DisplayGroupService $displayGroupService,
        private WarehouseInventoryService $warehouseInventoryService,
    ) {}

    public function index(Request $request)
    {
        $outletId = $request->session()->get('outlet_id');
        $user = $request->user();
        
        $stockItems = $this->stockService->listStockItems($outletId);
        
        if ($user && $user->isMitra()) {
            $mitraStockItems = $user->mitraStockItems()->get()->keyBy('id');
            $mitraStockIds = $mitraStockItems->keys()->toArray();
            
            $stockItems = collect($stockItems)->filter(function ($item) use ($mitraStockIds) {
                return in_array($item->id, $mitraStockIds);
            })->map(function ($item) {
                // Harga mitra sekarang mengacu ke restock_price dari master data admin
                $item->mitra_price = $item->restock_price ?? 0;
                return $item;
            })->values();
        }

        $displayGroups = $this->displayGroupService->listDisplayGroups('STOCK', $outletId);
        $restockLogs = \Illuminate\Support\Facades\DB::table('restock_logs')
            ->join('stock_items', 'restock_logs.stock_item_id', '=', 'stock_items.id')
            ->where('restock_logs.outlet_id', $outletId)
            ->select('restock_logs.*', 'stock_items.name as stock_item_name', 'stock_items.unit_name')
            ->orderByDesc('restock_logs.created_at');

        if ($user && $user->isMitra()) {
            $restockLogs->whereIn('restock_logs.stock_item_id', $mitraStockIds ?? []);
        }

        $restockLogs = $restockLogs->get();
        $warehouseItemsQuery = \App\Models\WarehouseStockItem::with([
            'warehouse:id,name',
            'mitra:id,display_name',
            'outletStockItems:id,outlet_id,warehouse_stock_item_id,name,current_stock_biji',
        ]);
        if ($user && $user->isMitra()) {
            $warehouseItemsQuery->where('mitra_id', $user->id);
        } elseif (! $user?->isOwner()) {
            $warehouseItemsQuery->whereHas(
                'outletStockItems',
                fn ($query) => $query->where('outlet_id', $outletId)
            );
        }
        $warehouseItems = $warehouseItemsQuery
            ->orderBy('name')
            ->get()
            ->map(function ($item) use ($user) {
                if ($user && $user->isMitra()) {
                    $item->source_stock_item_id = $item->outletStockItems->first()?->id;
                }

                return $item;
            });

        $deliveries = \App\Models\MitraStockDelivery::with([
            'stockItem:id,name,unit_name',
            'warehouse:id,name',
            'warehouseStockItem:id,name,unit_name,current_stock',
            'mitra:id,display_name',
            'receiver:id,display_name',
        ])
            ->when($user && $user->isMitra(), fn ($query) => $query->where('mitra_id', $user->id))
            ->orderByRaw("CASE WHEN status = 'SENT' THEN 0 ELSE 1 END")
            ->orderByDesc('sent_at')
            ->take(150)
            ->get();
        $transfers = \App\Models\WarehouseStockTransfer::with([
            'warehouseStockItem:id,name,unit_name',
            'outlet:id,name',
            'transferredBy:id,display_name',
        ])
            ->when(
                ! $user?->isOwner() && ! $user?->isMitra(),
                fn ($query) => $query->where('outlet_id', $outletId)
            )
            ->when(
                $user && $user->isMitra(),
                fn ($query) => $query->whereHas(
                    'warehouseStockItem',
                    fn ($itemQuery) => $itemQuery->where('mitra_id', $user->id)
                )
            )
            ->orderByDesc('created_at')
            ->take(150)
            ->get();

        return Inertia::render('Stock/Index', [
            'stockItems' => $stockItems,
            'displayGroups' => $displayGroups,
            'restockLogs' => $restockLogs,
            'deliveries' => $deliveries,
            'warehouseItems' => $warehouseItems,
            'transfers' => $transfers,
        ]);
    }

    public function updateMitraPrice(Request $request, string $id)
    {
        // Fitur ubah harga mitra dinonaktifkan - harga mengacu ke restock_price yang di-set admin
        abort(403, 'Fitur ubah harga sudah tidak tersedia. Harga mengikuti pengaturan admin.');
    }

    public function store(Request $request)
    {
        abort_if($request->user() && $request->user()->role !== 'OWNER', 403, 'Hanya owner yang dapat menambah atau mengedit data bahan.');

        if ($request->user() && $request->user()->isMitra()) {
            return redirect()->back()->withErrors(['error' => 'Mitra tidak dapat mengubah stok.']);
        }

        $outletId = $request->session()->get('outlet_id');
        $data = $request->validate([
            'id' => 'nullable|string',
            'name' => 'required|string',
            'current_stock_biji' => 'required|numeric|min:0',
            'unit_name' => 'nullable|string',
            'min_stock_alert' => 'nullable|numeric|min:0',
            'trackable' => 'boolean',
            'counting_basis' => 'required|in:BIJI,PORSI',
            'display_group_id' => 'nullable|string',
            'min_restock_qty' => 'nullable|numeric|min:0',
            'restock_price' => 'nullable|numeric|min:0',
        ]);

        $data['outlet_id'] = $outletId;

        if (!empty($data['id'])) {
            $this->stockService->updateStockItem($data['id'], $outletId, $data);
        } else {
            $this->stockService->createStockItem($data);
        }

        return redirect()->back()->with('success', 'Item stok berhasil disimpan.');
    }

    public function destroy(Request $request, string $id)
    {
        abort_if($request->user() && $request->user()->role !== 'OWNER', 403, 'Hanya owner yang dapat menghapus data bahan.');

        if ($request->user() && $request->user()->isMitra()) {
            return redirect()->back()->withErrors(['error' => 'Mitra tidak dapat mengubah stok.']);
        }

        $outletId = $request->session()->get('outlet_id');
        try {
            $this->stockService->deleteStockItem($outletId, $id);
            return redirect()->back()->with('success', 'Item stok berhasil dihapus.');
        } catch (\Exception $e) {
            return redirect()->back()->withErrors(['error' => $e->getMessage()]);
        }
    }

    public function addStock(Request $request, string $id)
    {
        if ($request->user() && $request->user()->isMitra()) {
            return redirect()->back()->withErrors(['error' => 'Mitra tidak dapat mengubah stok.']);
        }

        $data = $request->validate([
            'qty' => 'required|numeric|min:0.0001',
            'fund_source' => 'nullable|in:CASHIER_CASH,PRIVATE_CASH',
            'note' => 'nullable|string',
        ]);

        $outletId = $request->session()->get('outlet_id');
        $this->stockService->addStock($id, $data['qty'], $data['note'], $outletId, $data['fund_source'] ?? \App\Models\RestockLog::FUND_SOURCE_CASHIER);
        return redirect()->back()->with('success', 'Stok berhasil ditambahkan.');
    }

    public function transferFromWarehouse(Request $request, string $id)
    {
        $user = $request->user();
        abort_if(! $user || $user->isMitra(), 403, 'Hanya petugas outlet yang dapat mengambil stok gudang.');

        $data = $request->validate([
            'qty' => ['required', 'numeric', 'min:0.0001'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        try {
            $this->warehouseInventoryService->transferToOutlet(
                (string) $request->session()->get('outlet_id'),
                $id,
                $user,
                (float) $data['qty'],
                $data['note'] ?? null,
            );
        } catch (\InvalidArgumentException $exception) {
            return back()->withErrors(['warehouse_transfer' => $exception->getMessage()]);
        }

        return back()->with('success', 'Stok berhasil diambil dari gudang dan ditambahkan ke outlet.');
    }

    public function recordWaste(Request $request, string $id)
    {
        if ($request->user() && $request->user()->isMitra()) {
            return redirect()->back()->withErrors(['error' => 'Mitra tidak dapat mengubah stok.']);
        }

        $outletId = $request->session()->get('outlet_id');
        $data = $request->validate([
            'qty' => 'required|numeric|min:0.0001',
            'reason' => 'required|string',
        ]);

        try {
            $this->stockService->recordWaste($outletId, $id, $data['qty'], $data['reason']);
            return redirect()->back()->with('success', 'Waste berhasil dicatat.');
        } catch (\Exception $e) {
            return redirect()->back()->withErrors(['error' => $e->getMessage()]);
        }
    }
}
