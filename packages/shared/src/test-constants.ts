/**
 * Test Constants — Single Source of Truth
 *
 * All seed data, test fixtures, and demo-reset scripts import from here.
 * One change propagates everywhere. If values differ from data-model.md §4.3,
 * THIS FILE is authoritative.
 *
 * Monthly spending totals (Alex, GBP):
 *
 * January:
 *   salary: +3800.00 | rent: -850.00 | groceries: -312.40 | dining: -218.50
 *   transport: -89.60 | shopping: -156.30 | subscriptions: -45.97
 *
 * February:
 *   salary: +3800.00 | rent: -850.00 | groceries: -298.70 | dining: -195.25
 *   transport: -82.40 | shopping: -132.50 | subscriptions: -45.97
 *
 * March:
 *   salary: +3800.00 | rent: -850.00 | groceries: -305.60 | dining: -310.75
 *   transport: -95.20 | shopping: -145.80 | subscriptions: -45.97
 *   dining spike: -310.75 vs Jan -218.50 = +42%
 */

// ---------------------------------------------------------------------------
// PFCv2 Category Mapping
// ---------------------------------------------------------------------------
// DB uses PFCv2 uppercase categories. Logical categories map as:
//   salary     → INCOME
//   rent       → RENT_AND_UTILITIES
//   groceries  → FOOD_AND_DRINK    (detailed_category: 'GROCERIES')
//   dining     → FOOD_AND_DRINK    (detailed_category: 'DINING')
//   transport  → TRANSPORTATION
//   shopping   → GENERAL_MERCHANDISE
//   entertainment → ENTERTAINMENT
//   utilities  → RENT_AND_UTILITIES
//   health     → MEDICAL

export const CATEGORY_MAP: Record<string, { primary: string; detailed: string }> = {
  income: { primary: 'INCOME', detailed: 'SALARY' },
  housing: { primary: 'RENT_AND_UTILITIES', detailed: 'RENT' },
  groceries: { primary: 'FOOD_AND_DRINK', detailed: 'GROCERIES' },
  dining: { primary: 'FOOD_AND_DRINK', detailed: 'DINING' },
  transport: { primary: 'TRANSPORTATION', detailed: 'PUBLIC_TRANSIT' },
  shopping: { primary: 'GENERAL_MERCHANDISE', detailed: 'GENERAL' },
  entertainment: { primary: 'ENTERTAINMENT', detailed: 'STREAMING' },
  utilities: { primary: 'RENT_AND_UTILITIES', detailed: 'CLOUD_STORAGE' },
  health: { primary: 'MEDICAL', detailed: 'GYM' },
  rideshare: { primary: 'TRANSPORTATION', detailed: 'RIDESHARE' },
};

// ---------------------------------------------------------------------------
// Demo Users
// ---------------------------------------------------------------------------

