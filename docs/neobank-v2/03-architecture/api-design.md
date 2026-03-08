# API Design

> **Phase 2 Output** | Solutions Architect | March 2026
>
> Defines all API routes, request/response contracts, tool definitions, and error handling conventions.

---

## 1. API Conventions

### Base URL
```
Production: https://api.agentic.bank/api
Development: http://localhost:3000/api
```

### Authentication
All endpoints (except `/api/health`) require a Bearer token:
```
Authorization: Bearer <supabase_jwt>
```

### Response Format
```typescript
// Success
{ "data": T }

// Error
{ "error": { "code": string, "message": string } }

// SSE (chat only) — event stream, not JSON
event: token
data: {"text": "Hello"}
```

### Common Headers
```
Content-Type: application/json
X-Request-Id: <uuid>  // Propagated through logs
```

---

## 2. Route Catalogue

### 2.1 Chat

#### POST /api/chat
The primary endpoint. Streams Claude's response as SSE events.

**Request:**
```typescript
{
  message: string;              // User's text message
  conversation_id?: string;     // Omit to start new conversation
}
```

**Response:** SSE event stream (see system-architecture.md §3.4 for event types)

**Rate limit:** 10 requests/minute per user

**Flow:**
1. Validate JWT, extract userId
2. Load or create conversation
3. Load message history (with summarisation if > 80 messages)
4. Build system prompt with user context
5. Stream Claude response, executing tools as needed
6. Persist messages + tool results to Supabase
7. Close stream

---

### 2.2 Confirmation

#### POST /api/confirm/:actionId
Confirm a pending write action.

**Request:** No body required.

**Response:**
```typescript
{
  data: {
    success: boolean;
    message: string;
    result?: unknown;           // Tool-specific result data
    ui_components?: UIComponent[];  // Success card to render
  }
}
```

**Error codes:** `ACTION_NOT_FOUND`, `ACTION_EXPIRED`, `ACTION_ALREADY_EXECUTED`, `EXECUTION_FAILED`

#### POST /api/confirm/:actionId/reject
Cancel a pending action.

**Response:**
```typescript
{
  data: {
    success: true;
    message: "Action cancelled.";
  }
}
```

---

### 2.3 Banking — Accounts

#### GET /api/accounts
List all user accounts (main + pots).

**Response:**
```typescript
{
  data: {
    accounts: Array<{
      id: string;
      type: 'main' | 'pot';
      name: string;
      balance: number;          // GBP, 2 decimal places
      sort_code?: string;       // Main account only
      account_number?: string;  // Main account only
      goal?: number;            // Pots only
      progress_pct?: number;    // Pots only (0-100)
      locked_until?: string;    // ISO 8601, pots only
      emoji?: string;           // Pots only
    }>;
    total_balance: number;
  }
}
```

#### GET /api/accounts/:id/balance
Get balance for a specific account.

**Response:**
```typescript
{
  data: {
    account_id: string;
    balance: number;
    available_balance: number;
    currency: 'GBP';
    updated_at: string;         // ISO 8601
  }
}
```

---

### 2.4 Banking — Pots

#### POST /api/pots
Create a new savings pot.

**Request:**
```typescript
{
  name: string;                 // 1-30 characters
  goal?: number;                // GBP, optional target
  emoji?: string;               // Single emoji character
  initial_deposit?: number;     // GBP, transferred from main
}
```

**Response:**
```typescript
{
  data: {
    pot: Pot;
    main_balance_after?: number;  // If initial_deposit provided
  }
}
```

#### POST /api/pots/:id/transfer
Transfer money to/from a pot.

**Request:**
```typescript
{
  direction: 'in' | 'out';     // 'in' = main → pot, 'out' = pot → main
  amount: number;              // GBP, > 0
}
```

**Response:**
```typescript
{
  data: {
    success: boolean;
    pot_balance_after: number;
    main_balance_after: number;
  }
}
```

#### PATCH /api/pots/:id
Update pot details.

**Request:**
```typescript
{
  name?: string;
  goal?: number;
  locked_until?: string | null;  // ISO 8601 or null to unlock
}
```

#### DELETE /api/pots/:id
Close pot and return balance to main account.

**Response:**
```typescript
{
  data: {
    amount_returned: number;
    main_balance_after: number;
  }
}
```

---

### 2.5 Banking — Transactions

#### GET /api/transactions
List transactions with filtering.

**Query params:**
```
account_id?: string           // Filter by account
category?: string             // Filter by category
start_date?: string           // ISO 8601
end_date?: string             // ISO 8601
merchant?: string             // Fuzzy search
limit?: number                // Default 20, max 100
offset?: number               // Pagination
```

**Response:**
```typescript
{
  data: {
    transactions: Array<{
      id: string;
      merchant: string;
      category: string;
      amount: number;           // Negative = debit, positive = credit
      reference?: string;
      posted_at: string;        // ISO 8601
      account_id: string;
    }>;
    total: number;
    has_more: boolean;
  }
}
```

