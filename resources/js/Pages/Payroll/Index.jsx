import { useMemo, useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, router } from '@inertiajs/react';
import {
    BanknotesIcon,
    CalendarDaysIcon,
    ClockIcon,
    FunnelIcon,
    UserGroupIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';

function formatRupiah(value) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(Number(value) || 0);
}

function formatNumber(value) {
    return new Intl.NumberFormat('id-ID').format(Number(value) || 0);
}

function formatDate(value, withTime = false) {
    if (!value) return '-';
    const options = withTime
        ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { day: '2-digit', month: 'short', year: 'numeric' };

    return new Intl.DateTimeFormat('id-ID', options).format(new Date(value));
}

function todayInputValue() {
    return new Date().toISOString().slice(0, 10);
}

function monthBounds(monthValue) {
    if (!monthValue) return null;
    const [year, month] = monthValue.split('-').map(Number);
    if (!year || !month) return null;
    const lastDay = new Date(year, month, 0).getDate();

    return {
        start_date: `${monthValue}-01`,
        end_date: `${monthValue}-${String(lastDay).padStart(2, '0')}`,
    };
}

export default function PayrollIndex({ filters, employees = [], summaries = [], payments = [] }) {
    const [filterStart, setFilterStart] = useState(filters.start_date || '');
    const [filterEnd, setFilterEnd] = useState(filters.end_date || '');
    const [filterEmployee, setFilterEmployee] = useState(filters.employee_id || '');
    const [historyMonth, setHistoryMonth] = useState((filters.start_date || '').slice(0, 7));
    const [paymentEmployee, setPaymentEmployee] = useState(null);
    const [detailPayment, setDetailPayment] = useState(null);

    const totals = useMemo(() => {
        const paidTotal = payments.reduce((sum, payment) => sum + Number(payment.total_amount || 0), 0);
        const workDays = summaries.reduce((sum, summary) => sum + Number(summary.work_days || 0), 0);
        const shiftCount = summaries.reduce((sum, summary) => sum + Number(summary.shift_count || 0), 0);
        const totalMinutes = summaries.reduce((sum, summary) => sum + Number(summary.total_minutes || 0), 0);
        const averageMinutes = shiftCount > 0 ? Math.round(totalMinutes / shiftCount) : 0;

        return {
            paidTotal,
            workDays,
            shiftCount,
            averageLabel: `${Math.floor(averageMinutes / 60)}j ${averageMinutes % 60}m`,
        };
    }, [payments, summaries]);

    const invalidRange = Boolean(filterStart && filterEnd && filterEnd < filterStart);

    const applyFilters = (event) => {
        event.preventDefault();
        if (invalidRange) return;

        router.get(route('payroll'), {
            start_date: filterStart,
            end_date: filterEnd,
            employee_id: filterEmployee || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const applyMonthFilter = (event) => {
        event.preventDefault();
        const bounds = monthBounds(historyMonth);
        if (!bounds) return;

        setFilterStart(bounds.start_date);
        setFilterEnd(bounds.end_date);
        router.get(route('payroll'), {
            ...bounds,
            employee_id: filterEmployee || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    return (
        <ErpLayout title="Gaji Pegawai">
            <Head title="Gaji Pegawai" />

            <div className="space-y-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900">Gaji Pegawai</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Kelola pembayaran gaji, hari kerja, durasi shift, dan histori gajian pegawai.
                        </p>
                    </div>
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Gaji dipakai untuk evaluasi profit operasional di Biaya Produk, bukan HPP bahan utama.
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard label="Total Gaji Dibayar" value={formatRupiah(totals.paidTotal)} icon={BanknotesIcon} tone="emerald" />
                    <SummaryCard label="Pegawai Aktif" value={formatNumber(employees.length)} icon={UserGroupIcon} tone="slate" />
                    <SummaryCard label="Total Hari Kerja" value={formatNumber(totals.workDays)} icon={CalendarDaysIcon} tone="indigo" />
                    <SummaryCard label="Rata-rata Shift" value={totals.averageLabel} icon={ClockIcon} tone="amber" />
                </div>

                <form onSubmit={applyFilters} className="grid gap-3 border-y border-slate-200 bg-slate-50 px-3 py-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_auto] xl:items-end">
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Mulai</span>
                        <input
                            type="date"
                            value={filterStart}
                            onChange={(event) => setFilterStart(event.target.value)}
                            className="h-10 w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Sampai</span>
                        <input
                            type="date"
                            min={filterStart || undefined}
                            value={filterEnd}
                            onChange={(event) => setFilterEnd(event.target.value)}
                            className={`h-10 w-full rounded-md text-sm focus:border-indigo-500 focus:ring-indigo-500 ${invalidRange ? 'border-rose-400' : 'border-slate-300'}`}
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Pegawai</span>
                        <select
                            value={filterEmployee}
                            onChange={(event) => setFilterEmployee(event.target.value)}
                            className="h-10 w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                        >
                            <option value="">Semua pegawai</option>
                            {employees.map((employee) => (
                                <option key={employee.id} value={employee.id}>{employee.display_name}</option>
                            ))}
                        </select>
                    </label>
                    <button
                        type="submit"
                        disabled={invalidRange || !filterStart || !filterEnd}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300"
                    >
                        <FunnelIcon className="h-4 w-4" />
                        Terapkan
                    </button>
                    {invalidRange && <p className="text-xs font-medium text-rose-600 sm:col-span-2 xl:col-span-4">Tanggal akhir tidak boleh sebelum tanggal mulai.</p>}
                </form>

                <section>
                    <div className="mb-3">
                        <h2 className="text-lg font-semibold text-slate-900">Performa Pegawai</h2>
                        <p className="mt-1 text-sm text-slate-500">Klik beri gaji pada pegawai untuk membuka form pembayaran.</p>
                    </div>
                    {summaries.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {summaries.map((summary) => (
                                <EmployeeCard
                                    key={summary.employee_id}
                                    summary={summary}
                                    onPay={() => setPaymentEmployee(summary)}
                                />
                            ))}
                        </div>
                    ) : (
                        <EmptyState text="Belum ada pegawai atau shift tertutup pada periode ini." />
                    )}
                </section>

                <section>
                    <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Histori Pemberian Gaji</h2>
                            <p className="mt-1 text-sm text-slate-500">Klik baris tabel untuk melihat detail hitungan dan snapshot shift.</p>
                        </div>
                        <form onSubmit={applyMonthFilter} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Filter Bulan</span>
                                <input
                                    type="month"
                                    value={historyMonth}
                                    onChange={(event) => setHistoryMonth(event.target.value)}
                                    className="h-10 rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </label>
                            <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                <CalendarDaysIcon className="h-4 w-4" />
                                Lihat Bulan
                            </button>
                        </form>
                    </div>

                    {payments.length > 0 ? (
                        <>
                        <div className="grid gap-3 lg:hidden">
                            {payments.map((payment) => (
                                <button
                                    key={payment.id}
                                    type="button"
                                    onClick={() => setDetailPayment(payment)}
                                    className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition active:bg-indigo-50"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold text-slate-900">{payment.employee_name}</p>
                                            <p className="mt-1 text-xs text-slate-500">{formatDate(payment.period_start)} - {formatDate(payment.period_end)}</p>
                                        </div>
                                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                            {payment.salary_type === 'DAILY' ? 'Harian' : 'Bulanan'}
                                        </span>
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                                        <MobileMetric label="Dibayar" value={formatDate(payment.paid_at, true)} />
                                        <MobileMetric label="Dasar" value={formatRupiah(payment.base_amount)} align="right" />
                                        <MobileMetric label="Bonus" value={formatRupiah(payment.bonus_amount)} tone="emerald" />
                                        <MobileMetric label="Potongan" value={formatRupiah(payment.deduction_amount)} tone="rose" align="right" />
                                    </div>
                                    <div className="mt-4 rounded-md bg-emerald-50 px-3 py-2">
                                        <p className="text-xs font-semibold uppercase text-emerald-700">Total dibayar</p>
                                        <p className="mt-1 break-words text-2xl font-bold text-emerald-800">{formatRupiah(payment.total_amount)}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:block">
                            <div className="w-full">
                                <table className="w-full table-fixed divide-y divide-slate-200 text-sm">
                                    <colgroup>
                                        <col className="w-[15%]" />
                                        <col className="w-[17%]" />
                                        <col className="w-[18%]" />
                                        <col className="w-[9%]" />
                                        <col className="w-[11%]" />
                                        <col className="w-[10%]" />
                                        <col className="w-[10%]" />
                                        <col className="w-[10%]" />
                                    </colgroup>
                                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                                        <tr>
                                            <th className="px-4 py-3">Tanggal Bayar</th>
                                            <th className="px-4 py-3">Pegawai</th>
                                            <th className="px-4 py-3">Periode</th>
                                            <th className="px-4 py-3">Tipe</th>
                                            <th className="px-4 py-3 text-right">Dasar</th>
                                            <th className="px-4 py-3 text-right">Bonus</th>
                                            <th className="px-4 py-3 text-right">Potongan</th>
                                            <th className="px-4 py-3 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {payments.map((payment) => (
                                            <tr
                                                key={payment.id}
                                                tabIndex={0}
                                                onClick={() => setDetailPayment(payment)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        setDetailPayment(payment);
                                                    }
                                                }}
                                                className="cursor-pointer hover:bg-indigo-50 focus:bg-indigo-50 focus:outline-none"
                                            >
                                                <td className="px-4 py-3 text-slate-600">
                                                    <span className="line-clamp-2">{formatDate(payment.paid_at, true)}</span>
                                                </td>
                                                <td className="px-4 py-3 font-semibold text-slate-900">
                                                    <span className="line-clamp-2">{payment.employee_name}</span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-600">
                                                    <span className="line-clamp-2">{formatDate(payment.period_start)} - {formatDate(payment.period_end)}</span>
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3">
                                                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                                        {payment.salary_type === 'DAILY' ? 'Harian' : 'Bulanan'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-600">
                                                    <span className="break-words">{formatRupiah(payment.base_amount)}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-emerald-700">
                                                    <span className="break-words">{formatRupiah(payment.bonus_amount)}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-rose-700">
                                                    <span className="break-words">{formatRupiah(payment.deduction_amount)}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-900">
                                                    <span className="break-words">{formatRupiah(payment.total_amount)}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        </>
                    ) : (
                        <EmptyState text="Belum ada pembayaran gaji pada periode ini." />
                    )}
                </section>
            </div>

            {paymentEmployee && (
                <SalaryPaymentModal
                    employeeSummary={paymentEmployee}
                    filters={filters}
                    onClose={() => setPaymentEmployee(null)}
                />
            )}

            {detailPayment && (
                <PaymentDetailModal
                    payment={detailPayment}
                    onClose={() => setDetailPayment(null)}
                />
            )}
        </ErpLayout>
    );
}

function SalaryPaymentModal({ employeeSummary, filters, onClose }) {
    const periodStart = filters.start_date || '';
    const periodEnd = filters.end_date || '';
    const [salaryType, setSalaryType] = useState('MONTHLY');
    const [monthlyAmount, setMonthlyAmount] = useState('');
    const [dailyRate, setDailyRate] = useState('');
    const [bonusAmount, setBonusAmount] = useState('');
    const [deductionAmount, setDeductionAmount] = useState('');
    const [paidAt, setPaidAt] = useState(todayInputValue());
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const dailyWorkDays = Number(employeeSummary.work_days || 0);
    const baseSalary = salaryType === 'DAILY'
        ? Number(dailyRate || 0) * dailyWorkDays
        : Number(monthlyAmount || 0);
    const totalSalary = Math.max(0, baseSalary + Number(bonusAmount || 0) - Number(deductionAmount || 0));
    const lastPayment = employeeSummary.last_payment;
    const cannotSubmitDaily = salaryType === 'DAILY' && (Number(dailyRate || 0) <= 0 || dailyWorkDays <= 0);

    const submitPayment = (event) => {
        event.preventDefault();
        if (!employeeSummary.employee_id || cannotSubmitDaily || totalSalary <= 0) return;

        setSubmitting(true);
        router.post(route('payroll.store'), {
            employee_id: employeeSummary.employee_id,
            period_start: periodStart,
            period_end: periodEnd,
            salary_type: salaryType,
            base_amount: baseSalary,
            monthly_amount: salaryType === 'MONTHLY' ? monthlyAmount : 0,
            daily_rate: salaryType === 'DAILY' ? dailyRate : 0,
            bonus_amount: bonusAmount || 0,
            deduction_amount: deductionAmount || 0,
            paid_at: paidAt || undefined,
            note,
        }, {
            preserveScroll: true,
            onSuccess: onClose,
            onFinish: () => setSubmitting(false),
        });
    };

    return (
        <Modal title="Pemberian Gaji" subtitle={employeeSummary.employee_name} onClose={onClose} width="max-w-3xl">
            <form onSubmit={submitPayment} className="space-y-5">
                <div className="grid gap-3 lg:grid-cols-[1fr_0.75fr]">
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase text-slate-500">Periode gaji</p>
                        <p className="mt-1 text-base font-semibold text-slate-900">{formatDate(periodStart)} - {formatDate(periodEnd)}</p>
                        <p className="mt-2 text-xs leading-relaxed text-slate-500">
                            Hari kerja mengikuti shift tertutup pada periode ini. Cuti atau hari tanpa shift tidak dihitung sebagai gaji harian.
                        </p>
                    </div>
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
                        <p className="text-xs font-semibold uppercase text-indigo-700">Terakhir gajian</p>
                        <p className="mt-1 font-semibold">
                            {lastPayment ? formatDate(lastPayment.paid_at, true) : 'Belum pernah'}
                        </p>
                        <p className="mt-1 text-xs text-indigo-800">
                            {lastPayment ? formatRupiah(lastPayment.total_amount) : 'Belum ada histori pembayaran untuk pegawai ini.'}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <MiniMetric label="Hari kerja" value={`${formatNumber(employeeSummary.work_days)} hari`} />
                    <MiniMetric label="Shift" value={formatNumber(employeeSummary.shift_count)} />
                    <MiniMetric label="Rata-rata" value={employeeSummary.average_label} />
                    <MiniMetric label="Total jam" value={employeeSummary.total_label} />
                </div>

                <div className="space-y-2">
                    <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Metode Gaji</span>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => setSalaryType('MONTHLY')}
                            className={`rounded-md border px-3 py-3 text-left text-sm font-semibold ${salaryType === 'MONTHLY' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                        >
                            Bulanan
                            <span className="mt-1 block text-xs font-normal text-slate-500">Nominal pokok tetap untuk periode ini.</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setSalaryType('DAILY')}
                            className={`rounded-md border px-3 py-3 text-left text-sm font-semibold ${salaryType === 'DAILY' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                        >
                            Harian
                            <span className="mt-1 block text-xs font-normal text-slate-500">Tarif harian dikali hari kerja dari shift.</span>
                        </button>
                    </div>
                </div>

                {salaryType === 'MONTHLY' ? (
                    <MoneyInput label="Gaji Bulanan/Pokok" value={monthlyAmount} onChange={setMonthlyAmount} />
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <MoneyInput label="Tarif Harian" value={dailyRate} onChange={setDailyRate} />
                        <ReadOnlyField label="Hari kerja dari shift" value={`${formatNumber(dailyWorkDays)} hari`} />
                        {dailyWorkDays <= 0 && (
                            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:col-span-2">
                                Belum ada shift tertutup pada periode ini, sehingga gaji harian belum bisa dicatat.
                            </p>
                        )}
                    </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                    <MoneyInput label="Dasar Terhitung" value={baseSalary} readOnly />
                    <MoneyInput label="Bonus" value={bonusAmount} onChange={setBonusAmount} />
                    <MoneyInput label="Potongan" value={deductionAmount} onChange={setDeductionAmount} />
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Tanggal Bayar</span>
                        <input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} className="h-10 w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Catatan</span>
                        <input
                            type="text"
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            className="h-10 w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="Opsional, contoh: bonus performa outlet"
                        />
                    </label>
                </div>

                <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:-mx-5 sm:-mb-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">Total gaji fix</p>
                        <p className="text-3xl font-bold text-slate-900">{formatRupiah(totalSalary)}</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <button type="button" onClick={onClose} className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !periodStart || !periodEnd || cannotSubmitDaily || totalSalary <= 0}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300"
                        >
                            <BanknotesIcon className="h-5 w-5" />
                            {submitting ? 'Menyimpan...' : 'Simpan Gaji'}
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}

function PaymentDetailModal({ payment, onClose }) {
    return (
        <Modal title="Detail Pembayaran Gaji" subtitle={payment.employee_name} onClose={onClose} width="max-w-xl" compact>
            <div className="space-y-4">
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase text-emerald-700">Total dibayar</p>
                            <p className="mt-1 break-words text-2xl font-bold text-emerald-900">{formatRupiah(payment.total_amount)}</p>
                        </div>
                        <div className="text-sm text-emerald-900 sm:text-right">
                            <p className="font-semibold">{payment.salary_type === 'DAILY' ? 'Gaji Harian' : 'Gaji Bulanan'}</p>
                            <p className="mt-0.5 text-xs text-emerald-800">{formatDate(payment.period_start)} - {formatDate(payment.period_end)}</p>
                        </div>
                    </div>
                </div>

                <div className="grid gap-2">
                    <DetailRow label="Periode" value={`${formatDate(payment.period_start)} - ${formatDate(payment.period_end)}`} />
                    <DetailRow label="Tanggal bayar" value={`${formatDate(payment.paid_at, true)} oleh ${payment.paid_by || '-'}`} />
                    <DetailRow label="Gaji dasar" value={formatRupiah(payment.base_amount)} />
                    <DetailRow label="Bonus" value={formatRupiah(payment.bonus_amount)} />
                    <DetailRow label="Potongan" value={formatRupiah(payment.deduction_amount)} />
                    <DetailRow label="Rata-rata shift" value={payment.average_label} />
                    {payment.salary_type === 'DAILY' ? (
                        <>
                            <DetailRow label="Tarif harian" value={formatRupiah(payment.daily_rate)} />
                            <DetailRow label="Hari kerja dari shift" value={`${formatNumber(payment.payable_days)} hari`} />
                        </>
                    ) : (
                        <DetailRow label="Nominal bulanan" value={formatRupiah(payment.monthly_amount || payment.base_amount)} />
                    )}
                </div>

                {payment.note && (
                    <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{payment.note}</div>
                )}

                <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-slate-900">Snapshot Shift</h3>
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                            {formatNumber(payment.shift_count)} shift | {formatNumber(payment.work_days)} hari
                        </span>
                    </div>
                    {payment.shift_snapshot?.length > 0 ? (
                        <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                            {payment.shift_snapshot.map((shift) => (
                                <div key={shift.id || `${shift.work_date}-${shift.name}`} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="break-words text-sm font-semibold text-slate-900">{shift.name || 'Shift'}</p>
                                            <p className="mt-0.5 text-xs text-slate-500">{shift.outlet_name || 'Outlet'} | {formatDate(shift.work_date)}</p>
                                        </div>
                                        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                            {shift.duration_label || '-'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                            Tidak ada snapshot shift pada pembayaran ini.
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}

function SummaryCard({ label, value, icon: Icon, tone }) {
    const tones = {
        emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
        amber: 'border-amber-200 bg-amber-50 text-amber-700',
        slate: 'border-slate-200 bg-white text-slate-600',
    };

    return (
        <div className={`rounded-lg border p-4 shadow-sm ${tones[tone]}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-xs font-semibold uppercase opacity-75">{label}</p>
                    <p className="mt-2 truncate text-2xl font-bold text-slate-900" title={String(value)}>{value}</p>
                </div>
                <Icon className="h-6 w-6 shrink-0 opacity-80" />
            </div>
        </div>
    );
}

function EmployeeCard({ summary, onPay }) {
    return (
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="truncate font-semibold text-slate-900">{summary.employee_name}</h3>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{summary.email}</p>
                </div>
                <div className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                    {formatNumber(summary.shift_count)} shift
                </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <MiniMetric label="Hari kerja" value={formatNumber(summary.work_days)} />
                <MiniMetric label="Total jam" value={summary.total_label} />
                <MiniMetric label="Rata-rata" value={summary.average_label} />
                <MiniMetric label="Gaji periode" value={formatRupiah(summary.paid_total)} />
            </div>
            <div className="mt-4 grid gap-2 text-sm">
                <ShiftLine label="Shift terlama" shift={summary.longest_shift} />
                <ShiftLine label="Shift tersingkat" shift={summary.shortest_shift} />
            </div>
            <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="mb-3 text-xs text-slate-500">
                    {summary.last_payment
                        ? `Terakhir gajian ${formatDate(summary.last_payment.paid_at)} senilai ${formatRupiah(summary.last_payment.total_amount)}`
                        : 'Belum ada histori gaji.'}
                </p>
                <button
                    type="button"
                    onClick={onPay}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                >
                    <BanknotesIcon className="h-5 w-5" />
                    Beri Gaji
                </button>
            </div>
        </article>
    );
}

function ShiftLine({ label, shift }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
            <span className="text-xs font-medium text-slate-500">{label}</span>
            <span className="truncate text-right text-xs font-semibold text-slate-800" title={shift ? `${shift.name} - ${shift.duration_label}` : 'Belum ada shift'}>
                {shift ? `${shift.duration_label} (${shift.outlet_name || 'Outlet'})` : '-'}
            </span>
        </div>
    );
}

function MiniMetric({ label, value }) {
    return (
        <div className="min-w-0 rounded-md bg-slate-50 p-3">
            <p className="truncate text-xs text-slate-500">{label}</p>
            <p className="mt-1 break-words text-sm font-bold text-slate-900 sm:text-base" title={String(value)}>{value}</p>
        </div>
    );
}

function DetailRow({ label, value }) {
    return (
        <div className="grid gap-1 rounded-md bg-slate-50 px-3 py-2 text-sm sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] sm:gap-3">
            <span className="text-slate-500">{label}</span>
            <span className="break-words font-semibold text-slate-900 sm:text-right">{value}</span>
        </div>
    );
}

function MobileMetric({ label, value, tone = 'slate', align = 'left' }) {
    const tones = {
        slate: 'text-slate-700',
        emerald: 'text-emerald-700',
        rose: 'text-rose-700',
    };

    return (
        <div className={align === 'right' ? 'text-right' : ''}>
            <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
            <p className={`mt-1 break-words font-semibold ${tones[tone]}`}>{value}</p>
        </div>
    );
}

function ReadOnlyField({ label, value }) {
    return (
        <div>
            <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">{label}</span>
            <div className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800">
                {value}
            </div>
        </div>
    );
}

function MoneyInput({ label, value, onChange, readOnly = false }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">{label}</span>
            <input
                type="number"
                min="0"
                value={value}
                readOnly={readOnly}
                onChange={(event) => onChange?.(event.target.value)}
                className={`h-10 w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500 ${readOnly ? 'bg-slate-100 font-semibold text-slate-700' : ''}`}
                placeholder="0"
            />
        </label>
    );
}

function Modal({ title, subtitle, onClose, children, width = 'max-w-3xl', compact = false }) {
    const wrapperClass = compact
        ? 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-3 sm:p-6'
        : 'fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-6';
    const panelClass = compact
        ? `flex max-h-[82vh] w-full ${width} flex-col overflow-hidden rounded-lg bg-white shadow-xl`
        : `flex max-h-[94vh] w-full ${width} flex-col overflow-hidden rounded-t-xl bg-white shadow-xl sm:rounded-lg`;

    return (
        <div className={wrapperClass}>
            <div className={panelClass}>
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
                    <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold text-slate-900">{title}</h2>
                        {subtitle && <p className="mt-0.5 truncate text-sm text-slate-500">{subtitle}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        aria-label="Tutup"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>
                <div className="overflow-y-auto p-4 sm:p-5">{children}</div>
            </div>
        </div>
    );
}

function EmptyState({ text }) {
    return (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
            {text}
        </div>
    );
}
