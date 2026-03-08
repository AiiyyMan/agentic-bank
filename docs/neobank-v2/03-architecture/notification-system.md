# Notification System — Knock Integration

> **Phase 2 Addendum** | Solutions Architect | March 2026
>
> Technical specification for integrating [Knock](https://knock.app) as the notification infrastructure provider. Covers push notifications, in-app feed, user preferences, and all notification workflows for the Agentic Bank POC.

---

## 1. Why Knock

The original architecture design specified `expo-notifications` + `expo-server-sdk` for push delivery and a custom `push_tokens` table. That approach was replaced with Knock (this document). system-architecture.md §12.2 now references this specification. The original approach would have become problematic at P1:

- **No in-app feed.** In-app-only notifications (spending insights, weekly summary) need a custom notification list UI, read/unread state, real-time updates, and persistence. Building this from scratch is significant work.
- **No preference management.** Users need per-notification-type and per-channel opt-in/out controls (UK regulatory expectation). Knock provides this out of the box.
- **No batching or throttling.** Multiple rapid transactions would fire individual pushes. Knock's workflow engine supports batching (e.g., "3 payments received in the last 5 minutes") and throttling.
- **No delivery observability.** With raw Expo Push API, debugging delivery failures requires custom logging. Knock provides a message log with delivery status per recipient per channel.

Knock replaces the custom notification layer with a managed service that handles push delivery (via Expo), in-app feed (real-time WebSocket), user preferences, and workflow orchestration -- all accessible through a single SDK.

### 1.1 Pricing Fit

| Tier | Messages/month | Cost | Notes |
|------|---------------|------|-------|
| Developer (Free) | 10,000 | $0 | Sufficient for POC + demo |
| Starter | 50,000 | $250/mo | Post-launch if needed |

A "message" = one message to one user on one channel. A workflow that sends push + in-app = 2 messages. Failed/bounced messages do not count. For a POC with < 100 users, the free tier is more than adequate.

### 1.2 Implementation Phasing — What Ships When

> **This is the authoritative phasing guide for notifications.** Sections below describe the full system; this table clarifies what is built in each phase.

| Phase | What Ships | Sections |
|-------|-----------|----------|
| **Foundation (F1b)** | `NotificationPort` interface (`ports/notification.ts`), `MockNotificationAdapter` (logs to console). No Knock dependency yet. | §2.2, §2.4 |
| **P0 (POC demo)** | `KnockAdapter` (push only), Knock account + Expo Push channel configured, `payment-received` workflow (push channel only — no in-app feed), `KnockProvider` + `KnockExpoPushNotificationProvider` in mobile layout (no `KnockFeedProvider`). All push taps open chat tab (no per-workflow deep linking). | §2.3, §2.5, §4.2, §5.2, §6.1-6.2 |
| **P1** | In-app feed channel, `KnockFeedProvider` added to layout, `NotificationFeed` UI component, `NotificationBadge` on chat header, 5 additional workflows (`payment-sent`, `bill-due-tomorrow`, `payday-detected`, `loan-payment-upcoming`, `savings-goal-reached`), per-workflow push tap deep linking, `notificationStore` Zustand store. | §4.3-4.7, §5.3, §6.4-6.7 |
| **P1 (late)** | User preference management (Settings screen with category toggles), preference API routes, per-workflow drill-down UI. | §7.1-7.4 |
| **P2** | Enhanced security mode (Knock JWT signing, `GET /api/auth/knock-token`), in-app-only workflows (`spending-insight`, `weekly-summary`), notification batching configuration. | §4.8-4.9, §6.3 |

**Foundation builds the interface. P0 adds Knock with one workflow. P1 adds the feed and remaining workflows. P2 adds security hardening and insight notifications.** Each phase is independently deployable.

---

## 2. Architecture Integration

### 2.1 Where Knock Fits

Knock slots into the existing hexagonal architecture as an adapter behind `NotificationPort` (already defined as a placeholder in ports/notification.ts):

```
┌─────────────────────────────────────────────────────────────┐
│                    API SERVER (Fastify)                      │
│                                                             │
│  Services (AgentService, InsightService, etc.)              │
│       │                                                     │
│       ▼                                                     │
│  ┌──────────────────┐                                       │
│  │ NotificationPort │ (interface)                           │
│  │                  │                                       │
│  │  notify()        │                                       │
│  │  notifyBatch()   │                                       │
│  │  getPreferences()│                                       │
│  │  setPreferences()│                                       │
│  └────────┬─────────┘                                       │
│           │                                                 │
│  ┌────────▼─────────┐    ┌──────────────────┐              │
│  │  KnockAdapter    │───►│  Knock API       │              │
│  │  (implements     │    │  (workflows,     │              │
│  │   NotificationPort)   │   channels,      │              │
│  └──────────────────┘    │   preferences)   │              │
│                          └────────┬─────────┘              │
│  ┌──────────────────┐            │                         │
│  │  MockNotification│            ▼                         │
│  │  Adapter (dev)   │    ┌──────────────┐                  │
│  └──────────────────┘    │ Expo Push API│                  │
│                          └──────────────┘                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    MOBILE APP (Expo)                         │
│                                                             │
│  ┌──────────────────────────────────────────┐               │
│  │  KnockProvider (apiKey, userId, token)   │               │
│  │    ┌──────────────────────────────────┐  │               │
│  │    │ KnockExpoPushNotificationProvider│  │               │
│  │    │ (auto-registers Expo push token) │  │               │
│  │    │   ┌──────────────────────────┐   │  │               │
│  │    │   │ KnockFeedProvider        │   │  │               │
│  │    │   │ (feedId, real-time conn) │   │  │               │
│  │    │   │   ┌──────────────────┐   │   │  │               │
│  │    │   │   │  App Content     │   │   │  │               │
│  │    │   │   │  (tabs, screens) │   │   │  │               │
│  │    │   │   └──────────────────┘   │   │  │               │
│  │    │   └──────────────────────────┘   │  │               │
│  │    └──────────────────────────────────┘  │               │
│  └──────────────────────────────────────────┘               │
│                                                             │
│  Zustand: notificationStore (badge count, feed open state)  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 NotificationPort Interface

```typescript
// ports/notification.ts

export interface NotificationRecipient {
  userId: string;
  // Optional inline identification (for first-time users)
  name?: string;
  email?: string;
}

export interface NotificationPayload {
  workflow: string;            // Knock workflow key
  recipients: NotificationRecipient[];
  data: Record<string, unknown>;  // Template variables
  actor?: NotificationRecipient;  // Who triggered the action
  cancellationKey?: string;       // For cancellable workflows (e.g., bill reminders)
  tenant?: string;                // Multi-tenant support (future)
  idempotencyKey?: string;        // Prevent duplicate sends
}

export interface NotificationPreferences {
  workflows: Record<string, boolean | { channel_types: Record<string, boolean> }>;
  channel_types: Record<string, boolean>;
  categories: Record<string, boolean | { channel_types: Record<string, boolean> }>;
}

export interface NotificationPort {
  /** Send a notification via a Knock workflow */
  notify(payload: NotificationPayload): Promise<{ workflowRunId: string }>;

  /** Send notifications to multiple recipients with different data */
  notifyBatch(payloads: NotificationPayload[]): Promise<void>;

  /** Identify a user in Knock (sync from Supabase) */
  identifyUser(userId: string, properties: {
    name?: string;
    email?: string;
    phone?: string;
  }): Promise<void>;

  /** Get a user's notification preferences */
  getPreferences(userId: string): Promise<NotificationPreferences>;

  /** Set a user's notification preferences */
  setPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<void>;

  /** Register a push token for a user (called from mobile via API) */
  registerPushToken(userId: string, token: string): Promise<void>;

  /** Remove a push token (logout, token refresh) */
  removePushToken(userId: string, token: string): Promise<void>;
}
```

### 2.3 KnockAdapter Implementation

```typescript
// adapters/knock.ts

import Knock from '@knocklabs/node';
import { NotificationPort, NotificationPayload, NotificationPreferences } from '../ports/notification';
import { config } from '../lib/config';

export class KnockAdapter implements NotificationPort {
  private client: Knock;
  private expoChannelId: string;

  constructor() {
    this.client = new Knock({
      apiKey: config.KNOCK_SECRET_API_KEY,
    });
    this.expoChannelId = config.KNOCK_EXPO_CHANNEL_ID;
  }

  async notify(payload: NotificationPayload): Promise<{ workflowRunId: string }> {
    const result = await this.client.workflows.trigger(payload.workflow, {
      recipients: payload.recipients.map(r => {
        if (r.name || r.email) {
          // Inline identification -- Knock creates/updates the user
          return { id: r.userId, name: r.name, email: r.email };
        }
        return r.userId;
      }),
      data: payload.data,
      actor: payload.actor?.userId,
      cancellation_key: payload.cancellationKey,
      tenant: payload.tenant,
    });

    return { workflowRunId: result.workflow_run_id };
  }

  async notifyBatch(payloads: NotificationPayload[]): Promise<void> {
    // Knock supports up to 1000 recipients per trigger.
    // For different data per recipient, trigger separately.
    await Promise.all(payloads.map(p => this.notify(p)));
  }

  async identifyUser(userId: string, properties: {
    name?: string;
    email?: string;
    phone?: string;
  }): Promise<void> {
    await this.client.users.identify(userId, {
      name: properties.name,
      email: properties.email,
      phone_number: properties.phone,
    });
  }

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const prefs = await this.client.users.getPreferences(userId);
    return prefs as unknown as NotificationPreferences;
  }

  async setPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>,
  ): Promise<void> {
    await this.client.users.setPreferences(userId, preferences);
  }

  async registerPushToken(userId: string, token: string): Promise<void> {
    await this.client.users.setChannelData(userId, this.expoChannelId, {
      tokens: [token],
    });
  }

  async removePushToken(userId: string, token: string): Promise<void> {
    // Fetch existing tokens, remove the specified one
    const existing = await this.client.users.getChannelData(userId, this.expoChannelId);
    const tokens = (existing?.data as any)?.tokens ?? [];
    const filtered = tokens.filter((t: string) => t !== token);
    await this.client.users.setChannelData(userId, this.expoChannelId, {
      tokens: filtered,
    });
  }
}
```

### 2.4 MockNotificationAdapter (Development)

```typescript
// adapters/mock-notification.ts

