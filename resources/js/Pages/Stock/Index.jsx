import { useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, useForm, router, usePage } from '@inertiajs/react';
import {
    ArchiveBoxArrowDownIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    PaperAirplaneIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';

function formatRupiah(value) {
    const n = Number(value) || 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function fundSourceLabel(source) {
    if (source === 'PRIVATE_CASH') return 'Uang Pribadi';
    if (source === 'MITRA_DELIVERY') return 'Kiriman Mitra';
    return 'Kas Kasir';
}

function deliveryStatus(delivery) {
    if (delivery.status === 'SENT') {
        return { label: 'Menunggu Outlet', className: 'bg-amber-100 text-amber-800' };
    }
    if (delivery.status === 'RECEIVED_MATCH') {
        return { label: 'Sesuai', className: 'bg-emerald-100 text-emerald-800' };
    }
    return { label: 'Ada Selisih', className: 'bg-rose-100 text-rose-800' };
}

export default function StockIndex({ stockItems, displayGroups, restockLogs, deliveries = [] }) {
    const [activeTab, setActiveTab] = useState('stock');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [deliveryItem, setDeliveryItem] = useState(null);
    const [receivingDelivery, setReceivingDelivery] = useState(null);
    const [filterGroup, setFilterGroup] = useState('');

    const { data, setData, post, processing, errors, reset } = useForm({
        id: '',
        name: '',
        current_stock_biji: '',
        unit_name: 'biji',
        min_stock_alert: '0',
        trackable: true,
        counting_basis: 'BIJI',
        display_group_id: '',
        min_restock_qty: '1',
        restock_price: '0',
    });

    const { data: restockData, setData: setRestockData, post: postRestock, processing: restockProcessing, reset: resetRestock, errors: restockErrors } = useForm({
        qty: '',
        fund_source: 'CASHIER_CASH',
        note: '',
    });

    const { data: groupData, setData: setGroupData, post: postGroup, processing: groupProcessing, reset: resetGroup } = useForm({
        name: '',
        context: 'STOCK',
    });

    const {
        data: deliveryData,
        setData: setDeliveryData,
        post: postDelivery,
        processing: deliveryProcessing,
        reset: resetDelivery,
        errors: deliveryErrors,
    } = useForm({
        stock_item_id: '',
        qty_sent: '',
        sender_note: '',
    });

    const {
        data: receiveData,
        setData: setReceiveData,
        post: postReceive,
        processing: receiveProcessing,
        reset: resetReceive,
        errors: receiveErrors,
    } = useForm({
        qty_received: '',
        receiver_note: '',
    });

    const { auth } = usePage().props;
    const isMitra = auth.user?.role === 'MITRA';
    const isOwner = auth.user?.role === 'OWNER';

    const openModal = (item = null) => {
        if (item) {
            setEditingItem(item);
            setData({
                id: item.id,
                name: item.name,
                current_stock_biji: item.current_stock_biji,
                unit_name: item.unit_name,
                min_stock_alert: item.min_stock_alert,
                trackable: item.trackable,
                counting_basis: item.counting_basis,
                display_group_id: item.display_group_id || '',
                min_restock_qty: item.min_restock_qty || '1',
                restock_price: item.restock_price || '0',
            });
        } else {
            setEditingItem(null);
            reset();
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        reset();
        setEditingItem(null);
    };

    const openRestockModal = (item, type = 'ADD') => {
        setEditingItem(item);
        resetRestock();
        setIsRestockModalOpen(true);
    };

    const closeRestockModal = () => {
        setIsRestockModalOpen(false);
        setEditingItem(null);
        resetRestock();
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route('stock.store'), {
            onSuccess: () => closeModal(),
        });
    };

    const handleDelete = (id) => {
        if (confirm('Yakin ingin menghapus bahan stok ini?')) {
            router.delete(route('stock.destroy', id));
        }
    };

    const handleRestock = (e) => {
        e.preventDefault();
        postRestock(route('stock.add', editingItem.id), {
            onSuccess: () => closeRestockModal(),
        });
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

    const openDeliveryModal = (item) => {
        setDeliveryItem(item);
        setDeliveryData({
            stock_item_id: item.id,
            qty_sent: '',
            sender_note: '',
        });
    };

    const closeDeliveryModal = () => {
        setDeliveryItem(null);
        resetDelivery();
    };

    const submitDelivery = (event) => {
        event.preventDefault();
        postDelivery(route('mitra-stock-deliveries.store'), {
            preserveScroll: true,
            onSuccess: () => {
                closeDeliveryModal();
                setActiveTab('deliveries');
            },
        });
    };

    const openReceiveModal = (delivery) => {
        setReceivingDelivery(delivery);
        setReceiveData({
            qty_received: String(Number(delivery.qty_sent)),
            receiver_note: '',
        });
    };

    const closeReceiveModal = () => {
        setReceivingDelivery(null);
        resetReceive();
    };

    const submitReceive = (event) => {
        event.preventDefault();
        postReceive(route('mitra-stock-deliveries.receive', receivingDelivery.id), {
            preserveScroll: true,
            onSuccess: closeReceiveModal,
        });
    };

    const handleUpdatePrice = (id, currentPrice) => {
        const priceStr = prompt("Masukkan harga mitra baru (contoh: 15000):", currentPrice);
        if (priceStr !== null) {
            const price = parseFloat(priceStr);
            if (!isNaN(price) && price >= 0) {
                router.put(route('stock.update-mitra-price', id), { price: price }, { preserveScroll: true });
            } else {
                alert("Harga tidak valid.");
            }
        }
    };

    const filteredStockItems = filterGroup 
        ? stockItems.filter(item => item.display_group_id === filterGroup)
        : stockItems;

    return (
        <ErpLayout title="Inventaris Stok">
            <Head title="Stok" />

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold text-slate-900">Manajemen Stok</h1>
                {isOwner && (
                    <button
                        onClick={() => openModal()}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium"
                    >
                        + Tambah Bahan Stok
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-slate-200">
                <button 
                    onClick={() => setActiveTab('stock')} 
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'stock' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Inventaris Stok
                </button>
                <button 
                    onClick={() => setActiveTab('restock_logs')} 
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'restock_logs' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Histori Restock
                </button>
                <button
                    onClick={() => setActiveTab('deliveries')}
                    className={`relative px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'deliveries' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Kiriman Mitra
                    {deliveries.filter((delivery) => delivery.status === 'SENT').length > 0 && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                            {deliveries.filter((delivery) => delivery.status === 'SENT').length}
                        </span>
                    )}
                </button>
            </div>

            {activeTab === 'stock' && (
                <>
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
                {isOwner && (
                    <button
                        onClick={() => setIsGroupModalOpen(true)}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                        Kelola Group
                    </button>
                )}
            </div>

            <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                        <tr>
                            <th className="px-4 py-3 font-medium">Nama Bahan</th>
                            <th className="px-4 py-3 font-medium">Stok Saat Ini</th>
                            <th className="px-4 py-3 font-medium">Satuan</th>
                            <th className="px-4 py-3 font-medium">Trackable</th>
                            {isMitra && <th className="px-4 py-3 font-medium">Harga Mitra (HPP)</th>}
                            <th className="px-4 py-3 font-medium">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {filteredStockItems.length === 0 ? (
                            <tr>
                                <td colSpan={isMitra ? 6 : 5} className="px-4 py-8 text-center text-slate-500">
                                    Belum ada bahan stok.
                                </td>
                            </tr>
                        ) : (
                            filteredStockItems.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                                    <td className="px-4 py-3 font-semibold">
                                        {Number(item.current_stock_biji).toFixed(2)}
                                        {item.min_stock_alert > 0 && Number(item.current_stock_biji) < Number(item.min_stock_alert) && (
                                            <span className="ml-2 text-xs text-rose-600 font-bold">(Alert)</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">{item.unit_name}</td>
                                    <td className="px-4 py-3">
                                        {item.trackable ? (
                                            <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded text-xs font-medium">Ya</span>
                                        ) : (
                                            <span className="text-slate-500 bg-slate-100 px-2 py-1 rounded text-xs font-medium">Tidak</span>
                                        )}
                                    </td>
                                    {isMitra && (
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-amber-700">Rp {Number(item.restock_price || item.mitra_price || 0).toLocaleString('id-ID')}</span>
                                                {item.min_restock_qty > 0 && (
                                                    <span className="text-xs text-slate-400">/ {item.min_restock_qty} {item.unit_name}</span>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                    <td className="px-4 py-3 flex gap-2">
                                        {isMitra ? (
                                            <button
                                                type="button"
                                                onClick={() => openDeliveryModal(item)}
                                                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                                            >
                                                <PaperAirplaneIcon className="h-4 w-4" />
                                                Catat Kiriman
                                            </button>
                                        ) : (
                                            <>
                                                <button onClick={() => openRestockModal(item)} className="inline-flex items-center justify-center px-3 py-2 bg-emerald-50 text-emerald-600 rounded-md font-medium hover:bg-emerald-100 transition-colors min-h-[36px] active:scale-[0.98]">Restock</button>
                                                {isOwner && <button onClick={() => openModal(item)} className="inline-flex items-center justify-center px-3 py-2 bg-indigo-50 text-indigo-600 rounded-md font-medium hover:bg-indigo-100 transition-colors min-h-[36px] active:scale-[0.98]">Edit</button>}
                                                {isOwner && <button onClick={() => handleDelete(item.id)} className="inline-flex items-center justify-center px-3 py-2 bg-rose-50 text-rose-600 rounded-md font-medium hover:bg-rose-100 transition-colors min-h-[36px] active:scale-[0.98]">Hapus</button>}
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            </>
            )}

            {activeTab === 'restock_logs' && (
                <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                            <tr>
                                <th className="px-4 py-3 font-medium">Tanggal</th>
                                <th className="px-4 py-3 font-medium">Bahan Stok</th>
                                <th className="px-4 py-3 font-medium">Qty Restock</th>
                                <th className="px-4 py-3 font-medium">Stok Sebelum</th>
                                <th className="px-4 py-3 font-medium">Stok Sesudah</th>
                                <th className="px-4 py-3 font-medium">Sumber Dana</th>
                                <th className="px-4 py-3 font-medium text-right">Biaya</th>
                                <th className="px-4 py-3 font-medium">Catatan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {!restockLogs || restockLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                                        Belum ada histori restock.
                                    </td>
                                </tr>
                            ) : (
                                restockLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 whitespace-nowrap">{new Date(log.created_at).toLocaleString('id-ID')}</td>
                                        <td className="px-4 py-3 font-medium text-slate-900">{log.stock_item_name}</td>
                                        <td className="px-4 py-3 font-bold text-emerald-600">+{Number(log.qty_added)} {log.unit_name}</td>
                                        <td className="px-4 py-3 text-slate-500">{Number(log.stock_before)} {log.unit_name}</td>
                                        <td className="px-4 py-3 font-medium">{Number(log.stock_after)} {log.unit_name}</td>
                                        <td className="px-4 py-3">
                                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${log.fund_source === 'PRIVATE_CASH' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                                {fundSourceLabel(log.fund_source)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatRupiah(log.restock_cost)}</td>
                                        <td className="px-4 py-3">{log.note || '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'deliveries' && (
                <section aria-labelledby="delivery-title">
                    <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                        <div>
                            <h2 id="delivery-title" className="text-lg font-semibold text-slate-900">Kiriman Stok Mitra</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                {isMitra
                                    ? 'Jumlah kiriman akan dibandingkan dengan hasil pemeriksaan petugas outlet.'
                                    : 'Periksa jumlah fisik sebelum menambahkannya ke stok outlet.'}
                            </p>
                        </div>
                        <span className="text-sm font-semibold text-slate-600">
                            {deliveries.filter((delivery) => delivery.status === 'SENT').length} menunggu pemeriksaan
                        </span>
                    </div>

                    {deliveries.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-500">
                            Belum ada pengiriman stok dari mitra.
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {deliveries.map((delivery) => {
                                const status = deliveryStatus(delivery);
                                const difference = delivery.qty_received === null
                                    ? null
                                    : Number(delivery.qty_received) - Number(delivery.qty_sent);

                                return (
                                    <article key={delivery.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                        <div className="mb-4 flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold text-slate-900">{delivery.stock_item?.name}</p>
                                                {!isMitra && <p className="mt-0.5 truncate text-sm text-slate-500">{delivery.mitra?.display_name}</p>}
                                            </div>
                                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                                                {status.label}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200">
                                            <div className="bg-slate-50 px-3 py-3">
                                                <p className="text-xs text-slate-500">Dikirim Mitra</p>
                                                <p className="mt-1 font-bold text-slate-900">{Number(delivery.qty_sent).toLocaleString('id-ID')} {delivery.stock_item?.unit_name}</p>
                                            </div>
                                            <div className="bg-slate-50 px-3 py-3">
                                                <p className="text-xs text-slate-500">Diterima Outlet</p>
                                                <p className="mt-1 font-bold text-slate-900">
                                                    {delivery.qty_received === null ? '-' : `${Number(delivery.qty_received).toLocaleString('id-ID')} ${delivery.stock_item?.unit_name}`}
                                                </p>
                                            </div>
                                        </div>

                                        {difference !== null && (
                                            <div className={`mt-3 flex items-center gap-2 text-sm font-semibold ${Math.abs(difference) < 0.0001 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                {Math.abs(difference) < 0.0001
                                                    ? <CheckCircleIcon className="h-5 w-5" />
                                                    : <ExclamationTriangleIcon className="h-5 w-5" />}
                                                {Math.abs(difference) < 0.0001
                                                    ? 'Jumlah sesuai'
                                                    : `Selisih ${difference > 0 ? '+' : ''}${difference.toLocaleString('id-ID')} ${delivery.stock_item?.unit_name}`}
                                            </div>
                                        )}

                                        <div className="mt-4 space-y-1 text-xs text-slate-500">
                                            <p>{new Date(delivery.sent_at).toLocaleString('id-ID')}</p>
                                            {delivery.sender_note && <p>Catatan mitra: {delivery.sender_note}</p>}
                                            {delivery.receiver_note && <p>Catatan outlet: {delivery.receiver_note}</p>}
                                        </div>

                                        {!isMitra && delivery.status === 'SENT' && (
                                            <button
                                                type="button"
                                                onClick={() => openReceiveModal(delivery)}
                                                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
                                            >
                                                <ArchiveBoxArrowDownIcon className="h-5 w-5" />
                                                Periksa dan Terima
                                            </button>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-slate-900">
                                {editingItem ? 'Edit Bahan Stok' : 'Tambah Bahan Stok'}
                            </h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Bahan</label>
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
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Stok Awal</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={data.current_stock_biji}
                                        onChange={e => setData('current_stock_biji', e.target.value)}
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                        required
                                    />
                                    {errors.current_stock_biji && <p className="text-rose-500 text-xs mt-1">{errors.current_stock_biji}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Satuan Dasar</label>
                                    <input
                                        type="text"
                                        value={data.unit_name}
                                        onChange={e => setData('unit_name', e.target.value)}
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                        placeholder="biji, kg, gram, pcs"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Batas Alert Stok</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={data.min_stock_alert}
                                        onChange={e => setData('min_stock_alert', e.target.value)}
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                    />
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
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Minimal Qty Restock</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={data.min_restock_qty}
                                        onChange={e => setData('min_restock_qty', e.target.value)}
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1">Misal: 1000 (jika min order 1000ml)</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Harga Per Minimal Restock</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={data.restock_price}
                                        onChange={e => setData('restock_price', e.target.value)}
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1">Harga untuk qty minimal di samping</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="trackable"
                                        checked={data.trackable}
                                        onChange={e => setData('trackable', e.target.checked)}
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <label htmlFor="trackable" className="text-sm text-slate-700">Trackable (Kurangi stok)</label>
                                </div>
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

            {deliveryItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
                    <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                            <div>
                                <h2 className="font-semibold text-slate-900">Catat Kiriman Stok</h2>
                                <p className="mt-0.5 text-sm text-slate-500">{deliveryItem.name}</p>
                            </div>
                            <button type="button" onClick={closeDeliveryModal} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Tutup">
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={submitDelivery} className="space-y-4 p-5">
                            <label className="block">
                                <span className="mb-1.5 block text-sm font-medium text-slate-700">Jumlah Dikirim ({deliveryItem.unit_name})</span>
                                <input
                                    type="number"
                                    min="0.0001"
                                    step="0.0001"
                                    value={deliveryData.qty_sent}
                                    onChange={(event) => setDeliveryData('qty_sent', event.target.value)}
                                    className="w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    required
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-sm font-medium text-slate-700">Catatan</span>
                                <textarea
                                    rows="3"
                                    value={deliveryData.sender_note}
                                    onChange={(event) => setDeliveryData('sender_note', event.target.value)}
                                    className="w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    placeholder="Nomor surat jalan atau keterangan kiriman"
                                />
                            </label>
                            {deliveryErrors.delivery && <p className="text-sm text-rose-600">{deliveryErrors.delivery}</p>}
                            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                                <button type="button" onClick={closeDeliveryModal} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</button>
                                <button type="submit" disabled={deliveryProcessing} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                                    {deliveryProcessing ? 'Menyimpan...' : 'Catat Pengiriman'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {receivingDelivery && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
                    <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                            <div>
                                <h2 className="font-semibold text-slate-900">Periksa Kiriman</h2>
                                <p className="mt-0.5 text-sm text-slate-500">{receivingDelivery.stock_item?.name}</p>
                            </div>
                            <button type="button" onClick={closeReceiveModal} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Tutup">
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={submitReceive} className="space-y-4 p-5">
                            <div className="rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                                Mitra mencatat <strong>{Number(receivingDelivery.qty_sent).toLocaleString('id-ID')} {receivingDelivery.stock_item?.unit_name}</strong>.
                            </div>
                            <label className="block">
                                <span className="mb-1.5 block text-sm font-medium text-slate-700">Jumlah Fisik Diterima</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    value={receiveData.qty_received}
                                    onChange={(event) => setReceiveData('qty_received', event.target.value)}
                                    className="w-full rounded-md border-slate-300 text-sm focus:border-emerald-500 focus:ring-emerald-500"
                                    required
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-sm font-medium text-slate-700">Catatan Pemeriksaan</span>
                                <textarea
                                    rows="3"
                                    value={receiveData.receiver_note}
                                    onChange={(event) => setReceiveData('receiver_note', event.target.value)}
                                    className="w-full rounded-md border-slate-300 text-sm focus:border-emerald-500 focus:ring-emerald-500"
                                    placeholder="Jelaskan kondisi atau penyebab selisih bila ada"
                                />
                            </label>
                            {receiveErrors.delivery && <p className="text-sm text-rose-600">{receiveErrors.delivery}</p>}
                            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                                <button type="button" onClick={closeReceiveModal} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</button>
                                <button type="submit" disabled={receiveProcessing} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                                    {receiveProcessing ? 'Memproses...' : 'Terima ke Stok Outlet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Restock Modal */}
            {isRestockModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-slate-900">
                                Restock {editingItem?.name}
                            </h2>
                            <button onClick={closeRestockModal} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleRestock} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Stok Saat Ini</label>
                                <div className="font-semibold text-lg">{Number(editingItem?.current_stock_biji).toFixed(2)} {editingItem?.unit_name}</div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Jumlah Tambahan ({editingItem?.unit_name})</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={restockData.qty}
                                    onChange={e => setRestockData('qty', e.target.value)}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    required
                                />
                                {editingItem?.restock_price > 0 && editingItem?.min_restock_qty > 0 && restockData.qty > 0 && (
                                    <div className="mt-2 p-2 bg-indigo-50 rounded border border-indigo-100 text-sm text-indigo-700 font-medium">
                                        Estimasi Biaya / Setoran: {formatRupiah((restockData.qty / editingItem.min_restock_qty) * editingItem.restock_price)}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Sumber Dana Restock</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { value: 'CASHIER_CASH', label: 'Kas Kasir', description: 'Mengurangi saldo laci shift.' },
                                        { value: 'PRIVATE_CASH', label: 'Uang Pribadi', description: 'Biaya luar kasir, saldo shift tetap.' },
                                    ].map(option => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setRestockData('fund_source', option.value)}
                                            className={`rounded-md border px-3 py-2 text-left text-sm transition ${restockData.fund_source === option.value ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            <span className="block font-semibold">{option.label}</span>
                                            <span className="mt-0.5 block text-xs opacity-80">{option.description}</span>
                                        </button>
                                    ))}
                                </div>
                                {restockErrors.fund_source && <p className="mt-1 text-xs text-rose-600">{restockErrors.fund_source}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Catatan (Opsional)</label>
                                <input
                                    type="text"
                                    value={restockData.note}
                                    onChange={e => setRestockData('note', e.target.value)}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            
                            <div className="pt-4 flex justify-end gap-3 border-t border-slate-200">
                                <button type="button" onClick={closeRestockModal} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
                                    Batal
                                </button>
                                <button type="submit" disabled={restockProcessing} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50">
                                    {restockProcessing ? 'Menyimpan...' : 'Simpan Restock'}
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
                                Kelola Group Stok
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
