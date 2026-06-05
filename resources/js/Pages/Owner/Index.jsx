import ErpLayout from '@/Layouts/ErpLayout';
import { Head, router, Link } from '@inertiajs/react';

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
                {outletSummaries.map((outlet) => (
                    <div key={outlet.id} className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-5 py-4 text-white">
                            <h2 className="text-lg font-bold">{outlet.name}</h2>
                            {outlet.address && <p className="text-indigo-100 text-xs mt-0.5">{outlet.address}</p>}
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Today stats */}
                            <div>
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Penjualan Hari Ini</h3>
                                <div className="text-2xl font-bold text-slate-900">{formatRupiah(outlet.today.totalSales)}</div>
                                <div className="flex gap-4 mt-1 text-xs text-slate-500">
                                    <span>{outlet.today.transactionCount} transaksi</span>
                                    <span>Tunai: {formatRupiah(outlet.today.cashSales)}</span>
                                    <span>QRIS: {formatRupiah(outlet.today.qrisSales)}</span>
                                </div>
                            </div>

                            {/* Expenses */}
                            {Number(outlet.today.expenses) > 0 && (
                                <div className="flex justify-between items-center text-sm border-t border-slate-100 pt-3">
                                    <span className="text-slate-500">Pengeluaran Hari Ini</span>
                                    <span className="font-semibold text-rose-600">{formatRupiah(outlet.today.expenses)}</span>
                                </div>
                            )}

                            {/* Counts */}
                            <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-3">
                                <div className="text-center">
                                    <div className="text-lg font-bold text-slate-900">{outlet.products_count}</div>
                                    <div className="text-xs text-slate-500">Produk</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg font-bold text-slate-900">{outlet.stock_items_count}</div>
                                    <div className="text-xs text-slate-500">Bahan</div>
                                </div>
                                <div className="text-center">
                                    <div className={`text-lg font-bold ${outlet.low_stock_count > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        {outlet.low_stock_count}
                                    </div>
                                    <div className="text-xs text-slate-500">Stok Alert</div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="border-t border-slate-100 pt-3 mt-4">
                                <Link
                                    href={route('outlet.set')}
                                    method="post"
                                    as="button"
                                    data={{ outlet_id: outlet.id }}
                                    className="w-full text-center block text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 py-2 rounded-md transition-colors"
                                >
                                    Inspeksi Detail Outlet &rarr;
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
