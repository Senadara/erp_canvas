import { useEffect, useMemo, useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    ArrowPathIcon,
    BookmarkSquareIcon,
    CalculatorIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    FunnelIcon,
    LockClosedIcon,
    Squares2X2Icon,
} from '@heroicons/react/24/outline';

function formatRupiah(value) {
    const n = Number(value) || 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function formatPercent(value) {
    return `${Number(value || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`;
}

function categoryLabel(category) {
    if (category === 'PACKAGING') return 'Kemasan';
    if (category === 'SUPPLY') return 'Supply';
    return 'Bahan';
}

function hppSourceLabel(source) {
    if (source === 'FIXED_MANUAL') return 'HPP Fix';
    if (source === 'BOM_LATEST') return 'BOM otomatis';
    if (source === 'LEGACY_MANUAL') return 'Manual lama';
    return 'Manual fallback';
}

function monthEndDate(monthValue) {
    if (!monthValue) return '';
    const [year, month] = monthValue.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();

    return `${monthValue}-${String(lastDay).padStart(2, '0')}`;
}

export default function ProductCostsIndex({ outlet, filters, report }) {
    const { auth } = usePage().props;
    const isOwner = auth.user.role === 'OWNER';
    const [startDate, setStartDate] = useState(filters.start_date);
    const [endDate, setEndDate] = useState(filters.end_date);
    const [customSalaryTotal, setCustomSalaryTotal] = useState(filters.salary_total ?? '');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [query, setQuery] = useState('');
    const [selectedProductId, setSelectedProductId] = useState(report.products?.[0]?.id || '');
    const [simulatedPrice, setSimulatedPrice] = useState(report.products?.[0]?.price || 0);
    const [fixedHppValue, setFixedHppValue] = useState(report.products?.[0]?.effective_hpp || 0);
    const [savingFixedHpp, setSavingFixedHpp] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        stock_item_id: '',
        product_ids: [],
        ratio: '1',
        items: [],
    });

    const products = report.products || [];
    const componentStocks = report.component_stocks || report.packaging_stocks || [];
    const selectedProduct = products.find((product) => product.id === selectedProductId) || products[0];
    const payrollEvaluation = report.payroll_evaluation || {};
    const periodMonth = startDate ? startDate.slice(0, 7) : '';
    const simulationCost = Number(selectedProduct?.effective_hpp || 0);
    const laborCostPerPortion = Number(payrollEvaluation.labor_cost_per_portion || 0);
    const simulationCostWithLabor = simulationCost + laborCostPerPortion;
    const simulationMargin = Number(simulatedPrice || 0) - simulationCostWithLabor;
    const simulationMarginPercent = Number(simulatedPrice || 0) > 0
        ? (simulationMargin / Number(simulatedPrice)) * 100
        : 0;

    useEffect(() => {
        if (!selectedProduct) {
            setFixedHppValue(0);
            return;
        }

        setFixedHppValue(Math.round(Number(selectedProduct.effective_hpp || 0) + laborCostPerPortion));
    }, [selectedProduct?.id, selectedProduct?.effective_hpp, laborCostPerPortion]);

    const filteredProducts = useMemo(() => {
        return products.filter((product) => {
            const text = [product.name, product.category, product.display_group?.name].filter(Boolean).join(' ').toLowerCase();
            const matchesText = text.includes(query.trim().toLowerCase());
            const matchesStatus =
                statusFilter === 'ALL'
                || (statusFilter === 'WARNINGS' && product.cost_warnings?.length > 0)
                || (statusFilter === 'COMPLETE' && (!product.cost_warnings || product.cost_warnings.length === 0))
                || (statusFilter === 'ACTIVE' && product.is_active);

            return matchesText && matchesStatus;
        });
    }, [products, query, statusFilter]);

    const applyDateFilter = (event) => {
        event.preventDefault();
        const params = {
            start_date: startDate,
            end_date: endDate,
        };

        if (customSalaryTotal !== '' && customSalaryTotal !== null) {
            params.salary_total = customSalaryTotal;
        }

        router.get(route('product-costs'), params, { preserveScroll: true });
    };

    const applyMonthFilter = (monthValue) => {
        setStartDate(monthValue ? `${monthValue}-01` : '');
        setEndDate(monthEndDate(monthValue));
    };

    const saveFixedHpp = (mode = 'FIXED') => {
        if (!selectedProduct?.id) return;

        router.put(route('product-costs.fixed-hpp', selectedProduct.id), {
            hpp: mode === 'FIXED' ? Number(fixedHppValue || 0) : Number(selectedProduct.manual_hpp || selectedProduct.effective_hpp || 0),
            hpp_mode: mode,
        }, {
            preserveScroll: true,
            onStart: () => setSavingFixedHpp(true),
            onFinish: () => setSavingFixedHpp(false),
        });
    };

    const toggleProduct = (productId) => {
        const isSelected = data.product_ids.includes(productId);
        const selected = isSelected
            ? data.product_ids.filter((id) => id !== productId)
            : [...data.product_ids, productId];
        const rows = isSelected
            ? (data.items || []).filter((row) => row.product_id !== productId)
            : [
                ...(data.items || []),
                {
                    product_id: productId,
                    stock_item_id: data.stock_item_id || componentStocks[0]?.id || '',
                    ratio: data.ratio || '1',
                },
            ];

        setData({ ...data, product_ids: selected, items: rows });
    };

    const updateBulkRow = (productId, field, value) => {
        const rows = (data.items || []).map((row) => (
            row.product_id === productId ? { ...row, [field]: value } : row
        ));
        setData('items', rows);
    };

    const applyDefaultsToRows = () => {
        const rows = (data.items || []).map((row) => ({
            ...row,
            stock_item_id: data.stock_item_id || row.stock_item_id,
            ratio: data.ratio || row.ratio,
        }));
        setData('items', rows);
    };

    const submitBulk = (event) => {
        event.preventDefault();
        post(route('product-costs.bulk-components'), {
            preserveScroll: true,
            onSuccess: () => reset(),
        });
    };

    return (
        <ErpLayout title="Biaya Produk">
            <Head title="Biaya Produk" />

            <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Biaya Produk</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        {outlet?.name || 'Outlet'} · HPP otomatis dari BOM, kemasan, dan snapshot transaksi.
                    </p>
                </div>
                <form onSubmit={applyDateFilter} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[150px_150px_150px_180px_auto] lg:items-end">
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-500">Bulan</span>
                        <input
                            type="month"
                            value={periodMonth}
                            onChange={(event) => applyMonthFilter(event.target.value)}
                            className="h-10 w-full rounded-lg border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-500">Dari</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(event) => setStartDate(event.target.value)}
                            className="h-10 w-full rounded-lg border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-500">Sampai</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(event) => setEndDate(event.target.value)}
                            className="h-10 w-full rounded-lg border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-500">Gaji Custom</span>
                        <input
                            type="number"
                            min="0"
                            value={customSalaryTotal}
                            onChange={(event) => setCustomSalaryTotal(event.target.value)}
                            placeholder="Pakai data gaji"
                            className="h-10 w-full rounded-lg border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                    </label>
                    <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700">
                        <FunnelIcon className="h-4 w-4" />
                        Terapkan
                    </button>
                </form>
            </div>

            <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                    ['Produk', report.summary.product_count, 'Total menu yang dihitung'],
                    ['Aktif', report.summary.active_count, 'Tampil di kasir'],
                    ['Perlu Dicek', report.summary.needs_attention_count, 'BOM, harga, atau kemasan belum lengkap'],
                    ['Margin Rata-rata', formatPercent(report.summary.average_margin_percent), 'Berdasarkan HPP aktif'],
                ].map(([label, value, note]) => (
                    <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
                        <p className="mt-1 text-xs text-slate-500">{note}</p>
                    </div>
                ))}
            </div>

            <section className="mb-5 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                    <div className="xl:col-span-2">
                        <p className="text-xs font-semibold uppercase text-indigo-700">Evaluasi Gaji Periode</p>
                        <p className="mt-2 text-sm text-indigo-900">
                            Gaji tidak masuk HPP utama, tetapi dipakai untuk membaca profit operasional setelah alokasi gaji.
                        </p>
                        {payrollEvaluation.custom_salary_enabled && (
                            <span className="mt-3 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                                Memakai gaji custom
                            </span>
                        )}
                    </div>
                    {[
                        ['Gaji Tercatat', formatRupiah(payrollEvaluation.recorded_salary_total ?? payrollEvaluation.salary_total)],
                        [payrollEvaluation.custom_salary_enabled ? 'Gaji Dipakai' : 'Total Gaji', formatRupiah(payrollEvaluation.salary_total)],
                        ['Porsi Terjual', Number(payrollEvaluation.sold_portions || 0).toLocaleString('id-ID')],
                        ['Gaji per Porsi', formatRupiah(payrollEvaluation.labor_cost_per_portion)],
                    ].map(([label, value]) => (
                        <div key={label}>
                            <p className="text-xs font-semibold uppercase text-indigo-600">{label}</p>
                            <p className="mt-2 text-xl font-bold text-indigo-950">{value}</p>
                        </div>
                    ))}
                </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
                <section className="space-y-4">
                    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                <Squares2X2Icon className="h-5 w-5 text-slate-400" />
                                Ringkasan Produk
                            </div>
                            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px] lg:w-[560px]">
                                <input
                                    type="search"
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Cari produk atau kategori"
                                    className="h-10 rounded-lg border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                                <select
                                    value={statusFilter}
                                    onChange={(event) => setStatusFilter(event.target.value)}
                                    className="h-10 rounded-lg border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    <option value="ALL">Semua status</option>
                                    <option value="ACTIVE">Produk aktif</option>
                                    <option value="WARNINGS">Perlu dicek</option>
                                    <option value="COMPLETE">Formula lengkap</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-3">
                        {filteredProducts.map((product) => (
                            <article key={product.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="font-semibold text-slate-900">{product.name}</h2>
                                            {product.cost_warnings?.length > 0 ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                                                    <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                                                    Perlu dicek
                                                </span>
                                            ) : product.uses_fixed_hpp ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                                                    <LockClosedIcon className="h-3.5 w-3.5" />
                                                    HPP Fix
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                                                    <CheckCircleIcon className="h-3.5 w-3.5" />
                                                    Lengkap
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 text-sm text-slate-500">{product.category}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:min-w-[520px]">
                                        <div>
                                            <p className="text-xs font-semibold uppercase text-slate-400">Harga</p>
                                            <p className="mt-1 font-bold text-slate-900">{formatRupiah(product.price)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase text-slate-400">HPP BOM</p>
                                            <p className="mt-1 font-bold text-rose-700">{formatRupiah(product.material_hpp)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase text-slate-400">HPP Aktif</p>
                                            <p className="mt-1 font-bold text-slate-900">{formatRupiah(product.effective_hpp)}</p>
                                            <p className="mt-1 text-xs font-medium text-slate-500">{hppSourceLabel(product.hpp_source)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase text-slate-400">Margin</p>
                                            <p className={`mt-1 font-bold ${product.margin_amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                {formatRupiah(product.margin_amount)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {product.cost_warnings?.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {product.cost_warnings.map((warning) => (
                                            <span key={warning} className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                                                {warning}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="mt-4 overflow-x-auto">
                                    <table className="w-full min-w-[640px] text-left text-xs">
                                        <thead className="border-b border-slate-200 text-slate-500">
                                            <tr>
                                                <th className="py-2 pr-3 font-semibold">Komponen</th>
                                                <th className="py-2 pr-3 font-semibold">Kategori</th>
                                                <th className="py-2 pr-3 text-right font-semibold">Rasio</th>
                                                <th className="py-2 pr-3 text-right font-semibold">Biaya Satuan</th>
                                                <th className="py-2 text-right font-semibold">Biaya/Porsi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700">
                                            {product.components.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" className="py-3 text-center text-slate-400">BOM belum diisi.</td>
                                                </tr>
                                            ) : product.components.map((component) => (
                                                <tr key={component.conversion_id || component.stock_item_id}>
                                                    <td className="py-2 pr-3 font-medium">{component.name}</td>
                                                    <td className="py-2 pr-3">{categoryLabel(component.cost_category)}</td>
                                                    <td className="py-2 pr-3 text-right">{Number(component.ratio).toLocaleString('id-ID')} {component.unit_name}</td>
                                                    <td className="py-2 pr-3 text-right">{formatRupiah(component.unit_cost)}</td>
                                                    <td className="py-2 text-right font-semibold">{formatRupiah(component.component_cost)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                <aside className="space-y-4">
                    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-2">
                            <CalculatorIcon className="h-5 w-5 text-amber-500" />
                            <h2 className="font-semibold text-slate-900">Simulasi HPP + Gaji</h2>
                        </div>
                        <div className="mt-4 space-y-3">
                            <label className="block">
                                <span className="mb-1 block text-sm font-medium text-slate-700">Produk</span>
                                <select
                                    value={selectedProduct?.id || ''}
                                    onChange={(event) => {
                                        const next = products.find((product) => product.id === event.target.value);
                                        setSelectedProductId(event.target.value);
                                        setSimulatedPrice(next?.price || 0);
                                    }}
                                    className="w-full rounded-lg border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    {products.map((product) => (
                                        <option key={product.id} value={product.id}>{product.name}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-sm font-medium text-slate-700">Harga Simulasi</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={simulatedPrice}
                                    onChange={(event) => setSimulatedPrice(event.target.value)}
                                    className="w-full rounded-lg border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </label>
                            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
                                <div className="bg-slate-50 p-3">
                                    <p className="text-xs text-slate-500">HPP Produk</p>
                                    <p className="mt-1 font-bold text-slate-900">{formatRupiah(simulationCost)}</p>
                                </div>
                                <div className="bg-amber-50 p-3">
                                    <p className="text-xs text-amber-700">Gaji/Porsi</p>
                                    <p className="mt-1 font-bold text-amber-800">{formatRupiah(laborCostPerPortion)}</p>
                                </div>
                                <div className="bg-slate-50 p-3">
                                    <p className="text-xs text-slate-500">HPP + Gaji</p>
                                    <p className="mt-1 font-bold text-slate-900">{formatRupiah(simulationCostWithLabor)}</p>
                                </div>
                                <div className="bg-slate-50 p-3">
                                    <p className="text-xs text-slate-500">Margin Simulasi</p>
                                    <p className={`mt-1 font-bold ${simulationMargin >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                        {formatRupiah(simulationMargin)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-slate-700">
                                <span>Margin {formatPercent(simulationMarginPercent)}</span>
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                                    {hppSourceLabel(selectedProduct?.hpp_source)}
                                </span>
                            </div>

                            {isOwner && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                                <div className="mb-3 flex items-center gap-2">
                                    <LockClosedIcon className="h-4 w-4 text-amber-700" />
                                    <p className="text-sm font-semibold text-amber-900">HPP Fix</p>
                                </div>
                                <label className="block">
                                    <span className="mb-1 block text-xs font-semibold text-amber-800">Nilai HPP Fix</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={fixedHppValue}
                                        onChange={(event) => setFixedHppValue(event.target.value)}
                                        className="h-10 w-full rounded-lg border-amber-200 text-sm focus:border-amber-500 focus:ring-amber-500"
                                    />
                                </label>
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    <button
                                        type="button"
                                        onClick={() => saveFixedHpp('FIXED')}
                                        disabled={savingFixedHpp || !selectedProduct || Number(fixedHppValue) < 0}
                                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:bg-slate-300"
                                    >
                                        <BookmarkSquareIcon className="h-4 w-4" />
                                        {selectedProduct?.uses_fixed_hpp ? 'Update Fix' : 'Simpan Fix'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => saveFixedHpp('AUTO')}
                                        disabled={savingFixedHpp || !selectedProduct || !selectedProduct?.uses_fixed_hpp}
                                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-white px-3 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-white"
                                    >
                                        <ArrowPathIcon className="h-4 w-4" />
                                        Otomatis
                                    </button>
                                </div>
                            </div>
                            )}
                        </div>
                    </section>

                    {isOwner && (
                    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                        <h2 className="font-semibold text-slate-900">Bulk Tambah Komponen HPP</h2>
                        <form onSubmit={submitBulk} className="mt-4 space-y-4">
                            <label className="block">
                                <span className="mb-1 block text-sm font-medium text-slate-700">Komponen Default</span>
                                <select
                                    value={data.stock_item_id}
                                    onChange={(event) => setData('stock_item_id', event.target.value)}
                                    className="w-full rounded-lg border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    <option value="">Pilih komponen</option>
                                    {componentStocks.map((stock) => (
                                        <option key={stock.id} value={stock.id}>
                                            {stock.name} · {categoryLabel(stock.cost_category)} · {formatRupiah(stock.unit_cost)}/{stock.unit_name}
                                        </option>
                                    ))}
                                </select>
                                {errors.stock_item_id && <p className="mt-1 text-xs text-rose-600">{errors.stock_item_id}</p>}
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-sm font-medium text-slate-700">Rasio per Porsi</span>
                                <input
                                    type="number"
                                    step="0.0001"
                                    min="0.0001"
                                    value={data.ratio}
                                    onChange={(event) => setData('ratio', event.target.value)}
                                    className="w-full rounded-lg border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    required
                                />
                                {errors.ratio && <p className="mt-1 text-xs text-rose-600">{errors.ratio}</p>}
                            </label>
                            <button
                                type="button"
                                onClick={applyDefaultsToRows}
                                disabled={data.product_ids.length === 0 || (!data.stock_item_id && !data.ratio)}
                                className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:text-slate-300"
                            >
                                Samakan ke Produk Dipilih
                            </button>
                            <div>
                                <p className="mb-2 text-sm font-medium text-slate-700">Pilih Produk</p>
                                <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
                                    {products.map((product) => (
                                        <label key={product.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                                            <input
                                                type="checkbox"
                                                checked={data.product_ids.includes(product.id)}
                                                onChange={() => toggleProduct(product.id)}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="min-w-0 flex-1 truncate">{product.name}</span>
                                        </label>
                                    ))}
                                </div>
                                {errors.product_ids && <p className="mt-1 text-xs text-rose-600">{errors.product_ids}</p>}
                            </div>
                            {data.product_ids.length > 0 && (
                                <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                                    <p className="text-sm font-semibold text-slate-800">Komponen per Produk</p>
                                    <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                                        {(data.items || []).map((row) => {
                                            const product = products.find((item) => item.id === row.product_id);

                                            return (
                                                <div key={row.product_id} className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
                                                    <p className="mb-2 truncate text-sm font-semibold text-slate-900">{product?.name || 'Produk'}</p>
                                                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_96px]">
                                                        <select
                                                            value={row.stock_item_id}
                                                            onChange={(event) => updateBulkRow(row.product_id, 'stock_item_id', event.target.value)}
                                                            className="h-9 rounded-lg border-slate-300 text-xs focus:border-indigo-500 focus:ring-indigo-500"
                                                            required
                                                        >
                                                            <option value="">Pilih komponen</option>
                                                            {componentStocks.map((stock) => (
                                                                <option key={stock.id} value={stock.id}>
                                                                    {stock.name} · {categoryLabel(stock.cost_category)} · {formatRupiah(stock.unit_cost)}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <input
                                                            type="number"
                                                            step="0.0001"
                                                            min="0.0001"
                                                            value={row.ratio}
                                                            onChange={(event) => updateBulkRow(row.product_id, 'ratio', event.target.value)}
                                                            className="h-9 rounded-lg border-slate-300 text-xs focus:border-indigo-500 focus:ring-indigo-500"
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {errors.items && <p className="text-xs text-rose-600">{errors.items}</p>}
                            <button
                                type="submit"
                                disabled={processing || data.product_ids.length === 0 || data.items.some((row) => !row.stock_item_id || Number(row.ratio) <= 0)}
                                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300"
                            >
                                <ArrowPathIcon className="h-4 w-4" />
                                Terapkan ke {data.product_ids.length} Produk
                            </button>
                        </form>
                    </section>
                    )}
                </aside>
            </div>
        </ErpLayout>
    );
}
