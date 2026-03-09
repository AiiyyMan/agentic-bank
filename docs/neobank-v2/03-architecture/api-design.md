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
  message: string;              // User's text message (or "__app_open__" for greeting)
  conversation_id?: string;     // Omit to start new conversation
  context?: {                   // Optional client-side context
    proactive_cards?: ProactiveCard[];  // Pre-fetched insight cards for greeting
  };
}
```

**Response:** SSE event stream. Event types: `thinking`, `heartbeat`, `token`, `tool_start`, `tool_result`, `ui_components`, `data_changed`, `error`, `done`. See system-architecture.md §3.5 for full event type definitions, payloads, and stream recovery. The `data_changed` event carries `{ invalidate: string[] }` for client-side cache invalidation after mutating tool calls (see offline-caching-strategy.md §7.2).

**Rate limit:** 20 requests/minute per user

**Special message: `__app_open__`**

When `message` is `"__app_open__"`, the server treats this as an app-open greeting request:
- The message is NOT persisted to the conversation (it's a synthetic signal)
- If `context.proactive_cards` is provided, they are injected into the system prompt as structured context for Claude to weave into a natural greeting
- Claude generates a unified greeting with inline cards (BalanceCard, InsightCards, QuickReplies)
- If no proactive cards are provided, Claude generates a simple greeting from user profile context

**Flow:**
1. Emit `event: thinking` immediately (< 100ms, before any async work)
2. Validate JWT, extract userId
3. Load or create conversation
4. Load message history (if previously summarised, load summary + recent messages)
5. Build system prompt with user context and prompt caching (+ proactive cards if `__app_open__`). See system-architecture.md §3.2 for cache structure.
6. Stream Claude response, executing tools as needed (`max_tokens: 4096`)
   > Note: Claude may emit multiple `tool_use` blocks in a single response (e.g., "What's my balance and recent transactions?"). The agent loop collects all blocks, executes them concurrently via `Promise.all()`, and returns all `tool_result` blocks in a single user message. See system-architecture.md §3.1 for the implementation pattern.
7. Persist messages + tool results to Supabase (including synthetic `tool_result` for `respond_to_user`)
8. Close stream
9. If message count > summarisation threshold, queue background summarisation job (see ADR-05)

**Latency optimisation:** Step 1 ensures the client receives visual feedback (typing indicator) within 100ms of sending the request, even though steps 2-5 may take 500-1500ms. Summarisation runs post-response (step 9) to avoid blocking TTFT.

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

#### Action Type Dispatcher

The confirm route uses a dispatcher registry to map `action_type` to the correct domain service. Each squad registers their action types during startup:

```typescript
// Dispatcher registry pattern
const actionDispatcher = new Map<string, (action: PendingAction, port: BankingPort, supabase: SupabaseClient) => Promise<ServiceResult<any>>>();

// CB registers:
actionDispatcher.set('send_payment', (action, port, sb) => paymentService.executePayment(action));
actionDispatcher.set('add_beneficiary', (action, port, sb) => paymentService.executeAddBeneficiary(action));
actionDispatcher.set('create_pot', (action, port, sb) => potService.executeCreatePot(action));
actionDispatcher.set('transfer_to_pot', (action, port, sb) => potService.executeTransfer(action));

