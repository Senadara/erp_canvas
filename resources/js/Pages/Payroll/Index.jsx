import { useMemo, useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, router } from '@inertiajs/react';
import {
    BanknotesIcon,
    CalendarDaysIcon,
    ClockIcon,
    FunnelIcon,
    PencilSquareIcon,
    TrashIcon,
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

function dateInputValue(value) {
    return value ? String(value).slice(0, 10) : '';
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
    const [historySearch, setHistorySearch] = useState('');
    const [historyMonth, setHistoryMonth] = useState('');
    const [paymentEmployee, setPaymentEmployee] = useState(null);
    const [detailPayment, setDetailPayment] = useState(null);
    const [editingPayment, setEditingPayment] = useState(null);
    const [deletingPaymentId, setDeletingPaymentId] = useState(null);

    const totals = useMemo(() => {
        const paidTotal = summaries.reduce((sum, summary) => sum + Number(summary.paid_total || 0), 0);
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
    }, [summaries]);

    const filteredPayments = useMemo(() => {
        return payments.filter((payment) => {
            if (historyMonth) {
                const pMonth = (payment.period_start || '').slice(0, 7) || (payment.paid_at || '').slice(0, 7);
                if (pMonth !== historyMonth) return false;
            }
            if (historySearch) {
                const q = historySearch.toLowerCase();
                const matchName = (payment.employee_name || '').toLowerCase().includes(q);
                const matchNote = (payment.note || '').toLowerCase().includes(q);
                if (!matchName && !matchNote) return false;
            }
            return true;
        });
    }, [payments, historyMonth, historySearch]);

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

    const openEditPayment = (payment) => {
        setDetailPayment(null);
        setEditingPayment(payment);
    };

    const deletePayment = (payment) => {
        if (!window.confirm(`Hapus histori gaji ${payment.employee_name} senilai ${formatRupiah(payment.total_amount)}?`)) {
            return;
        }

        setDeletingPaymentId(payment.id);
        router.delete(route('payroll.destroy', payment.id), {
            preserveScroll: true,
            onSuccess: () => {
                setDetailPayment((current) => current?.id === payment.id ? null : current);
                setEditingPayment((current) => current?.id === payment.id ? null : current);
            },
            onFinish: () => setDeletingPaymentId(null),
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
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-semibold text-slate-900">Histori Pemberian Gaji</h2>
                                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                                    {payments.length} data tercatat
                                </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-500">Histori selalu tampil penuh tanpa dibatasi filter tanggal. Klik baris untuk detail atau edit/hapus.</p>
                        </div>
                        <div className="flex flex-wrap items-end gap-2">
                            <label className="block">
                                <span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Cari Pegawai / Catatan</span>
                                <input
                                    type="text"
                                    value={historySearch}
                                    onChange={(event) => setHistorySearch(event.target.value)}
                                    placeholder="Ketik nama atau catatan..."
                                    className="h-10 w-44 rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500 sm:w-52"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Bulan Histori</span>
                                <input
                                    type="month"
                                    value={historyMonth}
                                    onChange={(event) => setHistoryMonth(event.target.value)}
                                    className="h-10 rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </label>
                            {(historyMonth || historySearch) && (
                                <button
                                    type="button"
                                    onClick={() => { setHistoryMonth(''); setHistorySearch(''); }}
                                    className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Tampilkan Semua
                                </button>
                            )}
                        </div>
                    </div>

                    {filteredPayments.length > 0 ? (
                        <>
                        <div className="grid gap-3 lg:hidden">
                            {filteredPayments.map((payment) => (
                                <article
                                    key={payment.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setDetailPayment(payment)}
                                    onKeyDown={(event) => {
                                        if (event.target !== event.currentTarget) return;
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            setDetailPayment(payment);
                                        }
                                    }}
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
                                    <div className="mt-3 flex items-center justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                openEditPayment(payment);
                                            }}
                                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                            <PencilSquareIcon className="h-4 w-4" />
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            disabled={deletingPaymentId === payment.id}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                deletePayment(payment);
                                            }}
                                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                            {deletingPaymentId === payment.id ? 'Menghapus' : 'Hapus'}
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                        <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:block">
                            <div className="w-full">
                                <table className="w-full table-fixed divide-y divide-slate-200 text-sm">
                                    <colgroup>
                                        <col className="w-[12%]" />
                                        <col className="w-[15%]" />
                                        <col className="w-[15%]" />
                                        <col className="w-[8%]" />
                                        <col className="w-[10%]" />
                                        <col className="w-[9%]" />
                                        <col className="w-[9%]" />
                                        <col className="w-[12%]" />
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
                                            <th className="px-4 py-3 text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredPayments.map((payment) => (
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
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            type="button"
                                                            title="Edit histori"
                                                            aria-label={`Edit histori gaji ${payment.employee_name}`}
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                openEditPayment(payment);
                                                            }}
                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                                        >
                                                            <PencilSquareIcon className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            title="Hapus histori"
                                                            aria-label={`Hapus histori gaji ${payment.employee_name}`}
                                                            disabled={deletingPaymentId === payment.id}
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                deletePayment(payment);
                                                            }}
                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            <TrashIcon className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        </>
                    ) : (
                        <EmptyState text={payments.length === 0 ? "Belum ada histori pembayaran gaji tercatat." : "Tidak ada histori pembayaran gaji yang sesuai dengan filter pencarian."} />
                    )}
                </section>
            </div>

            {paymentEmployee && (
                <SalaryPaymentModal
                    employeeSummary={paymentEmployee}
                    employees={employees}
                    filters={filters}
                    onClose={() => setPaymentEmployee(null)}
                />
            )}

            {editingPayment && (
                <SalaryPaymentModal
                    payment={editingPayment}
                    employees={employees}
                    filters={filters}
                    onClose={() => setEditingPayment(null)}
                />
            )}

            {detailPayment && (
                <PaymentDetailModal
                    payment={detailPayment}
                    isDeleting={deletingPaymentId === detailPayment.id}
                    onEdit={() => openEditPayment(detailPayment)}
                    onDelete={() => deletePayment(detailPayment)}
                    onClose={() => setDetailPayment(null)}
                />
            )}
        </ErpLayout>
    );
}

