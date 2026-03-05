# Mock Banking Layer: Research & Architecture Recommendation

> Research date: 2026-03-03
> Scope: Tooling, patterns, and architecture for a swappable mock banking backend in an agentic digital banking POC

---

## Architecture Recommendation (TL;DR)

**Use a Hexagonal (Ports & Adapters) architecture with in-process mock implementations, backed by SQLite for persistence, and OpenAPI contracts as the source of truth.**

The recommended approach for a solo-built, demo-ready, swap-ready mock banking backend:

```
                    +---------------------------+
                    |      Agent / App Layer     |
                    |  (Does NOT know about      |
                    |   mock vs real backends)   |
                    +---------------------------+
                              |
                    +---------------------------+
                    |     Service Interfaces     |
                    |  (Ports / Contracts)       |
                    |  - IAccountService         |
                    |  - IPaymentService         |
                    |  - ILendingService         |
                    |  - IVASService             |
                    +---------------------------+
                       /            \
            +--------------+  +--------------+
            | Mock Adapter |  | Real Adapter |
            | (In-process, |  | (BaaS API,   |
            |  SQLite)     |  |  Stitch, etc)|
            +--------------+  +--------------+
```

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Mock deployment | In-process (not separate microservice) | Solo dev, speed, no infra overhead |
| Persistence | SQLite (not pure in-memory) | Survives restarts, inspectable, demo-friendly |
| Contract format | OpenAPI 3.1 specs per service | Generates types, enables Prism/Microcks validation |
| Swap mechanism | DI container + interface binding | Swap one service at a time via config |
| Ledger approach | Simple double-entry in mock, swap to Blnk/Formance when real | Correctness matters even in mocks |
| Language | TypeScript (Node.js) | Type safety for interfaces, large ecosystem |

### Why NOT a Separate Mock Server

For a POC built solo, a separate mock microservice (like running Apache Fineract or a WireMock instance) adds operational complexity without proportional benefit. In-process mocks behind interfaces give the same swappability with zero deployment overhead. The separate server approach makes sense only when multiple teams need to develop against the same mock simultaneously.

---

## 1. Open-Source Mock Banking APIs & Simulators

### Full Banking Simulators

