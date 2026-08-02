<?php

namespace App\Http\Controllers;

use App\Models\Outlet;
use App\Models\Product;
use App\Models\StockItem;
use App\Models\Supplier;
use App\Services\UserService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class UserController extends Controller
{
    public function __construct(private UserService $userService) {}

    public function index(Request $request)
    {
        $outletId = $request->session()->get('outlet_id');

        $users = $this->userService->listUsers();
        $outlets = Outlet::orderBy('name')->get();
        $logs = $this->userService->listActivityLogs(50);
        $products = Product::where('outlet_id', $outletId)->orderBy('name')->get(['id', 'name']);
        $stockItems = StockItem::where('outlet_id', $outletId)->orderBy('name')->get(['id', 'name']);
        $suppliers = Supplier::with([
            'stockItems:id,supplier_id,outlet_id,name',
            'stockItems.conversions:id,stock_item_id,product_id',
        ])
            ->withCount(['stockItems', 'mitraUsers'])
            ->orderBy('name')
            ->get()
            ->map(fn (Supplier $supplier) => [
                'id' => $supplier->id,
                'name' => $supplier->name,
                'phone' => $supplier->phone,
                'stock_items_count' => $supplier->stock_items_count,
                'mitra_users_count' => $supplier->mitra_users_count,
                'stock_item_ids' => $supplier->stockItems->pluck('id')->values()->all(),
                'outlet_ids' => $supplier->stockItems->pluck('outlet_id')->filter()->unique()->values()->all(),
                'product_ids' => $supplier->stockItems
                    ->flatMap(fn (StockItem $stockItem) => $stockItem->conversions->pluck('product_id'))
                    ->filter()
                    ->unique()
                    ->values()
                    ->all(),
            ]);

        return Inertia::render('Users/Index', [
            'users' => $users,
            'outlets' => $outlets,
            'activityLogs' => $logs,
            'products' => $products,
            'stockItems' => $stockItems,
            'suppliers' => $suppliers,
        ]);
    }

    public function store(Request $request)
    {
        abort_if($request->user() && $request->user()->role !== 'OWNER', 403, 'Hanya owner yang dapat mengelola pengguna.');

        $data = $request->validate([
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:6',
            'display_name' => 'required|string',
            'role' => 'required|in:OWNER,STAFF,MITRA',
            'supplier_id' => 'required_if:role,MITRA|nullable|exists:suppliers,id',
            'is_active' => 'boolean',
            'outlet_ids' => 'nullable|array',
            'outlet_ids.*' => 'string',
            'mitra_product_ids' => 'nullable|array',
            'mitra_product_ids.*' => 'string',
            'mitra_stock_ids' => 'nullable|array',
            'mitra_stock_ids.*' => 'string',
            'feature_overrides' => 'nullable|array',
            'feature_overrides.*' => 'boolean',
            'mitra_can_view_sales' => 'nullable|boolean',
        ]);

        try {
            $this->userService->createUser($data);
            $this->userService->logActivity($request->user()->id, 'CREATE_USER', "Membuat user: {$data['display_name']}");
            return redirect()->back()->with('success', 'Pengguna berhasil dibuat.');
        } catch (\Exception $e) {
            return redirect()->back()->withErrors(['error' => $e->getMessage()]);
        }
    }

    public function update(Request $request, string $id)
    {
        abort_if($request->user() && $request->user()->role !== 'OWNER', 403, 'Hanya owner yang dapat mengelola pengguna.');

        $data = $request->validate([
            'email' => 'required|email',
            'password' => 'nullable|string|min:6',
            'display_name' => 'required|string',
            'role' => 'required|in:OWNER,STAFF,MITRA',
            'supplier_id' => 'required_if:role,MITRA|nullable|exists:suppliers,id',
            'is_active' => 'boolean',
            'outlet_ids' => 'nullable|array',
            'outlet_ids.*' => 'string',
            'mitra_product_ids' => 'nullable|array',
            'mitra_product_ids.*' => 'string',
            'mitra_stock_ids' => 'nullable|array',
            'mitra_stock_ids.*' => 'string',
            'feature_overrides' => 'nullable|array',
            'feature_overrides.*' => 'boolean',
            'mitra_can_view_sales' => 'nullable|boolean',
        ]);

        try {
            $this->userService->updateUser($id, $data);
            $this->userService->logActivity($request->user()->id, 'UPDATE_USER', "Update user ID: {$id}");
            return redirect()->back()->with('success', 'Pengguna berhasil diperbarui.');
        } catch (\Exception $e) {
            return redirect()->back()->withErrors(['error' => $e->getMessage()]);
        }
    }

    public function destroy(Request $request, string $id)
    {
        abort_if($request->user() && $request->user()->role !== 'OWNER', 403, 'Hanya owner yang dapat mengelola pengguna.');

        try {
            $this->userService->deleteUser($id);
            $this->userService->logActivity($request->user()->id, 'DELETE_USER', "Hapus user ID: {$id}");
            return redirect()->back()->with('success', 'Pengguna berhasil dihapus.');
        } catch (\Exception $e) {
            return redirect()->back()->withErrors(['error' => $e->getMessage()]);
        }
    }
}
