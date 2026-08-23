import React, { useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, Link, router } from '@inertiajs/react';
import {
    ArchiveBoxIcon,
    ArrowPathIcon,
    BanknotesIcon,
    ChartBarIcon,
    CheckCircleIcon,
    CubeIcon,
    ExclamationTriangleIcon,
    FunnelIcon,
    ScaleIcon,
    TruckIcon,
} from '@heroicons/react/24/outline';

const tabs = [
    { id: 'summary', label: 'Ringkasan' },
    { id: 'usage', label: 'Bahan Keluar' },
    { id: 'products', label: 'Penggunaan Produk' },
    { id: 'restock', label: 'Histori Restok' },
    { id: 'settlement', label: 'Setoran' },
];

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

function deliveryBadge(status) {
    if (status === 'SENT') return { label: 'Menunggu Gudang', className: 'bg-amber-100 text-amber-800' };
    if (status === 'RECEIVED_MATCH') return { label: 'Sesuai', className: 'bg-emerald-100 text-emerald-800' };
    return { label: 'Ada Selisih', className: 'bg-rose-100 text-rose-800' };
}

function settlementBadge(status) {
    const statuses = {
        PENDING: ['Menunggu Validasi', 'bg-amber-100 text-amber-800'],
        APPROVED: ['Disetujui', 'bg-sky-100 text-sky-800'],
        REJECTED: ['Ditolak', 'bg-rose-100 text-rose-800'],
        CANCELED: ['Dibatalkan Owner', 'bg-slate-100 text-slate-700'],
        PAID: ['Lunas', 'bg-emerald-100 text-emerald-800'],
    };
    const [label, className] = statuses[status] || [status, 'bg-slate-100 text-slate-700'];
    return { label, className };
}

function wasteTypeLabel(type) {
    return {
        EXPIRED: 'Basi/Kedaluwarsa',
        OWNER_REQUEST: 'Permintaan Owner',
        DAMAGED: 'Rusak',
        OTHER: 'Lainnya',
    }[type] || type;
}

