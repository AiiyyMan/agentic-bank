# Banking-as-a-Service (BaaS) Provider Research

**Date:** 2026-03-03
**Purpose:** Evaluate BaaS providers for an agentic digital banking POC built by a solo developer.
**POC Requirements:** Account creation, balance management, local payments (transfers), and ideally card issuance. International payments handled separately via Wise.

---

## Recommendation

**Top Pick: Griffin (UK)** -- Free self-serve sandbox, MCP server for agentic AI banking (directly relevant to this POC), excellent docs, no sales calls required. UK-only coverage is the main limitation, but for an agentic banking POC this is the strongest fit.

**Runner-Up: Treasury Prime (US)** -- Completely free self-serve sandbox, immediate access, good docs, covers accounts + cards + ACH + wires. No sales call needed for sandbox. US-only.

**Also Strong: Increase (US)** -- Self-serve signup, every feature available in sandbox, excellent simulation APIs, very strong developer experience. Slightly more enterprise-focused but sandbox is accessible. US-only.

**Best for Cards Only: Marqeta** -- Self-serve sandbox in 3 clicks, best-in-class card issuance. But cards-only, no bank accounts or transfers.

**Best for Global Payments (not banking): Rapyd** -- Self-serve sandbox, 190+ countries, supports ZAR/South Africa. But focused on payments/collections, not full banking (no bank accounts in the traditional BaaS sense).

---

## Summary Table

| Provider | Self-Serve Sandbox? | Accounts | Transfers | Cards | Lending | Free Tier | ZAR/SA? | Docs Quality | Agentic Fit | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| **Griffin** | Yes, free, instant | Yes | Yes (FPS/UK) | No (coming) | No | Free sandbox | No (UK only) | Excellent | Best (MCP server) | Active, FCA licensed |
| **Treasury Prime** | Yes, free, instant | Yes | Yes (ACH/Wire) | Yes | No | Free sandbox | No (US only) | Very Good | Good | Active |
| **Increase** | Yes, self-serve | Yes | Yes (ACH/Wire/RTP/FedNow) | Yes | No | Sandbox free; tx fees in prod | No (US only) | Excellent | Very Good | Active |
| **Column** | Likely requires approval | Yes | Yes (ACH/Wire/Intl) | Yes | No | Sandbox free | No (US only) | Excellent | Good | Active |
| **Unit** | Yes, self-serve | Yes | Yes (ACH/Wire) | Yes | Yes | Sandbox free | No (US only) | Very Good | Good | Active |
| **Marqeta** | Yes, 3-click signup | No | No | Yes (best) | No | Sandbox free; custom prod pricing | No (US focused) | Very Good | Limited (cards only) | Active |
| **Rapyd** | Yes, free signup | Virtual accts | Yes (payouts) | Yes (issuing) | No | Sandbox free | Yes (ZAR) | Good | Moderate | Active |
| **Railsr** | Requires onboarding | Yes (wallets) | Yes | Yes | No | PLAY sandbox free | Unclear (global) | Fair | Moderate | Active (merged with Equals Money) |
| **Galileo** | No, request-only | Yes | Yes | Yes | No | No free tier ($1005+) | No (Americas) | Good | Low | Active (SoFi owned) |
| **Solarisbank** | No, requires Partner Manager | Yes | Yes (SEPA) | Yes | Yes | No self-serve | No (EU/DACH) | Good | Low | Active |
| **ClearBank** | No, FCA-regulated entities only | Yes | Yes (FPS/BACS/CHAPS) | No | No | No self-serve | No (UK only) | Good | Low | Active |
| **Bond** | Unclear, likely sales | Yes | Yes | Yes | No | Sandbox available | No (US only) | Fair | Low | Active (FIS subsidiary) |
| **Synapse** | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | DEAD (bankruptcy 2024) |

---

## Detailed Provider Evaluations

### 1. Griffin (UK) -- RECOMMENDED

**Website:** https://griffin.com
**Sandbox URL:** https://app.griffin.com/register

#### Self-Serve Sandbox Access
Yes. Anyone can create an account and try the API in sandbox mode. No fees, no sales pitch, no NDAs. Signup is instant at https://app.griffin.com/register. This is one of the most accessible BaaS sandboxes available.

