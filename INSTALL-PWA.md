# Panduan Instalasi ERP Karsa (PWA) di HP Kasir

Aplikasi ERP Karsa menggunakan teknologi Progressive Web App (PWA). Ini berarti Anda **tidak perlu mendownload aplikasi dari Play Store atau App Store**, melainkan menginstalnya langsung dari browser.

Dengan PWA, aplikasi dapat:
1. Muncul di *homescreen* (layar utama) HP Anda.
2. Membuka layar penuh seperti aplikasi native biasa.
3. Melakukan sinkronisasi data secara otomatis dan lebih stabil saat jaringan kurang baik.

---

## 📱 Untuk Pengguna Android (Chrome / Samsung Internet)

1. **Buka Browser:** Buka Google Chrome di HP Android Anda.
2. **Kunjungi Link:** Ketikkan alamat sistem ERP, misalnya `https://erp.domain.com`.
3. **Login:** Masuk menggunakan email dan password akun Kasir / Staff Anda.
4. **Popup Install:** 
   - Biasanya Chrome akan memunculkan notifikasi kecil di bawah layar bertuliskan **"Add ERP Karsa to Home Screen"** atau **"Install App"**.
   - Klik tombol tersebut.
5. **Cara Manual (Jika popup tidak muncul):**
   - Klik ikon titik tiga (⋮) di pojok kanan atas Chrome.
   - Pilih menu **"Install app"** atau **"Add to Home screen"**.
   - Klik konfirmasi "Install" / "Tambahkan".
6. **Selesai:** Kembali ke layar utama (homescreen) HP Anda. Ikon aplikasi ERP Karsa akan muncul di sana. Anda bebas menutup browser Chrome dan membuka aplikasi lewat ikon tersebut.

---

## 🍏 Untuk Pengguna iPhone / iPad (iOS Safari)

*Penting: Pada iOS, Anda **wajib** menggunakan browser bawaan Apple yaitu **Safari** untuk dapat menginstal PWA.*

1. **Buka Safari:** Kunjungi alamat sistem ERP (`https://erp.domain.com`).
2. **Login:** Masuk dengan akun Anda.
3. **Menu Share:** Di bagian bawah layar Safari, ketuk ikon **Share** (kotak dengan panah mengarah ke atas 📤).
4. **Add to Home Screen:** Gulir menu ke bawah lalu cari dan ketuk opsi **"Add to Home Screen"** (Tambahkan ke Layar Utama).
5. **Konfirmasi:** Di pojok kanan atas, ketuk **"Add"**.
6. **Selesai:** Ikon aplikasi ERP Karsa akan muncul di layar utama iOS Anda layaknya aplikasi biasa. 

---

## ⚡ Catatan Penggunaan Offline (Sinkronisasi)

Jika koneksi internet tiba-tiba terputus saat aplikasi PWA sedang terbuka di layar kasir:
*   Aplikasi **tidak akan error/putih** jika katalog produk telah dimuat sebelumnya.
*   Anda tetap bisa menekan tombol keranjang dan memilih barang.
*   Saat Anda klik "Bayar", data akan otomatis tersimpan dalam antrean lokal (Pending Sales).
*   Begitu internet kembali tersambung, sistem akan **secara otomatis** menyinkronkan (mengirim) data penjualan tertunda tersebut ke server di latar belakang. Anda tidak perlu melakukan refresh manual!