// LE registers:
actionDispatcher.set('apply_loan', (action, port, sb) => lendingService.executeLoanApplication(action));
actionDispatcher.set('activate_flex_plan', (action, port, sb) => lendingService.executeFlexPlan(action));
```

This decouples the confirm route from individual domain services. When a squad adds a new action type, they register it in their own file — no changes to the confirm route needed.

#### PATCH /api/confirm/:actionId
Amend a pending action's parameters (mid-conversation amendment).

**Request:**
```typescript
{
  params: Record<string, unknown>;  // Partial params to merge into existing
}
```

**Response:**
```typescript
{
  data: {
    success: boolean;
    action_id: string;
    updated_params: Record<string, unknown>;  // Full merged params
    expires_at: string;                       // Reset to NOW() + 5 minutes
    ui_components?: UIComponent[];            // Updated ConfirmationCard
  }
}
```

**Rules:**
- Only `pending` actions can be amended
- `expires_at` resets on every amendment
- Params are shallow-merged: existing fields preserved unless overridden
- Returns `ACTION_NOT_FOUND` if action doesn't exist or isn't owned by user
- Returns `ACTION_EXPIRED` if action has expired (user must re-initiate)

**Error codes:** `ACTION_NOT_FOUND`, `ACTION_EXPIRED`, `ACTION_ALREADY_EXECUTED`, `VALIDATION_ERROR`

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
    sort_code: string;           // Formatted: XX-XX-XX (main account)
    currency: 'GBP';
    updated_at: string;         // ISO 8601
  }
}
```

---

### 2.4 Banking — Pots

#### POST /api/pots
Create a new savings pot.

> **Implementation:** Route through `PotService` per ADR-17.

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

