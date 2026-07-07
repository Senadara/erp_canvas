import { useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, useForm } from '@inertiajs/react';

function formatRupiah(value) {
    const n = Number(value) || 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

const wasteTypes = [
    { value: 'EXPIRED', label: 'Basi / Expired' },
    { value: 'OWNER_REQUEST', label: 'Permintaan Owner' },
    { value: 'DAMAGED', label: 'Rusak / Tumpah' },
    { value: 'OTHER', label: 'Lainnya' },
];

function wasteTypeLabel(value) {
    return wasteTypes.find(type => type.value === value)?.label || value || 'Lainnya';
}

export default function WasteIndex({ wasteLogs, stockItems, products = [], summary = {} }) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        source_type: 'STOCK',
        stock_item_id: '',
        product_id: '',
        qty_biji: '',
        qty_porsi: '',
        waste_type: 'EXPIRED',
        reason: '',
    });

    const closeModal = () => {
        setIsModalOpen(false);
        reset();
    };

    const openModal = () => {
        reset();
        setIsModalOpen(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route('waste.store'), {
            preserveScroll: true,
            onSuccess: () => closeModal(),
        });
    };

    const selectedStock = stockItems.find(s => s.id === data.stock_item_id);
    const selectedProduct = products.find(p => p.id === data.product_id);
    const byType = summary.by_type || [];

    return (
        <ErpLayout title="Pencatatan Waste">
            <Head title="Waste" />

            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Pencatatan Waste</h1>
                    <p className="mt-1 text-sm text-slate-500">Catat pengurangan stok non-penjualan, termasuk produk jadi untuk permintaan owner.</p>
                </div>
                <button
                    onClick={openModal}
                    className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                >
                    + Catat Waste
                </button>
            </div>

            <div className="mb-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-rose-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase text-rose-600">Total Kerugian</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{formatRupiah(summary.total_loss)}</p>
                    <p className="mt-1 text-xs text-slate-500">{summary.total_count || 0} baris pengurangan stok</p>
                </div>
                {wasteTypes.slice(0, 2).map(type => {
                    const row = byType.find(item => item.type === type.value);
                    return (
                        <div key={type.value} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                            <p className="text-xs font-semibold uppercase text-slate-500">{type.label}</p>
                            <p className="mt-2 text-2xl font-bold text-slate-900">{formatRupiah(row?.loss_amount)}</p>
                            <p className="mt-1 text-xs text-slate-500">{row?.count || 0} catatan</p>
                        </div>
                    );
                })}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
                            <tr>
                                <th className="px-4 py-3 font-medium">Tanggal</th>
                                <th className="px-4 py-3 font-medium">Tipe</th>
                                <th className="px-4 py-3 font-medium">Item</th>
                                <th className="px-4 py-3 font-medium text-right">Stok Berkurang</th>
                                <th className="px-4 py-3 font-medium text-right">Kerugian</th>
                                <th className="px-4 py-3 font-medium">Keterangan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {wasteLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-4 py-8 text-center text-slate-500">
                                        Belum ada catatan waste.
                                    </td>
                                </tr>
                            ) : (
                                wasteLogs.map((w) => (
                                    <tr key={w.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 whitespace-nowrap">{new Date(w.created_at).toLocaleString('id-ID')}</td>
                                        <td className="px-4 py-3">
                                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${w.waste_type === 'OWNER_REQUEST' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                                                {wasteTypeLabel(w.waste_type)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-slate-900">{w.source_type === 'PRODUCT' ? (w.product_name || w.product?.name) : w.stock_item?.name}</div>
                                            {w.source_type === 'PRODUCT' && (
                                                <div className="text-xs text-slate-500">
                                                    {Number(w.qty_porsi || 0).toLocaleString('id-ID')} porsi, bahan: {w.stock_item?.name || '-'}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-rose-600">
                                            -{Number(w.qty_biji).toFixed(2)} {w.stock_item?.unit_name || ''}
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatRupiah(w.loss_amount)}</td>
                                        <td className="px-4 py-3">{w.reason}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                            <h2 className="text-lg font-semibold text-slate-900">Catat Waste</h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4 p-6">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">Bentuk Pengurangan</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { value: 'STOCK', label: 'Bahan Stok' },
                                        { value: 'PRODUCT', label: 'Produk Jadi' },
                                    ].map(option => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setData({
                                                ...data,
                                                source_type: option.value,
                                                stock_item_id: '',
                                                product_id: '',
                                                qty_biji: '',
                                                qty_porsi: '',
                                            })}
                                            className={`rounded-md border px-3 py-2 text-sm font-semibold ${data.source_type === option.value ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-300 text-slate-600'}`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Tipe Waste</label>
                                <select
                                    value={data.waste_type}
                                    onChange={e => setData('waste_type', e.target.value)}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                    required
                                >
                                    {wasteTypes.map(type => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                </select>
                                {errors.waste_type && <p className="mt-1 text-xs text-rose-500">{errors.waste_type}</p>}
                            </div>

                            {data.source_type === 'STOCK' ? (
                                <>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700">Bahan Stok</label>
                                        <select
                                            value={data.stock_item_id}
                                            onChange={e => setData('stock_item_id', e.target.value)}
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                            required
                                        >
                                            <option value="">-- Pilih bahan --</option>
                                            {stockItems.map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name} (sisa: {Number(s.current_stock_biji).toFixed(2)} {s.unit_name})
                                                </option>
                                            ))}
                                        </select>
                                        {errors.stock_item_id && <p className="mt-1 text-xs text-rose-500">{errors.stock_item_id}</p>}
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700">
                                            Jumlah {selectedStock ? `(${selectedStock.unit_name})` : ''}
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            value={data.qty_biji}
                                            onChange={e => setData('qty_biji', e.target.value)}
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                            required
                                        />
                                        {errors.qty_biji && <p className="mt-1 text-xs text-rose-500">{errors.qty_biji}</p>}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700">Produk Jadi</label>
                                        <select
                                            value={data.product_id}
                                            onChange={e => setData('product_id', e.target.value)}
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                            required
                                        >
                                            <option value="">-- Pilih produk --</option>
                                            {products.map(product => (
                                                <option key={product.id} value={product.id}>{product.name}</option>
                                            ))}
                                        </select>
                                        {errors.product_id && <p className="mt-1 text-xs text-rose-500">{errors.product_id}</p>}
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700">Jumlah Produk (porsi)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            value={data.qty_porsi}
                                            onChange={e => setData('qty_porsi', e.target.value)}
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                            required
                                        />
                                        {errors.qty_porsi && <p className="mt-1 text-xs text-rose-500">{errors.qty_porsi}</p>}
                                    </div>

                                    {selectedProduct?.conversions?.length > 0 && (
                                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                                            <p className="mb-2 font-semibold text-slate-700">Bahan yang akan dikurangi:</p>
                                            <div className="space-y-1">
                                                {selectedProduct.conversions.map(conversion => (
                                                    <div key={conversion.id} className="flex justify-between gap-3">
                                                        <span>{conversion.stock_item?.name || '-'}</span>
                                                        <span>{Number(conversion.ratio || 0) * Number(data.qty_porsi || 0)} {conversion.stock_item?.unit_name || ''}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Alasan / Keterangan</label>
                                <textarea
                                    value={data.reason}
                                    onChange={e => setData('reason', e.target.value)}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                    rows="2"
                                    placeholder="Contoh: batch basi, request owner, rusak saat produksi"
                                    required
                                />
                                {errors.reason && <p className="mt-1 text-xs text-rose-500">{errors.reason}</p>}
                                {errors.error && <p className="mt-1 text-xs text-rose-500">{errors.error}</p>}
                            </div>

                            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                                <button type="button" onClick={closeModal} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Batal</button>
                                <button type="submit" disabled={processing} className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50">
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
