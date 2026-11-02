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
        'product_costs' => false,
        'stock' => true,
        'stock_audit' => true,
        'expenses' => false,
        'waste' => true,
        'reports' => false,
        'finance' => false,
        'mitra_reports' => false,
        'settlements' => false,
        'payroll' => false,
        'receipts' => true,
        'owner' => false,
        'users' => false,
        'outlets' => false,
        'suppliers' => false,
        'investments' => false,
        'owner_finance' => false,
    ];

    /** @var array<string, bool> */
    private const MITRA_NAV = [
        'dashboard' => true,
        'cashier' => false,
        'products' => false,
        'product_costs' => false,
        'stock' => true,
        'stock_audit' => false,
        'expenses' => false,
        'waste' => false,
        'reports' => false,
        'finance' => false,
        'mitra_reports' => true,
        'settlements' => false,
        'payroll' => false,
        'receipts' => false,
        'owner' => false,
        'users' => false,
        'outlets' => false,
        'suppliers' => false,
        'investments' => false,
        'owner_finance' => false,
    ];

    /** @var array<string, bool> */
    private const PARTNER_NAV = [
        'dashboard' => true,
        'cashier' => false,
        'products' => false,
        'product_costs' => false,
        'stock' => false,
        'stock_audit' => false,
        'expenses' => false,
        'waste' => false,
        'reports' => false,
        'finance' => false,
        'mitra_reports' => false,
        'settlements' => false,
        'payroll' => false,
        'receipts' => false,
        'owner' => false,
        'users' => false,
        'outlets' => false,
        'suppliers' => false,
        'investments' => true,
        'owner_finance' => true,
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
            $base = self::MITRA_NAV[$feature] ?? false;

            // Receipts visibility depends on mitra_can_view_sales
            if ($feature === 'receipts') {
                $base = (bool) $user->mitra_can_view_sales;
            }

            // Support feature_overrides for mitra too
            $overrides = $user->feature_overrides ?? [];
            if (array_key_exists($feature, $overrides)) {
                return (bool) $overrides[$feature];
            }

            return $base;
        }
        if ($user->isPartner()) {
            $overrides = $user->feature_overrides ?? [];
            if (array_key_exists($feature, $overrides)) {
                return (bool) $overrides[$feature];
            }

            return self::PARTNER_NAV[$feature] ?? false;
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
            ['href' => '/product-costs', 'label' => 'Biaya Produk', 'feature' => 'product_costs', 'icon' => 'tag', 'group' => 'inventaris'],
            ['href' => '/stock', 'label' => 'Stok', 'feature' => 'stock', 'icon' => 'archive', 'group' => 'inventaris'],
            ['href' => '/stock-audit', 'label' => 'Audit Stok', 'feature' => 'stock_audit', 'icon' => 'clipboard_check', 'group' => 'inventaris'],
            ['href' => '/waste', 'label' => 'Waste', 'feature' => 'waste', 'icon' => 'trash', 'group' => 'inventaris'],
            ['href' => '/suppliers', 'label' => 'Supplier', 'feature' => 'suppliers', 'icon' => 'truck', 'group' => 'inventaris'],
            ['href' => '/expenses', 'label' => 'Pengeluaran', 'feature' => 'expenses', 'icon' => 'expense', 'group' => 'keuangan'],
            ['href' => '/finance', 'label' => 'Keuangan', 'feature' => 'finance', 'icon' => 'finance', 'group' => 'keuangan'],
            ['href' => '/reports', 'label' => 'Laporan Reguler', 'feature' => 'reports', 'icon' => 'reports', 'group' => 'laporan'],
            ['href' => '/mitra-reports', 'label' => 'Laporan Mitra', 'feature' => 'mitra_reports', 'icon' => 'mitra_reports', 'group' => 'mitra'],
            ['href' => '/settlements', 'label' => 'Setoran Mitra', 'feature' => 'settlements', 'icon' => 'settlements', 'group' => 'mitra'],
            ['href' => '/payroll', 'label' => 'Gaji Pegawai', 'feature' => 'payroll', 'icon' => 'payroll', 'group' => 'manajemen'],
            ['href' => '/investments', 'label' => 'Modal Partner', 'feature' => 'investments', 'icon' => 'investments', 'group' => 'manajemen'],
            ['href' => '/owner-finance', 'label' => 'Bagi Hasil', 'feature' => 'owner_finance', 'icon' => 'owner_finance', 'group' => 'manajemen'],
            ['href' => '/owner', 'label' => 'Owner', 'feature' => 'owner', 'icon' => 'owner', 'group' => 'manajemen'],
            ['href' => '/outlets', 'label' => 'Outlet', 'feature' => 'outlets', 'icon' => 'outlet', 'group' => 'pengaturan'],
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
