# Dokumentasi ERP Karsa Canvas

> **Versi**: 1.0 · **Stack**: Laravel 11 + Inertia.js + React + SQLite/MySQL · **PWA**: Ya

---

## Daftar Isi

1. [Gambaran Umum](#1-gambaran-umum)
2. [Fitur & Modul](#2-fitur--modul)
3. [Role & Hak Akses](#3-role--hak-akses)
4. [Instalasi Lokal](#4-instalasi-lokal)
5. [Konfigurasi `.env`](#5-konfigurasi-env)
6. [Deploy ke cPanel / Shared Hosting](#6-deploy-ke-cpanel--shared-hosting)
7. [Demo Publik](#7-demo-publik)
8. [Struktur Proyek](#8-struktur-proyek)
9. [Alur Kerja Harian](#9-alur-kerja-harian)
10. [FAQ](#10-faq)

---

## 1. Gambaran Umum

**ERP Karsa Canvas** adalah sistem manajemen operasional outlet yang dirancang khusus untuk bisnis F&B (kafe, warung, restoran kecil) dengan model kepemilikan multi-outlet dan mitra. Sistem ini dapat diakses melalui browser sebagai **Progressive Web App (PWA)** sehingga bisa di-install di ponsel tanpa perlu App Store.

### Teknologi

| Komponen | Teknologi |
|----------|-----------|
| Backend  | Laravel 11 (PHP 8.2+) |
| Frontend | React 18 + Inertia.js |
| Styling  | Tailwind CSS |
| Database | SQLite (lokal) / MySQL (produksi) |
| Auth     | Laravel Sanctum + Session |
| PWA      | Service Worker + Web Manifest |

---

## 2. Fitur & Modul

### 🧾 Operasional Harian

#### Kasir (`/cashier`)
- Tampilan menu produk berbasis kategori
- Input transaksi tunai (CASH) dan non-tunai (QRIS)
- Hitung kembalian otomatis
- Cetak/simpan struk digital
- Pembayaran hutang pelanggan

#### Shift (`/shifts`)
- Buka shift dengan modal kas awal
- Pantau total penjualan CASH & QRIS real-time
- Tutup shift: input kas aktual, selisih otomatis dihitung
- Riwayat dan detail setiap shift
- Edit shift oleh OWNER (koreksi selisih)

#### Struk / Riwayat Transaksi (`/receipts`)
- Daftar semua transaksi per outlet
- Filter tanggal, metode bayar, status
- Batalkan transaksi (dengan alasan)
- Edit transaksi oleh OWNER

#### Pengeluaran / Petty Cash (`/expenses`)
- Catat pengeluaran kas kecil per kategori
- Pembayaran CASH atau QRIS
- Filter per periode
- Edit dan hapus (OWNER)

---

### 📦 Inventaris

#### Produk (`/products`)
- Kelola daftar produk aktif/nonaktif
- Kategori bebas (Makanan, Minuman, dll.)
- Harga jual dan HPP (Harga Pokok Produksi)
- Foto produk (opsional)
- Grup tampilan (display group)

#### Biaya Produk / HPP (`/product-costs`)
- Hitung HPP berdasarkan bahan baku + konversi stok
- Dua mode: **HPP Tetap** atau **HPP Komponen** (otomatis dari stok)
- Lihat margin keuntungan per produk

#### Stok Bahan Baku (`/stock`)
- Kelola item stok dengan satuan fleksibel (gram, ml, butir, dll.)
- Tambah stok dengan catat supplier
- Konversi bahan ke produk (resep)
- Alert stok minimum
- Transfer stok dari gudang (warehouse)
- Update harga beli mitra

#### Audit Stok (`/stock-audit`)
- Hitung stok fisik vs sistem
- Catat selisih dengan keterangan
- Riwayat audit per periode

#### Waste Log (`/waste`)
- Catat pembuangan/kerusakan bahan baku
- Alasan waste (expired, tumpah, rusak, dll.)
- Laporan waste per periode

#### Supplier (`/suppliers`)
- Kelola daftar supplier
- Nama, nomor telepon, alamat
- Relasi ke item stok

---

### 💰 Keuangan & Laporan

#### Laporan (`/reports`)
- **Laporan Harian**: Ringkasan penjualan per hari
- **E-Settlement**: Rekonsiliasi penjualan QRIS
- Export laporan ke PDF

#### Keuangan (`/finance`)
- Pantau arus kas masuk dan keluar
- Penarikan kas oleh OWNER
- Snapshot saldo per periode

#### Owner Finance / Bagi Hasil (`/owner-finance`)
- Kelola batch bagi hasil antar partner
- Catat item keuangan: pemasukan, pengeluaran operasional, biaya modal
- Posting batch untuk finalisasi

---

### 👥 SDM & Mitra

#### Payroll / Gaji Pegawai (`/payroll`)
- Hitung gaji berdasarkan shift yang tercatat
- Dua metode: **Bulanan tetap** atau **Harian** (rate per hari × hari kerja)
- Bonus dan potongan manual
- Tandai sebagai lunas
- Snapshot data shift untuk audit

#### Modal Partner / Investasi (`/investments`)
- PARTNER mengajukan permintaan modal
- OWNER approve atau tolak
- Pantau status investasi

#### Setoran Mitra (`/settlements`)
- Catat setoran bahan dari mitra ke outlet
- Validasi oleh mitra
- Pembayaran setoran
- Export PDF

#### Laporan Mitra (`/mitra-reports`)
- Laporan khusus untuk user MITRA
- Ringkasan stok dan pemakaian

---

### ⚙️ Pengaturan

#### Outlet (`/outlets`)
- Kelola daftar outlet
- Nama, alamat, telepon, logo

#### Pengguna (`/users`)
- Tambah/edit/hapus pengguna
- Atur role dan outlet akses
- Override fitur per pengguna
- Aktif/nonaktifkan akun

#### Profil (`/profile`)
- Edit nama tampilan
- Ganti password

#### Owner Dashboard (`/owner`)
- Ringkasan multi-outlet khusus OWNER

---

## 3. Role & Hak Akses

| Fitur | OWNER | STAFF | MITRA | PARTNER |
|-------|:-----:|:-----:|:-----:|:-------:|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Kasir | ✅ | ✅ | ❌ | ❌ |
| Shift | ✅ | ✅ | ❌ | ❌ |
| Struk | ✅ | ✅ | ⚙️* | ❌ |
| Produk | ✅ | ✅ | ❌ | ❌ |
| Biaya Produk | ✅ | ❌ | ❌ | ❌ |
| Stok | ✅ | ✅ | ✅ | ❌ |
| Audit Stok | ✅ | ✅ | ❌ | ❌ |
| Waste | ✅ | ✅ | ❌ | ❌ |
| Supplier | ✅ | ❌ | ❌ | ❌ |
| Pengeluaran | ✅ | ❌ | ❌ | ❌ |
| Keuangan | ✅ | ❌ | ❌ | ❌ |
| Laporan | ✅ | ❌ | ❌ | ❌ |
| Laporan Mitra | ❌ | ❌ | ✅ | ❌ |
| Setoran Mitra | ✅ | ❌ | ❌ | ❌ |
| Payroll | ✅ | ❌ | ❌ | ❌ |
| Modal Partner | ❌ | ❌ | ❌ | ✅ |
| Bagi Hasil | ✅ | ❌ | ❌ | ✅ |
| Outlet | ✅ | ❌ | ❌ | ❌ |
| Pengguna | ✅ | ❌ | ❌ | ❌ |

> **⚙️\*** Akses struk untuk MITRA dapat diaktifkan per-user via `mitra_can_view_sales`.
>
> Hak akses STAFF dapat dikustomisasi per-user menggunakan `feature_overrides` di tabel `users`.

---

## 4. Instalasi Lokal

### Prasyarat
- PHP 8.2+
- Composer 2.x
- Node.js 18+ & npm
- SQLite (sudah termasuk di PHP biasanya)

### Langkah

```bash
# 1. Clone & masuk ke direktori
git clone <repo-url>
cd erp-platform/backend

# 2. Install dependency PHP
composer install

# 3. Salin dan konfigurasi .env
cp .env.example .env
php artisan key:generate

# 4. Buat database & jalankan migrasi
touch database/database.sqlite
php artisan migrate

# 5. Isi data awal (production)
php artisan db:seed
# atau untuk demo:
# Ubah SEED_DEMO=true di .env terlebih dahulu
# php artisan db:seed

# 6. Install dependency frontend
npm install

# 7. Build atau jalankan dev server
npm run dev        # development (hot reload)
# npm run build    # production build

# 8. Jalankan Laravel
php artisan serve
```

Aplikasi akan tersedia di: `http://localhost:8000`

---

## 5. Konfigurasi `.env`

### Variabel Penting

```env
APP_NAME="ERP Karsa"
APP_ENV=production          # local | production
APP_KEY=                    # generate dengan php artisan key:generate
APP_DEBUG=false             # false di production
APP_URL=https://domain.com

# Database (SQLite untuk development, MySQL untuk production)
DB_CONNECTION=sqlite
# DB_CONNECTION=mysql
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_DATABASE=nama_database
# DB_USERNAME=user
# DB_PASSWORD=password

# Seeder
SEED_OWNER_EMAIL=owner@karsa.local
SEED_OWNER_PASSWORD=Owner123!

# Mode Demo (opsional — untuk server demo publik)
SEED_DEMO=false
# Jika true: gunakan DemoSeeder, reset otomatis tiap hari jam 03:00 WIB
# Kredensial demo default: demo@karsa.id / Demo123!
```

---

## 6. Deploy ke cPanel / Shared Hosting

Lihat panduan lengkap di [`DEPLOY-LARAVEL-CPANEL.md`](./DEPLOY-LARAVEL-CPANEL.md) dan [`DEPLOYMENT_CPANEL.md`](./DEPLOYMENT_CPANEL.md).

### Ringkasan Deploy

```bash
# 1. Upload file ke server (via Git atau FTP)
# 2. SSH ke server, masuk ke direktori proyek
composer install --no-dev --optimize-autoloader

# 3. Build frontend
npm ci && npm run build

# 4. Konfigurasi .env (production)
cp .env.example .env
# Edit .env: APP_ENV=production, APP_DEBUG=false, DB_*, APP_URL

# 5. Migrate & seed
php artisan migrate --force
php artisan db:seed --force

# 6. Optimize
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 7. Storage link
php artisan storage:link
```

### Cron Job (wajib untuk scheduler)

Tambahkan di cPanel → Cron Jobs:

```
* * * * * cd /path/to/project && php artisan schedule:run >> /dev/null 2>&1
```

---

## 7. Demo Publik

Demo ini memungkinkan calon pengguna mencoba semua fitur ERP secara langsung.

### Setup Server Demo

```bash
# 1. Deploy seperti biasa
# 2. Di .env server demo:
APP_ENV=production
SEED_DEMO=true
SEED_OWNER_EMAIL=demo@karsa.id
SEED_OWNER_PASSWORD=Demo123!

# 3. Migrate & seed demo
php artisan migrate:fresh --force
php artisan db:seed --force

# 4. Pastikan cron aktif (untuk reset otomatis)
# * * * * * cd /path && php artisan schedule:run >> /dev/null 2>&1
```

### Kredensial Akun Demo

| Role  | Email | Password |
|-------|-------|----------|
| OWNER | `demo@karsa.id` | `Demo123!` |

### Data yang Tersedia di Demo

| Data | Jumlah |
|------|--------|
| Outlet | 1 (Kafe Karsa Demo) |
| Produk | 15 (makanan & minuman) |
| Stok Bahan | 10 item |
| Supplier | 1 |
| Transaksi | ~400–600 (30 hari terakhir) |
| Shift | 61 (2 shift/hari × 30 hari + 1 shift aktif) |
| Pengeluaran | ~20–30 catatan |
| Staff | 2 akun (Andi Susanto, Rini Wulandari) |
| Payroll | 2 record bulan lalu |

### Reset Manual

```bash
php artisan demo:reset --force
```

### Reset Otomatis

Database demo direset **setiap hari pukul 03:00 WIB** secara otomatis melalui Laravel Scheduler (jika cron aktif). Semua perubahan yang dilakukan oleh pengunjung akan hilang setelah reset.

---

## 8. Struktur Proyek

```
backend/
├── app/
│   ├── Console/Commands/
│   │   └── DemoReset.php          ← Command reset demo
│   ├── Http/
│   │   ├── Controllers/           ← Semua controller
│   │   └── Middleware/
│   │       └── EnsureOutletSelected.php
│   ├── Models/                    ← Eloquent models
│   └── Support/
│       └── NavPermission.php      ← Logika hak akses navigasi
├── database/
│   ├── migrations/                ← Skema database
│   └── seeders/
│       ├── DatabaseSeeder.php     ← Entry point seeder
│       ├── ErpSeeder.php          ← Seeder production
│       └── DemoSeeder.php         ← Seeder demo publik
├── resources/
│   ├── css/                       ← Stylesheet
│   └── js/
│       ├── Components/            ← Komponen UI reusable
│       ├── Layouts/               ← Layout halaman
│       └── Pages/                 ← Halaman Inertia (React)
│           ├── Auth/              ← Login, Register
│           ├── Cashier/           ← Kasir
│           ├── Dashboard.jsx      ← Dashboard
│           ├── Finance/           ← Keuangan
│           ├── Payroll/           ← Gaji pegawai
│           ├── Products/          ← Produk
│           ├── Reports/           ← Laporan
│           ├── Shifts/            ← Shift
│           ├── Stock/             ← Stok
│           └── ...
├── routes/
│   ├── web.php                    ← Semua route web
│   ├── auth.php                   ← Route autentikasi
│   └── console.php                ← Scheduled commands
└── .env.example                   ← Template konfigurasi
```

---

## 9. Alur Kerja Harian

### Staff (Kasir)

```
Mulai Shift → Buka Shift (input kas awal)
    ↓
Proses Transaksi (kasir)
    ↓
Catat Pengeluaran (jika ada)
    ↓
Catat Waste (jika ada pembuangan)
    ↓
Tutup Shift (input kas aktual)
```

### Owner (Harian)

```
Cek Dashboard → Lihat ringkasan penjualan hari ini
    ↓
Review Shift yang ditutup → Koreksi jika ada selisih
    ↓
Cek Laporan → Analisis tren penjualan
    ↓
Cek Stok → Isi ulang jika mendekati minimum
    ↓
Proses Payroll (bulanan) → Bayar gaji staff
```

---

## 10. FAQ

**Q: Apakah bisa dipakai di beberapa outlet sekaligus?**
A: Ya. OWNER bisa mengelola semua outlet dan berpindah outlet melalui dropdown di header.

**Q: Apakah ada fitur offline?**
A: Sebagian. Aplikasi adalah PWA yang bisa di-install, namun fitur offline penuh memerlukan koneksi untuk sinkronisasi data.

**Q: Bagaimana cara ganti password?**
A: Masuk ke menu **Profil** (`/profile`) setelah login.

**Q: Apakah data demo bisa diedit?**
A: Ya, semua fitur bisa dicoba sepenuhnya. Data akan direset otomatis setiap hari pukul 03:00 WIB.

**Q: Apa perbedaan MITRA dan PARTNER?**
A: **MITRA** adalah mitra bisnis yang menyuplai bahan baku ke outlet. **PARTNER** adalah investor/pemilik saham yang memiliki hak atas bagi hasil keuntungan.

**Q: Apakah bisa menggunakan MySQL?**
A: Ya. Ubah `DB_CONNECTION=mysql` dan isi variabel `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` di `.env`.

**Q: Bagaimana cara menjalankan reset demo secara manual?**
A: Jalankan `php artisan demo:reset --force` dari direktori proyek.

---

*Dokumentasi ini ditulis untuk ERP Karsa Canvas. Untuk pertanyaan teknis, hubungi tim pengembang.*
