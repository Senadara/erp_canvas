<?php

namespace App\Services;

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
        return User::with('outlets')
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
                'is_active' => $data['is_active'] ?? true,
                'feature_overrides' => $data['feature_overrides'] ?? null,
                'mitra_can_view_sales' => $data['mitra_can_view_sales'] ?? false,
            ]);

            if (!empty($data['outlet_ids'])) {
                $user->outlets()->sync($data['outlet_ids']);
            }

            // Mitra scopes
            if ($user->role === 'MITRA') {
                if (!empty($data['mitra_product_ids'])) {
                    DB::table('mitra_product_scopes')->insert(
                        collect($data['mitra_product_ids'])->map(fn($pid) => [
                            'user_id' => $user->id,
                            'product_id' => $pid,
                        ])->toArray()
                    );
                }
                if (!empty($data['mitra_stock_ids'])) {
                    DB::table('mitra_stock_scopes')->insert(
                        collect($data['mitra_stock_ids'])->map(fn($sid) => [
                            'user_id' => $user->id,
                            'stock_item_id' => $sid,
                        ])->toArray()
                    );
                }
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

            if (isset($data['outlet_ids'])) {
                $user->outlets()->sync($data['outlet_ids']);
            }

            // Mitra scopes
            if (($data['role'] ?? $user->role) === 'MITRA') {
                DB::table('mitra_product_scopes')->where('user_id', $user->id)->delete();
                DB::table('mitra_stock_scopes')->where('user_id', $user->id)->delete();

                if (!empty($data['mitra_product_ids'])) {
                    DB::table('mitra_product_scopes')->insert(
                        collect($data['mitra_product_ids'])->map(fn($pid) => [
                            'user_id' => $user->id,
                            'product_id' => $pid,
                        ])->toArray()
                    );
                }
                if (!empty($data['mitra_stock_ids'])) {
                    DB::table('mitra_stock_scopes')->insert(
                        collect($data['mitra_stock_ids'])->map(fn($sid) => [
                            'user_id' => $user->id,
                            'stock_item_id' => $sid,
                        ])->toArray()
                    );
                }
            } else {
                // If role changed away from MITRA, clear scopes and sales flag
                DB::table('mitra_product_scopes')->where('user_id', $user->id)->delete();
                DB::table('mitra_stock_scopes')->where('user_id', $user->id)->delete();
                if ($user->mitra_can_view_sales) {
                    $user->update(['mitra_can_view_sales' => false]);
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
}
