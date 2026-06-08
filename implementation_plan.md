# Perbaikan & Fitur Baru ERP Platform (Laravel Monolith)

Berdasarkan permintaan Anda, semua perbaikan dan pengembangan fitur baru akan dilakukan secara eksklusif di dalam **Project Laravel Inertia (React)** ini. Penggunaan Next.js (project `erp_cnvs` eksternal) **dibatalkan**. Project Laravel ini akan menjadi monolith mandiri yang mencakup API, Logic, dan Frontend (Inertia + React + Tailwind).

Berikut adalah penyesuaian rencana implementasi 8 poin pada arsitektur Laravel:

---

## Poin 1: Perbaiki Struk — Interaksi Detail Struk

**Masalah**: Di halaman Riwayat Transaksi (`Transactions/Index.jsx`), baris tabel belum memiliki interaksi untuk membuka detail struk (dialog pop-up).
**Solusi**:
- Membuat baris tabel transaksi dapat diklik untuk memunculkan modal dialog.
- Dialog menampilkan visualisasi struk lengkap seperti yang dicetak di Cashier (termasuk info pembayaran tunai/kembalian/QRIS).
- Tambahkan opsi "Cetak Ulang" di dalam dialog.

**File yang akan diubah**:
- `resources/js/Pages/Transactions/Index.jsx`

---

## Poin 2: Header Struk — Nama Outlet & Tanggal Valid

**Masalah**: Tanggal pada struk mungkin tidak sesuai dengan zona waktu Indonesia (WIB) jika dicetak, dan informasi outlet kurang lengkap (belum ada alamat & telepon).
**Solusi**:
- Pastikan semua waktu yang dicetak di struk (di Cashier maupun Cetak Ulang) diformat eksplisit ke `Asia/Jakarta`.
- Tambahkan informasi `address` dan `phone` dari outlet di header struk.

**File yang akan diubah**:
- `resources/js/Pages/Cashier/Index.jsx`
- `app/Http/Controllers/CashierController.php` (untuk load outlet details)

---

## Poin 3: Form Tambah Produk — Field Stok Awal

**Masalah**: Tidak ada fitur untuk menginput "Stok Awal" saat membuat produk baru berserta konversi bahan/stoknya.
**Solusi**:
- Pada `resources/js/Pages/Products/Index.jsx` (atau Form terkait), tambahkan input *Stok Awal* yang hanya muncul saat produk baru ditambahkan.
- Di `ProductController@store`, tangkap input stok awal, dan otomatis buat `RestockLog` serta tambahkan `current_stock_biji` pada item stok yang baru.

**File yang akan diubah**:
- `resources/js/Pages/Products/Index.jsx`
- `app/Http/Controllers/ProductController.php`

---

## Poin 4: Fix Error Laporan — Relationship `product` on `TransactionItem`

**Masalah**: Backend error `Call to undefined relationship [product] on model [App\Models\TransactionItem]` saat mencoba menarik laporan karena model Eloquent belum didefinisikan secara sempurna.
**Status**: **SELESAI**.
*Saya telah menambahkan method `product()` di model `TransactionItem` pada sesi sebelumnya.*

---

## Poin 5: Fitur Management Investasi

**Masalah**: Owner ingin tracking investasi (modal lot) dari user ke outlet tertentu.
**Solusi**:
- Buat model & migration `Investment` (`user_id`, `outlet_id`, `lots`, `lot_value`, `total_value`, `status`).
- Buat `InvestmentController` untuk CRUD dan approval.
- Tambahkan menu "Investasi" di Sidebar (`ErpLayout.jsx`).
- Buat halaman `resources/js/Pages/Investments/Index.jsx` yang menampilkan:
  - Ringkasan total investasi & lot untuk User biasa.
  - Tabel Admin (khusus Owner) untuk menyetujui, menolak, atau mencatat investasi.

**File baru & modifikasi**:
- `database/migrations/xxx_create_investments_table.php`
- `app/Models/Investment.php`
- `app/Http/Controllers/InvestmentController.php`
- `resources/js/Pages/Investments/Index.jsx`
- `routes/web.php`
- `resources/js/Layouts/ErpLayout.jsx`

---

## Poin 6: Auto-Logout Jam 4 Pagi

**Masalah**: Sistem harus melakukan auto-logout (menutup shift otomatis/keluar sesi) di jam 4 pagi untuk mencegah kecurangan transaksi lewat dari jam tutup.
**Solusi**:
- Di Laravel, lifetime session biasanya diatur di `config/session.php`. Namun untuk trigger *jam 4 pagi*, kita butuh custom middleware atau pengecekan frontend.
- **Frontend Approach**: Tambahkan `SessionGuard` (sebuah komponen global di `ErpLayout.jsx`) yang mengecek setiap menit. Jika waktu lokal menunjukkan pukul 04:00 - 05:59 WIB, paksa logout (panggil route `POST /logout`).

**File yang akan diubah**:
- `resources/js/Layouts/ErpLayout.jsx` (Tambahkan interval logic)

---

## Poin 7: Detail Informasi Setiap Shift

**Masalah**: Laporan riwayat shift kurang detail. Dibutuhkan informasi seperti durasi shift, rata-rata transaksi, transaksi belum lunas, dan breakdown kategori produk.
**Solusi**:
- Di `resources/js/Pages/Shifts/Index.jsx`, buat modal "Detail Shift" yang diperkaya.
- Controller `ShiftController` akan mengkalkulasi durasi, rata-rata nilai per-transaksi (omzet / jumlah nota lunas), dan data *unpaid* saat shift tersebut dipilih.

**File yang akan diubah**:
- `resources/js/Pages/Shifts/Index.jsx`
- `app/Http/Controllers/ShiftController.php`

---

## Poin 8: Improve Tampilan Dashboard, Owner, Laporan

**Sasaran**: Tampilan data dan grafik di halaman Dashboard, Dashboard Owner, dan Laporan harus lebih modern dan "Wow" (menggunakan gradien, micro-animations, glassmorphism, dll).
**Solusi**:
- Update file `Dashboard.jsx`, `Owner/Index.jsx`, `Reports/Index.jsx` dengan komponen Recharts modern (AreaChart dengan gradien warna).
- Berikan efek shadow halus, hover effect (scale), dan warna badge yang kontras di TailwindCSS.

**File yang akan diubah**:
- `resources/js/Pages/Dashboard.jsx`
- `resources/js/Pages/Owner/Index.jsx`
- `resources/js/Pages/Reports/Index.jsx`

---

## Verification Plan
1. Jalankan `npm run build` di dalam folder backend untuk memastikan tidak ada error pada JSX.
2. Tes seluruh flow secara manual di browser yang sedang berjalan via `php artisan serve` dan `npm run dev` (atau dari hasil build).
3. Buat transaksi, cek tampilan struk, lihat riwayat transaksi, buat produk baru dengan stok awal, lalu cek laporan dan grafik di halaman dashboard.

> [!IMPORTANT]
> Mohon konfirmasi apakah rancangan implementasi monolith Laravel Inertia ini sudah sepenuhnya sesuai dengan kebutuhan Anda. Saya siap melaksanakan eksekusi file-by-file jika disetujui.
