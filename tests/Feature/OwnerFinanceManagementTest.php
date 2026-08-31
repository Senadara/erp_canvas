<?php

namespace Tests\Feature;

use App\Models\Investment;
use App\Models\Outlet;
use App\Models\OwnerFinanceBatch;
use App\Models\OwnerFinanceItem;
use App\Models\PartnerCapitalLoan;
use App\Models\PartnerProfile;
use App\Models\PettyCash;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\User;
use App\Services\OwnerFinanceService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class OwnerFinanceManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_create_partner_role_without_supplier_scope(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Partner']);
        $owner = $this->user('OWNER', 'Owner');

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post('/users', [
                'email' => 'partner@karsa.local',
                'password' => 'password',
                'display_name' => 'Partner Bisnis',
                'role' => 'PARTNER',
                'is_active' => true,
                'outlet_ids' => [$outlet->id],
                'feature_overrides' => ['cashier' => true],
            ])
            ->assertRedirect();

        $partner = User::where('email', 'partner@karsa.local')->firstOrFail();
        $this->assertSame('PARTNER', $partner->role);
        $this->assertNull($partner->supplier_id);
        $this->assertTrue((bool) ($partner->feature_overrides['cashier'] ?? false));

        $this->actingAs($partner)
            ->withSession(['outlet_id' => $outlet->id])
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard')
                ->where('dashboard.role', 'PARTNER')
                ->where('dashboard.quickActions.0.label', 'Bagi Hasil')
            );
    }

    public function test_owner_finance_posts_dividend_and_manual_capital_loan_repayment(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Dividen']);
        $owner = $this->user('OWNER', 'Owner');
        $borrower = $this->user('PARTNER', 'Partner Peminjam');
        $lender = $this->user('PARTNER', 'Partner Lender');
        $borrower->outlets()->attach($outlet->id);
        $lender->outlets()->attach($outlet->id);

        $product = Product::create([
            'outlet_id' => $outlet->id,
            'name' => 'Kopi',
            'category' => 'Minuman',
            'price' => 300000,
            'hpp' => 100000,
            'is_active' => true,
        ]);

        $this->paidTransaction($outlet, $product, 1, 300000, 100000, '2026-08-10 10:00:00');

        Investment::create([
            'outlet_id' => $outlet->id,
            'user_id' => $owner->id,
            'lots' => 1,
            'lot_value' => 1000000,
            'total_value' => 1000000,
            'status' => 'APPROVED',
            'approved_at' => Carbon::parse('2026-08-01'),
        ]);
        $borrowerInvestment = Investment::create([
            'outlet_id' => $outlet->id,
            'user_id' => $borrower->id,
            'lots' => 1,
            'lot_value' => 1000000,
            'total_value' => 1000000,
            'status' => 'APPROVED',
            'approved_at' => Carbon::parse('2026-08-01'),
        ]);
        $loan = PartnerCapitalLoan::create([
            'borrower_user_id' => $borrower->id,
            'lender_user_id' => $lender->id,
            'investment_id' => $borrowerInvestment->id,
            'principal_amount' => 80000,
            'remaining_amount' => 80000,
            'status' => PartnerCapitalLoan::STATUS_ACTIVE,
            'created_by' => $owner->id,
        ]);

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post('/owner-finance/batches', [
                'outlet_id' => $outlet->id,
                'period_start' => '2026-08-01',
                'period_end' => '2026-08-31',
                'payout_method' => 'CASH',
                'intent' => 'POSTED',
                'loan_allocations' => [$loan->id => 60000],
            ])
            ->assertRedirect();

        $batch = OwnerFinanceBatch::firstOrFail();
        $this->assertSame(OwnerFinanceBatch::STATUS_POSTED, $batch->status);
        $this->assertSame(200000.0, (float) $batch->total_dividend);
        $this->assertSame(60000.0, (float) $batch->total_loan_repayment);
        $this->assertSame(200000.0, (float) $batch->total_payout);
        $this->assertSame(20000.0, (float) $loan->fresh()->remaining_amount);

        $this->assertDatabaseHas('owner_finance_items', [
            'type' => OwnerFinanceItem::TYPE_LOAN_REPAYMENT,
            'source_user_id' => $borrower->id,
            'recipient_user_id' => $lender->id,
            'amount' => 60000,
        ]);
        $this->assertDatabaseHas('owner_finance_items', [
            'type' => OwnerFinanceItem::TYPE_DIVIDEND,
            'recipient_user_id' => $borrower->id,
            'amount' => 40000,
        ]);
        $this->assertSame(3, PettyCash::where('category', 'Distribusi Owner')->count());
        $this->assertSame(200000.0, (float) PettyCash::where('category', 'Distribusi Owner')->sum('amount'));

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->get('/finance?date_from=2026-08-01&date_to=2026-08-31')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Finance/Index')
                ->where('periodSummary.expenseTotal', fn ($value) => (float) $value === 0.0)
                ->where('periodSummary.ownerDistributionTotal', fn ($value) => (float) $value === 200000.0)
                ->where('periodSummary.withdrawableCash', fn ($value) => (float) $value === 100000.0)
            );
    }

    public function test_owner_finance_rejects_duplicate_posting_for_the_same_outlet_period(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Anti Double']);
        $owner = $this->user('OWNER', 'Owner Duplicate');

        $product = Product::create([
            'outlet_id' => $outlet->id,
            'name' => 'Americano',
            'category' => 'Minuman',
            'price' => 200000,
            'hpp' => 0,
            'is_active' => true,
        ]);
        $this->paidTransaction($outlet, $product, 1, 200000, 0, '2026-08-10 10:00:00');

        Investment::create([
            'outlet_id' => $outlet->id,
            'user_id' => $owner->id,
            'lots' => 1,
            'lot_value' => 1000000,
            'total_value' => 1000000,
            'status' => 'APPROVED',
            'approved_at' => Carbon::parse('2026-08-01'),
        ]);

        $payload = [
            'outlet_id' => $outlet->id,
            'period_start' => '2026-08-01',
            'period_end' => '2026-08-31',
            'payout_method' => 'CASH',
            'intent' => OwnerFinanceBatch::STATUS_POSTED,
        ];

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post('/owner-finance/batches', $payload)
            ->assertRedirect();

        $this->assertSame(1, OwnerFinanceBatch::where('status', OwnerFinanceBatch::STATUS_POSTED)->count());
        $this->assertSame(1, PettyCash::where('category', 'Distribusi Owner')->count());

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post('/owner-finance/batches', $payload)
            ->assertSessionHasErrors(['error', 'period_start']);

        $this->assertSame(1, OwnerFinanceBatch::count());
        $this->assertSame(1, PettyCash::where('category', 'Distribusi Owner')->count());

        $draft = OwnerFinanceBatch::create([
            'outlet_id' => $outlet->id,
            'period_start' => Carbon::parse('2026-08-01')->startOfDay(),
            'period_end' => Carbon::parse('2026-08-31')->endOfDay(),
            'status' => OwnerFinanceBatch::STATUS_DRAFT,
            'payout_method' => 'CASH',
            'total_salary' => 0,
            'total_dividend' => 10000,
            'total_loan_repayment' => 0,
            'total_payout' => 10000,
            'retained_amount' => 0,
            'created_by' => $owner->id,
        ]);
        $draft->items()->create([
            'source_user_id' => $owner->id,
            'recipient_user_id' => $owner->id,
            'type' => OwnerFinanceItem::TYPE_DIVIDEND,
            'payment_method' => 'CASH',
            'amount' => 10000,
        ]);

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->post("/owner-finance/batches/{$draft->id}/post")
            ->assertSessionHasErrors(['error', 'period_start']);

        $this->assertSame(OwnerFinanceBatch::STATUS_DRAFT, $draft->fresh()->status);
        $this->assertSame(1, PettyCash::where('category', 'Distribusi Owner')->count());

        $this->actingAs($owner)
            ->withSession(['outlet_id' => $outlet->id])
            ->get('/owner-finance?outlet_id='.$outlet->id.'&period_start=2026-08-01&period_end=2026-08-31')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('OwnerFinance/Index')
                ->where('preview.already_posted', true)
                ->where('preview.can_post', false)
            );
    }

    public function test_owner_salary_is_reduced_proportionally_when_profit_is_not_enough(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Gaji']);
        $owner = $this->user('OWNER', 'Owner');
        $partner = $this->user('PARTNER', 'Partner');
        $partner->outlets()->attach($outlet->id);

        PartnerProfile::create(['user_id' => $owner->id, 'default_salary' => 100000, 'is_active' => true]);
        PartnerProfile::create(['user_id' => $partner->id, 'default_salary' => 100000, 'is_active' => true]);

        $product = Product::create([
            'outlet_id' => $outlet->id,
            'name' => 'Menu',
            'category' => 'Makanan',
            'price' => 100000,
            'hpp' => 0,
            'is_active' => true,
        ]);
        $this->paidTransaction($outlet, $product, 1, 100000, 0, '2026-08-12 10:00:00');

        $preview = app(OwnerFinanceService::class)->preview(
            $owner,
            $outlet->id,
            Carbon::parse('2026-08-01')->startOfDay(),
            Carbon::parse('2026-08-31')->endOfDay(),
            ['payout_method' => 'CASH']
        );

        $this->assertEquals(100000, $preview['totals']['salary_paid']);
        $this->assertEquals(100000, $preview['totals']['salary_shortfall']);
        $this->assertEqualsCanonicalizing([50000, 50000], collect($preview['salary_rows'])->pluck('final_salary')->all());
        $this->assertEquals(0, $preview['totals']['dividend_pool']);
    }

    public function test_pending_partner_capital_does_not_grant_owner_finance_outlet_access(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Pending']);
        $partner = $this->user('PARTNER', 'Partner Pending');

        Investment::create([
            'outlet_id' => $outlet->id,
            'user_id' => $partner->id,
            'lots' => 1,
            'lot_value' => 1000000,
            'total_value' => 1000000,
            'status' => 'PENDING',
        ]);

        $this->actingAs($partner)
            ->get('/owner-finance?outlet_id='.$outlet->id)
            ->assertForbidden();

        $this->actingAs($partner)
            ->get('/investments')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Investments/Index')
                ->where('investments.0.status', 'PENDING')
            );
    }

    public function test_partner_only_sees_their_own_owner_finance_items(): void
    {
        $outlet = Outlet::create(['name' => 'Outlet Pribadi']);
        $owner = $this->user('OWNER', 'Owner');
        $partnerA = $this->user('PARTNER', 'Partner A');
        $partnerB = $this->user('PARTNER', 'Partner B');
        $partnerA->outlets()->attach($outlet->id);
        $partnerB->outlets()->attach($outlet->id);

        $batch = OwnerFinanceBatch::create([
            'outlet_id' => $outlet->id,
            'period_start' => Carbon::parse('2026-08-01'),
            'period_end' => Carbon::parse('2026-08-31'),
            'status' => OwnerFinanceBatch::STATUS_POSTED,
            'payout_method' => 'CASH',
            'total_salary' => 0,
            'total_dividend' => 100000,
            'total_loan_repayment' => 0,
            'total_payout' => 100000,
            'retained_amount' => 0,
            'created_by' => $owner->id,
            'posted_by' => $owner->id,
            'posted_at' => Carbon::parse('2026-08-31'),
        ]);
        OwnerFinanceItem::create([
            'owner_finance_batch_id' => $batch->id,
            'source_user_id' => $partnerA->id,
            'recipient_user_id' => $partnerA->id,
            'type' => OwnerFinanceItem::TYPE_DIVIDEND,
            'payment_method' => 'CASH',
            'amount' => 60000,
        ]);
        OwnerFinanceItem::create([
            'owner_finance_batch_id' => $batch->id,
            'source_user_id' => $partnerB->id,
            'recipient_user_id' => $partnerB->id,
            'type' => OwnerFinanceItem::TYPE_DIVIDEND,
            'payment_method' => 'CASH',
            'amount' => 40000,
        ]);

        $this->actingAs($partnerA)
            ->withSession(['outlet_id' => $outlet->id])
            ->get('/owner-finance?period_start=2026-08-01&period_end=2026-08-31')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('OwnerFinance/Index')
                ->where('isOwner', false)
                ->where('batches.0.items.0.recipient.display_name', 'Partner A')
                ->missing('batches.0.items.1')
            );
    }

    private function user(string $role, string $name): User
    {
        return User::create([
            'email' => strtolower(str_replace(' ', '.', $name)).'@karsa.local',
            'password_hash' => Hash::make('password'),
            'display_name' => $name,
            'role' => $role,
            'is_active' => true,
        ]);
    }

    private function paidTransaction(Outlet $outlet, Product $product, int $qty, float $price, float $hpp, string $paidAt): Transaction
    {
        $transaction = Transaction::create([
            'outlet_id' => $outlet->id,
            'invoice_number' => 'INV-'.str_replace(['-', ' ', ':'], '', $paidAt),
            'total_amount' => $qty * $price,
            'payment_method' => 'CASH',
            'payment_status' => 'PAID',
            'created_at' => Carbon::parse($paidAt),
            'paid_at' => Carbon::parse($paidAt),
        ]);

        $transaction->items()->create([
            'product_id' => $product->id,
            'product_name' => $product->name,
            'qty_porsi' => $qty,
            'price_per_porsi' => $price,
            'subtotal' => $qty * $price,
            'hpp_per_porsi' => $hpp,
            'hpp_total' => $qty * $hpp,
            'hpp_source' => 'TEST',
            'hpp_snapshot' => ['source' => 'TEST'],
        ]);

        return $transaction;
    }
}