> **Implementation:** Route through `PotService` per ADR-17.

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
      category_icon: string;    // Phosphor icon name for the transaction category
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
      last_used_at?: string;    // ISO 8601
    }>;
  }
}
```

#### POST /api/beneficiaries
Add a new beneficiary.

> **Implementation:** Route through `PaymentService` per ADR-17.

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

> **Implementation:** Route through `PaymentService` per ADR-17.

---

### 2.7 Banking — Payments

#### POST /api/payments
Send a domestic payment. (Usually invoked via tool + confirmation flow, but available as direct API.)

> **Implementation:** Route through `PaymentService` per ADR-17.

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

> **Implementation:** Route through `PaymentService` per ADR-17.

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

> **Implementation:** Route through `PaymentService` per ADR-17.

#### DELETE /api/standing-orders/:id
Cancel a standing order.

> **Implementation:** Route through `PaymentService` per ADR-17.

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
      status: 'active' | 'repaid' | 'defaulted';
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

#### POST /api/loans/apply
Apply for a personal loan.

> **Implementation:** Route through `LendingService` per ADR-17.

**Request:**
```typescript
{
  amount: number;               // GBP, £100 - £25,000
  term_months: number;          // 3 - 60
  purpose: string;              // e.g. "home improvement", "debt consolidation"
}
```

**Response:**
```typescript
{
  data: {
    loan_id: string;
    monthly_payment: number;
    total_interest: number;
    disbursement_date: string;   // ISO 8601
    status: 'approved' | 'pending_review';
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

> **Implementation:** Route through `LendingService` per ADR-17.

**Request:**
```typescript
{
  transaction_id: string;
  plan_months: 3 | 6 | 12;
}
```

#### POST /api/flex/plans/:id/payoff
Pay off a flex plan early.

> **Implementation:** Route through `LendingService` per ADR-17.

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
      positive: Array<{ icon: string; label: string }>;  // Each factor includes a Phosphor icon name for card rendering
      improve: Array<{ icon: string; label: string }>;   // Each factor includes a Phosphor icon name for card rendering
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
      priority: 'high' | 'medium' | 'low';  // Maps from internal numeric priority (1=high, 2=medium, 3=low). See note below.
      title: string;
      body: string;
      quick_replies?: string[];
      data?: unknown;           // Card-type-specific payload
    }>;
  }
}
```

> **Proactive card priority mapping:** Internal `InsightService` uses numeric priority (1=high, 2=medium, 3=low). The REST endpoint maps to string values. Contract tests should verify the REST response uses string priorities.

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
    onboarding_step: 'VERIFICATION_COMPLETE';
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

### 2.13a Pending Actions

#### GET /api/pending-actions

Returns any unexpired pending actions for the authenticated user. Used by the mobile app on mount to resurface unconfirmed actions (QA U3).

**Response 200:**
```json
{
  "pending_actions": [
    {
      "action_id": "uuid",
      "action_type": "send_payment | add_beneficiary | create_pot | transfer_to_pot | apply_loan | activate_flex_plan",
      "display": {
        "title": "string",
        "details": [{ "label": "string", "value": "string" }],
        "amount": "number (optional)",
        "balance_after": "number (optional)"
      },
      "expires_at": "ISO 8601",
      "created_at": "ISO 8601"
    }
  ]
}
```

---

### 2.14 Conversations (P1)

#### GET /api/conversations
List user's conversations (most recent first).

**Query params:**
```
limit?: number                // Default 10, max 50
offset?: number               // Pagination
```

**Response:**
```typescript
{
  data: {
    conversations: Array<{
      id: string;
      title: string;           // Auto-generated from first message
      message_count: number;
      updated_at: string;      // ISO 8601
      preview?: string;        // Last assistant message (truncated to 100 chars)
    }>;
    has_more: boolean;
  }
}
```

---

### 2.15 Auth

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

### 2.16 Health

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

### 2.17 Notifications (P1)

Notification preference and feed routes are managed by Knock. See `notification-system.md` §7.3 for full specification.

| Route | Method | Purpose | Priority |
|-------|--------|---------|----------|
| `/api/notifications/preferences` | GET | Get user notification preferences | P1 |
| `/api/notifications/preferences` | PUT | Update notification preferences | P1 |
| `/api/auth/knock-token` | GET | Generate Knock user token for client SDK | P1 |

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
| `send_payment` | Write | Send money to a saved beneficiary. Requires beneficiary_id (from get_beneficiaries), amount in GBP, and optional reference. Max £10,000. **Beneficiary resolution:** Claude must call `get_beneficiaries` first to resolve a user-provided name (e.g., "James") to a `beneficiary_id`. The `send_payment` tool handler passes `beneficiary_id` to `PaymentService`, which validates the ID belongs to the authenticated user. If a name is passed instead of a valid UUID, the service rejects the request with `InvalidBeneficiaryError`. |
| `get_payment_history` | Read | View payment history, optionally filtered by beneficiary. Returns payments with amounts, dates, and a monthly summary. |
| `get_transactions` | Read | List recent transactions. Supports filtering by category, merchant, date range. Returns merchant, amount, category, and date. |
| `create_standing_order` | Write | Set up a recurring payment. Requires beneficiary_id, amount, frequency (weekly/monthly). Optional: day_of_month, first_date. |
| `get_standing_orders` | Read | List all standing orders with next payment dates and status. |
| `edit_standing_order` | Write | Edit a standing order's amount, frequency, or day. Requires standing_order_id and at least one field to update. |
| `cancel_standing_order` | Write | Cancel an active standing order. Requires standing_order_id. |
| `delete_beneficiary` | Write | Remove a saved payment recipient. Requires beneficiary_id. |
| `create_auto_save_rule` | Write | Set up automatic savings. Requires pot_id, amount, and frequency (weekly/monthly/on_payday). Returns next run date. Chat-only — no corresponding REST endpoint. |
| `categorise_transaction` | Read | Get the category for a transaction. Pure lookup against rule-based merchant mapping (top 50 UK merchants → category + icon). No database writes. Internal tool — not exposed as API route. |

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
| `check_credit_score` | Read | Check the user's credit score (300-999). Returns score, rating (poor/fair/good/excellent), positive factors, and improvement suggestions. |

### 3.3 Experience Tools

| Tool | Type | Description (for Claude) |
|------|------|--------------------------|
| `respond_to_user` | System (synthetic) | Send a message to the user with optional rich UI components (cards). Include `ui_components` only when the response contains structured financial data, a confirmation action, or a proactive insight — not for conversational replies. See §3.4.1 for the full card usage policy. **Synthetic tool — intercepted by agent loop, never executed server-side.** See §3.3.1. |
| `get_spending_by_category` | Read | Get spending breakdown by category for a period. Returns total spent, per-category amounts with percentages, and comparison to the previous period. |
| `get_spending_insights` | Read | Get spending insights and anomalies. Returns spending spikes, patterns, and actionable suggestions. |
| `get_weekly_summary` | Read | Get a weekly spending summary. Returns total spent, top categories, comparison to previous week, and largest transaction. |
| `search_transactions` | Read | Search transactions by merchant name, amount range, or natural language query. Returns matching transactions with a total. **(Deferred to Phase 2 — use `get_transactions` with merchant filter for P0)** |
| `get_upcoming_bills` | Read | Get bills and scheduled payments due in the next 48 hours. Returns bill name, amount, and due date. |
| `get_proactive_cards` | Read | Get prioritised proactive insight cards for the current session. Returns max 3 cards ranked by urgency (time-sensitive > actionable > informational). |
| `get_onboarding_checklist` | Read | Get the getting-started checklist with completion status for each item. |
| `update_checklist_item` | Write | Mark a checklist item as completed. Requires item key and completed status. |
| `get_value_prop_info` | Read | Get information about a specific value proposition topic (speed, control, FSCS protection, FCA regulation, features). Used during onboarding exploration. |
| `get_onboarding_status` | Read | Get the user's current onboarding step and progress percentage. |
| `verify_identity` | Write | Submit KYC verification (mocked for POC -- instant approval). Returns verification status. |
| `provision_account` | Write | Provision a bank account after KYC verification. Creates Griffin/mock account, returns sort code and account number. Route through AccountService per ADR-17. |
| `complete_onboarding` | Write | Mark onboarding as complete. Transitions system prompt from onboarding mode to full banking mode. Unlocks all banking tools. |
| `update_pending_action` | Write | Amend a pending confirmation action. Requires action_id and a params object with fields to update (e.g., `{ amount: 75 }`). Only works on pending (not expired/confirmed) actions. Resets the 5-minute expiry. Returns updated params and a new ConfirmationCard. Use when the user says things like "actually make it £75" or "change the reference". **(EX-Infra owns the tool handler — see EXI-06)** |

#### 3.3.1 `respond_to_user` — Synthetic Tool Specification

`respond_to_user` is a **synthetic tool** — it is defined in Claude's tool list but is NOT executed as server-side code. Instead, the agent loop intercepts this tool call to:

1. Extract `message` and `ui_components` from the tool input
2. Stream the message text + render UI cards to the mobile client
3. Terminate the agent loop (this is the "final response" signal)

**Input schema:**

```typescript
{
  name: "respond_to_user",
  input_schema: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "Conversational text to display to the user"
      },
      ui_components: {
        type: "array",
        description: "Rich UI cards to render. Omit for text-only responses.",
        items: {
          type: "object",
          properties: {
            type: { type: "string" },  // UIComponentType enum (see §3.4)
            data: { type: "object" }   // Component-specific payload
          },
          required: ["type", "data"]
        }
      }
    },
    required: ["message"]
  }
}
```

**Critical API contract — synthetic `tool_result` MUST be persisted:**

The Claude Messages API requires every `tool_use` block to have a matching `tool_result` in the conversation history. Since `respond_to_user` is not a real tool execution, the agent loop must persist a synthetic `tool_result` to keep the conversation valid:

```typescript
// After intercepting respond_to_user:
// 1. Save assistant message (contains the tool_use block)
await saveStructuredMessage(conversationId, 'assistant', response.content);

