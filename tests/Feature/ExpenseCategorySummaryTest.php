<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\User;
use App\Services\PettyCashService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ExpenseCategorySummaryTest extends TestCase
{
    use RefreshDatabase;

    public function test_expense_page_summarizes_default_and_custom_categories(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Kategori']);
        $owner = $this->createOwner();

        $service = app(PettyCashService::class);
        $service->createExpense([
            'outlet_id' => $outlet->id,
            'amount' => 12000,
            'category' => 'Operasional',
            'payment_method' => 'CASH',
            'description' => 'ATK',
        ]);
        $service->createExpense([
            'outlet_id' => $outlet->id,
            'amount' => 35000,
            'category' => 'Transport Vendor',
            'payment_method' => 'CASH',
            'description' => 'Ongkir pagi',
        ]);
        $service->createExpense([
            'outlet_id' => $outlet->id,
            'amount' => 15000,
            'category' => 'Transport Vendor',
            'payment_method' => 'QRIS',
            'description' => 'Ongkir sore',
        ]);
        $service->createExpense([
            'outlet_id' => $outlet->id,
            'amount' => 22000,
            'category' => 'Transport Vendor',
            'payment_method' => 'PRIVATE',
            'description' => 'Ongkir pribadi',
        ]);
        $service->createExpense([
            'outlet_id' => $outlet->id,
            'amount' => 10000,
            'category' => 'Tambah Kas',
            'payment_method' => 'PRIVATE',
            'cash_flow' => 'OUT',
            'description' => 'Top up luar laci',
        ]);
        $service->createExpense([
            'outlet_id' => $outlet->id,
            'amount' => 25000,
            'category' => 'Penarikan',
            'payment_method' => 'CASH',
            'description' => 'Tarik owner',
        ]);

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->get(route('expenses'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Expenses/Index')
                ->where('filters.category', 'ALL')
                ->where('categoryOptions', fn ($categories) => $categories->contains('Operasional')
                    && $categories->contains('Transport Vendor')
                    && $categories->contains('Penarikan'))
                ->where('categorySummaries', function ($summaries) {
                    $transport = $summaries->firstWhere('category', 'Transport Vendor');
                    $topup = $summaries->firstWhere('category', 'Tambah Kas');
                    $withdrawal = $summaries->firstWhere('category', 'Penarikan');

                    return $transport
                        && (float) $transport['expense_total'] === 72000.0
                        && (float) $transport['cashier_expense_total'] === 50000.0
                        && (float) $transport['private_total'] === 22000.0
                        && (int) $transport['private_count'] === 1
                        && (int) $transport['expense_count'] === 3
                        && $topup
                        && (float) $topup['incoming_total'] === 10000.0
                        && (float) $topup['expense_total'] === 0.0
                        && $withdrawal
                        && (float) $withdrawal['outgoing_total'] === 25000.0
                        && (float) $withdrawal['expense_total'] === 0.0;
                })
            );
    }

    public function test_category_filter_returns_all_matching_expenses(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Filter']);
        $owner = $this->createOwner('owner-filter@karsa.local');
        $service = app(PettyCashService::class);

        for ($i = 0; $i < 105; $i++) {
            $service->createExpense([
                'outlet_id' => $outlet->id,
                'amount' => 1000 + $i,
                'category' => 'Transport Vendor',
                'payment_method' => 'CASH',
                'description' => "Ongkir {$i}",
            ]);
        }

        for ($i = 0; $i < 3; $i++) {
            $service->createExpense([
                'outlet_id' => $outlet->id,
                'amount' => 5000,
                'category' => 'Operasional',
                'payment_method' => 'CASH',
                'description' => "Operasional {$i}",
            ]);
        }

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->get(route('expenses', ['category' => 'Transport Vendor']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Expenses/Index')
                ->where('filters.category', 'Transport Vendor')
                ->where('expenses', fn ($expenses) => $expenses->count() === 105
                    && $expenses->every(fn ($expense) => $expense['category'] === 'Transport Vendor'))
            );
    }

    public function test_date_filter_limits_expense_list_and_category_summaries(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Tanggal']);
        $owner = $this->createOwner('owner-date@karsa.local');
        $service = app(PettyCashService::class);

        $service->createExpense([
            'outlet_id' => $outlet->id,
            'amount' => 30000,
            'category' => 'Transport Vendor',
            'payment_method' => 'CASH',
            'description' => 'Ongkir pagi',
            'date' => '2026-07-10 10:00:00',
        ]);
        $service->createExpense([
            'outlet_id' => $outlet->id,
            'amount' => 7000,
            'category' => 'Operasional',
            'payment_method' => 'CASH',
            'description' => 'ATK malam',
            'date' => '2026-07-10 23:59:00',
        ]);
        $service->createExpense([
            'outlet_id' => $outlet->id,
            'amount' => 90000,
            'category' => 'Transport Vendor',
            'payment_method' => 'CASH',
            'description' => 'Ongkir besok',
            'date' => '2026-07-11 09:00:00',
        ]);
        $service->createExpense([
            'outlet_id' => $outlet->id,
            'amount' => 12000,
            'category' => 'Tambah Kas',
            'payment_method' => 'PRIVATE',
            'description' => 'Top up kemarin',
            'date' => '2026-07-09 12:00:00',
        ]);

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->get(route('expenses', [
                'date_from' => '2026-07-10',
                'date_to' => '2026-07-10',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Expenses/Index')
                ->where('filters.date_from', '2026-07-10')
                ->where('filters.date_to', '2026-07-10')
                ->where('expenses', fn ($expenses) => $expenses->count() === 2
                    && $expenses->every(fn ($expense) => str_starts_with($expense['created_at'], '2026-07-10')))
                ->where('categorySummaries', function ($summaries) {
                    $transport = $summaries->firstWhere('category', 'Transport Vendor');
                    $operational = $summaries->firstWhere('category', 'Operasional');
                    $topup = $summaries->firstWhere('category', 'Tambah Kas');

                    return $transport
                        && (float) $transport['expense_total'] === 30000.0
                        && (int) $transport['expense_count'] === 1
                        && $operational
                        && (float) $operational['expense_total'] === 7000.0
                        && $topup
                        && (float) $topup['incoming_total'] === 0.0
                        && (int) $topup['movement_count'] === 0;
                })
            );
    }

    private function createOwner(string $email = 'owner-category@karsa.local'): User
    {
        return User::create([
            'email' => $email,
            'password_hash' => Hash::make('password'),
            'display_name' => 'Owner Kategori',
            'role' => 'OWNER',
            'is_active' => true,
        ]);
    }
}