export default function MitraReportsIndex({ reportData = [], overview = {}, startDate, endDate }) {
    const [activeTab, setActiveTab] = useState('summary');
    const [filterStart, setFilterStart] = useState(startDate);
    const [filterEnd, setFilterEnd] = useState(endDate);
    const summary = overview.summary || {};
    const items = overview.items || reportData;
    const productUsage = overview.product_usage || [];
    const deliveries = overview.deliveries || [];
    const restockHistory = overview.restock_history || [];
    const settlements = overview.settlements || [];

    const applyFilter = () => {
        router.get(route('mitra-reports'), {
            start_date: filterStart,
            end_date: filterEnd,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    return (
        <ErpLayout title="Laporan Mitra">
            <Head title="Laporan Mitra" />

            <div className="mb-6 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Laporan Stok Mitra</h1>
                    <p className="mt-1 text-sm text-slate-500">Rekap aktivitas stok dan pembayaran dari outlet.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input
                        type="date"
                        value={filterStart}
                        onChange={(event) => setFilterStart(event.target.value)}
                        className="h-10 rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                    <input
                        type="date"
                        min={filterStart}
                        value={filterEnd}
                        onChange={(event) => setFilterEnd(event.target.value)}
                        className="h-10 rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                    <button
                        type="button"
                        onClick={applyFilter}
                        disabled={!filterStart || !filterEnd || filterEnd < filterStart}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300"
                    >
                        <FunnelIcon className="h-4 w-4" />
                        Terapkan
                    </button>
                </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
                {[
                    { label: 'Bahan Dipantau', value: `${summary.stock_item_count || 0} jenis`, icon: ArchiveBoxIcon, tone: 'text-indigo-700 bg-indigo-50' },
                    { label: 'Bahan Aktif Keluar', value: `${summary.used_stock_item_count || 0} jenis`, icon: ScaleIcon, tone: 'text-rose-700 bg-rose-50' },
                    { label: 'Aktivitas Restok', value: `${summary.restock_event_count || 0} kali`, icon: TruckIcon, tone: 'text-sky-700 bg-sky-50' },
                    { label: 'Setoran Lunas', value: formatRupiah(summary.paid_settlements), icon: BanknotesIcon, tone: 'text-emerald-700 bg-emerald-50' },
                ].map(({ label, value, icon: Icon, tone }) => (
                    <div key={label} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                        <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-md ${tone}`}>
                            <Icon className="h-5 w-5" />
                        </div>
                        <p className="truncate text-xs font-medium text-slate-500">{label}</p>
                        <p className="mt-1 truncate text-lg font-bold text-slate-900" title={value}>{value}</p>
                    </div>
                ))}
            </div>

            <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`h-11 shrink-0 border-b-2 px-4 text-sm font-semibold ${
                            activeTab === tab.id
                                ? 'border-indigo-600 text-indigo-700'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'summary' && (
                <div className="space-y-7">
                    <section>
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900">Ringkasan Stok</h2>
                            <span className="text-xs text-slate-500">{items.length} bahan dipantau</span>
                        </div>
                        {items.length === 0 ? (
                            <EmptyState text="Belum ada bahan stok yang terhubung dengan akun mitra." />
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {items.map((item) => {
                                    const usageRate = Number(item.restock_qty) > 0
                                        ? Math.min(100, (Number(item.sales_qty) / Number(item.restock_qty)) * 100)
                                        : 0;
                                    return (
                                        <article key={item.stock_item_id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                            <div className="mb-4 flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <h3 className="truncate font-semibold text-slate-900">{item.name}</h3>
                                                    <p className="mt-0.5 text-xs text-slate-500">{formatRupiah(item.restock_price)} per {formatQty(item.min_restock_qty, item.unit_name)}</p>
                                                </div>
                                                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                    Number(item.current_stock) <= 0
                                                        ? 'bg-rose-100 text-rose-800'
                                                        : 'bg-emerald-100 text-emerald-800'
                                                }`}>
                                                    {Number(item.current_stock) <= 0 ? 'Habis' : 'Tersedia'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500">Stok outlet saat ini</p>
                                            <p className="mt-1 text-2xl font-bold text-slate-900">{formatQty(item.current_stock, item.unit_name)}</p>
                                            <div className="mt-4">
                                                <div className="mb-1.5 flex justify-between text-xs">
                                                    <span className="text-slate-500">Pemakaian dari restok periode ini</span>
                                                    <span className="font-semibold text-slate-700">{usageRate.toFixed(0)}%</span>
                                                </div>
                                                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${usageRate}%` }} />
                                                </div>
                                            </div>
                                            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
                                                <div>
                                                    <p className="text-xs text-slate-500">Masuk</p>
                                                    <p className="mt-0.5 font-semibold text-sky-700">+{formatQty(item.restock_qty, item.unit_name)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500">Keluar</p>
                                                    <p className="mt-0.5 font-semibold text-rose-700">-{formatQty(item.sales_qty, item.unit_name)}</p>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <section>
                        <h2 className="mb-3 text-lg font-semibold text-slate-900">Perhatian</h2>
                        <div className="grid gap-3 md:grid-cols-3">
                            <Notice
                                icon={TruckIcon}
                                label="Pasokan menunggu gudang"
                                value={summary.pending_deliveries || 0}
                                tone="amber"
                            />
                            <Notice
                                icon={ExclamationTriangleIcon}
                                label="Pasokan memiliki selisih"
                                value={summary.different_deliveries || 0}
                                tone="rose"
                            />
                            <Notice
                                icon={BanknotesIcon}
                                label="Setoran perlu divalidasi"
                                value={summary.pending_settlements || 0}
                                tone="sky"
                            />
                        </div>
                    </section>
                </div>
            )}

            {activeTab === 'usage' && (
                <section>
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">Rekap Bahan Baku Keluar</h2>
                        <p className="mt-1 text-sm text-slate-500">Penjualan dan pengurangan stok non-penjualan pada periode terpilih.</p>
                    </div>
                    {items.length === 0 ? (
                        <EmptyState text="Belum ada aktivitas bahan baku pada periode ini." />
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {items.map((item) => (
                                <article key={item.stock_item_id} className="rounded-lg border border-slate-200 bg-white p-5">
                                    <h3 className="font-semibold text-slate-900">{item.name}</h3>
                                    <p className="mt-3 text-2xl font-bold text-slate-900">{formatQty(item.sales_qty, item.unit_name)}</p>
                                    <p className="text-xs text-slate-500">total bahan keluar</p>
                                    <div className="mt-4 grid grid-cols-2 gap-3">
                                        <div className="rounded-md bg-emerald-50 p-3">
                                            <p className="text-xs text-emerald-700">Dari penjualan</p>
                                            <p className="mt-1 font-bold text-emerald-900">{formatQty(item.sold_qty, item.unit_name)}</p>
                                        </div>
                                        <div className="rounded-md bg-rose-50 p-3">
                                            <p className="text-xs text-rose-700">Waste/lainnya</p>
                                            <p className="mt-1 font-bold text-rose-900">{formatQty(item.waste_qty, item.unit_name)}</p>
                                        </div>
                                    </div>
                                    <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-600">
                                        Nilai setoran: <strong className="text-slate-900">{formatRupiah(item.sales_subtotal)}</strong>
                                    </p>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {activeTab === 'products' && (
                <section>
                    <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Laporan Penggunaan Produk</h2>
                            <p className="mt-1 text-sm text-slate-500">Produk terjual dan waste produk jadi yang memakai bahan milik mitra.</p>
                        </div>
                        <div className="flex gap-3 text-sm">
                            <span className="font-semibold text-slate-700">{summary.products_used || 0} produk</span>
                            <span className="font-semibold text-rose-700">{formatQty(summary.product_waste, 'porsi')} waste</span>
                        </div>
                    </div>

                    {productUsage.length === 0 ? (
                        <EmptyState text="Belum ada penjualan atau waste produk pada periode ini." />
                    ) : (
                        <div className="grid gap-4 lg:grid-cols-2">
                            {productUsage.map((product) => (
                                <article key={product.product_id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <CubeIcon className="h-5 w-5 shrink-0 text-indigo-600" />
                                                <h3 className="truncate font-semibold text-slate-900">{product.name}</h3>
                                            </div>
                                            <p className="mt-1 text-xs text-slate-500">{product.transaction_count} transaksi</p>
                                        </div>
                                        <p className="shrink-0 text-sm font-bold text-slate-900">{formatRupiah(product.revenue)}</p>
                                    </div>

                                    <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200">
                                        <div className="bg-emerald-50 p-3">
                                            <p className="text-xs text-emerald-700">Terjual</p>
                                            <p className="mt-1 font-bold text-emerald-900">{formatQty(product.sold_qty, 'porsi')}</p>
                                        </div>
                                        <div className="bg-rose-50 p-3">
                                            <p className="text-xs text-rose-700">Waste</p>
                                            <p className="mt-1 font-bold text-rose-900">{formatQty(product.waste_qty, 'porsi')}</p>
                                        </div>
                                        <div className="bg-slate-50 p-3">
                                            <p className="text-xs text-slate-500">Total</p>
                                            <p className="mt-1 font-bold text-slate-900">{formatQty(product.total_usage_qty, 'porsi')}</p>
                                        </div>
                                    </div>

                                    {product.waste_by_type.length > 0 && (
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {product.waste_by_type.map((waste) => (
                                                <span key={waste.type} className="rounded bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">
                                                    {wasteTypeLabel(waste.type)}: {formatQty(waste.quantity, 'porsi')}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <div className="mt-4 border-t border-slate-100 pt-4">
                                        <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Bahan Mitra Terpakai</p>
                                        <div className="space-y-2">
                                            {product.materials.map((material) => (
                                                <div key={material.stock_item_id} className="flex items-center justify-between gap-3 text-sm">
                                                    <span className="min-w-0 truncate text-slate-600">{material.name}</span>
                                                    <div className="shrink-0 text-right">
                                                        <span className="font-semibold text-slate-900">{formatQty(material.total_usage, material.unit_name)}</span>
                                                        {Number(material.waste_usage) > 0 && (
                                                            <span className="ml-2 text-xs text-rose-600">({formatQty(material.waste_usage, material.unit_name)} waste)</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {activeTab === 'restock' && (
                <div className="space-y-8">
                    <section>
                        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Pasokan Mitra ke Gudang</h2>
                                <p className="mt-1 text-sm text-slate-500">Perbandingan catatan pasokan dengan jumlah fisik yang diterima gudang.</p>
                            </div>
                            <Link href={route('stock')} className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700">
                                <TruckIcon className="h-4 w-4" />
                                Catat Pasokan
                            </Link>
                        </div>
                        {deliveries.length === 0 ? (
                            <EmptyState text="Belum ada pasokan mitra ke gudang pada periode ini." />
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {deliveries.map((delivery) => {
                                    const badge = deliveryBadge(delivery.status);
                                    return (
                                        <article key={delivery.id} className="rounded-lg border border-slate-200 bg-white p-5">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <h3 className="truncate font-semibold text-slate-900">{delivery.stock_name}</h3>
                                                    <p className="mt-0.5 text-xs text-slate-500">{formatDate(delivery.sent_at, true)}</p>
                                                    <p className="mt-0.5 text-xs font-medium text-indigo-600">{delivery.warehouse_name || 'Gudang Pusat'}</p>
                                                </div>
                                                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
                                            </div>
                                            <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200">
                                                <div className="bg-slate-50 p-3">
                                                    <p className="text-xs text-slate-500">Dikirim</p>
                                                    <p className="mt-1 font-bold text-slate-900">{formatQty(delivery.qty_sent, delivery.unit_name)}</p>
                                                </div>
                                                <div className="bg-slate-50 p-3">
                                                    <p className="text-xs text-slate-500">Diterima</p>
                                                    <p className="mt-1 font-bold text-slate-900">{delivery.qty_received === null ? '-' : formatQty(delivery.qty_received, delivery.unit_name)}</p>
                                                </div>
                                            </div>
                                            {delivery.difference !== null && (
                                                <p className={`mt-3 text-sm font-semibold ${Math.abs(delivery.difference) < 0.0001 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                    {Math.abs(delivery.difference) < 0.0001
                                                        ? 'Jumlah sesuai'
                                                        : `Selisih ${delivery.difference > 0 ? '+' : ''}${formatQty(delivery.difference, delivery.unit_name)}`}
                                                </p>
                                            )}
                                            {delivery.receiver_name && <p className="mt-2 text-xs text-slate-500">Diperiksa oleh {delivery.receiver_name}</p>}
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <section>
                        <h2 className="mb-1 text-lg font-semibold text-slate-900">Pengambilan Stok oleh Outlet</h2>
                        <p className="mb-4 text-sm text-slate-500">Transfer gudang dan restok lain yang menambah persediaan outlet aktif.</p>
                        {restockHistory.length === 0 ? (
                            <EmptyState text="Belum ada stok yang diterima outlet pada periode ini." />
                        ) : (
                            <div className="space-y-3">
                                {restockHistory.map((restock) => (
                                    <div key={restock.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-sky-50 text-sky-700">
                                                <ArrowPathIcon className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold text-slate-900">{restock.stock_name}</p>
                                                <p className="text-xs text-slate-500">{formatDate(restock.created_at, true)}</p>
                                            </div>
                                        </div>
                                        <div className="text-left sm:text-right">
                                            <p className="font-bold text-emerald-700">+{formatQty(restock.qty_added, restock.unit_name)}</p>
                                            <p className="text-xs text-slate-500">{formatQty(restock.stock_before, restock.unit_name)} menjadi {formatQty(restock.stock_after, restock.unit_name)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            )}

            {activeTab === 'settlement' && (
                <section>
                    <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Histori Setoran</h2>
                            <p className="mt-1 text-sm text-slate-500">Periksa pengajuan owner dan status pembayarannya.</p>
                        </div>
                        <Link href={route('settlements')} className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700">
                            <CheckCircleIcon className="h-4 w-4" />
                            Buka Validasi Setoran
                        </Link>
                    </div>
                    {settlements.length === 0 ? (
                        <EmptyState text="Belum ada pengajuan setoran." />
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {settlements.map((settlement) => {
                                const badge = settlementBadge(settlement.status);
                                return (
                                    <article key={settlement.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xs text-slate-500">{formatDate(settlement.created_at)}</p>
                                                <p className="mt-1 text-xl font-bold text-slate-900">{formatRupiah(settlement.total_amount)}</p>
                                            </div>
                                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
                                        </div>
                                        <div className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-600">
                                            <p>{formatDate(settlement.period_start)} - {formatDate(settlement.period_end)}</p>
                                            <p className="mt-1">{settlement.calculation_method === 'RESTOCK' ? 'Berdasarkan stok diterima' : 'Berdasarkan bahan terpakai'}</p>
                                            {settlement.validation_note && <p className="mt-2 text-rose-700">Catatan: {settlement.validation_note}</p>}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}
        </ErpLayout>
    );
}

function EmptyState({ text }) {
    return (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
            <ChartBarIcon className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">{text}</p>
        </div>
    );
}

function Notice({ icon: Icon, label, value, tone }) {
    const tones = {
        amber: 'border-amber-200 bg-amber-50 text-amber-800',
        rose: 'border-rose-200 bg-rose-50 text-rose-800',
        sky: 'border-sky-200 bg-sky-50 text-sky-800',
    };

    return (
        <div className={`flex items-center gap-3 rounded-lg border p-4 ${tones[tone]}`}>
            <Icon className="h-6 w-6 shrink-0" />
            <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs font-medium">{label}</p>
            </div>
        </div>
    );
}
