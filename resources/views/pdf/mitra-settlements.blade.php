<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>{{ $isSingle ? 'Detail Setoran Mitra' : 'Rekap Setoran Mitra' }}</title>
    <style>
        @page {
            margin: 28px 34px 42px;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            color: #172033;
            font-family: DejaVu Sans, sans-serif;
            font-size: 10px;
            line-height: 1.45;
        }

        .footer {
            position: fixed;
            right: 0;
            bottom: -27px;
            left: 0;
            border-top: 1px solid #dbe1ea;
            padding-top: 7px;
            color: #7a8496;
            font-size: 8px;
        }

        .page-number::after {
            content: counter(page);
        }

        .brand-table,
        .summary-table,
        .meta-table,
        .items-table {
            width: 100%;
            border-collapse: collapse;
        }

        .brand-mark {
            width: 42px;
            height: 42px;
            border-radius: 6px;
            background: #253b80;
            color: #ffffff;
            font-size: 18px;
            font-weight: bold;
            text-align: center;
            vertical-align: middle;
        }

        .document-title {
            margin: 0;
            color: #172033;
            font-size: 19px;
            font-weight: bold;
        }

        .muted {
            color: #697386;
        }

        .right {
            text-align: right;
        }

        .report-period {
            margin-top: 18px;
            border: 1px solid #dbe1ea;
            border-radius: 6px;
            background: #f7f9fc;
            padding: 11px 13px;
        }

        .summary-table {
            margin: 14px 0 22px;
        }

        .summary-table td {
            width: 20%;
            border: 1px solid #dbe1ea;
            padding: 10px;
            vertical-align: top;
        }

        .summary-label {
            color: #697386;
            font-size: 8px;
            text-transform: uppercase;
        }

        .summary-value {
            margin-top: 4px;
            color: #172033;
            font-size: 13px;
            font-weight: bold;
        }

        .settlement {
            margin-top: 18px;
        }

        .settlement.new-page {
            page-break-before: always;
        }

        .settlement-heading {
            border-left: 4px solid #253b80;
            padding: 1px 0 1px 10px;
        }

        .settlement-heading h2 {
            margin: 0;
            font-size: 15px;
        }

        .status {
            display: inline-block;
            border-radius: 10px;
            padding: 4px 8px;
            font-size: 8px;
            font-weight: bold;
            text-transform: uppercase;
        }

        .status-pending {
            background: #fff3cd;
            color: #7a5400;
        }

        .status-approved {
            background: #dff2ff;
            color: #075985;
        }

        .status-rejected {
            background: #ffe4e6;
            color: #9f1239;
        }

        .status-paid {
            background: #dcfce7;
            color: #166534;
        }

        .meta-table {
            margin: 12px 0;
        }

        .meta-table td {
            width: 50%;
            border: 1px solid #dbe1ea;
            padding: 8px 10px;
            vertical-align: top;
        }

        .meta-label {
            margin-bottom: 2px;
            color: #7a8496;
            font-size: 8px;
            text-transform: uppercase;
        }

        .section-title {
            margin: 15px 0 7px;
            color: #3e4c62;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
        }

        .timeline-table {
            width: 100%;
            border-spacing: 6px 0;
            margin-left: -6px;
            margin-right: -6px;
        }

        .timeline-table td {
            width: 33.333%;
            border-radius: 5px;
            background: #f1f4f8;
            padding: 8px;
            vertical-align: top;
        }

        .timeline-table .done {
            background: #eaf8ef;
        }

        .timeline-table .rejected {
            background: #fff0f1;
        }

        .items-table {
            margin-top: 5px;
        }

        .items-table th {
            border-bottom: 2px solid #253b80;
            background: #eef2fb;
            padding: 7px 6px;
            color: #314060;
            font-size: 8px;
            text-align: left;
            text-transform: uppercase;
        }

        .items-table td {
            border-bottom: 1px solid #e4e8ef;
            padding: 7px 6px;
            vertical-align: top;
        }

        .items-table tr {
            page-break-inside: avoid;
        }

        .items-table .number {
            text-align: right;
            white-space: nowrap;
        }

        .items-table tfoot td {
            border-top: 2px solid #253b80;
            border-bottom: 0;
            background: #f7f9fc;
            font-size: 12px;
            font-weight: bold;
        }

        .note {
            margin-top: 12px;
            border-radius: 5px;
            background: #fff7e6;
            padding: 8px 10px;
            color: #704800;
        }

        .empty {
            margin-top: 25px;
            border: 1px dashed #c6ceda;
            padding: 30px;
            color: #697386;
            text-align: center;
        }
    </style>
