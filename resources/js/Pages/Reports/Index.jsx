import React from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, router } from '@inertiajs/react';

function formatRupiah(value) {
    const n = Number(value) || 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

export default function ReportsIndex({ monthlyReport, dailySummary, revenue7Days, lowStockCount, currentMonth, currentYear }) {
    
    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const handleMonthChange = (e) => {
        router.get(route('reports'), { month: e.target.value, year: currentYear }, { preserveState: true });
    };

    const handleYearChange = (e) => {
        router.get(route('reports'), { month: currentMonth, year: e.target.value }, { preserveState: true });
    };

    return (
        <ErpLayout title="Laporan & Analisis">
            <Head title="Laporan" />

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold text-slate-900">Laporan & Analisis</h1>
                <div className="flex gap-2">
                    <select value={currentMonth} onChange={handleMonthChange} className="border-slate-300 rounded text-sm">
                        {months.map((m, idx) => (
                            <option key={idx} value={idx + 1}>{m}</option>
                        ))}
                    </select>
                    <select value={currentYear} onChange={handleYearChange} className="border-slate-300 rounded text-sm">
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
                        <h3 className="text-sm font-medium text-slate-700 mb-2">Penjualan 7 Hari Terakhir (Rp)</h3>
                        <div className="h-32 flex items-end gap-2 text-xs">
                            {revenue7Days.map((day, i) => {
                                const max = Math.max(...revenue7Days.map(d => Number(d.total) || 1));
                                const height = `${(Number(day.total) / max) * 100}%`;
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                                        <div className="w-full bg-indigo-200 rounded-t-sm" style={{ height: height || '10%' }}>
                                            <div className="w-full bg-indigo-500 rounded-t-sm" style={{ height: `${(Number(day.cash) / (Number(day.total) || 1)) * 100}%` }}></div>
                                        </div>
                                        <span className="text-[10px] text-slate-500">{day.date.substring(5)}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-slate-500 justify-center">
                            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-indigo-500 rounded-sm"></div> Tunai</span>
                            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-indigo-200 rounded-sm"></div> QRIS</span>
                        </div>
                    </div>
                </div>
            </div>
        </ErpLayout>
    );
}
