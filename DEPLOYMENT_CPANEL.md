# Panduan Deploy ke cPanel (Tanpa npm)

## Prasyarat
- Akun cPanel dengan akses SSH atau File Manager
- PHP 8.1 atau lebih baru
- MySQL/MariaDB database
- Composer (opsional, bisa install di cPanel)
- Akses ke komputer lokal dengan npm/node untuk build assets

---

## Langkah 1: Build Assets Secara Lokal

Karena cPanel tidak bisa menjalankan npm, kita perlu build assets secara lokal terlebih dahulu.

### Di komputer lokal Anda:

```bash
# Masuk ke direktori project
cd d:\Activity\Canvas\erp-platform\backend

# Install dependencies jika belum
npm install

# Build assets untuk production
npm run build
```

Setelah build selesai, folder `public/build` akan berisi semua assets yang sudah di-compile.

---

## Langkah 2: Persiapan Project untuk Upload

### 1. Buat file `.env` untuk production

Buat file `.env.production` atau copy dari `.env.example`:

```bash
cp .env.example .env.production
```

Edit file `.env.production`:

```env
APP_NAME="ERP Platform"
APP_ENV=production
APP_KEY=base64:YOUR_GENERATED_KEY_HERE
APP_DEBUG=false
APP_URL=https://namadomainanda.com

LOG_CHANNEL=stack
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=debug

DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=nama_database_cpanel
DB_USERNAME=username_cpanel
DB_PASSWORD=password_cpanel

BROADCAST_DRIVER=log
CACHE_DRIVER=file
FILESYSTEM_DISK=local
QUEUE_CONNECTION=sync
SESSION_DRIVER=file
SESSION_LIFETIME=120

MAIL_MAILER=smtp
MAIL_HOST=mailhog
MAIL_PORT=1025
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_ENCRYPTION=null
MAIL_FROM_ADDRESS="hello@example.com"
MAIL_FROM_NAME="${APP_NAME}"
```

### 2. Generate APP_KEY

```bash
php artisan key:generate
```

Copy the generated key ke file `.env.production`

### 3. Hapus file yang tidak perlu

Hapus file/folder berikut sebelum upload untuk menghemat space:

```bash
# Hapus node_modules (jika ada di upload)
rm -rf node_modules

# Hapus file development
rm .env
rm .env.example
rm phpunit.xml
rm README.md

# Hapus folder testing
rm -rf tests
rm -rf storage/logs/*.log
```

---

## Langkah 3: Upload ke cPanel

### Opsi A: Menggunakan File Manager cPanel

1. Login ke cPanel
2. Buka **File Manager**
3. Masuk ke folder `public_html` atau subdomain yang Anda inginkan
4. Upload semua file dari project lokal Anda (kecuali `node_modules` jika ada)
5. Extract jika upload dalam format zip

### Opsi B: Menggunakan Git Clone (Jika cPanel support Git)

1. Login ke cPanel
2. Buka **Terminal** atau gunakan SSH
3. Masuk ke folder yang diinginkan:

```bash
cd public_html  # atau subdomain folder
```

4. Clone repository:

```bash
git clone https://github.com/Senadara/erp_canvas.git .
```

5. Jika menggunakan git, Anda perlu build assets di server atau upload folder `public/build` secara manual.

---

## Langkah 4: Install PHP Dependencies di cPanel

### Opsi A: Menggunakan Terminal cPanel

1. Buka **Terminal** di cPanel
2. Masuk ke folder project:

```bash
cd public_html  # atau folder project Anda
```

3. Install Composer jika belum ada:

```bash
curl -sS https://getcomposer.org/installer | php
php composer.phar install
```

Atau jika composer sudah terinstall:

```bash
composer install --optimize-autoloader --no-dev
```

### Opsi B: Menggunakan cPanel PHP Composer

1. Buka **Setup PHP App** di cPanel
2. Pilih folder project Anda
3. cPanel akan otomatis mendeteksi composer.json dan install dependencies

---

## Langkah 5: Konfigurasi Environment

1. Di cPanel File Manager, rename file `.env.production` menjadi `.env`
2. Edit file `.env` sesuai dengan database cPanel Anda:

```env
DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=nama_database_anda
DB_USERNAME=username_database_anda
DB_PASSWORD=password_database_anda
```

3. Update `APP_URL` sesuai domain Anda:

```env
APP_URL=https://namadomainanda.com
```

---

## Langkah 6: Setup Database

### Buat Database di cPanel