function SalaryPaymentModal({ employeeSummary, filters, onClose, payment = null, employees = [] }) {
    const isEditing = Boolean(payment);
    const [employeeId, setEmployeeId] = useState(payment?.employee_id || employeeSummary?.employee_id || '');
    const [periodStart, setPeriodStart] = useState(payment?.period_start || filters.start_date || '');
    const [periodEnd, setPeriodEnd] = useState(payment?.period_end || filters.end_date || '');
    const [salaryType, setSalaryType] = useState(payment?.salary_type || 'MONTHLY');
    const [monthlyAmount, setMonthlyAmount] = useState(payment ? String(Number(payment.monthly_amount || payment.base_amount || 0)) : '');
    const [dailyRate, setDailyRate] = useState(payment ? String(Number(payment.daily_rate || 0)) : '');
    const [bonusAmount, setBonusAmount] = useState(payment ? String(Number(payment.bonus_amount || 0)) : '');
    const [deductionAmount, setDeductionAmount] = useState(payment ? String(Number(payment.deduction_amount || 0)) : '');
    const [paidAt, setPaidAt] = useState(dateInputValue(payment?.paid_at) || todayInputValue());
    const [note, setNote] = useState(payment?.note || '');
    const [submitting, setSubmitting] = useState(false);
    const [showWorkedDates, setShowWorkedDates] = useState(false);

    const selectedEmployee = employees.find((employee) => employee.id === employeeId);
    const employeeName = selectedEmployee?.display_name || payment?.employee_name || employeeSummary?.employee_name || 'Pegawai';
    const employeeOptions = employeeId && !selectedEmployee
        ? [{ id: employeeId, display_name: employeeName }, ...employees]
        : employees;
    const statSource = isEditing ? payment : employeeSummary;

    const attendanceAnalysis = useMemo(() => {
        if (!periodStart || !periodEnd || periodEnd < periodStart) {
            return { totalDays: 0, workedDays: [], offDays: [] };
        }

        const shifts = (statSource?.shift_details || statSource?.shift_snapshot || []);
        const workedSet = new Set(
            shifts.map(s => s.work_date || (s.opened_at ? String(s.opened_at).slice(0, 10) : null)).filter(Boolean)
        );

        const worked = [];
        const off = [];
        const start = new Date(periodStart + 'T00:00:00');
        const end = new Date(periodEnd + 'T00:00:00');
        const current = new Date(start);

        while (current <= end) {
            const y = current.getFullYear();
            const m = String(current.getMonth() + 1).padStart(2, '0');
            const d = String(current.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;

            if (workedSet.has(dateStr)) {
                worked.push(dateStr);
            } else {
                off.push(dateStr);
            }
            current.setDate(current.getDate() + 1);
        }

        return {
            totalDays: worked.length + off.length,
            workedDays: worked,
            offDays: off,
        };
    }, [periodStart, periodEnd, statSource]);
    const dailyWorkDays = Number((isEditing ? payment?.payable_days : employeeSummary?.work_days) || 0);
    const baseSalary = salaryType === 'DAILY'
        ? Number(dailyRate || 0) * dailyWorkDays
        : Number(monthlyAmount || 0);
    const totalSalary = Math.max(0, baseSalary + Number(bonusAmount || 0) - Number(deductionAmount || 0));
    const lastPayment = employeeSummary?.last_payment;
    const invalidPeriod = Boolean(periodStart && periodEnd && periodEnd < periodStart);
    const cannotSubmitDaily = salaryType === 'DAILY' && (Number(dailyRate || 0) <= 0 || (!isEditing && dailyWorkDays <= 0));
    const cannotSubmitAmount = salaryType === 'DAILY' && isEditing
        ? Number(dailyRate || 0) <= 0
        : totalSalary <= 0;

    const submitPayment = (event) => {
        event.preventDefault();
        if (!employeeId || !periodStart || !periodEnd || invalidPeriod || cannotSubmitDaily || totalSalary <= 0) return;

        setSubmitting(true);
        const payload = {
            employee_id: employeeId,
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
        };
        const method = isEditing ? 'put' : 'post';
        const target = isEditing ? route('payroll.update', payment.id) : route('payroll.store');

        router[method](target, payload, {
            preserveScroll: true,
            onSuccess: onClose,
            onFinish: () => setSubmitting(false),
        });
    };

    return (
        <Modal title={isEditing ? 'Edit Histori Gaji' : 'Pemberian Gaji'} subtitle={employeeName} onClose={onClose} width="max-w-3xl">
            <form onSubmit={submitPayment} className="space-y-5">
                <div className="grid gap-3 lg:grid-cols-[1fr_0.75fr]">
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase text-slate-500">Data gaji</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            {isEditing ? (
                                <label className="block sm:col-span-2">
                                    <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Pegawai</span>
                                    <select
                                        value={employeeId}
                                        onChange={(event) => setEmployeeId(event.target.value)}
                                        className="h-10 w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    >
                                        {employeeOptions.map((employee) => (
                                            <option key={employee.id} value={employee.id}>{employee.display_name}</option>
                                        ))}
                                    </select>
                                </label>
                            ) : (
                                <div className="sm:col-span-2">
                                    <ReadOnlyField label="Pegawai" value={employeeName} />
                                </div>
                            )}
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Mulai</span>
                                <input
                                    type="date"
                                    value={periodStart}
                                    onChange={(event) => setPeriodStart(event.target.value)}
                                    className="h-10 w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Sampai</span>
                                <input
                                    type="date"
                                    min={periodStart || undefined}
                                    value={periodEnd}
                                    onChange={(event) => setPeriodEnd(event.target.value)}
                                    className={`h-10 w-full rounded-md text-sm focus:border-indigo-500 focus:ring-indigo-500 ${invalidPeriod ? 'border-rose-400' : 'border-slate-300'}`}
                                />
                            </label>
                        </div>
                        {invalidPeriod && <p className="mt-2 text-xs font-medium text-rose-600">Tanggal akhir tidak boleh sebelum tanggal mulai.</p>}
                    </div>
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
                        {isEditing ? (
                            <>
                                <p className="text-xs font-semibold uppercase text-indigo-700">Snapshot saat ini</p>
                                <p className="mt-1 font-semibold">{formatNumber(payment.shift_count)} shift | {formatNumber(payment.work_days)} hari</p>
                                <p className="mt-1 text-xs text-indigo-800">Shift dan hari kerja akan dihitung ulang saat perubahan disimpan.</p>
                            </>
                        ) : (
                            <>
                                <p className="text-xs font-semibold uppercase text-indigo-700">Terakhir gajian</p>
                                <p className="mt-1 font-semibold">
                                    {lastPayment ? formatDate(lastPayment.paid_at, true) : 'Belum pernah'}
                                </p>
                                <p className="mt-1 text-xs text-indigo-800">
                                    {lastPayment ? formatRupiah(lastPayment.total_amount) : 'Belum ada histori pembayaran untuk pegawai ini.'}
                                </p>
                            </>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <MiniMetric label="Hari kerja" value={`${formatNumber(statSource?.work_days)} hari`} />
                    <MiniMetric label="Shift" value={formatNumber(statSource?.shift_count)} />
                    <MiniMetric label="Rata-rata" value={statSource?.average_label || '0j 0m'} />
                    <MiniMetric label="Total jam" value={statSource?.total_label || '0j 0m'} />
                </div>

                {/* Rekap Kehadiran & List Tanggal Tidak Ada Shift */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                                Rekap Kehadiran Shift Pegawai
                            </p>
                            <p className="text-xs text-slate-500">
                                Rentang tanggal: {formatDate(periodStart)} &ndash; {formatDate(periodEnd)} ({attendanceAnalysis.totalDays} hari)
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs font-semibold">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                                {attendanceAnalysis.workedDays.length} Hari Masuk ({formatNumber(statSource?.shift_count)} Shift)
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${attendanceAnalysis.offDays.length > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700'}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${attendanceAnalysis.offDays.length > 0 ? 'bg-rose-600' : 'bg-slate-500'}`} />
                                {attendanceAnalysis.offDays.length} Hari Tidak Ada Shift
                            </span>
                        </div>
                    </div>

                    {attendanceAnalysis.offDays.length > 0 ? (
                        <div className="mt-3 rounded-lg border border-rose-200/90 bg-white p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-xs font-semibold text-rose-800">
                                    Daftar Tanggal Tidak Ada Shift / Libur ({attendanceAnalysis.offDays.length} Hari):
                                </span>
                                <span className="text-[11px] text-slate-400">Pegawai tidak tercatat shift</span>
                            </div>
                            <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto pr-1">
                                {attendanceAnalysis.offDays.map((dateStr) => (
                                    <span
                                        key={dateStr}
                                        className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50/70 px-2 py-1 text-xs font-medium text-rose-800 shadow-sm"
                                    >
                                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                        {formatDate(dateStr, false)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-xs font-medium text-emerald-800">
                            ✓ Pegawai memiliki jadwal shift aktif di setiap hari pada periode ini (tidak ada tanggal libur/absen).
                        </div>
                    )}

                    {attendanceAnalysis.workedDays.length > 0 && (
                        <div className="mt-2.5">
                            <button
                                type="button"
                                onClick={() => setShowWorkedDates(!showWorkedDates)}
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                            >
                                {showWorkedDates ? '▲ Sembunyikan daftar tanggal masuk' : '▼ Lihat rincian tanggal masuk'}
                            </button>
                            {showWorkedDates && (
                                <div className="mt-2 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2.5">
                                    {attendanceAnalysis.workedDays.map((dateStr) => (
                                        <span key={dateStr} className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                                            {formatDate(dateStr, false)}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
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
                        {isEditing && (
                            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:col-span-2">
                                Jika periode atau pegawai diganti, hari kerja harian akan dihitung ulang setelah disimpan.
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
                        <p className="text-xs font-semibold uppercase text-slate-500">{isEditing && salaryType === 'DAILY' ? 'Estimasi total saat ini' : 'Total gaji fix'}</p>
                        <p className="text-3xl font-bold text-slate-900">{formatRupiah(totalSalary)}</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <button type="button" onClick={onClose} className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !periodStart || !periodEnd || invalidPeriod || cannotSubmitDaily || cannotSubmitAmount}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300"
                        >
                            {isEditing ? <PencilSquareIcon className="h-5 w-5" /> : <BanknotesIcon className="h-5 w-5" />}
                            {submitting ? 'Menyimpan...' : (isEditing ? 'Simpan Perubahan' : 'Simpan Gaji')}
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}

function PaymentDetailModal({ payment, onClose, onEdit, onDelete, isDeleting = false }) {
    const offDays = useMemo(() => {
        if (!payment?.period_start || !payment?.period_end) return [];
        const shifts = payment.shift_snapshot || [];
        const workedSet = new Set(
            shifts.map(s => s.work_date || (s.opened_at ? String(s.opened_at).slice(0, 10) : null)).filter(Boolean)
        );
        const off = [];
        const start = new Date(payment.period_start + 'T00:00:00');
        const end = new Date(payment.period_end + 'T00:00:00');
        const current = new Date(start);
        while (current <= end) {
            const y = current.getFullYear();
            const m = String(current.getMonth() + 1).padStart(2, '0');
            const d = String(current.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;
            if (!workedSet.has(dateStr)) {
                off.push(dateStr);
            }
            current.setDate(current.getDate() + 1);
        }
        return off;
    }, [payment]);

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

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onEdit}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        <PencilSquareIcon className="h-5 w-5" />
                        Edit Histori
                    </button>
                    <button
                        type="button"
                        disabled={isDeleting}
                        onClick={onDelete}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <TrashIcon className="h-5 w-5" />
                        {isDeleting ? 'Menghapus...' : 'Hapus Histori'}
                    </button>
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

                {offDays.length > 0 && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3">
                        <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-xs font-semibold text-rose-800">
                                Tanggal Tidak Ada Shift / Libur ({offDays.length} Hari):
                            </span>
                            <span className="text-[11px] text-slate-400">Periode ini</span>
                        </div>
                        <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1">
                            {offDays.map((d) => (
                                <span key={d} className="inline-flex items-center gap-1 rounded border border-rose-200 bg-white px-2 py-0.5 text-xs font-medium text-rose-700 shadow-sm">
                                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                    {formatDate(d, false)}
                                </span>
                            ))}
                        </div>
                    </div>
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
