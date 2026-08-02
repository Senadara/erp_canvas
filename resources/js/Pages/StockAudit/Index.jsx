import { useEffect, useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, router, useForm } from '@inertiajs/react';
import {
    ArchiveBoxIcon,
    CheckCircleIcon,
    ClipboardDocumentListIcon,
    ExclamationTriangleIcon,
    FunnelIcon,
    MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

function formatQty(value, unit = '') {
    const n = Number(value) || 0;
    return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n)}${unit ? ` ${unit}` : ''}`;
}

function formatDate(value, withTime = false) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        ...(withTime ? { timeStyle: 'short' } : {}),
    }).format(new Date(value));
}

function localDatetimeValue() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
}

function statusTone(status) {
    if (status === 'CRITICAL') return 'border-rose-200 bg-rose-50 text-rose-700';
    if (status === 'WARNING') return 'border-amber-200 bg-amber-50 text-amber-700';
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

function signedTone(value) {
    const n = Number(value) || 0;
    if (n < 0) return 'text-rose-700';
    if (n > 0) return 'text-amber-700';
    return 'text-emerald-700';
}

function Metric({ label, value, sub, tone = 'text-slate-900' }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
            <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
            {sub && <p className="mt-1 text-xs leading-relaxed text-slate-500">{sub}</p>}
        </div>
    );
}

function EmptyState({ text }) {
    return (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            {text}
        </div>
    );
}

export default function StockAuditIndex({ filters, report }) {
    const [startDate, setStartDate] = useState(filters.start_date || report.start_date || '');
    const [endDate, setEndDate] = useState(filters.end_date || report.end_date || '');
    const [stockItemId, setStockItemId] = useState(report.selected_stock_id || '');
    const selected = report.selected_stock;
    const rows = report.rows || [];
    const summary = report.summary || {};
    const selectedUnit = selected?.unit_name || '';

    const { data, setData, post, processing, reset, errors } = useForm({
        stock_item_id: report.selected_stock_id || '',
        counted_stock: '',
        counted_at: localDatetimeValue(),
        note: '',
    });

    useEffect(() => {
        setStartDate(filters.start_date || report.start_date || '');
        setEndDate(filters.end_date || report.end_date || '');
        setStockItemId(report.selected_stock_id || '');
        setData('stock_item_id', report.selected_stock_id || '');
    }, [filters.start_date, filters.end_date, report.start_date, report.end_date, report.selected_stock_id]);

    const applyFilter = (event) => {
        event.preventDefault();
        router.get(route('stock-audit'), {
            start_date: startDate,
            end_date: endDate,
            stock_item_id: stockItemId || undefined,
        }, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    const inspectStock = (id) => {
        setStockItemId(id);
        router.get(route('stock-audit'), {
            start_date: startDate,
            end_date: endDate,
            stock_item_id: id,
        }, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    const submitCount = (event) => {
        event.preventDefault();
        post(route('stock-audit.counts'), {
            preserveScroll: true,
            onSuccess: () => {
                reset('counted_stock', 'note');
                setData('counted_at', localDatetimeValue());
                router.reload({ only: ['report'] });
            },
        });
    };

    return (
        <ErpLayout title="Audit Stok">
            <Head title="Audit Stok" />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900">Audit Stok</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Bandingkan stok awal, penjualan produk, pengurangan stok yang tercatat, restock, waste, dan stok sistem per tanggal.
                        </p>
                    </div>
                    <form onSubmit={applyFilter} className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
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
                                className="h-10 w-full rounded-md border-slate-300 text-sm"
                            />
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Inspeksi Bahan</span>
                            <select
                                value={stockItemId}
                                onChange={(event) => setStockItemId(event.target.value)}
                                className="h-10 w-full rounded-md border-slate-300 text-sm"
                            >
                                {(report.stock_options || []).map((stock) => (
                                    <option key={stock.id} value={stock.id}>{stock.name}</option>
                                ))}
                            </select>
                        </label>
                        <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700">
                            <FunnelIcon className="h-4 w-4" />
                            Terapkan
                        </button>
                    </form>
                </div>

                <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                    <div className="flex gap-3">
                        <ArchiveBoxIcon className="mt-0.5 h-5 w-5 shrink-0" />
                        <p>
                            Estimasi penjualan memakai konversi produk saat ini. Jika nilai ini berbeda dari log pengurangan stok, sistem akan menandai bahan untuk diperiksa.
                        </p>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Metric label="Bahan Diaudit" value={`${summary.stock_count || 0} item`} sub={`${summary.ok_count || 0} sesuai, ${summary.warning_count || 0} warning, ${summary.critical_count || 0} perlu dicek.`} />
                    <Metric label="Estimasi Stok Keluar" value={formatQty(summary.estimated_sales_usage)} sub="Dari total penjualan produk sesuai konversi." tone="text-indigo-700" />
                    <Metric label="Deduksi Log Sistem" value={formatQty(summary.logged_sales_deduction)} sub="Pengurangan stok yang benar-benar tercatat." tone="text-slate-900" />
                    <Metric label="Total Selisih Absolut" value={formatQty(summary.absolute_gap)} sub="Akumulasi selisih stok akhir sistem vs estimasi." tone={Number(summary.absolute_gap) > 0 ? 'text-rose-700' : 'text-emerald-700'} />
                </div>

                <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Komparasi Stok per Bahan</h2>
                            <p className="mt-1 text-sm text-slate-500">{formatDate(`${report.start_date}T00:00:00`)} - {formatDate(`${report.end_date}T00:00:00`)}</p>
                        </div>
                        <ClipboardDocumentListIcon className="h-5 w-5 text-slate-400" />
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1120px] text-sm">
                            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                                <tr>
                                    <th className="px-4 py-3">Bahan</th>
                                    <th className="px-4 py-3 text-right">Stok Awal</th>
                                    <th className="px-4 py-3 text-right">Produk Terjual</th>
                                    <th className="px-4 py-3 text-right">Estimasi Keluar</th>
                                    <th className="px-4 py-3 text-right">Deduksi Log</th>
                                    <th className="px-4 py-3 text-right">Restock</th>
                                    <th className="px-4 py-3 text-right">Waste</th>
                                    <th className="px-4 py-3 text-right">Stok Akhir Sistem</th>
                                    <th className="px-4 py-3 text-right">Stok Saat Ini</th>
                                    <th className="px-4 py-3 text-right">Selisih</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan="12" className="px-4 py-8 text-center text-slate-500">Belum ada stok trackable pada outlet ini.</td>
                                    </tr>
                                ) : rows.map((row) => (
                                    <tr key={row.stock_item_id} className={row.stock_item_id === report.selected_stock_id ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}>
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-slate-900">{row.name}</p>
                                            <p className="text-xs text-slate-500">{row.display_group || 'Tanpa grup'}{row.warehouse_stock ? ` | Gudang: ${row.warehouse_stock.name}` : ''}</p>
                                        </td>
                                        <td className="px-4 py-3 text-right">{formatQty(row.stock_start, row.unit_name)}</td>
                                        <td className="px-4 py-3 text-right">{formatQty(row.product_qty_sold, 'porsi')}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-indigo-700">{formatQty(row.estimated_sales_usage, row.unit_name)}</td>
                                        <td className={`px-4 py-3 text-right font-semibold ${signedTone(row.sales_movement_gap)}`}>{formatQty(row.logged_sales_deduction, row.unit_name)}</td>
                                        <td className="px-4 py-3 text-right text-emerald-700">{formatQty(row.restock_qty, row.unit_name)}</td>
                                        <td className="px-4 py-3 text-right text-rose-700">{formatQty(row.waste_qty, row.unit_name)}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatQty(row.system_ending_stock, row.unit_name)}</td>
                                        <td className="px-4 py-3 text-right">{formatQty(row.current_stock, row.unit_name)}</td>
                                        <td className={`px-4 py-3 text-right font-bold ${signedTone(row.ending_stock_gap)}`}>{formatQty(row.ending_stock_gap, row.unit_name)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTone(row.status)}`}>
                                                {row.status_label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => inspectStock(row.stock_item_id)}
                                                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                            >
                                                <MagnifyingGlassIcon className="h-4 w-4" />
                                                Inspeksi
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {selected && (
                    <section className="space-y-5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Detail Audit {selected.name}</h2>
                                <p className="mt-1 text-sm text-slate-500">Tanggal {formatDate(`${report.start_date}T00:00:00`)} - {formatDate(`${report.end_date}T00:00:00`)}</p>
                            </div>
                            <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(selected.status)}`}>
                                {selected.status_label}
                            </span>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <Metric label="Stok Awal" value={formatQty(selected.stock_start, selectedUnit)} sub={`Estimasi per ${formatDate(`${report.start_date}T00:00:00`)}.`} />
                            <Metric label="Estimasi Keluar" value={formatQty(selected.estimated_sales_usage, selectedUnit)} sub={`${formatQty(selected.product_qty_sold, 'porsi')} produk terjual.`} tone="text-indigo-700" />
                            <Metric label="Deduksi Log" value={formatQty(selected.logged_sales_deduction, selectedUnit)} sub={`Selisih log vs estimasi ${formatQty(selected.sales_movement_gap, selectedUnit)}.`} tone={signedTone(selected.sales_movement_gap)} />
                            <Metric label="Stok Akhir Sistem" value={formatQty(selected.system_ending_stock, selectedUnit)} sub={`Selisih estimasi ${formatQty(selected.ending_stock_gap, selectedUnit)}.`} tone={signedTone(selected.ending_stock_gap)} />
                        </div>

                        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                                <div className="border-b border-slate-200 px-5 py-4">
                                    <h3 className="text-base font-semibold text-slate-900">Timeline Harian</h3>
                                    <p className="mt-1 text-sm text-slate-500">Urutan stok berdasarkan log sistem dan estimasi konversi produk.</p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[860px] text-sm">
                                        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                                            <tr>
                                                <th className="px-4 py-3">Tanggal</th>
                                                <th className="px-4 py-3 text-right">Awal</th>
                                                <th className="px-4 py-3 text-right">Porsi</th>
                                                <th className="px-4 py-3 text-right">Estimasi Keluar</th>
                                                <th className="px-4 py-3 text-right">Deduksi Log</th>
                                                <th className="px-4 py-3 text-right">Restock</th>
                                                <th className="px-4 py-3 text-right">Waste</th>
                                                <th className="px-4 py-3 text-right">Akhir Sistem</th>
                                                <th className="px-4 py-3 text-right">Selisih</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {(selected.timeline || []).map((day) => (
                                                <tr key={day.date} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 font-medium text-slate-900">{formatDate(`${day.date}T00:00:00`)}</td>
                                                    <td className="px-4 py-3 text-right">{formatQty(day.stock_start, selectedUnit)}</td>
                                                    <td className="px-4 py-3 text-right">{formatQty(day.product_qty_sold, 'porsi')}</td>
                                                    <td className="px-4 py-3 text-right text-indigo-700">{formatQty(day.estimated_sales_usage, selectedUnit)}</td>
                                                    <td className="px-4 py-3 text-right">{formatQty(day.logged_sales_deduction, selectedUnit)}</td>
                                                    <td className="px-4 py-3 text-right text-emerald-700">{formatQty(day.restock_qty, selectedUnit)}</td>
                                                    <td className="px-4 py-3 text-right text-rose-700">{formatQty(day.waste_qty, selectedUnit)}</td>
                                                    <td className="px-4 py-3 text-right font-semibold">{formatQty(day.system_ending_stock, selectedUnit)}</td>
                                                    <td className={`px-4 py-3 text-right font-bold ${signedTone(day.ending_stock_gap)}`}>{formatQty(day.ending_stock_gap, selectedUnit)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <form onSubmit={submitCount} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="mb-4 flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-base font-semibold text-slate-900">Catat Cek Fisik</h3>
                                        <p className="mt-1 text-sm text-slate-500">Bandingkan stok asli di outlet dengan stok sistem saat ini.</p>
                                    </div>
                                    {selected.latest_count ? (
                                        <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
                                    ) : (
                                        <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                                    )}
                                </div>

                                <input type="hidden" value={data.stock_item_id} readOnly />
                                <div className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                    Stok sistem saat ini: <span className="font-semibold text-slate-900">{formatQty(selected.current_system_stock, selectedUnit)}</span>
                                </div>

                                <label className="block">
                                    <span className="mb-1 block text-sm font-medium text-slate-700">Stok fisik</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.0001"
                                        value={data.counted_stock}
                                        onChange={(event) => setData('counted_stock', event.target.value)}
                                        className="w-full rounded-md border-slate-300 text-sm"
                                        required
                                    />
                                    {errors.counted_stock && <p className="mt-1 text-xs text-rose-600">{errors.counted_stock}</p>}
                                </label>

                                <label className="mt-3 block">
                                    <span className="mb-1 block text-sm font-medium text-slate-700">Waktu cek</span>
                                    <input
                                        type="datetime-local"
                                        value={data.counted_at}
                                        onChange={(event) => setData('counted_at', event.target.value)}
                                        className="w-full rounded-md border-slate-300 text-sm"
                                    />
                                </label>

                                <label className="mt-3 block">
                                    <span className="mb-1 block text-sm font-medium text-slate-700">Catatan</span>
                                    <textarea
                                        rows="3"
                                        value={data.note}
                                        onChange={(event) => setData('note', event.target.value)}
                                        className="w-full rounded-md border-slate-300 text-sm"
                                        placeholder="Contoh: hitung ulang freezer / stok fisik kurang 2 pcs"
                                    />
                                </label>

                                {selected.latest_count && (
                                    <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                        Cek terakhir {formatDate(selected.latest_count.date, true)}: fisik {formatQty(selected.latest_count.counted_stock, selectedUnit)}, selisih {formatQty(selected.latest_count.difference, selectedUnit)}.
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                                >
                                    {processing ? 'Menyimpan...' : 'Simpan Cek Fisik'}
                                </button>
                            </form>
                        </div>

                        <div className="grid gap-5 xl:grid-cols-2">
                            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                <h3 className="text-base font-semibold text-slate-900">Ringkasan Produk yang Memakai Bahan Ini</h3>
                                <div className="mt-4 space-y-2">
                                    {(selected.product_breakdown || []).length === 0 ? (
                                        <EmptyState text="Tidak ada produk terjual yang memakai bahan ini pada periode filter." />
                                    ) : selected.product_breakdown.map((product) => (
                                        <div key={product.product_id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2">
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold text-slate-900">{product.product_name}</p>
                                                <p className="text-xs text-slate-500">{product.transaction_count} transaksi</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-indigo-700">{formatQty(product.estimated_usage, selectedUnit)}</p>
                                                <p className="text-xs text-slate-500">{formatQty(product.qty_porsi, 'porsi')}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                <h3 className="text-base font-semibold text-slate-900">Histori Cek Fisik</h3>
                                <div className="mt-4 space-y-2">
                                    {(selected.count_history || []).length === 0 ? (
                                        <EmptyState text="Belum ada cek fisik pada periode ini." />
                                    ) : selected.count_history.map((count) => (
                                        <div key={count.id} className="rounded-md border border-slate-200 px-3 py-2">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="font-semibold text-slate-900">{formatDate(count.date, true)}</p>
                                                <p className={`font-bold ${signedTone(count.difference)}`}>{formatQty(count.difference, selectedUnit)}</p>
                                            </div>
                                            <p className="mt-1 text-xs text-slate-500">Fisik {formatQty(count.counted_stock, selectedUnit)} | Sistem {formatQty(count.system_stock, selectedUnit)} | Oleh {count.counted_by}</p>
                                            {count.note && <p className="mt-1 text-sm text-slate-600">{count.note}</p>}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>

                        <div className="grid gap-5 xl:grid-cols-3">
                            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                <h3 className="text-base font-semibold text-slate-900">Detail Penjualan</h3>
                                <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
                                    {(selected.transaction_details || []).length === 0 ? (
                                        <EmptyState text="Tidak ada detail penjualan pada periode ini." />
                                    ) : selected.transaction_details.map((item, index) => (
                                        <div key={`${item.transaction_id}-${item.product_id}-${index}`} className="rounded-md border border-slate-200 px-3 py-2">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="font-semibold text-slate-900">{item.invoice_number}</p>
                                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{item.payment_status}</span>
                                            </div>
                                            <p className="mt-1 text-xs text-slate-500">{formatDate(item.date, true)}</p>
                                            <p className="mt-1 text-sm text-slate-700">{item.product_name}: {formatQty(item.qty_porsi, 'porsi')} x rasio {formatQty(item.conversion_ratio)} = <span className="font-semibold">{formatQty(item.estimated_usage, selectedUnit)}</span></p>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                <h3 className="text-base font-semibold text-slate-900">Detail Restock</h3>
                                <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
                                    {(selected.restock_details || []).length === 0 ? (
                                        <EmptyState text="Tidak ada restock pada periode ini." />
                                    ) : selected.restock_details.map((item) => (
                                        <div key={item.id} className="rounded-md border border-slate-200 px-3 py-2">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="font-semibold text-emerald-700">+{formatQty(item.qty_added, selectedUnit)}</p>
                                                <span className="text-xs text-slate-500">{item.fund_source}</span>
                                            </div>
                                            <p className="mt-1 text-xs text-slate-500">{formatDate(item.date, true)}</p>
                                            <p className="mt-1 text-sm text-slate-700">{formatQty(item.stock_before, selectedUnit)} menjadi {formatQty(item.stock_after, selectedUnit)}</p>
                                            {item.note && <p className="mt-1 text-sm text-slate-600">{item.note}</p>}
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                <h3 className="text-base font-semibold text-slate-900">Waste dan Movement</h3>
                                <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
                                    {(selected.waste_details || []).map((item) => (
                                        <div key={item.id} className="rounded-md border border-rose-100 bg-rose-50 px-3 py-2">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="font-semibold text-rose-700">-{formatQty(item.qty_biji, selectedUnit)}</p>
                                                <span className="text-xs font-semibold text-rose-600">{item.waste_type}</span>
                                            </div>
                                            <p className="mt-1 text-xs text-rose-600">{formatDate(item.date, true)} | {item.source_type}{item.product_name ? `: ${item.product_name}` : ''}</p>
                                            <p className="mt-1 text-sm text-rose-900">{item.reason}</p>
                                        </div>
                                    ))}
                                    {(selected.movement_details || []).map((item) => (
                                        <div key={item.id} className="rounded-md border border-slate-200 px-3 py-2">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="font-semibold text-slate-900">{item.type}</p>
                                                <p className={item.type === 'CANCEL_RESTORE' ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>
                                                    {item.type === 'CANCEL_RESTORE' ? '+' : '-'}{formatQty(item.qty, selectedUnit)}
                                                </p>
                                            </div>
                                            <p className="mt-1 text-xs text-slate-500">{formatDate(item.date, true)} | {item.invoice_number || 'Tanpa invoice'}</p>
                                        </div>
                                    ))}
                                    {(selected.waste_details || []).length === 0 && (selected.movement_details || []).length === 0 && (
                                        <EmptyState text="Tidak ada waste atau movement stok pada periode ini." />
                                    )}
                                </div>
                            </section>
                        </div>
                    </section>
                )}
            </div>
        </ErpLayout>
    );
}