</head>
<body>
@php
    $statusLabels = [
        'PENDING' => 'Menunggu Mitra',
        'APPROVED' => 'Disetujui Mitra',
        'REJECTED' => 'Ditolak Mitra',
        'PAID' => 'Lunas',
    ];
    $methodLabels = [
        'RESTOCK' => 'Stok diterima outlet',
        'SALES' => 'Bahan terpakai',
    ];
    $formatRupiah = fn ($value) => 'Rp '.number_format((float) $value, 0, ',', '.');
    $formatQty = fn ($value, $unit = '') => number_format((float) $value, 2, ',', '.').' '.$unit;
    $totalAmount = (float) $settlements->sum('total_amount');
@endphp

<div class="footer">
    <table style="width: 100%; border-collapse: collapse;">
        <tr>
            <td>Dibuat {{ $generatedAt->format('d/m/Y H:i') }} - {{ $documentOutletName ?? $outlet?->name }}</td>
            <td class="right">Halaman <span class="page-number"></span></td>
        </tr>
    </table>
</div>

<table class="brand-table">
    <tr>
        <td style="width: 52px;"><div class="brand-mark">K</div></td>
        <td>
            <h1 class="document-title">{{ $isSingle ? 'Detail Setoran Mitra' : 'Rekap Setoran Mitra' }}</h1>
            <div class="muted">{{ $documentOutletName ?? $outlet?->name }}</div>
        </td>
        <td class="right muted" style="width: 155px;">
            Dokumen Sistem<br>
            {{ $generatedAt->format('d F Y, H:i') }}
        </td>
    </tr>
</table>

<div class="report-period">
    <strong>Periode laporan:</strong>
    {{ $reportStart->format('d/m/Y') }} - {{ $reportEnd->format('d/m/Y') }}
    <span class="muted"> | Setoran yang periode aktivitasnya bersinggungan dengan rentang ini.</span>
</div>

@if (! $isSingle)
    <table class="summary-table">
        <tr>
            <td>
                <div class="summary-label">Jumlah Setoran</div>
                <div class="summary-value">{{ $settlements->count() }}</div>
            </td>
            <td>
                <div class="summary-label">Total Nilai</div>
                <div class="summary-value">{{ $formatRupiah($totalAmount) }}</div>
            </td>
            <td>
                <div class="summary-label">Menunggu</div>
                <div class="summary-value">{{ $settlements->where('status', 'PENDING')->count() }}</div>
            </td>
            <td>
                <div class="summary-label">Disetujui</div>
                <div class="summary-value">{{ $settlements->where('status', 'APPROVED')->count() }}</div>
            </td>
            <td>
                <div class="summary-label">Lunas</div>
                <div class="summary-value">{{ $settlements->where('status', 'PAID')->count() }}</div>
            </td>
        </tr>
    </table>
@endif

