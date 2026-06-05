<?php

namespace App\Http\Controllers;

use App\Services\DisplayGroupService;
use Illuminate\Http\Request;

class DisplayGroupController extends Controller
{
    public function __construct(private DisplayGroupService $displayGroupService) {}

    public function store(Request $request)
    {
        $outletId = $request->session()->get('outlet_id');
        $data = $request->validate([
            'id' => 'nullable|string',
            'name' => 'required|string',
            'context' => 'required|in:PRODUCT,STOCK',
            'sort_order' => 'nullable|integer',
        ]);

        $data['outlet_id'] = $outletId;

        if (!empty($data['id'])) {
            $this->displayGroupService->renameDisplayGroup($data['id'], $data['name']);
        } else {
            $this->displayGroupService->createDisplayGroup($data);
        }

        return redirect()->back()->with('success', 'Kategori berhasil disimpan.');
    }

    public function destroy(string $id)
    {
        $this->displayGroupService->deleteDisplayGroup($id);
        return redirect()->back()->with('success', 'Kategori berhasil dihapus.');
    }
}