#### Banking Features
- **Accounts:** Operational bank accounts, segregated safeguarding accounts, client money accounts (unlimited in sandbox)
- **Transfers:** UK domestic payments via FPS (instant). Bacs, CHAPS, and Direct Debit planned.
- **Cards:** Not yet available (on roadmap)
- **Lending:** Not available
- **Compliance:** Full KYC/KYB verification simulation in sandbox
- **Sandbox trial balance:** GBP 1,000

#### API Docs & Developer Experience
Excellent. Griffin is API-first and developer-centric. Modern REST APIs with clear documentation at https://docs.griffin.com. The platform was built from the ground up for developers, not retrofitted.

#### Agentic AI Fit
**Best-in-class for agentic banking.** Griffin launched an MCP (Model Context Protocol) server in open beta (May 2025), specifically designed for agentic AI applications. The MCP server lets AI agents open accounts, make payments, and analyse historic events -- directly on the banking system. This is available in sandbox and is exactly what an agentic digital banking POC needs. The MCP server is open source on GitHub.

#### Pricing
- Sandbox: Free, unlimited
- Production: Contact sales (relationship-based pricing)

#### Geographic Coverage
UK only (GBP). FCA/PRA authorized bank. No ZAR/South Africa support.

#### Sandbox Realism
High. Simulates real onboarding flows, KYC/KYB checks, account opening, payments between accounts, and payment simulation to external UK bank accounts. Data persists and behaves like production.

---

### 2. Treasury Prime (US)

**Website:** https://www.treasuryprime.com
**Sandbox URL:** https://app.sandbox.treasuryprime.com/sign_up

#### Self-Serve Sandbox Access
Yes. Completely free, immediate signup. No sales call required. Create an account, generate API keys, and start testing immediately. Pre-funded test accounts with $5,000 each are provided.

#### Banking Features
- **Accounts:** Full bank account creation and management via API
- **Transfers:** ACH (credits/debits), wire transfers
- **Cards:** Virtual and physical debit cards, digital wallet support, card controls (merchant category restrictions, velocity limits)
- **Lending:** Not available via sandbox
- **Compliance:** Account opening with verification flows

#### API Docs & Developer Experience
Very good. RESTful API with clear documentation at https://docs.treasuryprime.com. Postman collection available. The sandbox console was recently upgraded to match the production console experience. HTTP Basic Auth makes getting started straightforward.

#### Pricing
- Sandbox: Completely free, no time limits
- Production: Requires bank partner relationship (enterprise sales)

#### Geographic Coverage
US only (USD). No international coverage. No ZAR/South Africa.

#### Sandbox Realism
High. Card scenario simulation (issuing, management, declines, ATM transactions). Sandbox tests nearly all API endpoints with only a few minor exceptions. Requests never hit real banking networks.

---

### 3. Increase (US)

**Website:** https://increase.com
**Dashboard:** https://dashboard.increase.com/signup

#### Self-Serve Sandbox Access
Yes. Increase is now generally available (no invite code needed). Self-serve signup at the dashboard. Every API and dashboard feature is available in sandbox. Simulation APIs (sandbox-only) let you test events that would take hours in production.

#### Banking Features
- **Accounts:** Flexible account constructs with unlimited account numbers, individual and commingled FBO accounts
- **Transfers:** ACH (same-day and next-day), wire transfers, Real-Time Payments (RTP), FedNow, check processing, push-to-card (Visa Direct)
- **Cards:** Virtual and physical card issuance, real-time authorization, 3D Secure, programmatic card processing
- **Lending:** Not a core offering
- **Compliance:** Account management tools, real-time decision webhooks

The breadth of payment rails (ACH, Wire, RTP, FedNow, checks, cards, push-to-card) is one of the widest in the market.

#### API Docs & Developer Experience
Excellent. Often compared to Stripe in terms of developer experience. Clean, well-organized documentation at https://increase.com/documentation. SDKs in multiple languages (Node, Python, Ruby, Go, Java, Kotlin). Simulation APIs are well-documented with clear examples. The API design is modern and consistent.

#### Pricing
- Sandbox: Free
- Production: Pay-per-transaction
  - ACH same-day: $2.00/tx
  - ACH next-day: $0.50/tx
  - Wire: $15.00/tx
  - RTP/FedNow: $2.50/tx
  - Virtual card: $0.25/card
  - Physical card: first 5 free
  - Check: $3.00/check
  - Account numbers: first 10 free