---

### 2.6 Banking — Beneficiaries

#### GET /api/beneficiaries
List saved beneficiaries.

**Response:**
```typescript
{
  data: {
    beneficiaries: Array<{
      id: string;
      name: string;
      sort_code: string;        // Formatted: XX-XX-XX
      account_number_masked: string;  // ****1234
      last_used?: string;       // ISO 8601
    }>;
  }
}
```

#### POST /api/beneficiaries
Add a new beneficiary.

**Request:**
```typescript
{
  name: string;                 // 1-40 characters
  sort_code: string;            // 6 digits (XX-XX-XX or XXXXXX)
  account_number: string;       // 8 digits
}
```

#### DELETE /api/beneficiaries/:id
Remove a beneficiary.

---

### 2.7 Banking — Payments

#### POST /api/payments
Send a domestic payment. (Usually invoked via tool + confirmation flow, but available as direct API.)

**Request:**
```typescript
{
  beneficiary_id: string;
  amount: number;               // GBP, 0.01 - 10000
  reference?: string;           // Max 18 chars
}
```

**Response:**
```typescript
{
  data: {
    payment_id: string;
    status: 'completed' | 'pending';
    balance_after: number;
  }
}
```

#### GET /api/payments/history
Payment history with filtering.

**Query params:**
```
beneficiary_id?: string
start_date?: string
end_date?: string
limit?: number
```

**Response:**
```typescript
{
  data: {
    payments: Array<{
      id: string;
      beneficiary_name: string;
      amount: number;
      reference?: string;
      status: string;
      created_at: string;
    }>;
    summary: {
      total_this_month: number;
      total_last_month: number;
      payment_count: number;
    };
  }
}
```

---

### 2.8 Banking — Standing Orders

#### GET /api/standing-orders

**Response:**
```typescript
{
  data: {
    standing_orders: Array<{
      id: string;
      beneficiary_name: string;
      amount: number;
      frequency: 'weekly' | 'monthly';
      day_of_month?: number;
      next_date: string;
      status: 'active' | 'paused' | 'cancelled';
    }>;
  }
}
```

#### POST /api/standing-orders
Create a standing order.

**Request:**
```typescript
{
  beneficiary_id: string;
  amount: number;
  frequency: 'weekly' | 'monthly';
  day_of_month?: number;       // 1-28, for monthly
  first_date?: string;         // ISO 8601
}
```

#### PATCH /api/standing-orders/:id
Edit amount, frequency, or day.

#### DELETE /api/standing-orders/:id
Cancel a standing order.

---

### 2.9 Lending — Loans

#### GET /api/loans/products
List available loan products.

**Response:**
```typescript
{
  data: {
    products: Array<{
      id: string;
      name: string;
      min_amount: number;
      max_amount: number;
      interest_rate: number;     // APR %
      min_term_months: number;
      max_term_months: number;
    }>;
  }
}
```

#### GET /api/loans
List user's active loans.

**Response:**
```typescript
{
  data: {
    loans: Array<{
      id: string;
      principal: number;
      balance_remaining: number;
      interest_rate: number;
      monthly_payment: number;
      term_months: number;
      payments_made: number;
      next_payment_date: string;
      payoff_date: string;
      status: 'active' | 'repaid';
    }>;
  }
}
```

#### POST /api/loans/eligibility
Check loan eligibility (soft check).

**Request:**
```typescript
{
  requested_amount?: number;    // GBP, optional
}
```

**Response:**
```typescript
{
  data: {
    eligible: boolean;
    max_amount: number;
    apr: number;
    decline_reason?: string;
  }
}
```

#### GET /api/loans/:id/schedule
Amortisation schedule for a loan.

**Response:**
```typescript
{
  data: {
    schedule: Array<{
      payment_num: number;
      date: string;
      payment_amount: number;
      principal: number;
      interest: number;
      remaining_balance: number;
      status: 'paid' | 'pending' | 'overdue';
    }>;
  }
}
```

---

### 2.10 Lending — Flex Purchase (BNPL)

#### GET /api/flex/plans
List active flex plans.

**Response:**
```typescript
{
  data: {
    plans: Array<{
      id: string;
      merchant: string;
      original_amount: number;
      plan_months: number;
      monthly_payment: number;
      interest_rate: number;
      payments_made: number;
      next_payment_date: string;
      remaining_total: number;
      status: 'active' | 'completed' | 'paid_off_early';
    }>;
  }
}
```

#### POST /api/flex/plans
Create a flex plan from an eligible transaction.

**Request:**
```typescript
{
  transaction_id: string;
  plan_months: 3 | 6 | 12;
}
```

#### POST /api/flex/plans/:id/payoff
Pay off a flex plan early.