// 2. Save synthetic tool_result (prevents 400 on next turn)
await saveStructuredMessage(conversationId, 'user', [{
  type: 'tool_result',
  tool_use_id: respondCall.id,
  content: 'Response delivered to user.',
}]);
```

**Omitting this causes a 400 error on every subsequent conversation turn.** This is the #1 most common Claude tool-use bug. The existing code at `apps/api/src/services/agent.ts` (lines 158-169) does NOT currently persist this synthetic result — **this must be fixed during Foundation F1b.**

**Edge case — mixed tool calls:** If Claude emits other tool_use blocks alongside `respond_to_user` in the same response (e.g., `check_balance` + `respond_to_user`), the agent loop must execute the other tools first, persist their results, then handle the `respond_to_user` exit.

### 3.4 UIComponent Types

#### 3.4.1 Card Usage Policy

> **Design principle:** Cards enhance banking flows — they are not the default response mode. When a user is conversational, respond conversationally. Cards should feel like a natural escalation when structured data adds value, not UI noise.

**Use cards when:**
- The user requests financial data (balance, transactions, spending, credit score)
- A write action needs confirmation (payment, transfer, standing order)
- Displaying structured results that are hard to convey in text (spending breakdowns, loan offers, flex options)
- Proactive insights surface actionable information (bill reminders, spending spikes)
- Onboarding progress or checklists need visual state

**Use text-only when:**
- The user is conversational ("thanks", "cool", "tell me more")
- The user asks a general question ("how does a standing order work?", "what's a sort code?")
- Acknowledging an action ("got it", "I'll check that")
- The response is a simple confirmation that doesn't need structured data ("your reference has been updated")
- Clarifying or asking follow-up questions ("which account did you mean?")

**Card usage rules for the system prompt (`CARD_USAGE_POLICY` block):**

```
CARD USAGE POLICY:
- Only include ui_components when the response contains structured financial data,
  a confirmation action, or a proactive insight. Not every response needs a card.
