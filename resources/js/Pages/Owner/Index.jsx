import ErpLayout from '@/Layouts/ErpLayout';
import { Head, router, Link } from '@inertiajs/react';

import {
    BuildingStorefrontIcon,
    ArrowRightIcon,
    CubeIcon,
    ArchiveBoxIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

function formatRupiah(value) {
    const n = Number(value) || 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

export default function OwnerIndex({ outletSummaries }) {
    return (
        <ErpLayout title="Owner Dashboard">
            <Head title="Owner" />

            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-slate-900">Owner Dashboard</h1>
                <p className="text-sm text-slate-500 mt-1">Ringkasan seluruh outlet Anda hari ini.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {outletSummaries.map((outlet, i) => (
                    <div 
                        key={outlet.id} 
                        className="group bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 animate-slide-up"
                        style={{ animationDelay: `${i * 100}ms` }}
                    >
                        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-600 px-6 py-5 text-white">
                            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white opacity-10 blur-xl transition-all duration-500 group-hover:scale-150" />
                            <div className="relative flex items-start gap-4">
                                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                                    <BuildingStorefrontIcon className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-display font-bold tracking-tight">{outlet.name}</h2>
                                    {outlet.address && <p className="text-indigo-100 text-xs mt-1 opacity-90">{outlet.address}</p>}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Today stats */}
                            <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100">
                                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Penjualan Hari Ini</h3>
                                <div className="text-3xl font-bold text-slate-900 tracking-tight">{formatRupiah(outlet.today.totalSales)}</div>
                                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-xs font-medium text-slate-600">
                                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>{outlet.today.transactionCount} transaksi</span>
                                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Tunai: {formatRupiah(outlet.today.cashSales)}</span>
                                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>QRIS: {formatRupiah(outlet.today.qrisSales)}</span>
                                </div>
                            </div>

                            {/* Expenses */}
                            {Number(outlet.today.expenses) > 0 && (
                                <div className="flex justify-between items-center text-sm bg-rose-50 rounded-lg px-4 py-3 border border-rose-100">
                                    <span className="text-rose-700 font-medium">Pengeluaran</span>
                                    <span className="font-bold text-rose-600">{formatRupiah(outlet.today.expenses)}</span>
                                </div>
                            )}

                            {/* Counts */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100 transition-colors group-hover:bg-slate-100/50">
                                    <CubeIcon className="h-5 w-5 mx-auto text-slate-400 mb-1" />
                                    <div className="text-lg font-bold text-slate-900">{outlet.products_count}</div>
                                    <div className="text-[10px] uppercase font-bold text-slate-400">Produk</div>
                                </div>
                                <div className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100 transition-colors group-hover:bg-slate-100/50">
                                    <ArchiveBoxIcon className="h-5 w-5 mx-auto text-slate-400 mb-1" />
                                    <div className="text-lg font-bold text-slate-900">{outlet.stock_items_count}</div>
                                    <div className="text-[10px] uppercase font-bold text-slate-400">Bahan</div>
                                </div>
                                <div className={`text-center p-3 rounded-xl border transition-colors ${outlet.low_stock_count > 0 ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100 group-hover:bg-slate-100/50'}`}>
                                    <ExclamationTriangleIcon className={`h-5 w-5 mx-auto mb-1 ${outlet.low_stock_count > 0 ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`} />
                                    <div className={`text-lg font-bold ${outlet.low_stock_count > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                                        {outlet.low_stock_count}
                                    </div>
                                    <div className={`text-[10px] uppercase font-bold ${outlet.low_stock_count > 0 ? 'text-rose-500' : 'text-slate-400'}`}>Stok Alert</div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="pt-2">
                                <Link
                                    href={route('outlet.set')}
                                    method="post"
                                    as="button"
                                    data={{ outlet_id: outlet.id }}
                                    className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white py-2.5 rounded-xl transition-all duration-300"
                                >
                                    Inspeksi Outlet <ArrowRightIcon className="h-4 w-4" />
                                </Link>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {outletSummaries.length === 0 && (
                <div className="text-center text-slate-500 mt-10">
                    <p className="text-lg">Belum ada outlet terdaftar.</p>
                </div>
            )}
        </ErpLayout>
    );
}