1. Login ke cPanel
2. Buka **MySQL Databases**
3. Buat database baru (misal: `erp_platform`)
4. Buat user database baru
5. Hubungkan user ke database dengan semua privileges

### Import Database (Opsional)

Jika Anda punya database dump:

1. Buka **phpMyAdmin** di cPanel
2. Pilih database yang baru dibuat
3. Klik **Import**
4. Upload file SQL dump Anda

---

## Langkah 7: Run Migrations

### Via Terminal cPanel:

```bash
cd public_html  # atau folder project Anda

# Run migrations
php artisan migrate --force

# Seed database jika diperlukan
php artisan db:seed --force
```

### Jika tidak ada akses terminal:

Buat file PHP sementara untuk run migrations:

1. Buat file `migrate.php` di root project:

```php
<?php
require 'vendor/autoload.php';

$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);

$kernel->commands();

$kernel->call('migrate', ['--force' => true]);
$kernel->call('db:seed', ['--force' => true]);

echo "Migrations completed successfully!";
```

2. Akses file tersebut via browser: `https://namadomainanda.com/migrate.php`
3. Setelah selesai, hapus file `migrate.php`

---

## Langkah 8: Set Permissions

### Via Terminal cPanel:

```bash
cd public_html

# Set storage permissions
chmod -R 775 storage
chmod -R 775 bootstrap/cache

# Set ownership (jika perlu)
chown -R username:username storage
chown -R username:username bootstrap/cache
```

### Via File Manager cPanel:

1. Buka **File Manager**
2. Klik kanan pada folder `storage` → **Change Permissions**
3. Set ke `755` atau `775`
4. Lakukan hal yang sama untuk folder `bootstrap/cache`

---

## Langkah 9: Konfigurasi Document Root

### Untuk Subdomain:

1. Buka **Subdomains** di cPanel
2. Buat subdomain baru (misal: `erp.namadomainanda.com`)
3. Set document root ke folder `public` di dalam project Anda:
   - `/home/username/public_html/erp/public`

### Untuk Main Domain:

1. Edit document root di **Domains** atau **Subdomains**
2. Set ke folder `public`:
   - `/home/username/public_html/public`

**PENTING:** Document root harus mengarah ke folder `public`, bukan root project!

---

## Langkah 10: Konfigurasi .htaccess

Pastikan file `.htaccess` ada di folder `public` dengan isi:

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^ index.php [L]
</IfModule>
```

Jika tidak ada, buat file `.htaccess` di folder `public` dengan isi di atas.

---

## Langkah 11: Test Deploy

1. Buka browser dan akses domain Anda
2. Cek apakah aplikasi berjalan dengan benar
3. Cek error logs jika ada masalah:

```bash
tail -f storage/logs/laravel.log
```

---

## Troubleshooting

### Error 500

1. Cek file `storage/logs/laravel.log`
2. Pastikan permissions sudah benar
3. Pastikan `.env` sudah dikonfigurasi dengan benar
4. Pastikan database credentials benar

### Assets tidak muncul

1. Pastikan folder `public/build` sudah di-upload
2. Pastikan file `public/build/manifest.json` ada
3. Cek permissions folder `public/build`

### Database connection error

1. Pastikan database sudah dibuat di cPanel
2. Pastikan user database sudah dihubungkan ke database
3. Cek credentials di file `.env`

### Migrations tidak berjalan

1. Pastikan composer sudah di-install dengan benar
2. Cek apakah file `vendor/autoload.php` ada
3. Cek error logs untuk detail error

---

## Update Project di Masa Depan

### Untuk update code:

1. Build assets secara lokal:
   ```bash
   npm run build
   ```

2. Upload file yang berubah ke cPanel (terutama folder `public/build` dan file PHP yang diubah)

3. Di cPanel, run migrations jika ada perubahan database:
   ```bash
   php artisan migrate --force
   ```

4. Clear cache:
   ```bash
   php artisan cache:clear
   php artisan config:clear
   php artisan route:clear
   php artisan view:clear
   ```

---

## Tips Tambahan

1. **Backup sebelum deploy:** Selalu backup database dan file sebelum melakukan update
2. **Gunakan Git:** Jika cPanel support git, gunakan git untuk version control yang lebih mudah
3. **Monitor logs:** Cek logs secara berkala untuk mendeteksi error
4. **Optimize:** Jalankan `php artisan optimize` setelah deploy untuk cache config dan routes
5. **Security:** Pastikan `APP_DEBUG=false` di production