- If the user's message is conversational, exploratory, or a general question,
  respond with text only. No card is better than an irrelevant card.
- Never attach a BalanceCard or TransactionListCard unless the user asked about
  their balance or transactions (or a tool returned that data for a relevant reason).
- QuickReplyGroup is appropriate after banking actions to suggest natural next steps,
  but not after every message. Omit quick replies for conversational exchanges.
- When in doubt, respond with text. Cards are an enhancement, not a requirement.
```

> **POC note:** Card usage thresholds will be refined through user testing. Log card attachment rates per message type to identify over-use patterns. Target: cards on ~40-60% of messages (banking-heavy conversations will be higher, general chat lower).

#### 3.4.2 UIComponent Union

The `respond_to_user` tool's `ui_components` array uses a discriminated union. Each component has a `type` field:

```typescript
type UIComponent =
  | BalanceCard
  | TransactionListCard
  | ConfirmationCard
  | SuccessCard
  | ErrorCard
  | InsightCard
  | PotStatusCard
  | SpendingBreakdownCard
  | LoanOfferCard
  | CreditScoreCard
  | PaymentHistoryCard
  | WelcomeCard
  | InputCard
  | QuoteCard
  | QuickReplyGroup         // ← Quick reply pills
  | StandingOrderCard
  | FlexOptionsCard
  | AutoSaveRuleCard
  | ChecklistCard
  | LoanStatusCard
  | FlexPlanCard
  | DatePickerCard           // Onboarding date collection
  | AddressInputCard;        // Onboarding address collection

// Quick reply pills — core interaction pattern for guided follow-ups
interface QuickReplyGroup {
  type: 'quick_reply_group';
  replies: Array<{
    label: string;          // Display text: "Check spending", "Send money"
    value: string;          // Sent as user message when tapped
    icon?: string;          // Optional Phosphor icon name
  }>;
  max_visible?: number;     // Default 4, overflow scrolls horizontally
}