| Tool | What It Does | Language | Pros | Cons | Link |
|------|-------------|----------|------|------|------|
| **Apache Fineract** | Full open-source core banking platform with REST API, accounts, loans, savings, payments | Java | Battle-tested, massive feature set, Docker deploy, Swagger API | Very heavy for a POC, Java-only, steep learning curve | [GitHub](https://github.com/apache/fineract) |
| **MockBank.io** | SaaS mock bank with PSD2/Open Banking APIs, admin console for creating customers/accounts/transactions | SaaS | Realistic PSD2 flows, embedded/redirect/decoupled auth | European-focused (PSD2), not self-hosted, paid after trial | [mockbank.io](https://www.mockbank.io/) |
| **finAPI Demobank** | Simulated banking environment for testing with realistic data | SaaS | No real accounts needed, realistic data | Vendor-specific, not self-hosted | [finapi.io](https://www.finapi.io/en/developers/demobank/) |

### Ledger & Transaction Engines (Open Source)

| Tool | What It Does | Language | Pros | Cons | Link |
|------|-------------|----------|------|------|------|
| **Blnk** | Open-source double-entry ledger with multicurrency, inflight transactions, balance monitoring | Go | Apache 2.0, designed for fintech, production-grade primitives, identity + reconciliation modules | Go (not Node/Python), requires Postgres | [GitHub](https://github.com/blnkfinance/blnk) |
| **Formance Ledger** | Programmable double-entry ledger with Numscript DSL for modeling transactions | Go | YC-backed, Numscript is powerful for complex flows, PostgreSQL-backed | Go, heavier than needed for mock | [GitHub](https://github.com/formancehq/ledger) |
| **TigerBeetle** | Ultra-high-performance financial transactions database (accounts + transfers only) | Zig | 8,189 tx/query, append-only immutable, debit/credit primitives | Zig, very low-level, no REST API built-in | [GitHub](https://github.com/tigerbeetle/tigerbeetle) |
| **Medici** | Double-entry accounting for Node.js + Mongoose | TypeScript/JS | Simple API, Node.js native, book/journal/entry model | Requires MongoDB, limited feature set | [GitHub](https://github.com/flash-oss/medici) |
| **ALE** | Double-entry accounting for Node.js + Sequelize | TypeScript/JS | SQL-backed (Postgres/SQLite/MySQL), void support | Less actively maintained | [GitHub](https://github.com/CjS77/ale) |

### Mock API Servers (General Purpose)

| Tool | What It Does | Best For | Link |
|------|-------------|----------|------|
| **Prism** | Generates mock HTTP server from OpenAPI spec, dynamic responses via Faker.js | Contract-first development, parallel frontend/backend dev | [GitHub](https://github.com/stoplightio/prism) |
| **Microcks** | Turns OpenAPI/AsyncAPI/gRPC specs into live mocks, contract testing | Multi-protocol mocking, CNCF sandbox project | [GitHub](https://github.com/microcks/microcks) |
| **WireMock** | HTTP mock server with stateful behavior, request matching, response templating | Simulating multi-step flows (e.g., payment pending -> completed) | [GitHub](https://github.com/wiremock/wiremock) |
| **Mockoon** | Desktop app + CLI for creating mock REST APIs, includes Open Banking templates | Quick local mocking with pre-built banking templates | [mockoon.com](https://mockoon.com/) |

### Recommendation for This POC

Do NOT adopt Apache Fineract or a full banking simulator. Instead:
1. Define OpenAPI specs for each service (Account, Payment, Lending, VAS)
2. Build lightweight in-process mock implementations behind TypeScript interfaces
3. Use Prism for early frontend development before mocks are built
4. Use Blnk's data model as inspiration for the double-entry ledger design

---

## 2. Architectural Patterns for Swappable Backends

### Hexagonal Architecture (Ports & Adapters)

The hexagonal architecture, first described by Alistair Cockburn, is the ideal pattern for this POC. It separates the application into three concentric regions:

```
+----------------------------------------------------------+
|                    Infrastructure Layer                    |
|  (HTTP controllers, DB connections, external API clients) |
|                                                           |
|  +----------------------------------------------------+  |
|  |               Application Layer                     |  |
|  |  (Use cases, orchestration, business workflows)     |  |
|  |                                                     |  |
|  |  +----------------------------------------------+  |  |
|  |  |              Domain Layer                     |  |  |
|  |  |  (Entities, value objects, domain rules)      |  |  |
|  |  |  Account, Transaction, Loan, Payment          |  |  |
|  |  +----------------------------------------------+  |  |
|  |                                                     |  |
|  +----------------------------------------------------+  |
|                                                           |
+----------------------------------------------------------+
```

**Ports** are the interfaces (TypeScript `interface` or Python `Protocol`/`ABC`) that define what the application needs from the outside world. **Adapters** are concrete implementations that satisfy those ports.

#### Applied to Banking Services

```typescript
// PORT (interface) - lives in domain/application layer
interface IAccountService {
  createAccount(params: CreateAccountParams): Promise<Account>;
  getAccount(id: string): Promise<Account>;
  getBalance(accountId: string): Promise<Balance>;
  listTransactions(accountId: string, filter: TxFilter): Promise<Transaction[]>;
  transfer(params: TransferParams): Promise<TransferResult>;
}

// MOCK ADAPTER - lives in infrastructure layer
class MockAccountService implements IAccountService {
  constructor(private db: SQLiteDatabase) {}
  // ... uses local SQLite for all operations
}

// REAL ADAPTER - lives in infrastructure layer
class StitchAccountService implements IAccountService {
  constructor(private apiKey: string) {}
  // ... calls Stitch/Investec/Standard Bank API
}
```

### How Monzo Structured Their Backend

Monzo's architecture offers relevant lessons even though their scale is vastly different:

- **Microservices from day one**: Monzo started with ~100 microservices at beta launch, growing to 1,600+. Each service owns its data and communicates via RPC.
- **Go for everything**: Chosen for its simplicity, concurrency model, and suitability for microservices.
- **Service-per-domain**: Each bounded context (accounts, payments, lending, identity) is its own service with its own data store.
- **Cassandra for transactions**: Chosen for partition tolerance and horizontal scalability.
- **Kafka for event streaming**: All state changes published as events, enabling eventual consistency across services.

**Lessons for this POC**: Monzo validates the "one service per domain" approach. However, for a solo-built POC, these should be in-process modules (not separate deployed services) that communicate via function calls, not RPC. The key insight is the clear interface boundary between domains.

### Contract-First Design

The contract-first (or API-first) approach means designing the API specification before writing any implementation code:

1. **Write OpenAPI specs** for each service (Account, Payment, Lending, VAS)
2. **Generate TypeScript types** from the specs using `openapi-typescript`
3. **Implement mock adapters** that conform to the generated types
4. **Implement real adapters** later using the same types
5. **Use Prism** to validate that implementations match the spec

This approach ensures that swapping from mock to real is guaranteed to be type-safe, because both adapters implement the same generated interface.

### Dependency Injection for Swapping

```typescript
// container.ts - Wire up based on config
import { Container } from 'tsyringe';

function configureServices(config: AppConfig) {
  if (config.accounts.provider === 'mock') {
    Container.register<IAccountService>('AccountService', MockAccountService);
  } else if (config.accounts.provider === 'stitch') {
    Container.register<IAccountService>('AccountService', StitchAccountService);
  }

  // Each service can be independently swapped
  if (config.payments.provider === 'mock') {
    Container.register<IPaymentService>('PaymentService', MockPaymentService);
  } else if (config.payments.provider === 'ozow') {
    Container.register<IPaymentService>('PaymentService', OzowPaymentService);
  }
}
```

**DI Libraries for TypeScript**:
- `tsyringe` (Microsoft) - decorator-based, lightweight
- `inversify` - feature-rich, more enterprise
- `awilix` - no decorators needed, proxy-based resolution
- Manual constructor injection (simplest, no library needed)

**Recommendation**: For a solo POC, use **manual constructor injection** (no DI library). A simple factory function that reads config and returns the right implementation is sufficient and has zero learning curve.

```typescript
// services.ts - Simple factory, no DI library needed
export function createServices(config: AppConfig): Services {
  return {
    accounts: config.accounts.mock
      ? new MockAccountService(db)
      : new StitchAccountService(config.accounts.apiKey),
    payments: config.payments.mock
      ? new MockPaymentService(db)
      : new OzowPaymentService(config.payments.apiKey),
    lending: config.lending.mock
      ? new MockLendingService(db)
      : new RealLendingService(config.lending.apiKey),
    vas: config.vas.mock
      ? new MockVASService(db)
      : new PrepaidService(config.vas.apiKey),
  };
}
```

---

## 3. Mock Data Generation

### Transaction Data

#### Faker.js (@faker-js/faker)

Faker.js is the standard library for generating realistic fake data in Node.js. Its Finance module provides:

- `faker.finance.accountNumber()` - realistic account numbers
- `faker.finance.amount()` - random monetary amounts
- `faker.finance.transactionDescription()` - "payment", "deposit", "withdrawal", etc.
- `faker.finance.transactionType()` - "withdrawal", "deposit", "payment", "invoice"
- `faker.finance.currencyCode()` - "ZAR", "USD", etc.
- `faker.finance.iban()` - International Bank Account Numbers
- `faker.finance.creditCardNumber()` - valid Luhn-checked card numbers

#### Custom South African Transaction Generator

Faker.js alone is insufficient for realistic SA banking data. A custom seed data generator should produce:

```typescript
interface TransactionSeed {
  // Realistic SA merchant names
  merchants: string[];           // "Pick n Pay Rosebank", "Woolworths Food Sandton"
  // SA-specific categories
  categories: TransactionCategory[]; // "groceries", "fuel", "airtime", "electricity"
  // Realistic amounts in ZAR
  amountRanges: Record<TransactionCategory, { min: number; max: number }>;
  // Time distribution (salary deposits on 25th, debit orders on 1st)
  patterns: TemporalPattern[];
}
```

#### IBM AMLSim

For more sophisticated synthetic transaction data, IBM's AMLSim generates entire transaction networks using multi-agent simulation. While overkill for a POC, its output format (accounts.csv, transactions.csv) provides a useful reference for the data model.

### Account & User Seed Data

A realistic demo needs pre-seeded personas:

```typescript
const seedUsers = [
  {
    name: "Thabo Molefe",
    accounts: [
      { type: "cheque", balance: 15420.50, currency: "ZAR" },
      { type: "savings", balance: 85000.00, currency: "ZAR" },
    ],
    loans: [
      { type: "personal", principal: 50000, remaining: 32150, monthlyPayment: 2850 },
    ],
    recentTransactions: 45,  // auto-generated
  },
  {
    name: "Naledi Dlamini",
    accounts: [
      { type: "cheque", balance: 3200.75, currency: "ZAR" },
    ],
    loans: [],
    recentTransactions: 22,
  },
];
```

### Simulating Realistic Banking Flows

Key state transitions that mocks must handle:

**Transaction Lifecycle**:
```
initiated -> pending -> processing -> completed
                                   -> failed
                                   -> reversed
```

**Loan Lifecycle**:
```
application_submitted -> under_review -> approved -> disbursed -> repaying -> paid_off
                                      -> declined
                                      -> more_info_needed
```

**Payment Lifecycle**:
```
created -> authorized -> captured -> settled
                      -> voided
        -> declined
```

**VAS Purchase Lifecycle**:
```
requested -> processing -> fulfilled -> confirmed
                        -> failed -> refunded
```

These state machines should be explicitly modeled in the mock layer with configurable delays (e.g., pending for 2 seconds before completing) to simulate realistic async behavior during demos.

---

## 4. Service-Specific Patterns for This POC

### 4.1 Account Service

**Responsibilities**: Account CRUD, balance management, transaction history, double-entry ledger

**Mock Implementation Approach**:

```
Tables (SQLite):
  - accounts (id, user_id, type, currency, status, created_at)
  - ledger_entries (id, journal_id, account_id, entry_type, amount, created_at)
  - journals (id, description, reference, created_at)
```

**Double-Entry Ledger Design** (inspired by Blnk and Medici):

Every balance change is recorded as a journal with two or more entries that sum to zero:

```typescript
// Transfer R500 from checking to savings
const journal = await createJournal({
  description: "Internal transfer",
  entries: [
    { accountId: "checking-001", type: "DEBIT",  amount: 500.00 },
    { accountId: "savings-001",  type: "CREDIT", amount: 500.00 },
  ]
});
// Invariant: SUM(debits) === SUM(credits) for every journal
```

Balance is always computed, never stored as a mutable field:
```sql
SELECT
  SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END) -
  SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE 0 END) AS balance
FROM ledger_entries
WHERE account_id = ?;
```

**Interface**:
```typescript
interface IAccountService {
  createAccount(userId: string, params: CreateAccountParams): Promise<Account>;
  getAccount(accountId: string): Promise<Account>;
  getBalance(accountId: string): Promise<Balance>;
  listAccounts(userId: string): Promise<Account[]>;
  getTransactionHistory(accountId: string, filter?: TxFilter): Promise<PaginatedResult<Transaction>>;
  transfer(params: InternalTransferParams): Promise<TransferResult>;
}
```

### 4.2 Payment Service

**Responsibilities**: Local transfers (bank-to-bank), payment status tracking, payment notifications

**Mock Implementation Approach**:

```
Tables (SQLite):
  - payments (id, from_account_id, to_account_id, amount, currency,
              status, reference, beneficiary_name, beneficiary_bank,
              beneficiary_account, created_at, updated_at)
  - payment_events (id, payment_id, status, timestamp, metadata)
```

**State Machine**:
```typescript
const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  'created':    ['authorized', 'declined'],
  'authorized': ['processing'],
  'processing': ['completed', 'failed'],
  'completed':  ['reversed'],
  'failed':     ['created'],  // retry
  'declined':   [],
  'reversed':   [],
};
```

**Simulated Delays**: The mock should support configurable delays to simulate real payment processing:
```typescript
class MockPaymentService implements IPaymentService {
  async submitPayment(params: PaymentParams): Promise<Payment> {
    const payment = await this.createPayment(params);
    // Simulate async processing
    setTimeout(() => this.processPayment(payment.id), this.config.processingDelayMs);
    return payment;
  }
}
```

**Interface**:
```typescript
interface IPaymentService {
  submitPayment(params: PaymentParams): Promise<Payment>;
  getPayment(paymentId: string): Promise<Payment>;
  cancelPayment(paymentId: string): Promise<Payment>;
  listPayments(userId: string, filter?: PaymentFilter): Promise<PaginatedResult<Payment>>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
}
```

### 4.3 Lending Service

**Responsibilities**: Loan application, automated decisioning, disbursement, repayment tracking

**Mock Implementation Approach**:

```
Tables (SQLite):
  - loan_applications (id, user_id, type, amount_requested, term_months,
                       purpose, status, decision_reason, created_at)
  - loans (id, application_id, user_id, principal, interest_rate,
           term_months, monthly_payment, balance_remaining, status,
           disbursed_at, next_payment_date)
  - loan_payments (id, loan_id, amount, principal_portion, interest_portion,
                   payment_date, status)
```

**Mock Decisioning Engine**:
```typescript
function mockDecision(application: LoanApplication, account: Account): LoanDecision {
  const balance = account.balance;
  const monthlyPayment = calculateMonthlyPayment(
    application.amount, 0.15, application.termMonths  // 15% mock rate
  );
  const affordabilityRatio = monthlyPayment / (balance * 0.3); // assume 30% of balance is monthly income

  if (application.amount > 500000) return { approved: false, reason: "Amount exceeds maximum" };
  if (affordabilityRatio > 0.4) return { approved: false, reason: "Affordability check failed" };
  return { approved: true, rate: 0.15, monthlyPayment };
}
```

**Interface**:
```typescript
interface ILendingService {
  applyForLoan(userId: string, params: LoanApplicationParams): Promise<LoanApplication>;
  getApplication(applicationId: string): Promise<LoanApplication>;
  getLoan(loanId: string): Promise<Loan>;
  listLoans(userId: string): Promise<Loan[]>;
  makePayment(loanId: string, amount: number): Promise<LoanPayment>;
  getLoanSchedule(loanId: string): Promise<AmortizationSchedule>;
  getPreApproval(userId: string): Promise<PreApprovalResult>;
}
```

### 4.4 VAS Service (Value-Added Services - South Africa)

**Responsibilities**: Airtime purchase, data bundle purchase, electricity (prepaid meter) purchase

**South African VAS Context**:
In South Africa, VAS refers to prepaid services sold through banking and retail channels. The major categories are:
- **Airtime**: Vodacom, MTN, Cell C, Telkom Mobile
- **Data bundles**: Per-network, various sizes (500MB, 1GB, 5GB, etc.)
- **Prepaid electricity**: Municipality-specific meter tokens (20-digit tokens)
- **Lotto**: National lottery ticket purchase

Real providers include Electrum (aggregator connecting to 60+ providers via single API), Freepaid, Prepaid24, and Nedbank VAS API.

**Mock Implementation Approach**:

```
Tables (SQLite):
  - vas_products (id, type, provider, name, amount, description)
  - vas_purchases (id, user_id, product_id, account_id, amount,
                   recipient, status, token, created_at)
```

**Mock Token Generation** (for electricity):
```typescript
function generateMockElectricityToken(): string {
  // Real tokens are 20-digit numbers from the STS standard
  // Mock generates realistic-looking tokens
  return Array.from({ length: 20 }, () => Math.floor(Math.random() * 10)).join('');
}

function generateMockAirtimeVoucher(): string {
  // 16-digit voucher PIN
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('');
}
```

**Product Catalog** (pre-seeded):
```typescript
const vasCatalog = [
  // Airtime
  { type: 'airtime', provider: 'vodacom', name: 'Vodacom Airtime', amounts: [5, 10, 29, 55, 110] },
  { type: 'airtime', provider: 'mtn', name: 'MTN Airtime', amounts: [5, 10, 15, 30, 60, 180] },
  { type: 'airtime', provider: 'cellc', name: 'Cell C Airtime', amounts: [5, 10, 20, 50, 100] },
  { type: 'airtime', provider: 'telkom', name: 'Telkom Airtime', amounts: [5, 10, 30, 50, 100] },
  // Data bundles
  { type: 'data', provider: 'vodacom', name: 'Vodacom 1GB 30-day', amount: 99 },
  { type: 'data', provider: 'mtn', name: 'MTN 1GB 30-day', amount: 99 },
  // Electricity
  { type: 'electricity', provider: 'eskom', name: 'Prepaid Electricity', amounts: 'custom' },
  { type: 'electricity', provider: 'city_of_joburg', name: 'CoJ Prepaid Electricity', amounts: 'custom' },
  { type: 'electricity', provider: 'city_of_cape_town', name: 'CoCT Prepaid Electricity', amounts: 'custom' },
];
```

**Interface**:
```typescript
interface IVASService {
  getProducts(type?: VASType): Promise<VASProduct[]>;
  purchase(userId: string, params: VASPurchaseParams): Promise<VASPurchase>;
  getPurchase(purchaseId: string): Promise<VASPurchase>;
  getPurchaseHistory(userId: string, filter?: VASFilter): Promise<PaginatedResult<VASPurchase>>;
}
```

---

## 5. Technology Recommendations

### Language: TypeScript (Node.js)

**Why TypeScript over Python for this POC**:
- Type-safe interfaces are the backbone of the adapter pattern; TypeScript's type system makes swapping implementations compile-time verifiable
- Shared types between API layer and service layer (no serialization boundary when in-process)
- Better ecosystem for OpenAPI type generation (`openapi-typescript`)
- If the app layer is Next.js or similar, everything runs in one runtime
- `@faker-js/faker` is native TypeScript

### Persistence: SQLite via better-sqlite3

**Why SQLite**:
- Zero configuration, zero server, single file
- Survives restarts (unlike pure in-memory)
- Inspectable with any SQLite client during demos
- Fast enough for POC (can handle thousands of transactions)
- Can be swapped to Postgres via Drizzle ORM without code changes

**ORM**: Use **Drizzle ORM** with the SQLite driver for the mock layer. Drizzle supports both SQLite and PostgreSQL, making the database itself swappable without changing query code.

```typescript
// schema.ts - Works with both SQLite and PostgreSQL via Drizzle
import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  type: text('type').notNull(),  // 'cheque' | 'savings' | 'credit'
  currency: text('currency').notNull().default('ZAR'),
  status: text('status').notNull().default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

### In-Memory vs Database-Backed Mocks

| Approach | Pros | Cons | When to Use |
|----------|------|------|-------------|
| **Pure in-memory** (Map/Array) | Fastest to build, zero deps, instant tests | Data lost on restart, no SQL queries, hard to inspect | Unit tests, throwaway prototypes |
| **SQLite file** | Persistent, inspectable, SQL queries, zero server | Slightly more setup than in-memory | **POC/demo (recommended)** |
| **SQLite in-memory** | Fast, SQL queries, no file cleanup | Data lost on restart | Integration tests |
| **PostgreSQL** | Production-ready, concurrent access | Requires server, more setup | Production, multi-user |
| **Separate mock microservice** | Team-shared, independently deployable | Infra overhead, networking, solo dev friction | Multi-team development |

**Recommendation**: SQLite file for the mock layer (inspectable, persistent, zero-config). Use Drizzle ORM so the same schema works when you later point at PostgreSQL for real adapters.

### Should Mocks Be a Separate Microservice or In-Process?

**In-process** is strongly recommended for this POC:

- **Solo developer**: No benefit from deploying separate services
- **Demo reliability**: Fewer moving parts = fewer things to break during demos
- **Swap granularity**: With in-process adapters, you can swap one service (e.g., payments) to real while keeping others mock, all in the same process
- **Speed**: Function calls vs HTTP calls; no serialization overhead
- **Debugging**: Single process to debug, single log stream

The only scenario where separate mock services make sense is if you need multiple teams developing against the same mock simultaneously, or if you want to use an existing tool like WireMock to simulate specific external API behaviors.

---

## 6. Project Structure Recommendation

```
agentic-bank/
├── packages/
│   ├── core/                      # Domain layer (zero dependencies)
│   │   ├── entities/              # Account, Transaction, Loan, Payment, VASProduct
│   │   ├── interfaces/            # IAccountService, IPaymentService, etc.
│   │   ├── value-objects/         # Money, AccountNumber, MeterNumber
│   │   └── errors/               # DomainError, InsufficientFundsError, etc.
│   │
│   ├── mock-services/             # Mock adapter implementations
│   │   ├── account/              # MockAccountService + SQLite schema
│   │   ├── payment/              # MockPaymentService + state machine
│   │   ├── lending/              # MockLendingService + decisioning
│   │   ├── vas/                  # MockVASService + token generation
│   │   ├── seed/                # Seed data generators (Faker.js based)
│   │   └── db.ts                # SQLite connection + migrations
│   │
│   ├── real-services/            # Real adapter implementations (later)
│   │   ├── stitch-accounts/     # Stitch API integration
│   │   ├── ozow-payments/       # Ozow payment integration
│   │   └── electrum-vas/        # Electrum VAS integration
│   │
│   └── service-factory/          # DI / factory wiring
│       └── index.ts             # createServices(config) -> Services
│
├── contracts/                    # OpenAPI specs (source of truth)
│   ├── account-service.yaml
│   ├── payment-service.yaml
│   ├── lending-service.yaml
│   └── vas-service.yaml
│
├── apps/
│   ├── api/                     # Express/Fastify API server
│   └── agent/                   # Agent layer (LLM + tools)
│
└── data/
    ├── mock.db                  # SQLite database file
    └── seed/                    # JSON seed data files
```

---

## 7. Swap Strategy: Mock to Real

The swap from mock to real should happen per-service, not all-at-once. Here is the recommended order based on complexity and value:

### Phase 1: All Mock (Week 1-2)
All four services run as in-process mocks with SQLite. Full end-to-end flows work. Agent can demo all capabilities.

### Phase 2: Swap Payments First (When Ready)
Payments are the most visible and impactful to demo as "real." South African options:
- **Ozow** - instant EFT
- **Stitch** - account-to-account payments via Open Banking
- **Peach Payments** - card payments

### Phase 3: Swap Accounts (When Ready)
Connect to a real BaaS for account data:
- **Stitch** - read-only account and transaction data
- **Investec Programmable Banking** - full API access (SA-specific)

### Phase 4: Swap VAS (When Ready)
Connect to a real VAS aggregator:
- **Electrum** - single API to 60+ VAS providers
- **Prepaid24** - airtime, data, electricity APIs
- **Freepaid** - wholesale airtime/data API

### Phase 5: Swap Lending (Last)
Lending is the hardest to swap because real loan origination requires compliance (NCA in South Africa). This will likely remain mock the longest, or integrate with:
- **Jumo** - digital lending in Africa
- **Lulalend** (now Lula) - SME lending API

---

## 8. Key Open-Source Tools Summary

### Directly Useful for This POC

| Tool | Use In This POC | Install |
|------|----------------|---------|
| **@faker-js/faker** | Generate realistic transaction data, account details, SA merchant names | `npm i @faker-js/faker` |
| **Drizzle ORM** | Type-safe ORM for SQLite (mock) and PostgreSQL (real) | `npm i drizzle-orm` |
| **better-sqlite3** | SQLite driver for Node.js | `npm i better-sqlite3` |
| **Prism** | Validate implementations against OpenAPI specs | `npm i -g @stoplight/prism-cli` |
| **openapi-typescript** | Generate TypeScript types from OpenAPI specs | `npm i -D openapi-typescript` |
| **zod** | Runtime validation of service inputs/outputs | `npm i zod` |
| **nanoid** | Generate short unique IDs for accounts, transactions | `npm i nanoid` |

### Reference Implementations to Study

| Tool | What to Study | Link |
|------|-------------- |------|
| **Blnk** | Double-entry ledger data model, inflight transactions, balance computation | [docs.blnkfinance.com](https://docs.blnkfinance.com/) |
| **Medici** | Journal/entry pattern for Node.js, void mechanics | [github.com/flash-oss/medici](https://github.com/flash-oss/medici) |
| **Formance** | Numscript DSL for transaction modeling, multi-posting | [formance.com](https://www.formance.com/) |
| **Monzo Blog** | Service-per-domain architecture, banking backend design | [monzo.com/blog](https://monzo.com/blog/2016/09/19/building-a-modern-bank-backend) |

---

## 9. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Mock behavior diverges from real API | Use OpenAPI contracts as shared truth; validate mock responses against spec with Prism |
| Mock is too simple to demo realistically | Implement state machines with configurable delays; use realistic SA seed data |
| Swap breaks the agent layer | Agent talks only to interfaces, never to implementations; integration tests per interface |
| SQLite limitations at scale | Drizzle ORM abstracts DB; swap to Postgres by changing connection config |
| Double-entry complexity in mock | Start simple (debit/credit entries that must sum to zero); do not build full accounting engine |
| VAS mock doesn't feel real | Pre-seed with actual SA product catalogs (real MTN/Vodacom data bundle prices) |

---

## Sources

- [MockBank.io](https://www.mockbank.io/) - PSD2/Open Banking mock banking API
- [Apache Fineract](https://github.com/apache/fineract) - Open-source core banking platform
- [Blnk Finance](https://github.com/blnkfinance/blnk) - Open-source double-entry ledger for fintech
- [Formance Ledger](https://github.com/formancehq/ledger) - Programmable open-source financial ledger
- [TigerBeetle](https://github.com/tigerbeetle/tigerbeetle) - Financial transactions database
- [Medici](https://github.com/flash-oss/medici) - Double-entry accounting for Node.js + Mongoose
- [ALE](https://github.com/CjS77/ale) - Double-entry accounting for Node.js + Sequelize
- [Faker.js](https://fakerjs.dev/) - Realistic fake data generation
- [IBM AMLSim](https://github.com/IBM/AMLSim) - Synthetic banking transaction data generator
- [Prism](https://github.com/stoplightio/prism) - OpenAPI mock server
- [Microcks](https://github.com/microcks/microcks) - API mocking and contract testing (CNCF)
- [WireMock](https://wiremock.org/) - Stateful HTTP mock server
- [Mockoon](https://mockoon.com/) - Desktop mock API tool with Open Banking templates
- [Hyperswitch](https://github.com/juspay/hyperswitch) - Open-source payments orchestrator
- [Mojaloop](https://mojaloop.io/) - Open-source instant payment system
- [Monzo Backend Architecture](https://monzo.com/blog/2016/09/19/building-a-modern-bank-backend) - Building a modern bank backend
- [Monzo at 1600 Microservices](https://www.infoq.com/presentations/monzo-microservices/) - InfoQ presentation
- [Hexagonal Architecture - AWS](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/hexagonal-architecture.html) - AWS prescriptive guidance
- [Hexagonal Architecture for Payments](https://github.com/LordMoMA/Hexagonal-Architecture) - Payment backend example
- [Adapter Pattern for Payment Gateways](https://dev.to/walosha/adapter-pattern-using-a-payment-gateway-as-a-case-study-4nnn) - Case study
- [Repository Pattern with TypeScript](https://dev.to/fyapy/repository-pattern-with-typescript-and-nodejs-25da) - Implementation guide
- [Contract-First API Design](https://harrisoncramer.me/contract-first-api-design/) - Design methodology
- [Electrum VAS Platform](https://www.electrum.co.za/) - South African VAS aggregator
- [Prepaid24](https://www.prepaid24.co.za/) - SA prepaid services API
- [Freepaid](https://freepaid.co.za/) - SA airtime/data wholesale API
- [Nedbank VAS API](https://apim.nedbank.africa/blog/evolution-of-vas.html) - Banking VAS integration
- [finAPI Demobank](https://www.finapi.io/en/developers/demobank/) - Simulated banking environment
- [FINOS](https://www.finos.org/) - Fintech Open Source Foundation
