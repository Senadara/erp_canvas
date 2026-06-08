import { Link, router, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import {
    HomeIcon,
    CalculatorIcon,
    ClockIcon,
    ReceiptPercentIcon,
    CubeIcon,
    ArchiveBoxIcon,
    TrashIcon,
    TruckIcon,
    BanknotesIcon,
    ChartBarIcon,
    BuildingOfficeIcon,
    MapPinIcon,
    UsersIcon,
    Bars3Icon,
    XMarkIcon,
    ChevronDownIcon,
    ArrowRightStartOnRectangleIcon,
    UserCircleIcon,
    ChevronLeftIcon,
    DevicePhoneMobileIcon,
} from '@heroicons/react/24/outline';
import { usePWAInstall } from '@/pwa/usePWAInstall';

const iconMap = {
    home: HomeIcon,
    calculator: CalculatorIcon,
    clock: ClockIcon,
    receipt: ReceiptPercentIcon,
    cube: CubeIcon,
    archive: ArchiveBoxIcon,
    trash: TrashIcon,
    truck: TruckIcon,
    banknotes: BanknotesIcon,
    chart: ChartBarIcon,
    building: BuildingOfficeIcon,
    map: MapPinIcon,
    users: UsersIcon,
};

const groupLabels = {
    main: null,
    operasional: 'Operasional',
    inventaris: 'Inventaris',
    keuangan: 'Keuangan',
    pengaturan: 'Pengaturan',
};

function groupNavItems(items) {
    const groups = {};
    const order = ['main', 'operasional', 'inventaris', 'keuangan', 'pengaturan'];
    for (const key of order) groups[key] = [];
    for (const item of items) {
        const g = item.group || 'main';
        if (!groups[g]) groups[g] = [];
        groups[g].push(item);
    }
    return order.filter(k => groups[k]?.length > 0).map(k => ({ key: k, label: groupLabels[k], items: groups[k] }));
}

function NavItem({ item, collapsed }) {
    const Icon = iconMap[item.icon] || CubeIcon;
    const isActive = window.location.pathname === item.href;

    return (
        <Link
            href={item.href}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200
                ${isActive
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25'
                    : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'
                }
                ${collapsed ? 'justify-center' : ''}
            `}
            title={collapsed ? item.label : undefined}
        >
            <Icon className={`h-5 w-5 shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-brand-500'}`} />
            {!collapsed && <span className="truncate">{item.label}</span>}
            {collapsed && (
                <div className="pointer-events-none absolute left-full ml-2 rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                    {item.label}
                </div>
            )}
        </Link>
    );
}

export default function ErpLayout({ title, children }) {
    const { auth, nav, outlet, flash } = usePage().props;
    const user = auth.user;
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const { isInstallable, install } = usePWAInstall();

    // Add meta tags for offline sync
    useEffect(() => {
        if (outlet.currentId) {
            let meta = document.querySelector('meta[name="outlet-id"]');
            if (!meta) {
                meta = document.createElement('meta');
                meta.name = 'outlet-id';
                document.head.appendChild(meta);
            }
            meta.content = outlet.currentId;
        }
    }, [outlet.currentId]);

    const changeOutlet = (e) => {
        router.post(route('outlet.set'), { outlet_id: e.target.value }, { preserveScroll: true });
    };

    const grouped = groupNavItems(nav);

    // Session Guard: Auto-logout at 04:00 AM
    useEffect(() => {
        const checkTime = () => {
            const now = new Date();
            // Use local time for 04:00 AM check
            if (now.getHours() === 4 && now.getMinutes() === 0 && now.getSeconds() < 30) {
                // To avoid multiple triggers, we check if within the first 30 seconds of 04:00
                router.post(route('logout'));
            }
        };

        const interval = setInterval(checkTime, 10000); // Check every 10 seconds
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex h-screen overflow-hidden bg-[#f4f6fc]">
            {/* ── Mobile Overlay ────────────────────────────────── */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            {/* ── Sidebar ───────────────────────────────────────── */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200/80 bg-white transition-all duration-300
                lg:relative lg:translate-x-0
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                ${collapsed ? 'w-[72px]' : 'w-64'}
            `}>
                {/* Brand */}
                <div className={`flex h-16 shrink-0 items-center border-b border-slate-100 px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
                    {!collapsed && (
                        <Link href={route('dashboard')} className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 shadow-md shadow-brand-500/20">
                                <span className="text-sm font-bold text-white">K</span>
                            </div>
                            <span className="font-display text-lg font-bold tracking-tight text-slate-900">Karsa ERP</span>
                        </Link>
                    )}
                    {collapsed && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 shadow-md shadow-brand-500/20">
                            <span className="text-sm font-bold text-white">K</span>
                        </div>
                    )}
                    <button
                        onClick={() => setCollapsed(v => !v)}
                        className="hidden rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:block"
                    >
                        <ChevronLeftIcon className={`h-4 w-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
                    </button>
                    <button onClick={() => setSidebarOpen(false)} className="rounded-md p-1 text-slate-400 hover:text-slate-600 lg:hidden">
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto px-3 py-4">
                    <div className="space-y-6">
                        {grouped.map((group) => (
                            <div key={group.key}>
                                {group.label && !collapsed && (
                                    <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        {group.label}
                                    </p>
                                )}
                                {group.label && collapsed && (
                                    <div className="mx-auto mb-2 h-px w-8 bg-slate-200" />
                                )}
                                <div className="space-y-0.5">
                                    {group.items.map(item => (
                                        <NavItem key={item.href} item={item} collapsed={collapsed} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </nav>

                {/* Bottom User Card */}
                {!collapsed && (
                    <div className="shrink-0 border-t border-slate-100 p-3">
                        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white shadow-sm">
                                {(user.displayName || 'U')[0].toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-800">{user.displayName}</p>
                                <p className="truncate text-xs text-slate-500">{user.role || user.email}</p>
                            </div>
                        </div>
                    </div>
                )}
            </aside>

            {/* ── Main Content ──────────────────────────────────── */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Top Header */}
                <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-md sm:px-6">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
                        >
                            <Bars3Icon className="h-5 w-5" />
                        </button>
                        {title && (
                            <h1 className="font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                                {title}
                            </h1>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {/* PWA Install Button */}
                        {isInstallable && (
                            <button
                                onClick={install}
                                className="hidden sm:flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md"
                            >
                                <DevicePhoneMobileIcon className="h-4 w-4" />
                                <span>Install App</span>
                            </button>
                        )}

                        {/* Outlet Selector */}
                        {outlet.list?.length > 0 && (
                            <select
                                value={outlet.currentId ?? ''}
                                onChange={changeOutlet}
                                className="max-w-[10rem] rounded-lg border-slate-200 bg-slate-50 py-2 pl-3 pr-8 text-sm font-medium text-slate-700 transition-colors hover:border-brand-300 focus:border-brand-500 focus:ring-brand-500 sm:max-w-xs"
                                aria-label="Pilih outlet"
                            >
                                {outlet.list.map((o) => (
                                    <option key={o.id} value={o.id}>{o.name}</option>
                                ))}
                            </select>
                        )}

                        {/* Profile Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setProfileOpen(v => !v)}
                                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                            >
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-[10px] font-bold text-white">
                                    {(user.displayName || 'U')[0].toUpperCase()}
                                </div>
                                <span className="hidden sm:inline">{user.displayName}</span>
                                <ChevronDownIcon className="h-3.5 w-3.5 text-slate-400" />
                            </button>

                            {profileOpen && (
                                <>
                                    <div className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} />
                                    <div className="absolute right-0 z-40 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl animate-fade-in">
                                        <Link
                                            href={route('profile.edit')}
                                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                                            onClick={() => setProfileOpen(false)}
                                        >
                                            <UserCircleIcon className="h-4 w-4 text-slate-400" />
                                            Profil
                                        </Link>
                                        <Link
                                            href={route('logout')}
                                            method="post"
                                            as="button"
                                            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                                            onClick={() => setProfileOpen(false)}
                                        >
                                            <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
                                            Keluar
                                        </Link>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Flash Messages */}
                {flash?.success && (
                    <div className="px-4 pt-4 sm:px-6">
                        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-sm animate-slide-up">
                            <svg className="h-5 w-5 shrink-0 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {flash.success}
                        </div>
                    </div>
                )}

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6">
                    <div className="animate-fade-in">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
