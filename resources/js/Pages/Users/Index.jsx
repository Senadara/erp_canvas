import { useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, useForm, router } from '@inertiajs/react';

export default function UsersIndex({ users, outlets, activityLogs, products, stockItems }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [activeTab, setActiveTab] = useState('users');

    const { data, setData, post, put, processing, errors, reset } = useForm({
        email: '',
        password: '',
        display_name: '',
        role: 'STAFF',
        is_active: true,
        outlet_ids: [],
        mitra_product_ids: [],
        mitra_stock_ids: [],
        mitra_can_view_sales: false,
    });

    const openModal = (user = null) => {
        if (user) {
            setEditingUser(user);
            setData({
                email: user.email,
                password: '',
                display_name: user.display_name,
                role: user.role,
                is_active: user.is_active,
                outlet_ids: user.outlets?.map(o => o.id) || [],
                mitra_product_ids: user.mitra_product_ids || [],
                mitra_stock_ids: user.mitra_stock_ids || [],
                mitra_can_view_sales: user.mitra_can_view_sales || false,
                feature_overrides: user.feature_overrides || {},
            });
        } else {
            setEditingUser(null);
            reset();
            setData({
                email: '',
                password: '',
                display_name: '',
                role: 'STAFF',
                is_active: true,
                outlet_ids: [],
                mitra_product_ids: [],
                mitra_stock_ids: [],
                mitra_can_view_sales: false,
                feature_overrides: {},
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        reset();
        setEditingUser(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingUser) {
            put(route('users.update', editingUser.id), {
                onSuccess: () => closeModal()
            });
        } else {
            post(route('users.store'), {
                onSuccess: () => closeModal()
            });
        }
    };

    const handleDelete = (id) => {
        if (confirm('Yakin ingin menghapus pengguna ini?')) {
            router.delete(route('users.destroy', id));
        }
    };

    const toggleOutlet = (outletId) => {
        setData('outlet_ids', data.outlet_ids.includes(outletId)
            ? data.outlet_ids.filter(id => id !== outletId)
            : [...data.outlet_ids, outletId]
        );
    };

    const toggleMitraProduct = (productId) => {
        setData('mitra_product_ids', data.mitra_product_ids.includes(productId)
            ? data.mitra_product_ids.filter(id => id !== productId)
            : [...data.mitra_product_ids, productId]
        );
    };

    const toggleMitraStock = (stockId) => {
        setData('mitra_stock_ids', data.mitra_stock_ids.includes(stockId)
            ? data.mitra_stock_ids.filter(id => id !== stockId)
            : [...data.mitra_stock_ids, stockId]
        );
    };

    const roleColors = {
        'OWNER': 'bg-violet-100 text-violet-800',
        'STAFF': 'bg-sky-100 text-sky-800',
        'MITRA': 'bg-amber-100 text-amber-800',
    };

    return (
        <ErpLayout title="Manajemen Pengguna">
            <Head title="Pengguna" />

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold text-slate-900">Manajemen Pengguna</h1>
                <button
                    onClick={() => openModal()}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium"
                >
                    + Tambah Pengguna
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-slate-200">
                <button 
                    onClick={() => setActiveTab('users')} 
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'users' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Daftar Pengguna
                </button>
                <button 
                    onClick={() => setActiveTab('logs')} 
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'logs' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Log Aktivitas
                </button>
            </div>

            {/* Users Table */}
            {activeTab === 'users' && (
                <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                            <tr>
                                <th className="px-4 py-3 font-medium">Nama</th>
                                <th className="px-4 py-3 font-medium">Email</th>
                                <th className="px-4 py-3 font-medium">Role</th>
                                <th className="px-4 py-3 font-medium">Outlet</th>
                                <th className="px-4 py-3 font-medium">Akses Mitra</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {users.length === 0 ? (
                                <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-500">Belum ada pengguna.</td></tr>
                            ) : (
                                users.map((u) => (
                                    <tr key={u.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-900">{u.display_name}</td>
                                        <td className="px-4 py-3">{u.email}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${roleColors[u.role] || ''}`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs">{u.outlets?.map(o => o.name).join(', ') || '-'}</td>
                                        <td className="px-4 py-3">
                                            {u.role === 'MITRA' ? (
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${u.mitra_can_view_sales ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                                                    Penjualan: {u.mitra_can_view_sales ? '✓' : '✗'}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                                {u.is_active ? 'Aktif' : 'Nonaktif'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 flex gap-2">
                                            <button onClick={() => openModal(u)} className="inline-flex items-center justify-center px-3 py-2 bg-indigo-50 text-indigo-600 rounded-md font-medium hover:bg-indigo-100 transition-colors min-h-[36px] active:scale-[0.98]">Edit</button>
                                            {!u.role || u.role !== 'OWNER' ? (
                                                <button onClick={() => handleDelete(u.id)} className="inline-flex items-center justify-center px-3 py-2 bg-rose-50 text-rose-600 rounded-md font-medium hover:bg-rose-100 transition-colors min-h-[36px] active:scale-[0.98]">Hapus</button>
                                            ) : null}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Activity Logs */}
            {activeTab === 'logs' && (
                <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                            <tr>
                                <th className="px-4 py-3 font-medium">Waktu</th>
                                <th className="px-4 py-3 font-medium">User</th>
                                <th className="px-4 py-3 font-medium">Aksi</th>
                                <th className="px-4 py-3 font-medium">Keterangan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {activityLogs.length === 0 ? (
                                <tr><td colSpan="4" className="px-4 py-8 text-center text-slate-500">Belum ada log aktivitas.</td></tr>
                            ) : (
                                activityLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 whitespace-nowrap">{new Date(log.created_at).toLocaleString('id-ID')}</td>
                                        <td className="px-4 py-3 font-medium">{log.user?.display_name || '-'}</td>
                                        <td className="px-4 py-3">
                                            <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-mono">{log.action}</span>
                                        </td>
                                        <td className="px-4 py-3">{log.description || '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-slate-900">
                                {editingUser ? 'Edit Pengguna' : 'Tambah Pengguna'}
                            </h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Tampilan</label>
                                    <input type="text" value={data.display_name} onChange={e => setData('display_name', e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
                                    {errors.display_name && <p className="text-rose-500 text-xs mt-1">{errors.display_name}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                                    <select value={data.role} onChange={e => setData('role', e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
                                        <option value="STAFF">STAFF</option>
                                        <option value="MITRA">MITRA</option>
                                        <option value="OWNER">OWNER</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <input type="email" value={data.email} onChange={e => setData('email', e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
                                {errors.email && <p className="text-rose-500 text-xs mt-1">{errors.email}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Password {editingUser && <span className="text-slate-400">(kosongkan jika tidak ingin ganti)</span>}
                                </label>
                                <input type="password" value={data.password} onChange={e => setData('password', e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" {...(!editingUser ? { required: true } : {})} />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Akses Outlet</label>
                                <div className="flex flex-wrap gap-2">
                                    {outlets.map(o => (
                                        <label key={o.id} className={`flex items-center gap-2 px-3 py-1.5 rounded border cursor-pointer text-sm ${data.outlet_ids.includes(o.id) ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-200'}`}>
                                            <input type="checkbox" checked={data.outlet_ids.includes(o.id)} onChange={() => toggleOutlet(o.id)} className="rounded border-slate-300 text-indigo-600" />
                                            {o.name}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {data.role === 'MITRA' && (
                                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg space-y-4">
                                    <div className="flex items-center gap-3 border-b border-amber-200 pb-3">
                                        <input 
                                            type="checkbox" 
                                            id="mitra_can_view_sales" 
                                            checked={data.mitra_can_view_sales} 
                                            onChange={e => setData('mitra_can_view_sales', e.target.checked)} 
                                            className="w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-600" 
                                        />
                                        <div className="flex-1">
                                            <label htmlFor="mitra_can_view_sales" className="text-sm font-semibold text-amber-900 cursor-pointer">Izinkan Lihat Data Penjualan (Struk/Receipts)</label>
                                            <p className="text-xs text-amber-700">Jika aktif, mitra bisa melihat riwayat transaksi yang mengandung produk miliknya.</p>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-amber-900 mb-2">Scope Produk Mitra (Menu)</label>
                                        <div className="max-h-32 overflow-y-auto bg-white border border-amber-200 rounded p-2 space-y-1">
                                            {products.length === 0 ? <p className="text-xs text-amber-600 italic">Belum ada produk di outlet ini.</p> : products.map(p => (
                                                <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-amber-50 p-1 rounded">
                                                    <input type="checkbox" checked={data.mitra_product_ids.includes(p.id)} onChange={() => toggleMitraProduct(p.id)} className="rounded border-amber-300 text-amber-600" />
                                                    {p.name}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-amber-900 mb-2">Scope Stok Mitra</label>
                                        <div className="max-h-32 overflow-y-auto bg-white border border-amber-200 rounded p-2 space-y-1">
                                            {stockItems.length === 0 ? <p className="text-xs text-amber-600 italic">Belum ada stok di outlet ini.</p> : stockItems.map(s => (
                                                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-amber-50 p-1 rounded">
                                                    <input type="checkbox" checked={data.mitra_stock_ids.includes(s.id)} onChange={() => toggleMitraStock(s.id)} className="rounded border-amber-300 text-amber-600" />
                                                    {s.name}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="is_active" checked={data.is_active} onChange={e => setData('is_active', e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                                <label htmlFor="is_active" className="text-sm text-slate-700">Akun Aktif</label>
                            </div>

                            {data.role !== 'OWNER' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Akses Fitur Tambahan (Overrides)</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border border-slate-200 rounded p-3 bg-slate-50">
                                        {[
                                            { id: 'dashboard', label: 'Dashboard' },
                                            { id: 'cashier', label: 'Kasir & Shift' },
                                            { id: 'products', label: 'Produk' },
                                            { id: 'stock', label: 'Stok' },
                                            { id: 'expenses', label: 'Pengeluaran' },
                                            { id: 'waste', label: 'Waste' },
                                            { id: 'reports', label: 'Laporan' },
                                            { id: 'receipts', label: 'Struk' },
                                            { id: 'suppliers', label: 'Supplier' },
                                        ].map(feature => (
                                            <label key={feature.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={data.feature_overrides?.[feature.id] === true}
                                                    onChange={e => setData('feature_overrides', { ...data.feature_overrides, [feature.id]: e.target.checked })}
                                                    className="rounded border-slate-300 text-indigo-600"
                                                />
                                                {feature.label}
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Centang untuk memberikan akses paksa ke fitur di luar dari hak akses standar role.</p>
                                </div>
                            )}

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
