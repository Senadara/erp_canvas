import { useMemo, useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
    BanknotesIcon,
    CalendarDaysIcon,
    ClipboardDocumentListIcon,
    EyeIcon,
    FunnelIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';

function formatRupiah(value) {
    const n = Number(value) || 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

const FINANCE_TIMEZONE = 'Asia/Jakarta';

function financeDatetimeValue(value = new Date()) {
    const parts = new Intl.DateTimeFormat('sv-SE', {
        timeZone: FINANCE_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(new Date(value)).reduce((carry, part) => {
        if (part.type !== 'literal') carry[part.type] = part.value;
        return carry;
    }, {});

    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function isCashierFundMovement(item) {
    return item.category === 'Tambah Kas' || item.category === 'Tambah Modal';
}

function isOutsideCashierTopup(item) {
    return isCashierFundMovement(item) && item.payment_method === 'PRIVATE';
}

function isIncomingMovement(item) {
    return item.cash_flow === 'IN';
}

function paymentLabel(method) {
    if (method === 'PRIVATE') return 'Uang Pribadi';
    return method || 'CASH';
}

function paymentTone(method) {
    if (method === 'QRIS') return 'bg-blue-100 text-blue-800';
    if (method === 'PRIVATE') return 'bg-amber-100 text-amber-800';
    return 'bg-emerald-50 text-emerald-700';
}

function movementCategoryTone(item, incoming, cashierFund, isWithdrawal) {
    if (cashierFund) return 'bg-amber-100 text-amber-800';
    if (isWithdrawal) return 'bg-slate-100 text-slate-700';
    if (item.payment_method === 'PRIVATE') return 'bg-amber-100 text-amber-800';
    return incoming ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800';
}

function movementAmountTone(item, incoming, cashierFund, outsideTopup) {
    if (item.payment_method === 'PRIVATE') return 'text-amber-700';
    if (cashierFund) return outsideTopup ? 'text-emerald-700' : 'text-amber-700';
    return incoming ? 'text-emerald-600' : 'text-rose-600';
}

function movementSign(item, incoming, cashierFund, outsideTopup) {
    if (item.payment_method === 'PRIVATE') return '';
    if (cashierFund) return outsideTopup ? '+' : '-';
    return incoming ? '+' : '-';
}

function formatDateTime(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: FINANCE_TIMEZONE,
    }).format(new Date(value));
}

function formatPeriod(start, end) {
    if (!start || !end) return '-';
    return `${formatDateTime(start)} - ${formatDateTime(end)}`;
}

function periodIsInvalid(start, end) {
    if (!start || !end) return false;
    return new Date(start).getTime() > new Date(end).getTime();
}

function signedTone(value, positiveTone = 'text-emerald-700') {
    return (Number(value) || 0) >= 0 ? positiveTone : 'text-rose-700';
}

function StatCard({ card }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">{card.label}</p>
            <p className={`mt-2 text-2xl font-bold ${card.tone}`}>{formatRupiah(card.value)}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{card.sub}</p>
        </div>
    );
}

function CompactMetric({ label, value, sub, tone = 'text-slate-900' }) {
    return (
        <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="truncate text-xs font-semibold uppercase text-slate-500">{label}</p>
            <p className={`mt-2 break-words text-xl font-bold sm:text-2xl ${tone}`}>{formatRupiah(value)}</p>
            {sub && <p className="mt-1 text-xs leading-relaxed text-slate-500">{sub}</p>}
        </div>
    );
}

export default function FinanceIndex({
    outlet,
    filters,
    summary,
    periodSummary,
    daily,
    cashMovements = [],
    withdrawalHistory = [],
}) {
    const [activeView, setActiveView] = useState('current');
    const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
    const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);
    const [dateFrom, setDateFrom] = useState(filters.date_from);
    const [dateTo, setDateTo] = useState(filters.date_to);
    const { data, setData, post, processing, reset, errors } = useForm({
        amount: '',
        payment_method: 'CASH',
        description: '',
        date: financeDatetimeValue(summary.periodEnd),
    });

    const period = periodSummary || summary;
    const recentMovements = cashMovements.slice(0, 12);
    const currentPeriodInvalid = periodIsInvalid(summary.periodStart, summary.periodEnd);
    const hasOpenShift = Boolean(summary.hasOpenShift);
    const hasTrackedCashPosition = hasOpenShift || summary.currentPeriodMode !== 'TODAY';
    const displayedCashDrawerActual = hasTrackedCashPosition ? Number(summary.cashDrawerActual || 0) : 0;
    const currentShiftName = summary.currentShift?.name || 'Shift aktif';
    const withdrawableCash = Number(summary.withdrawableCash ?? Math.max(0, Number(summary.cashDrawerNet) || 0));
    const withdrawableQris = Number(summary.withdrawableQris ?? Math.max(0, Number(summary.qrisBalanceActual) || 0));
    const selectedWithdrawalBalance = data.payment_method === 'QRIS' ? withdrawableQris : withdrawableCash;
    const withdrawalAmount = Number(data.amount) || 0;
    const withdrawalTooHigh = withdrawalAmount > 0 && withdrawalAmount > selectedWithdrawalBalance;
    const activeCashierTopups = Number(summary.activeCashierTopups || 0);
    const activeOutsideCashierTopups = Number(summary.activeOutsideCashierTopups || 0);
    const cashDrawerSavingsExpense = Number(summary.cashDrawerSavingsExpense || 0);
    const currentCashierExpense = (Number(summary.cashExpense) || 0) + (Number(summary.qrisExpense) || 0);
    const currentPrivateExpense = Number(summary.outsideExpense) || 0;
    const currentDailyCashierExpenseAverage = currentCashierExpense / Math.max(1, Number(summary.periodDays) || 1);
    const periodCashierExpense = (Number(period.cashExpense) || 0) + (Number(period.qrisExpense) || 0);
    const periodPrivateExpense = Number(period.outsideExpense) || 0;
    const periodDailyCashierExpenseAverage = periodCashierExpense / Math.max(1, Number(period.periodDays) || 1);
    const resetLabel = {
        OPEN_SHIFT: `${currentShiftName} sejak ${formatDateTime(summary.currentShift?.opened_at)}`,
        ALL_UNWITHDRAWN: 'Sejak aktivitas pertama, belum ada penarikan owner',
        SINCE_LAST_WITHDRAWAL: `Sejak penarikan terakhir ${formatDateTime(summary.lastWithdrawalAt)}`,
        TODAY_WITH_WITHDRAWAL: 'Hari ini, penarikan hari yang sama tetap terlihat',
        TODAY: 'Berjalan sejak awal hari',
    }[summary.currentPeriodMode] || 'Berjalan sejak awal hari';
    const periodGenerated = (Number(period.omzet) || 0) - periodCashierExpense - (Number(period.drawerCashierTopups ?? period.cashierTopups) || 0);
    const closedShiftDiscrepancy = Number(summary.closedShiftDiscrepancy || 0);
    const discrepancyInfo = closedShiftDiscrepancy !== 0
        ? ` Selisih kas shift tertutup ${formatRupiah(closedShiftDiscrepancy)} sudah ikut dihitung.`
        : '';
    const historyTotals = useMemo(() => withdrawalHistory.reduce((totals, item) => ({
        amount: totals.amount + (Number(item.amount) || 0),
        before: totals.before + (Number(item.available_before) || 0),
        after: totals.after + (Number(item.remaining_after) || 0),
    }), { amount: 0, before: 0, after: 0 }), [withdrawalHistory]);

    const applyFilter = (e) => {
        e.preventDefault();
        router.get(route('finance'), { date_from: dateFrom, date_to: dateTo }, { preserveScroll: true });
    };

    const submitWithdrawal = (e) => {
        e.preventDefault();
        post(route('finance.withdraw'), {
            preserveScroll: true,
            onSuccess: () => {
                reset('amount', 'description');
                setData('date', financeDatetimeValue());
                setShowWithdrawalForm(false);
                setActiveView('current');
                router.reload({
                    preserveScroll: true,
                    only: ['summary', 'periodSummary', 'cashMovements', 'withdrawalHistory', 'daily'],
                });
            },
        });
    };

    const currentCards = [
        {
            label: 'Cash Fisik Laci/Kasir',
            value: displayedCashDrawerActual,
            tone: signedTone(displayedCashDrawerActual, 'text-slate-900'),
            sub: hasOpenShift
                ? `Estimasi uang fisik: modal ${formatRupiah(summary.openingCash ?? summary.standardOpeningCash ?? 50000)} + top up aktif ${formatRupiah(activeCashierTopups)} + cash net ${formatRupiah(summary.cashDrawerNet)}.${discrepancyInfo}`
                : hasTrackedCashPosition
                    ? `Estimasi uang laci setelah shift terakhir. Cash net yang boleh ditarik ${formatRupiah(summary.cashDrawerNet)}.${discrepancyInfo}`
                    : 'Belum ada shift atau aktivitas kas pada outlet ini.',
        },
        {
            label: 'Keuangan Bersih',
            value: summary.cleanFinance,
            tone: signedTone(summary.cleanFinance),
            sub: `Bisa ditarik: cash ${formatRupiah(withdrawableCash)} dan QRIS ${formatRupiah(withdrawableQris)}.`,
        },
        {
            label: 'Rata-rata Penjualan Harian',
            value: summary.dailySalesAverage,
            tone: 'text-indigo-700',
            sub: `Omzet berjalan ${formatRupiah(summary.omzet)} dari ${summary.transactionCount || 0} transaksi lunas.`,
        },
        {
            label: 'Saldo QRIS Aktual',
            value: summary.qrisBalanceActual,
            tone: 'text-blue-700',
            sub: `QRIS masuk periode berjalan ${formatRupiah(summary.qrisSales)}. Pengeluaran/penarikan QRIS ${formatRupiah((Number(summary.qrisExpense) || 0) + (Number(summary.withdrawQris) || 0))}.`,
        },
        {
            label: 'Pengeluaran Kas/QRIS',
            value: currentCashierExpense,
            tone: 'text-rose-700',
            sub: `${resetLabel}. Cash ${formatRupiah(summary.cashExpense)} | QRIS ${formatRupiah(summary.qrisExpense)}. Pengeluaran laci cash ${formatRupiah(cashDrawerSavingsExpense)}.`,
        },
        {
            label: 'Uang Pribadi',
            value: currentPrivateExpense,
            tone: 'text-amber-700',
            sub: `Catatan luar kasir. Top up pribadi aktif ${formatRupiah(activeOutsideCashierTopups)} dianggap pinjaman, bukan saldo owner.`,
        },
        {
            label: 'Rata-rata Pengeluaran',
            value: currentDailyCashierExpenseAverage,
            tone: 'text-amber-700',
            sub: `Rata-rata kas/QRIS. Uang pribadi ${formatRupiah(currentPrivateExpense)} dicatat terpisah.`,
        },
    ];

    const periodCards = [
        {
            label: 'Omzet Lunas Periode',
            value: period.omzet,
            tone: 'text-indigo-700',
            sub: 'Hanya transaksi PAID. Uang kas/modal dan top up kasir tidak masuk omzet.',
        },
        {
            label: 'Penghasilan Bersih Periode',
            value: periodGenerated,
            tone: signedTone(periodGenerated),
            sub: 'Omzet lunas dikurangi pengeluaran kas/QRIS dan top up dari laci, sebelum penarikan owner.',
        },
        {
            label: 'Total QRIS Masuk',
            value: period.qrisSales,
            tone: 'text-blue-700',
            sub: `Cash ${formatRupiah(period.cashSales)} | QRIS ${formatRupiah(period.qrisSales)}.`,
        },
        {
            label: 'Total Pengeluaran Kas/QRIS',
            value: periodCashierExpense,
            tone: 'text-rose-700',
            sub: `Cash ${formatRupiah(period.cashExpense)} | QRIS ${formatRupiah(period.qrisExpense)}.`,
        },
        {
            label: 'Uang Pribadi Periode',
            value: periodPrivateExpense,
            tone: 'text-amber-700',
            sub: 'Tidak mengurangi saldo kas/QRIS yang bisa direkap.',
        },
        {
            label: 'Penarikan Owner',
            value: period.withdrawTotal,
            tone: 'text-slate-800',
            sub: 'Mengurangi saldo aktual, bukan menghapus histori omzet.',
        },
        {
            label: 'Rata-rata Omzet Harian',
            value: period.dailySalesAverage,
            tone: 'text-emerald-700',
            sub: `${period.periodDays || 1} hari dalam filter tanggal.`,
        },
        {
            label: 'Rata-rata Pengeluaran Kas/QRIS',
            value: periodDailyCashierExpenseAverage,
            tone: 'text-rose-700',
            sub: `${period.periodDays || 1} hari dalam filter tanggal.`,
        },
    ];

    const historyCards = [
        { label: 'Total Ditarik', value: historyTotals.amount, tone: 'text-slate-800', sub: `${withdrawalHistory.length} penarikan tercatat` },
        { label: 'Saldo Sebelum', value: historyTotals.before, tone: 'text-indigo-700', sub: 'Total saldo yang tersedia sebelum penarikan' },
        { label: 'Sisa Setelah', value: historyTotals.after, tone: signedTone(historyTotals.after), sub: 'Total saldo tersisa setelah penarikan' },
    ];

    return (
        <ErpLayout title="Keuangan">
            <Head title="Keuangan" />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900">Keuangan Outlet</h1>
                        <p className="mt-1 text-sm text-slate-500">{outlet?.name || 'Outlet'} - uang aktual di laci, QRIS, pengeluaran, dan rekap penarikan owner.</p>
                    </div>
                    <form onSubmit={applyFilter} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-500">Dari</label>
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full rounded-md border-slate-300 text-sm" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-500">Sampai</label>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full rounded-md border-slate-300 text-sm" />
                        </div>
                        <button type="submit" className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                            <FunnelIcon className="h-4 w-4" />
                            Terapkan
                        </button>
                    </form>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <div className="flex gap-3">
                        <BanknotesIcon className="mt-0.5 h-5 w-5 shrink-0" />
                        <div>
                            <p className="font-semibold">Omzet lunas hanya berasal dari transaksi PAID.</p>
                            <p className="mt-1 text-amber-800">Modal kas aktual shift {formatRupiah(summary.openingCash ?? summary.standardOpeningCash ?? 50000)} tidak dihitung sebagai omzet. Nilai default saat membuka shift adalah {formatRupiah(summary.defaultOpeningCash || 50000)} dan tetap dapat disesuaikan.</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {[
                        { key: 'current', label: 'Kasir Saat Ini' },
                        { key: 'period', label: 'Penghasilan Periode' },
                        { key: 'withdrawals', label: 'Histori Penarikan' },
                    ].map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setActiveView(item.key)}
                            className={`inline-flex min-h-[40px] items-center justify-center rounded-md border px-4 py-2 text-sm font-semibold ${activeView === item.key ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                {activeView === 'current' && (
                    <>
                        <div className={`flex flex-col gap-2 rounded-lg border px-4 py-3 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between ${currentPeriodInvalid ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-slate-200 bg-white text-slate-600'}`}>
                            <span>Periode aktual: {formatPeriod(summary.periodStart, summary.periodEnd)}</span>
                            <span className={`font-semibold ${currentPeriodInvalid ? 'text-rose-900' : 'text-slate-900'}`}>{resetLabel}</span>
                        </div>

                        {currentPeriodInvalid && (
                            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                                Periode Kasir Saat Ini terdeteksi tidak valid. Muat ulang halaman setelah penarikan tersimpan, dan periksa tanggal penarikan bila masih berada di masa depan.
                            </div>
                        )}

                        {!hasOpenShift && hasTrackedCashPosition && (
                            <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                                Tidak ada shift terbuka. Kasir Saat Ini tetap menghitung saldo laci sejak penarikan terakhir atau aktivitas pertama, termasuk selisih kas dari shift yang sudah ditutup.
                            </div>
                        )}

                        {!hasTrackedCashPosition && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                Belum ada shift atau aktivitas kas untuk outlet ini. Card kas aktual akan mulai berjalan setelah shift dibuka atau ada transaksi keuangan.
                            </div>
                        )}

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {currentCards.map((card) => <StatCard key={card.label} card={card} />)}
                        </div>

                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-stretch">
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-semibold uppercase text-emerald-700">Cash Net Bisa Ditarik</p>
                                        <p className="mt-2 text-2xl font-bold text-emerald-900">{formatRupiah(withdrawableCash)}</p>
                                    </div>
                                    <BanknotesIcon className="h-6 w-6 text-emerald-600" />
                                </div>
                                <p className="mt-2 text-xs leading-relaxed text-emerald-800">
                                    Saldo cash owner sejak penarikan terakhir: penjualan cash dikurangi pengeluaran laci/cash, restok kas shift, top up dari laci, dan penarikan cash. Modal dan pinjaman pribadi tidak ikut batas ambil.
                                </p>
                            </div>
                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-semibold uppercase text-blue-700">QRIS Net Bisa Ditarik</p>
                                        <p className="mt-2 text-2xl font-bold text-blue-900">{formatRupiah(withdrawableQris)}</p>
                                    </div>
                                    <BanknotesIcon className="h-6 w-6 text-blue-600" />
                                </div>
                                <p className="mt-2 text-xs leading-relaxed text-blue-800">
                                    Dari penjualan QRIS dikurangi pengeluaran QRIS dan penarikan QRIS. Penarikan cash tidak mengurangi saldo QRIS.
                                </p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:min-w-[260px]">
                                <p className="text-xs font-semibold uppercase text-slate-500">Aksi Owner</p>
                                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                    Pilih saldo cash atau QRIS yang akan ditarik. Nominal dibatasi sesuai saldo net masing-masing.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setData('date', financeDatetimeValue());
                                        setShowWithdrawalForm(true);
                                    }}
                                    className="mt-4 inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                >
                                    <BanknotesIcon className="h-4 w-4" />
                                    Penarikan Uang
                                </button>
                            </div>
                        </div>

                        <div className="grid gap-6">
                            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="mb-4 flex items-start justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">Mutasi Keuangan Terbaru</h2>
                                        <p className="text-sm text-slate-500">Penarikan, pengeluaran, top up kasir, restock kasir, dan restock uang pribadi.</p>
                                    </div>
                                    <ClipboardDocumentListIcon className="h-5 w-5 text-slate-400" />
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <tbody className="divide-y divide-slate-100">
                                            {recentMovements.length === 0 ? (
                                                <tr><td className="py-6 text-center text-slate-500">Belum ada mutasi kas pada periode ini.</td></tr>
                                            ) : recentMovements.map(item => {
                                                const incoming = isIncomingMovement(item);
                                                const cashierFund = isCashierFundMovement(item);
                                                const outsideTopup = isOutsideCashierTopup(item);
                                                const isWithdrawal = item.category === 'Penarikan';
                                                const tone = movementAmountTone(item, incoming, cashierFund, outsideTopup);
                                                const sign = movementSign(item, incoming, cashierFund, outsideTopup);
                                                return (
                                                    <tr key={item.id}>
                                                        <td className="py-3 pr-3">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${movementCategoryTone(item, incoming, cashierFund, isWithdrawal)}`}>
                                                                    {cashierFund ? (outsideTopup ? 'Top Up Luar Laci' : 'Top Up Dari Laci') : item.category}
                                                                </span>
                                                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${paymentTone(item.payment_method)}`}>
                                                                    {paymentLabel(item.payment_method)}
                                                                </span>
                                                            </div>
                                                            <div className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString('id-ID')} - {item.description || 'Tanpa catatan'}</div>
                                                        </td>
                                                        <td className={`py-3 text-right font-semibold ${tone}`}>
                                                            {sign && `${sign} `}{formatRupiah(item.amount)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {activeView === 'period' && (
                    <div className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {periodCards.map((card) => <StatCard key={card.label} card={card} />)}
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">Tren Penghasilan Periode</h2>
                                    <p className="text-sm text-slate-500">Filter tanggal berlaku untuk tab ini dan histori penarikan.</p>
                                </div>
                                <CalendarDaysIcon className="h-5 w-5 text-slate-400" />
                            </div>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={daily} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                                        <YAxis tickFormatter={(v) => `Rp${v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                                        <Tooltip formatter={(value, name) => [formatRupiah(value), name]} />
                                        <Area type="monotone" dataKey="omzet" name="Omzet Lunas" stroke="#4f46e5" fill="#c7d2fe" strokeWidth={2} />
                                        <Area type="monotone" dataKey="cashier_expenses" name="Pengeluaran Kas/QRIS" stroke="#e11d48" fill="#fecdd3" strokeWidth={2} />
                                        <Area type="monotone" dataKey="private_expenses" name="Uang Pribadi" stroke="#d97706" fill="#fde68a" strokeWidth={2} />
                                        <Area type="monotone" dataKey="drawer_cashier_topups" name="Top Up Dari Laci" stroke="#475569" fill="#e2e8f0" strokeWidth={2} />
                                        <Area type="monotone" dataKey="profit" name="Penghasilan Setelah Pengeluaran" stroke="#059669" fill="#bbf7d0" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}

                {activeView === 'withdrawals' && (
                    <div className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-3">
                            {historyCards.map((card) => <StatCard key={card.label} card={card} />)}
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">Histori Penarikan Owner</h2>
                                    <p className="text-sm text-slate-500">Ringkasan sederhana: saldo sebelum penarikan, nominal yang ditarik, dan sisa setelahnya.</p>
                                </div>
                                <ClipboardDocumentListIcon className="h-5 w-5 text-slate-400" />
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[760px] text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase text-slate-500">
                                            <th className="py-3 pr-4">Penarikan</th>
                                            <th className="py-3 pr-4">Metode</th>
                                            <th className="py-3 pr-4 text-right">Sebelum</th>
                                            <th className="py-3 pr-4 text-right">Ditarik</th>
                                            <th className="py-3 pr-4 text-right">Sesudah</th>
                                            <th className="py-3 text-right">Detail</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {withdrawalHistory.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="py-8 text-center text-slate-500">Belum ada histori penarikan pada periode filter ini.</td>
                                            </tr>
                                        ) : withdrawalHistory.map((item) => (
                                            <tr key={item.id} className="align-top">
                                                <td className="py-4 pr-4">
                                                    <div className="font-semibold text-slate-900">{formatDateTime(item.date)}</div>
                                                    {item.description && <div className="mt-1 max-w-xs text-xs text-slate-500">{item.description}</div>}
                                                </td>
                                                <td className="py-4 pr-4">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${paymentTone(item.method)}`}>{paymentLabel(item.method)}</span>
                                                        {item.source === 'COMPUTED' && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Hitung ulang</span>}
                                                    </div>
                                                </td>
                                                <td className="py-4 pr-4 text-right font-semibold text-indigo-700">
                                                    {formatRupiah(item.available_before)}
                                                </td>
                                                <td className="py-4 pr-4 text-right font-semibold text-rose-700">
                                                    {formatRupiah(item.amount)}
                                                </td>
                                                <td className={`py-4 pr-4 text-right font-semibold ${signedTone(item.remaining_after, 'text-slate-800')}`}>
                                                    {formatRupiah(item.remaining_after)}
                                                </td>
                                                <td className="py-4 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedWithdrawal(item)}
                                                        className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                                    >
                                                        <EyeIcon className="h-4 w-4" />
                                                        Detail
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {showWithdrawalForm && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/55 p-2 sm:p-4">
                    <div className="mx-auto flex min-h-full w-full max-w-2xl items-start justify-center py-2 sm:items-center sm:py-6">
                        <form onSubmit={submitWithdrawal} className="w-full overflow-hidden rounded-lg bg-white shadow-2xl">
                            <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">Penarikan Uang</h2>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Pilih saldo yang akan ditarik. Batas maksimal mengikuti Cash Net atau QRIS Net yang tersedia.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowWithdrawalForm(false)}
                                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
                                        aria-label="Tutup form penarikan"
                                    >
                                        <XMarkIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-5 p-4 sm:p-5">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {[
                                        {
                                            method: 'CASH',
                                            label: 'Ambil Cash Net',
                                            value: withdrawableCash,
                                            description: 'Mengurangi saldo cash/laci bersih.',
                                            tone: 'emerald',
                                        },
                                        {
                                            method: 'QRIS',
                                            label: 'Ambil QRIS Net',
                                            value: withdrawableQris,
                                            description: 'Mengurangi saldo QRIS saja.',
                                            tone: 'blue',
                                        },
                                    ].map((option) => {
                                        const selected = data.payment_method === option.method;
                                        const selectedClass = option.tone === 'blue'
                                            ? 'border-blue-500 bg-blue-50 text-blue-900'
                                            : 'border-emerald-500 bg-emerald-50 text-emerald-900';
                                        return (
                                            <button
                                                key={option.method}
                                                type="button"
                                                onClick={() => setData('payment_method', option.method)}
                                                className={`rounded-lg border p-4 text-left transition ${selected ? selectedClass : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-xs font-semibold uppercase">{option.label}</p>
                                                        <p className="mt-2 text-2xl font-bold">{formatRupiah(option.value)}</p>
                                                    </div>
                                                    <BanknotesIcon className="h-6 w-6 opacity-70" />
                                                </div>
                                                <p className="mt-2 text-xs leading-relaxed opacity-80">{option.description}</p>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                    <div className="flex items-center justify-between gap-3">
                                        <span>Maksimal ambil {data.payment_method === 'QRIS' ? 'QRIS Net' : 'Cash Net'}</span>
                                        <span className="font-semibold text-slate-900">{formatRupiah(selectedWithdrawalBalance)}</span>
                                    </div>
                                    {withdrawalTooHigh && (
                                        <p className="mt-1 text-xs font-medium text-rose-600">
                                            Nominal melebihi saldo {data.payment_method === 'QRIS' ? 'QRIS Net' : 'Cash Net'} yang bisa ditarik.
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700">Nominal Penarikan</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max={selectedWithdrawalBalance || undefined}
                                        value={data.amount}
                                        onChange={e => setData('amount', e.target.value)}
                                        className="w-full rounded-md border-slate-300 text-sm"
                                        required
                                    />
                                    {errors.amount && <p className="mt-1 text-xs text-rose-600">{errors.amount}</p>}
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700">Tanggal</label>
                                    <input
                                        type="datetime-local"
                                        value={data.date}
                                        onChange={e => setData('date', e.target.value)}
                                        className="w-full rounded-md border-slate-300 text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700">Catatan</label>
                                    <textarea
                                        value={data.description}
                                        onChange={e => setData('description', e.target.value)}
                                        rows="2"
                                        className="w-full rounded-md border-slate-300 text-sm"
                                        placeholder="Contoh: Setoran owner / tarik kas harian"
                                    />
                                </div>

                                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setShowWithdrawalForm(false)}
                                        className="inline-flex min-h-[40px] items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={processing || withdrawalTooHigh || selectedWithdrawalBalance <= 0}
                                        className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                                    >
                                        <BanknotesIcon className="h-4 w-4" />
                                        {processing ? 'Menyimpan...' : `Tarik ${data.payment_method}`}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {selectedWithdrawal && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/55 p-2 sm:p-4">
                    <div className="mx-auto flex min-h-full w-full max-w-2xl items-start justify-center py-2 sm:items-center sm:py-6">
                        <div className="flex max-h-none w-full flex-col overflow-hidden rounded-lg bg-slate-50 shadow-2xl sm:max-h-[92vh]">
                            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="text-lg font-semibold text-slate-900">Detail Penarikan</h2>
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${paymentTone(selectedWithdrawal.method)}`}>{paymentLabel(selectedWithdrawal.method)}</span>
                                        </div>
                                        <p className="mt-1 text-sm text-slate-500">{formatDateTime(selectedWithdrawal.date)}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedWithdrawal(null)}
                                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
                                        aria-label="Tutup detail"
                                    >
                                        <XMarkIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-y-auto p-4 sm:p-5">
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <CompactMetric label="Sebelum" value={selectedWithdrawal.available_before} tone="text-indigo-700" sub="Saldo sebelum penarikan." />
                                    <CompactMetric label="Ditarik" value={selectedWithdrawal.amount} tone="text-rose-700" sub={`Penarikan ${paymentLabel(selectedWithdrawal.method)}.`} />
                                    <CompactMetric label="Sesudah" value={selectedWithdrawal.remaining_after} tone={signedTone(selectedWithdrawal.remaining_after)} sub="Saldo sisa setelah penarikan." />
                                </div>

                                <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div>
                                            <p className="text-xs font-semibold uppercase text-slate-500">Waktu</p>
                                            <p className="mt-1 font-semibold text-slate-900">{formatDateTime(selectedWithdrawal.date)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase text-slate-500">Metode</p>
                                            <p className="mt-1 font-semibold text-slate-900">{paymentLabel(selectedWithdrawal.method)}</p>
                                        </div>
                                    </div>
                                    {selectedWithdrawal.description && (
                                        <div className="mt-4 border-t border-slate-100 pt-3">
                                            <p className="text-xs font-semibold uppercase text-slate-500">Catatan</p>
                                            <p className="mt-1 text-slate-700">{selectedWithdrawal.description}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </ErpLayout>
    );
}