- Custom pricing available for platforms/high-volume

#### Geographic Coverage
US only (USD). Direct connections to Federal Reserve and Visa. No international, no ZAR.

#### Sandbox Realism
Very high. Same state machines and business logic as production. Simulation APIs trigger realistic webhooks. Covers edge cases like returned ACH, card disputes, and declined transactions. One of the most realistic sandbox environments available.

---

### 4. Column (US)

**Website:** https://column.com
**Docs:** https://column.com/docs/guides/

#### Self-Serve Sandbox Access
Partially. Column provides sandbox API keys (prefixed `test_`) that work against the same `api.column.com` domain as production. However, the signup process likely requires an application and approval step. Column is primarily positioned for companies building financial products, and some developers have reported that business approval was needed before full access. For a solo developer POC, access may require explaining your use case.

#### Banking Features
- **Accounts:** FDIC-insured programmable bank accounts, multiple account numbers per account
- **Transfers:** ACH (all 5 settlement windows, full NACHA options), FedWire (22 hours/day), international wires via SWIFT to 180+ countries, Real-Time Payments
- **Cards:** Card programs with dedicated BIN, choice of issuing processors
- **Lending:** Not a core feature
- **Compliance:** Auto-approved KYC/KYB in sandbox

International wire capability via SWIFT is a differentiator -- most US BaaS providers don't offer this.

#### API Docs & Developer Experience
Excellent. Column was founded by a Plaid co-founder and the developer experience reflects that heritage. Clean API design, comprehensive documentation. The sandbox is designed to mirror production exactly -- data persists, same routes, same behavior.

#### Pricing
- Sandbox: Free
- Production: Not publicly disclosed, likely per-transaction

#### Geographic Coverage
US primarily (USD), but SWIFT international wires to 180+ countries is notable. No direct ZAR account support.

#### Sandbox Realism
Very high. Every route is sandboxed, data persists exactly like production. Simulation endpoints for incoming ACH and wire transfers. Goal is to replicate production behavior completely.

---

### 5. Unit (US)

**Website:** https://www.unit.co
**Sandbox Signup:** https://app.s.unit.sh/signup

#### Self-Serve Sandbox Access
Yes. Immediate signup at https://app.s.unit.sh/signup. Provides sandbox access and a "pilot" environment with the same capabilities as production (with some limitations). Load sample data via Postman collection.

#### Banking Features
- **Accounts:** Deposit accounts, credit accounts, wallets
- **Transfers:** ACH, wire transfers, book payments, batch payments, recurring payments
- **Cards:** Physical and virtual debit/credit cards with authorization controls
- **Lending:** Yes -- cash advances, credit lines (a differentiator)
- **Compliance:** Check deposits/payments, stop payments, dispute management, receivables

Unit is one of the few BaaS providers offering lending products through the API.

#### API Docs & Developer Experience
Very good. SDKs in TypeScript, Python, Ruby, and Java. Postman collection available. OpenAPI 3.0 spec for code generation. Rate limit of 1,000 requests/minute per environment. Documentation is well-organized.

#### Pricing
- Sandbox: Free
- Production: Not publicly disclosed (contact sales)

#### Geographic Coverage
US only (USD). Banking services via FDIC-insured bank partners. No international, no ZAR.

#### Sandbox Realism
Good. Special simulation operations for incoming payments, card spending, and other activities. Provides realistic test data and workflows.

---

### 6. Marqeta (US/Global)

**Website:** https://www.marqeta.com
**Sandbox Signup:** https://auth.marqeta.com/create-account

#### Self-Serve Sandbox Access
Yes. Create a sandbox in 3 clicks. Completely self-serve. Start developing in minutes. No sales call needed for sandbox access. This is one of the lowest-friction onboarding experiences.

#### Banking Features
- **Accounts:** No traditional bank accounts
- **Transfers:** No transfer/payment capabilities (card-focused only)
- **Cards:** Best-in-class. Physical, virtual, and tokenized cards. Instant issuance. Digital wallet provisioning. 3D Secure. Just-in-Time (JIT) funding. Dynamic spend controls. Real-time authorizations.
- **Lending:** No
- **Compliance:** PCI and SOC 1/2 certified

