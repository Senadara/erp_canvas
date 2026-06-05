<?php

namespace App\Http\Controllers;

use App\Models\Outlet;
use App\Models\Product;
use App\Models\StockItem;
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

        return Inertia::render('Users/Index', [
            'users' => $users,
            'outlets' => $outlets,
            'activityLogs' => $logs,
            'products' => $products,
            'stockItems' => $stockItems,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:6',
            'display_name' => 'required|string',
            'role' => 'required|in:OWNER,STAFF,MITRA',
            'is_active' => 'boolean',
            'outlet_ids' => 'nullable|array',
            'outlet_ids.*' => 'string',
            'mitra_product_ids' => 'nullable|array',
            'mitra_product_ids.*' => 'string',
            'mitra_stock_ids' => 'nullable|array',
            'mitra_stock_ids.*' => 'string',
            'feature_overrides' => 'nullable|array',
            'feature_overrides.*' => 'boolean',
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
        $data = $request->validate([
            'email' => 'required|email',
            'password' => 'nullable|string|min:6',
            'display_name' => 'required|string',
            'role' => 'required|in:OWNER,STAFF,MITRA',
            'is_active' => 'boolean',
            'outlet_ids' => 'nullable|array',
            'outlet_ids.*' => 'string',
            'mitra_product_ids' => 'nullable|array',
            'mitra_product_ids.*' => 'string',
            'mitra_stock_ids' => 'nullable|array',
            'mitra_stock_ids.*' => 'string',
            'feature_overrides' => 'nullable|array',
            'feature_overrides.*' => 'boolean',
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
        try {
            $this->userService->deleteUser($id);
            $this->userService->logActivity($request->user()->id, 'DELETE_USER', "Hapus user ID: {$id}");
            return redirect()->back()->with('success', 'Pengguna berhasil dihapus.');
        } catch (\Exception $e) {
            return redirect()->back()->withErrors(['error' => $e->getMessage()]);
        }
    }
}
