import { useEffect, useMemo, useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, useForm, router, usePage } from '@inertiajs/react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

function formatRupiah(value) {
    const n = Number(value) || 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function isCashierFundMovement(item) {
    return item.category === 'Tambah Kas' || item.category === 'Tambah Modal';
}

function isOutsideCashierTopup(item) {
    return isCashierFundMovement(item) && item.payment_method === 'PRIVATE';
}

function isIncomingMovement(item) {
    return item.cash_flow === 'IN' && (!isCashierFundMovement(item) || isOutsideCashierTopup(item));
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

function categoryTone(item, cashierFund, outsideTopup, incoming) {
    if (cashierFund) return 'bg-amber-100 text-amber-800';
    if (item.payment_method === 'PRIVATE') return 'bg-amber-100 text-amber-800';
    if (incoming) return 'bg-emerald-100 text-emerald-800';
    if (OWNER_ONLY_CATEGORIES.includes(item.category)) return 'bg-slate-100 text-slate-700';
    return 'bg-rose-100 text-rose-800';
}

function amountTone(item, incoming) {
    if (item.payment_method === 'PRIVATE') return 'text-amber-700';
    if (incoming) return 'text-emerald-600';
    return 'text-slate-900';
}

function amountSign(item, incoming) {
    if (item.payment_method === 'PRIVATE') return '';
    return incoming ? '+' : '-';
}

function formatDateLabel(value) {
    if (!value) return '';
    return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

const ALL_CATEGORIES = 'ALL';
const CUSTOM_CATEGORY = '__custom__';
const OWNER_DISTRIBUTION_CATEGORY = 'Distribusi Owner';
const OWNER_ONLY_CATEGORIES = ['Penarikan', OWNER_DISTRIBUTION_CATEGORY];

const FALLBACK_CATEGORIES = [
    'Operasional',
    'Bahan Baku',
    'RESTOCK',
    'Gaji',
    'Listrik/Air',
    'Sewa',
    'Internet/Telepon',
    'Transportasi',
    'Peralatan',
    'Maintenance',
    'Kebersihan',
    'Marketing',
    'Pajak/Retribusi',
    'Kasbon',
    'Tambah Kas',
    'Penarikan',
    'Lainnya',
];

function uniqueCategories(values) {
    const seen = new Set();
    return values
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .filter(value => {
            const key = value.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function emptyCategorySummary(category) {
    return {
        category,
        movement_count: 0,
        expense_count: 0,
        outgoing_count: 0,
        private_count: 0,
        expense_total: 0,
        cashier_expense_total: 0,
        private_total: 0,
        outgoing_total: 0,
        incoming_total: 0,
    };
}

function categoryPrimaryTotal(summary) {
    return Number(summary?.cashier_expense_total || 0)
        || Number(summary?.private_total || 0)
        || Number(summary?.expense_total || 0)
        || Number(summary?.outgoing_total || 0)
        || Number(summary?.incoming_total || 0);
}

function categoryPrimaryLabel(summary) {
    if (Number(summary?.cashier_expense_total || 0) > 0) return 'pengeluaran kasir';
    if (Number(summary?.private_total || 0) > 0) return 'uang pribadi';
    if (Number(summary?.expense_total || 0) > 0) return 'pengeluaran';
    if (Number(summary?.outgoing_total || 0) > 0) return 'keluar';
    if (Number(summary?.incoming_total || 0) > 0) return 'masuk';
    return 'belum ada';
}

function categoryPrimaryTone(summary) {
    if (Number(summary?.cashier_expense_total || 0) > 0) return 'text-rose-600';
    if (Number(summary?.private_total || 0) > 0) return 'text-amber-700';
    if (Number(summary?.incoming_total || 0) > 0) return 'text-emerald-700';
    return 'text-slate-700';
}

export default function ExpensesIndex({ expenses = [], openShift, categoryOptions = [], categorySummaries = [], filters = {} }) {
    const { auth } = usePage().props;
    const isOwner = auth?.user?.role === 'OWNER';
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [isCustomCategory, setIsCustomCategory] = useState(false);
    const [dateFilters, setDateFilters] = useState({
        date_from: filters?.date_from || '',
        date_to: filters?.date_to || '',
    });

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm({
        amount: '',
        category: 'Operasional',
        payment_method: 'CASH',
        cash_flow: 'OUT',
        description: '',
        date: '',
    });

    const selectedCategory = filters?.category || ALL_CATEGORIES;
    const selectedDateFrom = filters?.date_from || '';
    const selectedDateTo = filters?.date_to || '';
    const hasDateFilter = Boolean(selectedDateFrom || selectedDateTo);
    const periodLabel = hasDateFilter
        ? `${selectedDateFrom ? formatDateLabel(selectedDateFrom) : 'Awal'} - ${selectedDateTo ? formatDateLabel(selectedDateTo) : 'Sekarang'}`
        : 'Semua tanggal';
    const normalizedCategoryOptions = useMemo(() => uniqueCategories([
        ...FALLBACK_CATEGORIES,
        ...categoryOptions,
        ...expenses.map(expense => expense.category),
    ]), [categoryOptions, expenses]);
    const editableCategoryOptions = useMemo(
        () => normalizedCategoryOptions.filter(category => isOwner || !OWNER_ONLY_CATEGORIES.includes(category)),
        [isOwner, normalizedCategoryOptions]
    );
    const summaryRows = useMemo(() => {
        const byCategory = new Map();
        categorySummaries.forEach(row => {
            byCategory.set(row.category, {
                ...emptyCategorySummary(row.category),
                ...row,
            });
        });

        return normalizedCategoryOptions.map(category => (
            byCategory.get(category) || emptyCategorySummary(category)
        ));
    }, [categorySummaries, normalizedCategoryOptions]);
    const totalSummary = useMemo(() => summaryRows.reduce((total, row) => ({
        ...total,
        movement_count: total.movement_count + Number(row.movement_count || 0),
        expense_count: total.expense_count + Number(row.expense_count || 0),
        outgoing_count: total.outgoing_count + Number(row.outgoing_count || 0),
        private_count: total.private_count + Number(row.private_count || 0),
        expense_total: total.expense_total + Number(row.expense_total || 0),
        cashier_expense_total: total.cashier_expense_total + Number(row.cashier_expense_total || 0),
        private_total: total.private_total + Number(row.private_total || 0),
        outgoing_total: total.outgoing_total + Number(row.outgoing_total || 0),
        incoming_total: total.incoming_total + Number(row.incoming_total || 0),
    }), emptyCategorySummary('Semua kategori')), [summaryRows]);
    const selectedSummary = selectedCategory === ALL_CATEGORIES
        ? totalSummary
        : summaryRows.find(row => row.category === selectedCategory) || emptyCategorySummary(selectedCategory);
    const categorySelectValue = isCustomCategory || !editableCategoryOptions.includes(data.category)
        ? CUSTOM_CATEGORY
        : data.category;
    const emptyExpenseMessage = useMemo(() => {
        const scopes = [];
        if (selectedCategory !== ALL_CATEGORIES) scopes.push(`kategori ${selectedCategory}`);
        if (hasDateFilter) scopes.push(`periode ${periodLabel}`);

        return scopes.length
            ? `Belum ada catatan untuk ${scopes.join(' dan ')}.`
            : 'Belum ada catatan pengeluaran.';
    }, [hasDateFilter, periodLabel, selectedCategory]);

    useEffect(() => {
        setDateFilters({
            date_from: selectedDateFrom,
            date_to: selectedDateTo,
        });
    }, [selectedDateFrom, selectedDateTo]);

    const handleOpenAdd = () => {
        setEditingId(null);
        setIsCustomCategory(false);
        clearErrors();
        
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        setData({
            amount: '',
            category: 'Operasional',
            payment_method: 'CASH',
            cash_flow: 'OUT',
            description: '',
            date: now.toISOString().slice(0, 16),
        });
        
        setIsModalOpen(true);
    };

    const handleOpenEdit = (expense) => {
        setEditingId(expense.id);
        clearErrors();
        setIsCustomCategory(!editableCategoryOptions.includes(expense.category));
        
        const d = new Date(expense.created_at);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        
        setData({
            amount: expense.amount,
            category: expense.category,
            payment_method: expense.payment_method || 'CASH',
            cash_flow: expense.category === 'Tambah Kas' ? 'IN' : (expense.cash_flow || 'OUT'),
            description: expense.description || '',
            date: d.toISOString().slice(0, 16),
        });
        setIsModalOpen(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingId) {
            put(route('expenses.update', editingId), {
                onSuccess: () => {
                    setIsModalOpen(false);
                    reset();
                }
            });
        } else {
            post(route('expenses.store'), {
                onSuccess: () => {
                    setIsModalOpen(false);
                    reset();
                }
            });
        }
    };

    const handleDelete = (id) => {
        if (confirm('Yakin ingin menghapus catatan pengeluaran ini?')) {
            router.delete(route('expenses.destroy', id));
        }
    };

    const buildFilterQuery = (overrides = {}) => {
        const category = overrides.category ?? selectedCategory;
        const dateFrom = overrides.date_from ?? selectedDateFrom;
        const dateTo = overrides.date_to ?? selectedDateTo;
        const query = {};

        if (category && category !== ALL_CATEGORIES) query.category = category;
        if (dateFrom) query.date_from = dateFrom;
        if (dateTo) query.date_to = dateTo;

        return query;
    };

    const visitFilters = (query) => {
        router.get(route('expenses'), query, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    const handleCategoryFilterChange = (category) => {
        visitFilters(buildFilterQuery({ category }));
    };

    const handleDateFilterSubmit = (e) => {
        e.preventDefault();
        visitFilters(buildFilterQuery(dateFilters));
    };

    const handleClearDateFilter = () => {
        setDateFilters({ date_from: '', date_to: '' });
        visitFilters(buildFilterQuery({ date_from: '', date_to: '' }));
    };

    const handleCategoryInputChange = (category) => {
        setData('category', category);
        setData('cash_flow', category === 'Tambah Kas' ? 'IN' : 'OUT');
        if (category === 'Tambah Kas') setData('payment_method', 'CASH');
    };

    return (
        <ErpLayout title="Pengeluaran & Kas">
            <Head title="Pengeluaran" />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h1 className="text-2xl font-semibold text-slate-900">Pengeluaran & Kasbon</h1>
                <button
                    onClick={handleOpenAdd}
                    className="bg-indigo-600 text-white px-4 py-3 sm:py-2 rounded-lg sm:rounded-md hover:bg-indigo-700 text-sm font-semibold sm:font-medium w-full sm:w-auto shadow-sm min-h-[44px] flex items-center justify-center transition-all active:scale-[0.98]"
                >
                    + Catat Pengeluaran
                </button>
            </div>

            {!openShift && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-md mb-6">
                    <p className="font-medium text-sm">Peringatan: Tidak ada shift yang terbuka saat ini. Pengeluaran yang dicatat akan masuk ke shift berikutnya yang dibuka atau berdiri sendiri.</p>
                </div>
            )}

            <div className="mb-4 space-y-4">
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 sm:p-5">
                    <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Filter Kategori</label>
                            <select
                                value={selectedCategory}
                                onChange={e => handleCategoryFilterChange(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                            >
                                <option value={ALL_CATEGORIES}>Semua kategori</option>
                                {normalizedCategoryOptions.map(category => (
                                    <option key={category} value={category}>{category}</option>
                                ))}
                            </select>
                        </div>
                        <form onSubmit={handleDateFilterSubmit}>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Dari Tanggal</label>
                                    <input
                                        type="date"
                                        value={dateFilters.date_from}
                                        onChange={e => setDateFilters(prev => ({ ...prev, date_from: e.target.value }))}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Sampai Tanggal</label>
                                    <input
                                        type="date"
                                        value={dateFilters.date_to}
                                        onChange={e => setDateFilters(prev => ({ ...prev, date_to: e.target.value }))}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                                    />
                                </div>
                                <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
                                    <button
                                        type="submit"
                                        className="inline-flex min-h-[40px] flex-1 lg:flex-none items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-[0.98]"
                                    >
                                        Terapkan Tanggal
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleClearDateFilter}
                                        title="Reset tanggal"
                                        aria-label="Reset filter tanggal"
                                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98]"
                                    >
                                        <ArrowPathIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                        {selectedCategory === ALL_CATEGORIES
                            ? 'Menampilkan catatan dari semua kategori.'
                            : `Menampilkan catatan kategori ${selectedCategory}.`}
                        <span className="font-medium text-slate-600"> Periode: {periodLabel}.</span>
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="min-h-[116px] bg-white rounded-lg border border-rose-200 shadow-sm p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Pengeluaran Kasir</p>
                        <p className="mt-2 text-xl sm:text-2xl font-bold text-slate-900 break-words">{formatRupiah(selectedSummary.cashier_expense_total)}</p>
                        <p className="mt-1 text-xs text-slate-500">Cash/QRIS yang memengaruhi saldo kasir</p>
                    </div>
                    <div className="min-h-[116px] bg-white rounded-lg border border-amber-200 shadow-sm p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Uang Pribadi</p>
                        <p className="mt-2 text-xl sm:text-2xl font-bold text-amber-700 break-words">{formatRupiah(selectedSummary.private_total)}</p>
                        <p className="mt-1 text-xs text-slate-500">{Number(selectedSummary.private_count || 0)} catatan di luar saldo kasir</p>
                    </div>
                    <div className="min-h-[116px] bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Keluar</p>
                        <p className="mt-2 text-xl sm:text-2xl font-bold text-slate-900 break-words">{formatRupiah(selectedSummary.outgoing_total)}</p>
                        <p className="mt-1 text-xs text-slate-500">{Number(selectedSummary.outgoing_count || 0)} mutasi keluar termasuk penarikan</p>
                    </div>
                    <div className="min-h-[116px] bg-white rounded-lg border border-emerald-200 shadow-sm p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Total Masuk</p>
                        <p className="mt-2 text-xl sm:text-2xl font-bold text-slate-900 break-words">{formatRupiah(selectedSummary.incoming_total)}</p>
                        <p className="mt-1 text-xs text-slate-500">{Number(selectedSummary.movement_count || 0)} total catatan kategori</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900">Rekap Semua Kategori</h2>
                        <p className="text-xs text-slate-500">Kategori default, kategori sistem, dan kategori custom yang pernah dipakai akan muncul di sini.</p>
                    </div>
                    {selectedCategory !== ALL_CATEGORIES && (
                        <button
                            type="button"
                            onClick={() => handleCategoryFilterChange(ALL_CATEGORIES)}
                            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                        >
                            Tampilkan semua
                        </button>
                    )}
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {summaryRows.map(row => {
                        const selected = selectedCategory === row.category;
                        const primaryTotal = categoryPrimaryTotal(row);

                        return (
                            <button
                                key={row.category}
                                type="button"
                                onClick={() => handleCategoryFilterChange(row.category)}
                                className={`min-h-[64px] rounded-lg border px-3 py-2 text-left transition ${
                                    selected
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-slate-50'
                                }`}
                            >
                                <span className="flex items-start justify-between gap-3">
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-semibold">{row.category}</span>
                                        <span className="mt-0.5 block text-xs text-slate-500">
                                            {Number(row.movement_count || 0)} catatan - {categoryPrimaryLabel(row)}
                                        </span>
                                    </span>
                                    <span className={`shrink-0 text-sm font-bold ${categoryPrimaryTone(row)}`}>{formatRupiah(primaryTotal)}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white shadow-sm rounded-lg border border-slate-200 overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                        <tr>
                            <th className="px-4 py-3 font-medium">Tanggal</th>
                            <th className="px-4 py-3 font-medium">Kategori</th>
                            <th className="px-4 py-3 font-medium">Keterangan</th>
                            <th className="px-4 py-3 font-medium text-right">Nominal (Rp)</th>
                            <th className="px-4 py-3 font-medium text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {expenses.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-4 py-8 text-center text-slate-500">
                                    {emptyExpenseMessage}
                                </td>
                            </tr>
                        ) : (
                            expenses.map((e) => {
                                const cashierFund = isCashierFundMovement(e);
                                const outsideTopup = isOutsideCashierTopup(e);
                                const incoming = isIncomingMovement(e);

                                return (
                                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap">{new Date(e.created_at).toLocaleString('id-ID')}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${categoryTone(e, cashierFund, outsideTopup, incoming)}`}>
                                            {cashierFund ? (outsideTopup ? 'Top Up Luar Laci' : 'Top Up Dari Laci') : e.category}
                                        </span>
                                        <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${paymentTone(e.payment_method)}`}>{cashierFund ? (outsideTopup ? 'Luar Laci' : 'Dari Laci') : paymentLabel(e.payment_method)}</span>
                                        {e.edited_by_owner_at && <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Edited owner</span>}
                                    </td>
                                    <td className="px-4 py-3">{e.description || '-'}</td>
                                    <td className={`px-4 py-3 text-right font-semibold ${amountTone(e, incoming)}`}>
                                        {amountSign(e, incoming) && `${amountSign(e, incoming)} `}{formatRupiah(e.amount)}
                                    </td>
                                    <td className="px-4 py-3 text-center space-x-2">
                                        {isOwner ? (
                                            <>
                                                <button onClick={() => handleOpenEdit(e)} className="inline-flex items-center justify-center px-3 py-2 bg-indigo-50 text-indigo-600 rounded-md font-medium hover:bg-indigo-100 transition-colors min-h-[36px] active:scale-[0.98]">Edit</button>
                                                <button onClick={() => handleDelete(e.id)} className="inline-flex items-center justify-center px-3 py-2 bg-rose-50 text-rose-600 rounded-md font-medium hover:bg-rose-100 transition-colors min-h-[36px] active:scale-[0.98]">Hapus</button>
                                            </>
                                        ) : '-'}
                                    </td>
                                </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {expenses.length === 0 ? (
                    <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500 text-sm">
                        {emptyExpenseMessage}
                    </div>
                ) : (
                    expenses.map((e) => {
                        const cashierFund = isCashierFundMovement(e);
                        const outsideTopup = isOutsideCashierTopup(e);
                        const incoming = isIncomingMovement(e);

                        return (
                        <div key={e.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div className="flex-1 pr-2">
                                    <div className="text-xs font-medium text-slate-500 mb-1">{new Date(e.created_at).toLocaleString('id-ID')}</div>
                                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold tracking-wide mb-2 ${categoryTone(e, cashierFund, outsideTopup, incoming)}`}>
                                        {cashierFund ? (outsideTopup ? 'Top Up Luar Laci' : 'Top Up Dari Laci') : e.category}
                                    </span>
                                    <span className={`ml-2 inline-block px-2 py-0.5 rounded text-[11px] font-bold tracking-wide ${paymentTone(e.payment_method)}`}>{cashierFund ? (outsideTopup ? 'Luar Laci' : 'Dari Laci') : paymentLabel(e.payment_method)}</span>
                                    {e.edited_by_owner_at && <span className="ml-2 inline-block px-2 py-0.5 rounded text-[11px] font-bold tracking-wide bg-amber-100 text-amber-700">Edited owner</span>}
                                    <p className="text-sm text-slate-700 leading-snug">{e.description || 'Tanpa keterangan'}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className={`font-bold text-base ${amountTone(e, incoming)}`}>{amountSign(e, incoming) && `${amountSign(e, incoming)} `}{formatRupiah(e.amount)}</div>
                                </div>
                            </div>
                            {isOwner && <div className="border-t border-slate-100 pt-3 flex justify-end gap-2 mt-1">
                                        <button onClick={() => handleOpenEdit(e)} className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors min-h-[44px] active:scale-[0.98]">Edit</button>
                                        <button onClick={() => handleDelete(e.id)} className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2.5 bg-rose-50 text-rose-700 rounded-lg text-sm font-semibold hover:bg-rose-100 transition-colors min-h-[44px] active:scale-[0.98]">Hapus</button>
                            </div>}
                        </div>
                        );
                    })
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:p-0 transition-opacity">
                    <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col animate-slide-up sm:animate-fade-in">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-md">
                            <h2 className="text-lg font-bold text-slate-900">
                                {editingId ? 'Edit Pengeluaran / Kas' : 'Catat Pengeluaran / Kas'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-full transition-colors flex items-center justify-center min-w-[44px] min-h-[44px]">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal & Waktu</label>
                                <input
                                    type="datetime-local"
                                    value={data.date}
                                    onChange={e => setData('date', e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-slate-50 focus:bg-white"
                                />
                                {errors.date && <p className="text-rose-500 text-xs mt-1.5">{errors.date}</p>}
                                <p className="text-xs text-slate-500 mt-1.5">Mundur ke tanggal sebelumnya (backdate) bisa dilakukan.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nominal (Rp)</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={data.amount}
                                    onChange={e => setData('amount', e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-slate-50 focus:bg-white font-medium"
                                    required
                                    placeholder="Contoh: 50000"
                                />
                                {errors.amount && <p className="text-rose-500 text-xs mt-1.5">{errors.amount}</p>}
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Kategori</label>
                                <select
                                    value={categorySelectValue}
                                    onChange={e => {
                                        const category = e.target.value;
                                        if (category === CUSTOM_CATEGORY) {
                                            setIsCustomCategory(true);
                                            setData('category', '');
                                            setData('cash_flow', 'OUT');
                                            return;
                                        }

                                        setIsCustomCategory(false);
                                        handleCategoryInputChange(category);
                                    }}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-slate-50 focus:bg-white"
                                    required
                                >
                                    {editableCategoryOptions.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                    <option value={CUSTOM_CATEGORY}>+ Kategori custom</option>
                                </select>
                                {isCustomCategory && (
                                    <input
                                        type="text"
                                        value={data.category}
                                        onChange={e => handleCategoryInputChange(e.target.value)}
                                        className="mt-2 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-slate-50 focus:bg-white"
                                        required
                                        maxLength="80"
                                        placeholder="Contoh: Laundry, Sewa Booth, Transport Vendor"
                                    />
                                )}
                                {errors.category && <p className="text-rose-500 text-xs mt-1.5">{errors.category}</p>}
                                {isCustomCategory && (
                                    <p className="text-xs text-slate-500 mt-1.5">Kategori baru otomatis masuk daftar setelah transaksi disimpan.</p>
                                )}
                                {data.category === 'Tambah Kas' && (
                                    <p className="text-xs text-amber-700 mt-1.5">Pilih sumber top up agar omzet laci tidak salah hitung.</p>
                                )}
                            </div>

                            {data.category === 'Tambah Kas' && (
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Sumber Top Up</label>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={() => setData('payment_method', 'CASH')}
                                            className={`rounded-lg border p-3 text-left text-sm transition ${data.payment_method === 'CASH' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            <span className="block font-semibold">Dari Laci</span>
                                            <span className="mt-1 block text-xs">Mengurangi uang omzet laci.</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setData('payment_method', 'PRIVATE')}
                                            className={`rounded-lg border p-3 text-left text-sm transition ${data.payment_method === 'PRIVATE' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            <span className="block font-semibold">Dari Luar Laci</span>
                                            <span className="mt-1 block text-xs">Menambah kas tanpa memotong omzet laci.</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {data.category === 'Penarikan' && (
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Sumber Saldo</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setData('payment_method', 'CASH')}
                                            className={`py-2 rounded-lg border text-sm font-semibold ${data.payment_method === 'CASH' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'border-slate-300 text-slate-600'}`}
                                        >
                                            Cash
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setData('payment_method', 'QRIS')}
                                            className={`py-2 rounded-lg border text-sm font-semibold ${data.payment_method === 'QRIS' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-300 text-slate-600'}`}
                                        >
                                            QRIS
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Keterangan Tambahan</label>
                                <textarea
                                    value={data.description}
                                    onChange={e => setData('description', e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-slate-50 focus:bg-white"
                                    rows="3"
                                    placeholder="Opsional, misal: Beli es batu kristal 2 pack"
                                ></textarea>
                                {errors.description && <p className="text-rose-500 text-xs mt-1.5">{errors.description}</p>}
                            </div>

                            <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto px-5 py-3 sm:py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors min-h-[44px] flex items-center justify-center active:scale-[0.98]">
                                    Batal
                                </button>
                                <button type="submit" disabled={processing} className="w-full sm:w-auto px-5 py-3 sm:py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 disabled:opacity-70 transition-all min-h-[44px] flex items-center justify-center active:scale-[0.98]">
                                    {processing ? 'Menyimpan...' : 'Simpan Pengeluaran'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </ErpLayout>
    );
}
