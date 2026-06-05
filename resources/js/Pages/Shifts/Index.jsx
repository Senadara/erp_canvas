import { useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, useForm, router } from '@inertiajs/react';

function formatRupiah(value) {
    const n = Number(value) || 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

export default function ShiftsIndex({ shifts, openShift, expenses }) {
    const [isClosing, setIsClosing] = useState(false);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    
    const { data: openData, setData: setOpenData, post: postOpen, processing: opening } = useForm({
        opening_cash: '',
    });

    const { data: closeData, setData: setCloseData, post: postClose, processing: closing } = useForm({
        actual_cash: '',
        note: '',
    });

    const { data: expenseData, setData: setExpenseData, post: postExpense, processing: expenseProcessing, reset: resetExpense } = useForm({
        amount: '',
        category: 'Operasional',
        description: '',
    });

    const expenseCategories = [
        'Operasional',
        'Bahan Baku',
        'Gaji',
        'Listrik/Air',
        'Tambah Modal',
        'Lainnya'
    ];

    const handleOpen = (e) => {
        e.preventDefault();
        postOpen(route('shifts.store'), {
            onSuccess: () => setOpenData('opening_cash', '')
        });
    };

    const handleClose = (e) => {
        e.preventDefault();
        postClose(route('shifts.update', openShift.id), {
            onSuccess: () => {
                setIsClosing(false);
                setCloseData({ actual_cash: '', note: '' });
            }
        });
    };

    const handleExpenseSubmit = (e) => {
        e.preventDefault();
        postExpense(route('expenses.store'), {
            onSuccess: () => {
                setIsExpenseModalOpen(false);
                resetExpense();
            }
        });
    };

    const handleExpenseDelete = (id) => {
        if (confirm('Yakin ingin menghapus catatan pengeluaran ini?')) {
            router.delete(route('expenses.destroy', id));
        }
    };

    return (
        <ErpLayout title="Manajemen Shift">
            <Head title="Shift" />

            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-slate-900">Manajemen Shift</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white shadow-sm rounded-lg border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Status Shift Saat Ini</h2>
                    {openShift ? (
                        <div className="space-y-4">
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-md flex justify-between items-center">
                                <div>
                                    <p className="font-bold">Shift Terbuka</p>
                                    <p className="text-sm">Sejak: {new Date(openShift.opened_at).toLocaleString('id-ID')}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm">Kas Awal:</p>
                                    <p className="font-bold">{formatRupiah(openShift.opening_cash)}</p>
                                </div>
                            </div>

                            {!isClosing ? (
                                <button
                                    onClick={() => setIsClosing(true)}
                                    className="w-full bg-rose-600 text-white font-medium py-2 rounded hover:bg-rose-700 transition"
                                >
                                    Tutup Shift Sekarang
                                </button>
                            ) : (
                                <form onSubmit={handleClose} className="border-t border-slate-200 pt-4 mt-4 space-y-4">
                                    <h3 className="font-medium text-slate-900">Form Tutup Shift</h3>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Kas Aktual di Laci (Rp)</label>
                                        <input
                                            type="number"
                                            value={closeData.actual_cash}
                                            onChange={e => setCloseData('actual_cash', e.target.value)}
                                            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Catatan Tambahan (Opsional)</label>
                                        <textarea
                                            value={closeData.note}
                                            onChange={e => setCloseData('note', e.target.value)}
                                            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                            rows="2"
                                        ></textarea>
                                    </div>
                                    <div className="flex gap-3">
                                        <button type="button" onClick={() => setIsClosing(false)} className="flex-1 bg-slate-100 text-slate-700 py-2 rounded hover:bg-slate-200">
                                            Batal
                                        </button>
                                        <button type="submit" disabled={closing} className="flex-1 bg-rose-600 text-white py-2 rounded hover:bg-rose-700 disabled:opacity-50">
                                            {closing ? 'Memproses...' : 'Tutup Shift'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleOpen} className="space-y-4">
                            <div className="bg-slate-50 border border-slate-200 text-slate-600 px-4 py-3 rounded-md">
                                <p>Tidak ada shift yang terbuka saat ini. Buka shift untuk mulai menerima transaksi.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Kas Awal (Uang di Laci) Rp</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={openData.opening_cash}
                                    onChange={e => setOpenData('opening_cash', e.target.value)}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                    required
                                />
                            </div>
                            <button type="submit" disabled={opening} className="w-full bg-emerald-600 text-white font-medium py-2 rounded hover:bg-emerald-700 transition disabled:opacity-50">
                                {opening ? 'Membuka...' : 'Buka Shift Baru'}
                            </button>
                        </form>
                    )}
                </div>

                {/* Bagian Pengeluaran/Kasbon */}
                <div className="bg-white shadow-sm rounded-lg border border-slate-200 p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">Pengeluaran (Petty Cash)</h2>
                        <button
                            onClick={() => setIsExpenseModalOpen(true)}
                            disabled={!openShift}
                            className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                        >
                            + Catat
                        </button>
                    </div>

                    {!openShift ? (
                        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                            Buka shift terlebih dahulu untuk mencatat pengeluaran.
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col">
                            <div className="flex-1 overflow-y-auto min-h-[200px] border border-slate-200 rounded-md">
                                <table className="w-full text-left text-sm text-slate-600">
                                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 font-medium">Kategori</th>
                                            <th className="px-3 py-2 font-medium">Nominal</th>
                                            <th className="px-3 py-2 font-medium w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {!expenses || expenses.length === 0 ? (
                                            <tr>
                                                <td colSpan="3" className="px-3 py-6 text-center text-slate-400 text-xs">
                                                    Belum ada pengeluaran di shift ini.
                                                </td>
                                            </tr>
                                        ) : (
                                            expenses.map(e => (
                                                <tr key={e.id} className="hover:bg-slate-50">
                                                    <td className="px-3 py-2">
                                                        <span className="font-medium text-slate-800 block text-xs">{e.category}</span>
                                                        {e.description && <span className="text-[10px] text-slate-500 line-clamp-1">{e.description}</span>}
                                                    </td>
                                                    <td className="px-3 py-2 font-semibold text-rose-600 text-xs">{formatRupiah(e.amount)}</td>
                                                    <td className="px-3 py-2 text-right">
                                                        <button onClick={() => handleExpenseDelete(e.id)} className="text-rose-500 hover:text-rose-700 text-xs font-bold">&times;</button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center text-sm">
                                <span className="font-semibold text-slate-700">Total Pengeluaran Shift:</span>
                                <span className="font-bold text-rose-600">
                                    {expenses ? formatRupiah(expenses.reduce((sum, e) => sum + Number(e.amount), 0)) : formatRupiah(0)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-x-auto">
                <h2 className="text-lg font-semibold text-slate-900 p-4 border-b border-slate-200">Riwayat Shift</h2>
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                        <tr>
                            <th className="px-4 py-3 font-medium">Buka</th>
                            <th className="px-4 py-3 font-medium">Tutup</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium text-right">Kas Awal</th>
                            <th className="px-4 py-3 font-medium text-right">Ekspektasi Kas</th>
                            <th className="px-4 py-3 font-medium text-right">Selisih</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {shifts.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="px-4 py-8 text-center text-slate-500">
                                    Belum ada riwayat shift.
                                </td>
                            </tr>
                        ) : (
                            shifts.map((s) => (
                                <tr key={s.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3">{new Date(s.opened_at).toLocaleString('id-ID')}</td>
                                    <td className="px-4 py-3">{s.closed_at ? new Date(s.closed_at).toLocaleString('id-ID') : '-'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}`}>
                                            {s.status === 'OPEN' ? 'Terbuka' : 'Tutup'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">{formatRupiah(s.opening_cash)}</td>
                                    <td className="px-4 py-3 text-right">{s.expected_cash ? formatRupiah(s.expected_cash) : '-'}</td>
                                    <td className="px-4 py-3 text-right">
                                        {s.discrepancy ? (
                                            <span className={Number(s.discrepancy) < 0 ? 'text-rose-600 font-bold' : (Number(s.discrepancy) > 0 ? 'text-emerald-600 font-bold' : '')}>
                                                {formatRupiah(s.discrepancy)}
                                            </span>
                                        ) : '-'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Expense Modal */}
            {isExpenseModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-slate-900">
                                Catat Pengeluaran
                            </h2>
                            <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleExpenseSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nominal (Rp)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={expenseData.amount}
                                    onChange={e => setExpenseData('amount', e.target.value)}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Kategori</label>
                                <select
                                    value={expenseData.category}
                                    onChange={e => setExpenseData('category', e.target.value)}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                    required
                                >
                                    {expenseCategories.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Keterangan (Opsional)</label>
                                <textarea
                                    value={expenseData.description}
                                    onChange={e => setExpenseData('description', e.target.value)}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                    rows="2"
                                ></textarea>
                            </div>
                            <div className="pt-4 flex justify-end gap-3 border-t border-slate-200">
                                <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
                                    Batal
                                </button>
                                <button type="submit" disabled={expenseProcessing} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">
                                    {expenseProcessing ? 'Menyimpan...' : 'Simpan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </ErpLayout>
    );
}
