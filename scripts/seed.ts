/**
 * Seed Script — Creates demo users and generates deterministic transactions.
 *
 * Usage: npx tsx scripts/seed.ts
 *
 * Steps:
 * 1. Create auth users (Alex + Emma) via admin API
 * 2. Upsert profile data
 * 3. Seed static data (pots, beneficiaries, etc.) via Supabase API
 * 4. Generate 90+ deterministic transactions for Alex
 *
 * All values sourced from packages/shared/src/test-constants.ts
 */

import { createClient } from '@supabase/supabase-js';
import { resolve } from 'path';
import { config } from 'dotenv';

import {
  ALEX,
  EMMA,
  TRANSACTION_TEMPLATES,
  MERCHANT_CATEGORY_MAP,
  CATEGORY_MAP,
} from '@agentic-bank/shared';

config({ path: resolve(__dirname, '../apps/api/.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/api/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Track real user IDs (Supabase assigns them, may differ from our deterministic ones)
const realIds: Record<string, string> = {};

function getUserId(user: typeof ALEX | typeof EMMA): string {
  return realIds[user.email] ?? user.id;
}

// ---------------------------------------------------------------------------
// Phase 1: Create Auth Users
// ---------------------------------------------------------------------------

async function createAuthUsers() {
  console.log('Phase 1: Creating auth users...');

  for (const user of [ALEX, EMMA]) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { display_name: user.displayName },
    });

    if (error) {
      if (error.message?.includes('already been registered')) {
        console.log(`  ✓ ${user.displayName} already exists`);
        const { data: listData } = await supabase.auth.admin.listUsers();
        const existing = listData?.users?.find((u) => u.email === user.email);
        if (existing) {
          realIds[user.email] = existing.id;
          if (existing.id !== user.id) {
            console.log(`    (using existing ID ${existing.id})`);
          }
        }
      } else {
        console.error(`  ✗ Failed to create ${user.displayName}:`, error.message);
      }
    } else {
      console.log(`  ✓ Created ${user.displayName} (${data.user.id})`);
      realIds[user.email] = data.user.id;
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 2: Upsert Profile Data
// ---------------------------------------------------------------------------

async function upsertProfiles() {
  console.log('Phase 2: Upserting profiles...');

  const alexId = getUserId(ALEX);
  const { error: alexErr } = await supabase
    .from('profiles')
    .upsert(
      { id: alexId, display_name: ALEX.displayName, onboarding_step: ALEX.onboardingStep },
      { onConflict: 'id' }
    );
  console.log(alexErr ? `  ✗ Alex: ${alexErr.message}` : '  ✓ Alex profile');

  const emmaId = getUserId(EMMA);
  const { error: emmaErr } = await supabase
    .from('profiles')
    .upsert(
      { id: emmaId, display_name: EMMA.displayName, onboarding_step: EMMA.onboardingStep },
      { onConflict: 'id' }
    );
  console.log(emmaErr ? `  ✗ Emma: ${emmaErr.message}` : '  ✓ Emma profile');
}

// ---------------------------------------------------------------------------
// Phase 3: Seed Static Data via API
// ---------------------------------------------------------------------------

async function seedStaticData() {
  console.log('Phase 3: Seeding static data...');
  const alexId = getUserId(ALEX);

  // Merchant categories
  const merchantRows = Object.entries(MERCHANT_CATEGORY_MAP).map(([name, cat]) => ({
    merchant_name_normalised: name.toLowerCase(),
    primary_category: cat.primaryCategory,
    detailed_category: cat.detailedCategory,
    category_icon: cat.icon,
    source: 'rule',
  }));
  const { error: mcErr } = await supabase
    .from('merchant_categories')
    .upsert(merchantRows, { onConflict: 'merchant_name_normalised' });
  console.log(mcErr ? `  ✗ merchant_categories: ${mcErr.message}` : '  ✓ merchant_categories');

  // Pots
  const potRows = Object.values(ALEX.pots).map((p, i) => ({
    id: `a0000000-0000-0000-0000-00000000000${i + 1}`,
    user_id: alexId,
    name: p.name,
    balance: p.balance,
    goal: p.goal,
    emoji: p.emoji,
    is_closed: false,
  }));
  const { error: potErr } = await supabase.from('pots').upsert(potRows, { onConflict: 'id' });
  console.log(potErr ? `  ✗ pots: ${potErr.message}` : '  ✓ pots');

  // Beneficiaries (domestic only — beneficiaries table has sort_code/account_number)
  const domesticBens = ALEX.beneficiaries.filter((b) => b.type === 'domestic');
  const benRows = domesticBens.map((b, i) => ({
    id: `b0000000-0000-0000-0000-00000000000${i + 1}`,
    user_id: alexId,
    name: b.name,
    account_number: (b as any).accountNumber,
    sort_code: (b as any).sortCode,
  }));
  const { error: benErr } = await supabase.from('beneficiaries').upsert(benRows, { onConflict: 'id' });
  console.log(benErr ? `  ✗ beneficiaries: ${benErr.message}` : '  ✓ beneficiaries');

  // International recipient
  const intlBen = ALEX.beneficiaries.find((b) => b.type === 'international')!;
  const { error: intlErr } = await supabase.from('international_recipients').upsert(
    [{
      id: 'b0000000-0000-0000-0000-000000000006',
      user_id: alexId,
      name: intlBen.name,
      iban: (intlBen as any).iban,
      country: 'DE',
    }],
    { onConflict: 'id' }
  );
  console.log(intlErr ? `  ✗ international_recipients: ${intlErr.message}` : '  ✓ international_recipients');

  // Standing order — next 1st of month
  const nextFirst = new Date();
  if (nextFirst.getDate() > 1) nextFirst.setMonth(nextFirst.getMonth() + 1);
  nextFirst.setDate(1);
  const { error: soErr } = await supabase.from('standing_orders').upsert(
    [{
      id: 'c0000000-0000-0000-0000-000000000001',
      user_id: alexId,
      beneficiary_id: 'b0000000-0000-0000-0000-000000000003',
      amount: ALEX.standingOrder.amount,
      frequency: ALEX.standingOrder.frequency,
      day_of_month: ALEX.standingOrder.dayOfMonth,
      status: 'active',
      next_date: nextFirst.toISOString().split('T')[0],
    }],
    { onConflict: 'id' }
  );
  console.log(soErr ? `  ✗ standing_orders: ${soErr.message}` : '  ✓ standing_orders');

  // Credit score
  const { error: csErr } = await supabase.from('credit_scores').upsert(
    [{
      user_id: alexId,
      score: ALEX.creditScore,
      rating: ALEX.creditScoreRating,
      factors: {
        positive: ['Regular salary income', 'No missed payments', 'Low credit utilisation'],
        improve: ['Limited credit history length', 'Single credit type'],
      },
      last_updated: new Date().toISOString(),
    }],
    { onConflict: 'user_id' }
  );
  console.log(csErr ? `  ✗ credit_scores: ${csErr.message}` : '  ✓ credit_scores');

  // Mock account
  const { error: maErr } = await supabase.from('mock_accounts').upsert(
    [{
      id: 'd0000000-0000-0000-0000-000000000001',
      user_id: alexId,
      name: 'Main Account',
      sort_code: ALEX.sortCode,
      account_number: ALEX.accountNumber,
      balance: ALEX.balance,
      type: 'main',
    }],
    { onConflict: 'id' }
  );
  console.log(maErr ? `  ✗ mock_accounts: ${maErr.message}` : '  ✓ mock_accounts');
}

// ---------------------------------------------------------------------------
// Phase 4: Generate Deterministic Transactions
// ---------------------------------------------------------------------------

interface TransactionRow {
  user_id: string;
  merchant_name: string;
  merchant_name_normalised: string;
  amount: number;
  primary_category: string;
  detailed_category: string;
  category_icon: string;
  posted_at: string;
  is_recurring: boolean;
  reference: string | null;
}

function lookupCategory(merchant: string): { primary: string; detailed: string; icon: string } {
  const cat = MERCHANT_CATEGORY_MAP[merchant];
  if (cat) return { primary: cat.primaryCategory, detailed: cat.detailedCategory, icon: cat.icon };
  return { primary: 'GENERAL_MERCHANDISE', detailed: 'GENERAL', icon: '📋' };
}

function generateTransactions(userId: string): TransactionRow[] {
  const transactions: TransactionRow[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Generate 3 months of data: current month and 2 prior months
  const monthConfigs = [
    { offset: -2, name: 'january' as const },
    { offset: -1, name: 'february' as const },
    { offset: 0, name: 'march' as const },
  ];

  const monthDates = monthConfigs.map((m) => {
    const d = new Date(currentYear, currentMonth + m.offset, 1);
    return { year: d.getFullYear(), month: d.getMonth(), name: m.name };
  });

  for (const { year, month, name } of monthDates) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const spending = ALEX.monthlySpending[name];

    // --- Fixed monthly transactions ---

    // Salary (28th)
    const salaryDay = Math.min(TRANSACTION_TEMPLATES.salary.dayOfMonth, daysInMonth);
    const salaryCat = lookupCategory(TRANSACTION_TEMPLATES.salary.merchant);
    transactions.push({
      user_id: userId,
      merchant_name: TRANSACTION_TEMPLATES.salary.merchant,
      merchant_name_normalised: TRANSACTION_TEMPLATES.salary.merchant.toLowerCase(),
      amount: TRANSACTION_TEMPLATES.salary.amount,
      primary_category: salaryCat.primary,
      detailed_category: salaryCat.detailed,
      category_icon: salaryCat.icon,
      posted_at: new Date(year, month, salaryDay, 9, 0).toISOString(),
      is_recurring: true,
      reference: 'Monthly salary',
    });

    // Rent (1st)
    const rentCat = lookupCategory(TRANSACTION_TEMPLATES.rent.merchant);
    transactions.push({
      user_id: userId,
      merchant_name: TRANSACTION_TEMPLATES.rent.merchant,
      merchant_name_normalised: TRANSACTION_TEMPLATES.rent.merchant.toLowerCase(),
      amount: TRANSACTION_TEMPLATES.rent.amount,
      primary_category: rentCat.primary,
      detailed_category: rentCat.detailed,
      category_icon: rentCat.icon,
      posted_at: new Date(year, month, 1, 8, 0).toISOString(),
      is_recurring: true,
      reference: 'Rent',
    });

    // Subscriptions
    for (const sub of TRANSACTION_TEMPLATES.subscriptions) {
      const day = Math.min(sub.dayOfMonth, daysInMonth);
      const cat = lookupCategory(sub.merchant);
      transactions.push({
        user_id: userId,
        merchant_name: sub.merchant,
        merchant_name_normalised: sub.merchant.toLowerCase(),
        amount: sub.amount,
        primary_category: cat.primary,
        detailed_category: cat.detailed,
        category_icon: cat.icon,
        posted_at: new Date(year, month, day, 7, 0).toISOString(),
        is_recurring: true,
        reference: null,
      });
    }

    // --- Variable spending ---

    // Groceries
    const groceryTxns = distributeCategory(
      userId, year, month,
      TRANSACTION_TEMPLATES.groceries,
      Math.abs(spending.groceries),
      3, 3
    );
    transactions.push(...groceryTxns);

    // Dining (with March spike — more transactions)
    const diningTxns = distributeCategory(
      userId, year, month,
      TRANSACTION_TEMPLATES.dining,
      Math.abs(spending.dining),
      2, 2,
      name === 'march' // double up amounts for spike
    );
    transactions.push(...diningTxns);

    // Transport
    const transportTxns = distributeCategory(
      userId, year, month,
      TRANSACTION_TEMPLATES.transport,
      Math.abs(spending.transport),
      2, 3
    );
    transactions.push(...transportTxns);

    // Shopping (Currys placed relative to today in March for flex eligibility)
    const shoppingTxns = distributeCategory(
      userId, year, month,
      TRANSACTION_TEMPLATES.shopping,
      Math.abs(spending.shopping),
      5, 6,
      false,
      name === 'march' ? 'Currys' : undefined
    );
    transactions.push(...shoppingTxns);
  }

  return transactions;
}

function distributeCategory(
  userId: string,
  year: number,
  month: number,
  templates: ReadonlyArray<{ merchant: string; amounts: readonly number[]; logicalCategory?: string }>,
  target: number,
  startDay: number,
  dayStep: number,
  doubleUp = false,
  flexMerchant?: string,
): TransactionRow[] {
  const txns: TransactionRow[] = [];
  let total = 0;
  let dayOffset = startDay;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (const m of templates) {
    const amounts = doubleUp ? [...m.amounts, ...m.amounts.slice(0, 2)] : [...m.amounts];
    for (const amount of amounts) {
      if (total + amount > target + 5) break;

      let day: number;
      if (flexMerchant && m.merchant === flexMerchant) {
        const flexDate = new Date();
        flexDate.setDate(flexDate.getDate() - ALEX.flexEligibleTransaction.daysAgo);
        day = flexDate.getDate();
      } else {
        day = Math.min(dayOffset, daysInMonth);
      }

      const cat = lookupCategory(m.merchant);
      txns.push({
        user_id: userId,
        merchant_name: m.merchant,
        merchant_name_normalised: m.merchant.toLowerCase(),
        amount,
        primary_category: cat.primary,
        detailed_category: cat.detailed,
        category_icon: cat.icon,
        posted_at: new Date(year, month, day, 10 + (dayOffset % 8), 30).toISOString(),
        is_recurring: false,
        reference: null,
      });
      total += amount;
      dayOffset += dayStep;
    }
  }

  // Adjust last transaction to hit target exactly
  if (txns.length > 0 && Math.abs(total - target) > 0.01) {
    const diff = target - total;
    txns[txns.length - 1].amount = Math.round((txns[txns.length - 1].amount + diff) * 100) / 100;
  }

  return txns;
}

async function insertTransactions() {
  console.log('Phase 4: Generating transactions...');

  const alexId = getUserId(ALEX);
  const transactions = generateTransactions(alexId);

  console.log(`  → Generated ${transactions.length} transactions`);

  // Clear existing
  await supabase.from('transactions').delete().eq('user_id', alexId);

  // Insert in batches
  const batchSize = 50;
  let inserted = 0;
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);
    const { error } = await supabase.from('transactions').insert(batch);
    if (error) {
      console.error(`  ✗ Batch ${Math.floor(i / batchSize) + 1}:`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`  ✓ Inserted ${inserted} transactions`);

  // Quick verification
  const { count } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', alexId);
  console.log(`  → Verified: ${count} transactions in DB`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Agentic Bank Seed Script ===\n');

  await createAuthUsers();
  await upsertProfiles();
  await seedStaticData();
  await insertTransactions();

  console.log('\n=== Seed complete ===');
  console.log(`Alex Chen: ${ALEX.email} / ${ALEX.password}`);
  console.log(`Emma Test: ${EMMA.email} / ${EMMA.password}`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