import { NotificationPort, NotificationPayload, NotificationPreferences } from '../ports/notification';
import { logger } from '../lib/logger';

export class MockNotificationAdapter implements NotificationPort {
  private preferences: Map<string, Partial<NotificationPreferences>> = new Map();

  async notify(payload: NotificationPayload): Promise<{ workflowRunId: string }> {
    const runId = `mock-${Date.now()}`;
    logger.info({
      msg: 'MOCK NOTIFICATION',
      workflow: payload.workflow,
      recipients: payload.recipients.map(r => r.userId),
      data: payload.data,
      workflowRunId: runId,
    });
    return { workflowRunId: runId };
  }

  async notifyBatch(payloads: NotificationPayload[]): Promise<void> {
    await Promise.all(payloads.map(p => this.notify(p)));
  }

  async identifyUser(): Promise<void> { /* no-op */ }

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    return (this.preferences.get(userId) ?? {
      workflows: {},
      channel_types: {},
      categories: {},
    }) as NotificationPreferences;
  }

  async setPreferences(userId: string, prefs: Partial<NotificationPreferences>): Promise<void> {
    this.preferences.set(userId, { ...this.preferences.get(userId), ...prefs });
  }

  async registerPushToken(userId: string, token: string): Promise<void> {
    logger.info({ msg: 'MOCK: Push token registered', userId, token });
  }

  async removePushToken(userId: string, token: string): Promise<void> {
    logger.info({ msg: 'MOCK: Push token removed', userId, token });
  }
}
```

### 2.5 Adapter Selection (config.ts)

```typescript
// In lib/config.ts, add:
KNOCK_SECRET_API_KEY: process.env.KNOCK_SECRET_API_KEY ?? '',
KNOCK_PUBLIC_API_KEY: process.env.KNOCK_PUBLIC_API_KEY ?? '',
KNOCK_EXPO_CHANNEL_ID: process.env.KNOCK_EXPO_CHANNEL_ID ?? '',
KNOCK_FEED_CHANNEL_ID: process.env.KNOCK_FEED_CHANNEL_ID ?? '',
KNOCK_SIGNING_KEY: process.env.KNOCK_SIGNING_KEY ?? '',  // For enhanced security mode

