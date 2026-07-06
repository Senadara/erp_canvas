import { useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, useForm, router, usePage } from '@inertiajs/react';
import {
    ArchiveBoxIcon,
    CheckCircleIcon,
    FunnelIcon,
    MagnifyingGlassIcon,
    NoSymbolIcon,
    PlusIcon,
    Squares2X2Icon,
} from '@heroicons/react/24/outline';

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
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const { auth } = usePage().props;
    const isOwner = auth.user.role === 'OWNER';

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

    const handleDeactivate = (product) => {
        if (confirm(`Produk "${product.name}" akan dinonaktifkan dari kasir, tetapi tetap tersimpan untuk histori transaksi dan struk. Lanjutkan?`)) {
            router.delete(route('products.destroy', product.id), { preserveScroll: true });
        }
    };

    const handleActivate = (product) => {
        if (confirm(`Aktifkan kembali produk "${product.name}" agar tampil di kasir?`)) {
            router.post(route('products.store'), {
                id: product.id,
                name: product.name,
                category: product.category,
                price: product.price,
                hpp: product.hpp ?? 0,
                is_active: true,
                display_group_id: product.display_group_id || '',
                image_url: product.image_url || '',
            }, { preserveScroll: true });
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

    const productStats = products.reduce((acc, product) => {
        acc.total += 1;
        if (product.is_active) acc.active += 1;
        else acc.inactive += 1;
        return acc;
    }, { total: 0, active: 0, inactive: 0 });

    const filteredProducts = products.filter((product) => {
        const searchable = [
            product.name,
            product.category,
            product.display_group?.name,
        ].filter(Boolean).join(' ').toLowerCase();
        const matchesSearch = searchable.includes(searchTerm.trim().toLowerCase());
        const matchesGroup = !filterGroup || product.display_group_id === filterGroup;
        const matchesStatus =
            filterStatus === 'ALL'
            || (filterStatus === 'ACTIVE' && product.is_active)
            || (filterStatus === 'INACTIVE' && !product.is_active);

        return matchesSearch && matchesGroup && matchesStatus;
    });

    const hasActiveFilters = Boolean(searchTerm || filterGroup || filterStatus !== 'ALL');

    const resetFilters = () => {
        setSearchTerm('');
        setFilterGroup('');
        setFilterStatus('ALL');
    };

    return (
        <ErpLayout title="Produk">
            <Head title="Produk" />

            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Manajemen Produk</h1>
                    <p className="mt-1 text-sm text-slate-500">Kelola katalog, status tampil di kasir, dan komposisi bahan.</p>
                </div>
                {isOwner && (
                    <button
                        onClick={() => openModal()}
                        className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                    >
                        <PlusIcon className="h-4 w-4" />
                        Tambah Produk
                    </button>
                )}
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase text-slate-400">Total</p>
                            <p className="mt-1 text-2xl font-semibold text-slate-900">{productStats.total}</p>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                            <ArchiveBoxIcon className="h-5 w-5" />
                        </div>
                    </div>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase text-emerald-500">Aktif</p>
                            <p className="mt-1 text-2xl font-semibold text-emerald-700">{productStats.active}</p>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                            <CheckCircleIcon className="h-5 w-5" />
                        </div>
                    </div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase text-amber-500">Nonaktif</p>
                            <p className="mt-1 text-2xl font-semibold text-amber-700">{productStats.inactive}</p>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                            <NoSymbolIcon className="h-5 w-5" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <FunnelIcon className="h-5 w-5 text-slate-400" />
                        Filter Produk
                    </div>
                    <div className="flex items-center gap-2">
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={resetFilters}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                            >
                                Reset
                            </button>
                        )}
                        {isOwner && (
                            <button
                                onClick={() => setIsGroupModalOpen(true)}
                                className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                            >
                                <Squares2X2Icon className="h-4 w-4" />
                                Kelola Group
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_280px]">
                    <div className="relative">
                        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Cari nama produk, kategori, atau group"
                            className="w-full rounded-lg border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                    </div>

                    <select
                        value={filterGroup}
                        onChange={e => setFilterGroup(e.target.value)}
                        className="rounded-lg border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                    >
                        <option value="">Semua Group</option>
                        {displayGroups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>

                    <div className="grid grid-cols-3 rounded-lg border border-slate-200 bg-slate-50 p-1">
                        {[
                            ['ALL', 'Semua'],
                            ['ACTIVE', 'Aktif'],
                            ['INACTIVE', 'Nonaktif'],
                        ].map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setFilterStatus(value)}
                                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                                    filterStatus === value
                                        ? 'bg-white text-indigo-700 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <p className="mt-3 text-xs font-medium text-slate-500">
                    Menampilkan {filteredProducts.length} dari {productStats.total} produk.
                </p>
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
                                    {hasActiveFilters ? 'Tidak ada produk sesuai filter.' : 'Belum ada produk.'}
                                </td>
                            </tr>
                        ) : (
                            filteredProducts.map((p) => (
                                <tr key={p.id} className={`${p.is_active ? 'hover:bg-slate-50' : 'bg-slate-50/70 text-slate-500 hover:bg-amber-50/40'}`}>
                                    <td className={`px-4 py-3 font-medium ${p.is_active ? 'text-slate-900' : 'text-slate-500'}`}>
                                        <div className="flex items-center gap-3">
                                            {p.image_url ? (
                                                <img src={p.image_url} alt={p.name} className={`w-10 h-10 rounded object-cover border ${p.is_active ? '' : 'opacity-60 grayscale'}`} />
                                            ) : (
                                                <div className={`w-10 h-10 rounded border flex items-center justify-center text-slate-400 ${p.is_active ? 'bg-slate-100' : 'bg-white'}`}>
                                                    Img
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span>{p.name}</span>
                                                    {!p.is_active && (
                                                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                                            Tidak tampil di kasir
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-0.5 text-xs font-normal text-slate-400">{p.category}</p>
                                            </div>
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
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-2">
                                        {isOwner && <button onClick={() => openBomModal(p)} className="inline-flex items-center justify-center px-3 py-2 bg-emerald-50 text-emerald-600 rounded-md font-medium hover:bg-emerald-100 transition-colors min-h-[36px] active:scale-[0.98]">Bahan (BOM)</button>}
                                        <button onClick={() => openModal(p)} className="inline-flex items-center justify-center px-3 py-2 bg-indigo-50 text-indigo-600 rounded-md font-medium hover:bg-indigo-100 transition-colors min-h-[36px] active:scale-[0.98]">{isOwner ? 'Edit' : 'Ubah Gambar'}</button>
                                        {isOwner && (p.is_active ? (
                                            <button onClick={() => handleDeactivate(p)} className="inline-flex items-center justify-center px-3 py-2 bg-amber-50 text-amber-700 rounded-md font-medium hover:bg-amber-100 transition-colors min-h-[36px] active:scale-[0.98]">Nonaktifkan</button>
                                        ) : (
                                            <button onClick={() => handleActivate(p)} className="inline-flex items-center justify-center px-3 py-2 bg-emerald-50 text-emerald-700 rounded-md font-medium hover:bg-emerald-100 transition-colors min-h-[36px] active:scale-[0.98]">Aktifkan</button>
                                        ))}
                                        </div>
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
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
                                    required
                                    disabled={!isOwner}
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
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500"
                                        required
                                        disabled={!isOwner}
                                    />
                                    {errors.category && <p className="text-rose-500 text-xs mt-1">{errors.category}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Display Group</label>
                                    <select
                                        value={data.display_group_id}
                                        onChange={e => setData('display_group_id', e.target.value)}
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500"
                                        disabled={!isOwner}
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
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500"
                                        required
                                        disabled={!isOwner}
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
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500"
                                        disabled={!isOwner}
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
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                                    disabled={!isOwner}
                                />
                                <label htmlFor="is_active" className={`text-sm ${!isOwner ? 'text-slate-400' : 'text-slate-700'}`}>Aktif (Tampil di kasir)</label>
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
