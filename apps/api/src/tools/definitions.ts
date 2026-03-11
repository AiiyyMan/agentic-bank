import type Anthropic from '@anthropic-ai/sdk';

type ToolDef = Anthropic.Messages.Tool;

// Read-only tools — execute immediately
export const checkBalance: ToolDef = {
  name: 'check_balance',
  description: 'Get the current account balance for the user. Returns available balance and account details.',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [],
    additionalProperties: false,
  },
};

export const getTransactions: ToolDef = {
  name: 'get_transactions',
  description: 'Get recent transactions for the user\'s bank account. Supports filtering by category, date range, and merchant name. Returns a list of transactions with amounts, categories, and dates.',
  input_schema: {
    type: 'object' as const,
    properties: {
      limit: {
        type: 'number',
        description: 'Number of transactions to return (default 10, max 50)',
      },
      offset: {
        type: 'number',
        description: 'Number of transactions to skip for pagination (default 0)',
      },
      category: {
        type: 'string',
        description: 'Filter by primary category (PFCv2): FOOD_AND_DRINK, TRANSPORTATION, ENTERTAINMENT, GENERAL_MERCHANDISE, RENT_AND_UTILITIES, INCOME, etc.',
      },
      start_date: {
        type: 'string',
        description: 'Filter transactions on or after this date (ISO 8601, e.g. 2026-01-01)',
      },
      end_date: {
        type: 'string',
        description: 'Filter transactions on or before this date (ISO 8601, e.g. 2026-03-31)',
      },
      merchant: {
        type: 'string',
        description: 'Filter by merchant name (partial match, case-insensitive)',
      },
    },
    required: [],
    additionalProperties: false,
  },
};

export const getAccounts: ToolDef = {
  name: 'get_accounts',
  description: 'List all bank accounts for the user.',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [],
    additionalProperties: false,
  },
};

export const getBeneficiaries: ToolDef = {
  name: 'get_beneficiaries',
  description: 'List all saved payees/beneficiaries for the user.',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [],
    additionalProperties: false,
  },
};

export const getLoanStatus: ToolDef = {
  name: 'get_loan_status',
  description: 'Check the user\'s active loans and repayment schedule.',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [],
    additionalProperties: false,
  },
};

// Write tools — require user confirmation
export const sendPayment: ToolDef = {
  name: 'send_payment',
  description: 'Send a payment to a beneficiary. Requires user confirmation before execution. The amount must be between £0.01 and £10,000.',
  input_schema: {
    type: 'object' as const,
    properties: {
      beneficiary_name: {
        type: 'string',
        description: 'Name of the beneficiary to send money to',
      },
      amount: {
        type: 'number',
        description: 'Amount in GBP to send',
      },
      reference: {
        type: 'string',
        description: 'Payment reference (optional)',
      },
    },
    required: ['beneficiary_name', 'amount'],
    additionalProperties: false,
  },
};

export const addBeneficiary: ToolDef = {
  name: 'add_beneficiary',
  description: 'Add a new payee/beneficiary. Requires account number (8 digits) and sort code (6 digits).',
  input_schema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string',
        description: 'Name of the beneficiary',
      },
      account_number: {
        type: 'string',
        description: 'UK bank account number (8 digits)',
      },
      sort_code: {
        type: 'string',
        description: 'UK sort code (6 digits)',
      },
    },
    required: ['name', 'account_number', 'sort_code'],
    additionalProperties: false,
  },
};

export const applyForLoan: ToolDef = {
  name: 'apply_for_loan',
  description: 'Apply for a personal loan. Requires amount (£100-£25,000), term in months (3-60), and purpose.',
  input_schema: {
    type: 'object' as const,
    properties: {
      amount: {
        type: 'number',
        description: 'Loan amount in GBP (£100-£25,000)',
      },
      term_months: {
        type: 'number',
        description: 'Loan term in months (3-60)',
      },
      purpose: {
        type: 'string',
        description: 'Purpose of the loan',
      },
    },
    required: ['amount', 'term_months', 'purpose'],
    additionalProperties: false,
  },
};

export const makeLoanPayment: ToolDef = {
  name: 'make_loan_payment',
  description: 'Make a payment against an active loan.',
  input_schema: {
    type: 'object' as const,
    properties: {
      loan_id: {
        type: 'string',
        description: 'ID of the loan to make payment against',
      },
      amount: {
        type: 'number',
        description: 'Payment amount in GBP',
      },
    },
    required: ['loan_id', 'amount'],
    additionalProperties: false,
  },
};

