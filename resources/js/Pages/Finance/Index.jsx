import { useMemo, useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
    BanknotesIcon,
    CalendarDaysIcon,
    ClipboardDocumentListIcon,
    FunnelIcon,
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

function isIncomingMovement(item) {
    return item.cash_flow === 'IN' && !isCashierFundMovement(item);
}

export default function FinanceIndex({
    outlet,
    filters,
    summary,
    daily,
    cashMovements = [],
    currentShiftBalance,
}) {
    const [dateFrom, setDateFrom] = useState(filters.date_from);
    const [dateTo, setDateTo] = useState(filters.date_to);
    const { data, setData, post, processing, reset, errors } = useForm({
        amount: '',
        payment_method: 'CASH',
        description: '',
        date: localDatetimeValue(),
    });

    const netMargin = useMemo(() => {
        const omzet = Number(summary.omzet) || 0;
        if (omzet <= 0) return 0;
        return ((Number(summary.netProfit) || 0) / omzet) * 100;
    }, [summary]);

    const standardCashText = `${summary.shiftCount || 0} shift x ${formatRupiah(summary.standardOpeningCash || 50000)}`;
    const recentMovements = cashMovements.slice(0, 12);

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
            },
        });
    };

    const statCards = [
        {
            label: 'Omzet Lunas',
            value: summary.omzet,
            tone: 'text-indigo-700',
            sub: `${summary.transactionCount} transaksi lunas`,
        },
        {
            label: 'Laba Operasional',
            value: summary.netProfit,
            tone: 'text-emerald-700',
            sub: `Margin ${netMargin.toFixed(1)}% setelah HPP dan operasional`,
        },
        {
            label: 'Kas Kontainer Bisa Ditarik',
            value: summary.cashContainerAfterWithdrawals,
            tone: 'text-slate-900',
            sub: 'Cash setelah kas kasir, operasional, dan penarikan',
        },
        {
            label: 'Uang Kas Shift/Kasir',
            value: summary.cashierFundTotal,
            tone: 'text-amber-700',
            sub: `${standardCashText} + top up ${formatRupiah(summary.cashierTopups)}`,
        },
    ];

    return (
        <ErpLayout title="Keuangan">
            <Head title="Keuangan" />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900">Keuangan Outlet</h1>
                        <p className="mt-1 text-sm text-slate-500">{outlet?.name || 'Outlet'} - ringkasan kas dan penarikan owner.</p>
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
                            <p className="font-semibold">Kas kasir otomatis disiapkan {formatRupiah(summary.standardOpeningCash || 50000)} setiap buka shift.</p>
                            <p className="mt-1 text-amber-800">Tambahan kas kasir dicatat sebagai alokasi keluar dari kas kontainer, bukan pemasukan. Besoknya shift kembali memakai standar {formatRupiah(summary.standardOpeningCash || 50000)}.</p>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {statCards.map((card) => (
                        <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                            <p className="text-xs font-semibold uppercase text-slate-500">{card.label}</p>
                            <p className={`mt-2 text-2xl font-bold ${card.tone}`}>{formatRupiah(card.value)}</p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-500">{card.sub}</p>
                        </div>
                    ))}
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Tren Kas Harian</h2>
                                <p className="text-sm text-slate-500">Omzet, operasional, alokasi kas kasir, dan kas bersih periode.</p>
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
                                    <Area type="monotone" dataKey="omzet" name="Omzet" stroke="#4f46e5" fill="#c7d2fe" strokeWidth={2} />
                                    <Area type="monotone" dataKey="expenses" name="Operasional" stroke="#e11d48" fill="#fecdd3" strokeWidth={2} />
                                    <Area type="monotone" dataKey="cashier_fund" name="Kas Kasir" stroke="#d97706" fill="#fde68a" strokeWidth={2} />
                                    <Area type="monotone" dataKey="profit" name="Kas Bersih" stroke="#059669" fill="#bbf7d0" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="text-lg font-semibold text-slate-900">Saldo Shift Aktif</h2>
                            <div className="mt-4 space-y-3">
                                <div className="flex justify-between rounded-md bg-emerald-50 px-3 py-2 text-sm">
                                    <span className="font-medium text-emerald-700">Cash di shift</span>
                                    <span className="font-bold text-emerald-900">{formatRupiah(currentShiftBalance.cash?.expected)}</span>
                                </div>
                                <div className="flex justify-between rounded-md bg-blue-50 px-3 py-2 text-sm">
                                    <span className="font-medium text-blue-700">QRIS di shift</span>
                                    <span className="font-bold text-blue-900">{formatRupiah(currentShiftBalance.qris?.expected)}</span>
                                </div>
                                <div className="flex justify-between rounded-md bg-amber-50 px-3 py-2 text-sm">
                                    <span className="font-medium text-amber-700">Top up kasir</span>
                                    <span className="font-bold text-amber-900">{formatRupiah(currentShiftBalance.cash?.cashier_topups)}</span>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={submitWithdrawal} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="text-lg font-semibold text-slate-900">Penarikan Owner</h2>
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
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Mutasi Keuangan Terbaru</h2>
                            <p className="text-sm text-slate-500">Termasuk penarikan, pengeluaran, dan alokasi kas kasir.</p>
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
                                    return (
                                        <tr key={item.id}>
                                            <td className="py-3 pr-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cashierFund ? 'bg-amber-100 text-amber-800' : item.category === 'Penarikan' ? 'bg-slate-100 text-slate-700' : incoming ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                                        {cashierFund ? 'Kas Kasir' : item.category}
                                                    </span>
                                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.payment_method === 'QRIS' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-50 text-emerald-700'}`}>
                                                        {item.payment_method || 'CASH'}
                                                    </span>
                                                </div>
                                                <div className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString('id-ID')} - {item.description || 'Tanpa catatan'}</div>
                                            </td>
                                            <td className={`py-3 text-right font-semibold ${incoming ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {incoming ? '+' : '-'} {formatRupiah(item.amount)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </ErpLayout>
    );
}
