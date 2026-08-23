import { useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, router } from '@inertiajs/react';
import { openPdfInBrowser } from '@/Utils/openPdfInBrowser';
import {
    BanknotesIcon,
    CalendarDaysIcon,
    ClipboardDocumentListIcon,
    ClockIcon,
    CreditCardIcon,
    DocumentMagnifyingGlassIcon,
    FunnelIcon,
    PrinterIcon,
    Squares2X2Icon,
    UserGroupIcon,
} from '@heroicons/react/24/outline';

function formatRupiah(value) {
    const n = Number(value) || 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function formatNumber(value) {
    return new Intl.NumberFormat('id-ID').format(Number(value) || 0);
}

function formatQty(value) {
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function formatDate(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}

function signedTone(value, positive = 'text-emerald-700') {
    return (Number(value) || 0) >= 0 ? positive : 'text-rose-700';
}

function methodBadgeTone(method) {
    if (method === 'QRIS') return 'bg-blue-100 text-blue-800';
    if (method === 'PRIVATE') return 'bg-amber-100 text-amber-800';
    return 'bg-emerald-100 text-emerald-800';
}

function moneyOutTone(method) {
    return method === 'PRIVATE' ? 'text-amber-700' : 'text-rose-700';
}

function movementAmountTone(item, incoming) {
    if (item.payment_method === 'PRIVATE') return 'text-amber-700';
    return incoming ? 'text-emerald-700' : 'text-rose-700';
}

function movementSign(item, incoming) {
    if (item.payment_method === 'PRIVATE') return '';
    return incoming ? '+' : '-';
}

function MetricCard({ label, value, sub, icon: Icon, tone = 'text-slate-900', box = 'border-slate-200 bg-white', currency = true }) {
    return (
        <div className={`rounded-lg border p-4 shadow-sm ${box}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                    <p className={`mt-2 text-2xl font-bold ${tone}`}>{currency ? formatRupiah(value) : value}</p>
                </div>
                {Icon && <Icon className="h-6 w-6 text-slate-400" />}
            </div>
            {sub && <p className="mt-2 text-xs leading-relaxed text-slate-500">{sub}</p>}
        </div>
    );
}

export default function ESettlement({ filters, report = {} }) {
    const [startDate, setStartDate] = useState(filters.start_date || report.start_date || '');
    const [endDate, setEndDate] = useState(filters.end_date || report.end_date || '');
    const invalidRange = Boolean(startDate && endDate && endDate < startDate);
    const summary = report.summary || {};
    const categorySummary = report.category_summary || [];
    const daily = report.daily || [];
    const transactions = report.transactions || [];
    const movements = report.movements || [];
    const soldItems = report.sold_items || [];
    const productSummary = report.product_summary || [];
    const shiftSummary = report.shift_summary || {};
    const shiftDetails = report.shift_details || [];
    const cashierMoneyInTotal = (Number(summary.cash_sales) || 0)
        + (Number(summary.qris_sales) || 0)
        + (Number(summary.cash_in) || 0)
        + (Number(summary.qris_in) || 0);
    const cashierMoneyOutTotal = (Number(summary.cash_out) || 0) + (Number(summary.qris_out) || 0);
    const privateMoneyUsage = Number(summary.outside_out) || 0;
    const privateMoneyIn = Number(summary.outside_in) || 0;
    const ownerWithdrawalTotal = (Number(summary.withdraw_cash) || 0) + (Number(summary.withdraw_qris) || 0);
    const pdfUrl = route('reports.e-settlement.pdf', {
        start_date: startDate,
        end_date: endDate,
    }, false);

    const applyFilter = (event) => {
        event.preventDefault();
        if (invalidRange) return;

        router.get(route('reports.e-settlement'), {
            start_date: startDate,
            end_date: endDate,
        }, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    return (
        <ErpLayout title="E-Settlement Keuangan">
            <Head title="E-Settlement Keuangan" />
            <style>{`
                @media print {
                    @page { size: A4; margin: 12mm; }
                    body { background: #fff !important; }
                    .erp-app-sidebar,
                    .erp-app-header,
                    .settlement-print-hidden {
                        display: none !important;
                    }
                    .settlement-print-area {
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .settlement-print-area section,
                    .settlement-print-card {
                        break-inside: avoid;
                        box-shadow: none !important;
                    }
                    .settlement-print-area table {
                        page-break-inside: auto;
                    }
                    .settlement-print-area tr {
                        page-break-inside: avoid;
                    }
                }
            `}</style>

            <div className="settlement-print-area space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900">E-Settlement Keuangan</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Rekap data penting keuangan periode {formatDate(report.start_date)} - {formatDate(report.end_date)}.
                        </p>
                    </div>
                    <div className="settlement-print-hidden flex flex-col gap-2 sm:flex-row">
                        <button
                            type="button"
                            onClick={() => router.get(route('reports'))}
                            className="inline-flex min-h-[40px] items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Kembali
                            </button>
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                            <PrinterIcon className="h-4 w-4" />
                            Print / Simpan PDF
                        </button>
                        <button
                            type="button"
                            onClick={() => openPdfInBrowser(pdfUrl)}
                            disabled={invalidRange || !startDate || !endDate}
                            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                            <DocumentMagnifyingGlassIcon className="h-4 w-4" />
                            Buka PDF
                        </button>
                    </div>
                </div>

                <form onSubmit={applyFilter} className="settlement-print-hidden grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Mulai</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(event) => setStartDate(event.target.value)}
                            className="h-10 w-full rounded-md border-slate-300 text-sm"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Sampai</span>
                        <input
                            type="date"
                            value={endDate}
                            min={startDate || undefined}
                            onChange={(event) => setEndDate(event.target.value)}
                            className={`h-10 w-full rounded-md text-sm ${invalidRange ? 'border-rose-400' : 'border-slate-300'}`}
                        />
                    </label>
                    <button
                        type="submit"
                        disabled={invalidRange || !startDate || !endDate}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                        <FunnelIcon className="h-4 w-4" />
                        Terapkan
                    </button>
                    {invalidRange && <p className="text-xs font-medium text-rose-600 sm:col-span-3">Tanggal akhir tidak boleh sebelum tanggal mulai.</p>}
                </form>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="Total Penjualan" value={summary.sales_total} icon={ClipboardDocumentListIcon} tone="text-indigo-800" box="border-indigo-200 bg-indigo-50" sub={`${formatNumber(summary.transaction_count)} transaksi lunas`} />
                    <MetricCard label="Cash Net" value={summary.cash_net} icon={BanknotesIcon} tone={signedTone(summary.cash_net, 'text-emerald-800')} box="border-emerald-200 bg-emerald-50" sub={`Cash sales ${formatRupiah(summary.cash_sales)} | keluar ${formatRupiah(summary.cash_out)}`} />
                    <MetricCard label="QRIS Net" value={summary.qris_net} icon={CreditCardIcon} tone={signedTone(summary.qris_net, 'text-blue-800')} box="border-blue-200 bg-blue-50" sub={`QRIS sales ${formatRupiah(summary.qris_sales)} | keluar ${formatRupiah(summary.qris_out)}`} />
                    <MetricCard label="Saldo Settlement" value={summary.settlement_net} tone={signedTone(summary.settlement_net, 'text-slate-900')} sub="Cash net + QRIS net, tanpa uang pribadi." />
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <MetricCard label="Uang Masuk Kas/QRIS" value={cashierMoneyInTotal} tone="text-slate-900" sub="Penjualan cash/QRIS dan mutasi masuk kas/QRIS." />
                    <MetricCard label="Uang Keluar Kas/QRIS" value={cashierMoneyOutTotal} tone="text-rose-700" sub="Pengeluaran, restock, top up laci, dan penarikan." />
                    <MetricCard label="Uang Pribadi" value={privateMoneyUsage} tone="text-amber-700" box="border-amber-200 bg-amber-50" sub={`Masuk/top up pribadi ${formatRupiah(privateMoneyIn)}. Tidak mengurangi settlement.`} />
                    <MetricCard label="Top Up Kasir" value={summary.cashier_topups} tone="text-amber-700" sub={`Dari laci ${formatRupiah(summary.drawer_cashier_topups)} | luar ${formatRupiah(summary.outside_cashier_topups)}`} />
                    <MetricCard label="Penarikan Owner" value={ownerWithdrawalTotal} tone="text-slate-900" sub={`Cash ${formatRupiah(summary.withdraw_cash)} | QRIS ${formatRupiah(summary.withdraw_qris)}`} />
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="Hari Kerja" value={formatNumber(shiftSummary.work_days || 0)} icon={CalendarDaysIcon} tone="text-slate-900" sub={`${formatNumber(shiftSummary.shift_count)} shift pada periode ini.`} currency={false} />
                    <MetricCard label="Rata-rata Shift" value={shiftSummary.average_open_label || '0j 0m'} icon={ClockIcon} tone="text-indigo-800" box="border-indigo-200 bg-indigo-50" sub="Durasi rata-rata buka shift." currency={false} />
                    <MetricCard label="Shift Terlama" value={shiftSummary.longest_shift?.duration_label || '0j 0m'} icon={UserGroupIcon} tone="text-emerald-800" box="border-emerald-200 bg-emerald-50" sub={shiftSummary.longest_shift ? `${shiftSummary.longest_shift.name || 'Shift'}` : 'Belum ada shift'} currency={false} />
                    <MetricCard label="Shift Tersingkat" value={shiftSummary.shortest_shift?.duration_label || '0j 0m'} icon={ClockIcon} tone="text-amber-800" box="border-amber-200 bg-amber-50" sub={shiftSummary.shortest_shift ? `${shiftSummary.shortest_shift.name || 'Shift'}` : 'Belum ada shift'} currency={false} />
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-200 px-4 py-3">
                            <h2 className="font-semibold text-slate-900">Ringkasan Produk</h2>
                            <p className="text-xs text-slate-500">Produk terjual, estimasi HPP, dan profit kotor sesuai filter.</p>
                        </div>
                        <div className="max-h-[360px] overflow-auto">
                            {productSummary.length > 0 ? (
                                <table className="w-full min-w-[720px] text-sm">
                                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                                        <tr>
                                            <th className="px-4 py-3">Produk</th>
                                            <th className="px-4 py-3 text-right">Qty</th>
                                            <th className="px-4 py-3 text-right">Omzet</th>
                                            <th className="px-4 py-3 text-right">HPP</th>
                                            <th className="px-4 py-3 text-right">Profit</th>
                                            <th className="px-4 py-3 text-right">Margin</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {productSummary.map((item) => (
                                            <tr key={item.product_id || item.product_name} className="hover:bg-slate-50">
                                                <td className="px-4 py-3">
                                                    <p className="font-semibold text-slate-900">{item.product_name}</p>
                                                    <p className="text-xs text-slate-500">{formatNumber(item.transaction_count)} transaksi</p>
                                                </td>
                                                <td className="px-4 py-3 text-right">{formatQty(item.quantity_sold)}</td>
                                                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-indigo-700">{formatRupiah(item.revenue)}</td>
                                                <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">{formatRupiah(item.estimated_hpp)}</td>
                                                <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${signedTone(item.gross_profit, 'text-emerald-700')}`}>{formatRupiah(item.gross_profit)}</td>
                                                <td className="px-4 py-3 text-right">{formatQty(item.margin_percent)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="px-4 py-10 text-center text-sm text-slate-500">Belum ada produk terjual pada periode ini.</div>
                            )}
                        </div>
                    </section>

                    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-200 px-4 py-3">
                            <h2 className="font-semibold text-slate-900">Shift Pegawai</h2>
                            <p className="text-xs text-slate-500">Jam buka shift dan petugas yang tercatat.</p>
                        </div>
                        <div className="max-h-[360px] overflow-auto">
                            {shiftDetails.length > 0 ? (
                                <table className="w-full min-w-[680px] text-sm">
                                    <tbody className="divide-y divide-slate-100">
                                        {shiftDetails.map((shift) => (
                                            <tr key={shift.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3">
                                                    <p className="font-semibold text-slate-900">{shift.name || 'Shift'}</p>
                                                    <p className="text-xs text-slate-500">{formatDateTime(shift.opened_at)} - {shift.closed_at ? formatDateTime(shift.closed_at) : 'Masih berjalan'}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <p className="text-xs text-slate-500">Buka / Tutup</p>
                                                    <p className="font-medium text-slate-800">{shift.opened_by} / {shift.closed_by}</p>
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-indigo-700">{shift.duration_label}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="px-4 py-10 text-center text-sm text-slate-500">Belum ada shift pada periode ini.</div>
                            )}
                        </div>
                    </section>
                </div>

                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                        <div>
                            <h2 className="font-semibold text-slate-900">Detail Barang Terjual</h2>
                            <p className="text-xs text-slate-500">Setiap item produk dari transaksi lunas sesuai periode filter.</p>
                        </div>
                        <Squares2X2Icon className="h-5 w-5 text-slate-400" />
                    </div>
                    {soldItems.length > 0 ? (
                        <div className="max-h-[420px] overflow-auto">
                            <table className="w-full min-w-[980px] text-sm">
                                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3">Invoice</th>
                                        <th className="px-4 py-3">Produk</th>
                                        <th className="px-4 py-3">Metode</th>
                                        <th className="px-4 py-3 text-right">Qty</th>
                                        <th className="px-4 py-3 text-right">Omzet</th>
                                        <th className="px-4 py-3 text-right">HPP</th>
                                        <th className="px-4 py-3 text-right">Profit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {soldItems.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3">
                                                <p className="font-semibold text-slate-900">{item.invoice_number}</p>
                                                <p className="text-xs text-slate-500">{formatDateTime(item.paid_at)}</p>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-900">{item.product_name}</td>
                                            <td className="px-4 py-3">
                                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${methodBadgeTone(item.payment_method)}`}>
                                                    {item.payment_method}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">{formatQty(item.qty)}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-indigo-700">{formatRupiah(item.revenue)}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">{formatRupiah(item.estimated_hpp)}</td>
                                            <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${signedTone(item.gross_profit, 'text-emerald-700')}`}>{formatRupiah(item.gross_profit)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="px-4 py-10 text-center text-sm text-slate-500">Belum ada item produk terjual pada periode ini.</div>
                    )}
                </section>

                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-4 py-3">
                        <h2 className="font-semibold text-slate-900">Kategori Keuangan</h2>
                        <p className="text-xs text-slate-500">Semua kategori uang masuk dan keluar pada periode ini.</p>
                    </div>
                    {categorySummary.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-[980px] w-full text-sm">
                                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3">Kategori</th>
                                        <th className="px-4 py-3">Metode</th>
                                        <th className="px-4 py-3 text-right">Masuk</th>
                                        <th className="px-4 py-3 text-right">Keluar</th>
                                        <th className="px-4 py-3 text-right">Net</th>
                                        <th className="px-4 py-3 text-right">Jumlah</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {categorySummary.map((row) => (
                                        <tr key={`${row.category}-${row.payment_method}`} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-semibold text-slate-900">{row.category}</td>
                                            <td className="px-4 py-3">
                                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${methodBadgeTone(row.payment_method)}`}>
                                                    {row.payment_method}
                                                </span>
                                            </td>
                                            <td className={`whitespace-nowrap px-4 py-3 text-right ${row.payment_method === 'PRIVATE' ? 'text-amber-700' : 'text-emerald-700'}`}>{formatRupiah(row.total_in)}</td>
                                            <td className={`whitespace-nowrap px-4 py-3 text-right ${moneyOutTone(row.payment_method)}`}>{formatRupiah(row.total_out)}</td>
                                            <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${row.payment_method === 'PRIVATE' ? 'text-amber-700' : signedTone(row.net, 'text-slate-900')}`}>{formatRupiah(row.net)}</td>
                                            <td className="px-4 py-3 text-right text-slate-600">{formatNumber(row.count)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="px-4 py-10 text-center text-sm text-slate-500">Belum ada kategori keuangan pada periode ini.</div>
                    )}
                </section>

                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                        <h2 className="font-semibold text-slate-900">Rekap Harian</h2>
                        <span className="text-xs text-slate-500">{daily.length} hari</span>
                    </div>
                    {daily.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-[980px] w-full text-sm">
                                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3">Tanggal</th>
                                        <th className="px-4 py-3 text-right">Penjualan</th>
                                        <th className="px-4 py-3 text-right">Cash Sales</th>
                                        <th className="px-4 py-3 text-right">QRIS Sales</th>
                                        <th className="px-4 py-3 text-right">Cash Keluar</th>
                                        <th className="px-4 py-3 text-right">QRIS Keluar</th>
                                        <th className="px-4 py-3 text-right">Net Cash</th>
                                        <th className="px-4 py-3 text-right">Net QRIS</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {daily.map((day) => (
                                        <tr key={day.date} className="hover:bg-slate-50">
                                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{formatDate(day.date)}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-indigo-700">{formatRupiah(day.sales_total)}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-right">{formatRupiah(day.cash_sales)}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-right">{formatRupiah(day.qris_sales)}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-right text-rose-700">{formatRupiah(day.cash_out)}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-right text-rose-700">{formatRupiah(day.qris_out)}</td>
                                            <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${signedTone(day.net_cash, 'text-emerald-700')}`}>{formatRupiah(day.net_cash)}</td>
                                            <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${signedTone(day.net_qris, 'text-blue-700')}`}>{formatRupiah(day.net_qris)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="px-4 py-10 text-center text-sm text-slate-500">Belum ada data harian pada periode ini.</div>
                    )}
                </section>

                <div className="grid gap-5 xl:grid-cols-2">
                    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-200 px-4 py-3">
                            <h2 className="font-semibold text-slate-900">Penjualan Lunas</h2>
                            <p className="text-xs text-slate-500">Semua transaksi lunas pada periode yang dipilih.</p>
                        </div>
                        <div className="max-h-[420px] overflow-auto">
                            {transactions.length > 0 ? (
                                <table className="w-full min-w-[540px] text-sm">
                                    <tbody className="divide-y divide-slate-100">
                                        {transactions.map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3">
                                                    <p className="font-semibold text-slate-900">{item.invoice_number}</p>
                                                    <p className="text-xs text-slate-500">{formatDateTime(item.paid_at)}</p>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.payment_method === 'QRIS' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                                        {item.payment_method}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">{formatRupiah(item.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="px-4 py-10 text-center text-sm text-slate-500">Belum ada transaksi lunas.</div>
                            )}
                        </div>
                    </section>

                    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-200 px-4 py-3">
                            <h2 className="font-semibold text-slate-900">Uang Keluar Masuk</h2>
                            <p className="text-xs text-slate-500">Semua mutasi kas, QRIS, top up, restock, dan penarikan owner.</p>
                        </div>
                        <div className="max-h-[420px] overflow-auto">
                            {movements.length > 0 ? (
                                <table className="w-full min-w-[620px] text-sm">
                                    <tbody className="divide-y divide-slate-100">
                                        {movements.map((item) => {
                                            const incoming = item.cash_flow === 'IN';
                                            const sign = movementSign(item, incoming);
                                            return (
                                                <tr key={item.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3">
                                                        <p className="font-semibold text-slate-900">{item.category}</p>
                                                        <p className="text-xs text-slate-500">{formatDateTime(item.created_at)} - {item.description || 'Tanpa catatan'}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${methodBadgeTone(item.payment_method)}`}>
                                                            {item.payment_method}
                                                        </span>
                                                    </td>
                                                    <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${movementAmountTone(item, incoming)}`}>
                                                        {sign && `${sign} `}{formatRupiah(item.amount)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="px-4 py-10 text-center text-sm text-slate-500">Belum ada mutasi uang pada periode ini.</div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </ErpLayout>
    );
}
