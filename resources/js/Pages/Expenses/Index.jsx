import { useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, useForm, router } from '@inertiajs/react';

function formatRupiah(value) {
    const n = Number(value) || 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

export default function ExpensesIndex({ expenses, openShift }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm({
        amount: '',
        category: 'Operasional',
        description: '',
        date: '',
    });

    const categories = [
        'Operasional',
        'Bahan Baku',
        'Gaji',
        'Listrik/Air',
        'Tambah Modal',
        'Lainnya'
    ];

    const handleOpenAdd = () => {
        setEditingId(null);
        reset();
        clearErrors();
        
        // Default date to current local datetime in format YYYY-MM-DDTHH:mm
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        setData('date', now.toISOString().slice(0, 16));
        
        setIsModalOpen(true);
    };

    const handleOpenEdit = (expense) => {
        setEditingId(expense.id);
        clearErrors();
        
        // Format the date for the datetime-local input
        const d = new Date(expense.created_at);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        
        setData({
            amount: expense.amount,
            category: expense.category,
            description: expense.description || '',
            date: d.toISOString().slice(0, 16),
        });
        setIsModalOpen(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingId) {
            put(route('expenses.update', editingId), {
                onSuccess: () => {
                    setIsModalOpen(false);
                    reset();
                }
            });
        } else {
            post(route('expenses.store'), {
                onSuccess: () => {
                    setIsModalOpen(false);
                    reset();
                }
            });
        }
    };

    const handleDelete = (id) => {
        if (confirm('Yakin ingin menghapus catatan pengeluaran ini?')) {
            router.delete(route('expenses.destroy', id));
        }
    };

    return (
        <ErpLayout title="Pengeluaran & Kas">
            <Head title="Pengeluaran" />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h1 className="text-2xl font-semibold text-slate-900">Pengeluaran & Kasbon</h1>
                <button
                    onClick={handleOpenAdd}
                    className="bg-indigo-600 text-white px-4 py-3 sm:py-2 rounded-lg sm:rounded-md hover:bg-indigo-700 text-sm font-semibold sm:font-medium w-full sm:w-auto shadow-sm min-h-[44px] flex items-center justify-center transition-all active:scale-[0.98]"
                >
                    + Catat Pengeluaran
                </button>
            </div>

            {!openShift && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-md mb-6">
                    <p className="font-medium text-sm">Peringatan: Tidak ada shift yang terbuka saat ini. Pengeluaran yang dicatat akan masuk ke shift berikutnya yang dibuka atau berdiri sendiri.</p>
                </div>
            )}

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white shadow-sm rounded-lg border border-slate-200 overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                        <tr>
                            <th className="px-4 py-3 font-medium">Tanggal</th>
                            <th className="px-4 py-3 font-medium">Kategori</th>
                            <th className="px-4 py-3 font-medium">Keterangan</th>
                            <th className="px-4 py-3 font-medium text-right">Nominal (Rp)</th>
                            <th className="px-4 py-3 font-medium text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {expenses.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-4 py-8 text-center text-slate-500">
                                    Belum ada catatan pengeluaran.
                                </td>
                            </tr>
                        ) : (
                            expenses.map((e) => (
                                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap">{new Date(e.created_at).toLocaleString('id-ID')}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${e.category === 'Tambah Modal' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                            {e.category}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">{e.description || '-'}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatRupiah(e.amount)}</td>
                                    <td className="px-4 py-3 text-center space-x-2">
                                        <button onClick={() => handleOpenEdit(e)} className="inline-flex items-center justify-center px-3 py-2 bg-indigo-50 text-indigo-600 rounded-md font-medium hover:bg-indigo-100 transition-colors min-h-[36px] active:scale-[0.98]">Edit</button>
                                        <button onClick={() => handleDelete(e.id)} className="inline-flex items-center justify-center px-3 py-2 bg-rose-50 text-rose-600 rounded-md font-medium hover:bg-rose-100 transition-colors min-h-[36px] active:scale-[0.98]">Hapus</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {expenses.length === 0 ? (
                    <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500 text-sm">
                        Belum ada catatan pengeluaran.
                    </div>
                ) : (
                    expenses.map((e) => (
                        <div key={e.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div className="flex-1 pr-2">
                                    <div className="text-xs font-medium text-slate-500 mb-1">{new Date(e.created_at).toLocaleString('id-ID')}</div>
                                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold tracking-wide mb-2 ${e.category === 'Tambah Modal' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                        {e.category}
                                    </span>
                                    <p className="text-sm text-slate-700 leading-snug">{e.description || 'Tanpa keterangan'}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="font-bold text-slate-900 text-base">{formatRupiah(e.amount)}</div>
                                </div>
                            </div>
                            <div className="border-t border-slate-100 pt-3 flex justify-end gap-2 mt-1">
                                        <button onClick={() => handleOpenEdit(e)} className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors min-h-[44px] active:scale-[0.98]">Edit</button>
                                        <button onClick={() => handleDelete(e.id)} className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2.5 bg-rose-50 text-rose-700 rounded-lg text-sm font-semibold hover:bg-rose-100 transition-colors min-h-[44px] active:scale-[0.98]">Hapus</button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:p-0 transition-opacity">
                    <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col animate-slide-up sm:animate-fade-in">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-md">
                            <h2 className="text-lg font-bold text-slate-900">
                                {editingId ? 'Edit Pengeluaran / Kas' : 'Catat Pengeluaran / Kas'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-full transition-colors flex items-center justify-center min-w-[44px] min-h-[44px]">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal & Waktu</label>
                                <input
                                    type="datetime-local"
                                    value={data.date}
                                    onChange={e => setData('date', e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-slate-50 focus:bg-white"
                                />
                                {errors.date && <p className="text-rose-500 text-xs mt-1.5">{errors.date}</p>}
                                <p className="text-xs text-slate-500 mt-1.5">Mundur ke tanggal sebelumnya (backdate) bisa dilakukan.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nominal (Rp)</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={data.amount}
                                    onChange={e => setData('amount', e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-slate-50 focus:bg-white font-medium"
                                    required
                                    placeholder="Contoh: 50000"
                                />
                                {errors.amount && <p className="text-rose-500 text-xs mt-1.5">{errors.amount}</p>}
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Kategori</label>
                                <select
                                    value={data.category}
                                    onChange={e => setData('category', e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-slate-50 focus:bg-white"
                                    required
                                >
                                    {categories.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                                {errors.category && <p className="text-rose-500 text-xs mt-1.5">{errors.category}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Keterangan Tambahan</label>
                                <textarea
                                    value={data.description}
                                    onChange={e => setData('description', e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-slate-50 focus:bg-white"
                                    rows="3"
                                    placeholder="Opsional, misal: Beli es batu kristal 2 pack"
                                ></textarea>
                                {errors.description && <p className="text-rose-500 text-xs mt-1.5">{errors.description}</p>}
                            </div>

                            <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto px-5 py-3 sm:py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors min-h-[44px] flex items-center justify-center active:scale-[0.98]">
                                    Batal
                                </button>
                                <button type="submit" disabled={processing} className="w-full sm:w-auto px-5 py-3 sm:py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 disabled:opacity-70 transition-all min-h-[44px] flex items-center justify-center active:scale-[0.98]">
                                    {processing ? 'Menyimpan...' : 'Simpan Pengeluaran'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </ErpLayout>
    );
}
