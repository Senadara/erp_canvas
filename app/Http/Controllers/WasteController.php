<?php

namespace App\Http\Controllers;

use App\Models\StockItem;
use App\Models\WasteLog;
use Illuminate\Http\Request;
use Inertia\Inertia;

class WasteController extends Controller
{
    public function index(Request $request)
    {
        $outletId = $request->session()->get('outlet_id');

        $wasteLogs = WasteLog::where('outlet_id', $outletId)
            ->with('stockItem:id,name,unit_name')
            ->orderByDesc('created_at')
            ->take(100)
            ->get();

        $stockItems = StockItem::where('outlet_id', $outletId)
            ->where('trackable', true)
            ->orderBy('name')
            ->get(['id', 'name', 'unit_name', 'current_stock_biji']);

        return Inertia::render('Waste/Index', [
            'wasteLogs' => $wasteLogs,
            'stockItems' => $stockItems,
        ]);
    }

    public function store(Request $request)
    {
        $outletId = $request->session()->get('outlet_id');

        $data = $request->validate([
            'stock_item_id' => 'required|string',
            'qty_biji' => 'required|numeric|min:0.0001',
            'reason' => 'required|string',
        ]);

        $stockItem = StockItem::where('id', $data['stock_item_id'])
            ->where('outlet_id', $outletId)
            ->firstOrFail();

        if ($stockItem->current_stock_biji < $data['qty_biji']) {
            return redirect()->back()->withErrors(['error' => "Stok tidak cukup. Tersisa: {$stockItem->current_stock_biji}"]);
        }

        WasteLog::create([
            'outlet_id' => $outletId,
            'stock_item_id' => $data['stock_item_id'],
            'qty_biji' => $data['qty_biji'],
            'reason' => $data['reason'],
        ]);

        $stockItem->decrement('current_stock_biji', $data['qty_biji']);

        return redirect()->back()->with('success', 'Waste berhasil dicatat dan stok dikurangi.');
    }
}
