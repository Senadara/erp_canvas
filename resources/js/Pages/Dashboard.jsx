import ErpLayout from '@/Layouts/ErpLayout';
import { Head } from '@inertiajs/react';
import {
    CubeIcon,
    CurrencyDollarIcon,
    ClockIcon,
    ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

export default function Dashboard({ stats, chartData }) {
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

            {/* Main Content Area */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Chart Section */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 animate-fade-in" style={{ animationDelay: '200ms' }}>
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="font-display text-lg font-semibold text-slate-800">Tren Penjualan</h2>
                            <p className="text-sm text-slate-500">7 Hari Terakhir</p>
                        </div>
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <ArrowTrendingUpIcon className="h-5 w-5 text-indigo-600" />
                        </div>
                    </div>
                    
                    <div className="h-72 w-full">
                        {chartData && chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fontSize: 12, fill: '#64748b' }}
                                        tickFormatter={(val) => `Rp${val >= 1000000 ? (val/1000000).toFixed(1) + 'M' : val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
                                    />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value) => [formatRupiah(value), 'Pendapatan']}
                                        labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="revenue" 
                                        stroke="#6366f1" 
                                        strokeWidth={3}
                                        fillOpacity={1} 
                                        fill="url(#colorRevenue)" 
                                        activeDot={{ r: 6, strokeWidth: 0, fill: '#4f46e5' }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">Belum ada data penjualan.</div>
                        )}
                    </div>
                </div>

                {/* Quick Actions Sidebar */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 animate-fade-in" style={{ animationDelay: '300ms' }}>
                    <h2 className="mb-4 font-display text-lg font-semibold text-slate-800">Aksi Cepat</h2>
                    <div className="flex flex-col gap-3">
                        {[
                            { label: 'Buka Kasir', href: '/cashier', color: 'from-brand-500 to-brand-700', icon: '💳' },
                            { label: 'Kelola Stok', href: '/stock', color: 'from-emerald-500 to-teal-600', icon: '📦' },
                            { label: 'Lihat Laporan', href: '/reports', color: 'from-violet-500 to-purple-600', icon: '📊' },
                            { label: 'Catat Pengeluaran', href: '/expenses', color: 'from-orange-400 to-rose-500', icon: '💰' },
                        ].map((action) => (
                            <a
                                key={action.label}
                                href={action.href}
                                className="group flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-3 shadow-sm transition-all duration-300 hover:bg-white hover:shadow-md hover:border-brand-200 hover:-translate-y-0.5"
                            >
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${action.color} text-base shadow-sm group-hover:scale-110 transition-transform`}>
                                    {action.icon}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-800 group-hover:text-brand-700 transition-colors">{action.label}</p>
                                </div>
                                <div className="ml-auto text-slate-400 group-hover:text-brand-500 group-hover:translate-x-1 transition-all">
                                    &rarr;
                                </div>
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </ErpLayout>
    );
}
