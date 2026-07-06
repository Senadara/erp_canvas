import ErpLayout from '@/Layouts/ErpLayout';
import { Head, Link } from '@inertiajs/react';
import {
    ArchiveBoxIcon,
    ArrowTrendingUpIcon,
    BanknotesIcon,
    BuildingOfficeIcon,
    CalculatorIcon,
    ChartBarIcon,
    ClockIcon,
    CubeIcon,
    ExclamationTriangleIcon,
    MapPinIcon,
    ReceiptPercentIcon,
    TrashIcon,
    UsersIcon,
} from '@heroicons/react/24/outline';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function formatRupiah(value) {
    const n = Number(value) || 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function formatNumber(value) {
    return new Intl.NumberFormat('id-ID').format(Number(value) || 0);
}

const iconMap = {
    cashier: CalculatorIcon,
    chart: ChartBarIcon,
    finance: BanknotesIcon,
    map: MapPinIcon,
    outlet: BuildingOfficeIcon,
    product: CubeIcon,
    receipt: ReceiptPercentIcon,
    sales: BanknotesIcon,
    shift: ClockIcon,
    stock: ArchiveBoxIcon,
    users: UsersIcon,
    waste: TrashIcon,
};

const toneMap = {
    amber: {
        icon: 'bg-amber-50 text-amber-700',
        border: 'border-amber-200',
        text: 'text-amber-700',
        action: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
        stroke: '#d97706',
    },
    emerald: {
        icon: 'bg-emerald-50 text-emerald-700',
        border: 'border-emerald-200',
        text: 'text-emerald-700',
        action: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
        stroke: '#059669',
    },
    indigo: {
        icon: 'bg-indigo-50 text-indigo-700',
        border: 'border-indigo-200',
        text: 'text-indigo-700',
        action: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
        stroke: '#4f46e5',
    },
    rose: {
        icon: 'bg-rose-50 text-rose-700',
        border: 'border-rose-200',
        text: 'text-rose-700',
        action: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
        stroke: '#e11d48',
    },
    sky: {
        icon: 'bg-sky-50 text-sky-700',
        border: 'border-sky-200',
        text: 'text-sky-700',
        action: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100',
        stroke: '#0284c7',
    },
    slate: {
        icon: 'bg-slate-100 text-slate-700',
        border: 'border-slate-200',
        text: 'text-slate-700',
        action: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
        stroke: '#475569',
    },
    violet: {
        icon: 'bg-violet-50 text-violet-700',
        border: 'border-violet-200',
        text: 'text-violet-700',
        action: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100',
        stroke: '#7c3aed',
    },
};

function cardValue(card) {
    if (card.format === 'currency') return formatRupiah(card.value);
    if (card.format === 'number') return formatNumber(card.value);
    return card.value ?? '-';
}

function legacyDashboard(stats = {}, chartData = []) {
    return {
        title: 'Dashboard',
        subtitle: 'Ringkasan outlet aktif.',
        role: 'STAFF',
        cards: [
            { key: 'products', label: 'Produk Aktif', value: stats.productCount, format: 'number', icon: 'product', tone: 'indigo', meta: 'Menu aktif' },
            { key: 'sales', label: 'Penjualan Hari Ini', value: stats.todaySales, format: 'currency', icon: 'sales', tone: 'emerald', meta: 'Hari ini' },
            { key: 'shift', label: 'Status Shift', value: stats.openShift ? 'Terbuka' : 'Tutup', format: 'text', icon: 'shift', tone: stats.openShift ? 'emerald' : 'amber', meta: 'Outlet aktif' },
        ],
        chart: { title: 'Tren Penjualan', subtitle: '7 hari terakhir', data: chartData },
        quickActions: [],
        alerts: [],
    };
}

function StatCard({ card }) {
    const tone = toneMap[card.tone] || toneMap.slate;
    const Icon = iconMap[card.icon] || CubeIcon;

    return (
        <div className={`rounded-lg border ${tone.border} bg-white p-5 shadow-sm`}>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-500">{card.label}</p>
                    <p className={`mt-2 break-words text-2xl font-semibold ${tone.text}`}>{cardValue(card)}</p>
                    {card.meta && <p className="mt-2 text-xs font-medium text-slate-500">{card.meta}</p>}
                </div>
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tone.icon}`}>
                    <Icon className="h-6 w-6" />
                </div>
            </div>
        </div>
    );
}

function DashboardChart({ chart }) {
    const data = chart?.data || [];
    const stroke = toneMap.indigo.stroke;

    return (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-base font-semibold text-slate-900">{chart?.title || 'Tren Penjualan'}</h2>
                    <p className="mt-1 text-sm text-slate-500">{chart?.subtitle || '7 hari terakhir'}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                    <ArrowTrendingUpIcon className="h-5 w-5" />
                </div>
            </div>

            <div className="h-72 w-full">
                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                            <defs>
                                <linearGradient id="dashboardRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={stroke} stopOpacity={0.24} />
                                    <stop offset="95%" stopColor={stroke} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: '#64748b' }}
                                tickFormatter={(val) => `Rp${val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 10px 20px rgb(15 23 42 / 0.08)' }}
                                formatter={(value) => [formatRupiah(value), 'Pendapatan']}
                                labelStyle={{ color: '#475569', marginBottom: 4 }}
                            />
                            <Area
                                type="monotone"
                                dataKey="revenue"
                                stroke={stroke}
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#dashboardRevenue)"
                                activeDot={{ r: 5, strokeWidth: 0, fill: stroke }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm font-medium text-slate-400">
                        Belum ada data penjualan.
                    </div>
                )}
            </div>
        </section>
    );
}

