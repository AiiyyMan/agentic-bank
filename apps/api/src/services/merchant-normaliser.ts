/**
 * Merchant Normaliser — Strips suffixes, normalises casing, maps to PFCv2 categories.
 *
 * Part of the transaction categorisation pipeline (CB-04a).
 * Rule-based map covers top 50 UK merchants.
 */

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

const STRIP_SUFFIXES = [
  /\bLTD\.?$/i,
  /\bPLC\.?$/i,
  /\b& CO\.?$/i,
  /\bLIMITED$/i,
  /\bINC\.?$/i,
  /\bCORP\.?$/i,
  /\bGROUP$/i,
  /\bSTORES?$/i,
  /\bUK$/i,
  /\bGB$/i,
  /\b\*+$/,            // trailing asterisks from card networks
  /\b\d{4,}$/,         // trailing reference numbers
];

/**
 * Normalise a merchant name for consistent lookup.
 * "TESCO STORES LTD" → "TESCO"
 * "Pret A Manger GB" → "PRET A MANGER"
 */
export function normaliseMerchant(raw: string): string {
  let name = raw.trim().toUpperCase();

  // Strip suffixes
  for (const pattern of STRIP_SUFFIXES) {
    name = name.replace(pattern, '').trim();
  }

  // Collapse whitespace
  name = name.replace(/\s+/g, ' ').trim();

  return name;
}

// ---------------------------------------------------------------------------
// Category Result
// ---------------------------------------------------------------------------

export interface CategoryResult {
  primary_category: string;
  detailed_category: string;
  category_icon: string;
}

// ---------------------------------------------------------------------------
// Rule-Based Map — Top 50 UK Merchants
// ---------------------------------------------------------------------------

