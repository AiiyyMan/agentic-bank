# 07 - Griffin Deep Dive: UK BaaS + Agentic AI Banking via MCP

**Research Date:** 2026-03-03
**Status:** Comprehensive research complete

---

## Table of Contents

1. [Griffin MCP Server](#1-griffin-mcp-server)
2. [Griffin Sandbox -- Detailed Capabilities](#2-griffin-sandbox--detailed-capabilities)
3. [Griffin as a Company](#3-griffin-as-a-company)
4. [Griffin for Our POC](#4-griffin-for-our-poc)
5. [The "Agentic Bank" Concept](#5-the-agentic-bank-concept)
6. [Comparative Analysis](#6-comparative-analysis)
7. [Architecture Recommendations](#7-architecture-recommendations)
8. [Sources](#8-sources)

---

## 1. Griffin MCP Server

### What Is It?

The Griffin MCP Server is a **beta** Model Context Protocol server that allows AI agents to interact directly with Griffin's banking API. Released on **29 May 2025**, it is the **first MCP server from a UK bank with full read-write capabilities** -- meaning agents can not only query banking data but also create accounts and initiate payments.

MCP (Model Context Protocol) is an open protocol created by Anthropic that provides a standardized way for LLMs to interact with external tools and data sources. Griffin's MCP server wraps their banking API in this protocol, making it natively accessible to any MCP-compatible client.

### GitHub Repository

- **Repo:** [github.com/griffinbank/griffin-mcp-server](https://github.com/griffinbank/griffin-mcp-server)
- **Package:** `@griffinbank/mcp-server` (npm)
- **Language:** TypeScript (93.1%), JavaScript (6.9%)
- **Stars:** ~12 | **Forks:** ~3 | **Commits:** 8 on master
- **License:** Not explicitly specified in README
- **Open Source:** Yes, publicly available

### Tools / Capabilities Exposed (12 Total)

| Tool Name | Operation Type | Description |
|---|---|---|
| `create-and-submit-payment` | **Write** | Creates and submits a payment (FPS or book transfer) |
| `open-operational-account` | **Write** | Opens a new operational bank account |
| `close-bank-account` | **Write** | Closes an existing bank account |
| `list-bank-accounts` | Read | Lists all bank accounts in the organization |
| `list-legal-persons` | Read | Lists all legal persons (entities/individuals) |
| `list-payments` | Read | Lists all payments |
| `list-payees` | Read | Lists payees for a given legal person |
| `list-transactions` | Read | Lists latest transactions for a bank account |
| `get-bank-account` | Read | Gets details for a specific bank account |
| `get-legal-person` | Read | Gets details for a specific legal person |
| `get-payment` | Read | Gets details for a specific payment |
| `get-payee` | Read | Gets details for a specific payee |

**What an AI agent CAN do:**
- Open operational bank accounts programmatically
- Close bank accounts
- Create and submit payments (Faster Payments, book transfers)
- Query account balances and details
- View transaction history
- List and inspect legal persons, payees, and payments
- Analyze financial data across accounts

**What an AI agent CANNOT do (not exposed via MCP):**
- KYC/KYB verification (Verify product -- separate flow)
- Create legal persons / onboard customers
- Manage webhooks or event subscriptions
- Set up Direct Debits or standing orders
- Access savings accounts or interest configuration
- Perform international payments
- Card operations (not yet available at Griffin)
- Lending or credit operations

### How It Integrates with Claude / LLMs

Installation is straightforward via `npx`. Configuration for Claude Desktop:

```json
{
  "mcpServers": {
    "griffin": {
      "command": "npx",
      "args": ["-y", "@griffinbank/mcp-server"],
      "env": {
        "GRIFFIN_API_KEY": "your-griffin-api-key"
      }
    }
  }
}
```

**Config file locations:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Compatible MCP clients:**
- Claude Desktop (primary target)
- Cursor (code editor)
- Any MCP-compatible client

**Authentication:** API key passed as environment variable (`GRIFFIN_API_KEY`). The key is obtained by registering at `app.griffin.com/register`.

**How it works technically:**
1. The MCP server runs as a local Node.js process
2. Claude Desktop (or other MCP client) spawns the server process
3. The server exposes its 12 tools via the MCP protocol
4. When Claude decides to use a tool, it calls the MCP server
5. The MCP server translates the call into Griffin REST API requests
6. Results are returned to Claude for interpretation and response

### Production Readiness

**Current status: Beta, sandbox-only by default.**

- Agent access is **limited to Griffin's sandbox environment**
- Production deployment is available **upon request** -- Griffin is "actively working with customers who want to deploy agentic banking capabilities in production settings"
- The README explicitly warns: **"Do not attempt to use this MCP server with your live organisation API key"**
- Contact `product@griffin.com` for production deployment discussions

### Limitations

1. **Sandbox-only default** -- no self-service production access
2. **Limited tool set** -- only 12 tools covering core account/payment operations
3. **No KYC/KYB tools** -- onboarding flows are not MCP-accessible
4. **No webhook management** -- event-driven flows must be configured separately
5. **Early beta** -- only 8 commits, low community adoption (12 stars)
6. **UK-only** -- GBP payments only, no international payment rails
7. **No card operations** -- cards are on Griffin's 2026 roadmap but not available yet
8. **No lending tools** -- credit/lending operations not exposed
9. **Security considerations** -- MCP servers run locally with API key access; general MCP security concerns apply (unauthorized access, insufficient sandboxing)

---

## 2. Griffin Sandbox -- Detailed Capabilities

### Signup Process

1. Navigate to `https://app.griffin.com/register`
2. Create an account (email/password)
3. **Immediately** receive sandbox access -- no NDA, no credit card, no approval process
4. Get a sandbox API key from the dashboard
5. Start making API calls

**Key selling point:** "Available to everyone, free forever" with no time limit.

### What You Get

- A full sandbox organization with test data capabilities
- API key for sandbox environment
- Access to all Griffin API endpoints in test mode
- Ability to create mock customer bank accounts
- Ability to simulate payments between test accounts
- The sandbox "mirrors the live environment as closely as possible"

### API Surface Area

Griffin's API is a **JSON-over-REST** API designed to be navigated programmatically (HATEOAS-style -- related resource URLs are included in response bodies).

**API Documentation:** [docs.griffin.com](https://docs.griffin.com)

#### Core API Domains:

**1. Onboarding / Verify (KYC/KYB)**
- Create legal persons (individuals and companies)
- Run identity verification (including biometrics)
- PEPs, sanctions, and adverse media screening
- Anti-fraud checks
- Preset workflows (recommended) or custom workflows
- Pre-integrated with regulatory data providers
- Audit trails included
- Compliance team support

**2. Bank Accounts**
Six account types:
- **Operational accounts** -- standard transactional accounts (included by default)
- **Safeguarding accounts** -- for EMIs/PIs to ringfence customer funds
- **Client money accounts** -- for CASS-regulated firms (general, designated, designated client funds)
- **Bare trust accounts** -- holding funds for multiple depositors
- **Embedded accounts** -- all-purpose accounts for end customers (FSCS-protected up to GBP 120,000)
- **Easy access savings accounts** -- interest-bearing with FSCS protection

**3. Payments**
- **Faster Payments Service (FPS)** -- near-instant UK domestic payments (currently live)
- **Book transfers** -- internal transfers between Griffin accounts (live)
- **Bacs** -- coming soon (bulk/batch payments, Direct Debit)
- **CHAPS** -- coming soon (high-value same-day payments)
- **Direct Debit** -- coming soon
- Payment schemes are separated in the API (since July 2025, you must specify FPS vs book transfer)

**4. Transactions & Events**
- Transaction listing per account
- Balance queries
- Webhook notifications for events:
  - `transaction-created` (includes balance change, direction, updated balance)
  - `admission-created` / `admission-updated` (payment status updates)
- Events API for historical event queries
- Webhook signature validation (HTTP message signatures)

**5. Payees**
- Create and manage payees (payment beneficiaries)
- Link payees to legal persons

### Rate Limits

- **50 concurrent (in-flight) API requests** per organization
- **3 concurrent payment submission requests** per bank account
- Exceeding limits returns `429 Too Many Requests`

### Data Persistence

- Sandbox data persists across sessions (not ephemeral)
- Sandbox organizations are separate from live organizations
- API keys are environment-specific (sandbox keys do not work in production)

### Sandbox Realism

- Mirrors live environment "as closely as possible"
- Same API endpoints, same request/response formats
- Simulated payment clearing (FPS settles instantly in sandbox)
- Test KYC/KYB flows with simulated verification results
- Some differences exist between sandbox and live (documented in Griffin's FAQ)

### Can You Simulate Realistic Banking Flows End-to-End?

**Yes, substantially:**
- Create legal person -> verify identity -> open account -> make payment -> check balance -> view transactions
- Simulate buyer/seller payment flows
- Test webhook integrations
- Multi-account scenarios with book transfers

**Caveats:**
- Payment clearing behavior may differ from production
- No real bank-to-bank connectivity in sandbox
- KYC verification results are simulated

### Documentation Quality

- **Overall:** Good, structured documentation at docs.griffin.com
- **Guides:** Get started, onboarding, MCP server, product standards, release notes
- **API Reference:** Available at docs.griffin.com/api
- **Postman Collection:** Available for API testing
- **Release Notes:** Active at updates.griffin.com
- **Community:** Slack community for developer support
- **Status Page:** status.griffin.com
- **Weaknesses:** Some pages render poorly (heavy CSS/JS, content not always accessible to scrapers); detailed endpoint-by-endpoint docs require navigating multiple pages

---

## 3. Griffin as a Company

### Founding & Leadership

- **Founded:** 2017
- **Headquarters:** 29 Finsbury Circus, 781-2 Salisbury House, London EC2M 5QQ, UK
- **Co-Founders:**
  - **David Jarvis** -- Early engineer at Standard Treasury (acquired by Silicon Valley Bank 2015), then infrastructure engineer at Airbnb
  - **Allen Rohner** -- Co-founded CircleCI (tech unicorn), authored "Learning ClojureScript"
- **Team size:** ~128-139 employees (as of mid-2025) across 6 continents
- **Annual revenue:** ~$15M (as of 2025)
- **B Corp certified**

### Regulatory Status

- **Regulated by:** PRA (Prudential Regulation Authority) and FCA (Financial Conduct Authority)
- **Firm Reference Number (FRN):** 970920
- **Entity:** Griffin Bank Ltd
- **Companies House:** Company number 10842931
- **License timeline:**
  - May 2022: Submitted banking license application
  - March 2023: Authorized as a bank **with restrictions** (mobilisation period)
  - March 2024: **Full banking license** -- restrictions lifted, fully operational
- **Distinction:** First BaaS platform in the UK to achieve a full banking license and exit mobilisation

### Funding History

| Round | Date | Amount | Lead Investors |
|---|---|---|---|
| Seed | Early | ~GBP 3M | Seedcamp, Tribe Capital, fintech angels |
| Series A | ~2021 | $13.5M | MassMutual Ventures |
| Series A extension | Jul 2022 | $15.5M | Notion Capital, EQT Ventures |
| Series A extension | Mar 2024 | $24M | MassMutual Ventures, NordicNinja, Breega |
| **Total raised** | | **~$67.4M (~GBP 50M)** | **8 rounds, 35 investors** |

**Notable investors:** MassMutual Ventures, EQT Ventures, Notion Capital, NordicNinja, Breega, Seedcamp

**Notable angel investors:** William Hockey (co-founder of Plaid, founder of Column), Nilan Peiris (VP Growth at Wise), Matt Robinson (co-founder GoCardless/Nested), Paul Forster (co-founder Indeed.com), Carlos Gonzalez-Cadenas (COO GoCardless), Shane Happach (CEO Mollie, ex-CCO Worldpay), Rob Straathof (CEO Liberis)

### Customers & Traction

- **50+ platform customers** as of end-2025
- **Hundreds of thousands** of end users
- **GBP 3 billion** in processed payment volume
- **5x revenue growth** in first full year of operations

**Named customers:**
- **Uber** -- payments infrastructure
- **Marqeta** -- card program payments
- **Access Group** -- enterprise software
- **Sidekick Money** -- digital banking (went live in 8 weeks)
- **Aspora** -- financial services
- **Yonder** -- financial products
- **Prosper** -- financial services
- **TransferGo** -- GBP wallets and savings
- **Calmony** -- client accounts for letting agents
- **ProMEX** -- built prototype of UK offering on Griffin sandbox

**Sectors served:** Wealth, payments, lending, remittance, insurance, proptech, digital banking, payroll

### Technology Stack

- **Core language:** Clojure (functional, JVM-based)
- **Frontend:** ClojureScript
- **Architecture:** Immutable, event-driven
- **Ledger:** Double-entry bookkeeping at the core
- **API design:** REST/JSON, HATEOAS-style navigation
- **Philosophy:** "API-first" -- everything is programmable

### Product Roadmap (2026)

Griffin has publicly indicated plans for:
1. **Card programme** -- launching card issuance capabilities
2. **Stablecoin offering** -- crypto/stablecoin integration
3. **Expanded payments** -- scaling infrastructure, likely Bacs/CHAPS/Direct Debit going live
4. **Continued MCP/agentic development** -- moving from beta toward production

---

## 4. Griffin for Our POC

### Could Griffin MCP Replace Parts of Our Mock Banking Layer?

**Yes, significantly.** Griffin MCP can replace the following mock components with real (sandbox) banking operations:

| POC Requirement | Mock Layer | Griffin MCP | Coverage |
|---|---|---|---|
| Account creation | Mock account generator | `open-operational-account` | FULL |
| Account listing | In-memory store | `list-bank-accounts` | FULL |
| Account details | Mock data | `get-bank-account` | FULL |
| Balance queries | Simulated balances | `get-bank-account` (includes balance) | FULL |
| Local payments (FPS) | Mock payment processor | `create-and-submit-payment` | FULL |
| Transaction history | Mock transaction log | `list-transactions` | FULL |
| Payment status | Mock statuses | `get-payment` | FULL |
| Payee management | Mock payee store | `list-payees`, `get-payee` | FULL |
| KYC/KYB | Mock verification | Not in MCP (Verify API separate) | PARTIAL -- needs direct API |
| International payments | Mock/Wise | Not available | NONE -- stays mock or Wise |
| Cards | Mock | Not available (2026 roadmap) | NONE -- stays mock |
| Lending/credit | Mock | Not available | NONE -- stays mock |
| Standing orders | Mock | Not in MCP | NONE |
| Direct Debit | Mock | Coming soon, not in MCP | NONE |
| VAS (airtime, etc.) | Mock | Not available | NONE -- stays mock |

**Bottom line:** Griffin MCP covers **core banking operations** (accounts, payments, balances, transactions) comprehensively. International, cards, lending, and VAS remain in mock territory.

### Architecture: Griffin MCP + Claude Tool-Use

```
                                    +------------------+
                                    |   Claude (LLM)   |
                                    |  with tool-use   |
                                    +--------+---------+
                                             |
                              MCP Protocol   |   Custom Tool Definitions
                          +------------------+------------------+
                          |                                     |
                +---------v----------+             +-----------v-----------+
                | Griffin MCP Server |             | Custom Tool Handlers  |
                | (@griffinbank/     |             | (Mock/Wise/VAS)       |
                |  mcp-server)       |             |                       |
                +---------+----------+             +-----------+-----------+
                          |                                     |
                   Griffin REST API                    Mock APIs / Wise API
                          |                                     |
                +---------v----------+             +-----------v-----------+
                | Griffin Sandbox    |             | Supabase DB           |
                | (real banking)     |             | (mock data store)     |
                +--------------------+             +-----------------------+
```

**Two-track approach:**
1. **Track 1 -- Griffin MCP:** Accounts, local payments, balances, transactions
2. **Track 2 -- Custom tools:** International payments (Wise), lending (mock), cards (mock), VAS (mock)

Both tracks feed into Claude's tool-use system. The LLM decides which tool to invoke based on the user's intent.

### Do We Still Need the Hexagonal/Adapter Pattern?

**Yes, but it becomes simpler and more justified.**

The hexagonal pattern remains valuable because:

1. **Dual-provider reality:** Griffin handles core banking, but mock/Wise/VAS providers are still needed. The adapter pattern cleanly separates these.

2. **MCP vs. direct API:** Some Griffin features (KYC/Verify, webhooks) are not in the MCP server and require direct REST API calls. An adapter can unify the interface.

3. **Future portability:** If we want to swap Griffin for another provider (or go to production with a different bank), the adapter pattern protects the core domain.

4. **Simplified adapters:** Instead of writing mock banking logic, the Griffin adapter simply delegates to the MCP server or REST API. Much less code.

**Recommended adapter structure:**

```
ports/
  BankingPort.ts          # Interface for all banking operations
  PaymentPort.ts          # Interface for payment operations

adapters/
  griffin/
    GriffinBankingAdapter.ts    # Wraps Griffin MCP / REST API
    GriffinPaymentAdapter.ts    # FPS + book transfers via Griffin
  mock/
    MockLendingAdapter.ts       # Lending stays mock
    MockCardsAdapter.ts         # Cards stay mock
    MockVASAdapter.ts           # VAS stays mock
  wise/
    WisePaymentAdapter.ts       # International payments via Wise
```

### Conflicts with Supabase?

**No significant conflicts.** Griffin and Supabase serve completely different roles:

| Concern | Griffin | Supabase |
|---|---|---|
| **Auth** | API key auth for banking ops | User auth (email/social/magic link) |
| **Data storage** | Banking data (accounts, payments, txns) | App data (user prefs, mock data, sessions) |
| **Scope** | Financial operations | Application layer |

**Integration pattern:**
- Supabase handles user authentication and application state
- Griffin handles banking operations
- A user's Supabase session authorizes them to make banking requests
- The backend maps Supabase user IDs to Griffin legal persons
- No data duplication needed -- query Griffin for live banking data, Supabase for app-specific data

**One consideration:** Griffin's webhook events may need to be stored in Supabase for the application layer to access asynchronously (e.g., payment status updates triggering UI notifications).

### What Griffin CAN Handle for Our POC

1. **Account opening/closing** -- via MCP `open-operational-account`, `close-bank-account`
2. **Local payments (FPS)** -- via MCP `create-and-submit-payment`
3. **Book transfers** -- via MCP `create-and-submit-payment`
4. **Balance queries** -- via MCP `get-bank-account`
5. **Transaction history** -- via MCP `list-transactions`
6. **Payee management** -- via MCP `list-payees`, `get-payee`
7. **KYC/KYB verification** -- via direct Verify API (not MCP)
8. **Webhook notifications** -- via direct API (transaction events, payment events)
9. **Multiple account types** -- operational, safeguarding, client money, embedded, savings

### What Griffin CANNOT Handle (Remains Mock/Third-Party)

1. **International payments** -- Griffin is GBP/UK-only. Use Wise sandbox for this.
2. **Card issuance/management** -- On Griffin's 2026 roadmap, not available yet
3. **Lending/credit** -- Griffin mentions credit/lending as a product but details are sparse; not in MCP
4. **Value-added services** -- Airtime top-up, bill payments, etc. Not a banking function.
5. **Standing orders** -- Not exposed in current API/MCP
6. **Direct Debit collection** -- Coming soon but not yet live
7. **Multi-currency** -- GBP only
8. **Interest rate configuration** -- Savings accounts exist but rate config is not in MCP

---

## 5. The "Agentic Bank" Concept

### Griffin's Blog Post: "The Agentic Bank"

Published alongside the MCP server launch (May 2025), Griffin's blog post "The Agentic Bank -- Announcing Griffin's MCP Server" lays out their vision for AI-powered banking.

**Key thesis:** We are at "an early stage of a massive technological platform shift" where the financial system needs to be "fundamentally rewired to accommodate a world where agents can freely transact while retaining appropriate safeguards."

**Current state of the art (per Griffin):** "There have been a few test cases floating around of people getting AI agents to engage in financial transactions, but these are generally limited to proofs-of-concept like getting an agent to buy a cup of coffee."

**Griffin's position:** Banking infrastructure needs to be built for programmatic, agent-driven access from the ground up -- not bolted on as an afterthought. Their API-first architecture positions them uniquely for this.

### Griffin's Vision for AI-Powered Banking

**Near-term use cases:**
- Automated financial administration (reconciliation, reporting)
- Prototype fintech applications rapidly using AI + banking APIs
- AI-assisted treasury management

**Medium-term vision:**
- AI serving as an **end-to-end wealth manager**
- Autonomous handling of **routine administrative banking tasks**
- Customers building **personalized financial agents** that manage money in tailored ways

**Long-term implication:**
- The shift from chatbots (narrow AI) to truly autonomous financial agents
- Banking infrastructure becoming a platform for agent-to-agent financial interactions
- Programmatic compliance and safeguards built into the infrastructure layer

### How Griffin's MCP Approach Compares to Building Our Own Tool-Use Layer

| Dimension | Griffin MCP | Our Custom Tool-Use Layer |
|---|---|---|
| **Setup time** | Minutes (npx install + API key) | Days/weeks of development |
| **Real banking data** | Yes (sandbox, or production on request) | No (mock data) |
| **Maintenance** | Griffin maintains the MCP server | We maintain everything |
| **Scope** | 12 tools, core banking only | Unlimited, whatever we define |
| **Flexibility** | Limited to Griffin's tool definitions | Full control over parameters, behavior |
| **Production path** | Real bank, real payments, real compliance | Need to integrate with a real bank eventually |
| **Cost** | Free (sandbox), paid (production) | Development time only |
| **Risk** | Dependency on Griffin (beta product) | Full ownership but more work |

**Recommendation:** Use Griffin MCP for core banking operations (fast, real, credible for demos) and custom tool-use for everything else. This hybrid approach gives us the best of both worlds.

---

## 6. Comparative Analysis: Griffin vs UK BaaS Competitors

### Griffin vs ClearBank vs Modulr

| Feature | Griffin | ClearBank | Modulr |
|---|---|---|---|
| **License type** | Full UK banking license | Banking license | E-money license |
| **FSCS protection** | Yes (up to GBP 120K per customer) | Yes (up to GBP 85K) | No (e-money, not deposits) |
| **API-first** | Yes (core design) | Yes | Yes |
| **MCP server** | Yes (first UK bank) | No | No |
| **Payment schemes** | FPS, book transfers (Bacs/CHAPS coming) | FPS, Bacs, CHAPS | FPS, Bacs, CHAPS, Direct Debit |
| **KYC/KYB built-in** | Yes (Verify product) | No (partner integrations) | No (partner integrations) |
| **Cards** | Coming 2026 | Via partners | Yes (card issuance) |
| **Target market** | Fintechs, platforms, embedded finance | Fintechs, banks, crypto | Payroll, travel, lending, merchants |
| **Integration time** | Weeks (8 weeks claimed by Sidekick) | Weeks to months | Weeks to months |
| **Founded** | 2017 | 2016 | 2015 |
| **Sandbox** | Free, no time limit | Available | Available |
| **AI/Agent focus** | Strong (MCP server, agentic bank vision) | None publicly | None publicly |
| **Technology** | Clojure, event-driven, immutable | .NET | Not public |
| **Total funding** | ~$67.4M | ~$33M+ | ~$50M+ |

### Griffin's Unique Differentiators

1. **Only UK bank with an MCP server** -- no competitor offers this
2. **Full-stack BaaS** with own banking license (not relying on partner bank)
3. **Built-in KYC/KYB** (Verify) -- single integration for onboarding + banking
4. **API-first from day one** -- Clojure-based immutable architecture designed for programmability
5. **B Corp certified** -- uncommon for banks
6. **Strong fintech investor base** with angels from Plaid, Wise, GoCardless, Worldpay

### Griffin's Weaknesses vs Competitors

1. **Fewer payment schemes** than ClearBank or Modulr (no Bacs/CHAPS/DD yet)
2. **No cards yet** (Modulr already has cards)
3. **Smaller** and newer than ClearBank
4. **UK-only** -- no international payment rails (Wise needed for cross-border)
5. **MCP server is beta** -- limited toolset, sandbox-only by default

---

## 7. Architecture Recommendations

### Recommended Approach: Hybrid Griffin MCP + Custom Tools

```
User (Mobile/Web App)
        |
        v
  Supabase Auth (session management)
        |
        v
  Application Backend (Next.js API routes or Edge Functions)
        |
        v
  Claude Tool-Use Orchestrator
        |
        +---> Griffin MCP Server -----> Griffin Sandbox API
        |       (accounts, payments,     (real banking operations)
        |        balances, transactions)
        |
        +---> Custom Mock Tools ------> Supabase DB
        |       (lending, cards, VAS)    (mock data persistence)
        |
        +---> Wise Sandbox API -------> Wise Sandbox
                (international payments)  (simulated FX + transfers)
```

### Implementation Steps

1. **Phase 1 -- Griffin Setup (Day 1)**
   - Register at app.griffin.com/register
   - Get sandbox API key
   - Install MCP server: `npx -y @griffinbank/mcp-server`
   - Verify 12 tools are accessible from Claude Desktop

2. **Phase 2 -- Adapter Layer (Days 2-3)**
   - Define BankingPort interface
   - Implement GriffinAdapter wrapping MCP calls
   - Implement MockAdapter for lending/cards/VAS
   - Wire up Wise adapter for international

3. **Phase 3 -- Integration (Days 4-5)**
   - Connect Supabase auth to Griffin legal persons
   - Set up webhook handlers for Griffin events
   - Build Claude tool definitions that map to adapters
   - Test end-to-end flows in sandbox

### Pricing Considerations

- **Sandbox:** Free, no time limit, no credit card needed
- **Production:** Pay-as-you-go model, "no hidden fees"
- **Interest/commission:** Earn from 1.75% on deposits
- **Startup package:** Available for eligible new UK companies
- **Specific pricing:** Not publicly listed; contact Griffin sales for detailed fee schedules

### Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| MCP server is beta | Medium | Use adapter pattern; fall back to direct API if needed |
| Limited tool set (12 tools) | Low | Covers core needs; extend via direct API for gaps |
| Sandbox differs from production | Low | Test thoroughly; Griffin says sandbox mirrors production closely |
| Griffin dependency | Medium | Hexagonal architecture allows provider swap |
| Rate limits (50 concurrent) | Low | Adequate for POC; well below production scale |
| No international payments | Expected | Wise sandbox handles this |
| No cards | Expected | Mock layer handles this; Griffin adding 2026 |
| Security (API key in MCP) | Medium | Sandbox-only for POC; never use production keys in MCP |

---

## 8. Sources

### Primary Sources
- [Griffin MCP Server - GitHub Repository](https://github.com/griffinbank/griffin-mcp-server)
- [The Agentic Bank - Griffin Blog](https://griffin.com/blog/the-agentic-bank)
- [Griffin MCP Server Documentation](https://docs.griffin.com/docs/guides/griffin-mcp-server/index.html)
- [Griffin API Documentation](https://docs.griffin.com/api/index.html)
- [Griffin MCP Server Release Notes](https://updates.griffin.com/announcements/the-griffin-mcp-server)

### Company & Funding
- [Griffin Exits Mobilisation and Raises $24M - Griffin Blog](https://griffin.com/blog/griffin-exits-mobilisation-and-raises-$24million)
- [BaaS Startup Griffin Raises $24M - TechCrunch](https://techcrunch.com/2024/03/10/banking-as-a-service-startup-griffin-riases-24m-and-attains-full-banking-licence/)
- [Griffin Raises $13.5M Series A - Griffin Blog](https://griffin.com/blog/griffin-raises-13-5-million-in-series-a-funding-round-led-by-massmutual-ventures)
- [Griffin Secures Additional $15.5M - Griffin Blog](https://griffin.com/blog/griffin-secures-additional-15-5-million-in-funding-in-quest-to-become-the-bank-fintechs-can-build-on)
- [Griffin Receives Full UK Banking Licence - Fintech Futures](https://www.fintechfutures.com/bankingtech/griffin-receives-full-uk-banking-licence-and-24m-investment-to-spur-growth/)
- [It's Official: Griffin Is a Bank - Griffin Blog](https://griffin.com/blog/its-official-griffin-is-a-bank)
- [Griffin Company Facts](https://griffin.com/company-facts)

### Customers & Growth
- [Griffin Closes 2025 with 50+ Customers - Financial IT](https://financialit.net/news/banking/griffin-closes-2025-50-platform-customers-welcomes-uber-marqeta-sidekick-aspora-access)
- [UK Bank Griffin Bags Uber and Marqeta - Fintech Times](https://thefintechtimes.com/uk-bank-griffin-lands-uber-and-marqeta-as-payments-volumes-hit-3billion/)
- [Griffin Closes 2025 with 50+ Customers - The Power 50](https://www.thepower50.com/griffin-closes-2025-with-50-platform-customers-and-3billion-in-payments-volume/)
- [Griffin Case Studies](https://griffin.com/case-studies)

### Technical & Architecture
- [Clojure in Banking: Griffin - JUXT](https://www.juxt.pro/blog/clojure-in-griffin/)
- [Building an Immutable Bank - Griffin Blog](https://griffin.com/blog/the-immutable-bank)
- [Griffin Launches MCP Server - Finovate](https://finovate.com/griffin-launches-mcp-server-for-agentic-ai-banking/)
- [Griffin Begins Build of Agentic Bank - Finextra](https://www.finextra.com/newsarticle/46065/griffin-begins-build-of-agentic-bank)

### Industry Context
- [Banks with MCP Servers - Agentic Banking Directory](https://www.openbankingtracker.com/agentic-banking-and-mcp)
- [BaaS in the UK - Fintech Brain Food](https://www.fintechbrainfood.com/p/baas-in-the-uk)
- [Best BaaS Providers in the UK - Gemba](https://ge.mba/research/best-baas-providers-in-the-uk)
- [Griffin Debuts MCP Server - ThePaypers](https://thepaypers.com/online-mobile-banking/griffin-debuts-mcp-server-for-ai-agent-banking--1273885)

### Sandbox & Products
- [Griffin Sandbox FAQ](https://griffin.com/support/faqs/collections/sandbox)
- [What Is the Sandbox? - Griffin FAQ](https://griffin.com/support/faqs/questions/what-is-the-sandbox)
- [Types of Bank Accounts - Griffin Docs](https://docs.griffin.com/docs/guides/types-of-bank-accounts/index.html)
- [Griffin Payments Product](https://griffin.com/products/payments)
- [Griffin Safeguarding Accounts](https://griffin.com/products/safeguarding)
- [Griffin Pricing](https://griffin.com/pricing)
- [Which UK Payment Rails Are Right for You? - Griffin Blog](https://griffin.com/blog/which-uk-payment-rails-are-right-for-you)
- [Griffin Launches Verify - Griffin Blog](https://griffin.com/blog/griffin-launches-verify-the-first-product-available-from-its-banking-as-a-service-platform)
