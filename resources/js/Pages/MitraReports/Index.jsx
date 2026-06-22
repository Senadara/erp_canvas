import React, { useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, router } from '@inertiajs/react';

export default function MitraReportsIndex({ reportData, startDate, endDate }) {
    const [calcMethod, setCalcMethod] = useState('RESTOCK');

    const formatRupiah = (val) => 'Rp ' + Math.round(Number(val)).toLocaleString('id-ID');
    const formatQty = (qty, minQty, unit) => {
        const paket = Number(qty) / (minQty || 1);
        return `${paket.toFixed(1)} Pkt (${Number(qty).toLocaleString('id-ID')} ${unit})`;
    };

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
                <h1 className="text-2xl font-semibold text-slate-900">Laporan Aktivitas Stok & Tagihan</h1>
                <p className="text-sm text-slate-500 mt-1">Pantau jumlah restock, estimasi penjualan, dan status pembayaran stok Anda.</p>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm mb-6 flex flex-wrap gap-4 items-end justify-between">
                <div className="flex flex-wrap gap-4">
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
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Simulasi Perhitungan Berdasarkan:</label>
                    <select 
                        value={calcMethod} 
                        onChange={e => setCalcMethod(e.target.value)}
                        className="border border-slate-300 rounded-md px-3 py-2 text-sm font-medium bg-white focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="RESTOCK">Restock (Qty Diambil)</option>
                        <option value="SALES">Sales (Estimasi Qty Terjual)</option>
                    </select>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                        <tr>
                            <th className="px-4 py-3 font-medium">Bahan Stok</th>
                            <th className="px-4 py-3 font-medium text-right">Harga Admin</th>
                            <th className="px-4 py-3 font-medium text-right">Stok Saat Ini</th>
                            <th className={`px-4 py-3 font-medium text-right ${calcMethod === 'RESTOCK' ? 'bg-amber-50' : ''}`}>Qty Restock</th>
                            <th className={`px-4 py-3 font-medium text-right ${calcMethod === 'SALES' ? 'bg-amber-50' : ''}`}>Qty Terjual (Est)</th>
                            <th className="px-4 py-3 font-medium text-right">Telah Dibayar</th>
                            <th className="px-4 py-3 font-medium text-right bg-emerald-50">Sisa Belum Bayar</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {reportData.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
                                    Tidak ada data untuk periode ini. Pastikan Anda memiliki bahan stok yang di-scope untuk Anda.
                                </td>
                            </tr>
                        ) : (
                            reportData.map((item) => {
                                const rawQty = calcMethod === 'SALES' ? item.sales_qty : item.restock_qty;
                                const remainingQty = Math.max(0, rawQty - (item.settled_qty || 0));

                                return (
                                    <tr key={item.stock_item_id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="font-medium text-amber-700">{formatRupiah(item.restock_price || 0)}</div>
                                            <div className="text-xs text-slate-400">/ {item.min_restock_qty || 1} {item.unit_name}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-slate-700">{item.current_stock} {item.unit_name}</td>
                                        <td className={`px-4 py-3 text-right ${calcMethod === 'RESTOCK' ? 'bg-amber-50 font-semibold text-amber-700' : ''}`}>
                                            {formatQty(item.restock_qty, item.min_restock_qty, item.unit_name)}
                                        </td>
                                        <td className={`px-4 py-3 text-right ${calcMethod === 'SALES' ? 'bg-amber-50 font-semibold text-amber-700' : ''}`}>
                                            {formatQty(item.sales_qty, item.min_restock_qty, item.unit_name)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-500 font-medium">
                                            {formatQty(item.settled_qty || 0, item.min_restock_qty, item.unit_name)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold bg-emerald-50 text-emerald-700">
                                            {formatQty(remainingQty, item.min_restock_qty, item.unit_name)}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {reportData.length > 0 && (
                <div className="mt-6 bg-blue-50 border border-blue-200 p-4 rounded-lg">
                    <p className="text-sm text-blue-800">
                        <span className="font-semibold">Catatan:</span> Qty Terjual (Estimasi) dihitung berdasarkan jumlah penjualan menu yang mengandung bahan stok Anda, dikalikan dengan rasio konversi resep yang telah diatur. Sisa Belum Bayar adalah total dari Qty dikurangi jumlah yang sudah disetorkan (status Lunas) pada periode ini.
                    </p>
                </div>
            )}
        </ErpLayout>
    );
}
