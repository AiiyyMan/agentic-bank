/**
 * Transaction Categorisation Service (CB-04a through CB-04d)
 *
 * Hybrid pipeline: rules → merchant cache → Haiku fallback
 * Uses Plaid PFCv2 taxonomy (16 primary, 111 detailed categories).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { normaliseMerchant, lookupMerchantRule, type CategoryResult } from './merchant-normaliser.js';
import { logger } from '../logger.js';
import { CLAUDE_MODEL_FAST } from '../lib/config.js';

// ---------------------------------------------------------------------------
// Subscription / Recurring Detection (CB-04d)
// ---------------------------------------------------------------------------

const SUBSCRIPTION_MERCHANTS = new Set([
  'NETFLIX', 'SPOTIFY', 'DISNEY+', 'APPLE.COM/BILL', 'AMAZON PRIME',
  'YOUTUBE', 'ICLOUD', 'GYM - PUREGYM', 'PUREGYM', 'THE GYM',
  'BRITISH GAS', 'EDF', 'THAMES WATER', 'NOW TV', 'SKY',
  'BT', 'VIRGIN MEDIA', 'THREE', 'EE', 'VODAFONE', 'O2',
]);

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CategorisationService {
  private anthropic: Anthropic | null = null;

  constructor(private supabase: SupabaseClient) {}

  /**
   * Categorise a transaction by merchant name.
   *
   * Pipeline: rule-based → cache → Haiku fallback → GENERAL_MERCHANDISE
   */
  async categorise(merchantName: string): Promise<CategoryResult & { is_recurring: boolean }> {
    const normalised = normaliseMerchant(merchantName);
    const is_recurring = this.detectRecurring(normalised);

    // 1. Rule-based lookup
    const ruleResult = lookupMerchantRule(normalised);
    if (ruleResult) {
      return { ...ruleResult, is_recurring };
    }

    // 2. Cache lookup
    const cached = await this.lookupCache(normalised);
    if (cached) {
      return { ...cached, is_recurring };
    }

    // 3. Haiku fallback
    const haikuResult = await this.categoriseWithHaiku(normalised);
    if (haikuResult) {
      await this.writeCache(normalised, haikuResult);
      return { ...haikuResult, is_recurring };
    }

    // 4. Default fallback
    const fallback: CategoryResult = {
      primary_category: 'GENERAL_MERCHANDISE',
      detailed_category: 'GENERAL',
      category_icon: '🏷️',
    };
    await this.writeCache(normalised, fallback);
    return { ...fallback, is_recurring };
  }

  /**
   * Check if a merchant is a known subscription / recurring charge.
   */
  detectRecurring(normalised: string): boolean {
    return SUBSCRIPTION_MERCHANTS.has(normalised);
  }

  // ---------------------------------------------------------------------------
  // Cache (CB-04b)
  // ---------------------------------------------------------------------------

  private async lookupCache(normalised: string): Promise<CategoryResult | null> {
    try {
      const { data } = await this.supabase
        .from('merchant_categories')
        .select('primary_category, detailed_category, category_icon')
        .eq('merchant_name_normalised', normalised)
        .single();

      if (data) {
        return {
          primary_category: data.primary_category,
          detailed_category: data.detailed_category,
          category_icon: data.category_icon,
        };
      }
    } catch {
      // Cache miss or error — fall through
    }
    return null;
  }

  private async writeCache(normalised: string, result: CategoryResult): Promise<void> {
    try {
      await this.supabase
        .from('merchant_categories')
        .upsert({
          merchant_name_normalised: normalised,
          primary_category: result.primary_category,
          detailed_category: result.detailed_category,
          category_icon: result.category_icon,
        }, { onConflict: 'merchant_name_normalised' });
    } catch (err) {
      logger.warn({ normalised, err }, 'Failed to write merchant cache');
    }
  }

  // ---------------------------------------------------------------------------
  // Haiku Fallback (CB-04c)
  // ---------------------------------------------------------------------------

  private async categoriseWithHaiku(normalised: string): Promise<CategoryResult | null> {
    try {
      if (!this.anthropic) {
        this.anthropic = new Anthropic();
      }

      const response = await this.anthropic.messages.create({
        model: CLAUDE_MODEL_FAST,
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: `Categorise this UK merchant into Plaid PFCv2 taxonomy.

Merchant: "${normalised}"

Reply with ONLY a JSON object, no other text:
{"primary_category": "<PFCv2_PRIMARY>", "detailed_category": "<PFCv2_DETAILED>", "category_icon": "<single_emoji>"}

Primary categories: INCOME, TRANSFER_IN, TRANSFER_OUT, LOAN_PAYMENTS, BANK_FEES, ENTERTAINMENT, FOOD_AND_DRINK, GENERAL_MERCHANDISE, HOME_IMPROVEMENT, MEDICAL, PERSONAL_CARE, GENERAL_SERVICES, GOVERNMENT_AND_NON_PROFIT, TRANSPORTATION, TRAVEL, RENT_AND_UTILITIES`,
        }],
      });

      const text = response.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('');

      const parsed = JSON.parse(text);
      if (parsed.primary_category && parsed.detailed_category && parsed.category_icon) {
        return {
          primary_category: parsed.primary_category,
          detailed_category: parsed.detailed_category,
          category_icon: parsed.category_icon,
        };
      }
    } catch (err) {
      logger.warn({ normalised, err }, 'Haiku categorisation failed — using fallback');
    }
    return null;
  }
}
