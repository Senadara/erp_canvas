import { useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, useForm } from '@inertiajs/react';

export default function WasteIndex({ wasteLogs, stockItems }) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        stock_item_id: '',
        qty_biji: '',
        reason: '',
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route('waste.store'), {
            onSuccess: () => {
                setIsModalOpen(false);
                reset();
            }
        });
    };

    const selectedStock = stockItems.find(s => s.id === data.stock_item_id);

    return (
        <ErpLayout title="Pencatatan Waste">
            <Head title="Waste" />

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold text-slate-900">Pencatatan Waste / Buang</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-rose-600 text-white px-4 py-2 rounded-md hover:bg-rose-700 text-sm font-medium"
                >
                    + Catat Waste
                </button>
            </div>

            <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                        <tr>
                            <th className="px-4 py-3 font-medium">Tanggal</th>
                            <th className="px-4 py-3 font-medium">Bahan</th>
                            <th className="px-4 py-3 font-medium text-right">Jumlah</th>
                            <th className="px-4 py-3 font-medium">Alasan</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {wasteLogs.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="px-4 py-8 text-center text-slate-500">
                                    Belum ada catatan waste.
                                </td>
                            </tr>
                        ) : (
                            wasteLogs.map((w) => (
                                <tr key={w.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 whitespace-nowrap">{new Date(w.created_at).toLocaleString('id-ID')}</td>
                                    <td className="px-4 py-3 font-medium text-slate-900">{w.stock_item?.name || '-'}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-rose-600">
                                        -{Number(w.qty_biji).toFixed(2)} {w.stock_item?.unit_name || ''}
                                    </td>
                                    <td className="px-4 py-3">{w.reason}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-slate-900">Catat Waste / Buang Bahan</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Bahan Stok</label>
                                <select
                                    value={data.stock_item_id}
                                    onChange={e => setData('stock_item_id', e.target.value)}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                    required
                                >
                                    <option value="">-- Pilih bahan --</option>
                                    {stockItems.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} (sisa: {Number(s.current_stock_biji).toFixed(2)} {s.unit_name})
                                        </option>
                                    ))}
                                </select>
                                {errors.stock_item_id && <p className="text-rose-500 text-xs mt-1">{errors.stock_item_id}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Jumlah yang dibuang {selectedStock ? `(${selectedStock.unit_name})` : ''}
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={data.qty_biji}
                                    onChange={e => setData('qty_biji', e.target.value)}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                    required
                                />
                                {errors.qty_biji && <p className="text-rose-500 text-xs mt-1">{errors.qty_biji}</p>}
                                {errors.error && <p className="text-rose-500 text-xs mt-1">{errors.error}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Alasan / Keterangan</label>
                                <textarea
                                    value={data.reason}
                                    onChange={e => setData('reason', e.target.value)}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                    rows="2"
                                    placeholder="Misal: kadaluarsa, rusak, tumpah"
                                    required
                                />
                                {errors.reason && <p className="text-rose-500 text-xs mt-1">{errors.reason}</p>}
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-slate-200">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">Batal</button>
                                <button type="submit" disabled={processing} className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-md hover:bg-rose-700 disabled:opacity-50">
                                    {processing ? 'Menyimpan...' : 'Catat Waste'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </ErpLayout>
    );
}
