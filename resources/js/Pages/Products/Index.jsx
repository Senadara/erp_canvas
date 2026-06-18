import { useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, useForm, router } from '@inertiajs/react';

function formatRupiah(value) {
    const n = Number(value) || 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

export default function ProductsIndex({ products, displayGroups, stockItems }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isBomModalOpen, setIsBomModalOpen] = useState(false);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [filterGroup, setFilterGroup] = useState('');

    const { data, setData, post, processing, errors, reset } = useForm({
        id: '',
        name: '',
        category: '',
        price: '',
        hpp: '',
        is_active: true,
        display_group_id: '',
        image: null,
        image_url: '',
    });

    const { data: bomData, setData: setBomData, post: postBom, processing: bomProcessing, reset: resetBom } = useForm({
        conversions: [],
    });

    const { data: groupData, setData: setGroupData, post: postGroup, processing: groupProcessing, reset: resetGroup } = useForm({
        name: '',
        context: 'PRODUCT',
    });

    const openModal = (product = null) => {
        if (product) {
            setEditingProduct(product);
            setData({
                id: product.id,
                name: product.name,
                category: product.category,
                price: product.price,
                hpp: product.hpp,
                is_active: product.is_active,
                display_group_id: product.display_group_id || '',
                image: null,
                image_url: product.image_url || '',
            });
        } else {
            setEditingProduct(null);
            reset();
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        reset();
        setEditingProduct(null);
    };

    const openBomModal = (product) => {
        setEditingProduct(product);
        // Load existing conversions if any
        setBomData('conversions', product.conversions || []);
        setIsBomModalOpen(true);
    };

    const closeBomModal = () => {
        setIsBomModalOpen(false);
        setEditingProduct(null);
        resetBom();
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route('products.store'), {
            onSuccess: () => closeModal(),
        });
    };

    const handleDelete = (id) => {
        if (confirm('Yakin ingin menghapus produk ini?')) {
            router.delete(route('products.destroy', id));
        }
    };

    const handleBomSubmit = (e) => {
        e.preventDefault();
        postBom(route('products.conversions', editingProduct.id), {
            onSuccess: () => closeBomModal(),
        });
    };

    const addConversion = () => {
        setBomData('conversions', [...bomData.conversions, { stock_item_id: '', ratio: '', initial_stock: '' }]);
    };

    const updateConversion = (index, field, value) => {
        const newConversions = [...bomData.conversions];
        newConversions[index][field] = value;
        setBomData('conversions', newConversions);
    };

    const removeConversion = (index) => {
        const newConversions = [...bomData.conversions];
        newConversions.splice(index, 1);
        setBomData('conversions', newConversions);
    };

    const handleGroupSubmit = (e) => {
        e.preventDefault();
        postGroup(route('display-groups.store'), {
            onSuccess: () => {
                resetGroup();
                setIsGroupModalOpen(false);
            },
        });
    };

    const handleGroupDelete = (id) => {
        if (confirm('Yakin ingin menghapus kategori ini?')) {
            router.delete(route('display-groups.destroy', id));
        }
    };

    const filteredProducts = filterGroup 
        ? products.filter(p => p.display_group_id === filterGroup)
        : products;

    return (
        <ErpLayout title="Produk">
            <Head title="Produk" />

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold text-slate-900">Manajemen Produk</h1>
                <button
                    onClick={() => openModal()}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium"
                >
                    + Tambah Produk
                </button>
            </div>

            {/* Filter Section */}
            <div className="mb-4 flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-slate-700">Filter Group:</label>
                    <select 
                        value={filterGroup} 
                        onChange={e => setFilterGroup(e.target.value)}
                        className="border border-slate-300 rounded-md px-3 py-1.5 text-sm min-w-[200px]"
                    >
                        <option value="">Semua Group</option>
                        {displayGroups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={() => setIsGroupModalOpen(true)}
                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                    Kelola Group
                </button>
            </div>

            <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                        <tr>
                            <th className="px-4 py-3 font-medium">Nama Produk</th>
                            <th className="px-4 py-3 font-medium">Kategori</th>
                            <th className="px-4 py-3 font-medium">Harga</th>
                            <th className="px-4 py-3 font-medium">HPP</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {filteredProducts.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="px-4 py-8 text-center text-slate-500">
                                    Belum ada produk.
                                </td>
                            </tr>
                        ) : (
                            filteredProducts.map((p) => (
                                <tr key={p.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-slate-900">
                                        <div className="flex items-center gap-3">
                                            {p.image_url ? (
                                                <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded object-cover border" />
                                            ) : (
                                                <div className="w-10 h-10 rounded bg-slate-100 border flex items-center justify-center text-slate-400">
                                                    Img
                                                </div>
                                            )}
                                            {p.name}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {p.display_group ? p.display_group.name : p.category}
                                    </td>
                                    <td className="px-4 py-3">{formatRupiah(p.price)}</td>
                                    <td className="px-4 py-3">{formatRupiah(p.hpp)}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                            {p.is_active ? 'Aktif' : 'Nonaktif'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 flex gap-2">
                                        <button onClick={() => openBomModal(p)} className="inline-flex items-center justify-center px-3 py-2 bg-emerald-50 text-emerald-600 rounded-md font-medium hover:bg-emerald-100 transition-colors min-h-[36px] active:scale-[0.98]">Bahan (BOM)</button>
                                        <button onClick={() => openModal(p)} className="inline-flex items-center justify-center px-3 py-2 bg-indigo-50 text-indigo-600 rounded-md font-medium hover:bg-indigo-100 transition-colors min-h-[36px] active:scale-[0.98]">Edit</button>
                                        <button onClick={() => handleDelete(p.id)} className="inline-flex items-center justify-center px-3 py-2 bg-rose-50 text-rose-600 rounded-md font-medium hover:bg-rose-100 transition-colors min-h-[36px] active:scale-[0.98]">Hapus</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-slate-900">
                                {editingProduct ? 'Edit Produk' : 'Tambah Produk'}
                            </h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Produk</label>
                                <input
                                    type="text"
                                    value={data.name}
                                    onChange={e => setData('name', e.target.value)}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    required
                                />
                                {errors.name && <p className="text-rose-500 text-xs mt-1">{errors.name}</p>}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Kategori Teks</label>
                                    <input
                                        type="text"
                                        value={data.category}
                                        onChange={e => setData('category', e.target.value)}
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                        required
                                    />
                                    {errors.category && <p className="text-rose-500 text-xs mt-1">{errors.category}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Display Group</label>
                                    <select
                                        value={data.display_group_id}
                                        onChange={e => setData('display_group_id', e.target.value)}
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                    >
                                        <option value="">- Tidak ada -</option>
                                        {displayGroups.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Harga (Rp)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={data.price}
                                        onChange={e => setData('price', e.target.value)}
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                        required
                                    />
                                    {errors.price && <p className="text-rose-500 text-xs mt-1">{errors.price}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">HPP (Rp)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={data.hpp}
                                        onChange={e => setData('hpp', e.target.value)}
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Gambar Produk</label>
                                <div className="space-y-3">
                                    <div>
                                        <span className="text-xs text-slate-500 mb-1 block">Opsi 1: Upload File Gambar</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={e => setData('image', e.target.files[0])}
                                            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                        />
                                        {errors.image && <p className="text-rose-500 text-xs mt-1">{errors.image}</p>}
                                    </div>
                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                            <div className="w-full border-t border-slate-200" />
                                        </div>
                                        <div className="relative flex justify-center">
                                            <span className="bg-white px-2 text-xs text-slate-500">ATAU</span>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 mb-1 block">Opsi 2: Link Gambar Online (URL)</span>
                                        <input
                                            type="url"
                                            value={data.image_url || ''}
                                            onChange={e => setData('image_url', e.target.value)}
                                            placeholder="https://example.com/image.jpg"
                                            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                        />
                                        {errors.image_url && <p className="text-rose-500 text-xs mt-1">{errors.image_url}</p>}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={data.is_active}
                                    onChange={e => setData('is_active', e.target.checked)}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label htmlFor="is_active" className="text-sm text-slate-700">Aktif (Tampil di kasir)</label>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-slate-200">
                                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
                                    Batal
                                </button>
                                <button type="submit" disabled={processing} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">
                                    {processing ? 'Menyimpan...' : 'Simpan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* BOM Modal */}
            {isBomModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-slate-900">
                                Komposisi Bahan (BOM) - {editingProduct?.name}
                            </h2>
                            <button onClick={closeBomModal} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleBomSubmit} className="p-6 space-y-4">
                            <p className="text-sm text-slate-600">
                                Tentukan bahan stok yang akan dikurangi secara otomatis setiap kali produk ini terjual.
                            </p>

                            <div className="space-y-3">
                                {bomData.conversions.map((conv, index) => (
                                    <div key={index} className="flex gap-2 items-start bg-slate-50 p-3 rounded border border-slate-200">
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-slate-700 mb-1">Bahan Stok</label>
                                            <select
                                                value={conv.stock_item_id}
                                                onChange={e => updateConversion(index, 'stock_item_id', e.target.value)}
                                                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                                                required
                                            >
                                                <option value="">-- Pilih Bahan --</option>
                                                {stockItems.map(item => (
                                                    <option key={item.id} value={item.id}>{item.name} (Satuan: {item.unit_name})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="w-1/4">
                                            <label className="block text-xs font-medium text-slate-700 mb-1">Jumlah</label>
                                            <input
                                                type="number"
                                                step="0.0001"
                                                min="0.0001"
                                                value={conv.ratio}
                                                onChange={e => updateConversion(index, 'ratio', e.target.value)}
                                                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                                                required
                                                placeholder="Cth: 1.5"
                                            />
                                        </div>

                                        <div className="pt-5">
                                            <button 
                                                type="button" 
                                                onClick={() => removeConversion(index)}
                                                className="text-rose-500 hover:text-rose-700 px-2 py-1"
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button 
                                type="button" 
                                onClick={addConversion}
                                className="text-sm text-indigo-600 font-medium hover:text-indigo-800"
                            >
                                + Tambah Bahan
                            </button>

                            <div className="pt-4 flex justify-end gap-3 border-t border-slate-200">
                                <button type="button" onClick={closeBomModal} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
                                    Batal
                                </button>
                                <button type="submit" disabled={bomProcessing} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">
                                    {bomProcessing ? 'Menyimpan...' : 'Simpan Komposisi'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Display Group Modal */}
            {isGroupModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-slate-900">
                                Kelola Group Produk
                            </h2>
                            <button onClick={() => setIsGroupModalOpen(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleGroupSubmit} className="flex gap-2 mb-6">
                                <input
                                    type="text"
                                    value={groupData.name}
                                    onChange={e => setGroupData('name', e.target.value)}
                                    placeholder="Nama group baru..."
                                    className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm"
                                    required
                                />
                                <button type="submit" disabled={groupProcessing} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium disabled:opacity-50">
                                    Tambah
                                </button>
                            </form>

                            <h3 className="font-medium text-slate-700 mb-2">Daftar Group:</h3>
                            {displayGroups.length === 0 ? (
                                <p className="text-sm text-slate-500 italic">Belum ada group.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {displayGroups.map(g => (
                                        <li key={g.id} className="flex justify-between items-center bg-slate-50 p-2 border border-slate-200 rounded">
                                            <span className="text-sm text-slate-700">{g.name}</span>
                                            <button onClick={() => handleGroupDelete(g.id)} className="text-xs text-rose-500 hover:text-rose-700">Hapus</button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </ErpLayout>
    );
}
