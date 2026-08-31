import { useEffect, useMemo, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import {
    ArrowPathIcon,
    BanknotesIcon,
    CheckCircleIcon,
    DocumentCheckIcon,
    UserGroupIcon,
} from '@heroicons/react/24/outline';
import ErpLayout from '@/Layouts/ErpLayout';

function formatRupiah(value) {
    const n = Number(value) || 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function formatNumber(value, digits = 0) {
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(Number(value) || 0);
}

function metricTone(tone) {
    return {
        emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        amber: 'border-amber-200 bg-amber-50 text-amber-800',
        indigo: 'border-indigo-200 bg-indigo-50 text-indigo-800',
        slate: 'border-slate-200 bg-white text-slate-800',
        rose: 'border-rose-200 bg-rose-50 text-rose-800',
    }[tone] || 'border-slate-200 bg-white text-slate-800';
}

function itemTypeLabel(type) {
    return {
        SALARY: 'Gaji',
        DIVIDEND: 'Dividen',
        LOAN_REPAYMENT: 'Bayar pinjaman',
        RETAINED: 'Disimpan di kas',
    }[type] || type;
}

function statusLabel(status) {
    return {
        DRAFT: 'Draft',
        POSTED: 'Sudah posting',
        VOID: 'Dibatalkan',
    }[status] || status;
}

function batchPeriodKey(batch) {
    return `${batch.outlet?.id || ''}:${batch.period_start || ''}:${batch.period_end || ''}`;
}

function MetricCard({ label, value, sub, tone = 'slate' }) {
    return (
        <div className={`rounded-lg border p-4 shadow-sm ${metricTone(tone)}`}>
            <p className="text-xs font-semibold uppercase text-current/70">{label}</p>
            <p className="mt-2 text-xl font-bold">{value}</p>
            {sub && <p className="mt-1 text-xs text-current/70">{sub}</p>}
        </div>
    );
}

function EmptyState({ text }) {
    return <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">{text}</div>;
}

function Section({ title, description, children, action }) {
    return (
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="text-base font-semibold text-slate-900">{title}</h2>
                    {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
                </div>
                {action}
            </div>
            <div className="p-4">{children}</div>
        </section>
    );
}

function ProfileRow({ stakeholder }) {
    const [salary, setSalary] = useState(stakeholder.default_salary || 0);
    const [isActive, setIsActive] = useState(stakeholder.profile_active !== false);
    const [note, setNote] = useState(stakeholder.profile_note || '');

    useEffect(() => {
        setSalary(stakeholder.default_salary || 0);
        setIsActive(stakeholder.profile_active !== false);
        setNote(stakeholder.profile_note || '');
    }, [stakeholder.id, stakeholder.default_salary, stakeholder.profile_active, stakeholder.profile_note]);

    const save = () => {
        router.post(route('partner-profiles.store'), {
            user_id: stakeholder.id,
            default_salary: salary,
            is_active: isActive,
            note,
        }, { preserveScroll: true });
    };

    return (
        <tr className="align-top hover:bg-slate-50">
            <td className="px-4 py-3">
                <p className="font-semibold text-slate-900">{stakeholder.display_name}</p>
                <p className="text-xs text-slate-500">{stakeholder.role} - {formatNumber(stakeholder.lots, 2)} lot</p>
            </td>
            <td className="px-4 py-3">
                <input
                    type="number"
                    min="0"
                    value={salary}
                    onChange={e => setSalary(e.target.value)}
                    className="w-full min-w-[130px] rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
            </td>
            <td className="px-4 py-3">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                        type="checkbox"
                        checked={isActive}
                        onChange={e => setIsActive(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600"
                    />
                    Aktif
                </label>
            </td>
            <td className="px-4 py-3">
                <input
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Catatan"
                    className="w-full min-w-[160px] rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
            </td>
            <td className="px-4 py-3 text-right">
                <button type="button" onClick={save} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                    Simpan
                </button>
            </td>
        </tr>
    );
}

function LoanForm({ stakeholders, investments }) {
    const [data, setData] = useState({
        borrower_user_id: '',
        lender_user_id: '',
        investment_id: '',
        principal_amount: '',
        note: '',
    });

    const selectedBorrowerInvestments = useMemo(() => (
        investments.filter(item => !data.borrower_user_id || item.user_id === data.borrower_user_id)
    ), [investments, data.borrower_user_id]);

    const submit = e => {
        e.preventDefault();
        router.post(route('partner-capital-loans.store'), data, {
            preserveScroll: true,
            onSuccess: () => setData({ borrower_user_id: '', lender_user_id: '', investment_id: '', principal_amount: '', note: '' }),
        });
    };

    return (
        <form onSubmit={submit} className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_150px_auto] lg:items-end">
            <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">Yang meminjam</span>
                <select value={data.borrower_user_id} onChange={e => setData({ ...data, borrower_user_id: e.target.value, investment_id: '' })} className="w-full rounded-md border-slate-300 text-sm" required>
                    <option value="">Pilih nama</option>
                    {stakeholders.map(user => <option key={user.id} value={user.id}>{user.display_name}</option>)}
                </select>
            </label>
            <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">Yang memberi pinjaman</span>
                <select value={data.lender_user_id} onChange={e => setData({ ...data, lender_user_id: e.target.value })} className="w-full rounded-md border-slate-300 text-sm" required>
                    <option value="">Pilih nama</option>
                    {stakeholders.map(user => <option key={user.id} value={user.id}>{user.display_name}</option>)}
                </select>
            </label>
            <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">Modal yang dibantu</span>
                <select value={data.investment_id} onChange={e => setData({ ...data, investment_id: e.target.value })} className="w-full rounded-md border-slate-300 text-sm">
                    <option value="">Tidak terkait modal tertentu</option>
                    {selectedBorrowerInvestments.map(item => (
                        <option key={item.id} value={item.id}>
                            {item.user?.display_name || '-'} - {formatNumber(item.lots)} lot
                        </option>
                    ))}
                </select>
            </label>
            <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">Nominal</span>
                <input type="number" min="1" value={data.principal_amount} onChange={e => setData({ ...data, principal_amount: e.target.value })} className="w-full rounded-md border-slate-300 text-sm" required />
            </label>
            <button type="submit" className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">
                Simpan
            </button>
            <label className="text-sm lg:col-span-5">
                <span className="mb-1 block font-medium text-slate-700">Catatan</span>
                <input value={data.note} onChange={e => setData({ ...data, note: e.target.value })} className="w-full rounded-md border-slate-300 text-sm" placeholder="Contoh: modal dibantu dulu oleh partner lain" />
            </label>
        </form>
    );
}

function PreviewTables({ preview, isOwner, salaryOverrides, setSalaryOverrides, loanAllocations, setLoanAllocations }) {
    if (!preview) {
        return <EmptyState text="Pilih outlet dan tanggal untuk melihat hasil pembagian." />;
    }

    return (
        <div className="space-y-4">
            {isOwner ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="Laba Usaha" value={formatRupiah(preview.basis?.profit_before_owner)} sub="Omzet dikurangi HPP, biaya outlet, dan gaji staff" tone={(preview.basis?.profit_before_owner || 0) > 0 ? 'emerald' : 'rose'} />
                    <MetricCard label="Total Gaji" value={formatRupiah(preview.totals?.salary_paid)} sub={`Belum terbayar ${formatRupiah(preview.totals?.salary_shortfall)}`} tone="indigo" />
                    <MetricCard label="Total Dividen" value={formatRupiah(preview.totals?.dividend_pool)} sub={`${formatNumber(preview.totals?.total_lots, 2)} lot aktif`} tone="emerald" />
                    <MetricCard label="Uang Siap Dibayar" value={formatRupiah(preview.totals?.payout_method_balance)} sub={`Dari ${preview.payout_method}`} tone="amber" />
                </div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="Gaji Saya" value={formatRupiah(preview.totals?.salary_paid)} sub={`Belum terbayar ${formatRupiah(preview.totals?.salary_shortfall)}`} tone="indigo" />
                    <MetricCard label="Dividen Saya" value={formatRupiah(preview.totals?.dividend_pool)} sub={`${formatNumber(preview.totals?.total_lots, 2)} lot`} tone="emerald" />
                    <MetricCard label="Bayar Pinjaman" value={formatRupiah(preview.totals?.loan_repayment)} sub="Dipakai dari dividen" tone="amber" />
                    <MetricCard label="Saya Terima" value={formatRupiah(preview.totals?.total_payout)} sub={`Dari ${preview.payout_method}`} tone="slate" />
                </div>
            )}

            {preview.already_posted && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                    {preview.posting_message || 'Periode ini sudah pernah diposting untuk outlet ini.'} Ubah outlet atau tanggal untuk membuat pembagian baru.
                </div>
            )}

            <div className="grid gap-4 xl:grid-cols-2">
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                            <tr>
                                <th className="px-4 py-3">Nama</th>
                                <th className="px-4 py-3 text-right">Gaji awal</th>
                                <th className="px-4 py-3 text-right">Gaji dipilih</th>
                                <th className="px-4 py-3 text-right">Dibayar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {preview.salary_rows.length === 0 ? (
                                <tr><td colSpan="4" className="px-4 py-6 text-center text-slate-500">Belum ada gaji yang diatur.</td></tr>
                            ) : preview.salary_rows.map(row => (
                                <tr key={row.user.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-semibold text-slate-900">{row.user.display_name}</td>
                                    <td className="px-4 py-3 text-right">{formatRupiah(row.default_salary)}</td>
                                    <td className="px-4 py-3 text-right">
                                        {isOwner ? (
                                            <input
                                                type="number"
                                                min="0"
                                                value={salaryOverrides[row.user.id] ?? row.requested_salary ?? 0}
                                                onChange={e => setSalaryOverrides({ ...salaryOverrides, [row.user.id]: e.target.value })}
                                                className="ml-auto w-32 rounded-md border-slate-300 text-right text-sm"
                                            />
                                        ) : formatRupiah(row.requested_salary)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-indigo-700">{formatRupiah(row.final_salary)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                            <tr>
                                <th className="px-4 py-3">Nama</th>
                                <th className="px-4 py-3 text-right">Lot</th>
                                <th className="px-4 py-3 text-right">Hak dividen</th>
                                <th className="px-4 py-3 text-right">Dibayar langsung</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {preview.dividend_rows.length === 0 ? (
                                <tr><td colSpan="4" className="px-4 py-6 text-center text-slate-500">Belum ada modal yang disetujui di outlet ini.</td></tr>
                            ) : preview.dividend_rows.map(row => (
                                <tr key={row.user.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3">
                                        <p className="font-semibold text-slate-900">{row.user.display_name}</p>
                                        <p className="text-xs text-slate-500">{formatNumber(row.share_percent, 2)}%</p>
                                    </td>
                                    <td className="px-4 py-3 text-right">{formatNumber(row.lots, 2)}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">{formatRupiah(row.dividend)}</td>
                                    <td className="px-4 py-3 text-right">
                                        <p className="font-bold text-slate-900">{formatRupiah(row.direct_payout)}</p>
                                        <p className="text-xs text-amber-700">Untuk pinjaman {formatRupiah(row.loan_repayment)}</p>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {preview.loan_rows.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                            <tr>
                                <th className="px-4 py-3">Pinjaman modal</th>
                                <th className="px-4 py-3 text-right">Sisa</th>
                                <th className="px-4 py-3 text-right">Bisa dibayar</th>
                                <th className="px-4 py-3 text-right">Bayar sekarang</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {preview.loan_rows.map(row => (
                                <tr key={row.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3">
                                        <p className="font-semibold text-slate-900">{row.borrower?.display_name} ke {row.lender?.display_name}</p>
                                        <p className="text-xs text-slate-500">{row.investment?.outlet?.name || 'Tidak terkait modal tertentu'}</p>
                                    </td>
                                    <td className="px-4 py-3 text-right">{formatRupiah(row.remaining_amount)}</td>
                                    <td className="px-4 py-3 text-right">{formatRupiah(row.suggested_allocation)}</td>
                                    <td className="px-4 py-3 text-right">
                                        {isOwner ? (
                                            <input
                                                type="number"
                                                min="0"
                                                max={row.suggested_allocation || row.remaining_amount}
                                                value={loanAllocations[row.id] ?? row.allocation ?? 0}
                                                onChange={e => setLoanAllocations({ ...loanAllocations, [row.id]: e.target.value })}
                                                className="ml-auto w-32 rounded-md border-slate-300 text-right text-sm"
                                            />
                                        ) : formatRupiah(row.allocation)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function BatchHistory({ batches, isOwner }) {
    if (!batches.length) {
        return <EmptyState text="Belum ada riwayat pembagian." />;
    }

    const postedPeriodKeys = new Set(
        batches
            .filter(batch => batch.status === 'POSTED')
            .map(batch => batchPeriodKey(batch))
    );

    return (
        <div className="space-y-3">
            {batches.map(batch => {
                const isLockedDraft = batch.status === 'DRAFT' && postedPeriodKeys.has(batchPeriodKey(batch));

                return (
                    <div key={batch.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-900">{batch.outlet?.name || 'Outlet'}</p>
                                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${batch.status === 'POSTED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                    {statusLabel(batch.status)}
                                </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-500">{batch.period_start} sampai {batch.period_end} - {batch.payout_method}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-right">
                            <MetricPill label="Gaji" value={batch.total_salary} />
                            <MetricPill label="Dividen" value={batch.total_dividend} />
                            <MetricPill label="Dibayar" value={batch.total_payout} />
                        </div>
                    </div>
                    {batch.items?.length > 0 && (
                        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {batch.items.map(item => (
                                <div key={item.id} className="rounded-md bg-slate-50 px-3 py-2 text-sm">
                                    <p className="font-semibold text-slate-800">{itemTypeLabel(item.type)} - {formatRupiah(item.amount)}</p>
                                    <p className="text-xs text-slate-500">{item.recipient?.display_name || item.source?.display_name || 'Disimpan di kas'} - {item.payment_method}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    {isOwner && batch.status === 'DRAFT' && (
                        <div className="mt-3 flex justify-end">
                            <button
                                type="button"
                                disabled={isLockedDraft}
                                onClick={() => {
                                    if (isLockedDraft) {
                                        return;
                                    }
                                    if (confirm('Posting pembagian ini sekarang?')) {
                                        router.post(route('owner-finance.batches.post', batch.id), {}, { preserveScroll: true });
                                    }
                                }}
                                title={isLockedDraft ? 'Periode ini sudah punya posting final.' : undefined}
                                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <CheckCircleIcon className="h-4 w-4" />
                                Posting
                            </button>
                        </div>
                    )}
                </div>
                );
            })}
        </div>
    );
}

function MetricPill({ label, value, currency = true }) {
    return (
        <div className="rounded-md bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase text-slate-500">{label}</p>
            <p className="text-sm font-bold text-slate-900">{currency ? formatRupiah(value) : formatNumber(value, 2)}</p>
        </div>
    );
}

export default function OwnerFinanceIndex({
    isOwner,
    outlets = [],
    filters,
    preview,
    stakeholders = [],
    investments = [],
    loans = [],
    batches = [],
}) {
    const [filter, setFilter] = useState({
        outlet_id: filters?.outlet_id || outlets[0]?.id || '',
        period_start: filters?.period_start || '',
        period_end: filters?.period_end || '',
        payout_method: filters?.payout_method || 'CASH',
    });
    const [salaryOverrides, setSalaryOverrides] = useState(filters?.salary_overrides || {});
    const [loanAllocations, setLoanAllocations] = useState(filters?.loan_allocations || {});
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setFilter({
            outlet_id: filters?.outlet_id || outlets[0]?.id || '',
            period_start: filters?.period_start || '',
            period_end: filters?.period_end || '',
            payout_method: filters?.payout_method || 'CASH',
        });
    }, [filters?.outlet_id, filters?.period_start, filters?.period_end, filters?.payout_method, outlets]);

    const applyPreview = e => {
        e?.preventDefault();
        router.get(route('owner-finance'), {
            ...filter,
            salary_overrides: salaryOverrides,
            loan_allocations: loanAllocations,
        }, { preserveScroll: true });
    };

    const submitBatch = intent => {
        if (isSubmitting || preview?.already_posted || (intent === 'POSTED' && !preview?.can_post)) {
            return;
        }

        setIsSubmitting(true);
        router.post(route('owner-finance.batches.store'), {
            ...filter,
            salary_overrides: salaryOverrides,
            loan_allocations: loanAllocations,
            note,
            intent,
        }, {
            preserveScroll: true,
            onSuccess: () => setNote(''),
            onFinish: () => setIsSubmitting(false),
        });
    };

    return (
        <ErpLayout title="Bagi Hasil">
            <Head title="Bagi Hasil" />

            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">{isOwner ? 'Owner' : 'Partner Bisnis'}</p>
                    <h1 className="mt-1 text-2xl font-semibold text-slate-950">Bagi Hasil</h1>
                    <p className="mt-1 text-sm text-slate-500">Atur gaji, dividen, dan pinjaman modal dari laba outlet.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                    <BanknotesIcon className="h-5 w-5 text-emerald-600" />
                    {preview?.payout_method || 'CASH'}
                </div>
            </div>

            <section className="mb-5 rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-4">
                    <h2 className="text-base font-semibold text-slate-900">1. Pilih Data</h2>
                    <p className="mt-1 text-sm text-slate-500">Pilih outlet, tanggal, dan sumber uang yang akan dipakai.</p>
                </div>
                <form onSubmit={applyPreview} className="p-4">
                    <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_160px_auto] lg:items-end">
                        <label className="text-sm">
                            <span className="mb-1 block font-medium text-slate-700">Outlet</span>
                            <select value={filter.outlet_id} onChange={e => setFilter({ ...filter, outlet_id: e.target.value })} className="w-full rounded-md border-slate-300 text-sm" disabled={outlets.length <= 1}>
                                {outlets.map(outlet => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}
                            </select>
                        </label>
                        <label className="text-sm">
                            <span className="mb-1 block font-medium text-slate-700">Dari tanggal</span>
                            <input type="date" value={filter.period_start} onChange={e => setFilter({ ...filter, period_start: e.target.value })} className="w-full rounded-md border-slate-300 text-sm" />
                        </label>
                        <label className="text-sm">
                            <span className="mb-1 block font-medium text-slate-700">Sampai tanggal</span>
                            <input type="date" value={filter.period_end} onChange={e => setFilter({ ...filter, period_end: e.target.value })} className="w-full rounded-md border-slate-300 text-sm" />
                        </label>
                        <label className="text-sm">
                            <span className="mb-1 block font-medium text-slate-700">Dibayar dari</span>
                            <select value={filter.payout_method} onChange={e => setFilter({ ...filter, payout_method: e.target.value })} className="w-full rounded-md border-slate-300 text-sm" disabled={!isOwner}>
                                <option value="CASH">Cash</option>
                                <option value="QRIS">QRIS</option>
                            </select>
                        </label>
                        <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">
                            <ArrowPathIcon className="h-4 w-4" />
                            Lihat Hasil
                        </button>
                    </div>
                </form>
            </section>

            <div className="space-y-5">
                <Section title={isOwner ? '2. Cek Pembagian' : 'Bagian Saya'} description={isOwner ? 'Sistem menghitung laba, gaji, dividen, dan batas uang yang bisa dibayar.' : 'Bagian yang tampil hanya data milik Anda.'}>
                    <PreviewTables
                        preview={preview}
                        isOwner={isOwner}
                        salaryOverrides={salaryOverrides}
                        setSalaryOverrides={setSalaryOverrides}
                        loanAllocations={loanAllocations}
                        setLoanAllocations={setLoanAllocations}
                    />
                    {isOwner && preview && (
                        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <label className="block text-sm">
                                <span className="mb-1 block font-medium text-slate-700">Catatan</span>
                                <textarea value={note} onChange={e => setNote(e.target.value)} rows="2" className="w-full rounded-md border-slate-300 text-sm" placeholder="Catatan untuk pembagian ini" />
                            </label>
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    disabled={isSubmitting || preview.already_posted}
                                    onClick={() => submitBatch('DRAFT')}
                                    className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <DocumentCheckIcon className="h-4 w-4" />
                                    Simpan Draft
                                </button>
                                <button
                                    type="button"
                                    disabled={isSubmitting || !preview.can_post}
                                    onClick={() => {
                                        if (confirm('Posting pembagian hasil ini sekarang?')) {
                                            submitBatch('POSTED');
                                        }
                                    }}
                                    className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <CheckCircleIcon className="h-4 w-4" />
                                    Posting
                                </button>
                            </div>
                        </div>
                    )}
                </Section>

                {isOwner && (
                    <Section title="Gaji Awal" description="Angka ini dipakai sebagai gaji awal saat menghitung pembagian.">
                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3">Nama</th>
                                        <th className="px-4 py-3">Gaji awal</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3">Catatan</th>
                                        <th className="px-4 py-3 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {stakeholders.map(stakeholder => <ProfileRow key={stakeholder.id} stakeholder={stakeholder} />)}
                                </tbody>
                            </table>
                        </div>
                    </Section>
                )}

                {isOwner && (
                    <Section title="Pinjaman Modal" description="Partner yang meminjam tetap punya lot. Pembayaran bisa dipotong dari dividen.">
                        <LoanForm stakeholders={stakeholders} investments={investments.filter(item => item.status === 'APPROVED')} />
                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                            {loans.length === 0 ? <EmptyState text="Belum ada pinjaman modal." /> : loans.map(loan => (
                                <div key={loan.id} className="rounded-lg border border-slate-200 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-slate-900">{loan.borrower?.display_name} pinjam ke {loan.lender?.display_name}</p>
                                            <p className="mt-1 text-sm text-slate-500">{loan.investment?.outlet?.name || 'Tidak terkait modal tertentu'} - {statusLabel(loan.status)}</p>
                                        </div>
                                        <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{formatRupiah(loan.remaining_amount)}</span>
                                    </div>
                                    {loan.note && <p className="mt-3 text-sm text-slate-600">{loan.note}</p>}
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {!isOwner && loans.length > 0 && (
                    <Section title="Pinjaman Modal Saya" description="Sisa pinjaman dan piutang yang terkait akun ini.">
                        <div className="grid gap-3 lg:grid-cols-2">
                            {loans.map(loan => (
                                <div key={loan.id} className="rounded-lg border border-slate-200 p-4">
                                    <p className="font-semibold text-slate-900">{loan.borrower?.display_name} pinjam ke {loan.lender?.display_name}</p>
                                    <p className="mt-1 text-sm text-slate-500">Sisa {formatRupiah(loan.remaining_amount)} dari {formatRupiah(loan.principal_amount)}</p>
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                <Section title="Riwayat Pembagian" description="Draft dan pembagian yang sudah diposting.">
                    <BatchHistory batches={batches} isOwner={isOwner} />
                </Section>

                <Section title="Modal & Lot" description="Modal yang sudah disetujui menjadi dasar dividen.">
                    {investments.length === 0 ? <EmptyState text="Belum ada modal pada outlet ini." /> : (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {investments.map(item => (
                                <div key={item.id} className="rounded-lg border border-slate-200 p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                                            <UserGroupIcon className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold text-slate-900">{item.user?.display_name || 'Partner'}</p>
                                            <p className="text-sm text-slate-500">{item.outlet?.name || '-'} - {item.status}</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        <MetricPill label="Lot" value={item.lots} currency={false} />
                                        <MetricPill label="Nilai" value={item.total_value} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Section>
            </div>
        </ErpLayout>
    );
}
