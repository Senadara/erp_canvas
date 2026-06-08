<?php

namespace App\Http\Controllers;

use App\Models\Outlet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
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
            'logo' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
        ]);

        $logoPath = null;
        if ($request->hasFile('logo')) {
            $logoPath = $request->file('logo')->store('outlet-logos', 'public');
        }

        if (!empty($data['id'])) {
            $outlet = Outlet::findOrFail($data['id']);
            $updateData = [
                'name' => $data['name'],
                'address' => $data['address'] ?? null,
                'phone' => $data['phone'] ?? null,
            ];
            if ($logoPath) {
                $updateData['logo'] = $logoPath;
                // Delete old logo if exists
                if ($outlet->logo) {
                    Storage::disk('public')->delete($outlet->logo);
                }
            }
            $outlet->update($updateData);
        } else {
            Outlet::create([
                'name' => $data['name'],
                'address' => $data['address'] ?? null,
                'phone' => $data['phone'] ?? null,
                'logo' => $logoPath,
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
