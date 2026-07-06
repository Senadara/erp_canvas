import { useMemo, useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function formatRupiah(value) {
    const n = Number(value) || 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function localDatetimeValue() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
}

export default function FinanceIndex({
    outlet,
    filters,
    summary,
    daily,
    topProducts,
    expenseByCategory,
    cashMovements,
    withdrawals,
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
        { label: 'Omzet', value: summary.omzet, tone: 'text-indigo-700', sub: `${summary.transactionCount} transaksi lunas` },
        { label: 'HPP', value: summary.hpp, tone: 'text-amber-700', sub: 'Estimasi modal produk' },
        { label: 'Laba Kotor', value: summary.grossProfit, tone: 'text-emerald-700', sub: 'Omzet dikurangi HPP' },
        { label: 'Pengeluaran', value: summary.expenseTotal, tone: 'text-rose-700', sub: 'Tidak termasuk penarikan owner' },
        { label: 'Laba Bersih', value: summary.netProfit, tone: 'text-slate-900', sub: `Margin ${netMargin.toFixed(1)}%` },
        { label: 'Belum Bayar', value: summary.unpaidTotal, tone: 'text-orange-700', sub: `${summary.unpaidCount} order aktif` },
    ];

    return (
        <ErpLayout title="Keuangan">
            <Head title="Keuangan" />

            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Keuangan Outlet</h1>
                    <p className="mt-1 text-sm text-slate-500">{outlet?.name || 'Outlet'} - rekap owner per outlet aktif.</p>
                </div>
                <form onSubmit={applyFilter} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Dari</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="rounded-md border-slate-300 text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Sampai</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="rounded-md border-slate-300 text-sm" />
                    </div>
                    <button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                        Terapkan
                    </button>
                </form>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {statCards.map((card) => (
                    <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase text-slate-500">{card.label}</p>
                        <p className={`mt-2 text-2xl font-bold ${card.tone}`}>{formatRupiah(card.value)}</p>
                        <p className="mt-1 text-xs text-slate-500">{card.sub}</p>
                    </div>
                ))}
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Tren Harian</h2>
                            <p className="text-sm text-slate-500">Omzet, pengeluaran, dan estimasi laba.</p>
                        </div>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={daily} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                                <YAxis tickFormatter={(v) => `Rp${v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                                <Tooltip formatter={(value, name) => [formatRupiah(value), name]} />
                                <Area type="monotone" dataKey="omzet" name="Omzet" stroke="#4f46e5" fill="#c7d2fe" strokeWidth={2} />
                                <Area type="monotone" dataKey="expenses" name="Pengeluaran" stroke="#e11d48" fill="#fecdd3" strokeWidth={2} />
                                <Area type="monotone" dataKey="profit" name="Laba" stroke="#059669" fill="#bbf7d0" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">Saldo Shift Aktif</h2>
                    <div className="mt-4 space-y-3">
                        <div className="flex justify-between rounded-md bg-emerald-50 px-3 py-2 text-sm">
                            <span className="font-medium text-emerald-700">Cash</span>
                            <span className="font-bold text-emerald-900">{formatRupiah(currentShiftBalance.cash?.expected)}</span>
                        </div>
                        <div className="flex justify-between rounded-md bg-blue-50 px-3 py-2 text-sm">
                            <span className="font-medium text-blue-700">QRIS</span>
                            <span className="font-bold text-blue-900">{formatRupiah(currentShiftBalance.qris?.expected)}</span>
                        </div>
                        <div className="flex justify-between rounded-md bg-slate-900 px-3 py-2 text-sm text-white">
                            <span className="font-medium">Total</span>
                            <span className="font-bold">{formatRupiah(currentShiftBalance.total_expected)}</span>
                        </div>
                    </div>

                    <form onSubmit={submitWithdrawal} className="mt-5 space-y-4 border-t border-slate-200 pt-5">
                        <h3 className="font-semibold text-slate-900">Penarikan Owner</h3>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nominal</label>
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
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal</label>
                            <input type="datetime-local" value={data.date} onChange={e => setData('date', e.target.value)} className="w-full rounded-md border-slate-300 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
                            <textarea value={data.description} onChange={e => setData('description', e.target.value)} rows="2" className="w-full rounded-md border-slate-300 text-sm" placeholder="Contoh: Setoran owner / tarik kas harian" />
                        </div>
                        <button type="submit" disabled={processing} className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                            {processing ? 'Menyimpan...' : 'Catat Penarikan'}
                        </button>
                    </form>
                </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">Produk Terlaris</h2>
                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-sm">
                            <tbody className="divide-y divide-slate-100">
                                {topProducts.length === 0 ? (
                                    <tr><td className="py-6 text-center text-slate-500">Belum ada penjualan.</td></tr>
                                ) : topProducts.map(product => (
                                    <tr key={product.name}>
                                        <td className="py-3 font-medium text-slate-800">{product.name}</td>
                                        <td className="py-3 text-right text-slate-500">{product.qty} porsi</td>
                                        <td className="py-3 text-right font-semibold text-slate-900">{formatRupiah(product.revenue)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">Pengeluaran per Kategori</h2>
                    <div className="mt-4 space-y-2">
                        {expenseByCategory.length === 0 ? (
                            <p className="py-6 text-center text-sm text-slate-500">Belum ada pengeluaran.</p>
                        ) : expenseByCategory.map(item => (
                            <div key={item.category} className="flex justify-between rounded-md bg-rose-50 px-3 py-2 text-sm">
                                <span className="font-medium text-rose-800">{item.category}</span>
                                <span className="font-bold text-rose-700">{formatRupiah(item.amount)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">Riwayat Penarikan</h2>
                    <div className="mt-4 space-y-2">
                        {withdrawals.length === 0 ? (
                            <p className="py-6 text-center text-sm text-slate-500">Belum ada penarikan pada periode ini.</p>
                        ) : withdrawals.map(item => (
                            <div key={item.id} className="flex items-start justify-between rounded-md border border-slate-100 px-3 py-2 text-sm">
                                <div>
                                    <p className="font-semibold text-slate-800">{item.payment_method} - {new Date(item.created_at).toLocaleString('id-ID')}</p>
                                    <p className="text-xs text-slate-500">{item.description || 'Tanpa catatan'}</p>
                                </div>
                                <span className="font-bold text-slate-900">{formatRupiah(item.amount)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">Mutasi Kas Terbaru</h2>
                    <div className="mt-4 max-h-96 overflow-y-auto">
                        <table className="w-full text-sm">
                            <tbody className="divide-y divide-slate-100">
                                {cashMovements.length === 0 ? (
                                    <tr><td className="py-6 text-center text-slate-500">Belum ada mutasi kas.</td></tr>
                                ) : cashMovements.map(item => (
                                    <tr key={item.id}>
                                        <td className="py-3">
                                            <div className="font-medium text-slate-800">{item.category}</div>
                                            <div className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString('id-ID')} - {item.payment_method}</div>
                                        </td>
                                        <td className={`py-3 text-right font-semibold ${item.cash_flow === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {item.cash_flow === 'IN' ? '+' : '-'} {formatRupiah(item.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </ErpLayout>
    );
}
