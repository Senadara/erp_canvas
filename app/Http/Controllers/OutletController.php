<?php

namespace App\Http\Controllers;

use App\Models\Outlet;
use Illuminate\Http\Request;
use Inertia\Inertia;

class OutletController extends Controller
{
    public function index()
    {
        $outlets = Outlet::withCount(['products', 'stockItems', 'users'])->orderBy('name')->get();

        return Inertia::render('Outlets/Index', [
            'outlets' => $outlets,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'id' => 'nullable|string',
            'name' => 'required|string',
            'address' => 'nullable|string',
            'phone' => 'nullable|string',
        ]);

        if (!empty($data['id'])) {
            $outlet = Outlet::findOrFail($data['id']);
            $outlet->update([
                'name' => $data['name'],
                'address' => $data['address'] ?? null,
                'phone' => $data['phone'] ?? null,
            ]);
        } else {
            Outlet::create([
                'name' => $data['name'],
                'address' => $data['address'] ?? null,
                'phone' => $data['phone'] ?? null,
            ]);
        }

        return redirect()->back()->with('success', 'Outlet berhasil disimpan.');
    }

    public function destroy(string $id)
    {
        $outlet = Outlet::findOrFail($id);

        \Illuminate\Support\Facades\DB::transaction(function () use ($outlet) {
            \App\Models\Transaction::where('outlet_id', $outlet->id)->delete();
            \App\Models\ShiftRecord::where('outlet_id', $outlet->id)->delete();
            \App\Models\PettyCash::where('outlet_id', $outlet->id)->delete();
            \App\Models\WasteLog::where('outlet_id', $outlet->id)->delete();
            \Illuminate\Support\Facades\DB::table('restock_logs')->where('outlet_id', $outlet->id)->delete();
            \App\Models\Product::where('outlet_id', $outlet->id)->delete();
            \App\Models\StockItem::where('outlet_id', $outlet->id)->delete();
            \App\Models\DisplayGroup::where('outlet_id', $outlet->id)->delete();
            
            $outlet->delete();
        });

        return redirect()->back()->with('success', 'Outlet berhasil dihapus.');
    }
}
