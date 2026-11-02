<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

class DemoReset extends Command
{
    protected $signature   = 'demo:reset {--force : Skip konfirmasi}';
    protected $description = 'Reset database demo dan isi ulang dengan data contoh (DemoSeeder).';

    public function handle(): int
    {
        // Pastikan hanya bisa dijalankan di mode demo
        if (! env('SEED_DEMO', false)) {
            $this->error('Perintah ini hanya tersedia jika SEED_DEMO=true di .env');
            return self::FAILURE;
        }

        if (! $this->option('force') && ! $this->confirm('Reset akan menghapus SEMUA data dan mengisi ulang dengan data demo. Lanjutkan?')) {
            $this->info('Dibatalkan.');
            return self::SUCCESS;
        }

        $this->info('⏳ Memulai reset database demo...');

        // Matikan foreign key check sementara
        DB::statement('PRAGMA foreign_keys = OFF');

        $this->info('→ Menjalankan migrate:fresh...');
        Artisan::call('migrate:fresh', ['--force' => true]);
        $this->line(Artisan::output());

        $this->info('→ Menjalankan DemoSeeder...');
        Artisan::call('db:seed', ['--force' => true]);
        $this->line(Artisan::output());

        DB::statement('PRAGMA foreign_keys = ON');

        $this->newLine();
        $this->info('✅ Database demo berhasil direset!');
        $this->table(
            ['Keterangan', 'Nilai'],
            [
                ['Outlet',    'Kafe Karsa Demo'],
                ['Email Demo','demo@karsa.id'],
                ['Password',  env('SEED_OWNER_PASSWORD', 'Demo123!')],
                ['Data',      'Produk, stok, transaksi 30 hari, shift, pengeluaran, payroll'],
            ]
        );

        return self::SUCCESS;
    }
}