export const createPot: ToolDef = {
  name: 'create_pot',
  description: 'Create a new savings pot. Optionally set a goal amount, emoji, and initial deposit from the main account.',
  input_schema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string',
        description: 'Name for the savings pot (1-30 characters)',
      },
      goal: {
        type: 'number',
        description: 'Target savings goal in GBP (optional)',
      },
      emoji: {
        type: 'string',
        description: 'Emoji to represent the pot (optional)',
      },
      initial_deposit: {
        type: 'number',
        description: 'Amount to deposit from main account when creating (optional)',
      },
    },
    required: ['name'],
    additionalProperties: false,
  },
};

export const transferToPot: ToolDef = {
  name: 'transfer_to_pot',
  description: 'Transfer money from the main account into a savings pot.',
  input_schema: {
    type: 'object' as const,
    properties: {
      pot_id: {
        type: 'string',
        description: 'ID of the pot to transfer money into',
      },
      amount: {
        type: 'number',
        description: 'Amount in GBP to transfer to the pot',
      },
    },
    required: ['pot_id', 'amount'],
    additionalProperties: false,
  },
};

export const transferFromPot: ToolDef = {
  name: 'transfer_from_pot',
  description: 'Transfer money from a savings pot back to the main account. Cannot withdraw from locked pots.',
  input_schema: {
    type: 'object' as const,
    properties: {
      pot_id: {
        type: 'string',
        description: 'ID of the pot to withdraw from',
      },
      amount: {
        type: 'number',
        description: 'Amount in GBP to transfer from the pot',
      },
    },
    required: ['pot_id', 'amount'],
    additionalProperties: false,
  },
};

export const deleteBeneficiary: ToolDef = {
  name: 'delete_beneficiary',
  description: 'Delete a saved beneficiary/payee. Requires the beneficiary ID.',
  input_schema: {
    type: 'object' as const,
    properties: {
      beneficiary_id: {
        type: 'string',
        description: 'ID of the beneficiary to delete',
      },
    },
    required: ['beneficiary_id'],
    additionalProperties: false,
  },
};

export const getPaymentHistory: ToolDef = {
  name: 'get_payment_history',
  description: 'Get payment history with optional filters. Returns payments and monthly spending summary.',
  input_schema: {
    type: 'object' as const,
    properties: {
      beneficiary_id: {
        type: 'string',
        description: 'Filter by beneficiary ID (optional)',
      },
      start_date: {
        type: 'string',
        description: 'Filter payments on or after this date (ISO 8601)',
      },
      end_date: {
        type: 'string',
        description: 'Filter payments on or before this date (ISO 8601)',
      },
      limit: {
        type: 'number',
        description: 'Number of payments to return (default 20, max 50)',
      },
    },
    required: [],
    additionalProperties: false,
  },
};

export const checkCreditScore: ToolDef = {
  name: 'check_credit_score',
  description: 'Check the user\'s credit score. Returns score, rating, positive factors, and improvement tips.',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [],
    additionalProperties: false,
  },
};

export const checkEligibility: ToolDef = {
  name: 'check_eligibility',
  description: 'Check if the user is eligible for a loan. Returns max eligible amount, APR, and monthly payment estimate.',
  input_schema: {
    type: 'object' as const,
    properties: {
      amount: {
        type: 'number',
        description: 'Requested loan amount in GBP (optional — returns max eligible if omitted)',
      },
    },
    required: [],
    additionalProperties: false,
  },
};

export const getLoanSchedule: ToolDef = {
  name: 'get_loan_schedule',
  description: 'Get the amortisation schedule for a specific loan. Shows each payment with principal/interest breakdown.',
  input_schema: {
    type: 'object' as const,
    properties: {
      loan_id: {
        type: 'string',
        description: 'ID of the loan to get the schedule for',
      },
    },
    required: ['loan_id'],
    additionalProperties: false,
  },
};

export const flexPurchase: ToolDef = {
  name: 'flex_purchase',
  description: 'Split a recent purchase into monthly instalments (Flex). Choose 3 months (0% APR), 6 months (15.9% APR), or 12 months (15.9% APR).',
  input_schema: {
    type: 'object' as const,
    properties: {
      transaction_id: {
        type: 'string',
        description: 'ID of the transaction to flex',
      },
      plan_months: {
        type: 'number',
        description: 'Number of months: 3, 6, or 12',
      },
    },
    required: ['transaction_id', 'plan_months'],
    additionalProperties: false,
  },
};

export const getFlexPlans: ToolDef = {
  name: 'get_flex_plans',
  description: 'Get all active Flex plans for the user.',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [],
    additionalProperties: false,
  },
};

