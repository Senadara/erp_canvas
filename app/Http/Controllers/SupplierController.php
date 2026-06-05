<?php

namespace App\Http\Controllers;

use App\Services\SupplierService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SupplierController extends Controller
{
    public function __construct(private SupplierService $supplierService) {}

    public function index(Request $request)
    {
        $outletId = $request->session()->get('outlet_id');
        $suppliers = $this->supplierService->listSuppliers();
        $stockItems = \App\Models\StockItem::where('outlet_id', $outletId)
            ->orderBy('name')
            ->get(['id', 'name', 'supplier_id']);

        return Inertia::render('Suppliers/Index', [
            'suppliers' => $suppliers,
            'stockItems' => $stockItems,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'id' => 'nullable|string',
            'name' => 'required|string',
            'phone' => 'nullable|string',
            'address' => 'nullable|string',
            'stock_item_ids' => 'nullable|array',
            'stock_item_ids.*' => 'string'
        ]);

        $supplier = $this->supplierService->upsertSupplier($data);

        if (array_key_exists('stock_item_ids', $data)) {
            $outletId = $request->session()->get('outlet_id');
            // Remove supplier_id from all stock items in this outlet that currently belong to this supplier
            \App\Models\StockItem::where('outlet_id', $outletId)->where('supplier_id', $supplier->id)->update(['supplier_id' => null]);
            
            // Assign supplier_id to the selected stock items
            if (!empty($data['stock_item_ids'])) {
                \App\Models\StockItem::whereIn('id', $data['stock_item_ids'])
                    ->where('outlet_id', $outletId)
                    ->update(['supplier_id' => $supplier->id]);
            }
        }

        return redirect()->back()->with('success', 'Supplier berhasil disimpan.');
    }

    public function destroy(string $id)
    {
        $this->supplierService->deleteSupplier($id);

        return redirect()->back()->with('success', 'Supplier berhasil dihapus.');
    }
}
