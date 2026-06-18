<?php

namespace App\Http\Controllers;

use App\Services\DisplayGroupService;
use App\Services\StockService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class StockController extends Controller
{
    public function __construct(
        private StockService $stockService,
        private DisplayGroupService $displayGroupService
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
            })->map(function ($item) use ($mitraStockItems) {
                $item->mitra_price = $mitraStockItems[$item->id]->pivot->price ?? 0;
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

        return Inertia::render('Stock/Index', [
            'stockItems' => $stockItems,
            'displayGroups' => $displayGroups,
            'restockLogs' => $restockLogs,
        ]);
    }

    public function updateMitraPrice(Request $request, string $id)
    {
        $user = $request->user();
        if (!$user || !$user->isMitra()) {
            abort(403, 'Hanya mitra yang dapat mengatur harga mitra.');
        }

        $data = $request->validate([
            'price' => 'required|numeric|min:0',
        ]);

        if (!$user->mitraStockItems()->where('stock_item_id', $id)->exists()) {
            return redirect()->back()->withErrors(['error' => 'Item stok tidak ada dalam scope Anda.']);
        }

        $user->mitraStockItems()->updateExistingPivot($id, [
            'price' => $data['price']
        ]);

        return redirect()->back()->with('success', 'Harga mitra berhasil diperbarui.');
    }

    public function store(Request $request)
    {
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
            'note' => 'nullable|string',
        ]);

        $this->stockService->addStock($id, $data['qty'], $data['note']);
        return redirect()->back()->with('success', 'Stok berhasil ditambahkan.');
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
