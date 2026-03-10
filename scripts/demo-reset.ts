/**
 * Demo Reset — Resets Alex and Emma to seed state.
 *
 * Usage: npx tsx scripts/demo-reset.ts
 *
 * Clears conversations, messages, pending actions, insights, loans,
 * resets pots/accounts to seed values, then regenerates transactions
 * by calling seed.ts.
 */

import { createClient } from '@supabase/supabase-js';
import { resolve } from 'path';
import { config } from 'dotenv';
import { execSync } from 'child_process';

import { ALEX, EMMA } from '@agentic-bank/shared';

config({ path: resolve(__dirname, '../apps/api/.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserId(email: string, fallbackId: string): Promise<string> {
  const { data } = await supabase.auth.admin.listUsers();
  return data?.users?.find((u) => u.email === email)?.id ?? fallbackId;
}

async function main() {
  console.log('=== Demo Reset ===\n');

  const alexId = await findUserId(ALEX.email, ALEX.id);
  const emmaId = await findUserId(EMMA.email, EMMA.id);
  const userIds = [alexId, emmaId];

  console.log('Phase 1: Clearing ephemeral data...');

  const clearOps: Array<{ table: string; column: string }> = [
    { table: 'messages', column: 'user_id' },
    { table: 'pending_actions', column: 'user_id' },
    { table: 'user_insights_cache', column: 'user_id' },
    { table: 'conversations', column: 'user_id' },
    { table: 'loan_applications', column: 'user_id' },
    { table: 'loans', column: 'user_id' },
    { table: 'audit_log', column: 'actor_id' },
  ];

  for (const { table, column } of clearOps) {
    const { error } = await supabase.from(table).delete().in(column, userIds);
    console.log(error ? `  ✗ ${table}: ${error.message}` : `  ✓ ${table}`);
  }

  console.log('\nPhase 2: Resetting seed data...');

  // Clear pot transfers
  const { error: ptErr } = await supabase.from('pot_transfers').delete().eq('user_id', alexId);
  console.log(ptErr ? `  ✗ pot_transfers: ${ptErr.message}` : '  ✓ pot_transfers');

  // Reset pot balances
  const potResets = [
    { id: 'a0000000-0000-0000-0000-000000000001', balance: ALEX.pots.holiday.balance },
    { id: 'a0000000-0000-0000-0000-000000000002', balance: ALEX.pots.emergency.balance },
    { id: 'a0000000-0000-0000-0000-000000000003', balance: ALEX.pots.house.balance },
  ];
  for (const { id, balance } of potResets) {
    await supabase.from('pots').update({ balance, is_closed: false }).eq('id', id);
  }
  console.log('  ✓ Pots reset');

  // Reset mock account
  await supabase
    .from('mock_accounts')
    .update({ balance: ALEX.balance })
    .eq('id', 'd0000000-0000-0000-0000-000000000001');
  console.log('  ✓ Mock account balance reset');

  // Reset profiles
  await supabase
    .from('profiles')
    .update({ onboarding_step: ALEX.onboardingStep })
    .eq('id', alexId);
  await supabase
    .from('profiles')
    .update({
      onboarding_step: EMMA.onboardingStep,
      griffin_legal_person_url: null,
      griffin_account_url: null,
    })
    .eq('id', emmaId);
  console.log('  ✓ Profiles reset');

  // Clear and regenerate transactions
  await supabase.from('transactions').delete().eq('user_id', alexId);
  console.log('  ✓ Transactions cleared');

  console.log('\nPhase 3: Re-seeding...');
  try {
    execSync('npx tsx scripts/seed.ts', {
      cwd: resolve(__dirname, '..'),
      stdio: 'inherit',
    });
  } catch {
    console.error('  ✗ Re-seed failed. Run manually: npx tsx scripts/seed.ts');
  }

  console.log('\n=== Demo state reset. Alex and Emma are ready. ===');
}

main().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
