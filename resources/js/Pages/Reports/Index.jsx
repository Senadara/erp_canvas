import React, { useEffect, useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, router } from '@inertiajs/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
    ArrowTrendingUpIcon,
    CalendarDaysIcon,
    FunnelIcon,
    InformationCircleIcon,
    TrophyIcon,
} from '@heroicons/react/24/outline';

function formatRupiah(value) {
    const n = Number(value) || 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function formatNumber(value) {
    return new Intl.NumberFormat('id-ID').format(Number(value) || 0);
}

function formatDate(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(`${value}T00:00:00`));
}

function monthRange(year, month) {
    const pad = (value) => String(value).padStart(2, '0');
    const lastDay = new Date(Number(year), Number(month), 0).getDate();

    return {
        start: `${year}-${pad(month)}-01`,
        end: `${year}-${pad(month)}-${pad(lastDay)}`,
    };
}

export default function ReportsIndex({
    monthlyReport,
    dailySummary,
    revenue7Days,
    lowStockCount,
    currentMonth,
    currentYear,
    productPerformance = {},
}) {
    
    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const [productStart, setProductStart] = useState(productPerformance.start_date || '');
    const [productEnd, setProductEnd] = useState(productPerformance.end_date || '');
    const [selectedProductId, setSelectedProductId] = useState(productPerformance.selected_product_id || '');
    const invalidProductRange = Boolean(productStart && productEnd && productEnd < productStart);

    useEffect(() => {
        setProductStart(productPerformance.start_date || '');
        setProductEnd(productPerformance.end_date || '');
        setSelectedProductId(productPerformance.selected_product_id || '');
    }, [
        productPerformance.start_date,
        productPerformance.end_date,
        productPerformance.selected_product_id,
    ]);

    const loadReport = (params) => {
        router.get(route('reports'), params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const handleMonthChange = (e) => {
        const month = Number(e.target.value);
        const range = monthRange(currentYear, month);
        loadReport({
            month,
            year: currentYear,
            product_start: range.start,
            product_end: range.end,
            product_id: selectedProductId || undefined,
        });
    };

    const handleYearChange = (e) => {
        const year = Number(e.target.value);
        const range = monthRange(year, currentMonth);
        loadReport({
            month: currentMonth,
            year,
            product_start: range.start,
            product_end: range.end,
            product_id: selectedProductId || undefined,
        });
    };

    const applyProductFilter = () => {
        if (invalidProductRange) return;

        loadReport({
            month: currentMonth,
            year: currentYear,
            product_start: productStart,
            product_end: productEnd,
            product_id: selectedProductId || undefined,
        });
    };

    const ranking = productPerformance.ranking || [];
    const selectedProduct = productPerformance.selected_product;

    return (
        <ErpLayout title="Laporan & Analisis">
            <Head title="Laporan" />

            <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <h1 className="text-2xl font-semibold text-slate-900">Laporan & Analisis</h1>
                <div className="flex gap-2">
                    <select value={currentMonth} onChange={handleMonthChange} className="min-w-0 flex-1 rounded-md border-slate-300 text-sm sm:flex-none">
                        {months.map((m, idx) => (
                            <option key={idx} value={idx + 1}>{m}</option>
                        ))}
                    </select>
                    <select value={currentYear} onChange={handleYearChange} className="rounded-md border-slate-300 text-sm">
                        {[2024, 2025, 2026].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-medium text-slate-500 mb-1">Omzet Bulanan</h3>
                    <p className="text-2xl font-bold text-slate-900">{formatRupiah(monthlyReport.omzet)}</p>
                    <p className="text-xs text-slate-400 mt-1">{monthlyReport.transactionCount} Transaksi</p>
                </div>
                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-medium text-slate-500 mb-1">HPP Bulanan</h3>
                    <p className="text-2xl font-bold text-rose-600">{formatRupiah(monthlyReport.hpp)}</p>
                </div>
                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-medium text-slate-500 mb-1">Pengeluaran Kas Bulanan</h3>
                    <p className="text-2xl font-bold text-rose-600">{formatRupiah(monthlyReport.pengeluaran)}</p>
                </div>
                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-medium text-slate-500 mb-1">Laba Bersih (Estimasi)</h3>
                    <p className={`text-2xl font-bold ${monthlyReport.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatRupiah(monthlyReport.netProfit)}
                    </p>
                </div>
            </div>

            <section className="mb-10" aria-labelledby="product-performance-title">
                <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                    <div>
                        <h2 id="product-performance-title" className="text-lg font-semibold text-slate-900">Performa Produk</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {formatDate(productPerformance.start_date)} - {formatDate(productPerformance.end_date)}
                        </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500" title="Profit kotor estimasi dihitung dari subtotal penjualan dikurangi HPP produk saat ini.">
                        <InformationCircleIcon className="h-4 w-4" />
                        <span>Profit kotor estimasi</span>
                    </div>
                </div>

                <div className="mb-5 grid gap-3 border-y border-slate-200 bg-slate-50 px-3 py-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.35fr_auto] lg:items-end">
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Mulai</span>
                        <input
                            type="date"
                            value={productStart}
                            onChange={(event) => setProductStart(event.target.value)}
                            className="h-10 w-full rounded-md border-slate-300 text-sm focus:border-brand-500 focus:ring-brand-500"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Sampai</span>
                        <input
                            type="date"
                            value={productEnd}
                            min={productStart || undefined}
                            onChange={(event) => setProductEnd(event.target.value)}
                            className={`h-10 w-full rounded-md text-sm focus:ring-brand-500 ${invalidProductRange ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-brand-500'}`}
                        />
                    </label>
                    <label className="block sm:col-span-2 lg:col-span-1">
                        <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Detail Produk</span>
                        <select
                            value={selectedProductId}
                            onChange={(event) => setSelectedProductId(event.target.value)}
                            className="h-10 w-full rounded-md border-slate-300 text-sm focus:border-brand-500 focus:ring-brand-500"
                        >
                            <option value="">Pilih produk</option>
                            {(productPerformance.products || []).map((product) => (
                                <option key={product.id} value={product.id}>
                                    {product.name}{product.is_active ? '' : ' (Nonaktif)'}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button
                        type="button"
                        onClick={applyProductFilter}
                        disabled={invalidProductRange || !productStart || !productEnd}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                        <FunnelIcon className="h-4 w-4" />
                        Terapkan
                    </button>
                    {invalidProductRange && (
                        <p className="text-xs font-medium text-rose-600 sm:col-span-2 lg:col-span-4">
                            Tanggal akhir tidak boleh sebelum tanggal mulai.
                        </p>
                    )}
                </div>

                <div className="mb-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <span className="text-sm font-semibold text-amber-900">Produk Paling Laris</span>
                            <TrophyIcon className="h-6 w-6 text-amber-600" />
                        </div>
                        {productPerformance.best_seller ? (
                            <>
                                <p className="truncate text-xl font-bold text-slate-900">{productPerformance.best_seller.name}</p>
                                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                                    <span className="font-semibold text-amber-800">{formatNumber(productPerformance.best_seller.quantity_sold)} porsi</span>
                                    <span className="text-slate-600">{formatRupiah(productPerformance.best_seller.revenue)}</span>
                                </div>
                            </>
                        ) : (
                            <p className="text-sm text-slate-500">Belum ada penjualan pada periode ini.</p>
                        )}
                    </div>

                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <span className="text-sm font-semibold text-emerald-900">Profit Kotor Terbesar</span>
                            <ArrowTrendingUpIcon className="h-6 w-6 text-emerald-600" />
                        </div>
                        {productPerformance.most_profitable ? (
                            <>
                                <p className="truncate text-xl font-bold text-slate-900">{productPerformance.most_profitable.name}</p>
                                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                                    <span className="font-semibold text-emerald-700">{formatRupiah(productPerformance.most_profitable.gross_profit)}</span>
                                    <span className="text-slate-600">Margin {productPerformance.most_profitable.margin_percent}%</span>
                                </div>
                            </>
                        ) : (
                            <p className="text-sm text-slate-500">Belum ada profit yang dapat dihitung.</p>
                        )}
                    </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                        <h3 className="font-semibold text-slate-900">Peringkat Produk</h3>
                        <span className="text-xs text-slate-500">{ranking.length} produk terjual</span>
                    </div>
                    {ranking.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-[760px] w-full text-sm">
                                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="w-16 px-4 py-3 text-center">Peringkat</th>
                                        <th className="px-4 py-3">Produk</th>
                                        <th className="px-4 py-3 text-right">Terjual</th>
                                        <th className="px-4 py-3 text-right">Transaksi</th>
                                        <th className="px-4 py-3 text-right">Omzet</th>
                                        <th className="px-4 py-3 text-right">Profit Kotor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {ranking.map((product, index) => (
                                        <tr key={product.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 text-center font-semibold text-slate-500">{index + 1}</td>
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-slate-900">{product.name}</div>
                                                {!product.is_active && <span className="text-xs text-slate-400">Nonaktif</span>}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">{formatNumber(product.quantity_sold)} porsi</td>
                                            <td className="px-4 py-3 text-right text-slate-600">{formatNumber(product.transaction_count)}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">{formatRupiah(product.revenue)}</td>
                                            <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${product.gross_profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                                {formatRupiah(product.gross_profit)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="px-4 py-12 text-center text-sm text-slate-500">Belum ada produk terjual pada rentang tanggal ini.</div>
                    )}
                </div>

                {selectedProduct && (
                    <div className="mt-6">
                        <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-base font-semibold text-slate-900">{selectedProduct.name}</h3>
                                    {!selectedProduct.is_active && (
                                        <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">Nonaktif</span>
                                    )}
                                </div>
                                <p className="mt-1 text-sm text-slate-500">Rincian penjualan per tanggal</p>
                            </div>
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                <CalendarDaysIcon className="h-5 w-5 text-brand-600" />
                                {formatNumber(selectedProduct.summary.quantity_sold)} porsi dari {formatNumber(selectedProduct.summary.transaction_count)} transaksi
                            </div>
                        </div>

                        <div className="mb-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 lg:grid-cols-4">
                            {[
                                ['Total Terjual', `${formatNumber(selectedProduct.summary.quantity_sold)} porsi`],
                                ['Total Penjualan', formatRupiah(selectedProduct.summary.revenue)],
                                ['Estimasi HPP', formatRupiah(selectedProduct.summary.estimated_hpp)],
                                ['Profit Kotor', formatRupiah(selectedProduct.summary.gross_profit)],
                            ].map(([label, value]) => (
                                <div key={label} className="min-w-0 bg-white px-4 py-3">
                                    <p className="truncate text-xs font-medium text-slate-500">{label}</p>
                                    <p className="mt-1 truncate text-base font-bold text-slate-900" title={value}>{value}</p>
                                </div>
                            ))}
                        </div>

                        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                            {selectedProduct.daily_sales.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-[680px] w-full text-sm">
                                        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                                            <tr>
                                                <th className="px-4 py-3">Tanggal Penjualan</th>
                                                <th className="px-4 py-3 text-right">Terjual</th>
                                                <th className="px-4 py-3 text-right">Transaksi</th>
                                                <th className="px-4 py-3 text-right">Total Penjualan</th>
                                                <th className="px-4 py-3 text-right">Profit Kotor</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {selectedProduct.daily_sales.map((day) => (
                                                <tr key={day.date} className="hover:bg-slate-50">
                                                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{formatDate(day.date)}</td>
                                                    <td className="whitespace-nowrap px-4 py-3 text-right">{formatNumber(day.quantity_sold)} porsi</td>
                                                    <td className="px-4 py-3 text-right text-slate-600">{formatNumber(day.transaction_count)}</td>
                                                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">{formatRupiah(day.revenue)}</td>
                                                    <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${day.gross_profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                                        {formatRupiah(day.gross_profit)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="px-4 py-12 text-center text-sm text-slate-500">Produk ini belum terjual pada rentang tanggal yang dipilih.</div>
                            )}
                        </div>
                    </div>
                )}
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4 border-b pb-2">Ringkasan Hari Ini</h2>
                    <ul className="space-y-3 text-sm">
                        <li className="flex justify-between">
                            <span className="text-slate-500">Total Penjualan</span>
                            <span className="font-semibold text-slate-900">{formatRupiah(dailySummary.totalSales)}</span>
                        </li>
                        <li className="flex justify-between">
                            <span className="text-slate-500">Tunai</span>
                            <span className="font-medium text-slate-700">{formatRupiah(dailySummary.cashSales)}</span>
                        </li>
                        <li className="flex justify-between">
                            <span className="text-slate-500">QRIS</span>
                            <span className="font-medium text-slate-700">{formatRupiah(dailySummary.qrisSales)}</span>
                        </li>
                        <li className="flex justify-between">
                            <span className="text-slate-500">Jumlah Transaksi</span>
                            <span className="font-medium text-slate-700">{dailySummary.transactionCount}</span>
                        </li>
                        <li className="flex justify-between text-rose-600 border-t pt-2 mt-2">
                            <span>Pengeluaran Hari Ini</span>
                            <span className="font-semibold">{formatRupiah(dailySummary.expenses)}</span>
                        </li>
                    </ul>
                </div>

                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4 border-b pb-2">Peringatan Operasional</h2>
                    <div className="flex items-center gap-4 bg-rose-50 p-4 rounded-md border border-rose-100 mb-4">
                        <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold text-xl">
                            !
                        </div>
                        <div>
                            <h3 className="font-semibold text-rose-800">Stok Menipis</h3>
                            <p className="text-sm text-rose-600 mt-1">Terdapat <strong>{lowStockCount}</strong> bahan baku yang stoknya di bawah batas aman.</p>
                            <button onClick={() => router.get(route('stock'))} className="text-xs font-medium bg-rose-600 text-white px-3 py-1 rounded mt-2 hover:bg-rose-700">Cek Stok</button>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-medium text-slate-700 mb-4">Penjualan 7 Hari Terakhir (Rp)</h3>
                        <div className="h-64 w-full">
                            {revenue7Days && revenue7Days.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={revenue7Days.map(d => ({...d, name: d.date.substring(5), cash: Number(d.cash), qris: Number(d.qris)}))} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fontSize: 12, fill: '#64748b' }}
                                            tickFormatter={(val) => `Rp${val >= 1000000 ? (val/1000000).toFixed(1) + 'M' : val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
                                        />
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            formatter={(value) => [formatRupiah(value)]}
                                            cursor={{ fill: '#f8fafc' }}
                                        />
                                        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                                        <Bar dataKey="cash" name="Tunai" stackId="a" fill="#6366f1" radius={[0, 0, 4, 4]} />
                                        <Bar dataKey="qris" name="QRIS" stackId="a" fill="#c7d2fe" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400 text-sm">Belum ada data penjualan</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </ErpLayout>
    );
}
