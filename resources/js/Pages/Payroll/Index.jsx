import { useMemo, useState } from 'react';
import ErpLayout from '@/Layouts/ErpLayout';
import { Head, router } from '@inertiajs/react';
import {
    BanknotesIcon,
    CalendarDaysIcon,
    ClockIcon,
    FunnelIcon,
    PlusCircleIcon,
    ReceiptPercentIcon,
    UserGroupIcon,
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

export default function PayrollIndex({ filters, employees = [], summaries = [], payments = [] }) {
    const [filterStart, setFilterStart] = useState(filters.start_date || '');
    const [filterEnd, setFilterEnd] = useState(filters.end_date || '');
    const [filterEmployee, setFilterEmployee] = useState(filters.employee_id || '');
    const [employeeId, setEmployeeId] = useState(filters.employee_id || employees[0]?.id || '');
    const [periodStart, setPeriodStart] = useState(filters.start_date || '');
    const [periodEnd, setPeriodEnd] = useState(filters.end_date || '');
    const [baseAmount, setBaseAmount] = useState('');
    const [bonusAmount, setBonusAmount] = useState('');
    const [deductionAmount, setDeductionAmount] = useState('');
    const [paidAt, setPaidAt] = useState(todayInputValue());
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

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

    const selectedSummary = summaries.find((summary) => summary.employee_id === employeeId);
    const totalSalary = Math.max(0, Number(baseAmount || 0) + Number(bonusAmount || 0) - Number(deductionAmount || 0));
    const invalidRange = Boolean(filterStart && filterEnd && filterEnd < filterStart);
    const invalidPayRange = Boolean(periodStart && periodEnd && periodEnd < periodStart);

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

    const submitPayment = (event) => {
        event.preventDefault();
        if (!employeeId || invalidPayRange || totalSalary <= 0) return;

        setSubmitting(true);
        router.post(route('payroll.store'), {
            employee_id: employeeId,
            period_start: periodStart,
            period_end: periodEnd,
            base_amount: baseAmount,
            bonus_amount: bonusAmount || 0,
            deduction_amount: deductionAmount || 0,
            paid_at: paidAt || undefined,
            note,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setBaseAmount('');
                setBonusAmount('');
                setDeductionAmount('');
                setNote('');
            },
            onFinish: () => setSubmitting(false),
        });
    };

    return (
        <ErpLayout title="Gaji Pegawai">
            <Head title="Gaji Pegawai" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Gaji Pegawai</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Kelola pembayaran gaji, hari kerja, dan ringkasan durasi shift pegawai.
                    </p>
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

                <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
                    <section>
                        <div className="mb-3 flex items-end justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Performa Pegawai</h2>
                                <p className="mt-1 text-sm text-slate-500">Ringkasan shift tertutup pada periode filter.</p>
                            </div>
                        </div>
                        {summaries.length > 0 ? (
                            <div className="grid gap-4 md:grid-cols-2">
                                {summaries.map((summary) => <EmployeeCard key={summary.employee_id} summary={summary} />)}
                            </div>
                        ) : (
                            <EmptyState text="Belum ada pegawai atau shift tertutup pada periode ini." />
                        )}
                    </section>

                    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-5 flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-indigo-50 text-indigo-700">
                                <PlusCircleIcon className="h-6 w-6" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-slate-900">Catat Pembayaran Gaji</h2>
                                <p className="mt-1 text-sm text-slate-500">Data hari kerja dan durasi shift disimpan sebagai snapshot pembayaran.</p>
                            </div>
                        </div>

                        <form onSubmit={submitPayment} className="space-y-4">
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Pegawai</span>
                                <select
                                    value={employeeId}
                                    onChange={(event) => setEmployeeId(event.target.value)}
                                    className="h-10 w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    <option value="">Pilih pegawai</option>
                                    {employees.map((employee) => (
                                        <option key={employee.id} value={employee.id}>{employee.display_name}</option>
                                    ))}
                                </select>
                            </label>

                            {selectedSummary && (
                                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-sm">
                                    <MiniMetric label="Hari kerja" value={formatNumber(selectedSummary.work_days)} />
                                    <MiniMetric label="Shift" value={formatNumber(selectedSummary.shift_count)} />
                                    <MiniMetric label="Rata-rata" value={selectedSummary.average_label} />
                                    <MiniMetric label="Total jam" value={selectedSummary.total_label} />
                                </div>
                            )}

                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block">
                                    <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Periode Mulai</span>
                                    <input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="h-10 w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                                </label>
                                <label className="block">
                                    <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Periode Sampai</span>
                                    <input type="date" min={periodStart || undefined} value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className={`h-10 w-full rounded-md text-sm focus:border-indigo-500 focus:ring-indigo-500 ${invalidPayRange ? 'border-rose-400' : 'border-slate-300'}`} />
                                </label>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                                <MoneyInput label="Gaji Pokok" value={baseAmount} onChange={setBaseAmount} />
                                <MoneyInput label="Bonus" value={bonusAmount} onChange={setBonusAmount} />
                                <MoneyInput label="Potongan" value={deductionAmount} onChange={setDeductionAmount} />
                            </div>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Tanggal Bayar</span>
                                <input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} className="h-10 w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                            </label>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Catatan</span>
                                <textarea
                                    rows="3"
                                    value={note}
                                    onChange={(event) => setNote(event.target.value)}
                                    className="w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    placeholder="Opsional, contoh: bonus performa outlet"
                                />
                            </label>

                            <div className="rounded-lg bg-slate-50 p-4">
                                <p className="text-xs font-semibold uppercase text-slate-500">Total Dibayarkan</p>
                                <p className="mt-1 text-2xl font-bold text-slate-900">{formatRupiah(totalSalary)}</p>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting || !employeeId || !periodStart || !periodEnd || invalidPayRange || totalSalary <= 0}
                                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300"
                            >
                                <BanknotesIcon className="h-5 w-5" />
                                {submitting ? 'Menyimpan...' : 'Simpan Pembayaran'}
                            </button>
                        </form>
                    </section>
                </div>

                <section>
                    <div className="mb-3">
                        <h2 className="text-lg font-semibold text-slate-900">Histori Pemberian Gaji</h2>
                        <p className="mt-1 text-sm text-slate-500">Setiap pembayaran menyimpan rekap hari kerja dan durasi shift pada saat dibayar.</p>
                    </div>
                    {payments.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {payments.map((payment) => <PaymentCard key={payment.id} payment={payment} />)}
                        </div>
                    ) : (
                        <EmptyState text="Belum ada pembayaran gaji pada periode ini." />
                    )}
                </section>
            </div>
        </ErpLayout>
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

