import ErpLayout from '@/Layouts/ErpLayout';
import { Head } from '@inertiajs/react';

function formatRupiah(value) {
    const n = Number(value) || 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

export default function TransactionsIndex({ transactions }) {
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
                                <tr key={t.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 whitespace-nowrap">{new Date(t.created_at).toLocaleString('id-ID')}</td>
                                    <td className="px-4 py-3 font-medium">{t.invoice_number}</td>
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
        </ErpLayout>
    );
}
