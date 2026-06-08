import { useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, useForm, router } from '@inertiajs/react';

export default function OutletsIndex({ outlets }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOutlet, setEditingOutlet] = useState(null);

    const { data, setData, post, processing, errors, reset } = useForm({
        id: '',
        name: '',
        address: '',
        phone: '',
        logo: null,
    });

    const openModal = (outlet = null) => {
        if (outlet) {
            setEditingOutlet(outlet);
            setData({ id: outlet.id, name: outlet.name, address: outlet.address || '', phone: outlet.phone || '', logo: null });
        } else {
            setEditingOutlet(null);
            reset();
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        reset();
        setEditingOutlet(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('id', data.id);
        formData.append('name', data.name);
        formData.append('address', data.address);
        formData.append('phone', data.phone);
        if (data.logo) {
            formData.append('logo', data.logo);
        }
        post(route('outlets.store'), {
            data: formData,
            onSuccess: () => closeModal(),
            forceFormData: true,
        });
    };

    const handleDelete = (id) => {
        if (confirm('Yakin ingin menghapus outlet ini? Semua data terkait (produk, stok, transaksi) akan ikut terhapus!')) {
            router.delete(route('outlets.destroy', id));
        }
    };

    return (
        <ErpLayout title="Manajemen Outlet">
            <Head title="Outlet" />

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold text-slate-900">Manajemen Outlet</h1>
                <button onClick={() => openModal()} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium">
                    + Tambah Outlet
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {outlets.map((o) => (
                    <div key={o.id} className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
                        {o.logo && (
                            <div className="h-32 bg-slate-50 flex items-center justify-center p-4">
                                <img src={`/storage/${o.logo}`} alt={o.name} className="max-h-full max-w-full object-contain" onError={(e) => { e.target.style.display = 'none'; console.log('Logo load error:', o.logo); }} />
                            </div>
                        )}
                        <div className="px-5 py-4 border-b border-slate-100">
                            <h2 className="text-lg font-bold text-slate-900">{o.name}</h2>
                            {o.address && <p className="text-xs text-slate-500 mt-0.5">{o.address}</p>}
                            {o.phone && <p className="text-xs text-slate-500">{o.phone}</p>}
                        </div>
                        <div className="grid grid-cols-3 gap-2 px-5 py-4">
                            <div className="text-center">
                                <div className="text-lg font-bold text-slate-900">{o.products_count}</div>
                                <div className="text-xs text-slate-500">Produk</div>
                            </div>
                            <div className="text-center">
                                <div className="text-lg font-bold text-slate-900">{o.stock_items_count}</div>
                                <div className="text-xs text-slate-500">Bahan</div>
                            </div>
                            <div className="text-center">
                                <div className="text-lg font-bold text-slate-900">{o.users_count}</div>
                                <div className="text-xs text-slate-500">User</div>
                            </div>
                        </div>
                        <div className="px-5 py-3 border-t border-slate-100 flex gap-2 justify-end">
                            <button onClick={() => openModal(o)} className="inline-flex items-center justify-center px-3 py-2 bg-indigo-50 text-indigo-600 rounded-md font-medium hover:bg-indigo-100 transition-colors min-h-[36px] active:scale-[0.98]">Edit</button>
                            <button onClick={() => handleDelete(o.id)} className="inline-flex items-center justify-center px-3 py-2 bg-rose-50 text-rose-600 rounded-md font-medium hover:bg-rose-100 transition-colors min-h-[36px] active:scale-[0.98]">Hapus</button>
                        </div>
                    </div>
                ))}
            </div>

            {outlets.length === 0 && (
                <div className="text-center text-slate-500 mt-10">Belum ada outlet.</div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-slate-900">{editingOutlet ? 'Edit Outlet' : 'Tambah Outlet'}</h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Outlet</label>
                                <input type="text" value={data.name} onChange={e => setData('name', e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
                                {errors.name && <p className="text-rose-500 text-xs mt-1">{errors.name}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Alamat</label>
                                <textarea value={data.address} onChange={e => setData('address', e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" rows="2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Telepon</label>
                                <input type="text" value={data.phone} onChange={e => setData('phone', e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Logo</label>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/jpg,image/gif"
                                    onChange={e => setData('logo', e.target.files[0])}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                />
                                {errors.logo && <p className="text-rose-500 text-xs mt-1">{errors.logo}</p>}
                                {editingOutlet?.logo && !data.logo && (
                                    <p className="text-xs text-slate-500 mt-1">
                                        Logo saat ini: <img src={`/storage/${editingOutlet.logo}`} alt="Current logo" className="inline-block h-8 w-8 object-contain" />
                                    </p>
                                )}
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