const MERCHANT_RULES: Record<string, CategoryResult> = {
  // Groceries
  'TESCO': { primary_category: 'FOOD_AND_DRINK', detailed_category: 'GROCERIES', category_icon: '🛒' },
  'SAINSBURYS': { primary_category: 'FOOD_AND_DRINK', detailed_category: 'GROCERIES', category_icon: '🛒' },
  'SAINSBURY': { primary_category: 'FOOD_AND_DRINK', detailed_category: 'GROCERIES', category_icon: '🛒' },
  'ASDA': { primary_category: 'FOOD_AND_DRINK', detailed_category: 'GROCERIES', category_icon: '🛒' },
  'MORRISONS': { primary_category: 'FOOD_AND_DRINK', detailed_category: 'GROCERIES', category_icon: '🛒' },
  'WAITROSE': { primary_category: 'FOOD_AND_DRINK', detailed_category: 'GROCERIES', category_icon: '🛒' },
  'ALDI': { primary_category: 'FOOD_AND_DRINK', detailed_category: 'GROCERIES', category_icon: '🛒' },
  'LIDL': { primary_category: 'FOOD_AND_DRINK', detailed_category: 'GROCERIES', category_icon: '🛒' },
  'CO-OP': { primary_category: 'FOOD_AND_DRINK', detailed_category: 'GROCERIES', category_icon: '🛒' },
  'M&S': { primary_category: 'FOOD_AND_DRINK', detailed_category: 'GROCERIES', category_icon: '🛒' },
  'MARKS & SPENCER': { primary_category: 'FOOD_AND_DRINK', detailed_category: 'GROCERIES', category_icon: '🛒' },
  'OCADO': { primary_category: 'FOOD_AND_DRINK', detailed_category: 'GROCERIES', category_icon: '🛒' },

  // Dining
  'PRET A MANGER': { primary_category: 'FOOD_AND_DRINK', detailed_category: 'DINING', category_icon: '🍽️' },
  'PRET': { primary_category: 'FOOD_AND_DRINK', detailed_category: 'DINING', category_icon: '🍽️' },
  'NANDOS': { primary_category: 'FOOD_AND_DRINK', detailed_category: 'DINING', category_icon: '🍽️' },
  "NANDO'S": { primary_category: 'FOOD_AND_DRINK', detailed_category: 'DINING', category_icon: '🍽️' },
  'DISHOOM': { primary_category: 'FOOD_AND_DRINK', detailed_category: 'DINING', category_icon: '🍽️' },
  'COSTA': { primary_category: 'FOOD_AND_DRINK', detailed_category: 'COFFEE_SHOPS', category_icon: '☕' },
  'STARBUCKS': { primary_category: 'FOOD_AND_DRINK', detailed_category: 'COFFEE_SHOPS', category_icon: '☕' },
  'MCDONALDS': { primary_category: 'FOOD_AND_DRINK', detailed_category: 'FAST_FOOD', category_icon: '🍔' },
  'GREGGS': { primary_category: 'FOOD_AND_DRINK', detailed_category: 'FAST_FOOD', category_icon: '🍔' },
  'DELIVEROO': { primary_category: 'FOOD_AND_DRINK', detailed_category: 'DINING', category_icon: '🍽️' },
  'JUST EAT': { primary_category: 'FOOD_AND_DRINK', detailed_category: 'DINING', category_icon: '🍽️' },
  'UBER EATS': { primary_category: 'FOOD_AND_DRINK', detailed_category: 'DINING', category_icon: '🍽️' },

  // Transport
  'TFL': { primary_category: 'TRANSPORTATION', detailed_category: 'PUBLIC_TRANSIT', category_icon: '🚇' },
  'TRANSPORT FOR LONDON': { primary_category: 'TRANSPORTATION', detailed_category: 'PUBLIC_TRANSIT', category_icon: '🚇' },
  'UBER': { primary_category: 'TRANSPORTATION', detailed_category: 'RIDESHARE', category_icon: '🚗' },
  'BOLT': { primary_category: 'TRANSPORTATION', detailed_category: 'RIDESHARE', category_icon: '🚗' },
  'TRAINLINE': { primary_category: 'TRANSPORTATION', detailed_category: 'PUBLIC_TRANSIT', category_icon: '🚆' },
  'NATIONAL RAIL': { primary_category: 'TRANSPORTATION', detailed_category: 'PUBLIC_TRANSIT', category_icon: '🚆' },
  'BP': { primary_category: 'TRANSPORTATION', detailed_category: 'GAS', category_icon: '⛽' },
  'SHELL': { primary_category: 'TRANSPORTATION', detailed_category: 'GAS', category_icon: '⛽' },

  // Entertainment & Subscriptions
  'NETFLIX': { primary_category: 'ENTERTAINMENT', detailed_category: 'STREAMING', category_icon: '🎬' },
  'SPOTIFY': { primary_category: 'ENTERTAINMENT', detailed_category: 'STREAMING', category_icon: '🎵' },
  'DISNEY+': { primary_category: 'ENTERTAINMENT', detailed_category: 'STREAMING', category_icon: '🎬' },
  'APPLE.COM/BILL': { primary_category: 'ENTERTAINMENT', detailed_category: 'STREAMING', category_icon: '📱' },
  'AMAZON PRIME': { primary_category: 'ENTERTAINMENT', detailed_category: 'STREAMING', category_icon: '📦' },
  'YOUTUBE': { primary_category: 'ENTERTAINMENT', detailed_category: 'STREAMING', category_icon: '🎬' },

  // Shopping
  'AMAZON': { primary_category: 'GENERAL_MERCHANDISE', detailed_category: 'ONLINE_RETAIL', category_icon: '🛍️' },
  'ASOS': { primary_category: 'GENERAL_MERCHANDISE', detailed_category: 'CLOTHING', category_icon: '🛍️' },
  'CURRYS': { primary_category: 'GENERAL_MERCHANDISE', detailed_category: 'ELECTRONICS', category_icon: '🛍️' },
  'JOHN LEWIS': { primary_category: 'GENERAL_MERCHANDISE', detailed_category: 'DEPARTMENT_STORES', category_icon: '🛍️' },
  'ARGOS': { primary_category: 'GENERAL_MERCHANDISE', detailed_category: 'ONLINE_RETAIL', category_icon: '🛍️' },
  'PRIMARK': { primary_category: 'GENERAL_MERCHANDISE', detailed_category: 'CLOTHING', category_icon: '🛍️' },
  'NEXT': { primary_category: 'GENERAL_MERCHANDISE', detailed_category: 'CLOTHING', category_icon: '🛍️' },
  'IKEA': { primary_category: 'HOME_IMPROVEMENT', detailed_category: 'FURNITURE', category_icon: '🏠' },
  'B&Q': { primary_category: 'HOME_IMPROVEMENT', detailed_category: 'HARDWARE', category_icon: '🔧' },

  // Utilities
  'ICLOUD': { primary_category: 'RENT_AND_UTILITIES', detailed_category: 'CLOUD_STORAGE', category_icon: '☁️' },
  'BRITISH GAS': { primary_category: 'RENT_AND_UTILITIES', detailed_category: 'GAS_AND_ELECTRICITY', category_icon: '💡' },
  'EDF': { primary_category: 'RENT_AND_UTILITIES', detailed_category: 'GAS_AND_ELECTRICITY', category_icon: '💡' },
  'THAMES WATER': { primary_category: 'RENT_AND_UTILITIES', detailed_category: 'WATER', category_icon: '💧' },

  // Health
  'GYM - PUREGYM': { primary_category: 'MEDICAL', detailed_category: 'GYM', category_icon: '💪' },
  'PUREGYM': { primary_category: 'MEDICAL', detailed_category: 'GYM', category_icon: '💪' },
  'THE GYM': { primary_category: 'MEDICAL', detailed_category: 'GYM', category_icon: '💪' },
  'BOOTS': { primary_category: 'MEDICAL', detailed_category: 'PHARMACIES', category_icon: '💊' },
};

/**
 * Look up a normalised merchant name in the rule-based map.
 * Returns null if no rule matches.
 */
export function lookupMerchantRule(normalised: string): CategoryResult | null {
  return MERCHANT_RULES[normalised] ?? null;
}

/**
 * Convenience: normalise + lookup in one call.
 */
export function categoriseByRules(rawMerchant: string): CategoryResult | null {
  const normalised = normaliseMerchant(rawMerchant);
  return lookupMerchantRule(normalised);
}