export const getFlexEligible: ToolDef = {
  name: 'get_flex_eligible',
  description: 'Get recent transactions eligible for Flex (£50-£2,000, within 30 days).',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [],
    additionalProperties: false,
  },
};

export const payOffFlex: ToolDef = {
  name: 'pay_off_flex',
  description: 'Pay off a Flex plan early with no penalty.',
  input_schema: {
    type: 'object' as const,
    properties: {
      plan_id: {
        type: 'string',
        description: 'ID of the Flex plan to pay off',
      },
    },
    required: ['plan_id'],
    additionalProperties: false,
  },
};

// UI control tool — Claude decides what to render
export const respondToUser: ToolDef = {
  name: 'respond_to_user',
  description: 'Send a response to the user with optional rich UI components. ALWAYS use this tool to respond to the user after completing any action or answering any question.',
  input_schema: {
    type: 'object' as const,
    properties: {
      message: {
        type: 'string',
        description: 'The conversational text message to show the user',
      },
      ui_components: {
        type: 'array',
        description: 'Rich UI components to render below the message',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: [
                'balance_card', 'transaction_list', 'confirmation_card', 'success_card',
                'error_card', 'pot_status_card', 'insight_card', 'spending_breakdown_card',
                'quick_reply_group', 'welcome_card', 'checklist_card', 'input_card',
                'quote_card', 'standing_order_card', 'flex_options_card', 'auto_save_rule_card',
                'loan_offer_card', 'loan_status_card', 'flex_plan_card', 'credit_score_card',
                'payment_history_card', 'date_picker_card', 'address_input_card',
              ],
              description: 'Type of UI component to render',
            },
            data: {
              type: 'object',
              description: 'Data for the UI component',
            },
          },
          required: ['type', 'data'],
        },
      },
    },
    required: ['message'],
    additionalProperties: false,
  },
};

export const getPots: ToolDef = {
  name: 'get_pots',
  description: 'Get all savings pots for the user. Returns pot names, balances, goals, and progress percentages.',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [],
    additionalProperties: false,
  },
};

// Read-only tools execute immediately
export const READ_ONLY_TOOLS = new Set([
  'check_balance',
  'get_transactions',
  'get_accounts',
  'get_beneficiaries',
  'get_loan_status',
  'get_pots',
  'get_payment_history',
  'check_credit_score',
  'check_eligibility',
  'get_loan_schedule',
  'get_flex_plans',
  'get_flex_eligible',
]);

// Write tools need confirmation
export const WRITE_TOOLS = new Set([
  'send_payment',
  'add_beneficiary',
  'delete_beneficiary',
  'apply_for_loan',
  'make_loan_payment',
  'create_pot',
  'transfer_to_pot',
  'transfer_from_pot',
  'flex_purchase',
  'pay_off_flex',
]);

// All tool definitions
export const ALL_TOOLS: ToolDef[] = [
  checkBalance,
  getTransactions,
  getAccounts,
  getPots,
  getBeneficiaries,
  getPaymentHistory,
  getLoanStatus,
  sendPayment,
  addBeneficiary,
  deleteBeneficiary,
  createPot,
  transferToPot,
  transferFromPot,
  applyForLoan,
  makeLoanPayment,
  checkCreditScore,
  checkEligibility,
  getLoanSchedule,
  flexPurchase,
  getFlexPlans,
  getFlexEligible,
  payOffFlex,
  respondToUser,
];

// Tool progress messages for UX
export const TOOL_PROGRESS: Record<string, string> = {
  check_balance: 'Checking your balance...',
  get_transactions: 'Loading transactions...',
  get_accounts: 'Loading accounts...',
  get_beneficiaries: 'Loading beneficiaries...',
  get_loan_status: 'Checking loan status...',
  get_pots: 'Loading savings pots...',
  get_payment_history: 'Loading payment history...',
  send_payment: 'Preparing payment...',
  add_beneficiary: 'Adding beneficiary...',
  delete_beneficiary: 'Removing beneficiary...',
  create_pot: 'Creating savings pot...',
  transfer_to_pot: 'Transferring to pot...',
  transfer_from_pot: 'Withdrawing from pot...',
  apply_for_loan: 'Processing application...',
  make_loan_payment: 'Processing payment...',
  check_credit_score: 'Checking credit score...',
  check_eligibility: 'Checking eligibility...',
  get_loan_schedule: 'Loading loan schedule...',
  flex_purchase: 'Setting up Flex plan...',
  get_flex_plans: 'Loading Flex plans...',
  get_flex_eligible: 'Checking eligible transactions...',
  pay_off_flex: 'Paying off Flex plan...',
  respond_to_user: '',
};
