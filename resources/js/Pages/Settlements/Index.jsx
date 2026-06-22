import React, { useState, useMemo } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, useForm, router } from '@inertiajs/react';

export default function SettlementsIndex({ mitras, selectedMitraId, startDate, endDate, reportData, settlements, isOwner }) {
    const [activeTab, setActiveTab] = useState(isOwner ? 'create' : 'history');
    const [calcMethod, setCalcMethod] = useState('RESTOCK');
    const [viewSettlement, setViewSettlement] = useState(null);

    const { post, processing } = useForm();

    const formatRupiah = (val) => 'Rp ' + Math.round(Number(val)).toLocaleString('id-ID');
    const formatQty = (qty, minQty, unit) => {
        const paket = Number(qty) / (minQty || 1);
        return `${paket.toFixed(1)} Pkt (${Number(qty).toLocaleString('id-ID')} ${unit})`;
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        router.get(route('settlements'), {
            mitra_id: name === 'mitra_id' ? value : selectedMitraId,
            start_date: name === 'start_date' ? value : startDate,
            end_date: name === 'end_date' ? value : endDate,
        }, { preserveState: true });
    };

    // Proportional calculation (done server-side now, but keep for local recalc)
    const calcSubtotal = (qty, restockPrice, minRestockQty) => {
        const minQty = minRestockQty > 0 ? minRestockQty : 1;
        return (qty / minQty) * restockPrice;
    };

    // Calculate total based on the chosen method, using REMAINING qty (after settled deduction)
    const calculatedTotal = useMemo(() => {
        if (!reportData || reportData.length === 0) return 0;
        return reportData.reduce((sum, item) => {
            const rawQty = calcMethod === 'SALES' ? item.sales_qty : item.restock_qty;
            const remainingQty = Math.max(0, rawQty - (item.settled_qty || 0));
            return sum + calcSubtotal(remainingQty, item.restock_price, item.min_restock_qty);
        }, 0);
    }, [reportData, calcMethod]);

    const handleCreateSettlement = () => {
        if (!selectedMitraId || reportData.length === 0) {
            alert('Silakan pilih Mitra dan pastikan ada data laporan.');
            return;
        }
        if (calculatedTotal <= 0) {
            alert('Tidak ada sisa tagihan yang perlu dibuatkan struk.');
            return;
        }

        if (confirm('Buat struk setoran berdasarkan data ini?')) {
            const enrichedData = reportData.map(item => {
                const rawQty = calcMethod === 'SALES' ? item.sales_qty : item.restock_qty;
                const remainingQty = Math.max(0, rawQty - (item.settled_qty || 0));
                return {
                    ...item,
                    calculated_qty: remainingQty,
                    subtotal: calcSubtotal(remainingQty, item.restock_price, item.min_restock_qty),
                };
            });

            router.post(route('settlements.store'), {
                mitra_id: selectedMitraId,
                start_date: startDate,
                end_date: endDate,
                calculation_method: calcMethod,
                total_amount: Math.round(calculatedTotal),
                receipt_data: enrichedData,
            }, {
                onSuccess: () => {
                    setActiveTab('history');
                }
            });
        }
    };

    const handlePay = (id) => {
        if (confirm('Tandai setoran ini sebagai Lunas? Qty yang terkait akan terhitung sebagai sudah dibayar.')) {
            router.post(route('settlements.pay', id), {}, { preserveScroll: true });
        }
    };

    return (
        <ErpLayout title="Setoran Mitra">
            <Head title="Setoran Mitra" />

            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-slate-900">Sistem Setoran Mitra</h1>
                <p className="text-sm text-slate-500 mt-1">
                    {isOwner
                        ? 'Buat struk penagihan setoran berdasarkan penjualan atau histori restock.'
                        : 'Lihat riwayat setoran Anda.'}
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-slate-200">
                {isOwner && (
                    <button
                        onClick={() => setActiveTab('create')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'create' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        Buat Struk Baru
                    </button>
                )}
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'history' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Riwayat Setoran
                </button>
            </div>

            {/* ========================= CREATE TAB ========================= */}
            {activeTab === 'create' && isOwner && (
                <>
                    {/* Filters */}
                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm mb-6 flex flex-wrap gap-4 items-end">
                        <div className="min-w-[180px] flex-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Mitra</label>
                            <select
                                name="mitra_id"
                                value={selectedMitraId || ''}
                                onChange={handleFilterChange}
                                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="">- Pilih Mitra -</option>
                                {mitras.map(m => (
                                    <option key={m.id} value={m.id}>{m.display_name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Mulai</label>
                            <input
                                type="date"
                                name="start_date"
                                value={startDate}
                                onChange={handleFilterChange}
                                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Akhir</label>
                            <input
                                type="date"
                                name="end_date"
                                value={endDate}
                                onChange={handleFilterChange}
                                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    {selectedMitraId && reportData.length > 0 && (
                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                            {/* Header */}
                            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-4">
                                <div>
                                    <h3 className="font-medium text-slate-900">Rekapitulasi Aktivitas</h3>
                                    <p className="text-xs text-slate-500">{startDate} s.d. {endDate}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="text-sm font-medium text-slate-700">Metode Hitung:</label>
                                    <select
                                        value={calcMethod}
                                        onChange={e => setCalcMethod(e.target.value)}
                                        className="border border-slate-300 rounded-md px-3 py-1.5 text-sm font-medium bg-white"
                                    >
                                        <option value="RESTOCK">Berdasarkan Restock</option>
                                        <option value="SALES">Berdasarkan Penjualan</option>
                                    </select>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-slate-600">
                                    <thead className="bg-white border-b border-slate-200 text-slate-700">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Bahan</th>
                                            <th className="px-4 py-3 font-medium text-right">Harga / Paket</th>
                                            <th className={`px-4 py-3 font-medium text-right ${calcMethod === 'RESTOCK' ? 'bg-amber-50' : ''}`}>Qty Restock</th>
                                            <th className={`px-4 py-3 font-medium text-right ${calcMethod === 'SALES' ? 'bg-amber-50' : ''}`}>Qty Terjual</th>
                                            <th className="px-4 py-3 font-medium text-right">Sudah Dibayar</th>
                                            <th className="px-4 py-3 font-medium text-right bg-emerald-50">Sisa Tagihan</th>
                                            <th className="px-4 py-3 font-medium text-right bg-indigo-50">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {reportData.map(item => {
                                            const rawQty = calcMethod === 'SALES' ? item.sales_qty : item.restock_qty;
                                            const remainingQty = Math.max(0, rawQty - (item.settled_qty || 0));
                                            const subtotal = calcSubtotal(remainingQty, item.restock_price, item.min_restock_qty);
                                            return (
                                                <tr key={item.stock_item_id}>
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-slate-900">{item.name}</div>
                                                        <div className="text-xs text-slate-400">{formatRupiah(item.restock_price)} / {item.min_restock_qty} {item.unit_name}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">{formatRupiah(item.restock_price)}</td>
                                                    <td className={`px-4 py-3 text-right ${calcMethod === 'RESTOCK' ? 'bg-amber-50 font-semibold text-amber-700' : ''}`}>
                                                        {formatQty(item.restock_qty, item.min_restock_qty, item.unit_name)}
                                                    </td>
                                                    <td className={`px-4 py-3 text-right ${calcMethod === 'SALES' ? 'bg-amber-50 font-semibold text-amber-700' : ''}`}>
                                                        {formatQty(item.sales_qty, item.min_restock_qty, item.unit_name)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-slate-500">
                                                        {formatQty(item.settled_qty || 0, item.min_restock_qty, item.unit_name)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold bg-emerald-50 text-emerald-700">
                                                        {formatQty(remainingQty, item.min_restock_qty, item.unit_name)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold bg-indigo-50 text-indigo-700">
                                                        {formatRupiah(subtotal)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        <tr className="bg-slate-50 font-bold">
                                            <td colSpan="6" className="px-4 py-4 text-right text-slate-900 uppercase tracking-wide">Total Tagihan Sisa:</td>
                                            <td className="px-4 py-4 text-right text-lg text-indigo-700">{formatRupiah(calculatedTotal)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Submit */}
                            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                                <button
                                    onClick={handleCreateSettlement}
                                    disabled={processing || calculatedTotal <= 0}
                                    className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Buat Struk Setoran
                                </button>
                            </div>
                        </div>
                    )}

                    {selectedMitraId && reportData.length === 0 && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg text-center">
                            Tidak ada data aktivitas untuk mitra ini pada periode yang dipilih.
                        </div>
                    )}
                </>
            )}

            {/* ========================= HISTORY TAB ========================= */}
            {activeTab === 'history' && (
                <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                            <tr>
                                <th className="px-4 py-3 font-medium">Tanggal</th>
                                {isOwner && <th className="px-4 py-3 font-medium">Mitra</th>}
                                <th className="px-4 py-3 font-medium">Periode</th>
                                <th className="px-4 py-3 font-medium">Metode</th>
                                <th className="px-4 py-3 font-medium">Total Tagihan</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {settlements.length === 0 ? (
                                <tr>
                                    <td colSpan={isOwner ? 7 : 6} className="px-4 py-8 text-center text-slate-500">
                                        Belum ada riwayat setoran.
                                    </td>
                                </tr>
                            ) : (
                                settlements.map((s) => (
                                    <tr key={s.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 whitespace-nowrap">{new Date(s.created_at).toLocaleString('id-ID')}</td>
                                        {isOwner && <td className="px-4 py-3 font-medium text-slate-900">{s.mitra?.display_name}</td>}
                                        <td className="px-4 py-3 text-xs">
                                            {new Date(s.period_start).toLocaleDateString('id-ID')} - {new Date(s.period_end).toLocaleDateString('id-ID')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-medium">
                                                {s.calculation_method === 'RESTOCK' ? 'Restock' : 'Penjualan'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-bold text-slate-900">{formatRupiah(s.total_amount)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                                {s.status === 'PAID' ? 'LUNAS' : 'BELUM LUNAS'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 flex gap-2">
                                            <button
                                                onClick={() => setViewSettlement(s)}
                                                className="inline-flex items-center justify-center px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-md font-medium hover:bg-indigo-100 transition-colors text-xs min-h-[32px]"
                                            >
                                                Lihat
                                            </button>
                                            {isOwner && s.status === 'PENDING' && (
                                                <button
                                                    onClick={() => handlePay(s.id)}
                                                    className="inline-flex items-center justify-center px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-md font-medium hover:bg-emerald-100 transition-colors text-xs min-h-[32px]"
                                                >
                                                    Tandai Lunas
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ========================= MODAL DETAIL STRUK ========================= */}
            {viewSettlement && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 sticky top-0">
                            <h2 className="text-lg font-semibold text-slate-900">Struk Setoran Mitra</h2>
                            <button onClick={() => setViewSettlement(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
                        </div>
                        <div className="p-6">
                            <div className="text-center mb-6 border-b border-dashed border-slate-300 pb-4">
                                <h3 className="font-bold text-xl uppercase tracking-widest text-slate-800">INVOICE SETORAN</h3>
                                <p className="text-sm text-slate-500 mt-1">ID: {viewSettlement.id}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                                <div>
                                    <p className="text-slate-500 mb-1">Kepada Mitra:</p>
                                    <p className="font-bold text-slate-900 text-base">{viewSettlement.mitra?.display_name}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-slate-500 mb-1">Status:</p>
                                    <span className={`px-2 py-1 inline-block rounded text-xs font-bold uppercase ${viewSettlement.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                        {viewSettlement.status === 'PAID' ? 'LUNAS' : 'BELUM LUNAS'}
                                    </span>
                                </div>
                                <div className="col-span-2 mt-2">
                                    <p className="text-slate-500 mb-1">Periode Laporan:</p>
                                    <p className="font-medium">{new Date(viewSettlement.period_start).toLocaleDateString('id-ID')} - {new Date(viewSettlement.period_end).toLocaleDateString('id-ID')}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-slate-500 mb-1">Metode Perhitungan:</p>
                                    <p className="font-medium bg-slate-100 inline-block px-2 py-1 rounded text-xs">
                                        {viewSettlement.calculation_method === 'RESTOCK' ? 'Berdasarkan Restock' : 'Berdasarkan Penjualan'}
                                    </p>
                                </div>
                            </div>

                            <table className="w-full text-sm mb-6">
                                <thead className="border-y border-slate-200 bg-slate-50">
                                    <tr>
                                        <th className="py-2 text-left text-slate-700">Item</th>
                                        <th className="py-2 text-right text-slate-700">Qty</th>
                                        <th className="py-2 text-right text-slate-700">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {viewSettlement.receipt_data?.map((item, idx) => {
                                        const qty = item.calculated_qty !== undefined
                                            ? item.calculated_qty
                                            : (viewSettlement.calculation_method === 'SALES' ? item.sales_qty : item.restock_qty);
                                        const subtotal = item.subtotal !== undefined
                                            ? item.subtotal
                                            : calcSubtotal(qty, item.restock_price || item.mitra_price || 0, item.min_restock_qty || 1);
                                        if (Number(qty) === 0) return null;
                                        return (
                                            <tr key={idx}>
                                                <td className="py-2">
                                                    <div className="font-medium text-slate-800">{item.name}</div>
                                                    <div className="text-xs text-slate-500">
                                                        {formatRupiah(item.restock_price || item.mitra_price || 0)} / {item.min_restock_qty || 1} {item.unit_name}
                                                    </div>
                                                </td>
                                                <td className="py-2 text-right">{formatQty(qty, item.min_restock_qty, item.unit_name)}</td>
                                                <td className="py-2 text-right font-medium">{formatRupiah(subtotal)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-slate-800">
                                        <td colSpan="2" className="py-3 text-right font-bold text-slate-900 uppercase">Total Tagihan:</td>
                                        <td className="py-3 text-right font-bold text-lg text-indigo-700">{formatRupiah(viewSettlement.total_amount)}</td>
                                    </tr>
                                </tfoot>
                            </table>

                            <div className="text-center mt-8 text-xs text-slate-400">
                                <p>Dicetak pada {new Date().toLocaleString('id-ID')}</p>
                                <p className="mt-1">Terima kasih atas kerjasamanya.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </ErpLayout>
    );
}
