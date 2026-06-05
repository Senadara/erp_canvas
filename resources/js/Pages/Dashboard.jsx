import ErpLayout from '@/Layouts/ErpLayout';
import { Head } from '@inertiajs/react';
import {
    CubeIcon,
    CurrencyDollarIcon,
    ClockIcon,
    ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';

function formatRupiah(value) {
    const n = Number(value) || 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

const statCards = [
    {
        key: 'products',
        label: 'Produk Aktif',
        getValue: (s) => s.productCount,
        icon: CubeIcon,
        gradient: 'from-blue-500 to-indigo-600',
        shadow: 'shadow-blue-500/20',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
    },
    {
        key: 'sales',
        label: 'Penjualan Hari Ini',
        getValue: (s) => formatRupiah(s.todaySales),
        icon: CurrencyDollarIcon,
        gradient: 'from-emerald-500 to-teal-600',
        shadow: 'shadow-emerald-500/20',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
    },
    {
        key: 'shift',
        label: 'Status Shift',
        getValue: (s) => s.openShift ? 'Terbuka' : 'Tutup',
        icon: ClockIcon,
        gradient: (s) => s.openShift ? 'from-amber-400 to-orange-500' : 'from-slate-400 to-slate-500',
        shadow: (s) => s.openShift ? 'shadow-amber-500/20' : 'shadow-slate-400/10',
        bg: (s) => s.openShift ? 'bg-amber-50' : 'bg-slate-50',
        text: (s) => s.openShift ? 'text-amber-700' : 'text-slate-600',
        pulse: (s) => s.openShift,
    },
];

export default function Dashboard({ stats }) {
    return (
        <ErpLayout title="Dashboard">
            <Head title="Dashboard" />

            {/* Stat Cards */}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {statCards.map((card, i) => {
                    const gradient = typeof card.gradient === 'function' ? card.gradient(stats) : card.gradient;
                    const shadow = typeof card.shadow === 'function' ? card.shadow(stats) : card.shadow;
                    const bg = typeof card.bg === 'function' ? card.bg(stats) : card.bg;
                    const textColor = typeof card.text === 'function' ? card.text(stats) : card.text;
                    const shouldPulse = typeof card.pulse === 'function' ? card.pulse(stats) : false;

                    return (
                        <div
                            key={card.key}
                            className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg animate-slide-up"
                            style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
                        >
                            {/* Decorative gradient blob */}
                            <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-2xl transition-all duration-500 group-hover:opacity-20 group-hover:blur-xl`} />

                            <div className="relative flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">{card.label}</p>
                                    <p className={`mt-2 text-3xl font-bold tracking-tight ${textColor}`}>
                                        {card.getValue(stats)}
                                    </p>
                                </div>
                                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${bg} transition-transform duration-300 group-hover:scale-110`}>
                                    <card.icon className={`h-6 w-6 ${textColor}`} />
                                </div>
                            </div>

                            {/* Pulse indicator for active shift */}
                            {shouldPulse && (
                                <div className="mt-4 flex items-center gap-2">
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                                    </span>
                                    <span className="text-xs font-medium text-amber-600">Shift sedang berjalan</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Quick Actions */}
            <div className="mt-8">
                <h2 className="mb-4 font-display text-lg font-semibold text-slate-800">Aksi Cepat</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                        { label: 'Buka Kasir', href: '/cashier', color: 'from-brand-500 to-brand-700', icon: '💳' },
                        { label: 'Kelola Stok', href: '/stock', color: 'from-emerald-500 to-teal-600', icon: '📦' },
                        { label: 'Lihat Laporan', href: '/reports', color: 'from-violet-500 to-purple-600', icon: '📊' },
                        { label: 'Catat Pengeluaran', href: '/expenses', color: 'from-orange-400 to-rose-500', icon: '💰' },
                    ].map((action) => (
                        <a
                            key={action.label}
                            href={action.href}
                            className="group flex items-center gap-4 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
                        >
                            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${action.color} text-lg shadow-sm`}>
                                {action.icon}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800 group-hover:text-brand-700 transition-colors">{action.label}</p>
                                <p className="text-xs text-slate-400">Klik untuk membuka</p>
                            </div>
                        </a>
                    ))}
                </div>
            </div>
        </ErpLayout>
    );
}