function QuickActions({ actions }) {
    return (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Menu Cepat</h2>
            <div className="mt-4 grid gap-3">
                {actions.length > 0 ? actions.map((action) => {
                    const tone = toneMap[action.tone] || toneMap.slate;
                    const Icon = iconMap[action.icon] || CubeIcon;

                    return (
                        <Link
                            key={`${action.href}-${action.label}`}
                            href={action.href}
                            className={`flex min-h-[52px] items-center gap-3 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${tone.action}`}
                        >
                            <Icon className="h-5 w-5 shrink-0" />
                            <span className="min-w-0 flex-1 truncate">{action.label}</span>
                            <span className="text-base leading-none" aria-hidden="true">&rarr;</span>
                        </Link>
                    );
                }) : (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">Belum ada menu cepat untuk role ini.</p>
                )}
            </div>
        </section>
    );
}

function Alerts({ alerts }) {
    const severityClass = {
        danger: 'border-rose-200 bg-rose-50 text-rose-800',
        warning: 'border-amber-200 bg-amber-50 text-amber-800',
        info: 'border-sky-200 bg-sky-50 text-sky-800',
    };

    return (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
            <div className="mb-4 flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-slate-500" />
                <h2 className="text-base font-semibold text-slate-900">Perhatian</h2>
            </div>
            {alerts.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {alerts.map((alert, index) => {
                        const content = (
                            <div className={`rounded-lg border px-4 py-3 ${severityClass[alert.severity] || severityClass.info}`}>
                                <p className="text-sm font-semibold">{alert.label}</p>
                                <p className="mt-1 text-sm opacity-80">{alert.value}</p>
                            </div>
                        );

                        return alert.href ? (
                            <Link key={`${alert.label}-${index}`} href={alert.href}>{content}</Link>
                        ) : (
                            <div key={`${alert.label}-${index}`}>{content}</div>
                        );
                    })}
                </div>
            ) : (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                    Semua indikator utama dalam kondisi normal.
                </p>
            )}
        </section>
    );
}

export default function Dashboard({ stats, chartData, dashboard }) {
    const data = dashboard || legacyDashboard(stats, chartData);

    return (
        <ErpLayout title={data.title || 'Dashboard'}>
            <Head title={data.title || 'Dashboard'} />

            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">{data.role}</p>
                    <h1 className="mt-1 text-2xl font-semibold text-slate-950">{data.title}</h1>
                    {data.subtitle && <p className="mt-1 text-sm text-slate-500">{data.subtitle}</p>}
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {(data.cards || []).map((card) => (
                    <StatCard key={card.key} card={card} />
                ))}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <DashboardChart chart={data.chart} />
                <QuickActions actions={data.quickActions || []} />
                <Alerts alerts={data.alerts || []} />
            </div>
        </ErpLayout>
    );
}
