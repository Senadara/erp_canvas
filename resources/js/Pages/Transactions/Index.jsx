import ErpLayout from '@/Layouts/ErpLayout';
import { Head } from '@inertiajs/react';
import { useState } from 'react';

function formatRupiah(value) {
    const n = Number(value) || 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

export default function TransactionsIndex({ transactions }) {
    const [selectedTransaction, setSelectedTransaction] = useState(null);

    return (
        <ErpLayout title="Riwayat Transaksi">
            <Head title="Transaksi" />

            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-slate-900">Riwayat Transaksi</h1>
            </div>

            <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                        <tr>
                            <th className="px-4 py-3 font-medium">Tanggal</th>
                            <th className="px-4 py-3 font-medium">No. Invoice</th>
                            <th className="px-4 py-3 font-medium">Metode</th>
                            <th className="px-4 py-3 font-medium text-right">Total</th>
                            <th className="px-4 py-3 font-medium">Item</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {transactions.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-4 py-8 text-center text-slate-500">
                                    Belum ada transaksi.
                                </td>
                            </tr>
                        ) : (
                            transactions.map((t) => (
                                <tr key={t.id} onClick={() => setSelectedTransaction(t)} className="hover:bg-slate-50 cursor-pointer">
                                    <td className="px-4 py-3 whitespace-nowrap">{new Date(t.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</td>
                                    <td className="px-4 py-3 font-medium text-indigo-600 group-hover:underline">{t.invoice_number}</td>
                                    <td className="px-4 py-3">
                                        {t.payment_method === 'CASH' ? (
                                            <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs font-bold">TUNAI</span>
                                        ) : (
                                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">QRIS</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                        {formatRupiah(t.total_amount)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-xs space-y-1">
                                            {t.items.slice(0, 2).map((item, idx) => (
                                                <div key={idx}>{item.qty_porsi}x {item.product_name}</div>
                                            ))}
                                            {t.items.length > 2 && (
                                                <div className="text-slate-400 italic">+{t.items.length - 2} item lainnya</div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Receipt Modal */}
            {selectedTransaction && (
                <>
                    <style type="text/css" media="print">
                        {`
                            body * {
                                visibility: hidden;
                            }
                            #receipt-content, #receipt-content * {
                                visibility: visible;
                            }
                            #receipt-content {
                                position: absolute;
                                left: 0;
                                top: 0;
                                width: 100%;
                                margin: 0;
                                padding: 10px;
                                color: black !important;
                            }
                        `}
                    </style>
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh] print:shadow-none">
                            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                                <h2 className="text-lg font-semibold text-slate-900">Detail Struk</h2>
                                <button onClick={() => setSelectedTransaction(null)} className="text-slate-400 hover:text-slate-600">&times;</button>
                            </div>
                            <div className="p-6 overflow-y-auto text-slate-800" id="receipt-content">
                                <div className="text-center mb-4">
                                    <h3 className="font-bold text-lg">Outlet {selectedTransaction.outlet?.name || 'Toko'}</h3>
                                    {selectedTransaction.outlet?.address && <p className="text-xs text-slate-600">{selectedTransaction.outlet.address}</p>}
                                    {selectedTransaction.outlet?.phone && <p className="text-xs text-slate-600">Telp: {selectedTransaction.outlet.phone}</p>}
                                    <p className="text-xs text-slate-500 mt-1">{new Date(selectedTransaction.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p>
                                    <p className="text-xs text-slate-500">No: {selectedTransaction.invoice_number}</p>
                                </div>
                                <div className="border-t border-b border-dashed border-slate-300 py-3 mb-3 space-y-2">
                                    {selectedTransaction.items?.map(item => (
                                        <div key={item.id} className="flex justify-between text-sm">
                                            <div>
                                                <span>{item.product_name}</span>
                                                <div className="text-xs text-slate-500">{item.qty_porsi} x {formatRupiah(item.price_per_porsi)}</div>
                                            </div>
                                            <span>{formatRupiah(item.subtotal)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between font-bold">
                                        <span>Total</span>
                                        <span>{formatRupiah(selectedTransaction.total_amount)}</span>
                                    </div>
                                    {selectedTransaction.payment_method === 'CASH' && selectedTransaction.cash_received && (
                                        <>
                                            <div className="flex justify-between">
                                                <span>Tunai</span>
                                                <span>{formatRupiah(selectedTransaction.cash_received)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Kembali</span>
                                                <span>{formatRupiah(selectedTransaction.change_amount)}</span>
                                            </div>
                                        </>
                                    )}
                                    {selectedTransaction.payment_method === 'QRIS' && (
                                        <div className="flex justify-between text-blue-600 mt-2">
                                            <span>Dibayar dengan</span>
                                            <span className="font-bold">QRIS</span>
                                        </div>
                                    )}
                                    {selectedTransaction.payment_status === 'UNPAID' && (
                                        <div className="flex justify-between text-rose-600 mt-2 font-bold">
                                            <span>Status</span>
                                            <span>BELUM BAYAR (UTANG)</span>
                                        </div>
                                    )}
                                </div>
                                {selectedTransaction.note && (
                                    <div className="mt-4 text-xs italic text-center text-slate-600">
                                        Catatan: {selectedTransaction.note}
                                    </div>
                                )}
                                <div className="mt-6 text-center text-xs font-semibold text-slate-500">
                                    Terima Kasih Atas Kunjungan Anda!
                                </div>
                            </div>
                            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                                <button onClick={() => setSelectedTransaction(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
                                    Tutup
                                </button>
                                <button onClick={() => window.print()} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                    </svg>
                                    Cetak Struk
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </ErpLayout>
    );
}
