import React from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, router } from '@inertiajs/react';

export default function MitraReportsIndex({ reportData, startDate, endDate }) {
    const handleDateChange = (e) => {
        const { name, value } = e.target;
        router.get(route('mitra-reports'), {
            start_date: name === 'start_date' ? value : startDate,
            end_date: name === 'end_date' ? value : endDate,
        }, { preserveState: true });
    };

    return (
        <ErpLayout title="Laporan Mitra">
            <Head title="Laporan Mitra" />

            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-slate-900">Laporan Aktivitas Stok</h1>
                <p className="text-sm text-slate-500 mt-1">Pantau jumlah restock dan estimasi penjualan dari stok Anda.</p>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm mb-6 flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Mulai</label>
                    <input 
                        type="date" 
                        name="start_date"
                        value={startDate} 
                        onChange={handleDateChange}
                        className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Akhir</label>
                    <input 
                        type="date" 
                        name="end_date"
                        value={endDate} 
                        onChange={handleDateChange}
                        className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                        <tr>
                            <th className="px-4 py-3 font-medium">Bahan Stok</th>
                            <th className="px-4 py-3 font-medium">Harga Master (HPP)</th>
                            <th className="px-4 py-3 font-medium">Qty Restock</th>
                            <th className="px-4 py-3 font-medium">Qty Terjual (Estimasi)</th>
                            <th className="px-4 py-3 font-medium">Stok Saat Ini</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {reportData.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-4 py-8 text-center text-slate-500">
                                    Tidak ada data untuk periode ini. Pastikan Anda memiliki bahan stok yang di-scope untuk Anda.
                                </td>
                            </tr>
                        ) : (
                            reportData.map((item) => (
                                <tr key={item.stock_item_id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                                    <td className="px-4 py-3 font-medium text-amber-700">Rp {item.mitra_price.toLocaleString('id-ID')}</td>
                                    <td className="px-4 py-3 text-emerald-600 font-semibold">{item.restock_qty} {item.unit_name}</td>
                                    <td className="px-4 py-3 text-indigo-600 font-semibold">{item.sales_qty} {item.unit_name}</td>
                                    <td className="px-4 py-3 font-semibold">{item.current_stock} {item.unit_name}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {reportData.length > 0 && (
                <div className="mt-6 bg-blue-50 border border-blue-200 p-4 rounded-lg">
                    <p className="text-sm text-blue-800">
                        <span className="font-semibold">Catatan:</span> Qty Terjual (Estimasi) dihitung berdasarkan jumlah penjualan menu yang mengandung bahan stok Anda, dikalikan dengan rasio konversi resep yang telah diatur.
                    </p>
                </div>
            )}
        </ErpLayout>
    );
}
