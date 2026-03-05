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
  description: 'Get recent transactions for the user\'s bank account. Returns a list of transactions with amounts, directions, and dates.',
  input_schema: {
    type: 'object' as const,
    properties: {
      limit: {
        type: 'number',
        description: 'Number of transactions to return (default 10, max 50)',
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
              enum: ['balance_card', 'transaction_list', 'confirmation_card', 'loan_offer_card', 'loan_status_card', 'error_card'],
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

// Read-only tools execute immediately
export const READ_ONLY_TOOLS = new Set([
  'check_balance',
  'get_transactions',
  'get_accounts',
  'get_beneficiaries',
  'get_loan_status',
]);

// Write tools need confirmation
export const WRITE_TOOLS = new Set([
  'send_payment',
  'add_beneficiary',
  'apply_for_loan',
  'make_loan_payment',
]);

// All tool definitions
export const ALL_TOOLS: ToolDef[] = [
  checkBalance,
  getTransactions,
  getAccounts,
  getBeneficiaries,
  getLoanStatus,
  sendPayment,
  addBeneficiary,
  applyForLoan,
  makeLoanPayment,
  respondToUser,
];

// Tool progress messages for UX
export const TOOL_PROGRESS: Record<string, string> = {
  check_balance: 'Checking your balance...',
  get_transactions: 'Loading transactions...',
  get_accounts: 'Loading accounts...',
  get_beneficiaries: 'Loading beneficiaries...',
  get_loan_status: 'Checking loan status...',
  send_payment: 'Preparing payment...',
  add_beneficiary: 'Adding beneficiary...',
  apply_for_loan: 'Processing application...',
  make_loan_payment: 'Processing payment...',
  respond_to_user: '',
};