Marqeta is a card issuing specialist, not a full BaaS provider. If your POC only needs cards, this is the best option. For accounts and transfers, you need a separate provider.

#### API Docs & Developer Experience
Very good. Open APIs with comprehensive documentation. SDKs available (including Python). Hands-on tutorials and guides. Dashboard with real-time API logs.

#### Pricing
- Sandbox: Free
- Production: Custom pricing (no free tier, no published rates)

#### Geographic Coverage
Primarily US, expanding globally. Card programs can potentially support multiple currencies. No specific ZAR/South Africa mention.

#### Sandbox Realism
Good. Simulates real-world card scenarios including transaction simulation, authorization flows, and decline scenarios. Cloud infrastructure with redundancy.

---

### 7. Rapyd (Global)

**Website:** https://www.rapyd.net
**Sandbox Signup:** https://dashboard.rapyd.net/sign-up

#### Self-Serve Sandbox Access
Yes. Free self-serve signup. Get sandbox API keys immediately from the client portal. Toggle between sandbox and production in the dashboard.

#### Banking Features
- **Accounts:** Virtual accounts (vIBANs in Europe, local formats elsewhere). Wallets.
- **Transfers:** Payouts/disbursements to 190+ countries in 120+ currencies via bank transfers, RTP, card payouts, stablecoins, and third-party wallets
- **Cards:** Virtual and physical card issuing with end-to-end lifecycle management
- **Lending:** No
- **Payments Collection:** Accept payments via 900+ methods (cards, wallets, bank transfers, cash)

Rapyd is more of a global payments infrastructure platform than a traditional BaaS. It excels at cross-border payments, payouts, and collections but does not offer traditional bank accounts with routing numbers.

#### API Docs & Developer Experience
Good. Thorough documentation with clearly explained use cases. OpenAPI spec available. Postman collection for quick testing. Code samples on GitHub. Community forum (community.rapyd.net). However, some developers note that response times from support vary by region.

#### Pricing
- Sandbox: Free
- Production: Transaction-based pricing, varies by payment method and geography

#### Geographic Coverage
**Strongest global coverage of any provider evaluated.** 190+ countries, 150+ currencies, 900+ payment methods. **Explicitly supports South Africa with ZAR** -- bank transfers and bank redirects available. This is the only provider on this list with confirmed ZAR support.

#### Sandbox Realism
Good. Most production functionality is available without real money. Sandbox account numbers and test data provided. Can test card issuing, payouts, and payment collection flows.

---

### 8. Railsr (formerly Railsbank)

**Website:** https://www.railsr.com
**Docs:** https://docs.railsr.com

#### Self-Serve Sandbox Access
Partially. Railsr offers a "PLAY" sandbox (test money) and a "PLAYLive" sandbox (real money). Access requires signing up through their dashboard, but the onboarding process appears to involve some level of review rather than being fully instant. OAuth or API key provided after signup.

#### Banking Features
- **Accounts:** Wallets, ledger accounts
- **Transfers:** Yes (details vary by region)
- **Cards:** Physical and virtual cards (debit, prepaid, credit). Card creation and management via API.
- **Lending:** Via partners (Lendsqr integration)
- **Compliance:** Integrated KYC/AML

#### API Docs & Developer Experience
Fair. Documentation exists at docs.railsr.com but is not as polished as Griffin, Increase, or Column. The API has gone through multiple versions (v1 and v2), which can be confusing. Railsr merged with Equals Money in April 2025, which may mean documentation and APIs are in transition.

#### Pricing
- PLAY sandbox: Free
- Production: Contact sales

#### Geographic Coverage
Claims global coverage. European and UK focus historically. Specific country/currency support details are not well-documented publicly.

#### Sandbox Realism
Moderate. PLAY sandbox provides test money environment. PLAYLive offers real money testing. The two-tier approach is useful but adds complexity.

---

### 9. Galileo Financial Technologies

**Website:** https://www.galileo-ft.com
**Docs:** https://docs.galileo-ft.com

#### Self-Serve Sandbox Access
No. Sandbox access requires contacting Galileo ("Contact us to get started in our sandbox"). While the APIs are documented publicly and developers can view the API reference without an NDA, actually getting sandbox credentials requires a request process. Not self-serve.

