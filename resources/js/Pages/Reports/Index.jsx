import React, { useEffect, useMemo, useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, router } from '@inertiajs/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import {
    ArrowTrendingUpIcon,
    CalendarDaysIcon,
    ChartBarIcon,
    ClipboardDocumentListIcon,
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
    const [chartMetric, setChartMetric] = useState('quantity_sold');
    const [chartLimit, setChartLimit] = useState(10);
    const [chartSort, setChartSort] = useState('DESC');
    const [chartOrientation, setChartOrientation] = useState('horizontal');
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

    const chartData = useMemo(() => {
        let items = [...ranking];
        items.sort((a, b) => {
            const valA = Number(a[chartMetric]) || 0;
            const valB = Number(b[chartMetric]) || 0;
            return chartSort === 'DESC' ? valB - valA : valA - valB;
        });
        if (chartLimit < 999) {
            items = items.slice(0, chartLimit);
        }
        return items.map((item) => ({
            name: item.name,
            quantity_sold: Number(item.quantity_sold) || 0,
            revenue: Number(item.revenue) || 0,
            gross_profit: Number(item.gross_profit) || 0,
            value: Number(item[chartMetric]) || 0,
            shortName: item.name.length > 16 ? item.name.slice(0, 14) + '...' : item.name,
        }));
    }, [ranking, chartMetric, chartLimit, chartSort]);

    const metricTitle = (metric) => {
        if (metric === 'quantity_sold') return 'Porsi Terjual';
        if (metric === 'revenue') return 'Omzet Penjualan';
        if (metric === 'gross_profit') return 'Profit Kotor';
        return '';
    };

    const metricFormat = (val) => {
        if (chartMetric === 'quantity_sold') return `${formatNumber(val)} porsi`;
        return formatRupiah(val);
    };

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

            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4 mb-8">
                <div className="bg-white p-3.5 sm:p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-xs sm:text-sm font-medium text-slate-500 mb-1">Omzet Bulanan</h3>
                    <p className="text-lg sm:text-2xl font-bold text-slate-900">{formatRupiah(monthlyReport.omzet)}</p>
                    <p className="text-[11px] sm:text-xs text-slate-400 mt-1">{monthlyReport.transactionCount} Transaksi</p>
                </div>
                <div className="bg-white p-3.5 sm:p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-xs sm:text-sm font-medium text-slate-500 mb-1">HPP Bulanan</h3>
                    <p className="text-lg sm:text-2xl font-bold text-rose-600">{formatRupiah(monthlyReport.hpp)}</p>
                </div>
                <div className="bg-white p-3.5 sm:p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-xs sm:text-sm font-medium text-slate-500 mb-1">Pengeluaran Kas Bulanan</h3>
                    <p className="text-lg sm:text-2xl font-bold text-rose-600">{formatRupiah(monthlyReport.pengeluaran)}</p>
                </div>
                <div className="bg-white p-3.5 sm:p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-xs sm:text-sm font-medium text-slate-500 mb-1">Laba Bersih (Estimasi)</h3>
                    <p className={`text-lg sm:text-2xl font-bold ${monthlyReport.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatRupiah(monthlyReport.netProfit)}
                    </p>
                </div>
            </div>

            <section className="mb-10 rounded-lg border border-indigo-200 bg-indigo-50 p-5" aria-labelledby="e-settlement-entry-title">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="max-w-2xl">
                        <h2 id="e-settlement-entry-title" className="text-lg font-semibold text-slate-900">E-Settlement Keuangan</h2>
                        <p className="mt-1 text-sm leading-relaxed text-indigo-900">
                            Buka halaman khusus untuk melihat rekap penjualan, cash net, QRIS net, uang masuk, uang keluar, kategori keuangan, histori mutasi, dan cetak PDF sesuai periode.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => router.get(route('reports.e-settlement'))}
                        className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                        <ClipboardDocumentListIcon className="h-4 w-4" />
                        Buka E-Settlement
                    </button>
                </div>
            </section>

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

                {/* Grafik Penjualan Produk yang Bisa Dikustomisasi */}
                <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-2.5">
                            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                                <ChartBarIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-slate-900">Grafik Penjualan Produk</h3>
                                <p className="text-xs text-slate-500">
                                    Visualisasi komparasi performa menu produk berdasarkan {metricTitle(chartMetric).toLowerCase()}.
                                </p>
                            </div>
                        </div>

                        {/* Kontrol Kustomisasi Grafik */}
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Pilihan Metrik */}
                            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
                                {[
                                    ['quantity_sold', 'Porsi Terjual'],
                                    ['revenue', 'Omzet (Rp)'],
                                    ['gross_profit', 'Profit Kotor'],
                                ].map(([mKey, mLabel]) => (
                                    <button
                                        key={mKey}
                                        type="button"
                                        onClick={() => setChartMetric(mKey)}
                                        className={`rounded-md px-2.5 py-1.5 transition ${
                                            chartMetric === mKey
                                                ? 'bg-white text-indigo-700 shadow-sm font-semibold'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        {mLabel}
                                    </button>
                                ))}
                            </div>

                            {/* Pilihan Top N Limit */}
                            <select
                                value={chartLimit}
                                onChange={(e) => setChartLimit(Number(e.target.value))}
                                className="h-8 rounded-lg border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:ring-indigo-500"
                            >
                                <option value={5}>Top 5</option>
                                <option value={10}>Top 10</option>
                                <option value={15}>Top 15</option>
                                <option value={999}>Semua</option>
                            </select>

                            {/* Pilihan Urutan */}
                            <select
                                value={chartSort}
                                onChange={(e) => setChartSort(e.target.value)}
                                className="h-8 rounded-lg border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:ring-indigo-500"
                            >
                                <option value="DESC">Tertinggi</option>
                                <option value="ASC">Terendah</option>
                            </select>

                            {/* Pilihan Orientasi */}
                            <button
                                type="button"
                                onClick={() => setChartOrientation(chartOrientation === 'horizontal' ? 'vertical' : 'horizontal')}
                                className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                title="Ganti Orientasi Grafik"
                            >
                                {chartOrientation === 'horizontal' ? 'Mode Vertikal' : 'Mode Horizontal'}
                            </button>
                        </div>
                    </div>

                    {/* Area Render Chart */}
                    <div className="mt-4">
                        {chartData.length === 0 ? (
                            <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
                                Belum ada data penjualan produk pada rentang tanggal ini.
                            </div>
                        ) : chartOrientation === 'horizontal' ? (
                            <div style={{ height: `${Math.max(280, chartData.length * 38)}px` }} className="w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        layout="vertical"
                                        data={chartData}
                                        margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                        <XAxis
                                            type="number"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 11, fill: '#64748b' }}
                                            tickFormatter={(val) => chartMetric === 'quantity_sold' ? `${val}` : `Rp${val >= 1000000 ? (val / 1000000).toFixed(1) + 'M' : val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            width={110}
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 11, fill: '#334155' }}
                                        />
                                        <Tooltip
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const d = payload[0].payload;
                                                    return (
                                                        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs">
                                                            <p className="font-bold text-slate-900 mb-1.5">{d.name}</p>
                                                            <p className="text-slate-600">
                                                                Porsi Terjual: <strong className="text-slate-900">{formatNumber(d.quantity_sold)} porsi</strong>
                                                            </p>
                                                            <p className="text-slate-600">
                                                                Omzet: <strong className="text-indigo-600">{formatRupiah(d.revenue)}</strong>
                                                            </p>
                                                            <p className="text-slate-600">
                                                                Profit Kotor: <strong className="text-emerald-600">{formatRupiah(d.gross_profit)}</strong>
                                                            </p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24}>
                                            {chartData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={
                                                        chartMetric === 'gross_profit'
                                                            ? '#059669'
                                                            : chartMetric === 'revenue'
                                                            ? '#4f46e5'
                                                            : '#0284c7'
                                                    }
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-72 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={chartData}
                                        margin={{ top: 10, right: 10, left: -15, bottom: 25 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="shortName"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fill: '#64748b' }}
                                            interval={0}
                                            angle={-30}
                                            textAnchor="end"
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fill: '#64748b' }}
                                            tickFormatter={(val) => chartMetric === 'quantity_sold' ? `${val}` : `Rp${val >= 1000000 ? (val / 1000000).toFixed(1) + 'M' : val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`}
                                        />
                                        <Tooltip
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const d = payload[0].payload;
                                                    return (
                                                        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs">
                                                            <p className="font-bold text-slate-900 mb-1.5">{d.name}</p>
                                                            <p className="text-slate-600">
                                                                Porsi Terjual: <strong className="text-slate-900">{formatNumber(d.quantity_sold)} porsi</strong>
                                                            </p>
                                                            <p className="text-slate-600">
                                                                Omzet: <strong className="text-indigo-600">{formatRupiah(d.revenue)}</strong>
                                                            </p>
                                                            <p className="text-slate-600">
                                                                Profit Kotor: <strong className="text-emerald-600">{formatRupiah(d.gross_profit)}</strong>
                                                            </p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={36}>
                                            {chartData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={
                                                        chartMetric === 'gross_profit'
                                                            ? '#059669'
                                                            : chartMetric === 'revenue'
                                                            ? '#4f46e5'
                                                            : '#0284c7'
                                                    }
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
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
