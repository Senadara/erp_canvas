<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>E-Settlement Keuangan</title>
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

        table {
            width: 100%;
            border-collapse: collapse;
        }

        .right {
            text-align: right;
        }

        .muted {
            color: #697386;
        }

        .brand-mark {
            width: 42px;
            height: 42px;
            border-radius: 6px;
            background: #253b80;
            color: #ffffff;
            font-size: 17px;
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

        .period {
            margin-top: 18px;
            border: 1px solid #dbe1ea;
            border-radius: 6px;
            background: #f7f9fc;
            padding: 11px 13px;
        }

        .summary-table {
            margin: 14px 0 18px;
        }

        .summary-table td {
            width: 25%;
            border: 1px solid #dbe1ea;
            padding: 10px;
            vertical-align: top;
        }

        .summary-table.five-col td {
            width: 20%;
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

        .positive {
            color: #166534;
        }

        .negative {
            color: #be123c;
        }

        .private-money {
            color: #92400e;
        }

        .section-title {
            margin: 15px 0 7px;
            border-left: 4px solid #253b80;
            padding-left: 9px;
            color: #3e4c62;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
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

        .badge {
            display: inline-block;
            border-radius: 10px;
            padding: 3px 7px;
            font-size: 8px;
            font-weight: bold;
        }

        .badge-cash {
            background: #dcfce7;
            color: #166534;
        }

        .badge-qris {
            background: #dbeafe;
            color: #1d4ed8;
        }

        .badge-private {
            background: #fef3c7;
            color: #92400e;
        }

        .empty {
            border: 1px dashed #c6ceda;
            padding: 18px;
            color: #697386;
            text-align: center;
        }
    </style>
</head>
<body>
@php
    $summary = $report['summary'] ?? [];
    $categorySummary = collect($report['category_summary'] ?? []);
    $daily = collect($report['daily'] ?? []);
    $transactions = collect($report['transactions'] ?? []);
    $movements = collect($report['movements'] ?? []);
    $formatRupiah = fn ($value) => 'Rp '.number_format((float) $value, 0, ',', '.');
    $formatSignedRupiah = function ($value) use ($formatRupiah) {
        $amount = (float) $value;

        return $amount < 0 ? '- '.$formatRupiah(abs($amount)) : $formatRupiah($amount);
    };
    $formatDate = fn ($value) => $value ? \Carbon\Carbon::parse($value)->format('d/m/Y') : '-';
    $formatDateTime = fn ($value) => $value ? \Carbon\Carbon::parse($value)->format('d/m/Y H:i') : '-';
    $cashierMoneyInTotal = (float) ($summary['cash_sales'] ?? 0)
        + (float) ($summary['qris_sales'] ?? 0)
        + (float) ($summary['cash_in'] ?? 0)
        + (float) ($summary['qris_in'] ?? 0);
    $cashierMoneyOutTotal = (float) ($summary['cash_out'] ?? 0) + (float) ($summary['qris_out'] ?? 0);
    $ownerWithdrawalTotal = (float) ($summary['withdraw_cash'] ?? 0) + (float) ($summary['withdraw_qris'] ?? 0);
    $methodClass = fn ($method) => match ($method) {
        'QRIS' => 'badge-qris',
        'PRIVATE' => 'badge-private',
        default => 'badge-cash',
    };
@endphp

<div class="footer">
    <table>
        <tr>
            <td>Dibuat {{ $generatedAt->format('d/m/Y H:i') }} - {{ $outlet?->name ?? 'Semua Outlet' }}</td>
            <td class="right">Halaman <span class="page-number"></span></td>
        </tr>
    </table>
</div>

<table>
    <tr>
        <td style="width: 52px;"><div class="brand-mark">ES</div></td>
        <td>
            <h1 class="document-title">E-Settlement Keuangan</h1>
            <div class="muted">{{ $outlet?->name ?? 'Semua Outlet' }}</div>
        </td>
        <td class="right muted" style="width: 155px;">
            Dokumen Sistem<br>
            {{ $generatedAt->format('d/m/Y H:i') }}
        </td>
    </tr>
</table>

<div class="period">
    <strong>Periode laporan:</strong>
    {{ $formatDate($report['start_date'] ?? null) }} - {{ $formatDate($report['end_date'] ?? null) }}
    <span class="muted"> | Mencakup penjualan lunas, top up, pengeluaran, restock, penarikan, dan mutasi lain.</span>
</div>

<table class="summary-table">
    <tr>
        <td>
            <div class="summary-label">Total Penjualan</div>
            <div class="summary-value">{{ $formatRupiah($summary['sales_total'] ?? 0) }}</div>
            <div class="muted">{{ number_format((float) ($summary['transaction_count'] ?? 0), 0, ',', '.') }} transaksi lunas</div>
        </td>
        <td>
            <div class="summary-label">Cash Net</div>
            <div class="summary-value {{ (float) ($summary['cash_net'] ?? 0) < 0 ? 'negative' : 'positive' }}">
                {{ $formatSignedRupiah($summary['cash_net'] ?? 0) }}
            </div>
            <div class="muted">Sales {{ $formatRupiah($summary['cash_sales'] ?? 0) }} | keluar {{ $formatRupiah($summary['cash_out'] ?? 0) }}</div>
        </td>
        <td>
            <div class="summary-label">QRIS Net</div>
            <div class="summary-value {{ (float) ($summary['qris_net'] ?? 0) < 0 ? 'negative' : 'positive' }}">
                {{ $formatSignedRupiah($summary['qris_net'] ?? 0) }}
            </div>
            <div class="muted">Sales {{ $formatRupiah($summary['qris_sales'] ?? 0) }} | keluar {{ $formatRupiah($summary['qris_out'] ?? 0) }}</div>
        </td>
        <td>
            <div class="summary-label">Saldo Settlement</div>
            <div class="summary-value {{ (float) ($summary['settlement_net'] ?? 0) < 0 ? 'negative' : '' }}">
                {{ $formatSignedRupiah($summary['settlement_net'] ?? 0) }}
            </div>
            <div class="muted">Cash net + QRIS net, tanpa uang pribadi.</div>
        </td>
    </tr>
</table>

<table class="summary-table five-col">
    <tr>
        <td>
            <div class="summary-label">Uang Masuk Kas/QRIS</div>
            <div class="summary-value">{{ $formatRupiah($cashierMoneyInTotal) }}</div>
            <div class="muted">Tanpa uang pribadi</div>
        </td>
        <td>
            <div class="summary-label">Uang Keluar Kas/QRIS</div>
            <div class="summary-value negative">{{ $formatRupiah($cashierMoneyOutTotal) }}</div>
            <div class="muted">Cash dan QRIS saja</div>
        </td>
        <td>
            <div class="summary-label">Uang Pribadi</div>
            <div class="summary-value private-money">{{ $formatRupiah($summary['outside_out'] ?? 0) }}</div>
            <div class="muted">Masuk/top up {{ $formatRupiah($summary['outside_in'] ?? 0) }}</div>
        </td>
        <td>
            <div class="summary-label">Top Up Kasir</div>
            <div class="summary-value">{{ $formatRupiah($summary['cashier_topups'] ?? 0) }}</div>
            <div class="muted">Laci {{ $formatRupiah($summary['drawer_cashier_topups'] ?? 0) }} | luar {{ $formatRupiah($summary['outside_cashier_topups'] ?? 0) }}</div>
        </td>
        <td>
            <div class="summary-label">Penarikan Owner</div>
            <div class="summary-value">{{ $formatRupiah($ownerWithdrawalTotal) }}</div>
            <div class="muted">Cash {{ $formatRupiah($summary['withdraw_cash'] ?? 0) }} | QRIS {{ $formatRupiah($summary['withdraw_qris'] ?? 0) }}</div>
        </td>
    </tr>
</table>

<div class="section-title">Kategori Keuangan</div>
@if ($categorySummary->isNotEmpty())
    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 29%;">Kategori</th>
                <th style="width: 13%;">Metode</th>
                <th class="number" style="width: 17%;">Masuk</th>
                <th class="number" style="width: 17%;">Keluar</th>
                <th class="number" style="width: 17%;">Net</th>
                <th class="number" style="width: 7%;">Jumlah</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($categorySummary as $row)
                <tr>
                    <td><strong>{{ $row['category'] ?? '-' }}</strong></td>
                    <td><span class="badge {{ $methodClass($row['payment_method'] ?? 'CASH') }}">{{ $row['payment_method'] ?? 'CASH' }}</span></td>
                    <td class="number {{ ($row['payment_method'] ?? null) === 'PRIVATE' ? 'private-money' : 'positive' }}">{{ $formatRupiah($row['total_in'] ?? 0) }}</td>
                    <td class="number {{ ($row['payment_method'] ?? null) === 'PRIVATE' ? 'private-money' : 'negative' }}">{{ $formatRupiah($row['total_out'] ?? 0) }}</td>
                    <td class="number {{ ($row['payment_method'] ?? null) === 'PRIVATE' ? 'private-money' : ((float) ($row['net'] ?? 0) < 0 ? 'negative' : 'positive') }}"><strong>{{ $formatSignedRupiah($row['net'] ?? 0) }}</strong></td>
                    <td class="number">{{ number_format((float) ($row['count'] ?? 0), 0, ',', '.') }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
@else
    <div class="empty">Belum ada kategori keuangan pada periode ini.</div>
@endif

<div class="section-title">Rekap Harian</div>
@if ($daily->isNotEmpty())
    <table class="items-table">
        <thead>
            <tr>
                <th>Tanggal</th>
                <th class="number">Penjualan</th>
                <th class="number">Cash Sales</th>
                <th class="number">QRIS Sales</th>
                <th class="number">Cash Keluar</th>
                <th class="number">QRIS Keluar</th>
                <th class="number">Net Cash</th>
                <th class="number">Net QRIS</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($daily as $day)
                <tr>
                    <td><strong>{{ $formatDate($day['date'] ?? null) }}</strong></td>
                    <td class="number">{{ $formatRupiah($day['sales_total'] ?? 0) }}</td>
                    <td class="number">{{ $formatRupiah($day['cash_sales'] ?? 0) }}</td>
                    <td class="number">{{ $formatRupiah($day['qris_sales'] ?? 0) }}</td>
                    <td class="number negative">{{ $formatRupiah($day['cash_out'] ?? 0) }}</td>
                    <td class="number negative">{{ $formatRupiah($day['qris_out'] ?? 0) }}</td>
                    <td class="number {{ (float) ($day['net_cash'] ?? 0) < 0 ? 'negative' : 'positive' }}">{{ $formatSignedRupiah($day['net_cash'] ?? 0) }}</td>
                    <td class="number {{ (float) ($day['net_qris'] ?? 0) < 0 ? 'negative' : 'positive' }}">{{ $formatSignedRupiah($day['net_qris'] ?? 0) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
@else
    <div class="empty">Belum ada rekap harian pada periode ini.</div>
@endif

<div class="section-title">Penjualan Lunas</div>
@if ($transactions->isNotEmpty())
    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 26%;">Invoice</th>
                <th style="width: 24%;">Waktu Lunas</th>
                <th style="width: 14%;">Metode</th>
                <th class="number" style="width: 18%;">Nominal</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($transactions as $transaction)
                <tr>
                    <td><strong>{{ $transaction['invoice_number'] ?? '-' }}</strong></td>
                    <td>{{ $formatDateTime($transaction['paid_at'] ?? null) }}</td>
                    <td><span class="badge {{ $methodClass($transaction['payment_method'] ?? 'CASH') }}">{{ $transaction['payment_method'] ?? 'CASH' }}</span></td>
                    <td class="number"><strong>{{ $formatRupiah($transaction['amount'] ?? 0) }}</strong></td>
                </tr>
            @endforeach
        </tbody>
    </table>
@else
    <div class="empty">Belum ada transaksi lunas pada periode ini.</div>
@endif

<div class="section-title">Uang Keluar Masuk</div>
@if ($movements->isNotEmpty())
    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 24%;">Kategori</th>
                <th style="width: 24%;">Waktu</th>
                <th style="width: 13%;">Metode</th>
                <th style="width: 12%;">Arus</th>
                <th class="number" style="width: 14%;">Nominal</th>
                <th style="width: 13%;">Catatan</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($movements as $movement)
                @php
                    $incoming = ($movement['cash_flow'] ?? 'OUT') === 'IN';
                    $privateMoney = ($movement['payment_method'] ?? null) === 'PRIVATE';
                @endphp
                <tr>
                    <td><strong>{{ $movement['category'] ?? '-' }}</strong></td>
                    <td>{{ $formatDateTime($movement['created_at'] ?? null) }}</td>
                    <td><span class="badge {{ $methodClass($movement['payment_method'] ?? 'CASH') }}">{{ $movement['payment_method'] ?? 'CASH' }}</span></td>
                    <td>{{ $incoming ? 'Masuk' : 'Keluar' }}</td>
                    <td class="number {{ $privateMoney ? 'private-money' : ($incoming ? 'positive' : 'negative') }}">
                        <strong>{{ $privateMoney ? '' : ($incoming ? '+ ' : '- ') }}{{ $formatRupiah($movement['amount'] ?? 0) }}</strong>
                    </td>
                    <td class="muted">{{ $movement['description'] ?? '-' }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
@else
    <div class="empty">Belum ada mutasi uang pada periode ini.</div>
@endif
</body>
</html>
