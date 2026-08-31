<?php

namespace App\Http\Controllers;

use App\Models\Outlet;
use App\Models\Product;
use App\Models\ShiftRecord;
use App\Models\StockItem;
use App\Models\Transaction;
use App\Models\User;
use App\Services\ReportService;
use App\Support\NavPermission;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __construct(private ReportService $reportService) {}

    public function __invoke(Request $request): Response
    {
        $outletId = $request->session()->get('outlet_id');
        $user = $request->user();
        $selectedDate = $this->selectedDashboardDate($request);

        $mitraProductIds = null;
        $mitraStockIds = null;
        if ($user && $user->isMitra()) {
            $mitraProductIds = $user->getMitraProductIds();
            $mitraStockIds = $user->getMitraStockIds();
        }

        $stats = [
            'productCount' => 0,
            'todaySales' => '0',
            'openShift' => false,
        ];

        $dailySummary = [
            'transactionCount' => 0,
            'totalSales' => 0,
            'cashSales' => 0,
            'qrisSales' => 0,
            'expenses' => 0,
        ];
        $productCount = 0;
        $stockCount = 0;
        $lowStockCount = 0;
        $openShift = null;
        $openShiftSummary = ['transactionCount' => 0, 'totalSales' => 0];
        $unpaidSummary = ['transactionCount' => 0, 'totalSales' => 0];
        $dailyProductSales = [];
        $chartData = [];

        if ($outletId) {
            $productQuery = Product::where('outlet_id', $outletId)->where('is_active', true);
            if ($mitraProductIds !== null) {
                $productQuery->whereIn('id', $mitraProductIds);
            }
            $productCount = $productQuery->count();

            $stockQuery = StockItem::where('outlet_id', $outletId);
            if ($mitraStockIds !== null) {
                $stockQuery->whereIn('id', $mitraStockIds);
            }
            $stockCount = $stockQuery->count();

            $lowStockCount = $this->reportService->getLowStockCount($outletId, $mitraStockIds);

            $openShift = ShiftRecord::query()
                ->where('outlet_id', $outletId)
                ->where('status', 'OPEN')
                ->first();

            $dailySummary = $this->reportService->getDailySummary($outletId, $selectedDate, $mitraProductIds);
            $dailyProductSales = $this->reportService->getDailyProductSales($outletId, $selectedDate, $mitraProductIds);

            if ($openShift) {
                $openShiftSummary = $this->summarizeTransactions(
                    Transaction::query()
                        ->where('shift_id', $openShift->id)
                        ->where('payment_status', 'PAID'),
                    $mitraProductIds
                );
            }

            $unpaidSummary = $this->summarizeTransactions(
                Transaction::query()
                    ->where('outlet_id', $outletId)
                    ->where('payment_status', 'UNPAID'),
                $mitraProductIds
            );

            $chartData = collect($this->reportService->getLast7DaysRevenue($outletId, $mitraProductIds))
                ->map(fn (array $row) => [
                    'name' => Carbon::parse($row['date'])->format('D'),
                    'date' => $row['date'],
                    'revenue' => (float) $row['total'],
                ])
                ->all();

            $stats['productCount'] = $productCount;
            $stats['todaySales'] = (string) $dailySummary['totalSales'];
            $stats['openShift'] = (bool) $openShift;
        }

        $context = [
            'outletId' => $outletId,
            'dailySummary' => $dailySummary,
            'productCount' => $productCount,
            'stockCount' => $stockCount,
            'lowStockCount' => $lowStockCount,
            'openShift' => (bool) $openShift,
            'openShiftSummary' => $openShiftSummary,
            'unpaidSummary' => $unpaidSummary,
            'dailyView' => $this->dailyView($selectedDate, $dailySummary, $dailyProductSales),
            'outletCount' => $user?->isOwner() ? Outlet::count() : ($user?->outlets()->count() ?? 0),
            'ownerOutletAlerts' => $user?->isOwner() ? $this->ownerOutletAlerts() : [],
        ];

        return Inertia::render('Dashboard', [
            'stats' => $stats,
            'chartData' => $chartData,
            'dashboard' => $this->dashboardPayload($user, $context, $chartData),
        ]);
    }

    private function summarizeTransactions($query, ?array $productIds = null): array
    {
        if ($productIds !== null) {
            $query->whereHas('items', function ($q) use ($productIds) {
                $q->whereIn('product_id', $productIds);
            });
        }

        $transactions = $query->with('items')->get();
        $total = 0;

        foreach ($transactions as $transaction) {
            foreach ($transaction->items as $item) {
                if ($productIds === null || in_array($item->product_id, $productIds, true)) {
                    $total += (float) $item->subtotal;
                }
            }
        }

        return [
            'transactionCount' => $transactions->count(),
            'totalSales' => $total,
        ];
    }

    private function dashboardPayload(?User $user, array $context, array $chartData): array
    {
        $role = $user?->role ?? 'STAFF';

        $payload = match ($role) {
            'OWNER' => $this->ownerDashboard($user, $context, $chartData),
            'MITRA' => $this->mitraDashboard($user, $context, $chartData),
            'PARTNER' => $this->partnerDashboard($user, $context, $chartData),
            default => $this->staffDashboard($user, $context, $chartData),
        };

        $dailyView = $context['dailyView'];
        $dailyView['show_expenses'] = (bool) $user?->isOwner();
        if ($user?->isPartner()) {
            $dailyView['summary']['transactionCount'] = 0;
            $dailyView['summary']['totalSales'] = 0;
            $dailyView['summary']['cashSales'] = 0;
            $dailyView['summary']['qrisSales'] = 0;
            $dailyView['summary']['soldProductCount'] = 0;
            $dailyView['summary']['soldQuantity'] = 0;
            $dailyView['soldProducts'] = [];
        }
        if (! $dailyView['show_expenses']) {
            $dailyView['summary']['expenses'] = 0;
        }

        return [
            ...$payload,
            'dailyView' => $dailyView,
        ];
    }

    private function ownerDashboard(?User $user, array $context, array $chartData): array
    {
        $dailyView = $context['dailyView'];
        $dailySummary = $dailyView['summary'];

        return [
            'role' => 'OWNER',
            'title' => 'Dashboard Owner',
            'subtitle' => 'Ringkasan harian outlet aktif dan kontrol operasional.',
            'cards' => [
                $this->card('daily_revenue', 'Pendapatan', $dailySummary['totalSales'], 'currency', 'sales', 'emerald', $dailySummary['transactionCount'].' transaksi - '.$dailyView['label']),
                $this->card('daily_expenses', 'Pengeluaran', $dailySummary['expenses'], 'currency', 'expense', $dailySummary['expenses'] > 0 ? 'rose' : 'slate', 'Operasional - '.$dailyView['label']),
                $this->card('daily_products', 'Produk Terjual', $dailySummary['soldQuantity'], 'number', 'product', 'indigo', $dailySummary['soldProductCount'].' jenis produk'),
                $this->card('outlets', 'Total Outlet', $context['outletCount'], 'number', 'outlet', 'indigo', 'Jaringan aktif'),
                $this->card('low_stock', 'Stok Menipis', $context['lowStockCount'], 'number', 'stock', $context['lowStockCount'] > 0 ? 'rose' : 'slate', 'Outlet aktif'),
                $this->card('unpaid', 'Belum Lunas', $context['unpaidSummary']['totalSales'], 'currency', 'receipt', $context['unpaidSummary']['transactionCount'] > 0 ? 'amber' : 'slate', $context['unpaidSummary']['transactionCount'].' order'),
            ],
            'chart' => $this->chart('Tren Penjualan Outlet', '7 hari terakhir', $chartData),
            'quickActions' => $this->quickActions($user, [
                $this->action('Buka Kasir', '/cashier', 'cashier', 'cashier', 'emerald'),
                $this->action('Pantau Outlet', '/owner', 'owner', 'outlet', 'indigo'),
                $this->action('Laporan Reguler', '/reports', 'reports', 'chart', 'violet'),
                $this->action('Biaya Produk', '/product-costs', 'product_costs', 'chart', 'emerald'),
                $this->action('Keuangan', '/finance', 'finance', 'finance', 'amber'),
                $this->action('Kelola Outlet', '/outlets', 'outlets', 'map', 'sky'),
                $this->action('Pengguna', '/users', 'users', 'users', 'slate'),
            ]),
            'alerts' => array_slice($context['ownerOutletAlerts'], 0, 5),
        ];
    }

    private function staffDashboard(?User $user, array $context, array $chartData): array
    {
        return [
            'role' => 'STAFF',
            'title' => 'Dashboard Staff',
            'subtitle' => 'Fokus shift, kasir, stok harian, dan order berjalan.',
            'cards' => [
                $this->card('shift', 'Status Shift', $context['openShift'] ? 'Terbuka' : 'Tutup', 'text', 'shift', $context['openShift'] ? 'emerald' : 'amber', $context['openShiftSummary']['transactionCount'].' transaksi shift'),
                $this->card('shift_sales', 'Penjualan Shift', $context['openShiftSummary']['totalSales'], 'currency', 'sales', 'indigo', 'Shift aktif'),
                $this->card('unpaid', 'Order Belum Lunas', $context['unpaidSummary']['transactionCount'], 'number', 'receipt', $context['unpaidSummary']['transactionCount'] > 0 ? 'amber' : 'slate', $this->rupiahText($context['unpaidSummary']['totalSales'])),
                $this->card('low_stock', 'Stok Menipis', $context['lowStockCount'], 'number', 'stock', $context['lowStockCount'] > 0 ? 'rose' : 'slate', $context['productCount'].' produk aktif'),
            ],
            'chart' => $this->chart('Tren Penjualan Harian', '7 hari terakhir', $chartData),
            'quickActions' => $this->quickActions($user, [
                $this->action('Kasir', '/cashier', 'cashier', 'cashier', 'emerald'),
                $this->action('Shift', '/shifts', 'cashier', 'shift', 'indigo'),
                $this->action('Struk', '/receipts', 'receipts', 'receipt', 'sky'),
                $this->action('Stok', '/stock', 'stock', 'stock', 'amber'),
                $this->action('Waste', '/waste', 'waste', 'waste', 'rose'),
                $this->action('Produk', '/products', 'products', 'product', 'slate'),
            ]),
            'alerts' => $this->staffAlerts($context),
        ];
    }

    private function mitraDashboard(?User $user, array $context, array $chartData): array
    {
        return [
            'role' => 'MITRA',
            'title' => 'Dashboard Mitra',
            'subtitle' => 'Ringkasan stok titipan, estimasi penjualan, dan laporan mitra.',
            'cards' => [
                $this->card('stock_scope', 'Stok Dalam Scope', $context['stockCount'], 'number', 'stock', 'indigo', 'Bahan yang dipantau'),
                $this->card('product_scope', 'Produk Terkait', $context['productCount'], 'number', 'product', 'slate', 'Menu yang memakai stok Anda'),
                $this->card('today_sales', 'Estimasi Penjualan', $context['dailySummary']['totalSales'], 'currency', 'sales', 'emerald', $context['dailyView']['label']),
                $this->card('low_stock', 'Stok Menipis', $context['lowStockCount'], 'number', 'stock', $context['lowStockCount'] > 0 ? 'rose' : 'slate', 'Perlu perhatian'),
            ],
            'chart' => $this->chart('Tren Estimasi Penjualan', '7 hari terakhir', $chartData),
            'quickActions' => $this->quickActions($user, [
                $this->action('Stok Saya', '/stock', 'stock', 'stock', 'indigo'),
                $this->action('Laporan Mitra', '/mitra-reports', 'mitra_reports', 'chart', 'emerald'),
                $this->action('Struk', '/receipts', 'receipts', 'receipt', 'sky'),
            ]),
            'alerts' => $this->mitraAlerts($context),
        ];
    }

    private function partnerDashboard(?User $user, array $context, array $chartData): array
    {
        return [
            'role' => 'PARTNER',
            'title' => 'Dashboard Partner',
            'subtitle' => 'Ringkasan modal, dividen, dan akses partner bisnis.',
            'cards' => [
                $this->card('outlets', 'Outlet Terkait', $context['outletCount'], 'number', 'outlet', 'indigo', 'Akses partner'),
                $this->card('owner_finance', 'Bagi Hasil Saya', 'Aktif', 'text', 'finance', 'emerald', 'Gaji, dividen, dan pinjaman modal'),
                $this->card('investments', 'Modal Partner', 'Terhubung', 'text', 'finance', 'indigo', 'Lot dan status modal'),
                $this->card('access', 'Akses Tambahan', 'Custom', 'text', 'users', 'slate', 'Diatur owner lewat override fitur'),
            ],
            'chart' => $this->chart('Tren Partner', 'Data operasional detail dibatasi untuk partner', []),
            'quickActions' => $this->quickActions($user, [
                $this->action('Bagi Hasil', '/owner-finance', 'owner_finance', 'finance', 'emerald'),
                $this->action('Modal Partner', '/investments', 'investments', 'finance', 'indigo'),
                $this->action('Kasir', '/cashier', 'cashier', 'cashier', 'emerald'),
            ]),
            'alerts' => [],
        ];
    }

    private function ownerOutletAlerts(): array
    {
        return Outlet::orderBy('name')->get(['id', 'name'])->map(function (Outlet $outlet) {
            $lowStock = $this->reportService->getLowStockCount($outlet->id);
            $unpaidCount = Transaction::where('outlet_id', $outlet->id)
                ->where('payment_status', 'UNPAID')
                ->count();

            if ($lowStock === 0 && $unpaidCount === 0) {
                return null;
            }

            $parts = [];
            if ($lowStock > 0) {
                $parts[] = $lowStock.' stok menipis';
            }
            if ($unpaidCount > 0) {
                $parts[] = $unpaidCount.' order belum lunas';
            }

            return [
                'label' => $outlet->name,
                'value' => implode(', ', $parts),
                'severity' => $lowStock > 0 ? 'danger' : 'warning',
                'href' => '/owner',
            ];
        })->filter()->values()->all();
    }

    private function staffAlerts(array $context): array
    {
        $alerts = [];

        if (! $context['openShift']) {
            $alerts[] = ['label' => 'Shift belum dibuka', 'value' => 'Buka shift sebelum transaksi', 'severity' => 'warning', 'href' => '/shifts'];
        }
        if ($context['lowStockCount'] > 0) {
            $alerts[] = ['label' => 'Stok menipis', 'value' => $context['lowStockCount'].' bahan perlu dicek', 'severity' => 'danger', 'href' => '/stock'];
        }
        if ($context['unpaidSummary']['transactionCount'] > 0) {
            $alerts[] = ['label' => 'Order belum lunas', 'value' => $context['unpaidSummary']['transactionCount'].' order', 'severity' => 'warning', 'href' => '/cashier'];
        }

        return $alerts;
    }

    private function mitraAlerts(array $context): array
    {
        $alerts = [];

        if ($context['stockCount'] === 0) {
            $alerts[] = ['label' => 'Scope stok kosong', 'value' => 'Hubungi owner untuk mengatur stok mitra', 'severity' => 'warning', 'href' => '/stock'];
        }
        if ($context['lowStockCount'] > 0) {
            $alerts[] = ['label' => 'Stok menipis', 'value' => $context['lowStockCount'].' bahan perlu restock', 'severity' => 'danger', 'href' => '/stock'];
        }

        return $alerts;
    }

    private function quickActions(?User $user, array $actions): array
    {
        if (! $user) {
            return [];
        }

        return collect($actions)
            ->filter(fn (array $action) => NavPermission::canSee($user, $action['feature']))
            ->values()
            ->all();
    }

    private function card(string $key, string $label, mixed $value, string $format, string $icon, string $tone, ?string $meta = null): array
    {
        return compact('key', 'label', 'value', 'format', 'icon', 'tone', 'meta');
    }

    private function action(string $label, string $href, string $feature, string $icon, string $tone): array
    {
        return compact('label', 'href', 'feature', 'icon', 'tone');
    }

    private function chart(string $title, string $subtitle, array $data): array
    {
        return compact('title', 'subtitle', 'data');
    }

    private function rupiahText(float|int|string $value): string
    {
        return 'Rp'.number_format((float) $value, 0, ',', '.');
    }

    private function selectedDashboardDate(Request $request): Carbon
    {
        $validated = $request->validate([
            'date' => 'nullable|date_format:Y-m-d',
        ]);

        return ! empty($validated['date'])
            ? Carbon::createFromFormat('Y-m-d', $validated['date'])->startOfDay()
            : Carbon::now()->startOfDay();
    }

    private function dailyView(Carbon $date, array $summary, array $soldProducts): array
    {
        $soldQuantity = collect($soldProducts)->sum('quantity_sold');
        $today = Carbon::now()->startOfDay();

        return [
            'date' => $date->toDateString(),
            'label' => $date->translatedFormat('d M Y'),
            'is_today' => $date->isSameDay($today),
            'today_date' => $today->toDateString(),
            'previous_date' => $date->copy()->subDay()->toDateString(),
            'next_date' => $date->copy()->addDay()->toDateString(),
            'summary' => [
                ...$summary,
                'soldProductCount' => count($soldProducts),
                'soldQuantity' => round((float) $soldQuantity, 2),
            ],
            'soldProducts' => $soldProducts,
        ];
    }
}
