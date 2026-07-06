import { useState, useEffect } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, useForm, router, usePage } from '@inertiajs/react';
import { isOnline, onConnectivityChange, enqueueShift, enqueueExpense } from '@/pwa/offlineQueue';

function formatRupiah(value) {
    const n = Number(value) || 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function defaultShiftName() {
    const now = new Date();
    return `Shift ${now.toLocaleDateString('id-ID')} ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
}

function isCashierFundMovement(item) {
    return item.category === 'Tambah Kas' || item.category === 'Tambah Modal';
}

function isIncomingMovement(item) {
    return item.cash_flow === 'IN' && !isCashierFundMovement(item);
}

function paymentLabel(method) {
    if (method === 'PRIVATE') return 'Uang Pribadi';
    return method || 'CASH';
}

function paymentTone(method) {
    if (method === 'QRIS') return 'bg-blue-100 text-blue-700';
    if (method === 'PRIVATE') return 'bg-amber-100 text-amber-800';
    return 'bg-emerald-100 text-emerald-700';
}

export default function ShiftsIndex({ shifts, openShift, expenses, cashSummary, standardOpeningCash = 50000 }) {
    const { auth } = usePage().props;
    const isOwner = auth?.user?.role === 'OWNER';
    const cashierStandardCash = Number(standardOpeningCash) || 50000;
    const [isClosing, setIsClosing] = useState(false);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [movementTitle, setMovementTitle] = useState('Catat Pengeluaran');
    const [shiftDetail, setShiftDetail] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [isOffline, setIsOffline] = useState(!isOnline());
    const [localShifts, setLocalShifts] = useState([]);
    const [localExpenses, setLocalExpenses] = useState([]);
    const [editingShift, setEditingShift] = useState(null);
    
    const { data: openData, setData: setOpenData, post: postOpen, processing: opening } = useForm({
        name: defaultShiftName(),
        opening_cash: cashierStandardCash,
    });

    const { data: closeData, setData: setCloseData, post: postClose, processing: closing } = useForm({
        actual_cash: '',
        note: '',
    });

    const { data: expenseData, setData: setExpenseData, post: postExpense, processing: expenseProcessing, reset: resetExpense } = useForm({
        amount: '',
        category: 'Operasional',
        payment_method: 'CASH',
        cash_flow: 'OUT',
        description: '',
    });

    const { data: editShiftData, setData: setEditShiftData, put: putShift, delete: deleteShift, processing: shiftEditProcessing } = useForm({
        name: '',
        opened_at: '',
        closed_at: '',
        opening_cash: '',
        actual_cash: '',
        note: '',
    });

    const expenseCategories = [
        'Operasional',
        'Bahan Baku',
        'Gaji',
        'Listrik/Air',
        'Tambah Kas',
        'Lainnya'
    ];

    // Monitor connectivity changes
    useEffect(() => {
        const cleanup = onConnectivityChange((online) => {
            setIsOffline(!online);
        });
        return cleanup;
    }, []);

    const toLocalInputValue = (value) => {
        if (!value) return '';
        const date = new Date(value);
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        return date.toISOString().slice(0, 16);
    };

    const openMovementModal = (type = 'expense') => {
        if (type === 'add') {
            setMovementTitle('Tambah Kas Kasir');
            setExpenseData({
                amount: '',
                category: 'Tambah Kas',
                payment_method: 'CASH',
                cash_flow: 'OUT',
                description: 'Alokasi tambahan kas kasir dari kas kontainer',
            });
        } else {
            setMovementTitle('Catat Pengeluaran');
            setExpenseData({
                amount: '',
                category: 'Operasional',
                payment_method: 'CASH',
                cash_flow: 'OUT',
                description: '',
            });
        }
        setIsExpenseModalOpen(true);
    };

    const openShiftEditor = (shift) => {
        setEditingShift(shift);
        setEditShiftData({
            name: shift.name || '',
            opened_at: toLocalInputValue(shift.opened_at),
            closed_at: toLocalInputValue(shift.closed_at),
            opening_cash: shift.opening_cash || '',
            actual_cash: shift.actual_cash || '',
            note: shift.note || '',
        });
    };

    const handleShiftEditSubmit = (e) => {
        e.preventDefault();
        if (!editingShift) return;

        putShift(route('shifts.owner-update', editingShift.id), {
            onSuccess: () => setEditingShift(null),
        });
    };

    const handleShiftDelete = (shift) => {
        if (confirm('Yakin ingin menghapus shift kosong ini? Shift yang punya transaksi atau mutasi kas tidak dapat dihapus.')) {
            deleteShift(route('shifts.destroy', shift.id), {
                onSuccess: () => setEditingShift(null),
            });
        }
    };

    const handleOpen = async (e) => {
        e.preventDefault();
        
        if (isOffline) {
            try {
                const localId = await enqueueShift({ name: openData.name, opening_cash: cashierStandardCash }, 'open');
                // Create a local shift object for immediate UI update
                const localShift = {
                    id: `local-${localId}`,
                    localId,
                    name: openData.name,
                    opening_cash: cashierStandardCash,
                    opened_at: new Date().toISOString(),
                    isOffline: true
                };
                setLocalShifts(prev => [...prev, localShift]);
                alert('Shift dibuka offline. Akan disinkronkan saat online.');
                setOpenData({ name: defaultShiftName(), opening_cash: cashierStandardCash });
                return;
            } catch (error) {
                console.error('Failed to enqueue offline shift:', error);
                alert('Gagal menyimpan shift offline.');
                return;
            }
        }

        postOpen(route('shifts.store'), {
            onSuccess: () => setOpenData({ name: defaultShiftName(), opening_cash: cashierStandardCash })
        });
    };

    const handleClose = async (e) => {
        e.preventDefault();
        
        if (isOffline) {
            try {
                const localId = await enqueueShift({ 
                    shift_id: openShift.id,
                    actual_cash: closeData.actual_cash,
                    note: closeData.note 
                }, 'close');
                // Create a local shift close object for immediate UI update
                const localShiftClose = {
                    id: `local-${localId}`,
                    localId,
                    shift_id: openShift.id,
                    actual_cash: Number(closeData.actual_cash),
                    note: closeData.note,
                    closed_at: new Date().toISOString(),
                    isOffline: true
                };
                setLocalShifts(prev => [...prev, localShiftClose]);
                alert('Shift ditutup offline. Akan disinkronkan saat online.');
                setIsClosing(false);
                setCloseData({ actual_cash: '', note: '' });
                return;
            } catch (error) {
                console.error('Failed to enqueue offline shift close:', error);
                alert('Gagal menyimpan penutupan shift offline.');
                return;
            }
        }

        postClose(route('shifts.update', openShift.id), {
            onSuccess: () => {
                setIsClosing(false);
                setCloseData({ actual_cash: '', note: '' });
            }
        });
    };

    const handleExpenseSubmit = async (e) => {
        e.preventDefault();
        
        if (isOffline) {
            try {
                const localId = await enqueueExpense(expenseData);
                // Create a local expense object for immediate UI update
                const localExpense = {
                    id: `local-${localId}`,
                    localId,
                    ...expenseData,
                    created_at: new Date().toISOString(),
                    isOffline: true
                };
                setLocalExpenses(prev => [...prev, localExpense]);
                alert('Pengeluaran disimpan offline. Akan disinkronkan saat online.');
                setIsExpenseModalOpen(false);
                resetExpense();
                return;
            } catch (error) {
                console.error('Failed to enqueue offline expense:', error);
                alert('Gagal menyimpan pengeluaran offline.');
                return;
            }
        }

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

    const openShiftDetail = async (shiftId) => {
        setLoadingDetail(true);
        try {
            const res = await fetch(`/shifts/${shiftId}/detail`, {
                headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
            });
            const data = await res.json();
            setShiftDetail(data);
        } catch (e) {
            console.error('Failed to load shift detail', e);
        } finally {
            setLoadingDetail(false);
        }
    };

    return (
        <ErpLayout title="Manajemen Shift">
            <Head title="Shift" />

            <div className="mb-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-semibold text-slate-900">Manajemen Shift</h1>
                    {isOffline && (
                        <span className="bg-amber-100 text-amber-800 text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            Offline Mode
                        </span>
                    )}
                </div>
            </div>

            {openShift && cashSummary && (
                <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg border border-emerald-200 shadow-sm p-4">
                        <p className="text-xs font-semibold uppercase text-emerald-600">Saldo Cash Kasir</p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">{formatRupiah(cashSummary.cash?.expected)}</p>
                        <p className="mt-1 text-xs text-slate-500">Penjualan {formatRupiah(cashSummary.cash?.sales)} - keluar/alokasi {formatRupiah((cashSummary.cash?.expenses || 0) + (cashSummary.cash?.withdrawals || 0))}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-blue-200 shadow-sm p-4">
                        <p className="text-xs font-semibold uppercase text-blue-600">Saldo QRIS</p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">{formatRupiah(cashSummary.qris?.expected)}</p>
                        <p className="mt-1 text-xs text-slate-500">Penjualan {formatRupiah(cashSummary.qris?.sales)} - penarikan {formatRupiah(cashSummary.qris?.withdrawals)}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-indigo-200 shadow-sm p-4">
                        <p className="text-xs font-semibold uppercase text-indigo-600">Total Cash + QRIS</p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">{formatRupiah(cashSummary.total_expected)}</p>
                        <p className="mt-1 text-xs text-slate-500">Sudah termasuk alokasi kas kasir, pengeluaran, dan penarikan.</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white shadow-sm rounded-lg border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Status Shift Saat Ini</h2>
                    {openShift ? (
                        <div className="space-y-4">
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-md flex justify-between items-center">
                                <div>
                                    <p className="font-bold">Shift Terbuka {openShift.name ? `(${openShift.name})` : ''}</p>
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
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Shift</label>
                                <input
                                    type="text"
                                    value={openData.name}
                                    onChange={e => setOpenData('name', e.target.value)}
                                    placeholder="Contoh: Shift Pagi, Shift Siang"
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Kas Awal Standar (Uang di Laci) Rp</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={openData.opening_cash}
                                    readOnly
                                    className="w-full border border-amber-200 bg-amber-50 rounded-md px-3 py-2 text-sm font-semibold text-amber-900"
                                    required
                                />
                                <p className="mt-1 text-xs text-slate-500">Kas awal selalu {formatRupiah(cashierStandardCash)} setiap buka shift. Jika hari ini ada top up tambahan, shift berikutnya tetap kembali ke standar ini.</p>
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
                        <h2 className="text-lg font-semibold text-slate-900">Mutasi Kas Shift</h2>
                        <div className="flex flex-wrap justify-end gap-2">
                            <button
                                onClick={() => openMovementModal('expense')}
                                disabled={!openShift}
                                className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                            >
                                Pengeluaran
                            </button>
                            <button
                                onClick={() => openMovementModal('add')}
                                disabled={!openShift}
                                className="bg-emerald-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                            >
                                Top Up Kasir
                            </button>
                        </div>
                    </div>

                    {!openShift ? (
                        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                            Buka shift terlebih dahulu untuk mencatat mutasi kas.
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col">
                            <div className="flex-1 overflow-y-auto min-h-[200px] border border-slate-200 rounded-md">
                                <table className="w-full text-left text-sm text-slate-600">
                                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 font-medium">Kategori</th>
                                            <th className="px-3 py-2 font-medium">Media</th>
                                            <th className="px-3 py-2 font-medium">Nominal</th>
                                            <th className="px-3 py-2 font-medium w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(!expenses || expenses.length === 0) && localExpenses.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="px-3 py-6 text-center text-slate-400 text-xs">
                                                    Belum ada mutasi kas di shift ini.
                                                </td>
                                            </tr>
                                        ) : (
                                            [...(expenses || []), ...localExpenses].map(e => {
                                                const incoming = isIncomingMovement(e);
                                                const cashierFund = isCashierFundMovement(e);
                                                return (
                                                    <tr key={e.id} className="hover:bg-slate-50">
                                                        <td className="px-3 py-2">
                                                            <span className="font-medium text-slate-800 block text-xs">{cashierFund ? 'Kas Kasir' : e.category}</span>
                                                            {e.description && <span className="text-[10px] text-slate-500 line-clamp-1">{e.description}</span>}
                                                            {e.edited_by_owner_at && <span className="mt-1 inline-block text-[10px] text-amber-700 bg-amber-100 px-1 rounded">Edited owner</span>}
                                                            {e.isOffline && <span className="text-[10px] text-amber-600 bg-amber-50 px-1 rounded">Offline</span>}
                                                        </td>
                                                        <td className="px-3 py-2 text-xs">
                                                            <span className={`px-1.5 py-0.5 rounded font-semibold ${paymentTone(e.payment_method)}`}>{paymentLabel(e.payment_method)}</span>
                                                        </td>
                                                        <td className={`px-3 py-2 font-semibold text-xs ${incoming ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {incoming ? '+' : '-'} {formatRupiah(e.amount)}
                                                        </td>
                                                        <td className="px-3 py-2 text-right">
                                                            {isOwner && !e.isOffline && <button onClick={() => handleExpenseDelete(e.id)} className="text-rose-500 hover:text-rose-700 text-xs font-bold">&times;</button>}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center text-sm">
                                <span className="font-semibold text-slate-700">Total Saldo Shift:</span>
                                <span className="font-bold text-indigo-700">
                                    {formatRupiah(cashSummary?.total_expected)}
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
                            <th className="px-4 py-3 font-medium">Shift</th>
                            <th className="px-4 py-3 font-medium">Buka</th>
                            <th className="px-4 py-3 font-medium">Tutup</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium text-right">Kas Awal</th>
                            <th className="px-4 py-3 font-medium text-right">Ekspektasi Kas</th>
                            <th className="px-4 py-3 font-medium text-right">Selisih</th>
                            {isOwner && <th className="px-4 py-3 font-medium text-center">Aksi</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {shifts.length === 0 ? (
                            <tr>
                                <td colSpan={isOwner ? 8 : 7} className="px-4 py-8 text-center text-slate-500">
                                    Belum ada riwayat shift.
                                </td>
                            </tr>
                        ) : (
                            shifts.map((s) => (
                                <tr key={s.id} onClick={() => openShiftDetail(s.id)} className="hover:bg-indigo-50 cursor-pointer transition-colors">
                                    <td className="px-4 py-3 font-medium">
                                        <div>{s.name || '-'}</div>
                                        {s.edited_by_owner_at && <span className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Edited owner</span>}
                                    </td>
                                    <td className="px-4 py-3">{new Date(s.opened_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</td>
                                    <td className="px-4 py-3">{s.closed_at ? new Date(s.closed_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-'}</td>
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
                                    {isOwner && (
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openShiftEditor(s);
                                                }}
                                                className="rounded bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                                            >
                                                Edit
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Shift Detail Modal */}
            {(shiftDetail || loadingDetail) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                            <h2 className="text-lg font-semibold">Detail Laporan Shift</h2>
                            <button onClick={() => setShiftDetail(null)} className="text-white/70 hover:text-white text-xl">&times;</button>
                        </div>
                        {loadingDetail ? (
                            <div className="p-12 text-center text-slate-500">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
                                Memuat data...
                            </div>
                        ) : shiftDetail && (
                            <div className="p-6 overflow-y-auto space-y-5">
                                {/* Summary Cards */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                                        <p className="text-xs text-indigo-600 font-medium">Durasi Shift</p>
                                        <p className="text-lg font-bold text-indigo-900">{shiftDetail.duration}</p>
                                    </div>
                                    <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                                        <p className="text-xs text-emerald-600 font-medium">Total Pendapatan</p>
                                        <p className="text-lg font-bold text-emerald-900">{formatRupiah(shiftDetail.total_revenue)}</p>
                                    </div>
                                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                                        <p className="text-xs text-blue-600 font-medium">Jumlah Transaksi</p>
                                        <p className="text-lg font-bold text-blue-900">{shiftDetail.total_transactions}</p>
                                        <p className="text-[10px] text-blue-500">{shiftDetail.paid_count} lunas, {shiftDetail.unpaid_count} utang</p>
                                    </div>
                                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                                        <p className="text-xs text-amber-600 font-medium">Rata-rata Transaksi</p>
                                        <p className="text-lg font-bold text-amber-900">{formatRupiah(shiftDetail.avg_transaction)}</p>
                                    </div>
                                </div>

                                {/* Unpaid Warning */}
                                {shiftDetail.unpaid_count > 0 && (
                                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-center gap-3">
                                        <span className="text-rose-500 text-xl">⚠️</span>
                                        <div>
                                            <p className="text-sm font-semibold text-rose-800">{shiftDetail.unpaid_count} Order Belum Bayar</p>
                                            <p className="text-xs text-rose-600">Total utang: {formatRupiah(shiftDetail.unpaid_total)}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Product Breakdown */}
                                {shiftDetail.product_breakdown?.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-800 mb-2">Produk Terlaris</h3>
                                        <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="bg-slate-100 text-slate-600">
                                                        <th className="px-3 py-2 text-left font-medium">Produk</th>
                                                        <th className="px-3 py-2 text-right font-medium">Qty</th>
                                                        <th className="px-3 py-2 text-right font-medium">Revenue</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {shiftDetail.product_breakdown.map((p, i) => (
                                                        <tr key={i} className="hover:bg-white">
                                                            <td className="px-3 py-1.5 font-medium text-slate-700">{p.name}</td>
                                                            <td className="px-3 py-1.5 text-right text-slate-600">{p.qty}x</td>
                                                            <td className="px-3 py-1.5 text-right font-semibold text-slate-800">{formatRupiah(p.revenue)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Expense Breakdown */}
                                {Object.keys(shiftDetail.expense_by_category || {}).length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-800 mb-2">Pengeluaran per Kategori</h3>
                                        <div className="space-y-1">
                                            {Object.entries(shiftDetail.expense_by_category).map(([cat, amount]) => (
                                                <div key={cat} className="flex justify-between items-center bg-rose-50 rounded px-3 py-1.5 border border-rose-100">
                                                    <span className="text-xs font-medium text-rose-800">{cat}</span>
                                                    <span className="text-xs font-bold text-rose-700">{formatRupiah(amount)}</span>
                                                </div>
                                            ))}
                                            <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-1">
                                                <span className="text-sm font-semibold text-slate-700">Total Pengeluaran</span>
                                                <span className="text-sm font-bold text-rose-600">{formatRupiah(shiftDetail.total_expenses)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Financial Summary */}
                                <div className="bg-slate-900 text-white rounded-lg p-4">
                                    <h3 className="text-sm font-medium text-slate-300 mb-3">Ringkasan Keuangan</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Kas Awal</span>
                                            <span>{formatRupiah(shiftDetail.shift?.opening_cash)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">+ Penjualan (Cash)</span>
                                            <span className="text-emerald-400">{formatRupiah(shiftDetail.shift?.total_sales_cash)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">- Alokasi Kas Kasir</span>
                                            <span className="text-rose-400">{formatRupiah(shiftDetail.cash_summary?.cash?.cashier_topups)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">+ Penjualan (QRIS)</span>
                                            <span className="text-blue-400">{formatRupiah(shiftDetail.shift?.total_sales_qris)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">- Pengeluaran</span>
                                            <span className="text-rose-400">{formatRupiah(shiftDetail.total_expenses)}</span>
                                        </div>
                                        {Number(shiftDetail.cash_summary?.outside?.expenses || 0) > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Termasuk uang pribadi</span>
                                                <span className="text-amber-300">{formatRupiah(shiftDetail.cash_summary?.outside?.expenses)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">- Penarikan Cash</span>
                                            <span className="text-rose-400">{formatRupiah(shiftDetail.cash_summary?.cash?.withdrawals)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">- Penarikan QRIS</span>
                                            <span className="text-rose-400">{formatRupiah(shiftDetail.cash_summary?.qris?.withdrawals)}</span>
                                        </div>
                                        <div className="border-t border-slate-700 pt-2 flex justify-between font-bold">
                                            <span>Ekspektasi Kas</span>
                                            <span>{formatRupiah(shiftDetail.shift?.expected_cash)}</span>
                                        </div>
                                        <div className="flex justify-between font-bold">
                                            <span>Ekspektasi QRIS</span>
                                            <span>{formatRupiah(shiftDetail.cash_summary?.qris?.expected)}</span>
                                        </div>
                                        {shiftDetail.shift?.actual_cash && (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Kas Aktual</span>
                                                    <span>{formatRupiah(shiftDetail.shift.actual_cash)}</span>
                                                </div>
                                                <div className="flex justify-between font-bold">
                                                    <span>Selisih</span>
                                                    <span className={Number(shiftDetail.shift.discrepancy) < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                                                        {formatRupiah(shiftDetail.shift.discrepancy)}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
                            <button onClick={() => setShiftDetail(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editingShift && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-slate-900">Koreksi Shift Owner</h2>
                            <button onClick={() => setEditingShift(null)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleShiftEditSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Shift</label>
                                <input type="text" value={editShiftData.name} onChange={e => setEditShiftData('name', e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Waktu Buka</label>
                                    <input type="datetime-local" value={editShiftData.opened_at} onChange={e => setEditShiftData('opened_at', e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Waktu Tutup</label>
                                    <input type="datetime-local" value={editShiftData.closed_at} onChange={e => setEditShiftData('closed_at', e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Kas Awal</label>
                                    <input type="number" min="0" value={editShiftData.opening_cash} onChange={e => setEditShiftData('opening_cash', e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Kas Aktual</label>
                                    <input type="number" min="0" value={editShiftData.actual_cash} onChange={e => setEditShiftData('actual_cash', e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
                                <textarea value={editShiftData.note} onChange={e => setEditShiftData('note', e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" rows="2" />
                            </div>
                            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between gap-3">
                                <button type="button" onClick={() => handleShiftDelete(editingShift)} className="px-4 py-2 text-sm font-medium text-rose-700 bg-rose-50 rounded-md hover:bg-rose-100">
                                    Hapus Shift
                                </button>
                                <div className="flex gap-3 justify-end">
                                    <button type="button" onClick={() => setEditingShift(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
                                        Batal
                                    </button>
                                    <button type="submit" disabled={shiftEditProcessing} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">
                                        {shiftEditProcessing ? 'Menyimpan...' : 'Simpan Koreksi'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Expense Modal */}
            {isExpenseModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-slate-900">
                                {movementTitle}
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
                                    onChange={e => {
                                        const category = e.target.value;
                                        setExpenseData('category', category);
                                        setExpenseData('cash_flow', 'OUT');
                                        if (category === 'Tambah Kas') setExpenseData('payment_method', 'CASH');
                                    }}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                    required
                                >
                                    {expenseCategories.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                                {expenseData.category === 'Tambah Kas' && (
                                    <p className="mt-1 text-xs text-amber-700">Top up kasir dicatat sebagai alokasi keluar dari kas kontainer.</p>
                                )}
                            </div>
                            {expenseData.category === 'Penarikan' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Sumber Saldo</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setExpenseData('payment_method', 'CASH')}
                                            className={`py-2 rounded border text-sm font-medium ${expenseData.payment_method === 'CASH' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'border-slate-300 text-slate-600'}`}
                                        >
                                            Cash
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setExpenseData('payment_method', 'QRIS')}
                                            className={`py-2 rounded border text-sm font-medium ${expenseData.payment_method === 'QRIS' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-300 text-slate-600'}`}
                                        >
                                            QRIS
                                        </button>
                                    </div>
                                </div>
                            )}
                            {expenseData.category !== 'Penarikan' && (
                                <input type="hidden" value={expenseData.payment_method} readOnly />
                            )}
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
