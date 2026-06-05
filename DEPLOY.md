# 🚀 Panduan Deploy — ERP Karsa (Laravel 12 + Inertia React)

Panduan lengkap untuk deploy ERP Karsa ke berbagai environment: **Development Lokal**, **cPanel Shared Hosting**, dan **VPS / Cloud Server**.

---

## 📋 Daftar Isi

1. [Persyaratan Sistem](#-persyaratan-sistem)
2. [Menjalankan di Lokal (Development)](#-menjalankan-di-lokal-development)
3. [Deploy ke cPanel (Shared Hosting)](#-deploy-ke-cpanel-shared-hosting)
4. [Deploy ke VPS / Cloud Server](#-deploy-ke-vps--cloud-server)
5. [Konfigurasi Environment (.env)](#-konfigurasi-environment-env)
6. [Troubleshooting](#-troubleshooting)

---

## 📌 Persyaratan Sistem

| Komponen        | Minimum                | Rekomendasi               |
|-----------------|------------------------|---------------------------|
| PHP             | 8.2                    | 8.3+                      |
| Composer        | 2.x                    | 2.7+                      |
| Node.js         | 18.x                   | 20.x+ (hanya untuk build) |
| Database        | SQLite / MySQL 8.0     | MySQL 8.0 / MariaDB 10.6+ |
| Web Server      | Apache / LiteSpeed     | Nginx / LiteSpeed         |

### Ekstensi PHP Wajib
`bcmath`, `ctype`, `curl`, `dom`, `fileinfo`, `json`, `mbstring`, `openssl`, `pdo`, `pdo_sqlite` / `pdo_mysql`, `tokenizer`, `xml`

---

## 💻 Menjalankan di Lokal (Development)

### Langkah Cepat (One-liner)

```bash
# Clone repository
git clone https://github.com/Senadara/erp_canvas.git
cd erp_canvas

# Jalankan setup otomatis
composer setup
```

Script `composer setup` akan otomatis melakukan:
- `composer install`
- Copy `.env.example` → `.env`
- Generate `APP_KEY`
- Jalankan migrasi database
- `npm install` + `npm run build`

### Langkah Manual (Step-by-step)

```bash
# 1. Clone & masuk direktori
git clone https://github.com/Senadara/erp_canvas.git
cd erp_canvas

# 2. Install dependensi PHP
composer install

# 3. Konfigurasi environment
cp .env.example .env
php artisan key:generate

# 4. Buat database SQLite (default)
#    File database.sqlite sudah ada di folder database/
#    Pastikan file tersebut writable.

# 5. Jalankan migrasi & seeder
php artisan migrate --seed

# 6. Install dependensi frontend
npm install

# 7. Jalankan development server
#    Opsi A: Jalankan terpisah di 2 terminal
php artisan serve        # Terminal 1 — Backend (http://localhost:8000)
npm run dev              # Terminal 2 — Vite HMR  (http://localhost:5173)

#    Opsi B: Jalankan sekaligus (menggunakan concurrently)
composer dev
```

### Akun Default (Setelah Seeding)

| Email                  | Password     | Role  |
|------------------------|--------------|-------|
| owner@karsa.local      | Owner123!    | OWNER |

> ⚠️ **Penting**: Saat development, Anda HARUS menjalankan **dua server** secara bersamaan:
> `php artisan serve` (backend) dan `npm run dev` (Vite frontend).
> Jika hanya menjalankan satu, halaman akan tampil putih / blank.

---

## 🌐 Deploy ke cPanel (Shared Hosting)

Metode ini **tidak** membutuhkan SSH, Node.js, atau Passenger di server.
Semua proses build dilakukan di **komputer lokal**.

### Langkah 1: Build Lokal

```bash
# Di komputer lokal, masuk ke folder project
cd erp_canvas

# Install dependensi production PHP
composer install --optimize-autoloader --no-dev

# Build frontend (Inertia React → file statis)
npm ci
npm run build
# Hasil build: public/build/
```

### Langkah 2: Persiapan File Upload

Buat ZIP dari seluruh project **kecuali** folder berikut:
- `node_modules/`
- `.git/`
- `tests/`
- `storage/logs/*.log`

### Langkah 3: Upload ke cPanel

Struktur yang direkomendasikan di cPanel:

```
/home/username/
├── erp_app/                ← Seluruh file Laravel (BUKAN di public_html)
│   ├── app/
│   ├── bootstrap/
│   ├── config/
│   ├── database/
│   ├── resources/
│   ├── routes/
│   ├── storage/
│   ├── vendor/
│   ├── .env
│   └── ...
│
└── public_html/            ← Atau subdomain folder (erp.domain.com)
    ├── build/              ← Dari erp_app/public/build/
    ├── .htaccess           ← Dari erp_app/public/.htaccess
    ├── index.php           ← Dari erp_app/public/index.php (DIMODIFIKASI)
    ├── favicon.ico
    ├── robots.txt
    └── ...
```

**Langkah:**
1. Upload ZIP ke `/home/username/erp_app/` via **File Manager** cPanel.
2. Ekstrak file ZIP.
3. **Pindahkan** seluruh isi folder `erp_app/public/` ke `public_html/` (atau folder subdomain).
4. **Modifikasi** `public_html/index.php`:

```php
<?php
// === SESUAIKAN PATH INI ===
require __DIR__.'/../erp_app/vendor/autoload.php';
$app = require_once __DIR__.'/../erp_app/bootstrap/app.php';
// ==========================

$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$response = $kernel->handle(
    $request = Illuminate\Http\Request::capture()
);
$response->send();
$kernel->terminate($request, $response);
```

### Langkah 4: Konfigurasi .env di Server

Buat/edit file `.env` di `/home/username/erp_app/.env`:

```env
APP_NAME="ERP Karsa"
APP_ENV=production
APP_KEY=base64:XXXXXXX
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

CACHE_STORE=file

SANCTUM_STATEFUL_DOMAINS="erp.domain.com"
```

> 💡 **APP_KEY**: Generate di lokal dengan `php artisan key:generate --show`, lalu copy hasilnya ke `.env` server.

### Langkah 5: Migrasi Database (Tanpa SSH)

Tambahkan route sementara di `routes/web.php`:

```php
// === ROUTE SETUP — HAPUS SETELAH BERHASIL ===
Route::get('/setup-deploy', function() {
    Artisan::call('migrate', ['--force' => true]);
    Artisan::call('storage:link');
    Artisan::call('db:seed', ['--force' => true]);
    Artisan::call('optimize');
    return 'Setup selesai! SEGERA HAPUS route ini.';
});
```

Akses `https://erp.domain.com/setup-deploy`, lalu **segera hapus** route tersebut.

### Langkah 6: .htaccess untuk PWA

Pastikan file `.htaccess` di `public_html` memiliki konfigurasi:

```apache
<IfModule mod_rewrite.c>
    <IfModule mod_negotiation.c>
        Options -MultiViews -Indexes
    </IfModule>

    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^(.*)/$ /$1 [L,R=301]
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

---

## 🖥️ Deploy ke VPS / Cloud Server

Cocok untuk **DigitalOcean**, **AWS EC2**, **Vultr**, **Hetzner**, dll.

### Langkah 1: Setup Server

```bash
# Update & install paket dasar
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx php8.3-fpm php8.3-cli php8.3-mbstring \
    php8.3-xml php8.3-bcmath php8.3-curl php8.3-zip php8.3-mysql \
    php8.3-sqlite3 mysql-server git unzip composer

# Install Node.js (untuk build saja)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Langkah 2: Clone & Setup

```bash
# Clone repository
cd /var/www
sudo git clone https://github.com/Senadara/erp_canvas.git erp
sudo chown -R www-data:www-data erp
cd erp

# Install & build
composer install --optimize-autoloader --no-dev
npm ci && npm run build

# Konfigurasi
cp .env.example .env
php artisan key:generate
# Edit .env sesuai kebutuhan (database, domain, dll)

# Migrasi & optimize
php artisan migrate --seed --force
php artisan storage:link
php artisan optimize
```

### Langkah 3: Konfigurasi Nginx

```nginx
server {
    listen 80;
    server_name erp.domain.com;
    root /var/www/erp/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    index index.php;
    charset utf-8;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }

    # Cache assets, tapi bukan SW/manifest
    location /build/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location ~* ^/(sw\.js|manifest\.webmanifest)$ {
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }
}
```

```bash
# Aktifkan site & restart
sudo ln -s /etc/nginx/sites-available/erp /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

# SSL (Let's Encrypt)
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d erp.domain.com
```

---

## ⚙️ Konfigurasi Environment (.env)

### Variabel Penting

| Variabel                   | Development          | Production                  |
|----------------------------|----------------------|-----------------------------|
| `APP_ENV`                  | `local`              | `production`                |
| `APP_DEBUG`                | `true`               | `false`                     |
| `APP_URL`                  | `http://localhost`   | `https://erp.domain.com`    |
| `DB_CONNECTION`            | `sqlite`             | `mysql`                     |
| `SESSION_DRIVER`           | `database`           | `file` atau `database`      |
| `CACHE_STORE`              | `database`           | `file` atau `redis`         |
| `SANCTUM_STATEFUL_DOMAINS` | —                    | `erp.domain.com`            |

### Seed Owner Account

```env
SEED_OWNER_EMAIL=owner@karsa.local
SEED_OWNER_PASSWORD=Owner123!
```

---

## 🛠️ Troubleshooting

### Layar Putih / Blank Page (Development)

**Penyebab**: Vite dev server belum berjalan.
**Solusi**: Pastikan `npm run dev` berjalan di terminal terpisah.

### ERR_CONNECTION_REFUSED port 5173

**Penyebab**: Sama — Vite belum dijalankan.
**Solusi**: Jalankan `npm run dev` di folder project.

### 500 Internal Server Error (Production)

**Cek**:
1. `storage/logs/laravel.log` untuk detail error.
2. Pastikan folder `storage/` dan `bootstrap/cache/` writable:
   ```bash
   chmod -R 775 storage bootstrap/cache
   chown -R www-data:www-data storage bootstrap/cache
   ```
3. Jalankan `php artisan optimize:clear` lalu `php artisan optimize`.

### CSRF Token Mismatch / 419

**Penyebab**: Session tidak tersimpan dengan benar.
**Solusi**:
- Pastikan `SESSION_DOMAIN` dan `APP_URL` di `.env` benar.
- Di cPanel, gunakan `SESSION_DRIVER=file`.

### Redirect Loop (ERR_TOO_MANY_REDIRECTS)

**Solusi**: Tambahkan di `.env`:
```env
FORCE_HTTPS=true
```
Dan pastikan di `AppServiceProvider` atau `TrustProxies` middleware sudah menangani proxy header dari LiteSpeed/CloudFlare.

### PWA Tidak Bisa Install

**Penyebab**: Wajib HTTPS.
**Solusi**: Pastikan SSL aktif dan `APP_URL` menggunakan `https://`.

---

## 📦 Update Deployment

### cPanel (Manual)

```bash
# Di lokal:
composer install --optimize-autoloader --no-dev
npm ci && npm run build

# Upload ulang file yang berubah + public/build/
# Akses route setup jika ada migrasi baru
```

### VPS (SSH)

```bash
cd /var/www/erp
git pull origin main
composer install --optimize-autoloader --no-dev
npm ci && npm run build
php artisan migrate --force
php artisan optimize
```

---

> 📝 **Catatan**: Dokumentasi ini ditulis untuk **ERP Karsa v1** dengan stack Laravel 12 + Inertia.js + React 18 + Tailwind CSS.