@forelse ($settlements as $settlement)
    @php
        $items = collect($settlement->receipt_data ?? []);
        $statusClass = strtolower($settlement->status);
        $isValidated = in_array($settlement->status, ['APPROVED', 'REJECTED', 'PAID'], true);
    @endphp

    <section class="settlement {{ ! $isSingle && ! $loop->first ? 'new-page' : '' }}">
        <table style="width: 100%; border-collapse: collapse;">
            <tr>
                <td>
                    <div class="settlement-heading">
                        <h2>{{ $settlement->mitra?->display_name ?: 'Mitra' }}</h2>
                        <div class="muted">ID {{ $settlement->id }}</div>
                    </div>
                </td>
                <td class="right">
                    <span class="status status-{{ $statusClass }}">{{ $statusLabels[$settlement->status] ?? $settlement->status }}</span>
                </td>
            </tr>
        </table>

        <table class="meta-table">
            <tr>
                <td>
                    <div class="meta-label">Periode Aktivitas</div>
                    <strong>{{ $settlement->period_start->format('d/m/Y') }} - {{ $settlement->period_end->format('d/m/Y') }}</strong>
                </td>
                <td>
                    <div class="meta-label">Dasar Perhitungan</div>
                    <strong>{{ $methodLabels[$settlement->calculation_method] ?? $settlement->calculation_method }}</strong>
                </td>
            </tr>
            <tr>
                <td>
                    <div class="meta-label">Tanggal Pengajuan</div>
                    <strong>{{ $settlement->created_at->format('d/m/Y H:i') }}</strong>
                </td>
                <td>
                    <div class="meta-label">Total Setoran</div>
                    <strong style="color: #253b80; font-size: 13px;">{{ $formatRupiah($settlement->total_amount) }}</strong>
                </td>
            </tr>
        </table>

        <div class="section-title">Alur Setoran</div>
        <table class="timeline-table">
            <tr>
                <td class="done">
                    <strong>1. Diajukan Owner</strong><br>
                    <span class="muted">{{ $settlement->created_at->format('d/m/Y H:i') }}</span>
                </td>
                <td class="{{ $settlement->status === 'REJECTED' ? 'rejected' : ($isValidated ? 'done' : '') }}">
                    <strong>2. {{ $settlement->status === 'REJECTED' ? 'Ditolak Mitra' : 'Validasi Mitra' }}</strong><br>
                    <span class="muted">
                        {{ $settlement->validated_at ? $settlement->validated_at->format('d/m/Y H:i') : 'Belum divalidasi' }}
                        {{ $settlement->validator ? ' oleh '.$settlement->validator->display_name : '' }}
                    </span>
                </td>
                <td class="{{ $settlement->status === 'PAID' ? 'done' : '' }}">
                    <strong>3. Pembayaran</strong><br>
                    <span class="muted">
                        {{ $settlement->paid_at ? $settlement->paid_at->format('d/m/Y H:i') : 'Belum dibayar' }}
                        {{ $settlement->payer ? ' oleh '.$settlement->payer->display_name : '' }}
                    </span>
                </td>
            </tr>
        </table>

        <div class="section-title">Rincian Bahan</div>
        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 34%;">Bahan</th>
                    <th style="width: 24%;">Harga Dasar</th>
                    <th class="number" style="width: 20%;">Jumlah</th>
                    <th class="number" style="width: 22%;">Subtotal</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($items as $item)
                    <tr>
                        <td>
                            <strong>{{ $item['name'] ?? 'Bahan' }}</strong>
                            <div style="margin-top: 3px; color: #253b80; font-size: 8px; font-weight: bold;">
                                Outlet: {{ $item['outlet_name'] ?? $outlet?->name ?? '-' }}
                            </div>
                            @if ($settlement->calculation_method === 'SALES')
                                <div class="muted" style="margin-top: 3px; font-size: 8px;">
                                    Terjual {{ $formatQty($item['sold_qty'] ?? 0, $item['unit_name'] ?? '') }}
                                    | Waste {{ $formatQty($item['waste_qty'] ?? 0, $item['unit_name'] ?? '') }}
                                    @if ((float) ($item['personal_use_qty'] ?? 0) > 0)
                                        | Pribadi {{ $formatQty($item['personal_use_qty'], $item['unit_name'] ?? '') }}
                                    @endif
                                </div>
                            @endif
                        </td>
                        <td>
                            {{ $formatRupiah($item['restock_price'] ?? 0) }} /
                            {{ $formatQty($item['min_restock_qty'] ?? 1, $item['unit_name'] ?? '') }}
                        </td>
                        <td class="number">{{ $formatQty($item['calculated_qty'] ?? 0, $item['unit_name'] ?? '') }}</td>
                        <td class="number"><strong>{{ $formatRupiah($item['subtotal'] ?? 0) }}</strong></td>
                    </tr>
                @endforeach
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3" class="right">Total Setoran</td>
                    <td class="number" style="color: #253b80;">{{ $formatRupiah($settlement->total_amount) }}</td>
                </tr>
            </tfoot>
        </table>

        @if ($settlement->validation_note)
            <div class="note"><strong>Catatan validasi mitra:</strong> {{ $settlement->validation_note }}</div>
        @endif
    </section>
@empty
    <div class="empty">Tidak ada setoran pada periode dan filter yang dipilih.</div>
@endforelse
</body>
</html>
