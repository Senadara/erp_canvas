import { useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, useForm, router } from '@inertiajs/react';

export default function SuppliersIndex({ suppliers, stockItems }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);

    const { data, setData, post, processing, errors, reset } = useForm({
        id: '',
        name: '',
        phone: '',
        address: '',
        stock_item_ids: [],
    });

    const openModal = (supplier = null) => {
        if (supplier) {
            setEditingSupplier(supplier);
            // find which stock items belong to this supplier
            const assignedStockIds = stockItems.filter(s => s.supplier_id === supplier.id).map(s => s.id);
            setData({
                id: supplier.id,
                name: supplier.name,
                phone: supplier.phone || '',
                address: supplier.address || '',
                stock_item_ids: assignedStockIds,
            });
        } else {
            setEditingSupplier(null);
            reset();
            setData('stock_item_ids', []);
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        reset();
        setEditingSupplier(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route('suppliers.store'), {
            onSuccess: () => closeModal()
        });
    };

    const handleDelete = (id) => {
        if (confirm('Yakin ingin menghapus supplier ini?')) {
            router.delete(route('suppliers.destroy', id));
        }
    };

    return (
        <ErpLayout title="Manajemen Supplier">
            <Head title="Supplier" />

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold text-slate-900">Manajemen Supplier</h1>
                <button
                    onClick={() => openModal()}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium"
                >
                    + Tambah Supplier
                </button>
            </div>

            <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                        <tr>
                            <th className="px-4 py-3 font-medium">Nama Supplier</th>
                            <th className="px-4 py-3 font-medium">Telepon</th>
                            <th className="px-4 py-3 font-medium">Alamat</th>
                            <th className="px-4 py-3 font-medium text-right">Jml Bahan</th>
                            <th className="px-4 py-3 font-medium">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {suppliers.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-4 py-8 text-center text-slate-500">
                                    Belum ada supplier.
                                </td>
                            </tr>
                        ) : (
                            suppliers.map((s) => (
                                <tr key={s.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                                    <td className="px-4 py-3">{s.phone || '-'}</td>
                                    <td className="px-4 py-3 max-w-xs truncate">{s.address || '-'}</td>
                                    <td className="px-4 py-3 text-right">
                                        <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-medium">
                                            {s.stock_items_count} bahan
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 flex gap-2">
                                        <button onClick={() => openModal(s)} className="inline-flex items-center justify-center px-3 py-2 bg-indigo-50 text-indigo-600 rounded-md font-medium hover:bg-indigo-100 transition-colors min-h-[36px] active:scale-[0.98]">Edit</button>
                                        <button onClick={() => handleDelete(s.id)} className="inline-flex items-center justify-center px-3 py-2 bg-rose-50 text-rose-600 rounded-md font-medium hover:bg-rose-100 transition-colors min-h-[36px] active:scale-[0.98]">Hapus</button>
                                    </td>
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
                            <h2 className="text-lg font-semibold text-slate-900">
                                {editingSupplier ? 'Edit Supplier' : 'Tambah Supplier'}
                            </h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Supplier</label>
                                <input type="text" value={data.name} onChange={e => setData('name', e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
                                {errors.name && <p className="text-rose-500 text-xs mt-1">{errors.name}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">No. Telepon</label>
                                <input type="text" value={data.phone} onChange={e => setData('phone', e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Alamat</label>
                                <textarea value={data.address} onChange={e => setData('address', e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" rows="3" />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Bahan yang Disuplai</label>
                                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded p-3 space-y-2 bg-slate-50">
                                    {stockItems.length === 0 ? (
                                        <p className="text-sm text-slate-500">Belum ada bahan di outlet ini.</p>
                                    ) : (
                                        stockItems.map(s => (
                                            <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={data.stock_item_ids.includes(s.id)} 
                                                    onChange={e => {
                                                        const isChecked = e.target.checked;
                                                        setData('stock_item_ids', isChecked 
                                                            ? [...data.stock_item_ids, s.id] 
                                                            : data.stock_item_ids.filter(id => id !== s.id)
                                                        );
                                                    }}
                                                    className="rounded border-slate-300 text-indigo-600" 
                                                />
                                                {s.name}
                                                {s.supplier_id && s.supplier_id !== data.id && (
                                                    <span className="text-xs text-amber-600 ml-1">(Beralih dari supplier lain)</span>
                                                )}
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-slate-200">
                                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">Batal</button>
                                <button type="submit" disabled={processing} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">
                                    {processing ? 'Menyimpan...' : 'Simpan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </ErpLayout>
    );
}