export const ALEX = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'alex@demo.agenticbank.com',
  password: 'demo-password-123',
  displayName: 'Alex Chen',
  balance: 1247.5,
  sortCode: '040075', // DB CHECK: ^\d{6}$
  accountNumber: '12345678',
  currency: 'GBP',
  onboardingStep: 'ONBOARDING_COMPLETE' as const,
  creditScore: 742,
  creditScoreRating: 'good' as const,

  pots: {
    holiday: {
      name: 'Holiday Fund',
      balance: 850.0,
      goal: 2000.0,
      emoji: '✈️',
    },
    emergency: {
      name: 'Emergency Fund',
      balance: 1200.0,
      goal: 1500.0,
      emoji: '🛡️',
      // 80% of goal — triggers savings milestone proactive card
    },
    house: {
      name: 'House Deposit',
      balance: 2000.0,
      goal: 25000.0,
      emoji: '🏠',
    },
  },

  beneficiaryCount: 6, // 5 domestic + 1 international
  beneficiaries: [
    {
      name: 'Mum',
      accountNumber: '11112234',
      sortCode: '040004', // DB CHECK: ^\d{6}$
      type: 'domestic' as const,
    },
    {
      name: 'James',
      accountNumber: '22225678',
      sortCode: '040004',
      type: 'domestic' as const,
      // Fuzzy match pair with "James Wilson"
    },
    {
      name: 'David Brown',
      accountNumber: '33339012',
      sortCode: '040004',
      type: 'domestic' as const,
      // Landlord — standing order recipient
    },
    {
      name: 'Sarah',
      accountNumber: '44443456',
      sortCode: '040004',
      type: 'domestic' as const,
    },
    {
      name: 'James Wilson',
      accountNumber: '55557890',
      sortCode: '040004',
      type: 'domestic' as const,
      // Fuzzy match pair with "James"
    },
    {
      name: 'Wise - Euro Account',
      type: 'international' as const,
      currency: 'EUR',
      iban: 'DE89370400440532013000',
    },
  ],

  // Flex P1 prep — eligible transaction (> £30, < 14 days, GENERAL_MERCHANDISE)
  flexEligibleTransaction: {
    merchant: 'Currys',
    amount: 89.99,
    primaryCategory: 'GENERAL_MERCHANDISE' as const,
    daysAgo: 5,
  },

  standingOrder: {
    beneficiaryName: 'David Brown',
    amount: 850.0,
    frequency: 'monthly' as const,
    dayOfMonth: 1,
  },

  monthlySpending: {
    january: {
      salary: 3800,
      rent: -850,
      groceries: -312.4,
      dining: -218.5,
      transport: -89.6,
      shopping: -156.3,
      subscriptions: -45.97,
    },
    february: {
      salary: 3800,
      rent: -850,
      groceries: -298.7,
      dining: -195.25,
      transport: -82.4,
      shopping: -132.5,
      subscriptions: -45.97,
    },
    march: {
      salary: 3800,
      rent: -850,
      groceries: -305.6,
      dining: -310.75,
      transport: -95.2,
      shopping: -145.8,
      subscriptions: -45.97,
    },
  },
} as const;

export const EMMA = {
  id: '00000000-0000-0000-0000-000000000002',
  email: 'emma@demo.agenticbank.com',
  password: 'demo-password-123',
  displayName: 'Emma Test',
  onboardingStep: 'STARTED' as const,
  // Emma has NO Griffin data — she's the onboarding test user
  griffinLegalPersonUrl: null,
  griffinAccountUrl: null,
} as const;

// ---------------------------------------------------------------------------
// Loan Products (global, not user-scoped)
// Already seeded by migration 001. Values here for test assertions only.
// ---------------------------------------------------------------------------

export const LOAN_PRODUCTS = [
  {
    name: 'Personal Loan',
    minAmount: 500,
    maxAmount: 25000,
    interestRate: 12.9,
    minTermMonths: 6,
    maxTermMonths: 60,
  },
  {
    name: 'Quick Cash',
    minAmount: 100,
    maxAmount: 2000,
    interestRate: 19.9,
    minTermMonths: 3,
    maxTermMonths: 12,
  },
] as const;

// ---------------------------------------------------------------------------
// Transaction templates — deterministic data for seed script
// ---------------------------------------------------------------------------

