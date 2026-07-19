import React, { useMemo, useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, router, usePage } from '@inertiajs/react';
import {
    ArrowDownTrayIcon,
    BanknotesIcon,
    CalendarDaysIcon,
    CheckCircleIcon,
    ClockIcon,
    DocumentMagnifyingGlassIcon,
    FunnelIcon,
    XCircleIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';

function formatRupiah(value) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(Number(value) || 0);
}

function formatQty(value, unit = '') {
    return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(Number(value) || 0)}${unit ? ` ${unit}` : ''}`;
}

function formatDate(value, withTime = false) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('id-ID', withTime
        ? { dateStyle: 'medium', timeStyle: 'short' }
        : { dateStyle: 'medium' }
    ).format(new Date(value));
}

function statusMeta(status) {
    const values = {
        PENDING: { label: 'Menunggu Mitra', className: 'bg-amber-100 text-amber-800', icon: ClockIcon },
        APPROVED: { label: 'Disetujui Mitra', className: 'bg-sky-100 text-sky-800', icon: CheckCircleIcon },
        REJECTED: { label: 'Ditolak Mitra', className: 'bg-rose-100 text-rose-800', icon: XCircleIcon },
        PAID: { label: 'Lunas', className: 'bg-emerald-100 text-emerald-800', icon: BanknotesIcon },
    };
    return values[status] || { label: status, className: 'bg-slate-100 text-slate-700', icon: ClockIcon };
}

export default function SettlementsIndex({
    mitras = [],
    selectedMitraId,
    startDate,
    endDate,
    reportData = [],
    warehouseReportData = [],
    settlements = [],
    isOwner,
}) {
    const pendingSettlements = settlements.filter((settlement) => settlement.status === 'PENDING');
    const [activeTab, setActiveTab] = useState(isOwner ? 'create' : (pendingSettlements.length > 0 ? 'pending' : 'history'));
    const [calcMethod, setCalcMethod] = useState('RESTOCK');
    const [viewSettlement, setViewSettlement] = useState(null);
    const [viewUsageItem, setViewUsageItem] = useState(null);
    const [filterMitra, setFilterMitra] = useState(selectedMitraId || '');
    const [filterStart, setFilterStart] = useState(startDate);
    const [filterEnd, setFilterEnd] = useState(endDate);
    const [exportStart, setExportStart] = useState(startDate);
    const [exportEnd, setExportEnd] = useState(endDate);
    const [exportMitra, setExportMitra] = useState(selectedMitraId || '');
    const [validationNote, setValidationNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { errors = {} } = usePage().props;

    const calcSubtotal = (quantity, price, minQuantity) => {
        const baseQuantity = Number(minQuantity) > 0 ? Number(minQuantity) : 1;
        return (Number(quantity) / baseQuantity) * Number(price);
    };

    const calculationData = calcMethod === 'RESTOCK' ? warehouseReportData : reportData;
    const proposalItems = useMemo(() => calculationData.map((item) => {
        const rawQuantity = calcMethod === 'SALES' ? Number(item.sales_qty) : Number(item.restock_qty);
        const remainingQuantity = Math.max(0, rawQuantity - Number(item.committed_qty ?? item.settled_qty ?? 0));
        return {
            ...item,
            remainingQuantity,
            subtotal: calcSubtotal(remainingQuantity, item.restock_price, item.min_restock_qty),
        };
    }), [calculationData, calcMethod]);

    const calculatedTotal = proposalItems.reduce((sum, item) => sum + item.subtotal, 0);
    const proposalQuantity = proposalItems.reduce((sum, item) => sum + item.remainingQuantity, 0);

    const applyFilters = () => {
        router.get(route('settlements'), {
            mitra_id: filterMitra || undefined,
            start_date: filterStart,
            end_date: filterEnd,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const createSettlement = () => {
        if (!filterMitra || calculatedTotal <= 0) return;
        setSubmitting(true);
        router.post(route('settlements.store'), {
            mitra_id: filterMitra,
            start_date: filterStart,
            end_date: filterEnd,
            calculation_method: calcMethod,
        }, {
            preserveScroll: true,
            onSuccess: () => setActiveTab('history'),
            onFinish: () => setSubmitting(false),
        });
    };

    const validateSettlement = (decision) => {
        if (!viewSettlement || (decision === 'REJECT' && !validationNote.trim())) return;
        setSubmitting(true);
        router.post(route('settlements.validate', viewSettlement.id), {
            decision,
            validation_note: validationNote,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setViewSettlement(null);
                setValidationNote('');
            },
            onFinish: () => setSubmitting(false),
        });
    };

    const markPaid = (settlement) => {
        setSubmitting(true);
        router.post(route('settlements.pay', settlement.id), {}, {
            preserveScroll: true,
            onSuccess: () => setViewSettlement(null),
            onFinish: () => setSubmitting(false),
        });
    };

    const openDetail = (settlement) => {
        setViewSettlement(settlement);
        setValidationNote(settlement.validation_note || '');
    };

    const visibleSettlements = !isOwner && activeTab === 'pending' ? pendingSettlements : settlements;
    const approvedCount = settlements.filter((settlement) => settlement.status === 'APPROVED').length;
    const paidTotal = settlements
        .filter((settlement) => settlement.status === 'PAID')
        .reduce((sum, settlement) => sum + Number(settlement.total_amount), 0);
    const exportUrl = route('settlements.export-pdf', {
        start_date: exportStart,
        end_date: exportEnd,
        mitra_id: isOwner && exportMitra ? exportMitra : undefined,
    });

    return (
        <ErpLayout title="Setoran Mitra">
            <Head title="Setoran Mitra" />

            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-slate-900">Setoran Mitra</h1>
                <p className="mt-1 text-sm text-slate-500">
                    {isOwner ? 'Siapkan rekap, kirim untuk validasi mitra, lalu catat pembayaran.' : 'Periksa rincian pengajuan owner sebelum memberikan persetujuan.'}
                </p>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <SummaryCard label="Menunggu Validasi" value={pendingSettlements.length} icon={ClockIcon} tone="amber" />
                <SummaryCard label="Siap Dibayar" value={approvedCount} icon={CheckCircleIcon} tone="sky" />
                <SummaryCard label="Total Lunas" value={formatRupiah(paidTotal)} icon={BanknotesIcon} tone="emerald" />
                <SummaryCard label="Seluruh Pengajuan" value={settlements.length} icon={DocumentMagnifyingGlassIcon} tone="slate" />
            </div>

            <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
                {isOwner && (
                    <TabButton active={activeTab === 'create'} onClick={() => setActiveTab('create')}>Buat Pengajuan</TabButton>
                )}
                {!isOwner && (
                    <TabButton active={activeTab === 'pending'} onClick={() => setActiveTab('pending')}>
                        Perlu Divalidasi
                        {pendingSettlements.length > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{pendingSettlements.length}</span>}
                    </TabButton>
                )}
                <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')}>Histori Setoran</TabButton>
            </div>

            {activeTab === 'create' && isOwner && (
                <div className="space-y-6">
                    <section className="border-y border-slate-200 bg-slate-50 px-3 py-4">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_auto] xl:items-end">
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Mitra</span>
                                <select
                                    value={filterMitra}
                                    onChange={(event) => setFilterMitra(event.target.value)}
                                    className="h-10 w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    <option value="">Pilih mitra</option>
                                    {mitras.map((mitra) => <option key={mitra.id} value={mitra.id}>{mitra.display_name}</option>)}
                                </select>
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Tanggal Mulai</span>
                                <input type="date" value={filterStart} onChange={(event) => setFilterStart(event.target.value)} className="h-10 w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Tanggal Akhir</span>
                                <input type="date" min={filterStart} value={filterEnd} onChange={(event) => setFilterEnd(event.target.value)} className="h-10 w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                            </label>
                            <button
                                type="button"
                                onClick={applyFilters}
                                disabled={!filterMitra || !filterStart || !filterEnd || filterEnd < filterStart}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300"
                            >
                                <FunnelIcon className="h-4 w-4" />
                                Tampilkan
                            </button>
                        </div>
                    </section>

                    {selectedMitraId && (reportData.length > 0 || warehouseReportData.length > 0) && (
                        <>
                            <section>
                                <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">Dasar Perhitungan</h2>
                                        <p className="mt-1 text-sm text-slate-500">Pilih data yang menjadi dasar nilai setoran.</p>
                                    </div>
                                    <div className="inline-flex rounded-md border border-slate-300 bg-white p-1">
                                        <button
                                            type="button"
                                            onClick={() => setCalcMethod('RESTOCK')}
                                            className={`rounded px-3 py-2 text-sm font-semibold ${calcMethod === 'RESTOCK' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            Stok Diterima
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCalcMethod('SALES')}
                                            className={`rounded px-3 py-2 text-sm font-semibold ${calcMethod === 'SALES' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            Bahan Terpakai
                                        </button>
                                    </div>
                                </div>
                                <div className="mb-4 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                                    {calcMethod === 'RESTOCK'
                                        ? 'Menghitung pasokan yang diterima satu kali di Gudang Pusat. Transfer gudang ke outlet tidak dihitung ulang.'
                                        : 'Menghitung seluruh bahan terjual, waste, barang rusak/basi, dan penggunaan pribadi dari semua outlet.'}
                                </div>

                                <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 lg:grid-cols-4">
                                    <Metric label="Periode" value={`${formatDate(startDate)} - ${formatDate(endDate)}`} />
                                    <Metric label="Jenis Bahan" value={`${proposalItems.length} bahan`} />
                                    <Metric label="Jumlah Dihitung" value={formatQty(proposalQuantity)} />
                                    <Metric label="Total Pengajuan" value={formatRupiah(calculatedTotal)} emphasis />
                                </div>

                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    {proposalItems.map((item) => (
                                        <button
                                            key={item.item_key || item.stock_item_id}
                                            type="button"
                                            onClick={() => setViewUsageItem({ item, calculationMethod: calcMethod })}
                                            className="w-full rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <h3 className="truncate font-semibold text-slate-900">{item.name}</h3>
                                                    <p className="mt-1 inline-flex rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">{item.outlet_name || 'Outlet'}</p>
                                                    <p className="mt-0.5 text-xs text-slate-500">{formatRupiah(item.restock_price)} per {formatQty(item.min_restock_qty, item.unit_name)}</p>
                                                </div>
                                                <DocumentMagnifyingGlassIcon className="h-5 w-5 shrink-0 text-indigo-500" />
                                            </div>
                                            {calcMethod === 'SALES' && (
                                                <div className="mt-4 grid grid-cols-2 gap-2">
                                                    <div className="rounded-md bg-emerald-50 px-3 py-2">
                                                        <p className="text-xs text-emerald-700">Terjual</p>
                                                        <p className="mt-0.5 font-bold text-emerald-900">{formatQty(item.sold_qty, item.unit_name)}</p>
                                                    </div>
                                                    <div className="rounded-md bg-rose-50 px-3 py-2">
                                                        <p className="text-xs text-rose-700">Waste & pribadi</p>
                                                        <p className="mt-0.5 font-bold text-rose-900">{formatQty(item.waste_qty, item.unit_name)}</p>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                                <div>
                                                    <p className="text-xs text-slate-500">Jumlah periode</p>
                                                    <p className="mt-1 font-semibold text-slate-800">{formatQty(calcMethod === 'SALES' ? item.sales_qty : item.restock_qty, item.unit_name)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500">Sudah lunas</p>
                                                    <p className="mt-1 font-semibold text-slate-800">{formatQty(item.settled_qty, item.unit_name)}</p>
                                                    {Number(item.pending_settlement_qty || 0) > 0 && (
                                                        <p className="mt-1 text-xs font-medium text-amber-700">
                                                            {formatQty(item.pending_settlement_qty, item.unit_name)} sedang diajukan
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-4">
                                                <div>
                                                    <p className="text-xs text-slate-500">Diajukan</p>
                                                    <p className="mt-1 font-bold text-indigo-700">{formatQty(item.remainingQuantity, item.unit_name)}</p>
                                                </div>
                                                <p className="text-lg font-bold text-slate-900">{formatRupiah(item.subtotal)}</p>
                                            </div>
                                            <p className="mt-4 border-t border-slate-100 pt-3 text-xs font-semibold text-indigo-600">
                                                Klik untuk melihat {calcMethod === 'RESTOCK' ? 'rincian penerimaan gudang' : 'rincian penggunaan'}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            <div className="flex flex-col items-end gap-2 border-t border-slate-200 pt-5">
                                {errors.settlement && <p className="text-sm font-medium text-rose-600">{errors.settlement}</p>}
                                <button
                                    type="button"
                                    onClick={createSettlement}
                                    disabled={submitting || calculatedTotal <= 0}
                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-indigo-600 px-6 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300"
                                >
                                    <CheckCircleIcon className="h-5 w-5" />
                                    {submitting ? 'Mengirim...' : 'Kirim Pengajuan ke Mitra'}
                                </button>
                            </div>
                        </>
                    )}

                    {selectedMitraId && reportData.length === 0 && warehouseReportData.length === 0 && (
                        <EmptyState text="Tidak ada aktivitas stok mitra pada periode yang dipilih." />
                    )}
                </div>
            )}

            {(activeTab === 'history' || (!isOwner && activeTab === 'pending')) && (
                <section>
                    <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">
                                {!isOwner && activeTab === 'pending' ? 'Pengajuan yang Perlu Diperiksa' : 'Histori Setoran'}
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">
                                {!isOwner && activeTab === 'pending'
                                    ? 'Buka rincian untuk menyetujui atau menolak perhitungan owner.'
                                    : 'Seluruh status pengajuan dan pembayaran setoran.'}
                            </p>
                        </div>
                    </div>

                    {activeTab === 'history' && (
                        <div className="mb-5 grid gap-3 border-y border-slate-200 bg-slate-50 px-3 py-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.25fr_auto] lg:items-end">
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Mulai</span>
                                <input
                                    type="date"
                                    value={exportStart}
                                    onChange={(event) => setExportStart(event.target.value)}
                                    className="h-10 w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Sampai</span>
                                <input
                                    type="date"
                                    min={exportStart}
                                    value={exportEnd}
                                    onChange={(event) => setExportEnd(event.target.value)}
                                    className="h-10 w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </label>
                            {isOwner ? (
                                <label className="block sm:col-span-2 lg:col-span-1">
                                    <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Mitra</span>
                                    <select
                                        value={exportMitra}
                                        onChange={(event) => setExportMitra(event.target.value)}
                                        className="h-10 w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    >
                                        <option value="">Semua mitra</option>
                                        {mitras.map((mitra) => <option key={mitra.id} value={mitra.id}>{mitra.display_name}</option>)}
                                    </select>
                                </label>
                            ) : (
                                <div className="hidden lg:block" />
                            )}
                            <a
                                href={exportUrl}
                                className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold ${
                                    exportStart && exportEnd && exportEnd >= exportStart
                                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                        : 'pointer-events-none bg-slate-300 text-white'
                                }`}
                            >
                                <ArrowDownTrayIcon className="h-5 w-5" />
                                Export PDF Periode
                            </a>
                        </div>
                    )}

                    {visibleSettlements.length === 0 ? (
                        <EmptyState text={activeTab === 'pending' ? 'Tidak ada pengajuan yang menunggu validasi.' : 'Belum ada histori setoran.'} />
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {visibleSettlements.map((settlement) => (
                                <SettlementCard
                                    key={settlement.id}
                                    settlement={settlement}
                                    isOwner={isOwner}
                                    submitting={submitting}
                                    onInspect={() => openDetail(settlement)}
                                    onPay={() => markPaid(settlement)}
                                    pdfUrl={route('settlements.pdf', settlement.id)}
                                />
                            ))}
                        </div>
                    )}
                </section>
            )}

            {viewSettlement && (
                <SettlementDetail
                    settlement={viewSettlement}
                    isOwner={isOwner}
                    validationNote={validationNote}
                    setValidationNote={setValidationNote}
                    submitting={submitting}
                    onClose={() => setViewSettlement(null)}
                    onValidate={validateSettlement}
                    onPay={() => markPaid(viewSettlement)}
                    pdfUrl={route('settlements.pdf', viewSettlement.id)}
                    onUsageInspect={(item) => setViewUsageItem({
                        item,
                        calculationMethod: viewSettlement.calculation_method,
                    })}
                />
            )}

            {viewUsageItem && (
                <UsageDetail
                    item={viewUsageItem.item}
                    calculationMethod={viewUsageItem.calculationMethod}
                    onClose={() => setViewUsageItem(null)}
                />
            )}
        </ErpLayout>
    );
}