---

### 2.11 Lending — Credit Score

#### GET /api/credit-score

**Response:**
```typescript
{
  data: {
    score: number;              // 300-999
    rating: 'poor' | 'fair' | 'good' | 'excellent';
    factors: {
      positive: string[];
      improve: string[];
    };
    last_updated: string;
  }
}
```

---

### 2.12 Insights

#### GET /api/insights/spending
Spending breakdown by category.

**Query params:**
```
period?: 'week' | 'month'      // Default: month
start_date?: string
end_date?: string
```

**Response:**
```typescript
{
  data: {
    total_spent: number;
    categories: Array<{
      name: string;
      amount: number;
      percentage: number;
      transaction_count: number;
      largest_transaction: {
        merchant: string;
        amount: number;
        date: string;
      };
    }>;
    comparison: {
      previous_period_total: number;
      percentage_change: number;  // Positive = spent more
    };
  }
}
```

#### GET /api/insights/proactive
Proactive cards for app open.

**Response:**
```typescript
{
  data: {
    cards: Array<{
      type: 'bill_reminder' | 'spending_spike' | 'savings_milestone'
            | 'payday' | 'pattern' | 'weekly_summary' | 'celebration';
      priority: 'high' | 'medium' | 'low';
      title: string;
      body: string;
      quick_replies?: string[];
      data?: unknown;           // Card-type-specific payload
    }>;
  }
}
```

---

### 2.13 Onboarding

#### POST /api/onboarding/start
Begin onboarding (after email registration via Supabase Auth).

**Request:**
```typescript
{
  name: string;
  date_of_birth: string;       // YYYY-MM-DD
  address: {
    line_1: string;
    line_2?: string;
    city: string;
    postcode: string;
    country: 'GB';
  };
}
```

**Response:**
```typescript
{
  data: {
    onboarding_step: string;
    account?: {
      sort_code: string;
      account_number: string;
    };
  }
}
```

#### POST /api/onboarding/verify
Submit KYC verification (mocked for POC).

**Response:**
```typescript
{
  data: {
    verified: true;
    onboarding_step: 'KYC_VERIFIED';
  }
}
```

#### GET /api/onboarding/checklist
Get getting-started checklist status.

**Response:**
```typescript
{
  data: {
    items: Array<{
      key: string;
      label: string;
      completed: boolean;
    }>;
    progress: string;           // "2 of 6"
  }
}
```

---

### 2.14 Auth

#### GET /api/auth/profile
Get current user profile.

**Response:**
```typescript
{
  data: {
    id: string;
    email: string;
    display_name: string;
    onboarding_step: string;
    created_at: string;
  }
}
```

---

### 2.15 Health

#### GET /api/health
System health check (no auth required).

**Response:**
```typescript
{
  data: {
    status: 'ok' | 'degraded' | 'down';
    checks: {
      supabase: 'ok' | 'error';
      griffin: 'ok' | 'error' | 'skipped';   // Skipped if USE_MOCK_BANKING
      anthropic: 'ok' | 'error';
    };
    timestamp: string;
  }
}
```

---

## 3. Tool Definitions

### 3.1 Core Banking Tools

| Tool | Type | Description (for Claude) |
|------|------|--------------------------|
| `check_balance` | Read | Check the user's main account balance. Returns balance in GBP, account name, and masked account number. |
| `get_accounts` | Read | List all user accounts including main account and savings pots. Returns array with id, name, type, and balance for each. |
| `get_pots` | Read | List all savings pots. Returns pot name, balance, goal amount, progress percentage, and lock status. |
| `create_pot` | Write | Create a new savings pot. Requires name. Optional: goal amount, emoji, initial deposit from main account. |
| `transfer_to_pot` | Write | Move money from main account to a savings pot. Requires pot_id and amount. Returns updated balances. |
| `transfer_from_pot` | Write | Move money from a savings pot back to main account. Requires pot_id and amount. Returns updated balances. |
| `update_pot` | Write | Update pot name, goal, or lock date. Requires pot_id and at least one field to update. |
| `close_pot` | Write | Close a savings pot and return all money to main account. Requires pot_id. Returns amount returned. |
| `get_beneficiaries` | Read | List saved payment recipients. Returns name, masked account details, and last used date. Use this BEFORE send_payment to resolve beneficiary names. |
| `add_beneficiary` | Write | Add a new payment recipient. Requires name, sort code (6 digits), and account number (8 digits). |
| `send_payment` | Write | Send money to a saved beneficiary. Requires beneficiary_id (from get_beneficiaries), amount in GBP, and optional reference. Max £10,000. |
| `get_payment_history` | Read | View payment history, optionally filtered by beneficiary. Returns payments with amounts, dates, and a monthly summary. |
| `get_transactions` | Read | List recent transactions. Supports filtering by category, merchant, date range. Returns merchant, amount, category, and date. |
| `create_standing_order` | Write | Set up a recurring payment. Requires beneficiary_id, amount, frequency (weekly/monthly). Optional: day_of_month, first_date. |
| `get_standing_orders` | Read | List all standing orders with next payment dates and status. |
| `categorise_transaction` | Read | Get or set the category for a transaction. Uses rule-based merchant mapping. |