#### Banking Features
- **Accounts:** Full account management
- **Transfers:** Payment processing, ACH, wires
- **Cards:** Card issuance and management (a core strength -- powers major fintechs like Chime, Robinhood)
- **Lending:** No
- **Compliance:** Real-time transaction controls, fraud detection

#### API Docs & Developer Experience
Good. 250+ API methods. Documentation at docs.galileo-ft.com includes guides, reference docs, and code fragments. Dashboard portal for API exploration. However, the closed sandbox access significantly reduces the practical developer experience for a solo developer.

#### Pricing
- No free tier. Plans start at approximately $1,005/month.
- Not viable for a solo developer POC.

#### Geographic Coverage
North and South America (US, Mexico, Colombia, Brazil). 168M+ accounts on platform. No European or African coverage.

#### Sandbox Realism
Good (once you have access). Realistic test data, API behavior mirrors production.

---

### 10. Solarisbank (Solaris)

**Website:** https://www.solarisgroup.com
**Docs:** https://docs.solarisgroup.com

#### Self-Serve Sandbox Access
No. You must contact your Partner Manager before testing on Sandbox. The entire onboarding process requires a business partnership agreement. Adding or changing permissions also requires the Partner Manager. This is firmly enterprise/B2B and not accessible to a solo developer without a business relationship.

#### Banking Features
- **Accounts:** Full bank accounts (German IBAN)
- **Transfers:** SEPA payments, credit transfers
- **Cards:** Debit and credit cards
- **Lending:** Yes (consumer and SME lending -- a differentiator)
- **Compliance:** KYC (including BankIdent), full German banking compliance

#### API Docs & Developer Experience
Good but gated. Documentation at docs.solarisgroup.com is comprehensive with deep-dive integration walkthroughs for Banking, Cards, Lending, and KYC. However, practical access is blocked without a Partner Manager relationship.

#### Pricing
- No self-serve pricing. Enterprise partnerships only.

#### Geographic Coverage
EU/DACH focus (Germany, France, Spain, Italy, UK). No ZAR/South Africa.

#### Sandbox Realism
Unknown for solo developers (access requires partnership).

---

### 11. ClearBank (UK)

**Website:** https://clear.bank
**Developer Portal:** https://clearbank.github.io

#### Self-Serve Sandbox Access
No. ClearBank requires an application process. You get a dedicated relationship manager from day one. Eligibility is restricted to legally incorporated financial institutions authorized by the FCA and/or PRA (or in the process of applying). This is not accessible to a solo developer or a non-regulated entity.

#### Banking Features
- **Accounts:** Real bank accounts with sort codes
- **Transfers:** FPS (Faster Payments), BACS, CHAPS
- **Cards:** No card issuance
- **Lending:** No
- **Compliance:** Full UK banking compliance

#### API Docs & Developer Experience
Good. Public documentation on GitHub Pages (clearbank.github.io) with UK API overview, getting started guides, and API reference. The docs are well-structured, but without sandbox access they're theoretical for a solo developer.

#### Pricing
- No self-serve pricing. Relationship-based.

#### Geographic Coverage
UK only (GBP). No ZAR/South Africa.

#### Sandbox Realism
Their "simulation environment" is reportedly comprehensive, but access requires completing their onboarding process.

---

### 12. Bond (now FIS subsidiary)

**Website:** https://www.bond.tech
**Docs:** https://docs.bond.tech

#### Self-Serve Sandbox Access
Unclear. Bond offers a developer sandbox where you can build your entire product, simulate transactions, and flip to production by changing four tokens. However, the signup process and whether it's truly self-serve is not well-documented. Bond was acquired by FIS in 2023, and the platform may be pivoting toward enterprise FIS customers.

#### Banking Features
- **Accounts:** Yes
- **Transfers:** Yes
- **Cards:** Yes
- **Lending:** No details available
- **Compliance:** Integrated

#### API Docs & Developer Experience
Fair. Documentation at docs.bond.tech covers API reference and developer guides. Real-time API status, request/response logs in sandbox. However, the platform's direction post-FIS acquisition is uncertain, and documentation may not be actively maintained at the same pace.

#### Pricing
- Sandbox: Available (pricing unclear)
- Production: Contact sales

#### Geographic Coverage
US only (USD). No ZAR/South Africa.

#### Sandbox Realism
Good. Full-featured sandbox with transaction simulation across use cases. Seamless sandbox-to-production transition.

---

