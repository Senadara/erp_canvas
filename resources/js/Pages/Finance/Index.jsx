import { useMemo, useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
    BanknotesIcon,
    CalendarDaysIcon,
    ClipboardDocumentListIcon,
    EyeIcon,
    FunnelIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';

function formatRupiah(value) {
    const n = Number(value) || 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function localDatetimeValue() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
}

function isCashierFundMovement(item) {
    return item.category === 'Tambah Kas' || item.category === 'Tambah Modal';
}

function isOutsideCashierTopup(item) {
    return isCashierFundMovement(item) && item.payment_method === 'PRIVATE';
}

function isIncomingMovement(item) {
    return item.cash_flow === 'IN';
}

function paymentLabel(method) {
    if (method === 'PRIVATE') return 'Uang Pribadi';
    return method || 'CASH';
}

function paymentTone(method) {
    if (method === 'QRIS') return 'bg-blue-100 text-blue-800';
    if (method === 'PRIVATE') return 'bg-amber-100 text-amber-800';
    return 'bg-emerald-50 text-emerald-700';
}

function formatDateTime(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function formatPeriod(start, end) {
    if (!start || !end) return '-';
    return `${formatDateTime(start)} - ${formatDateTime(end)}`;
}

function signedTone(value, positiveTone = 'text-emerald-700') {
    return (Number(value) || 0) >= 0 ? positiveTone : 'text-rose-700';
}

function StatCard({ card }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">{card.label}</p>
            <p className={`mt-2 text-2xl font-bold ${card.tone}`}>{formatRupiah(card.value)}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{card.sub}</p>
        </div>
    );
}

function DetailRow({ label, value, tone = 'text-slate-900' }) {
    return (
        <div className="grid gap-1 border-b border-slate-100 py-2.5 text-sm last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <span className="min-w-0 text-slate-500">{label}</span>
            <span className={`min-w-0 break-words font-semibold sm:text-right ${tone}`}>{formatRupiah(value)}</span>
        </div>
    );
}

function CompactMetric({ label, value, sub, tone = 'text-slate-900' }) {
    return (
        <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="truncate text-xs font-semibold uppercase text-slate-500">{label}</p>
            <p className={`mt-2 break-words text-xl font-bold sm:text-2xl ${tone}`}>{formatRupiah(value)}</p>
            {sub && <p className="mt-1 text-xs leading-relaxed text-slate-500">{sub}</p>}
        </div>
    );
}

function DetailSection({ title, children }) {
    return (
        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
            <div className="mt-3">{children}</div>
        </section>
    );
}

export default function FinanceIndex({
    outlet,
    filters,
    summary,
    periodSummary,
    daily,
    cashMovements = [],
    withdrawalHistory = [],
}) {
    const [activeView, setActiveView] = useState('current');
    const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
    const [dateFrom, setDateFrom] = useState(filters.date_from);
    const [dateTo, setDateTo] = useState(filters.date_to);
    const { data, setData, post, processing, reset, errors } = useForm({
        amount: '',
        payment_method: 'CASH',
        description: '',
        date: localDatetimeValue(),
    });

    const period = periodSummary || summary;
    const recentMovements = cashMovements.slice(0, 12);
    const resetLabel = 'Berjalan sejak awal hari';
    const periodGenerated = (Number(period.omzet) || 0) - (Number(period.expenseTotal) || 0) - (Number(period.drawerCashierTopups ?? period.cashierTopups) || 0);
    const historyTotals = useMemo(() => withdrawalHistory.reduce((totals, item) => ({
        amount: totals.amount + (Number(item.amount) || 0),
        omzet: totals.omzet + (Number(item.omzet) || 0),
        expenses: totals.expenses + (Number(item.expense_total) || 0),
        profit: totals.profit + (Number(item.net_after_allocations) || 0),
    }), { amount: 0, omzet: 0, expenses: 0, profit: 0 }), [withdrawalHistory]);

    const applyFilter = (e) => {
        e.preventDefault();
        router.get(route('finance'), { date_from: dateFrom, date_to: dateTo }, { preserveScroll: true });
    };

    const submitWithdrawal = (e) => {
        e.preventDefault();
        post(route('finance.withdraw'), {
            preserveScroll: true,
            onSuccess: () => {
                reset('amount', 'description');
                setData('date', localDatetimeValue());
                setActiveView('current');
                router.reload({
                    preserveScroll: true,
                    only: ['summary', 'periodSummary', 'cashMovements', 'withdrawalHistory', 'daily'],
                });
            },
        });
    };

    const currentCards = [
        {
            label: 'Uang Laci',
            value: summary.cashDrawerNet,
            tone: signedTone(summary.cashDrawerNet, 'text-slate-900'),
            sub: `Tanpa modal aktual ${formatRupiah(summary.openingCash ?? summary.standardOpeningCash ?? 50000)} dan top up. Fisik laci ${formatRupiah(summary.cashDrawerActual)}.`,
        },
        {
            label: 'Keuangan Bersih',
            value: summary.cleanFinance,
            tone: signedTone(summary.cleanFinance),
            sub: 'Uang omzet yang tersisa di laci dan QRIS, tanpa uang kas/modal.',
        },
        {
            label: 'Rata-rata Penjualan Harian',
            value: summary.dailySalesAverage,
            tone: 'text-indigo-700',
            sub: `Omzet berjalan ${formatRupiah(summary.omzet)} dari ${summary.transactionCount || 0} transaksi lunas.`,
        },
        {
            label: 'Saldo QRIS Aktual',
            value: summary.qrisBalanceActual,
            tone: 'text-blue-700',
            sub: `QRIS masuk hari ini ${formatRupiah(summary.qrisSales)}. Pengeluaran/penarikan QRIS ${formatRupiah((Number(summary.qrisExpense) || 0) + (Number(summary.withdrawQris) || 0))}.`,
        },
        {
            label: 'Pengeluaran',
            value: summary.expenseTotal,
            tone: 'text-rose-700',
            sub: `${resetLabel}. Kasir ${formatRupiah(summary.cashExpense)} | luar kasir ${formatRupiah(summary.outsideExpense)}.`,
        },
        {
            label: 'Rata-rata Pengeluaran',
            value: summary.dailyExpenseAverage,
            tone: 'text-amber-700',
            sub: `Top up dari laci ${formatRupiah(summary.activeDrawerCashierTopups ?? summary.drawerCashierTopups)} | luar laci ${formatRupiah(summary.activeOutsideCashierTopups ?? summary.outsideCashierTopups)}.`,
        },
    ];

    const periodCards = [
        {
            label: 'Omzet Lunas Periode',
            value: period.omzet,
            tone: 'text-indigo-700',
            sub: 'Hanya transaksi PAID. Uang kas/modal dan top up kasir tidak masuk omzet.',
        },
        {
            label: 'Penghasilan Bersih Periode',
            value: periodGenerated,
            tone: signedTone(periodGenerated),
            sub: 'Omzet lunas dikurangi pengeluaran dan top up dari laci, sebelum penarikan owner.',
        },
        {
            label: 'Total QRIS Masuk',
            value: period.qrisSales,
            tone: 'text-blue-700',
            sub: `Cash ${formatRupiah(period.cashSales)} | QRIS ${formatRupiah(period.qrisSales)}.`,
        },
        {
            label: 'Total Pengeluaran',
            value: period.expenseTotal,
            tone: 'text-rose-700',
            sub: `Kasir ${formatRupiah(period.cashExpense)} | QRIS ${formatRupiah(period.qrisExpense)} | luar kasir ${formatRupiah(period.outsideExpense)}.`,
        },
        {
            label: 'Penarikan Owner',
            value: period.withdrawTotal,
            tone: 'text-slate-800',
            sub: 'Mengurangi saldo aktual, bukan menghapus histori omzet.',
        },
        {
            label: 'Rata-rata Omzet Harian',
            value: period.dailySalesAverage,
            tone: 'text-emerald-700',
            sub: `${period.periodDays || 1} hari dalam filter tanggal.`,
        },
    ];

    const historyCards = [
        { label: 'Total Ditarik', value: historyTotals.amount, tone: 'text-slate-800', sub: `${withdrawalHistory.length} penarikan tercatat` },
        { label: 'Omzet Direkap', value: historyTotals.omzet, tone: 'text-indigo-700', sub: 'Omzet pada periode yang ditutup' },
        { label: 'Pengeluaran Direkap', value: historyTotals.expenses, tone: 'text-rose-700', sub: 'Biaya operasional sebelum penarikan' },
        { label: 'Keuntungan Direkap', value: historyTotals.profit, tone: signedTone(historyTotals.profit), sub: 'Setelah HPP, pengeluaran, dan top up dari laci' },
    ];

    return (
        <ErpLayout title="Keuangan">
            <Head title="Keuangan" />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900">Keuangan Outlet</h1>
                        <p className="mt-1 text-sm text-slate-500">{outlet?.name || 'Outlet'} - uang aktual di laci, QRIS, pengeluaran, dan rekap penarikan owner.</p>
                    </div>
                    <form onSubmit={applyFilter} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-500">Dari</label>
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full rounded-md border-slate-300 text-sm" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-500">Sampai</label>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full rounded-md border-slate-300 text-sm" />
                        </div>
                        <button type="submit" className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                            <FunnelIcon className="h-4 w-4" />
                            Terapkan
                        </button>
                    </form>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <div className="flex gap-3">
                        <BanknotesIcon className="mt-0.5 h-5 w-5 shrink-0" />
                        <div>
                            <p className="font-semibold">Omzet lunas hanya berasal dari transaksi PAID.</p>
                            <p className="mt-1 text-amber-800">Modal kas aktual shift {formatRupiah(summary.openingCash ?? summary.standardOpeningCash ?? 50000)} tidak dihitung sebagai omzet. Nilai default saat membuka shift adalah {formatRupiah(summary.defaultOpeningCash || 50000)} dan tetap dapat disesuaikan.</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {[
                        { key: 'current', label: 'Kasir Saat Ini' },
                        { key: 'period', label: 'Penghasilan Periode' },
                        { key: 'withdrawals', label: 'Histori Penarikan' },
                    ].map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setActiveView(item.key)}
                            className={`inline-flex min-h-[40px] items-center justify-center rounded-md border px-4 py-2 text-sm font-semibold ${activeView === item.key ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                {activeView === 'current' && (
                    <>
                        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                            <span>Periode aktual: {formatPeriod(summary.periodStart, summary.periodEnd)}</span>
                            <span className="font-semibold text-slate-900">{resetLabel}</span>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {currentCards.map((card) => <StatCard key={card.label} card={card} />)}
                        </div>

                        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
                            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="mb-4 flex items-start justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">Mutasi Keuangan Terbaru</h2>
                                        <p className="text-sm text-slate-500">Penarikan, pengeluaran, top up kasir, restock kasir, dan restock uang pribadi.</p>
                                    </div>
                                    <ClipboardDocumentListIcon className="h-5 w-5 text-slate-400" />
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <tbody className="divide-y divide-slate-100">
                                            {recentMovements.length === 0 ? (
                                                <tr><td className="py-6 text-center text-slate-500">Belum ada mutasi kas pada periode ini.</td></tr>
                                            ) : recentMovements.map(item => {
                                                const incoming = isIncomingMovement(item);
                                                const cashierFund = isCashierFundMovement(item);
                                                const outsideTopup = isOutsideCashierTopup(item);
                                                const isWithdrawal = item.category === 'Penarikan';
                                                const tone = cashierFund ? (outsideTopup ? 'text-emerald-700' : 'text-amber-700') : incoming ? 'text-emerald-600' : 'text-rose-600';
                                                const sign = cashierFund ? (outsideTopup ? '+' : '-') : incoming ? '+' : '-';
                                                return (
                                                    <tr key={item.id}>
                                                        <td className="py-3 pr-3">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cashierFund ? 'bg-amber-100 text-amber-800' : isWithdrawal ? 'bg-slate-100 text-slate-700' : incoming ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                                                    {cashierFund ? (outsideTopup ? 'Top Up Luar Laci' : 'Top Up Dari Laci') : item.category}
                                                                </span>
                                                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${paymentTone(item.payment_method)}`}>
                                                                    {paymentLabel(item.payment_method)}
                                                                </span>
                                                            </div>
                                                            <div className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString('id-ID')} - {item.description || 'Tanpa catatan'}</div>
                                                        </td>
                                                        <td className={`py-3 text-right font-semibold ${tone}`}>
                                                            {sign} {formatRupiah(item.amount)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <form onSubmit={submitWithdrawal} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                <h2 className="text-lg font-semibold text-slate-900">Penarikan Owner</h2>
                                <p className="mt-1 text-sm text-slate-500">Menyimpan rekap, lalu ringkasan aktual dimulai ulang setelah nominal ini ditarik.</p>
                                <div className="mt-4 space-y-4">
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700">Nominal</label>
                                        <input type="number" min="1" value={data.amount} onChange={e => setData('amount', e.target.value)} className="w-full rounded-md border-slate-300 text-sm" required />
                                        {errors.amount && <p className="mt-1 text-xs text-rose-600">{errors.amount}</p>}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['CASH', 'QRIS'].map(method => (
                                            <button
                                                key={method}
                                                type="button"
                                                onClick={() => setData('payment_method', method)}
                                                className={`rounded-md border py-2 text-sm font-semibold ${data.payment_method === method ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-300 text-slate-600'}`}
                                            >
                                                {method}
                                            </button>
                                        ))}
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700">Tanggal</label>
                                        <input type="datetime-local" value={data.date} onChange={e => setData('date', e.target.value)} className="w-full rounded-md border-slate-300 text-sm" />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700">Catatan</label>
                                        <textarea value={data.description} onChange={e => setData('description', e.target.value)} rows="2" className="w-full rounded-md border-slate-300 text-sm" placeholder="Contoh: Setoran owner / tarik kas harian" />
                                    </div>
                                    <button type="submit" disabled={processing} className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                                        <BanknotesIcon className="h-4 w-4" />
                                        {processing ? 'Menyimpan...' : 'Catat Penarikan'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </>
                )}

                {activeView === 'period' && (
                    <div className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {periodCards.map((card) => <StatCard key={card.label} card={card} />)}
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">Tren Penghasilan Periode</h2>
                                    <p className="text-sm text-slate-500">Filter tanggal berlaku untuk tab ini dan histori penarikan.</p>
                                </div>
                                <CalendarDaysIcon className="h-5 w-5 text-slate-400" />
                            </div>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={daily} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                                        <YAxis tickFormatter={(v) => `Rp${v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                                        <Tooltip formatter={(value, name) => [formatRupiah(value), name]} />
                                        <Area type="monotone" dataKey="omzet" name="Omzet Lunas" stroke="#4f46e5" fill="#c7d2fe" strokeWidth={2} />
                                        <Area type="monotone" dataKey="expenses" name="Pengeluaran" stroke="#e11d48" fill="#fecdd3" strokeWidth={2} />
                                        <Area type="monotone" dataKey="cashier_topups" name="Top Up Kasir" stroke="#d97706" fill="#fde68a" strokeWidth={2} />
                                        <Area type="monotone" dataKey="profit" name="Penghasilan Setelah Pengeluaran" stroke="#059669" fill="#bbf7d0" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}

                {activeView === 'withdrawals' && (
                    <div className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            {historyCards.map((card) => <StatCard key={card.label} card={card} />)}
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">Histori Penarikan Owner</h2>
                                    <p className="text-sm text-slate-500">Setiap penarikan menyimpan rekap sebelum reset. Buka detail untuk melihat pemasukan, pengeluaran, top up, dan saldo.</p>
                                </div>
                                <ClipboardDocumentListIcon className="h-5 w-5 text-slate-400" />
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[980px] text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase text-slate-500">
                                            <th className="py-3 pr-4">Penarikan</th>
                                            <th className="py-3 pr-4">Periode Direkap</th>
                                            <th className="py-3 pr-4 text-right">Omzet</th>
                                            <th className="py-3 pr-4 text-right">Pengeluaran</th>
                                            <th className="py-3 pr-4 text-right">Keuntungan</th>
                                            <th className="py-3 pr-4 text-right">Sisa Setelah</th>
                                            <th className="py-3 text-right">Detail</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {withdrawalHistory.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="py-8 text-center text-slate-500">Belum ada histori penarikan pada periode filter ini.</td>
                                            </tr>
                                        ) : withdrawalHistory.map((item) => (
                                            <tr key={item.id} className="align-top">
                                                <td className="py-4 pr-4">
                                                    <div className="font-semibold text-slate-900">{formatRupiah(item.amount)}</div>
                                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${paymentTone(item.method)}`}>{paymentLabel(item.method)}</span>
                                                        {item.source === 'COMPUTED' && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Hitung ulang</span>}
                                                    </div>
                                                    <div className="mt-1 text-xs text-slate-500">{formatDateTime(item.date)}</div>
                                                </td>
                                                <td className="py-4 pr-4 text-xs text-slate-600">
                                                    {formatPeriod(item.period_start, item.period_end)}
                                                    <div className="mt-1 text-slate-500">{item.transaction_count || 0} transaksi</div>
                                                    <div className="mt-1 text-slate-500">Cash {formatRupiah(item.cash_sales)} | QRIS {formatRupiah(item.qris_sales)}</div>
                                                </td>
                                                <td className="py-4 pr-4 text-right font-semibold text-indigo-700">{formatRupiah(item.omzet)}</td>
                                                <td className="py-4 pr-4 text-right">
                                                    <div className="font-semibold text-rose-700">{formatRupiah(item.expense_total)}</div>
                                                    <div className="text-xs text-slate-500">Top up laci {formatRupiah(item.drawer_cashier_topups ?? item.cashier_topups)} | luar {formatRupiah(item.outside_cashier_topups)}</div>
                                                </td>
                                                <td className={`py-4 pr-4 text-right font-semibold ${signedTone(item.net_after_allocations)}`}>
                                                    {formatRupiah(item.net_after_allocations)}
                                                    <div className="text-xs font-normal text-slate-500">HPP {formatRupiah(item.hpp)}</div>
                                                </td>
                                                <td className={`py-4 pr-4 text-right font-semibold ${signedTone(item.remaining_after, 'text-slate-800')}`}>
                                                    {formatRupiah(item.remaining_after)}
                                                </td>
                                                <td className="py-4 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedWithdrawal(item)}
                                                        className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                                    >
                                                        <EyeIcon className="h-4 w-4" />
                                                        Detail
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {selectedWithdrawal && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/55 p-2 sm:p-4">
                    <div className="mx-auto flex min-h-full w-full max-w-5xl items-start justify-center py-2 sm:items-center sm:py-6">
                        <div className="flex max-h-none w-full flex-col overflow-hidden rounded-lg bg-slate-50 shadow-2xl sm:max-h-[92vh]">
                            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="text-lg font-semibold text-slate-900">Detail Rekap Penarikan</h2>
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${paymentTone(selectedWithdrawal.method)}`}>{paymentLabel(selectedWithdrawal.method)}</span>
                                        </div>
                                        <p className="mt-1 text-sm text-slate-500">{formatPeriod(selectedWithdrawal.period_start, selectedWithdrawal.period_end)}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedWithdrawal(null)}
                                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
                                        aria-label="Tutup detail"
                                    >
                                        <XMarkIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-y-auto p-4 sm:p-5">
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    <CompactMetric label="Nominal Ditarik" value={selectedWithdrawal.amount} tone="text-slate-900" sub={formatDateTime(selectedWithdrawal.date)} />
                                    <CompactMetric label="Saldo Sebelum" value={selectedWithdrawal.available_before} tone="text-indigo-700" sub="Tanpa modal kas dan top up." />
                                    <CompactMetric label="Sisa Setelah" value={selectedWithdrawal.remaining_after} tone={signedTone(selectedWithdrawal.remaining_after)} sub="Saldo aktual setelah ditarik." />
                                    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                        <p className="truncate text-xs font-semibold uppercase text-slate-500">Transaksi</p>
                                        <p className="mt-2 break-words text-xl font-bold text-emerald-700 sm:text-2xl">{selectedWithdrawal.transaction_count || 0}</p>
                                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{selectedWithdrawal.description || 'Tanpa catatan tambahan.'}</p>
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                    <DetailSection title="Pemasukan">
                                        <DetailRow label="Omzet lunas" value={selectedWithdrawal.omzet} tone="text-indigo-700" />
                                        <DetailRow label="Penjualan cash" value={selectedWithdrawal.cash_sales} />
                                        <DetailRow label="Penjualan QRIS" value={selectedWithdrawal.qris_sales} />
                                    </DetailSection>

                                    <DetailSection title="Pengeluaran & Modal">
                                        <DetailRow label="Total pengeluaran" value={selectedWithdrawal.expense_total} tone="text-rose-700" />
                                        <DetailRow label="Pengeluaran cash" value={selectedWithdrawal.cash_expense} />
                                        <DetailRow label="Pengeluaran QRIS" value={selectedWithdrawal.qris_expense} />
                                        <DetailRow label="Pengeluaran uang pribadi" value={selectedWithdrawal.outside_expense} />
                                        <DetailRow label="Top up dari laci" value={selectedWithdrawal.drawer_cashier_topups ?? selectedWithdrawal.cashier_topups} tone="text-amber-700" />
                                        <DetailRow label="Top up luar laci" value={selectedWithdrawal.outside_cashier_topups} tone="text-emerald-700" />
                                    </DetailSection>

                                    <DetailSection title="Keuntungan Rekap">
                                        <DetailRow label="HPP" value={selectedWithdrawal.hpp} />
                                        <DetailRow label="Laba kotor" value={selectedWithdrawal.gross_profit} tone={signedTone(selectedWithdrawal.gross_profit)} />
                                        <DetailRow label="Laba operasional" value={selectedWithdrawal.net_profit} tone={signedTone(selectedWithdrawal.net_profit)} />
                                        <DetailRow label="Setelah top up dari laci" value={selectedWithdrawal.net_after_allocations} tone={signedTone(selectedWithdrawal.net_after_allocations)} />
                                    </DetailSection>

                                    <DetailSection title="Saldo Aktual">
                                        <DetailRow label="Laci sebelum tarik" value={selectedWithdrawal.cash_balance_before} />
                                        <DetailRow label="QRIS sebelum tarik" value={selectedWithdrawal.qris_balance_before} />
                                        <DetailRow label="Saldo bisa direkap" value={selectedWithdrawal.available_before} tone="text-indigo-700" />
                                        <DetailRow label="Penarikan owner" value={selectedWithdrawal.amount} tone="text-rose-700" />
                                        <DetailRow label="Sisa setelah tarik" value={selectedWithdrawal.remaining_after} tone={signedTone(selectedWithdrawal.remaining_after)} />
                                    </DetailSection>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </ErpLayout>
    );
}
