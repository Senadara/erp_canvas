<?php

namespace App\Http\Controllers;

use App\Services\DisplayGroupService;
use App\Services\ProductService;
use App\Services\StockService;
use App\Services\UploadService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ProductController extends Controller
{
    public function __construct(
        private ProductService $productService,
        private StockService $stockService,
        private DisplayGroupService $displayGroupService,
        private UploadService $uploadService
    ) {}

    public function index(Request $request)
    {
        $outletId = $request->session()->get('outlet_id');
        
        $products = $this->productService->listProducts($outletId);
        $displayGroups = $this->displayGroupService->listDisplayGroups('PRODUCT', $outletId);
        $stockItems = $this->stockService->listStockItems($outletId);

        return Inertia::render('Products/Index', [
            'products' => $products,
            'displayGroups' => $displayGroups,
            'stockItems' => $stockItems,
        ]);
    }

    public function store(Request $request)
    {
        $outletId = $request->session()->get('outlet_id');
        $data = $request->validate([
            'id' => 'nullable|string',
            'name' => 'required|string',
            'category' => 'required|string',
            'price' => 'required|numeric|min:0',
            'hpp' => 'nullable|numeric|min:0',
            'is_active' => 'boolean',
            'display_group_id' => 'nullable|string',
            'image' => 'nullable|image|max:2048', // 2MB max
            'image_url' => 'nullable|string', // If not updating image
        ]);
        
        $data['outlet_id'] = $outletId;
        
        if ($request->hasFile('image')) {
            $data['image_url'] = $this->uploadService->uploadImage($request->file('image'));
        }

        $this->productService->upsertProduct($data);

        return redirect()->back()->with('success', 'Produk berhasil disimpan.');
    }

    public function destroy(Request $request, string $id)
    {
        $outletId = $request->session()->get('outlet_id');
        $this->productService->deleteProduct($id, $outletId);
        return redirect()->back()->with('success', 'Produk berhasil dihapus.');
    }

    public function setConversions(Request $request, string $id)
    {
        $outletId = $request->session()->get('outlet_id');
        $data = $request->validate([
            'conversions' => 'array',
            'conversions.*.stock_item_id' => 'required|string',
            'conversions.*.ratio' => 'required|numeric|min:0.0001',
            'conversions.*.initial_stock' => 'nullable|numeric|min:0',
        ]);

        $this->productService->setProductConversions($id, $outletId, $data['conversions'], $this->stockService);
        return redirect()->back()->with('success', 'Konversi bahan berhasil disimpan.');
    }
}
