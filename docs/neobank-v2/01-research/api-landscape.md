# API Landscape Report: BaaS, Payments & Lending APIs for UK Neobank POC

**Date:** March 2026
**Author:** Technical Analyst (Phase 1c)
**Scope:** Evaluate BaaS providers, lending APIs, and payment APIs for a UK neobank POC targeting young professionals. Prioritise sandbox quality and developer experience over production readiness.

---

## Table of Contents

1. [Banking-as-a-Service Providers](#1-banking-as-a-service-providers)
2. [Lending & Credit APIs](#2-lending--credit-apis)
3. [Payment APIs](#3-payment-apis)
4. [Recommendation](#4-recommendation)

---

## 1. Banking-as-a-Service Providers

### 1.1 Provider Comparison Matrix

| Provider | FCA Status | Sandbox Access | API Style | Accounts | Payments | Cards | Lending | Time to First API Call | Confidence |
|----------|-----------|---------------|-----------|----------|----------|-------|---------|----------------------|------------|
| **Griffin** | Full UK banking licence (PRA/FCA) | Free, instant, no NDA | REST + JSON (kebab-case) | Yes | FPS + book transfers | Planned 2026 | No | < 15 min | High |
| **Railsr** | Merged with Equals Money (Apr 2025) | Uncertain | REST | Formerly yes | Formerly yes | Formerly yes | No | N/A | Low |
| **ClearBank** | Full UK banking licence | Onboarding required (FCA-regulated firms only) | REST + JSON | Yes | FPS, BACS, CHAPS | No | No | Weeks (sales process) | High |
| **Modulr** | FCA-authorised EMI | Free sandbox sign-up | REST + JSON | eMoney accounts | FPS, BACS, Direct Debit | Yes | No | < 30 min | High |
| **TrueLayer** | FCA-authorised PISP/AISP | Free sandbox sign-up | REST + JSON | Read-only (Open Banking) | Payment initiation | No | No | < 30 min | High |
| **Yapily** | FCA-authorised PISP/AISP | Free sandbox sign-up | REST + JSON | Read-only (Open Banking) | Payment initiation | No | No | < 20 min | High |

### 1.2 Griffin (Current Integration)

**Status:** Already integrated in our codebase. Full banking licence holder. Our primary BaaS provider.

**What we already use:**
- Organisation and account management (open accounts, list accounts, get balance)
- Payment creation and submission via Faster Payments (FPS)
- Transaction listing with pagination
- Payee/beneficiary management (create, list)
- Onboarding/KYC via reliance verification workflows
- Legal person management
- Balance normalisation between accounts

**Source:** Our existing codebase at `/apps/api/src/lib/griffin.ts` and `/packages/shared/src/types/griffin.ts`

**API characteristics:**
- REST with kebab-case JSON keys (e.g. `available-balance`, `account-status`)
- HATEOAS-style navigation via URL fields in responses (e.g. `account-url`, `payment-url`)
- API key auth via `GriffinAPIKey` header
- No official SDK -- we wrote our own TypeScript client (262 lines, covers all needed endpoints)
- Good error responses with structured error bodies

**Sandbox quality:**
- Free, unlimited, no time limit, no credit card, no NDA ([source](https://griffin.com/blog/griffin-launches-its-sandbox-to-break-down-barriers-for-startups-and-fintech-developers))
- Mirror of production -- full stack including compliance tooling
- Sign up at app.griffin.com, get API key immediately
- Supports simulated FPS payments, account opening, onboarding flows
- Confidence: **High** (verified from our own integration)

**MCP Server (new, relevant for our AI-first approach):**
- Griffin launched a beta MCP (Model Context Protocol) server in 2025 ([source](https://griffin.com/blog/the-agentic-bank))
- Allows AI agents (Claude, Cursor, etc.) to interact with the Griffin API directly
- Capabilities: open accounts, make payments, analyse transactions
- Currently sandbox-only -- no production access yet
- Potentially very relevant for our agentic banking vision, but adds a dependency on an unproven beta
- Confidence: **Medium** (beta product, marketing-heavy announcement)

**Limitations for our POC:**
- No card issuing (planned for 2026, not available yet) -- [source](https://thefintechtimes.com/uk-bank-griffin-lands-uber-and-marqeta-as-payments-volumes-hit-3billion/)
- No international payments -- domestic FPS and book transfers only
- No lending/credit products -- we already mock this in Supabase
- Kebab-case API responses require transformation layer (already built)
- No official TypeScript SDK -- must maintain our own client

**Verdict:** Griffin remains the right primary BaaS for our POC. The sandbox is excellent, the API is well-designed, and we have a working integration. The MCP server is interesting but too early for production use.

### 1.3 Railsr (formerly Railsbank)

**Status:** Effectively defunct as an independent BaaS provider. Not recommended.

**History:**
- Once valued at nearly $1B (2021)
- Went into administration in March 2023
- Sold via prepackaged bankruptcy for ~$500K to a consortium ([source](https://techcrunch.com/2023/03/09/railsr-off-the-rails-embedded-finance/))
- Merged with Equals Money in April 2025

**Current state:**
- The Railsr brand and platform have been absorbed into Equals Money
- API access, documentation, and sandbox status are unclear post-merger
- The company has ~170 employees but is focused on the Equals Money product
- No clear developer-facing sandbox or documentation publicly available

**Assessment:**
- Do not use. The platform's instability, ownership changes, and unclear API status make it unsuitable even for a POC
- Confidence: **Medium** (multiple credible sources on bankruptcy and merger)

### 1.4 ClearBank

**Status:** Full UK banking licence. Established B2B BaaS provider. Not suitable for our POC.

**Capabilities:**
- Current accounts, savings accounts, safeguarding accounts
- Direct access to UK payment schemes: FPS, BACS, CHAPS
- Real-time payment processing
- Cloud-native, API-first architecture
- Partnered with Plaid for open banking payments (Dec 2025) ([source](https://clearbank.github.io/))

**API quality:**
- RESTful API with comprehensive documentation at [clearbank.github.io](https://clearbank.github.io/)
- Webhook-driven architecture for payment notifications
- Requires Digital Certificate and secure API token for authentication
- Well-documented endpoints for account management and payments

**Sandbox access:**
- Simulation environment available, but only after formal onboarding
- Requires being an FCA-regulated firm (or in the process of applying)
- Institutional portal credentials provided during onboarding
- Cannot self-serve -- must go through sales and compliance process ([source](https://clearbank.github.io/uk/docs/api/getting-started/))
- Confidence: **High** (verified from official docs)

**Why not for our POC:**
- Enterprise B2B focus -- not designed for individual developer experimentation
- Sandbox access requires business onboarding (weeks, not minutes)
- Overkill for a POC -- designed for firms running production payment flows
- No clear advantage over Griffin for our use case

### 1.5 Modulr

**Status:** FCA-authorised EMI. Strong payments-focused BaaS. Viable alternative to Griffin for payments.

**Capabilities:**
- eMoney accounts (not bank accounts -- important distinction)
- FPS, BACS, and Direct Debit payments
- Card issuing (prepaid/debit via Visa/Mastercard)
- Account-to-account payments
- Payee management
- Recently expanded to US market via FIS partnership (Jan 2026) ([source](https://www.modulrfinance.com/))

**API quality:**
- RESTful API, well-documented at [modulr.readme.io](https://modulr.readme.io/)
- Standard HTTP verbs, JSON request/response
- HMAC authentication (or simpler token-based auth in sandbox)
- Good developer documentation with interactive examples
- Confidence: **High** (verified from official docs)

**Sandbox access:**
- Self-serve signup at `https://secure-sandbox.modulrfinance.com/sandbox/onboarding`
- Sandbox API URL: `https://api-sandbox.modulrfinance.com/api-sandbox/`
- Token-based auth available in sandbox (no HMAC setup required for initial testing)
- Portal UI connected to sandbox for visual testing ([source](https://modulr.readme.io/docs/gaining-use-of-the-api))
- Estimated time to first API call: **< 30 minutes**

**Relevance to our POC:**
- Card issuing could fill Griffin's gap (no cards until 2026)
- eMoney accounts, not FSCS-protected bank accounts -- fine for a POC
- Direct Debit support useful for standing orders simulation
- Would be a second integration to maintain alongside Griffin

**Verdict:** Good alternative or supplement. If we need card issuing in the POC, Modulr is the strongest option. Otherwise, it duplicates what Griffin already provides.

### 1.6 TrueLayer (Open Banking)

**Status:** FCA-authorised PISP and AISP. Market-leading Open Banking aggregator. Different category from BaaS.

**What it does vs. what BaaS does:**
- TrueLayer does NOT provide bank accounts or hold funds
- It connects to existing banks via Open Banking APIs
- Payment initiation: trigger payments FROM a user's bank account (with consent)
- Account information: read balances and transactions FROM existing bank accounts
- Useful for: pay-ins to your platform, balance checks across banks, PFM features

**Capabilities:**
- Payments API v3: pay-ins, variable recurring payments (VRP)
- Data API: account balances, transaction history from 100+ UK banks
- Payouts: send money from your platform to users
- Drop-in UI components for bank selection and consent
- Sandbox with simulated payment flows ([source](https://docs.truelayer.com/docs/test-payments-in-sandbox))

**API quality:**
- RESTful, well-documented at [docs.truelayer.com](https://docs.truelayer.com/)
- Official SDKs: Node.js, Python, Ruby, Java, .NET, Go
- OAuth 2.0 / OpenID Connect authentication
- Webhooks for payment status changes
- Confidence: **High** (verified from official docs)

**Sandbox access:**
- Free signup at [console.truelayer.com](https://console.truelayer.com)
- Sandbox URLs use `truelayer-sandbox.com` domain
- Simulated bank connectors for testing payment flows
- Can test payment initiation, settlement, and failure scenarios
- Sandbox payment limit: 50,000 minor units (GBP 500) per transaction
- Estimated time to first API call: **< 30 minutes**

**Relevance to our POC:**
- Not a replacement for Griffin (different purpose)
- Could complement Griffin for: "connect your other bank accounts" feature
- Multi-bank view is a key differentiator for neobanks (see Monzo's connected accounts)
- Payment initiation could be used for "top up your account" flows
- VRP could enable "smart savings" features (move money from external account)
- Adds complexity -- second API integration to maintain

**Verdict:** Excellent API, but adds scope. If "connect your other bank" or "top up from external account" are POC features, TrueLayer is the best choice. Otherwise, defer to a later iteration.

### 1.7 Yapily (Open Banking)

**Status:** FCA-authorised PISP and AISP. Open Banking aggregator, competitor to TrueLayer.

**Capabilities:**
- Account information services (AIS): read balances, transactions from 2000+ banks
- Payment initiation services (PIS): UK domestic payments
- Virtual accounts (newer feature)
- Coverage across UK and Europe
- Pre-configured sandbox with mock bank ([source](https://docs.yapily.com/pages/resources/sandbox/sandbox-overview/))

**API quality:**
- RESTful API documented at [docs.yapily.com](https://docs.yapily.com/)
- SDKs available in multiple languages
- Application ID + Application Secret authentication
- Modelo Bank sandbox (maintained by Open Banking regulators)
- Confidence: **High** (verified from official docs)

**Sandbox access:**
- Free Yapily Console account
- Pre-configured sandboxes available immediately (no bank signup required)
- Modelo Bank sandbox recommended for testing ([source](https://docs.yapily.com/pages/resources/sandbox/sandbox-overview/))
- Estimated time to first API call: **< 20 minutes**

**Relevance to our POC:**
- Very similar to TrueLayer in capabilities
- Slightly easier sandbox setup (pre-configured mock bank)
- Less market presence in UK than TrueLayer
- Same "complement, not replace" relationship with Griffin

**Verdict:** Viable alternative to TrueLayer if we need Open Banking. Marginally easier to get started. Choose one or the other, not both.

---

## 2. Lending & Credit APIs

### 2.1 Landscape Assessment

Real lending APIs require FCA authorisation and extensive compliance. For a POC, the options are:

| Approach | Realism | Complexity | Sandbox Available | Confidence |
|----------|---------|------------|-------------------|------------|
| **Mock in-process (current)** | Medium | Low | N/A -- it IS the sandbox | High |
| **Experian Connect API** | High | High | Yes (enterprise onboarding) | Medium |
| **Equifax Credit Reports API** | High | High | Yes (enterprise onboarding) | Medium |
| **Lendflow embedded credit** | Medium-High | Medium | Yes (self-serve) | Low |
| **CRS Credit API** | Medium | Medium | Yes (self-serve) | Low |

### 2.2 Current Mock Lending Implementation

Our existing lending service (`/apps/api/src/services/lending.ts`) already implements:

**Products:**
- Personal Loan: GBP 500-25,000, 12.9% APR, 6-60 months
- Quick Cash: GBP 100-2,000, 19.9% APR, 3-12 months

**Decisioning logic (not always-approve):**
- Amount/term validation against product limits
- Affordability check using Griffin account balance as income proxy
- 40% affordability ratio cap on monthly repayment vs estimated income
- Total lending exposure cap at GBP 30,000
- Existing loan check before new approval

**Lifecycle:**
- Application creation in Supabase
- Decision with reason tracking
- Auto-disbursement on approval
- Loan repayment with balance tracking
- Paid-off status when balance reaches zero

**Assessment:** This is already a well-designed mock. It provides realistic decline scenarios, affordability checks, and a full loan lifecycle. For a POC, this is more than sufficient.

### 2.3 Credit Bureau APIs (Experian, Equifax, TransUnion)

**Experian Connect API:**
- Embed credit check functionality in apps
- Requires enterprise partnership agreement
- No self-serve sandbox -- must contact sales team
- UK-specific data available
- Confidence: **Medium** (from marketing materials, not developer docs)

**Equifax Developer Portal:**
- Credit reports API available at [developer.equifax.com](https://developer.equifax.com/)
- Consumer Credit Reports from single or tri-bureau
- Requires API product subscription
- US-focused portal -- UK capabilities require separate agreement
- Confidence: **Medium** (US portal verified, UK access unclear)

**TransUnion:**
- No public developer portal for direct API access
- Typically accessed through intermediaries or enterprise agreements
- Confidence: **Low** (no developer-facing documentation found)

### 2.4 Third-Party Lending Infrastructure

**Lendflow:**
- Embedded credit infrastructure platform ([lendflow.com](https://www.lendflow.com/))
- Aggregates data from multiple credit bureaus
- Workflow automation for lending decisions
- US-focused -- UK coverage unclear
- Confidence: **Low** (marketing copy, no verified UK sandbox)

### 2.5 Recommendation for Lending

**Keep the current mock approach.** Here is why:

1. **Our mock is already realistic** -- it has non-trivial decisioning, affordability checks, and proper lifecycle management
2. **Real credit APIs require enterprise agreements** -- weeks or months to access, not hours
3. **FCA compliance for real lending is out of scope** -- this is a POC
4. **The mock is behind a clean interface** -- `services/lending.ts` can be swapped for a real integration later
5. **The hexagonal architecture approach** (mentioned in the implementation plan) means the mock adapter can be replaced without changing business logic

**Enhancement opportunities for the POC:**
- Add a credit score simulation (random-but-consistent score per user based on a hash of their ID)
- Add more decline scenarios (e.g., recently declined, too many applications in 30 days)
- Add a "pre-approved offers" feature where the AI proactively suggests loans based on spending patterns
- Generate a mock amortisation schedule for display in the chat

---

## 3. Payment APIs

### 3.1 Domestic Payments (Already Covered)

Griffin handles domestic GBP payments via:
- **Faster Payments (FPS):** Real-time domestic transfers, up to GBP 1M per transaction
- **Book transfers:** Instant transfers between Griffin accounts (e.g., main account to savings pot)

This covers our core payment needs. No additional domestic payment API is required.

### 3.2 International Payment Providers

| Provider | Currencies | Countries | Sandbox Access | Time to Setup | API Quality | Confidence |
|----------|-----------|-----------|---------------|---------------|-------------|------------|
| **Wise** | 40+ | 80+ | Free, self-serve, pre-funded | < 15 min | Excellent | High |
| **CurrencyCloud (Visa)** | 33+ | 180+ | Free demo account | < 30 min | Good | Medium |

#### 3.2.1 Wise API (Recommended for International Transfers)

**Overview:**
- Market leader in international transfers, known for transparent FX rates and low fees
- Fully regulated (FCA authorised)
- API available for both personal token use and partner integrations
- Relevant: the master prompt specifically mentions Wise as Alex's current international transfer provider

**Sandbox environment:**
- Free signup at [sandbox.transferwise.tech/register](https://sandbox.transferwise.tech/register)
- Email and password only, no verification required
- Pre-funded with GBP 1,000,000 test credit
- 2FA code always `111111` in sandbox ([source](https://docs.wise.com/guides/developer/sandbox-and-production))
- Estimated time to first API call: **< 15 minutes**

**API capabilities:**
- Create quotes (fixed source or fixed target amount)
- Create recipients/beneficiaries in multiple countries
- Create transfers with full tracking
- Simulate transfer state changes in sandbox
- Webhook events for transfer status updates
- Multi-currency balance management

**API quality:**
- RESTful, well-documented at [docs.wise.com](https://docs.wise.com/)
- Personal API tokens available from account settings
- OAuth 2.0 for partner integrations
- Comprehensive error responses
- Transfer state machine is well-documented
- No official SDK, but API is clean enough to use with fetch
- Confidence: **High** (verified from official docs)

**Integration complexity for our POC:**
- Quote creation: POST `/v3/profiles/{profileId}/quotes`
- Recipient creation: POST `/v1/accounts`
- Transfer creation: POST `/v1/transfers`
- Transfer funding: POST `/v3/profiles/{profileId}/transfers/{transferId}/payments`
- State simulation: useful for demo scenarios
- Approximately 4-5 new endpoints to integrate
- Can share our existing HTTP client pattern from Griffin

**Limitations in sandbox:**
- Not all currency routes available
- No real financial controls
- No load/performance testing
- Personal tokens cannot access all partner endpoints
- Partner access requires formal partnership agreement

**Verdict:** Best option for international transfers. Excellent sandbox, directly relevant to our persona (Alex uses Wise separately), and the API is clean. Integrating Wise would let the AI agent handle "send money abroad" conversationally -- a clear differentiator over traditional banking apps.

#### 3.2.2 CurrencyCloud (Visa)

**Overview:**
- Acquired by Visa for $963M (2021)
- Enterprise-grade cross-border payment infrastructure
- API enables: collect, convert, pay, manage funds in 33+ currencies to 180+ countries
- Now positioned as Visa's cross-border API solution ([source](https://developer.visa.com/pages/Currencycloud))

**Sandbox environment:**
- Free demo API key available at [developer.currencycloud.com](https://developer.currencycloud.com/)
- Connected to test infrastructure -- returns real data but executes in demo market
- Rate-limited on unauthenticated sandbox routes
- Postman collections available on [GitHub](https://github.com/CurrencyCloud/postman)
- Confidence: **Medium** (docs verified, but personal sandbox testing not confirmed)

**API capabilities:**
- Multi-currency wallets
- FX quotes and conversions
- Beneficiary management
- Payment creation and tracking
- Transaction reporting

**SDK availability:**
- Official SDKs: Java, Python, PHP, Ruby
- No official Node.js/TypeScript SDK (community wrappers exist)
- Confidence: **Medium** (GitHub repos verified, activity levels unclear)

**Relevance to our POC:**
- More enterprise-focused than Wise
- Better for B2B use cases (treasury management, mass payouts)
- Less relevant for consumer-facing international transfers
- Missing Node.js SDK is a friction point

**Verdict:** Viable but not ideal. CurrencyCloud is designed for businesses processing high volumes of cross-border payments. Wise is a better fit for our consumer neobank persona.

### 3.3 Open Banking Payment Initiation

Open Banking payment initiation (via TrueLayer or Yapily, covered in Section 1) can serve as:

1. **Account funding:** "Top up your neobank account from your Monzo/Barclays account"
2. **Bill payment:** Initiate payments from external accounts
3. **VRP (Variable Recurring Payments):** Automate regular transfers (e.g., "move GBP 500 from Barclays to savings every payday")

**UK Open Banking payment stats (2025):**
- 351 million payments processed across 2025, up 57% year-on-year
- 31 million transactions in March 2025 alone
- 1 in 13 of all Faster Payments now initiated via Open Banking
- 66% YoY growth in Payment Initiation Services ([source](https://www.openbanking.org.uk/insights/open-banking-in-2025-now-part-of-the-uks-everyday-financial-life/))

**Assessment for POC:** Open Banking is a mature, widely-adopted payment rail. For our POC, it adds complexity without core differentiation. The AI agent experience is our differentiator, not multi-bank connectivity. Defer to a future iteration unless "connect your other bank" is a priority feature.

### 3.4 Direct Debit and Standing Orders

**Griffin:** Does not currently support Direct Debit origination. Book transfers can simulate standing orders between Griffin accounts.

**Modulr:** Supports Direct Debit origination via its eMoney accounts. If Direct Debit is a POC requirement, Modulr would be the integration point.

**Mock approach:** For the POC, standing orders and direct debits can be simulated in Supabase with a scheduled job that creates transactions at defined intervals. This avoids adding another API integration while still demonstrating the feature to stakeholders.

---

## 4. Recommendation

### 4.1 Recommended API Stack for POC

| Capability | Provider | Approach | Rationale |
|-----------|----------|----------|-----------|
| **Core banking (accounts, balances)** | Griffin | Real integration (existing) | Already built, sandbox works well |
| **Domestic payments (FPS)** | Griffin | Real integration (existing) | Already built, covers core flows |
| **Savings pots** | Griffin | Book transfers between sub-accounts | Use Griffin's multi-account capability |
| **International transfers** | Wise | Real sandbox integration (new) | Clean API, fast sandbox, persona-relevant |
| **Lending** | Mock (Supabase) | In-process mock adapter | Already built with realistic decisioning |
| **Card issuing** | Mock | In-process mock adapter | No provider has a fast-enough sandbox for POC |
| **Standing orders / Direct debits** | Mock | Scheduled jobs in Supabase | Simpler than Modulr integration for POC scope |
| **Spending insights / categorisation** | Mock + AI | Claude analyses transaction data | Transaction categorisation via LLM, no external API needed |
| **Open Banking (multi-bank)** | Defer | Not in POC v1 | Adds complexity without core differentiation |

### 4.2 Integration Priority

**Phase 1 -- Use what we have:**
1. Griffin (accounts, payments, payees, onboarding) -- already integrated
2. Supabase (lending, pending actions, user profiles) -- already integrated

**Phase 2 -- Add Wise for international transfers:**
3. Wise sandbox integration -- new, estimated 2-3 days of work
   - Create a `WiseClient` following the same pattern as `GriffinClient`
   - Add `send_international_payment` tool with quote, recipient, and transfer creation
   - Two-phase confirmation: show exchange rate and fees before user confirms
   - Fits naturally into the AI chat flow: "Send 200 euros to Maria in Spain"

**Defer to future iterations:**
- TrueLayer / Yapily for Open Banking connectivity
- Modulr for card issuing and Direct Debit
- Real credit bureau integration (Experian/Equifax)
- Griffin MCP server (wait for production access)

### 4.3 Mock vs. Integrate Decision Framework

| Question | If Yes -> | If No -> |
|----------|-----------|----------|
| Does a working sandbox exist that we can access in < 1 hour? | Consider integration | Mock it |
| Is the feature in Alex's core daily journey (balance, payments, transfers)? | Integrate | Mock it |
| Does the integration add a unique demo moment? | Integrate | Mock it |
| Would mocking require > 100 lines of realistic simulation? | Consider integration | Mock it |
| Does integration add > 1 day of work for marginal demo value? | Mock it | Integrate |

Applying this framework:
- **Griffin:** Yes to all -- already integrated
- **Wise:** Yes (sandbox < 15 min), Yes (Alex uses Wise), Yes ("send money abroad via chat" is a demo moment), Yes (FX quotes are complex to mock), borderline on time but worth it
- **TrueLayer/Yapily:** Yes (sandbox), No (not core daily journey), Maybe, No (simple to mock account data), N/A -- mock it
- **Credit bureaus:** No (enterprise onboarding), No (lending is secondary), No, Already mocked -- keep mock
- **Card issuing:** No fast sandbox available for this -- mock it

### 4.4 Architecture for Swappability

The existing codebase partially implements this, but the v2 architecture should formalise it:

```
┌─────────────────────────────────────────────────┐
│                  Tool Handlers                   │
│  (check_balance, send_payment, send_intl, ...)  │
└───────────────────────┬─────────────────────────┘
                        │
                        v
┌─────────────────────────────────────────────────┐
│              Banking Port (interface)            │
│  getBalance(), sendPayment(), listTransactions() │
│  getExchangeQuote(), sendInternationalPayment()  │
│  applyForLoan(), getLoanStatus()                 │
└───────────┬─────────────────────┬───────────────┘
            │                     │
            v                     v
┌───────────────────┐  ┌─────────────────────┐
│  GriffinAdapter   │  │  MockBankingAdapter  │
│  (production/     │  │  (SQLite + in-memory │
│   sandbox)        │  │   for dev/test)      │
│                   │  │                      │
│  + WiseAdapter    │  │  Includes mock:      │
│    (intl only)    │  │  - accounts          │
│                   │  │  - payments          │
│                   │  │  - FX quotes         │
│                   │  │  - lending           │
│                   │  │  - cards             │
└───────────────────┘  └─────────────────────┘
```

**Key principle:** `USE_MOCK_BANKING=true` in `.env` swaps the entire adapter. Tool handlers never know or care which adapter they are talking to. This means:
- Development and testing use `MockBankingAdapter` with SQLite -- zero external dependencies
- Demo mode can use Griffin sandbox + Wise sandbox for maximum realism
- Production would use real Griffin + real Wise
- New providers (ClearBank, Modulr) can be added as new adapters without changing tool handlers

### 4.5 Sandbox Quality Rankings

Based on research, ranked by developer experience for a POC:

| Rank | Provider | Why |
|------|----------|-----|
| 1 | **Griffin** | Free, instant, full-stack mirror of production, no NDA, already integrated |
| 2 | **Wise** | Free, instant, pre-funded with GBP 1M test credit, excellent docs |
| 3 | **Yapily** | Free, pre-configured mock bank, < 20 min to first call |
| 4 | **TrueLayer** | Free, good sandbox with simulated banks, < 30 min |
| 5 | **Modulr** | Free, self-serve signup, HMAC auth adds friction in setup |
| 6 | **CurrencyCloud** | Free demo key, but rate-limited, missing Node.js SDK |
| 7 | **ClearBank** | Requires sales process and FCA status, weeks not minutes |
| -- | **Railsr** | Not recommended -- post-bankruptcy, merged, unclear status |

### 4.6 Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Griffin sandbox goes down during demo | Low | High | MockBankingAdapter as automatic fallback |
| Wise sandbox has rate limits that block demo flow | Low | Medium | Pre-create test quotes and transfers; cache responses |
| Griffin API changes break our custom client | Low | Medium | Pin API version (v0); our client is thin and focused |
| Wise personal tokens lack needed endpoints | Medium | Medium | Test all required endpoints early; apply for partner access if needed |
| Griffin cards not available for POC timeline | High | Low | Mock card issuing behind BankingPort interface |
| CurrencyCloud SDK gap causes integration friction | Medium | Low | Not using CurrencyCloud -- using Wise instead |

### 4.7 API Documentation Quick Reference

| Provider | Docs URL | Sandbox URL | Auth Method |
|----------|----------|-------------|-------------|
| Griffin | [docs.griffin.com](https://docs.griffin.com/) | [app.griffin.com](https://app.griffin.com) | `GriffinAPIKey` header |
| Wise | [docs.wise.com](https://docs.wise.com/) | [sandbox.transferwise.tech](https://sandbox.transferwise.tech/register) | Personal API token / OAuth 2.0 |
| TrueLayer | [docs.truelayer.com](https://docs.truelayer.com/) | truelayer-sandbox.com domain | OAuth 2.0 / OpenID Connect |
| Yapily | [docs.yapily.com](https://docs.yapily.com/) | Modelo Bank (pre-configured) | Application ID + Secret |
| Modulr | [modulr.readme.io](https://modulr.readme.io/) | api-sandbox.modulrfinance.com | HMAC or token (sandbox) |
| CurrencyCloud | [developer.currencycloud.com](https://developer.currencycloud.com/) | Demo API (rate-limited) | API key |

### 4.8 Summary of Key Decisions

1. **Keep Griffin as primary BaaS.** It works, the sandbox is best-in-class, and we have a running integration. No reason to switch.

2. **Add Wise for international transfers.** Alex's persona explicitly uses Wise. The sandbox is excellent. The conversational UX for "send money abroad" is a strong demo moment.

3. **Keep mock lending.** Real credit APIs require enterprise agreements. Our mock is already realistic with affordability checks and decline scenarios.

4. **Mock cards, standing orders, and direct debits.** No provider offers a fast-enough sandbox for these features. Mock behind clean interfaces for future swap.

5. **Defer Open Banking (TrueLayer/Yapily).** Multi-bank connectivity adds scope without core differentiation. The AI chat experience is our differentiator, not account aggregation.

6. **Use hexagonal architecture with adapter pattern.** `USE_MOCK_BANKING=true` swaps everything. Tool handlers are provider-agnostic. This is the single most important architectural decision for maintainability.

7. **Do not use Griffin MCP server yet.** It is beta, sandbox-only, and adds a dependency on an unproven abstraction. We already have a working Griffin client. Revisit when the MCP server reaches GA.

---

## Appendix: Source URLs

### Griffin
- [Griffin Sandbox Launch](https://griffin.com/blog/griffin-launches-its-sandbox-to-break-down-barriers-for-startups-and-fintech-developers)
- [Griffin Documentation](https://docs.griffin.com/)
- [Griffin MCP Server Announcement](https://griffin.com/blog/the-agentic-bank)
- [Griffin API Reference](https://docs.griffin.com/api/index.html)
- [Griffin Sandbox FAQ](https://griffin.com/support/faqs/collections/sandbox)
- [Griffin Full Banking Licence](https://techcrunch.com/2024/03/10/banking-as-a-service-startup-griffin-riases-24m-and-attains-full-banking-licence/)
- [Griffin 2026 Product Plans](https://thefintechtimes.com/uk-bank-griffin-lands-uber-and-marqeta-as-payments-volumes-hit-3billion/)

### Railsr
- [Railsr Bankruptcy (TechCrunch)](https://techcrunch.com/2023/03/09/railsr-off-the-rails-embedded-finance/)
- [Railsr Bankruptcy Lessons (Flagship Advisory)](https://insights.flagshipadvisorypartners.com/highlights-from-railsrs-bankruptcy-document-and-lessons-learned/)

### ClearBank
- [ClearBank Developer Portal](https://clearbank.github.io/)
- [ClearBank UK API Overview](https://clearbank.github.io/uk/docs/api/overview/)
- [ClearBank Getting Started](https://clearbank.github.io/uk/docs/api/getting-started/)
- [ClearBank 2025 Review](https://clear.bank/learn/insights/2025-in-review)

### Modulr
- [Modulr Documentation](https://modulr.readme.io/)
- [Modulr Sandbox Access](https://modulr.readme.io/docs/gaining-use-of-the-api)
- [Modulr US Expansion](https://www.modulrfinance.com/newsroom/modulr-expands-to-u.s.-with-fis-partnership-to-power-real-time-payments-for-banks)

### TrueLayer
- [TrueLayer API Reference](https://docs.truelayer.com/)
- [TrueLayer Payments API Basics](https://docs.truelayer.com/docs/payments-api-basics)
- [TrueLayer Sandbox Testing](https://docs.truelayer.com/docs/test-payments-in-sandbox)
- [TrueLayer Payments v3 Requirements](https://docs.truelayer.com/docs/payments-v3-apis-requirements)

### Yapily
- [Yapily Documentation](https://docs.yapily.com/)
- [Yapily Sandbox Overview](https://docs.yapily.com/pages/resources/sandbox/sandbox-overview/)
- [Yapily Getting Started](https://docs.yapily.com/pages/getting-started/get-started/)

### Wise
- [Wise Developer Docs](https://docs.wise.com/)
- [Wise Sandbox & Production Environments](https://docs.wise.com/guides/developer/sandbox-and-production)
- [Wise API Reference](https://docs.wise.com/api-reference)
- [Wise Getting Started](https://wise.com/help/articles/2958107/getting-started-with-the-api)

### CurrencyCloud
- [CurrencyCloud Developer Portal](https://developer.currencycloud.com/)
- [CurrencyCloud on Visa Developer](https://developer.visa.com/pages/Currencycloud)
- [CurrencyCloud Postman Collection (GitHub)](https://github.com/CurrencyCloud/postman)

### Open Banking UK
- [Open Banking 2025 Stats](https://www.openbanking.org.uk/insights/open-banking-in-2025-now-part-of-the-uks-everyday-financial-life/)
- [Open Banking API Performance](https://www.openbanking.org.uk/api-performance/)

### Industry Analysis
- [BaaS in the UK (Fintech Brainfood)](https://www.fintechbrainfood.com/p/baas-in-the-uk)
- [Best BaaS Providers in the UK (Gemba)](https://ge.mba/research/best-baas-providers-in-the-uk)
- [Top Open Banking Providers 2025 (Finexer)](https://blog.finexer.com/7-best-banking-api-providers-in-the-uk-2025-guide/)