### 13. Synapse -- DEFUNCT

**Status:** DEAD. Filed Chapter 11 bankruptcy in April 2024. Permanently closed.

Synapse's collapse left an estimated $65-95 million shortfall in customer funds, affecting approximately 100 fintechs and 10 million end users. Reconciliation with partner banks (Evolve, AMG, Lineage, American) is still ongoing as of 2025.

**Do not use. Do not consider. The collapse of Synapse is a cautionary tale about BaaS counterparty risk.**

---

## Additional Providers Worth Noting

### Stitch (South Africa)
If ZAR/South Africa coverage is essential beyond Rapyd, consider **Stitch** (https://stitch.money) -- a South African fintech that provides payment APIs with direct bank integrations in South Africa. Not a full BaaS but strong for SA-specific payments.

### Direct Transact (South Africa)
South Africa's largest BaaS/PaaS provider, processing ZAR 50B+/month across 21 currencies. Established 2002. Covers cards, banking, payments, compliance, and reconciliation. Enterprise-focused -- likely not self-serve for a solo developer, but worth knowing about for SA-specific banking infrastructure.

---

## Decision Matrix for This POC

| Criterion | Weight | Griffin | Treasury Prime | Increase | Rapyd |
|---|---|---|---|---|---|
| Self-serve sandbox | High | 10 | 10 | 9 | 9 |
| Accounts | High | 9 | 8 | 9 | 6 |
| Transfers/Payments | High | 7 (UK FPS only) | 8 | 10 | 8 |
| Card Issuance | Medium | 2 (coming) | 7 | 8 | 7 |
| Agentic AI support | High | 10 (MCP server) | 3 | 5 | 3 |
| Docs quality | High | 9 | 8 | 10 | 7 |
| Free for POC | High | 10 | 10 | 10 | 9 |
| ZAR/SA support | Low | 0 | 0 | 0 | 8 |
| Sandbox realism | Medium | 9 | 8 | 10 | 7 |
| **Weighted Score** | | **High** | **High** | **High** | **Moderate** |

### Recommended Approach

1. **Start with Griffin** for the agentic banking POC. The MCP server means your AI agent can directly interact with banking APIs through a standardized protocol. Free sandbox, no friction, excellent docs. Build the core account + payment flows here.

2. **Add Rapyd** if you need ZAR/South Africa payment coverage or global payout capabilities. Use Rapyd for the payments/disbursements layer, not as the core banking platform.

3. **Consider Increase** as a US alternative to Griffin if you need US payment rails (ACH, wire, RTP, FedNow) or if the POC needs to demonstrate US banking capabilities. The developer experience is arguably the best in the industry.

4. **Use Marqeta** if card issuance becomes a critical POC requirement and Griffin's card program isn't yet available.

### Key Risk: Geographic Lock-in

All top-tier developer-friendly BaaS providers are either US-only (Increase, Column, Treasury Prime, Unit) or UK-only (Griffin). There is no single provider that offers both excellent developer experience AND global/ZAR coverage. If the POC needs to demonstrate multi-geography banking, you'll need to compose multiple providers -- likely Griffin or Increase for core banking + Rapyd for global payments + Wise for international transfers.

---

## Sources

- Griffin: https://griffin.com, https://docs.griffin.com, https://griffin.com/blog/the-agentic-bank
- Treasury Prime: https://www.treasuryprime.com, https://docs.treasuryprime.com
- Increase: https://increase.com, https://increase.com/documentation, https://increase.com/fees
- Column: https://column.com, https://column.com/docs/guides/
- Unit: https://www.unit.co, https://www.unit.co/docs/api/
- Marqeta: https://www.marqeta.com, https://www.marqeta.com/developer-overview
- Rapyd: https://www.rapyd.net, https://docs.rapyd.net, https://www.rapyd.net/network/country/south-africa/
- Railsr: https://www.railsr.com, https://docs.railsr.com
- Galileo: https://www.galileo-ft.com, https://docs.galileo-ft.com
- Solarisbank: https://www.solarisgroup.com, https://docs.solarisgroup.com
- ClearBank: https://clear.bank, https://clearbank.github.io
- Bond: https://www.bond.tech, https://docs.bond.tech
- Synapse: Defunct -- https://www.cnbc.com/2024/05/22/synapse-bankruptcy-customer-funds.html