function EmployeeCard({ summary }) {
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
        </article>
    );
}

function PaymentCard({ payment }) {
    return (
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{payment.employee_name}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(payment.period_start)} - {formatDate(payment.period_end)}</p>
                </div>
                <ReceiptPercentIcon className="h-6 w-6 shrink-0 text-indigo-500" />
            </div>
            <p className="mt-4 text-2xl font-bold text-emerald-700">{formatRupiah(payment.total_amount)}</p>
            <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-sm">
                <MiniMetric label="Hari kerja" value={formatNumber(payment.work_days)} />
                <MiniMetric label="Shift" value={formatNumber(payment.shift_count)} />
                <MiniMetric label="Rata-rata" value={payment.average_label} />
                <MiniMetric label="Total jam" value={payment.total_label} />
            </div>
            <div className="mt-4 space-y-1 text-xs text-slate-500">
                <p>Pokok {formatRupiah(payment.base_amount)} | Bonus {formatRupiah(payment.bonus_amount)} | Potongan {formatRupiah(payment.deduction_amount)}</p>
                <p>Dibayar {formatDate(payment.paid_at, true)} oleh {payment.paid_by || '-'}</p>
                {payment.note && <p className="rounded-md bg-slate-50 px-3 py-2 text-slate-700">{payment.note}</p>}
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
        <div className="min-w-0 bg-white p-3">
            <p className="truncate text-xs text-slate-500">{label}</p>
            <p className="mt-1 truncate font-bold text-slate-900" title={String(value)}>{value}</p>
        </div>
    );
}

function MoneyInput({ label, value, onChange }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">{label}</span>
            <input
                type="number"
                min="0"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-10 w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="0"
            />
        </label>
    );
}

function EmptyState({ text }) {
    return (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
            {text}
        </div>
    );
}
