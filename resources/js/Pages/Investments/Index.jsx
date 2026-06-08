import { useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, useForm, router, usePage } from '@inertiajs/react';

function formatRupiah(value) {
    const n = Number(value) || 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

export default function InvestmentsIndex({ investments, outlets }) {
    const { auth } = usePage().props;
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        outlet_id: '',
        lots: 1,
        lot_value: 1000000,
        note: '',
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route('investments.store'), {
            onSuccess: () => {
                setIsModalOpen(false);
                reset();
            },
        });
    };

    const handleApprove = (id) => {
        if (confirm('Setujui investasi ini?')) {
            router.post(route('investments.approve', id));
        }
    };

    const handleReject = (id) => {
        if (confirm('Tolak investasi ini?')) {
            router.post(route('investments.reject', id));
        }
    };

    // Calculate totals
    const totalLots = investments.filter(i => i.status === 'APPROVED').reduce((sum, i) => sum + i.lots, 0);
    const totalValue = investments.filter(i => i.status === 'APPROVED').reduce((sum, i) => sum + Number(i.total_value), 0);

    return (
        <ErpLayout title="Manajemen Investasi">
            <Head title="Investasi" />

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold text-slate-900">Portofolio Investasi</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium shadow-sm transition-transform active:scale-95"
                >
                    + Catat Investasi Baru
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-indigo-100 mb-1 text-sm font-medium">Total Lot Aktif</p>
                        <h2 className="text-3xl font-bold">{totalLots} Lot</h2>
                    </div>
                    <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-emerald-100 mb-1 text-sm font-medium">Total Nilai Investasi Aktif</p>
                        <h2 className="text-3xl font-bold">{formatRupiah(totalValue)}</h2>
                    </div>
                    <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
                </div>
            </div>

            <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                            <tr>
                                <th className="px-4 py-3 font-medium">Tanggal</th>
                                {auth.user.role === 'OWNER' && <th className="px-4 py-3 font-medium">User</th>}
                                <th className="px-4 py-3 font-medium">Outlet</th>
                                <th className="px-4 py-3 font-medium">Lot</th>
                                <th className="px-4 py-3 font-medium">Nilai / Lot</th>
                                <th className="px-4 py-3 font-medium text-right">Total Nilai</th>
                                <th className="px-4 py-3 font-medium text-center">Status</th>
                                {auth.user.role === 'OWNER' && <th className="px-4 py-3 font-medium text-center">Aksi</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {investments.length === 0 ? (
                                <tr>
                                    <td colSpan={auth.user.role === 'OWNER' ? 8 : 6} className="px-4 py-8 text-center text-slate-500">
                                        Belum ada riwayat investasi.
                                    </td>
                                </tr>
                            ) : (
                                investments.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap">{new Date(inv.created_at).toLocaleString('id-ID')}</td>
                                        {auth.user.role === 'OWNER' && <td className="px-4 py-3 font-medium text-slate-800">{inv.user?.name}</td>}
                                        <td className="px-4 py-3 font-medium text-indigo-600">{inv.outlet?.name}</td>
                                        <td className="px-4 py-3">{inv.lots}</td>
                                        <td className="px-4 py-3">{formatRupiah(inv.lot_value)}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatRupiah(inv.total_value)}</td>
                                        <td className="px-4 py-3 text-center">
                                            {inv.status === 'APPROVED' && <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs font-bold">APPROVED</span>}
                                            {inv.status === 'PENDING' && <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-bold">PENDING</span>}
                                            {inv.status === 'REJECTED' && <span className="bg-rose-100 text-rose-800 px-2 py-1 rounded text-xs font-bold">REJECTED</span>}
                                        </td>
                                        {auth.user.role === 'OWNER' && (
                                            <td className="px-4 py-3 text-center">
                                                {inv.status === 'PENDING' && (
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => handleApprove(inv.id)} className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-2 py-1 rounded text-xs font-semibold">Setuju</button>
                                                        <button onClick={() => handleReject(inv.id)} className="bg-rose-50 text-rose-600 hover:bg-rose-100 px-2 py-1 rounded text-xs font-semibold">Tolak</button>
                                                    </div>
                                                )}
                                                {inv.status !== 'PENDING' && <span className="text-slate-400 text-xs">-</span>}
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Tambah Investasi */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-semibold text-slate-900">Catat Investasi Baru</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Outlet</label>
                                <select
                                    value={data.outlet_id}
                                    onChange={e => setData('outlet_id', e.target.value)}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    required
                                >
                                    <option value="">-- Pilih Outlet --</option>
                                    {outlets.map(o => (
                                        <option key={o.id} value={o.id}>{o.name}</option>
                                    ))}
                                </select>
                                {errors.outlet_id && <p className="text-rose-500 text-xs mt-1">{errors.outlet_id}</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Jumlah Lot</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={data.lots}
                                        onChange={e => setData('lots', e.target.value)}
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                        required
                                    />
                                    {errors.lots && <p className="text-rose-500 text-xs mt-1">{errors.lots}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nilai per Lot (Rp)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={data.lot_value}
                                        onChange={e => setData('lot_value', e.target.value)}
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                        required
                                    />
                                    {errors.lot_value && <p className="text-rose-500 text-xs mt-1">{errors.lot_value}</p>}
                                </div>
                            </div>

                            <div className="bg-indigo-50 p-3 rounded-md border border-indigo-100">
                                <p className="text-sm text-indigo-800 flex justify-between">
                                    <span>Total Estimasi Nilai:</span>
                                    <span className="font-bold">{formatRupiah(data.lots * data.lot_value)}</span>
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
                                <textarea
                                    value={data.note}
                                    onChange={e => setData('note', e.target.value)}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    rows="2"
                                    placeholder="Opsional"
                                ></textarea>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-slate-200">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors">
                                    Batal
                                </button>
                                <button type="submit" disabled={processing} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm">
                                    {processing ? 'Menyimpan...' : 'Simpan Investasi'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </ErpLayout>
    );
}
