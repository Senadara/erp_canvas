<?php

namespace App\Support;

use App\Models\User;

class NavPermission
{
    /** @var array<string, bool> */
    private const STAFF_DEFAULT = [
        'dashboard' => true,
        'cashier' => true,
        'products' => true,
        'stock' => true,
        'expenses' => false,
        'waste' => true,
        'reports' => true,
        'receipts' => true,
        'owner' => false,
        'users' => false,
        'outlets' => false,
        'suppliers' => false,
    ];

    /** @var array<string, bool> */
    private const MITRA_NAV = [
        'dashboard' => true,
        'cashier' => false,
        'products' => false,
        'stock' => true,
        'expenses' => false,
        'waste' => false,
        'reports' => true,
        'receipts' => false,
        'owner' => false,
        'users' => false,
        'outlets' => false,
        'suppliers' => false,
    ];

    public static function canSee(?User $user, string $feature): bool
    {
        if (! $user) {
            return false;
        }
        if ($user->isOwner()) {
            return true;
        }
        if ($user->isMitra()) {
            return self::MITRA_NAV[$feature] ?? false;
        }
        $overrides = $user->feature_overrides ?? [];
        if (array_key_exists($feature, $overrides)) {
            return (bool) $overrides[$feature];
        }

        return self::STAFF_DEFAULT[$feature] ?? false;
    }

    /** @return list<array{href: string, label: string, feature: string, icon: string, group: string}> */
    public static function navItems(): array
    {
        return [
            ['href' => '/dashboard', 'label' => 'Dashboard', 'feature' => 'dashboard', 'icon' => 'home', 'group' => 'main'],
            ['href' => '/cashier', 'label' => 'Kasir', 'feature' => 'cashier', 'icon' => 'calculator', 'group' => 'operasional'],
            ['href' => '/shifts', 'label' => 'Shift', 'feature' => 'cashier', 'icon' => 'clock', 'group' => 'operasional'],
            ['href' => '/receipts', 'label' => 'Struk', 'feature' => 'receipts', 'icon' => 'receipt', 'group' => 'operasional'],
            ['href' => '/products', 'label' => 'Produk', 'feature' => 'products', 'icon' => 'cube', 'group' => 'inventaris'],
            ['href' => '/stock', 'label' => 'Stok', 'feature' => 'stock', 'icon' => 'archive', 'group' => 'inventaris'],
            ['href' => '/waste', 'label' => 'Waste', 'feature' => 'waste', 'icon' => 'trash', 'group' => 'inventaris'],
            ['href' => '/suppliers', 'label' => 'Supplier', 'feature' => 'suppliers', 'icon' => 'truck', 'group' => 'inventaris'],
            ['href' => '/expenses', 'label' => 'Pengeluaran', 'feature' => 'expenses', 'icon' => 'banknotes', 'group' => 'keuangan'],
            ['href' => '/reports', 'label' => 'Laporan', 'feature' => 'reports', 'icon' => 'chart', 'group' => 'keuangan'],
            ['href' => '/owner', 'label' => 'Owner', 'feature' => 'owner', 'icon' => 'building', 'group' => 'keuangan'],
            ['href' => '/outlets', 'label' => 'Outlet', 'feature' => 'outlets', 'icon' => 'map', 'group' => 'pengaturan'],
            ['href' => '/users', 'label' => 'Pengguna', 'feature' => 'users', 'icon' => 'users', 'group' => 'pengaturan'],
        ];
    }

    /** @return list<array{href: string, label: string, feature: string}> */
    public static function allowedNavFor(User $user): array
    {
        return array_values(array_filter(
            self::navItems(),
            fn ($item) => self::canSee($user, $item['feature'])
        ));
    }
}
