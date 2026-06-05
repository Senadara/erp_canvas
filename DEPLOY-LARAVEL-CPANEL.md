# Panduan Deploy ERP Laravel ke cPanel (Shared Hosting)

Panduan ini ditujukan untuk men-deploy ERP Karsa (Laravel 12 + Inertia React + PWA) ke cPanel (LiteSpeed / Apache) **tanpa** membutuhkan akses terminal root atau Node.js / Passenger Node di server production.

## Prasyarat

1. **Akses cPanel** dengan dukungan PHP 8.2+.
2. **Database MySQL/MariaDB**.
3. **Domain/Subdomain** dengan SSL aktif (PWA mewajibkan HTTPS).

## Langkah 1: Persiapan Build Lokal (Di Komputer Anda)

Sebelum mengunggah, kita perlu mem-build aset frontend React dan mengunduh dependensi PHP.

1. Buka terminal di folder `erp-platform/backend`.
2. Jalankan instalasi dependensi PHP:
   ```bash
   composer install --optimize-autoloader --no-dev
   ```
3. Build aset frontend (Inertia React) dan PWA:
   ```bash
   npm ci
   npm run build
   ```
   *Proses ini akan menghasilkan file di dalam folder `public/build/`.*

## Langkah 2: Mengunggah File ke cPanel

1. Kompres (ZIP) seluruh folder `backend` **kecuali**:
   *   `node_modules/`
   *   `.git/`
   *   `tests/`
2. Di cPanel, buka **File Manager**.
3. Sangat disarankan untuk meletakkan file sistem Laravel di **luar** `public_html`.
   Misalnya, buat folder: `/home/username/erp_app/`.
4. Ekstrak file ZIP ke dalam `/home/username/erp_app/`.
5. Pindahkan isi dari folder `/home/username/erp_app/public/` ke direktori root web Anda (misalnya `/home/username/public_html/` atau `/home/username/erp.domain.com/`).

## Langkah 3: Penyesuaian Path di File `index.php`

Karena file `public` telah dipisah dari *core* Laravel, Anda harus memberi tahu `index.php` di mana letak aplikasinya.

Buka file `index.php` yang ada di public root (`public_html`), lalu ubah baris berikut:

```php
// Sesuaikan path ke vendor/autoload.php
require __DIR__.'/../erp_app/vendor/autoload.php';

// Sesuaikan path ke bootstrap/app.php
$app = require_once __DIR__.'/../erp_app/bootstrap/app.php';
```

## Langkah 4: Konfigurasi `.env`

1. Di dalam `/home/username/erp_app/`, salin `.env.example` menjadi `.env` (atau buat file baru).
2. Isi konfigurasi penting:
   ```env
   APP_NAME="ERP Karsa"
   APP_ENV=production
   APP_KEY=base64:xxx... (Generate jika kosong: php artisan key:generate lokal lalu copy)
   APP_DEBUG=false
   APP_URL=https://erp.domain.com

   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=nama_db_cpanel
   DB_USERNAME=user_db_cpanel
   DB_PASSWORD=password_db_cpanel

   SESSION_DRIVER=file
   SESSION_LIFETIME=120

   # Sanctum Auth untuk PWA API
   SANCTUM_STATEFUL_DOMAINS="erp.domain.com"
   ```

## Langkah 5: Database & Storage Link

Jika Anda tidak memiliki akses SSH di cPanel, Anda dapat memanfaatkan cron job atau membuat route sementara (segera hapus setelahnya) di `routes/web.php` untuk menjalankan perintah Artisan.

**Contoh Route Sementara (`routes/web.php`):**
```php
Route::get('/setup-artisan', function() {
    \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
    \Illuminate\Support\Facades\Artisan::call('storage:link');
    \Illuminate\Support\Facades\Artisan::call('optimize:clear');
    return 'Setup Selesai. Segera hapus route ini!';
});
```
*Akses `https://erp.domain.com/setup-artisan`, tunggu sampai muncul "Setup Selesai", lalu HAPUS route tersebut demi keamanan.*

## Langkah 6: Pengaturan Tambahan untuk PWA (Bypass Cache)

Jika menggunakan LiteSpeed, terkadang header ETag diblokir atau file *Service Worker* (`sw.js`) ter-cache terlalu lama. Tambahkan `.htaccess` di dalam public root:

```apache
<IfModule mod_rewrite.c>
    <IfModule mod_negotiation.c>
        Options -MultiViews -Indexes
    </IfModule>

    RewriteEngine On

    # Redirect Trailing Slashes...
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^(.*)/$ /$1 [L,R=301]

    # Handle Front Controller...
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^ index.php [L]
</IfModule>

# Jangan cache Service Worker dan Manifest
<FilesMatch "^(sw\.js|manifest\.webmanifest)$">
    Header set Cache-Control "no-store, no-cache, must-revalidate, max-age=0"
    Header set Pragma "no-cache"
</FilesMatch>
```

## Selesai!

Sistem ERP Anda sudah dapat diakses dan mendukung instalasi PWA di HP kasir tanpa memerlukan proses Node.js yang berjalan 24 jam.