export const TRANSACTION_TEMPLATES = {
  salary: {
    merchant: 'ACME Corp',
    amount: 3800.0,
    logicalCategory: 'income' as const,
    dayOfMonth: 28,
    isRecurring: true,
    isCredit: true,
  },
  rent: {
    merchant: 'David Brown',
    amount: 850.0,
    logicalCategory: 'housing' as const,
    dayOfMonth: 1,
    isRecurring: true,
    isCredit: false,
    reference: 'Rent',
  },
  groceries: [
    {
      merchant: 'Tesco',
      amounts: [28.5, 34.2, 42.8, 38.9],
      logicalCategory: 'groceries' as const,
    },
    {
      merchant: 'Sainsburys',
      amounts: [31.4, 26.9, 35.2],
      logicalCategory: 'groceries' as const,
    },
    {
      merchant: 'Waitrose',
      amounts: [45.0, 52.3],
      logicalCategory: 'groceries' as const,
    },
  ],
  dining: [
    {
      merchant: 'Pret A Manger',
      amounts: [4.95, 5.5, 6.25, 5.8, 4.5],
      logicalCategory: 'dining' as const,
    },
    {
      merchant: 'Nandos',
      amounts: [18.5, 22.0, 19.75],
      logicalCategory: 'dining' as const,
    },
    {
      merchant: 'Dishoom',
      amounts: [35.0, 42.0],
      logicalCategory: 'dining' as const,
    },
    {
      merchant: 'Deliveroo',
      amounts: [15.99, 22.5, 28.0, 18.75],
      logicalCategory: 'dining' as const,
    },
  ],
  transport: [
    {
      merchant: 'TfL',
      amounts: [2.8, 2.8, 2.8, 2.8, 2.8],
      logicalCategory: 'transport' as const,
      isRecurring: true,
    },
    {
      merchant: 'Uber',
      amounts: [12.5, 18.0, 8.9, 15.2],
      logicalCategory: 'rideshare' as const,
    },
  ],
  shopping: [
    {
      merchant: 'Amazon',
      amounts: [29.99, 15.5, 42.0, 18.99],
      logicalCategory: 'shopping' as const,
    },
    {
      merchant: 'ASOS',
      amounts: [35.0, 28.5],
      logicalCategory: 'shopping' as const,
    },
    {
      merchant: 'Currys',
      amounts: [89.99],
      logicalCategory: 'shopping' as const,
      // Flex-eligible: > £30, recognisable merchant
    },
  ],
  subscriptions: [
    {
      merchant: 'Netflix',
      amount: 15.99,
      logicalCategory: 'entertainment' as const,
      dayOfMonth: 5,
      isRecurring: true,
    },
    {
      merchant: 'Spotify',
      amount: 10.99,
      logicalCategory: 'entertainment' as const,
      dayOfMonth: 12,
      isRecurring: true,
    },
    {
      merchant: 'iCloud',
      amount: 2.99,
      logicalCategory: 'utilities' as const,
      dayOfMonth: 15,
      isRecurring: true,
    },
    {
      merchant: 'Gym - PureGym',
      amount: 16.0,
      logicalCategory: 'health' as const,
      dayOfMonth: 1,
      isRecurring: true,
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// Merchant → PFCv2 Category mapping (for seed and merchant_categories table)
// ---------------------------------------------------------------------------

export const MERCHANT_CATEGORY_MAP: Record<
  string,
  { primaryCategory: string; detailedCategory: string; icon: string }
> = {
  'ACME Corp': { primaryCategory: 'INCOME', detailedCategory: 'SALARY', icon: '💰' },
  'David Brown': { primaryCategory: 'RENT_AND_UTILITIES', detailedCategory: 'RENT', icon: '🏠' },
  Tesco: { primaryCategory: 'FOOD_AND_DRINK', detailedCategory: 'GROCERIES', icon: '🛒' },
  Sainsburys: { primaryCategory: 'FOOD_AND_DRINK', detailedCategory: 'GROCERIES', icon: '🛒' },
  Waitrose: { primaryCategory: 'FOOD_AND_DRINK', detailedCategory: 'GROCERIES', icon: '🛒' },
  'Pret A Manger': { primaryCategory: 'FOOD_AND_DRINK', detailedCategory: 'DINING', icon: '🍽️' },
  Nandos: { primaryCategory: 'FOOD_AND_DRINK', detailedCategory: 'DINING', icon: '🍽️' },
  Dishoom: { primaryCategory: 'FOOD_AND_DRINK', detailedCategory: 'DINING', icon: '🍽️' },
  Deliveroo: { primaryCategory: 'FOOD_AND_DRINK', detailedCategory: 'DINING', icon: '🍽️' },
  TfL: { primaryCategory: 'TRANSPORTATION', detailedCategory: 'PUBLIC_TRANSIT', icon: '🚇' },
  Uber: { primaryCategory: 'TRANSPORTATION', detailedCategory: 'RIDESHARE', icon: '🚗' },
  Amazon: { primaryCategory: 'GENERAL_MERCHANDISE', detailedCategory: 'ONLINE_RETAIL', icon: '🛍️' },
  ASOS: { primaryCategory: 'GENERAL_MERCHANDISE', detailedCategory: 'CLOTHING', icon: '🛍️' },
  Currys: { primaryCategory: 'GENERAL_MERCHANDISE', detailedCategory: 'ELECTRONICS', icon: '🛍️' },
  Netflix: { primaryCategory: 'ENTERTAINMENT', detailedCategory: 'STREAMING', icon: '🎬' },
  Spotify: { primaryCategory: 'ENTERTAINMENT', detailedCategory: 'STREAMING', icon: '🎵' },
  iCloud: { primaryCategory: 'RENT_AND_UTILITIES', detailedCategory: 'CLOUD_STORAGE', icon: '☁️' },
  'Gym - PureGym': { primaryCategory: 'MEDICAL', detailedCategory: 'GYM', icon: '💪' },
};