// Confirmation card — includes action_id and expiry for client-side behavior
interface ConfirmationCard {
  type: 'confirmation_card';
  action_id: string;        // pending_actions.id — for confirm/reject/amend API calls
  expires_at: string;       // ISO 8601 — client renders countdown timer
  title: string;            // "Send £50.00 to James Mitchell"
  details: Array<{ label: string; value: string }>;  // Key-value rows
  balance_after?: number;   // Post-action balance
  retry_prompt?: string;    // e.g., "Send £50 to James" — used if card expires
}
```

**Quick reply persistence:** Quick replies are stored in the message's `ui_components` JSONB column. When loading conversation history, quick replies from past messages render as **disabled pills** (non-tappable, muted styling) to show what options were available without allowing stale actions.

**ConfirmationCard session resumption:** When the app reopens and renders a ConfirmationCard from history:
1. Check `expires_at` — if past, render expired state with `retry_prompt` as quick reply
2. If not expired, render live card with countdown timer
3. On Confirm tap, call `POST /api/confirm/:action_id` — server validates status server-side as backup

### 3.5 Tool Availability by Onboarding State

> **IMPORTANT:** Tools are gated by `profiles.onboarding_step`. During onboarding, only onboarding + read tools are available. After `ONBOARDING_COMPLETE`, all tools are available.

| Onboarding State | Available Tools |
|-----------------|-----------------|
| `STARTED` → `ADDRESS_COLLECTED` | `get_value_prop_info`, `get_onboarding_status`, `respond_to_user`, `update_pending_action` |
| `VERIFICATION_COMPLETE` → `ACCOUNT_PROVISIONED` | Above + `verify_identity`, `provision_account`, `get_accounts` |
| `FUNDING_OFFERED` | Above + `check_balance` (to verify funding) |
| `ONBOARDING_COMPLETE` | **All tools** (full banking mode) |

> **Implementation safety:** The tool registry must only register tools that have implemented handlers. Unimplemented P1/P2 tools must NOT appear in the system prompt or tool list sent to Claude. This prevents Claude from calling tools that don't exist.

The tool registry implements this gating:

```typescript
function getAvailableTools(onboardingStep: string): ToolDefinition[] {
  if (onboardingStep === 'ONBOARDING_COMPLETE') {
    return registry.getAllTools();
  }
  // During onboarding, restrict to onboarding-only tools
  return registry.getTools().filter(t =>
    t.squad === 'experience' && ONBOARDING_TOOLS.includes(t.name)
  );
}
```

```typescript
const ONBOARDING_TOOLS = [
  'respond_to_user',
  'get_onboarding_status',
  'get_value_prop_info',
  'verify_identity',
  'provision_account',
  'get_accounts',
  'check_balance',
  'complete_onboarding',
];
```

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
| `AI_OVERLOADED` | 529 | Anthropic API overloaded. Retry with exponential backoff (2s, 4s, 8s + jitter). Max 3 retries. See system-architecture.md §9.1 for mid-stream timeout handling. | `{ error: "ai_overloaded", message: "Our AI is temporarily busy. Please try again in a moment.", retry_after: 5 }` |
| `LOAN_INELIGIBLE` | 422 | User does not meet lending criteria |
| `FLEX_INELIGIBLE` | 422 | Loan not eligible for flex plan |
| `LOAN_NOT_FOUND` | 404 | Loan ID not found |
| `INTERNAL_ERROR` | 500 | Unhandled server error |

### 4.3 Domain Service Errors (ADR-17)

Domain services throw typed error classes that propagate through both the tool and REST layers:

- **Domain services** throw specific errors: `InsufficientFundsError`, `InvalidBeneficiaryError`, `ActionExpiredError`, `PotLockedError`, `LoanIneligibleError`, etc. Each carries a `code`, `message`, and optional `userMessage` for client display.
- **Tool handlers** catch these errors and return a `ToolResult` with `success: false`, mapping the error into a structured response that Claude uses to craft a natural-language reply (see below).
- **REST route handlers** catch the same errors and map them to appropriate HTTP status codes (e.g., `InsufficientFundsError` -> 422, `InvalidBeneficiaryError` -> 422, `ActionExpiredError` -> 410). Unrecognised errors fall through to the global error handler as 500.

This ensures consistent error semantics regardless of whether the operation is invoked via chat (tool) or direct API call.

### 4.4 Tool Error Handling

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