// In adapter factory (e.g., lib/adapters.ts):
export function createNotificationAdapter(): NotificationPort {
  if (config.USE_MOCK_BANKING || !config.KNOCK_SECRET_API_KEY) {
    return new MockNotificationAdapter();
  }
  return new KnockAdapter();
}
```

---

## 3. User Identity Sync (Supabase to Knock)

Knock maintains its own user store. Users must be "identified" in Knock before they can receive notifications. We sync at two points:

### 3.1 On Signup/Onboarding Completion

When `profiles.onboarding_step` transitions to `ONBOARDING_COMPLETE`, identify the user in Knock:

```typescript
// In onboarding service, after account provisioning:
await notificationPort.identifyUser(userId, {
  name: profile.display_name,
  email: user.email,
});
```

### 3.2 On Profile Update

If the user updates their name or email (P1), re-identify:

```typescript
// In profile update handler:
await notificationPort.identifyUser(userId, {
  name: updatedProfile.display_name,
  email: updatedProfile.email,
});
```

### 3.3 Identity Mapping

Knock user IDs = Supabase `auth.users.id` (UUID). No mapping table needed. The Supabase JWT `sub` claim IS the Knock user ID. This is critical -- it means the mobile app can initialize `KnockProvider` with the same user ID it uses for Supabase auth.

---

## 4. Knock Workflow Definitions

Each notification type maps to a Knock workflow configured in the Knock dashboard. Below are the workflow specifications.

> **Service layer pattern (ADR-17):** Write-triggered notifications are dispatched from domain services (e.g., `PaymentService`, `PotService`, `InsightService`), not from route handlers or adapter callbacks directly. Each service method writes an `audit_log` entry before dispatching the notification, ensuring a durable record exists even if notification delivery fails. Chat-contextual notifications (e.g., confirming an action the user just requested in conversation) remain in tool handlers.

### 4.1 Workflow Category Taxonomy

Workflows are grouped into categories for preference management:

| Category | Description | Default Channels |
|----------|-------------|-----------------|
| `transactional` | Payment and account events | push + in-app |
| `reminders` | Upcoming bills, loan payments | push + in-app |
| `milestones` | Goals reached, payday detected | push + in-app |
| `insights` | Spending analysis, summaries | in-app only |

### 4.2 P0: payment-received

**Knock workflow key:** `payment-received`
**Category:** `transactional`
**Channels:** P0: Push (Expo) only. P1: add In-app feed channel step.
**Priority:** P0 -- required for POC demo

**Workflow steps (full — P1):**
1. **In-app feed** channel step -- delivers immediately to feed (add at P1)
2. **Push** channel step (Expo) -- delivers immediately (P0)

**Trigger point:** When `MockBankingAdapter` or `GriffinAdapter` detects an incoming credit, the webhook handler / adapter callback calls `PaymentService.processIncomingPayment()`, which validates, persists, writes the audit log, and dispatches the notification.

```typescript
// In PaymentService.processIncomingPayment() (called from Griffin webhook handler or mock adapter callback):
// audit_log written before notification dispatch
await notificationPort.notify({
  workflow: 'payment-received',
  recipients: [{ userId: recipientUserId }],
  data: {
    amount: '250.00',                    // String, formatted
    amount_raw: 25000,                   // Integer pence, for sorting/filtering
    currency: 'GBP',
    sender_name: 'James Wilson',         // Payer display name
    reference: 'Birthday money',        // Payment reference (if provided)
    account_name: 'Main Account',       // Receiving account
    new_balance: '1,497.50',            // Updated balance after credit
    timestamp: new Date().toISOString(),
  },
  actor: { userId: senderUserId },       // Optional: if sender is also a user
  idempotencyKey: `payment-${transactionId}`, // Prevent duplicate notifications
});
```

**Push template (Knock dashboard):**
```
Title: Payment received
Body: {{sender_name}} sent you £{{amount}}{{#if reference}} — "{{reference}}"{{/if}}
```

**In-app feed template:**
```
You received £{{amount}} from {{sender_name}}.
{{#if reference}}Reference: "{{reference}}"{{/if}}
Your {{account_name}} balance is now £{{new_balance}}.
```

**Deep link:** On tap, navigate to transaction detail: `agentic-bank://transactions/{{transaction_id}}`

---

### 4.3 P1: payment-sent

**Knock workflow key:** `payment-sent`
**Category:** `transactional`
**Channels:** Push + In-app feed

**Trigger point:** The `POST /api/confirm/:actionId` route calls `PaymentService.confirmPayment()`. The service validates the pending action, executes the payment via `BankingPort`, writes the audit log, then dispatches the notification.

```typescript
// In PaymentService.confirmPayment() (called from confirm route handler):
// audit_log written before notification dispatch
await notificationPort.notify({
  workflow: 'payment-sent',
  recipients: [{ userId }],
  data: {
    amount: '50.00',
    currency: 'GBP',
    recipient_name: 'Sarah Chen',
    reference: 'Dinner last night',
    account_name: 'Main Account',
    new_balance: '1,197.50',
    timestamp: new Date().toISOString(),
  },
  idempotencyKey: `payment-sent-${actionId}`,
});
```

**Push template:**
```
Title: Payment sent
Body: £{{amount}} sent to {{recipient_name}}
```

---

### 4.4 P1: bill-due-tomorrow

**Knock workflow key:** `bill-due-tomorrow`
**Category:** `reminders`
**Channels:** Push + In-app feed
**Scheduling:** Triggered by a Supabase scheduled function (cron) that runs daily at 08:00 UTC.

**Workflow steps:**
1. In-app feed channel step
2. Push channel step

**Trigger point:** A Supabase Edge Function (cron) calls the internal API endpoint `POST /api/internal/notifications/bill-reminders`. The route delegates to `StandingOrderService.sendDueReminders()`, which queries upcoming bills, writes audit log entries, and dispatches notifications. See system-architecture.md §11.4.4 for the scheduled job pattern.

```typescript
// In StandingOrderService.sendDueReminders() (called from internal API endpoint, triggered by Edge Function cron):
const dueTomorrow = await this.standingOrderRepo.findDueTomorrow();

for (const order of dueTomorrow) {
  await this.auditLog.write({ action: 'bill_reminder_sent', entityId: order.id, userId: order.user_id });
  await this.notificationPort.notify({
    workflow: 'bill-due-tomorrow',
    recipients: [{ userId: order.user_id }],
    data: {
      payee_name: order.beneficiary_name,
      amount: formatCurrency(order.amount),
      due_date: formatDate(order.next_payment_date),
      account_name: 'Main Account',
      current_balance: await this.accountService.getFormattedBalance(order.user_id),
    },
    cancellationKey: `bill-${order.id}-${order.next_payment_date}`,
  });
}
```

**Push template:**
```
Title: Bill due tomorrow
Body: {{payee_name}} — £{{amount}} due {{due_date}}
```

---

### 4.5 P1: payday-detected

**Knock workflow key:** `payday-detected`
**Category:** `milestones`
**Channels:** Push + In-app feed

**Trigger point:** When an incoming credit exceeds a threshold (e.g., > GBP 500) and matches salary patterns (same sender, similar amount, monthly frequency). Detected in the transaction processing pipeline.

```typescript
// In InsightService.processTransaction() (called from transaction ingestion pipeline):
if (isSalaryPayment(transaction)) {
  await notificationPort.notify({
    workflow: 'payday-detected',
    recipients: [{ userId }],
    data: {
      amount: formatCurrency(transaction.amount),
      sender_name: transaction.merchant,  // merchant column holds payer name for credits
      account_name: 'Main Account',
      new_balance: formatCurrency(newBalance),
      day_of_month: new Date().getDate().toString(),
    },
    idempotencyKey: `payday-${userId}-${transaction.id}`,
  });
}
```

**Push template:**
```
Title: Payday!
Body: £{{amount}} from {{sender_name}} just landed
```

**In-app feed template:**
```
Payday! £{{amount}} received from {{sender_name}}.
Your {{account_name}} balance is now £{{new_balance}}.
```

---

### 4.6 P1: loan-payment-upcoming

**Knock workflow key:** `loan-payment-upcoming`
**Category:** `reminders`
**Channels:** Push + In-app feed
**Scheduling:** Triggered by daily cron job, 3 days before due date.

**Trigger point:** Daily cron scans `loan_payments` where `due_date = CURRENT_DATE + INTERVAL '3 days'` and `status = 'pending'`.

```typescript
// In scheduled function:
const upcoming = await supabase
  .from('loan_payments')
  .select('*, loans!inner(*, profiles!inner(id))')
  .eq('status', 'pending')
  .eq('due_date', threeDaysFromNow.toISOString().split('T')[0]);

for (const payment of upcoming.data) {
  await notificationPort.notify({
    workflow: 'loan-payment-upcoming',
    recipients: [{ userId: payment.loans.profiles.id }],
    data: {
      amount: formatCurrency(payment.amount),
      due_date: formatDate(payment.due_date),
      loan_name: payment.loans.purpose || 'Personal Loan',
      remaining_payments: payment.loans.term_months - payment.loans.payments_made,
      current_balance: await getBalance(payment.loans.profiles.id),
    },
    cancellationKey: `loan-payment-${payment.id}`,
  });
}
```

**Push template:**
```
Title: Loan payment in 3 days
Body: £{{amount}} for {{loan_name}} due {{due_date}}
```

---

### 4.7 P1: savings-goal-reached

**Knock workflow key:** `savings-goal-reached`
**Category:** `milestones`
**Channels:** Push + In-app feed

**Trigger point:** After a pot transfer (deposit) when `pot.balance >= pot.goal` and `pot.goal IS NOT NULL`.

```typescript
// In PotService.transfer() (called from pot transfer tool handler or REST route):
// audit_log written before notification dispatch
const pot = await this.getPotAfterTransfer(potId);
if (pot.goal && pot.balance >= pot.goal) {
  await notificationPort.notify({
    workflow: 'savings-goal-reached',
    recipients: [{ userId }],
    data: {
      pot_name: pot.name,
      goal_amount: formatCurrency(pot.goal),       // column is `goal` in pots table
      current_balance: formatCurrency(pot.balance),
      over_by: pot.balance > pot.goal
        ? formatCurrency(pot.balance - pot.goal)
        : undefined,
    },
    idempotencyKey: `goal-reached-${potId}-${pot.goal}`,
  });
}
```

**Push template:**
```
Title: Goal reached!
Body: Your "{{pot_name}}" pot hit £{{goal_amount}}
```

---

### 4.8 P2: spending-insight (In-App Only)

**Knock workflow key:** `spending-insight`
**Category:** `insights`
**Channels:** In-app feed only (no push channel step)

**Trigger point:** When the insight engine detects a spending spike or noteworthy pattern. Triggered after transaction batch analysis.

```typescript
await notificationPort.notify({
  workflow: 'spending-insight',
  recipients: [{ userId }],
  data: {
    insight_type: 'spending_spike',  // or 'category_increase', 'new_merchant', etc.
    title: 'Dining spending up this week',
    body: 'You\'ve spent £87.40 on dining this week, 45% more than your 4-week average of £60.20.',
    category: 'Dining',
    current_amount: '87.40',
    average_amount: '60.20',
    percentage_change: '45',
    period: 'this week',
  },
});
```

**In-app feed template:**
```
{{title}}
{{body}}
```

---

### 4.9 P2: weekly-summary (In-App Only)

**Knock workflow key:** `weekly-summary`
**Category:** `insights`
**Channels:** In-app feed only
**Scheduling:** Triggered by cron every Sunday at 18:00 UTC.

**Workflow steps:**
1. **Fetch step** -- HTTP request to the API to compute the user's weekly summary data
2. **In-app feed** channel step -- delivers the summary

Alternatively, the cron job pre-computes the summary and passes data directly:

```typescript
// Sunday evening cron:
const activeUsers = await getActiveUsers();

for (const user of activeUsers) {
  const summary = await computeWeeklySummary(user.id);
  await notificationPort.notify({
    workflow: 'weekly-summary',
    recipients: [{ userId: user.id }],
    data: {
      week_ending: formatDate(sundayDate),
      total_spent: formatCurrency(summary.totalSpent),
      total_income: formatCurrency(summary.totalIncome),
      top_category: summary.topCategory,
      top_category_amount: formatCurrency(summary.topCategoryAmount),
      transaction_count: summary.transactionCount,
      savings_deposited: formatCurrency(summary.savingsDeposited),
      comparison_text: summary.comparisonText, // e.g., "12% less than last week"
    },
  });
}
```

**In-app feed template:**
```
Your week in review (w/e {{week_ending}})
Spent: £{{total_spent}} · Income: £{{total_income}}
Top category: {{top_category}} (£{{top_category_amount}})
{{comparison_text}}
```

---

## 5. Knock Channel Configuration (P0: Expo Push only; P1: add In-App Feed)

### 5.1 Channels to Create in Knock Dashboard

| Channel | Type | Purpose |
|---------|------|---------|
| Expo Push | Push (Expo) | Delivers to iOS/Android via Expo Push API |
| In-App Feed | In-App Feed | Powers the notification feed UI |

### 5.2 Expo Push Channel Setup

1. In Knock dashboard: **Settings > Channels > Add Channel > Expo Push Notifications**
2. Configure:
   - **Expo project name:** `@agentic-bank/mobile` (matches `app.json` slug)
   - **Access token:** (only if enhanced push security is enabled in Expo)
3. Note the **channel ID** -- this becomes `KNOCK_EXPO_CHANNEL_ID`
4. Enable **automatic token deregistration** for bounced tokens (per-environment setting)

### 5.3 In-App Feed Channel Setup

1. In Knock dashboard: **Settings > Channels > Add Channel > In-App Feed**
2. Note the **channel ID** -- this becomes `KNOCK_FEED_CHANNEL_ID`
3. Enable **enhanced security mode** for production (requires signed JWT)

---

## 6. Mobile Integration

### 6.1 Dependencies

```bash
npx expo install @knocklabs/expo @knocklabs/react-native @knocklabs/client expo-notifications expo-device expo-constants
```

Note: Use `@knocklabs/expo` (not `@knocklabs/react-native` alone) for Expo-managed projects. The Expo SDK wraps the React Native SDK with Expo-specific push notification handling.

### 6.2 Provider Setup (_layout.tsx)

The Knock providers nest inside the existing auth provider and wrap the tab navigator:

```typescript
// app/_layout.tsx

import { KnockProvider } from '@knocklabs/expo';
import { KnockExpoPushNotificationProvider } from '@knocklabs/expo';
import { KnockFeedProvider } from '@knocklabs/expo';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notification';
import { generateKnockToken } from '@/lib/knock';

function AppWithKnock({ children }: { children: React.ReactNode }) {
  const { session, profile } = useAuthStore();
  const { setExpoPushToken } = useNotificationStore();

  if (!session?.user?.id) {
    // Not authenticated -- don't initialize Knock
    return <>{children}</>;
  }

  return (
    <KnockProvider
      apiKey={process.env.EXPO_PUBLIC_KNOCK_PUBLIC_API_KEY!}
      userId={session.user.id}
      userToken={generateKnockToken(session.user.id)} // Enhanced security
    >
      <KnockExpoPushNotificationProvider
        knockExpoChannelId={process.env.EXPO_PUBLIC_KNOCK_EXPO_CHANNEL_ID!}
        autoRegister={true}
      >
        <KnockFeedProvider
          feedId={process.env.EXPO_PUBLIC_KNOCK_FEED_CHANNEL_ID!}
        >
          {children}
        </KnockFeedProvider>
      </KnockExpoPushNotificationProvider>
    </KnockProvider>
  );
}
```

### 6.3 Knock User Token Generation (P2 — enhanced security mode)

For enhanced security mode (production), the server signs a JWT for the Knock client:

```typescript
// API route: GET /api/auth/knock-token
import Knock from '@knocklabs/node';

fastify.get('/api/auth/knock-token', async (request, reply) => {
  const userId = request.userId; // From JWT middleware

  const token = await Knock.signUserToken(userId, {
    signingKey: config.KNOCK_SIGNING_KEY,
    expiresInSeconds: 3600, // 1 hour
  });

  return { data: { token } };
});
```

On the mobile side, fetch this token on login and pass it to `KnockProvider`:

```typescript
// lib/knock.ts
import { api } from './api';

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

export async function getKnockToken(): Promise<string | undefined> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  try {
    const { data } = await api.get('/auth/knock-token');
    cachedToken = data.token;
    tokenExpiry = Date.now() + 50 * 60 * 1000; // Refresh 10 min before expiry
    return cachedToken;
  } catch {
    return undefined; // Falls back to non-enhanced mode in dev
  }
}
```

### 6.4 In-App Notification Feed (P1)

Knock's React Native SDK does NOT provide pre-built UI components for the feed. We build our own UI using the `useNotifications` hook and the feed client. This is actually preferable -- it means the notification feed uses our NativeWind design system.

```typescript
// components/NotificationFeed.tsx

import { useKnockFeed } from '@knocklabs/expo';
import { FlatList, Pressable, View, Text } from 'react-native';
import { formatRelativeTime } from '@/lib/date';

export function NotificationFeed() {
  const { feedClient, useFeedStore } = useKnockFeed();
  const items = useFeedStore((state) => state.items);
  const metadata = useFeedStore((state) => state.metadata);

  const handleMarkAsRead = async (itemId: string) => {
    await feedClient.markAsRead({ item_ids: [itemId] });
  };

  const handleMarkAllRead = async () => {
    await feedClient.markAllAsRead();
  };

  return (
    <View className="flex-1 bg-surface-primary">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border-primary">
        <Text className="text-lg font-inter-semibold text-text-primary">
          Notifications
        </Text>
        {metadata.unseen_count > 0 && (
          <Pressable onPress={handleMarkAllRead}>
            <Text className="text-sm font-inter-medium text-brand-primary">
              Mark all read
            </Text>
          </Pressable>
        )}
      </View>

      {/* Feed list */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationRow
            item={item}
            onPress={() => handleMarkAsRead(item.id)}
          />
        )}
        onEndReached={() => feedClient.fetchNextPage()}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View className="items-center justify-center py-12">
            <Text className="text-sm text-text-secondary">
              No notifications yet
            </Text>
          </View>
        }
      />
    </View>
  );
}

function NotificationRow({ item, onPress }: { item: any; onPress: () => void }) {
  const isUnread = !item.read_at;

  return (
    <Pressable
      onPress={onPress}
      className={`px-4 py-3 border-b border-border-primary ${
        isUnread ? 'bg-surface-secondary' : 'bg-surface-primary'
      }`}
    >
      <View className="flex-row items-start">
        {isUnread && (
          <View className="w-2 h-2 rounded-full bg-brand-primary mt-1.5 mr-2" />
        )}
        <View className="flex-1">
          <Text className="text-sm font-inter-medium text-text-primary">
            {item.blocks[0]?.rendered}
          </Text>
          <Text className="text-xs text-text-secondary mt-1">
            {formatRelativeTime(item.inserted_at)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
```

### 6.5 Notification Badge on Tab Bar (P1)

```typescript
// components/NotificationBadge.tsx

import { useKnockFeed } from '@knocklabs/expo';
import { View, Text } from 'react-native';

export function NotificationBadge() {
  const { useFeedStore } = useKnockFeed();
  const unseenCount = useFeedStore((state) => state.metadata.unseen_count);

  if (unseenCount === 0) return null;

  return (
    <View className="absolute -top-1 -right-2 bg-status-error rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
      <Text className="text-[10px] font-inter-bold text-white">
        {unseenCount > 99 ? '99+' : unseenCount}
      </Text>
    </View>
  );
}
```

### 6.6 Notification Feed Access Point (P1)

The notification feed is accessible from the chat header (bell icon) or as a modal/sheet. It is NOT a separate tab -- it overlays the current screen:

```typescript
// In the chat header or a global header component:
import { Bell } from 'phosphor-react-native';
import { NotificationBadge } from '@/components/NotificationBadge';

function ChatHeader() {
  const [feedVisible, setFeedVisible] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setFeedVisible(true)}
        className="relative p-2"
      >
        <Bell size={24} color={tokens.color.icon.primary} />
        <NotificationBadge />
      </Pressable>

      <Modal
        visible={feedVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <NotificationFeed onClose={() => setFeedVisible(false)} />
      </Modal>
    </>
  );
}
```

### 6.7 Push Notification Tap Handling (P0: open chat tab; P1: per-workflow deep linking)

When a user taps a push notification, navigate to the relevant screen:

```typescript
// In the root layout or a dedicated handler:
import { useExpoPushNotifications } from '@knocklabs/expo';
import { router } from 'expo-router';

function PushNotificationHandler() {
  const { onNotificationTapped } = useExpoPushNotifications();

  useEffect(() => {
    const unsubscribe = onNotificationTapped((notification) => {
      const data = notification.request.content.data;
      const workflow = data?.knock_workflow;

      switch (workflow) {
        case 'payment-received':
        case 'payment-sent':
          router.push(`/transactions/${data.transaction_id}`);
          break;
        case 'bill-due-tomorrow':
        case 'loan-payment-upcoming':
          router.push('/accounts');
          break;
        case 'savings-goal-reached':
          router.push(`/pots/${data.pot_id}`);
          break;
        default:
          // Open notification feed
          router.push('/notifications');
          break;
      }
    });

    return unsubscribe;
  }, []);

  return null;
}
```

---

## 7. User Preference Management (P1 — defer until multiple workflows are live)

### 7.1 Default Preferences (Knock Dashboard)

Set environment-level defaults so all new users start with sensible opt-ins:

```json
{
  "channel_types": {
    "push": true,
    "in_app_feed": true
  },
  "categories": {
    "transactional": {
      "channel_types": { "push": true, "in_app_feed": true }
    },
    "reminders": {
      "channel_types": { "push": true, "in_app_feed": true }
    },
    "milestones": {
      "channel_types": { "push": true, "in_app_feed": true }
    },
    "insights": {
      "channel_types": { "push": false, "in_app_feed": true }
    }
  }
}
```

Key design decision: `insights` category defaults push to `false`. These are non-urgent, informational notifications. Users can opt in to push for insights if they want.

### 7.2 Settings Screen UI

The Settings tab includes a "Notifications" section that maps to Knock categories:

```
┌────────────────────────────────────────┐
│  Notifications                          │
├────────────────────────────────────────┤
│                                        │
│  Payments & Transactions          ▸    │
│  Push ●  In-app ●                      │
│                                        │
│  Reminders (Bills, Loans)         ▸    │
│  Push ●  In-app ●                      │
│                                        │
│  Milestones (Payday, Goals)       ▸    │
│  Push ●  In-app ●                      │
│                                        │
│  Insights & Summaries             ▸    │
│  Push ○  In-app ●                      │
│                                        │
└────────────────────────────────────────┘

● = enabled (green)   ○ = disabled (grey)
```

Drill-down into a category shows per-workflow toggles:

```
┌────────────────────────────────────────┐
│  ← Payments & Transactions             │
├────────────────────────────────────────┤
│                                        │
│  Payment received                      │
│  Push [ON]  In-app [ON]                │
│                                        │
│  Payment sent                          │
│  Push [ON]  In-app [ON]                │
│                                        │
└────────────────────────────────────────┘
```

### 7.3 Preference API Routes

```typescript
// routes/notifications.ts

// GET /api/notifications/preferences
fastify.get('/api/notifications/preferences', async (request) => {
  const prefs = await notificationPort.getPreferences(request.userId);
  return { data: prefs };
});

// PUT /api/notifications/preferences
fastify.put('/api/notifications/preferences', async (request) => {
  const { preferences } = request.body as {
    preferences: Partial<NotificationPreferences>;
  };
  await notificationPort.setPreferences(request.userId, preferences);
  return { data: { success: true } };
});
```

### 7.4 Regulatory Notes (UK)

- **Transactional notifications** (payment received/sent) cannot be fully opted out in a regulated banking context. The in-app feed channel must always remain enabled for transactional events. The push channel can be disabled.
- The preference UI should show the in-app toggle as locked/always-on for transactional categories, with explanatory text: "Required for your account security."
- This is enforced in Knock via **preference conditions** on the transactional category's in-app channel step: the step runs regardless of user preference.

---

## 8. Environment Configuration

### 8.1 Required Environment Variables

**API Server (.env):**
```
KNOCK_SECRET_API_KEY=sk_live_xxxx      # Server-side API key (from Knock dashboard)
KNOCK_EXPO_CHANNEL_ID=xxxx-xxxx        # UUID of the Expo push channel
KNOCK_FEED_CHANNEL_ID=xxxx-xxxx        # UUID of the in-app feed channel
KNOCK_SIGNING_KEY=xxxx                 # For signing user tokens (enhanced security)
```

**Mobile App (.env / EAS secrets):**
```
EXPO_PUBLIC_KNOCK_PUBLIC_API_KEY=pk_live_xxxx   # Client-side API key
EXPO_PUBLIC_KNOCK_EXPO_CHANNEL_ID=xxxx-xxxx     # Same Expo channel ID
EXPO_PUBLIC_KNOCK_FEED_CHANNEL_ID=xxxx-xxxx     # Same feed channel ID
```

### 8.2 EAS Secrets

Add Knock keys to EAS secrets (not committed to repo):

```bash
eas secret:create --name EXPO_PUBLIC_KNOCK_PUBLIC_API_KEY --value pk_live_xxxx
eas secret:create --name EXPO_PUBLIC_KNOCK_EXPO_CHANNEL_ID --value xxxx
eas secret:create --name EXPO_PUBLIC_KNOCK_FEED_CHANNEL_ID --value xxxx
```

### 8.3 Knock Dashboard Setup Checklist

1. Create Knock account at [knock.app](https://knock.app)
2. Create Development environment (auto-created)
3. Add Expo Push channel (Settings > Channels)
4. Add In-App Feed channel (Settings > Channels)
5. Set default preferences (Settings > Preferences)
6. Create all workflows listed in section 4
7. For each workflow: add channel steps, configure templates with Liquid syntax
8. Test workflows using Knock's test runner
9. Generate signing key (Settings > Security) for enhanced security mode
10. Promote to Production environment when ready

---

## 9. Data Flow Diagrams

### 9.1 Payment Received (P0 -- End-to-End)

```
Griffin/Mock                 API Server                    Knock                    Mobile App
    │                            │                          │                          │
    │  Incoming credit webhook   │                          │                          │
    │  (or mock event)           │                          │                          │
    ├───────────────────────────►│                          │                          │
    │                            │                          │                          │
    │                            │  1. Process transaction  │                          │
    │                            │  2. Update balance       │                          │
    │                            │  3. Categorise           │                          │
    │                            │                          │                          │
    │                            │  workflows.trigger(      │                          │
    │                            │    'payment-received',   │                          │
    │                            │    { recipients, data }) │                          │
    │                            ├─────────────────────────►│                          │
    │                            │                          │                          │
    │                            │                          │  Push via Expo Push API  │
    │                            │                          ├─────────────────────────►│
    │                            │                          │                          │  OS notification
    │                            │                          │                          │  banner shown
    │                            │                          │                          │
    │                            │                          │  In-app feed update      │
    │                            │                          │  (real-time WebSocket)   │
    │                            │                          ├─────────────────────────►│
    │                            │                          │                          │  Badge count
    │                            │                          │                          │  increments,
    │                            │                          │                          │  feed item appears
```

### 9.2 User Preference Update

```
Mobile App                   API Server                    Knock
    │                            │                          │
    │  PUT /api/notifications/   │                          │
    │    preferences             │                          │
    │  { categories: {           │                          │
    │    insights: {             │                          │
    │      channel_types: {      │                          │
    │        push: true }}}      │                          │
    ├───────────────────────────►│                          │
    │                            │                          │
    │                            │  users.setPreferences(   │
    │                            │    userId, prefs)        │
    │                            ├─────────────────────────►│
    │                            │                          │  Stored in Knock.
    │                            │                          │  Next workflow run
    │                            │         200 OK          │  evaluates updated
    │                            │◄─────────────────────────┤  preferences.
    │         200 OK             │                          │
    │◄───────────────────────────┤                          │
```

---

## 10. Design History

> **Context:** The original system-architecture.md §12.2 specified `expo-server-sdk` direct + a `push_tokens` Supabase table. That approach was replaced with Knock after UX review identified the need for in-app feed, preference management, and delivery observability at P1 scale. This section documents what changed for architectural traceability.

| Concern | Original Design | Knock Design |
|---------|----------------|--------------|
| Push delivery | `expo-server-sdk` direct | Knock Expo channel |
| Token storage | `push_tokens` table in Supabase | Knock channel data (per-user) |
| In-app notifications | Not specified | Knock in-app feed (WebSocket, P1) |
| Preferences | Not specified | Knock PreferenceSet API (P1) |
| Templates | Hardcoded strings in API server | Knock dashboard (Liquid) |

**What stayed the same:** `NotificationPort` interface, trigger points in business logic, Supabase UUID = Knock user ID.

---

## 11. Knock vs. SSE Streaming -- No Conflict

The app already uses SSE for chat streaming (ADR-04). Knock uses a separate WebSocket connection for real-time in-app feed updates. These do not conflict:

- **SSE (chat):** `fetch` + `ReadableStream` to API server. Short-lived (duration of a chat response). Client-initiated.
- **Knock WebSocket (feed):** Persistent connection to Knock's infrastructure. Managed by `KnockFeedProvider`. Server-initiated (new notifications push down).

Both can coexist. The SSE connection is to our Fastify server; the Knock WebSocket is to Knock's servers. Different origins, different purposes, no port conflicts.

---

## 12. ADR-13: Knock for Notification Infrastructure

**Status:** Accepted

**Context:** Section 12.2 of system-architecture.md specifies a minimal notification approach using `expo-server-sdk` directly. As P1 notification types increase (8 workflows), and P2 adds in-app-only notifications, the custom approach requires building: a notification feed UI with real-time updates, read/unread state management, user preference storage and evaluation, push token lifecycle management, delivery logging, and notification batching. Knock provides all of these as managed services.

**Decision:** Use Knock (knock.app) as the notification infrastructure provider. Implement behind `NotificationPort` to maintain hexagonal architecture. Use `@knocklabs/node` on the server and `@knocklabs/expo` on the mobile client.

**Alternatives Considered:**
1. **Raw `expo-server-sdk`** (current plan) -- Simple push delivery but no in-app feed, no preferences, no batching, no observability. Each P1/P2 feature adds custom code.
2. **Novu** -- Open-source notification infrastructure. Self-hostable but adds operational burden. Less mature Expo integration than Knock.
3. **OneSignal** -- Strong push infrastructure but weaker in-app feed and preference management. More focused on marketing/engagement than transactional notifications.
4. **Supabase Realtime for in-app + expo-server-sdk for push** -- Two separate systems. Preference management still custom. No unified message log.

**Consequences:**
- (+) In-app feed, preferences, push delivery, and batching from a single provider
- (+) Dashboard for workflow management, template editing, and delivery debugging
- (+) Free tier (10K messages/month) sufficient for POC
- (+) Knock user IDs = Supabase UUIDs, no mapping layer needed
- (+) `NotificationPort` abstraction means Knock can be swapped out later
- (-) Adds a third-party dependency (managed service)
- (-) Knock's React Native SDK has no pre-built UI components (must build feed UI)
- (-) Enhanced security mode requires server-side JWT signing (additional API route)
- (-) Templates live in Knock dashboard, not in version control (mitigated by Knock Management API / CLI for CI/CD)