function TabButton({ active, onClick, children }) {
    return (
        <button type="button" onClick={onClick} className={`h-11 shrink-0 border-b-2 px-4 text-sm font-semibold ${active ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {children}
        </button>
    );
}

function SummaryCard({ label, value, icon: Icon, tone }) {
    const tones = {
        amber: 'bg-amber-50 text-amber-700',
        sky: 'bg-sky-50 text-sky-700',
        emerald: 'bg-emerald-50 text-emerald-700',
        slate: 'bg-slate-100 text-slate-600',
    };
    return (
        <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-md ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
            <p className="truncate text-xs text-slate-500">{label}</p>
            <p className="mt-1 truncate text-lg font-bold text-slate-900" title={String(value)}>{value}</p>
        </div>
    );
}

function Metric({ label, value, emphasis = false }) {
    return (
        <div className="min-w-0 bg-white p-4">
            <p className="truncate text-xs font-medium text-slate-500">{label}</p>
            <p className={`mt-1 truncate font-bold ${emphasis ? 'text-lg text-indigo-700' : 'text-slate-900'}`} title={value}>{value}</p>
        </div>
    );
}

function SettlementCard({ settlement, isOwner, submitting, onInspect, onPay, pdfUrl }) {
    const status = statusMeta(settlement.status);
    const StatusIcon = status.icon;
    const settlementItems = settlement.receipt_data || [];
    const itemCount = settlementItems.length;
    const outletCount = new Set(settlementItems.map((item) => item.outlet_id || item.outlet_name).filter(Boolean)).size;
    return (
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    {isOwner && <p className="truncate text-sm font-semibold text-slate-700">{settlement.mitra?.display_name}</p>}
                    <p className="mt-1 text-xl font-bold text-slate-900">{formatRupiah(settlement.total_amount)}</p>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                    <StatusIcon className="h-4 w-4" />
                    {status.label}
                </span>
            </div>
            <div className="mt-4 space-y-2 border-y border-slate-100 py-3 text-sm text-slate-600">
                <p className="flex items-center gap-2"><CalendarDaysIcon className="h-4 w-4 text-slate-400" /> {formatDate(settlement.period_start)} - {formatDate(settlement.period_end)}</p>
                <p>{itemCount} bahan dari {outletCount || 1} outlet</p>
                <p>{settlement.calculation_method === 'RESTOCK' ? 'Berdasarkan stok diterima' : 'Berdasarkan bahan terpakai'}</p>
            </div>
            <SettlementProgress settlement={settlement} compact />
            {settlement.validation_note && <p className="mt-3 line-clamp-2 text-sm text-rose-700">Catatan: {settlement.validation_note}</p>}
            <div className="mt-4 flex gap-2">
                <button type="button" onClick={onInspect} className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <DocumentMagnifyingGlassIcon className="h-4 w-4" />
                    Periksa
                </button>
                <a href={pdfUrl} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-100" title="Unduh PDF setoran">
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    PDF
                </a>
                {isOwner && settlement.status === 'APPROVED' && (
                    <button type="button" disabled={submitting} onClick={onPay} className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                        <BanknotesIcon className="h-4 w-4" />
                        Tandai Lunas
                    </button>
                )}
            </div>
        </article>
    );
}

function SettlementDetail({ settlement, isOwner, validationNote, setValidationNote, submitting, onClose, onValidate, onPay, pdfUrl, onUsageInspect }) {
    const status = statusMeta(settlement.status);
    const items = settlement.receipt_data || [];
    const outletCount = new Set(items.map((item) => item.outlet_id || item.outlet_name).filter(Boolean)).size;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 sm:p-5">
            <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Rincian Pengajuan Setoran</h2>
                        <p className="mt-1 text-sm text-slate-500">{formatDate(settlement.period_start)} - {formatDate(settlement.period_end)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <a href={pdfUrl} className="rounded-md p-2 text-indigo-600 hover:bg-indigo-50" aria-label="Unduh PDF" title="Unduh PDF setoran">
                            <ArrowDownTrayIcon className="h-5 w-5" />
                        </a>
                        <button type="button" onClick={onClose} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Tutup">
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto p-5 sm:p-6">
                    <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 lg:grid-cols-4">
                        <Metric label="Mitra" value={settlement.mitra?.display_name || '-'} />
                        <Metric label="Status" value={status.label} />
                        <Metric label="Cakupan" value={`${items.length} bahan / ${outletCount || 1} outlet`} />
                        <Metric label="Total Setoran" value={formatRupiah(settlement.total_amount)} emphasis />
                    </div>

                    <div className="mb-6">
                        <h3 className="mb-3 font-semibold text-slate-900">Alur Setoran</h3>
                        <SettlementProgress settlement={settlement} />
                    </div>

                    <h3 className="mb-3 font-semibold text-slate-900">Perincian Bahan</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {items.map((item, index) => (
                            <button
                                key={`${item.stock_item_id}-${index}`}
                                type="button"
                                onClick={() => onUsageInspect(item)}
                                className="rounded-lg border border-slate-200 p-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50/30 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-semibold text-slate-900">{item.name}</p>
                                        <p className="mt-1 inline-flex rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">{item.outlet_name || 'Outlet'}</p>
                                        <p className="mt-0.5 text-xs text-slate-500">{formatRupiah(item.restock_price)} per {formatQty(item.min_restock_qty, item.unit_name)}</p>
                                    </div>
                                    <p className="shrink-0 font-bold text-indigo-700">{formatRupiah(item.subtotal)}</p>
                                </div>
                                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                                    <span className="text-slate-500">Jumlah dihitung</span>
                                    <span className="font-semibold text-slate-900">{formatQty(item.calculated_qty, item.unit_name)}</span>
                                </div>
                                {settlement.calculation_method === 'SALES' && (
                                    <div className="mt-3 flex flex-wrap gap-3 text-xs">
                                        <span className="font-medium text-emerald-700">Terjual {formatQty(item.sold_qty, item.unit_name)}</span>
                                        <span className="font-medium text-rose-700">Waste {formatQty(item.waste_qty, item.unit_name)}</span>
                                    </div>
                                )}
                                <p className="mt-3 text-xs font-semibold text-indigo-600">Lihat rincian</p>
                            </button>
                        ))}
                    </div>

                    {settlement.validation_note && (
                        <div className={`mt-5 rounded-md p-4 text-sm ${settlement.status === 'REJECTED' ? 'bg-rose-50 text-rose-800' : 'bg-sky-50 text-sky-800'}`}>
                            <strong>Catatan validasi:</strong> {settlement.validation_note}
                        </div>
                    )}

                    {!isOwner && settlement.status === 'PENDING' && (
                        <div className="mt-6 border-t border-slate-200 pt-5">
                            <label className="block">
                                <span className="mb-1.5 block text-sm font-medium text-slate-700">Catatan Mitra</span>
                                <textarea
                                    rows="3"
                                    value={validationNote}
                                    onChange={(event) => setValidationNote(event.target.value)}
                                    className="w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    placeholder="Wajib diisi bila pengajuan ditolak"
                                />
                            </label>
                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                <button type="button" disabled={submitting || !validationNote.trim()} onClick={() => onValidate('REJECT')} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-rose-300 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40">
                                    <XCircleIcon className="h-5 w-5" />
                                    Tolak Pengajuan
                                </button>
                                <button type="button" disabled={submitting} onClick={() => onValidate('APPROVE')} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                                    <CheckCircleIcon className="h-5 w-5" />
                                    Setujui Pengajuan
                                </button>
                            </div>
                        </div>
                    )}

                    {isOwner && settlement.status === 'APPROVED' && (
                        <div className="mt-6 flex justify-end border-t border-slate-200 pt-5">
                            <button type="button" disabled={submitting} onClick={onPay} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                                <BanknotesIcon className="h-5 w-5" />
                                Tandai Sudah Dibayar
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function UsageDetail({ item, calculationMethod, onClose }) {
    const isUsageMethod = calculationMethod === 'SALES';
    const calculatedQuantity = Number(item.calculated_qty ?? item.remainingQuantity ?? 0);
    const breakdown = [
        { label: 'Penggunaan pribadi owner', value: item.personal_use_qty, tone: 'text-violet-700 bg-violet-50' },
        { label: 'Basi / kedaluwarsa', value: item.expired_waste_qty, tone: 'text-amber-700 bg-amber-50' },
        { label: 'Rusak', value: item.damaged_waste_qty, tone: 'text-rose-700 bg-rose-50' },
        { label: 'Waste lainnya', value: item.other_waste_qty, tone: 'text-slate-700 bg-slate-100' },
    ].filter((row) => Number(row.value || 0) > 0);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-3 sm:p-5">
            <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                    <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold text-slate-900">{item.name}</h2>
                        <p className="mt-1 inline-flex rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">{item.outlet_name || 'Outlet'}</p>
                        <p className="mt-1 text-sm text-slate-500">
                            {formatRupiah(item.restock_price)} per {formatQty(item.min_restock_qty, item.unit_name)}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Tutup">
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>

                <div className="overflow-y-auto p-5">
                    {isUsageMethod ? (
                        <>
                            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
                                <UsageMetric label="Terjual" value={formatQty(item.sold_qty, item.unit_name)} tone="emerald" />
                                <UsageMetric label="Waste & Pribadi" value={formatQty(item.waste_qty, item.unit_name)} tone="rose" />
                                <UsageMetric label="Total Terpakai" value={formatQty(item.sales_qty, item.unit_name)} tone="slate" />
                            </div>

                            <div className="mt-5">
                                <h3 className="text-sm font-semibold text-slate-900">Rincian Non-Penjualan</h3>
                                {breakdown.length > 0 ? (
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                        {breakdown.map((row) => (
                                            <div key={row.label} className={`rounded-md px-3 py-3 ${row.tone}`}>
                                                <p className="text-xs">{row.label}</p>
                                                <p className="mt-1 font-bold">{formatQty(row.value, item.unit_name)}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-2 rounded-md bg-slate-50 px-3 py-4 text-sm text-slate-500">Tidak ada waste atau penggunaan pribadi pada periode ini.</p>
                                )}
                            </div>

                            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                                <div className="rounded-md border border-slate-200 p-3">
                                    <p className="text-xs text-slate-500">Waste produk jadi</p>
                                    <p className="mt-1 font-semibold text-slate-900">{formatQty(item.product_waste_qty, item.unit_name)}</p>
                                </div>
                                <div className="rounded-md border border-slate-200 p-3">
                                    <p className="text-xs text-slate-500">Waste bahan langsung</p>
                                    <p className="mt-1 font-semibold text-slate-900">{formatQty(item.stock_waste_qty, item.unit_name)}</p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
                            <p className="text-sm text-sky-700">Stok diterima gudang dari mitra</p>
                            <p className="mt-1 text-2xl font-bold text-sky-900">{formatQty(item.restock_qty, item.unit_name)}</p>
                        </div>
                    )}

                    <div className="mt-5 border-t border-slate-200 pt-5">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <p className="text-xs text-slate-500">Sudah lunas</p>
                                <p className="mt-1 font-semibold text-slate-900">{formatQty(item.settled_qty, item.unit_name)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Sedang diajukan</p>
                                <p className="mt-1 font-semibold text-amber-700">{formatQty(item.pending_settlement_qty, item.unit_name)}</p>
                            </div>
                        </div>
                        <div className="mt-4 flex items-end justify-between rounded-lg bg-indigo-50 p-4">
                            <div>
                                <p className="text-xs font-medium text-indigo-700">Jumlah pada setoran ini</p>
                                <p className="mt-1 text-xl font-bold text-indigo-900">{formatQty(calculatedQuantity, item.unit_name)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-indigo-700">Nilai setoran</p>
                                <p className="mt-1 text-xl font-bold text-indigo-900">
                                    {formatRupiah(item.subtotal ?? (calculatedQuantity / Math.max(1, Number(item.min_restock_qty))) * Number(item.restock_price))}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function UsageMetric({ label, value, tone }) {
    const tones = {
        emerald: 'bg-emerald-50 text-emerald-900',
        rose: 'bg-rose-50 text-rose-900',
        slate: 'bg-slate-50 text-slate-900',
    };

    return (
        <div className={`min-w-0 p-3 ${tones[tone]}`}>
            <p className="truncate text-xs opacity-70">{label}</p>
            <p className="mt-1 truncate font-bold" title={value}>{value}</p>
        </div>
    );
}

function SettlementProgress({ settlement, compact = false }) {
    const isValidated = ['APPROVED', 'REJECTED', 'PAID'].includes(settlement.status);
    const isPaid = settlement.status === 'PAID';
    const rejected = settlement.status === 'REJECTED';
    const steps = [
        {
            label: 'Diajukan',
            detail: formatDate(settlement.created_at, true),
            complete: true,
            rejected: false,
        },
        {
            label: rejected ? 'Ditolak Mitra' : 'Validasi Mitra',
            detail: settlement.validated_at
                ? `${formatDate(settlement.validated_at, true)}${settlement.validator?.display_name ? ` oleh ${settlement.validator.display_name}` : ''}`
                : 'Menunggu pemeriksaan',
            complete: isValidated,
            rejected,
        },
        {
            label: 'Pembayaran',
            detail: settlement.paid_at
                ? `${formatDate(settlement.paid_at, true)}${settlement.payer?.display_name ? ` oleh ${settlement.payer.display_name}` : ''}`
                : 'Belum dibayar',
            complete: isPaid,
            rejected: false,
        },
    ];

    return (
        <div className={`grid grid-cols-3 ${compact ? 'mt-4 gap-1' : 'gap-2'}`}>
            {steps.map((step, index) => (
                <div key={step.label} className={`min-w-0 border-t-2 pt-2 ${
                    step.rejected
                        ? 'border-rose-500'
                        : step.complete
                            ? 'border-emerald-500'
                            : 'border-slate-200'
                }`}>
                    <p className={`${compact ? 'text-[10px]' : 'text-xs'} truncate font-semibold ${
                        step.rejected ? 'text-rose-700' : step.complete ? 'text-emerald-700' : 'text-slate-400'
                    }`}>
                        {index + 1}. {step.label}
                    </p>
                    {!compact && <p className="mt-1 text-xs leading-5 text-slate-500">{step.detail}</p>}
                </div>
            ))}
        </div>
    );
}

function EmptyState({ text }) {
    return (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
            <DocumentMagnifyingGlassIcon className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">{text}</p>
        </div>
    );
}
