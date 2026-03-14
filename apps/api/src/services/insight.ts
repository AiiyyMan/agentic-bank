/**
 * InsightService — Spending intelligence and proactive card engine (EXN-01 to EXN-05)
 *
 * Reads from local transactions table (NOT BankingPort).
 * Groups by PFCv2 primary_category, computes rolling averages,
 * detects spending spikes, and generates proactive insight cards.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DateRange {
  start_date: string; // ISO 8601
  end_date: string;   // ISO 8601
}

export interface CategorySpending {
  category: string;
  amount: number;
  percent: number;
  transaction_count: number;
}

export interface SpendingBreakdown {
  period: string;
  total_spent: number;
  categories: CategorySpending[];
  comparison?: {
    previous_total: number;
    change_amount: number;
    change_percent: number;
    direction: 'up' | 'down' | 'flat';
  };
}

export interface WeeklySummary {
  week_start: string;
  week_end: string;
  total_spent: number;
  top_categories: CategorySpending[];
  comparison?: {
    previous_total: number;
    change_percent: number;
    direction: 'up' | 'down' | 'flat';
    partial_week?: boolean;
    days_included?: number;
  };
}

export interface SpendingSpike {
  category: string;
  current_amount: number;
  average_amount: number;
  spike_ratio: number;
  percent_increase: number;
}

export interface ProactiveCard {
  type: string;
  priority: number; // 1=time-sensitive, 2=actionable, 3=informational, 4=celebratory
  title: string;
  message: string;
  data: Record<string, unknown>;
  quick_replies?: Array<{ label: string; value: string }>;
}

export interface UpcomingBill {
  merchant_name: string;
  amount: number;
  expected_date: string;
  category: string;
}

export interface CategoryAverage {
  category: string;
  daily_average: number;
  monthly_average: number;
  transaction_count: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class InsightService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * EXN-02: Get spending breakdown by category for a date range.
   */
  async getSpendingByCategory(userId: string, period: DateRange): Promise<SpendingBreakdown> {
    const { data: txns } = await this.supabase
      .from('transactions')
      .select('amount, primary_category, posted_at')
      .eq('user_id', userId)
      .gte('posted_at', period.start_date)
      .lte('posted_at', period.end_date)
      .lt('amount', 0) as any; // Only debits (negative amounts represent spending)

    const transactions = (txns as any[]) || [];

    // Group by category
    const categoryMap = new Map<string, { amount: number; count: number }>();
    let totalSpent = 0;

    for (const tx of transactions) {
      const amount = Math.abs(Number(tx.amount));
      const category = tx.primary_category || 'GENERAL_MERCHANDISE';
      totalSpent += amount;

      const existing = categoryMap.get(category) || { amount: 0, count: 0 };
      existing.amount += amount;
      existing.count += 1;
      categoryMap.set(category, existing);
    }

    // Also count positive amounts as spending for outbound transfers
    const { data: outbound } = await this.supabase
      .from('transactions')
      .select('amount, primary_category')
      .eq('user_id', userId)
      .gte('posted_at', period.start_date)
      .lte('posted_at', period.end_date)
      .in('primary_category', ['TRANSFER_OUT', 'LOAN_PAYMENTS', 'BANK_FEES'])
      .gt('amount', 0) as any;

    for (const tx of ((outbound as any[]) || [])) {
      const amount = Math.abs(Number(tx.amount));
      const category = tx.primary_category;
      totalSpent += amount;
      const existing = categoryMap.get(category) || { amount: 0, count: 0 };
      existing.amount += amount;
      existing.count += 1;
      categoryMap.set(category, existing);
    }

    const categories: CategorySpending[] = Array.from(categoryMap.entries())
      .map(([category, { amount, count }]) => ({
        category,
        amount: roundMoney(amount),
        percent: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
        transaction_count: count,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Compute comparison with previous period
    const periodMs = new Date(period.end_date).getTime() - new Date(period.start_date).getTime();
    const prevStart = new Date(new Date(period.start_date).getTime() - periodMs).toISOString();
    const prevEnd = period.start_date;

    const prevBreakdown = await this.getSpendingTotal(userId, prevStart, prevEnd);
    const comparison = this.computeComparison(totalSpent, prevBreakdown);

    return {
      period: `${period.start_date} to ${period.end_date}`,
      total_spent: roundMoney(totalSpent),
      categories,
      comparison: comparison || undefined,
    };
  }

  /**
   * EXN-03: Get weekly spending summary.
   */
  async getWeeklySummary(userId: string): Promise<WeeklySummary> {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - mondayOffset);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(now);
    weekEnd.setHours(23, 59, 59, 999);

    const breakdown = await this.getSpendingByCategory(userId, {
      start_date: weekStart.toISOString(),
      end_date: weekEnd.toISOString(),
    });

    // Previous week comparison
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(weekStart);
    prevWeekEnd.setMilliseconds(-1);

    const prevTotal = await this.getSpendingTotal(
      userId,
      prevWeekStart.toISOString(),
      prevWeekEnd.toISOString(),
    );

    const daysIntoWeek = mondayOffset + 1;
    const comparison = this.computeComparison(breakdown.total_spent, prevTotal);

    return {
      week_start: weekStart.toISOString().split('T')[0],
      week_end: weekEnd.toISOString().split('T')[0],
      total_spent: breakdown.total_spent,
      top_categories: breakdown.categories.slice(0, 3),
      comparison: comparison
        ? {
            ...comparison,
            partial_week: daysIntoWeek < 7,
            days_included: daysIntoWeek,
          }
        : undefined,
    };
  }

  /**
   * EXN-04: Detect spending spikes — Monzo-style rolling window approach.
   *
   * Compares actual spend in the last 30 days against actual spend in the
   * prior 30-day period (30–60 days ago). No extrapolation — both windows
   * are complete, so early-month false spikes are eliminated.
   *
   * Threshold: 1.8x (higher than naive extrapolation since we compare real
   * amounts, not projections). Noise guards: £10 minimum, 2+ transactions.
   */
  async detectSpendingSpikes(userId: string): Promise<SpendingSpike[]> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Current window: last 30 days (actual, no projection)
    const current = await this.getSpendingByCategory(userId, {
      start_date: thirtyDaysAgo.toISOString(),
      end_date: now.toISOString(),
    });

    // Baseline window: prior 30 days (30–60 days ago)
    const baseline = await this.getSpendingByCategory(userId, {
      start_date: sixtyDaysAgo.toISOString(),
      end_date: thirtyDaysAgo.toISOString(),
    });

    if (baseline.total_spent === 0) return []; // Not enough history

    const baselineMap = new Map(baseline.categories.map(c => [c.category, c]));
    const spikes: SpendingSpike[] = [];

    for (const cat of current.categories) {
      // Noise guards: ignore trivial spend and single transactions
      if (cat.amount < 10) continue;
      if (cat.transaction_count < 2) continue;

      const base = baselineMap.get(cat.category);
      if (!base || base.amount <= 0) continue;

      const spikeRatio = cat.amount / base.amount;

      if (spikeRatio >= 1.8) {
        spikes.push({
          category: cat.category,
          current_amount: roundMoney(cat.amount),
          average_amount: roundMoney(base.amount),
          spike_ratio: roundMoney(spikeRatio),
          percent_increase: Math.round((spikeRatio - 1) * 100),
        });
      }
    }

    return spikes.sort((a, b) => b.spike_ratio - a.spike_ratio);
  }

  /**
   * EXN-01: Compute 30-day rolling averages per category.
   */
  async computeCategoryAverages(userId: string): Promise<CategoryAverage[]> {
    // Check cache first
    const { data: cached } = await this.supabase
      .from('user_insights_cache')
      .select('category_averages, updated_at')
      .eq('user_id', userId)
      .single() as any;

    // Use cache if less than 1 hour old
    if (cached?.category_averages) {
      const cacheAge = Date.now() - new Date(cached.updated_at).getTime();
      if (cacheAge < 60 * 60 * 1000) {
        return cached.category_averages;
      }
    }

    // Compute from transactions
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Only debit transactions for spending averages (exclude income)
    const { data: txns } = await this.supabase
      .from('transactions')
      .select('amount, primary_category')
      .eq('user_id', userId)
      .gte('posted_at', thirtyDaysAgo)
      .lt('amount', 0) as any;

    const transactions = (txns as any[]) || [];
    if (transactions.length === 0) return [];

    const categoryMap = new Map<string, { total: number; count: number }>();

    for (const tx of transactions) {
      const amount = Math.abs(Number(tx.amount));
      const category = tx.primary_category || 'GENERAL_MERCHANDISE';
      const existing = categoryMap.get(category) || { total: 0, count: 0 };
      existing.total += amount;
      existing.count += 1;
      categoryMap.set(category, existing);
    }

    const averages: CategoryAverage[] = Array.from(categoryMap.entries()).map(
      ([category, { total, count }]) => ({
        category,
        daily_average: roundMoney(total / 30),
        monthly_average: roundMoney(total),
        transaction_count: count,
      }),
    );

    // Update cache
    const { error: cacheError } = await this.supabase
      .from('user_insights_cache')
      .upsert({
        user_id: userId,
        category_averages: averages,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }) as any;
    if (cacheError) logger.warn({ error: cacheError.message, userId }, 'Failed to update insights cache');

    return averages;
  }

  /**
   * EXN-05: Proactive card engine — evaluate trigger rules, rank, limit to 3.
   */
  async getProactiveCards(userId: string): Promise<ProactiveCard[]> {
    const cards: ProactiveCard[] = [];

    // 1. Spending spikes (priority 2 — actionable)
    try {
      const spikes = await this.detectSpendingSpikes(userId);
      for (const spike of spikes.slice(0, 2)) {
        cards.push({
          type: 'spending_spike',
          priority: 2,
          title: `${formatCategory(spike.category)} spending is up`,
          message: `You've spent £${spike.current_amount.toFixed(2)} on ${formatCategory(spike.category).toLowerCase()} this month — ${spike.percent_increase}% more than your usual £${spike.average_amount.toFixed(2)}.`,
          data: spike as unknown as Record<string, unknown>,
          quick_replies: [
            { label: 'Show transactions', value: `Show me my ${formatCategory(spike.category).toLowerCase()} transactions` },
            { label: 'Set a budget', value: `Help me budget for ${formatCategory(spike.category).toLowerCase()}` },
          ],
        });
      }
    } catch (err: any) {
      logger.warn({ err: err.message, userId }, 'Failed to compute spending spikes for proactive cards');
    }

    // 2. Upcoming recurring bills (priority 1 — time-sensitive)
    try {
      const bills = await this.getUpcomingBills(userId, 2);
      for (const bill of bills.slice(0, 2)) {
        cards.push({
          type: 'bill_reminder',
          priority: 1,
          title: `${bill.merchant_name} payment due`,
          message: `£${bill.amount.toFixed(2)} expected on ${formatDate(bill.expected_date)}.`,
          data: bill as unknown as Record<string, unknown>,
          quick_replies: [
            { label: 'Check balance', value: 'What\'s my balance?' },
          ],
        });
      }
    } catch (err: any) {
      logger.warn({ err: err.message, userId }, 'Failed to fetch upcoming bills for proactive cards');
    }

    // 3. Savings pot milestones (priority 4 — celebratory)
    try {
      const { data: pots } = await this.supabase
        .from('pots')
        .select('name, balance, goal, emoji')
        .eq('user_id', userId)
        .eq('is_closed', false)
        .not('goal', 'is', null) as any;

      for (const pot of ((pots as any[]) || [])) {
        const progress = pot.goal > 0 ? (Number(pot.balance) / Number(pot.goal)) * 100 : 0;
        if (progress >= 75 && progress < 100) {
          cards.push({
            type: 'savings_milestone',
            priority: 4,
            title: `${pot.emoji || '🎯'} ${pot.name} is ${Math.round(progress)}% funded!`,
            message: `£${Number(pot.balance).toFixed(2)} of £${Number(pot.goal).toFixed(2)} — almost there!`,
            data: { pot_name: pot.name, progress: Math.round(progress) },
            quick_replies: [
              { label: 'Add more', value: `Add money to my ${pot.name} pot` },
            ],
          });
        } else if (progress >= 100) {
          cards.push({
            type: 'savings_milestone',
            priority: 4,
            title: `${pot.emoji || '🎉'} ${pot.name} goal reached!`,
            message: `You've hit your £${Number(pot.goal).toFixed(2)} target. Amazing work!`,
            data: { pot_name: pot.name, progress: Math.round(progress) },
          });
        }
      }
    } catch (err: any) {
      logger.warn({ err: err.message, userId }, 'Failed to check pot milestones for proactive cards');
    }

    // 4. Weekly summary (if Monday, priority 3 — informational)
    const now = new Date();
    if (now.getDay() === 1) { // Monday
      try {
        const weekly = await this.getWeeklySummary(userId);
        if (weekly.total_spent > 0 && weekly.comparison) {
          const dir = weekly.comparison.direction === 'up' ? 'more' : 'less';
          cards.push({
            type: 'weekly_summary',
            priority: 3,
            title: 'Last week\'s spending',
            message: `You spent £${weekly.total_spent.toFixed(2)} last week — ${Math.abs(weekly.comparison.change_percent)}% ${dir} than the week before.`,
            data: weekly as unknown as Record<string, unknown>,
            quick_replies: [
              { label: 'Show breakdown', value: 'Show my spending breakdown for last week' },
            ],
          });
        }
      } catch (err: any) {
        logger.warn({ err: err.message, userId }, 'Failed to compute weekly summary for proactive cards');
      }
    }

    // 5-6. Profile-dependent cards (pots funding, checklist progress)
    try {
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('griffin_account_url, onboarding_step, checklist_add_money, checklist_create_pot, checklist_add_payee')
        .eq('id', userId)
        .single() as any;

      if (profile?.onboarding_step === 'ONBOARDING_COMPLETE') {
        // 5. Check pots for zero balance (funding reminder, priority 3)
        try {
          const { data: potsList } = await this.supabase
            .from('pots')
            .select('name')
            .eq('user_id', userId)
            .eq('is_closed', false)
            .eq('balance', 0) as any;

          if (((potsList as any[]) || []).length > 0) {
            const emptyPot = (potsList as any[])[0];
            cards.push({
              type: 'funding_reminder',
              priority: 3,
              title: `${emptyPot.name} is empty`,
              message: 'Add some funds to start saving towards your goal.',
              data: { pot_name: emptyPot.name },
              quick_replies: [
                { label: 'Add funds', value: `Add money to my ${emptyPot.name} pot` },
              ],
            });
          }
        } catch (err: any) {
          logger.warn({ err: err.message, userId }, 'Failed to check empty pots for proactive cards');
        }

        // 6. Onboarding checklist progress (priority 2)
        const items = [
          profile.checklist_add_money,
          profile.checklist_create_pot,
          profile.checklist_add_payee,
        ];
        const completed = items.filter(Boolean).length;
        const total = items.length;
        if (completed < total) {
          cards.push({
            type: 'onboarding_checklist',
            priority: 2,
            title: `Getting started: ${completed + 2}/${total + 2} complete`,
            message: 'Complete your setup to get the most from Agentic Bank.',
            data: { completed: completed + 2, total: total + 2 },
            quick_replies: [
              { label: 'Show checklist', value: 'Show my getting started checklist' },
            ],
          });
        }
      }
    } catch (err: any) {
      logger.warn({ err: err.message, userId }, 'Failed to fetch profile for proactive cards');
    }

    // Rank by priority (lowest number = highest priority), limit to 3
    return cards
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 3);
  }

  /**
   * Get upcoming recurring bills within N days.
   */
  async getUpcomingBills(userId: string, daysAhead: number): Promise<UpcomingBill[]> {
    // Find recurring transactions and estimate next occurrence
    const { data: recurring } = await this.supabase
      .from('transactions')
      .select('merchant_name, amount, primary_category, posted_at')
      .eq('user_id', userId)
      .eq('is_recurring', true)
      .order('posted_at', { ascending: false }) as any;

    if (!recurring || recurring.length === 0) return [];

    // Group by merchant to find latest occurrence
    const merchantLatest = new Map<string, any>();
    for (const tx of (recurring as any[])) {
      if (!merchantLatest.has(tx.merchant_name)) {
        merchantLatest.set(tx.merchant_name, tx);
      }
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const bills: UpcomingBill[] = [];

    for (const [name, tx] of merchantLatest) {
      // Estimate next bill as ~30 days after last
      const lastDate = new Date(tx.posted_at);
      const nextDate = new Date(lastDate);
      nextDate.setMonth(nextDate.getMonth() + 1);

      if (nextDate >= now && nextDate <= cutoff) {
        bills.push({
          merchant_name: name,
          amount: Math.abs(Number(tx.amount)),
          expected_date: nextDate.toISOString().split('T')[0],
          category: tx.primary_category,
        });
      }
    }

    return bills.sort((a, b) =>
      new Date(a.expected_date).getTime() - new Date(b.expected_date).getTime(),
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async getSpendingTotal(userId: string, startDate: string, endDate: string): Promise<number> {
    // Debits (negative amounts)
    const { data: debits } = await this.supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .gte('posted_at', startDate)
      .lte('posted_at', endDate)
      .lt('amount', 0) as any;

    let total = ((debits as any[]) || []).reduce(
      (sum: number, tx: any) => sum + Math.abs(Number(tx.amount)),
      0,
    );

    // Outbound transfers (positive amounts in spending categories)
    const { data: outbound } = await this.supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .gte('posted_at', startDate)
      .lte('posted_at', endDate)
      .in('primary_category', ['TRANSFER_OUT', 'LOAN_PAYMENTS', 'BANK_FEES'])
      .gt('amount', 0) as any;

    total += ((outbound as any[]) || []).reduce(
      (sum: number, tx: any) => sum + Math.abs(Number(tx.amount)),
      0,
    );

    return total;
  }

  private computeComparison(
    current: number,
    previous: number,
  ): { previous_total: number; change_amount: number; change_percent: number; direction: 'up' | 'down' | 'flat' } | null {
    if (previous === 0 && current === 0) return null;

    const change = current - previous;
    const changePct = previous > 0 ? Math.round((change / previous) * 100) : current > 0 ? 100 : 0;
    const direction = changePct > 2 ? 'up' : changePct < -2 ? 'down' : 'flat';

    return {
      previous_total: roundMoney(previous),
      change_amount: roundMoney(change),
      change_percent: changePct,
      direction,
    };
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatCategory(category: string): string {
  return category
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