### 3.2 Lending Tools

| Tool | Type | Description (for Claude) |
|------|------|--------------------------|
| `check_eligibility` | Read | Check if the user is eligible for a personal loan. Returns max eligible amount, APR, and decline reason if not eligible. Optional: specify a requested amount. |
| `apply_for_loan` | Write | Apply for a personal loan. Requires amount (£100-£25,000), term in months (3-60), and purpose. Returns monthly payment, total interest, and disbursement date. |
| `get_loan_status` | Read | Get status of active loans. Returns principal, remaining balance, monthly payment, next payment date, payments made vs total, and payoff date. |
| `get_loan_schedule` | Read | Get the full amortisation schedule for a loan. Shows each payment with principal, interest, and remaining balance breakdown. |
| `make_loan_payment` | Write | Make an extra payment on a loan. Requires loan_id and amount. Returns new remaining balance, updated payoff date, and months saved. |
| `flex_purchase` | Write | Split an eligible transaction (£30+, within 14 days) into instalments. Requires transaction_id and plan_months (3, 6, or 12). Returns monthly payment and total interest. |
| `get_flex_plans` | Read | List active flex (buy now, pay later) plans. Returns merchant, original amount, monthly payment, payments made, and next payment date. |
| `pay_off_flex` | Write | Pay off a flex plan early with no penalty. Requires flex_plan_id. Returns amount paid. |
| `check_credit_score` | Read | Check the user's credit score (0-999). Returns score, rating (poor/fair/good/excellent), positive factors, and improvement suggestions. |

### 3.3 Experience Tools

| Tool | Type | Description (for Claude) |
|------|------|--------------------------|
| `respond_to_user` | System | Send a message to the user with optional rich UI components (cards). Use this to render balance cards, confirmation cards, insight cards, and other visual elements. |
| `get_spending_by_category` | Read | Get spending breakdown by category for a period. Returns total spent, per-category amounts with percentages, and comparison to the previous period. |
| `get_spending_insights` | Read | Get spending insights and anomalies. Returns spending spikes, patterns, and actionable suggestions. |
| `get_weekly_summary` | Read | Get a weekly spending summary. Returns total spent, top categories, comparison to previous week, and largest transaction. |
| `search_transactions` | Read | Search transactions by merchant name, amount range, or natural language query. Returns matching transactions with a total. |
| `get_upcoming_bills` | Read | Get bills and scheduled payments due in the next 48 hours. Returns bill name, amount, and due date. |
| `get_proactive_cards` | Read | Get prioritised proactive insight cards for the current session. Returns max 3 cards ranked by urgency (time-sensitive > actionable > informational). |
| `get_onboarding_checklist` | Read | Get the getting-started checklist with completion status for each item. |
| `get_value_prop_info` | Read | Get information about a specific value proposition topic (speed, control, FSCS protection, FCA regulation, features). Used during onboarding exploration. |

---

## 4. Error Handling

### 4.1 Error Response Format

```typescript
{
  error: {
    code: string;               // Machine-readable code
    message: string;            // Human-readable description
    details?: unknown;          // Optional context
  }
}
```

### 4.2 Error Codes

| Code | HTTP | When |
|------|------|------|
| `VALIDATION_ERROR` | 400 | Invalid input (missing fields, wrong format) |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | User doesn't own the requested resource |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `ACTION_EXPIRED` | 410 | Pending action past 5-minute window |
| `RATE_LIMITED` | 429 | Too many requests |
| `INSUFFICIENT_FUNDS` | 422 | Balance too low for operation |
| `BENEFICIARY_NOT_FOUND` | 422 | Beneficiary ID doesn't match any saved payee |
| `PROVIDER_UNAVAILABLE` | 502 | Griffin/Wise API unreachable |
| `INTERNAL_ERROR` | 500 | Unhandled server error |

### 4.3 Tool Error Handling

Tool errors are returned as structured `ToolResult` objects (not thrown as exceptions). Claude receives the error and crafts a natural-language response:

```typescript
// Example: insufficient funds
{
  success: false,
  error: {
    code: 'INSUFFICIENT_FUNDS',
    message: 'Balance £247.50 is less than requested £500.00',
    userMessage: 'You don\'t have enough in your main account for this transfer.',
    suggestedAction: 'Send a smaller amount'
  }
}
```

Claude might respond: "You don't have enough to send £500 right now — your balance is £247.50. Would you like to send a smaller amount?"
