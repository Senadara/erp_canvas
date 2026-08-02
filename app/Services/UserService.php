<?php

namespace App\Services;

use App\Models\Product;
use App\Models\StockItem;
use App\Models\User;
use App\Models\UserActivityLog;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserService
{
    public function listUsers()
    {
        return User::with(['outlets', 'supplier:id,name,phone'])
            ->orderBy('display_name')
            ->get()
            ->map(function ($user) {
                if ($user->isMitra()) {
                    $user->mitra_product_ids = DB::table('mitra_product_scopes')
                        ->where('user_id', $user->id)
                        ->pluck('product_id')
                        ->toArray();
                    $user->mitra_stock_ids = DB::table('mitra_stock_scopes')
                        ->where('user_id', $user->id)
                        ->pluck('stock_item_id')
                        ->toArray();
                } else {
                    $user->mitra_product_ids = [];
                    $user->mitra_stock_ids = [];
                }
                return $user;
            });
    }

    public function createUser(array $data)
    {
        return DB::transaction(function () use ($data) {
            $user = User::create([
                'email' => $data['email'],
                'password_hash' => Hash::make($data['password']),
                'display_name' => $data['display_name'],
                'role' => $data['role'],
                'supplier_id' => $data['role'] === 'MITRA' ? ($data['supplier_id'] ?? null) : null,
                'is_active' => $data['is_active'] ?? true,
                'feature_overrides' => $data['feature_overrides'] ?? null,
                'mitra_can_view_sales' => $data['mitra_can_view_sales'] ?? false,
            ]);

            if ($user->role === 'MITRA') {
                $this->syncMitraScopes($user, $data);
            } elseif (!empty($data['outlet_ids'])) {
                $user->outlets()->sync($data['outlet_ids']);
            }

            return $user->load('outlets');
        });
    }

    public function updateUser(string $id, array $data)
    {
        return DB::transaction(function () use ($id, $data) {
            $user = User::findOrFail($id);

            $updates = [
                'email' => $data['email'] ?? $user->email,
                'display_name' => $data['display_name'] ?? $user->display_name,
                'role' => $data['role'] ?? $user->role,
                'supplier_id' => ($data['role'] ?? $user->role) === 'MITRA' ? ($data['supplier_id'] ?? $user->supplier_id) : null,
                'is_active' => $data['is_active'] ?? $user->is_active,
            ];

            if (!empty($data['password'])) {
                $updates['password_hash'] = Hash::make($data['password']);
            }

            if (array_key_exists('feature_overrides', $data)) {
                $updates['feature_overrides'] = $data['feature_overrides'];
            }

            if (array_key_exists('mitra_can_view_sales', $data)) {
                $updates['mitra_can_view_sales'] = $data['mitra_can_view_sales'] ?? false;
            }

            $user->update($updates);

            if (($data['role'] ?? $user->role) === 'MITRA') {
                $user->refresh();
                $this->syncMitraScopes($user, $data);
            } else {
                // If role changed away from MITRA, clear scopes and sales flag
                DB::table('mitra_product_scopes')->where('user_id', $user->id)->delete();
                DB::table('mitra_stock_scopes')->where('user_id', $user->id)->delete();
                $user->outlets()->sync($data['outlet_ids'] ?? []);
                if ($user->mitra_can_view_sales) {
                    $user->update(['mitra_can_view_sales' => false, 'supplier_id' => null]);
                }
            }

            return $user->load('outlets');
        });
    }

    public function deleteUser(string $id)
    {
        $user = User::findOrFail($id);
        if ($user->isOwner()) {
            throw new \Exception("Tidak bisa menghapus akun owner.");
        }
        return $user->delete();
    }

    public function logActivity(string $userId, string $action, ?string $description = null)
    {
        return UserActivityLog::create([
            'user_id' => $userId,
            'action' => $action,
            'description' => $description,
            'created_at' => Carbon::now(),
        ]);
    }

    public function listActivityLogs(int $limit = 100)
    {
        return UserActivityLog::with('user:id,display_name,role')
            ->orderByDesc('created_at')
            ->take($limit)
            ->get();
    }

    public function getMitraScopes(string $userId)
    {
        $productIds = DB::table('mitra_product_scopes')
            ->where('user_id', $userId)
            ->pluck('product_id');

        $stockIds = DB::table('mitra_stock_scopes')
            ->where('user_id', $userId)
            ->pluck('stock_item_id');

        return [
            'product_ids' => $productIds,
            'stock_ids' => $stockIds,
        ];
    }

    public function syncMitraUsersForSupplier(string $supplierId): void
    {
        DB::transaction(function () use ($supplierId) {
            User::where('role', 'MITRA')
                ->where('supplier_id', $supplierId)
                ->get()
                ->each(fn (User $user) => $this->syncMitraScopes($user, [
                    'role' => 'MITRA',
                    'supplier_id' => $supplierId,
                ]));
        });
    }

    public function clearMitraSupplierLinks(string $supplierId): void
    {
        DB::transaction(function () use ($supplierId) {
            User::where('role', 'MITRA')
                ->where('supplier_id', $supplierId)
                ->get()
                ->each(function (User $user) {
                    DB::table('mitra_product_scopes')->where('user_id', $user->id)->delete();
                    DB::table('mitra_stock_scopes')->where('user_id', $user->id)->delete();
                    $user->update([
                        'supplier_id' => null,
                        'mitra_can_view_sales' => false,
                    ]);
                });
        });
    }

    private function syncMitraScopes(User $user, array $data): void
    {
        DB::table('mitra_product_scopes')->where('user_id', $user->id)->delete();
        DB::table('mitra_stock_scopes')->where('user_id', $user->id)->delete();

        $scopes = $this->resolveMitraScopes($data);
        $outletIds = collect($data['outlet_ids'] ?? [])
            ->merge($scopes['outlet_ids'])
            ->filter()
            ->unique()
            ->values()
            ->all();

        $user->outlets()->sync($outletIds);

        if (! empty($scopes['product_ids'])) {
            DB::table('mitra_product_scopes')->insert(
                collect($scopes['product_ids'])->map(fn ($productId) => [
                    'user_id' => $user->id,
                    'product_id' => $productId,
                ])->all()
            );
        }

        if (! empty($scopes['stock_items'])) {
            DB::table('mitra_stock_scopes')->insert(
                collect($scopes['stock_items'])->map(fn (StockItem $stockItem) => [
                    'user_id' => $user->id,
                    'stock_item_id' => $stockItem->id,
                    'price' => (float) $stockItem->restock_price,
                ])->all()
            );
        }
    }

    private function resolveMitraScopes(array $data): array
    {
        if (! empty($data['supplier_id'])) {
            $stockItems = StockItem::where('supplier_id', $data['supplier_id'])
                ->orderBy('name')
                ->get(['id', 'outlet_id', 'restock_price']);
            $stockIds = $stockItems->pluck('id')->all();
            $productIds = empty($stockIds)
                ? []
                : Product::whereHas('conversions', fn ($query) => $query->whereIn('stock_item_id', $stockIds))
                    ->pluck('id')
                    ->unique()
                    ->values()
                    ->all();

            return [
                'stock_items' => $stockItems->values()->all(),
                'product_ids' => $productIds,
                'outlet_ids' => $stockItems->pluck('outlet_id')->unique()->values()->all(),
            ];
        }

        $stockIds = collect($data['mitra_stock_ids'] ?? [])->filter()->unique()->values()->all();
        $stockItems = empty($stockIds)
            ? collect()
            : StockItem::whereIn('id', $stockIds)->get(['id', 'outlet_id', 'restock_price']);

        return [
            'stock_items' => $stockItems->values()->all(),
            'product_ids' => collect($data['mitra_product_ids'] ?? [])->filter()->unique()->values()->all(),
            'outlet_ids' => $stockItems->pluck('outlet_id')->unique()->values()->all(),
        ];
    }
}
