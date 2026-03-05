# Wise API Sandbox Research for Agentic Digital Banking POC

**Date:** 2026-03-03
**Purpose:** Evaluate Wise (formerly TransferWise) API sandbox for international payments and forex in an agentic digital banking proof-of-concept.

---

## Verdict: Can we use this for POC?

**YES -- strongly recommended.**

The Wise sandbox is self-serve, free, pre-funded with 1,000,000 GBP test credit, and supports the complete end-to-end flow we need: get forex quote, lock exchange rate, create recipient, initiate transfer, fund from balance, and track status via simulation endpoints and webhooks. The API is well-documented REST, has a public Postman collection, and can demonstrate a realistic international payment flow without touching real money.

**Key strengths for our POC:**
- Self-serve signup, no approval needed, instant access
- Pre-funded sandbox balance (1M GBP) -- no real money required
- Complete transfer lifecycle simulatable via dedicated simulation endpoints
- Webhook support for transfer state changes works in sandbox
- Mid-market FX rate quotes with 30-minute rate lock
- 56 currencies supported in multi-currency accounts (ZAR included in production; sandbox may require fallback to GBP/EUR/USD for stable testing)

**Key risks to monitor:**
- No official Wise-maintained Node.js SDK (community packages only, poorly maintained)
- PSD2 restrictions on personal tokens in EU/UK (cannot fund transfers or view statements)
- Not all currency routes work identically in sandbox vs production
- Sandbox has higher latency than production

---

## 1. Sandbox Access

### Registration Process

- **Self-serve:** Yes, fully self-serve. No approval or partnership required.
- **URL:** Register at `https://sandbox.transferwise.tech/register`
- **Requirements:** Email and password only. No identity verification needed.
- **2FA:** Always use code `111111` in sandbox.
- **Cost:** Free.
- **Pre-funded:** All new sandbox accounts come with **1,000,000 GBP** test credit.

### Steps to get started:
1. Register at sandbox URL with email + password
2. Complete basic profile setup (name, etc.)
3. Go to Settings > API Tokens > Add New Token
4. Use the token as `Authorization: Bearer <token>` in API calls

### For Partner/Enterprise access (not needed for POC):
- Wise sends Client ID + Client Secret for OAuth 2.0
- This is for production partnerships, not needed for sandbox prototyping

**Sources:**
- https://wise.com/help/articles/2958107/getting-started-with-the-api
- https://docs.wise.com/guides/developer/sandbox-and-production

---

## 2. Sandbox Capabilities

### 2.1 Forex / Exchange Rate Quotes

**Two endpoints available:**

#### A. Live Exchange Rates (unauthenticated OK)
```
GET /v1/rates?source=USD&target=ZAR
```
- Returns mid-market exchange rate
- Supports `source`, `target`, `time` (historic), `from`/`to` (date range), `group` (day/hour/minute)
- No authentication required for basic rate lookups
- **Sandbox note:** `from`, `to`, and `group` parameters are NOT testable in sandbox

#### B. Authenticated Quotes (for actual transfers)
```
POST /v3/profiles/{profileId}/quotes
```
Request body:
```json
{
  "sourceCurrency": "USD",
  "targetCurrency": "ZAR",
  "sourceAmount": 1000,
  "targetAccount": null,
  "payOut": "BANK_TRANSFER"
}
```
- Locks mid-market exchange rate for **30 minutes**
- Returns: quote ID, exchange rate, fees, source/target amounts, delivery estimate
- Quote must be updated with recipient before creating transfer
- **Sandbox note:** Provides realistic but not live rates. `rateType: FLOATING` is NOT testable in sandbox.

### 2.2 Transfer Creation and Simulation

**Full transfer lifecycle supported in sandbox:**

#### Step 1: Create Quote
```
POST /v3/profiles/{profileId}/quotes
```

#### Step 2: Create Recipient
```
POST /v1/accounts
```
- Requires: profile ID, account holder name, currency, bank details (country-specific)
- Use `GET /v1/quotes/{quoteId}/account-requirements` to discover required fields per currency

#### Step 3: Create Transfer
```
POST /v3/profiles/{profileId}/transfers
```
Request body:
```json
{
  "quoteId": "<quote-id>",
  "targetAccount": "<recipient-id>",
  "details": {
    "reference": "Payment for invoice #123"
  }
}
```
- Returns transfer ID and initial status
- Transfer must be funded within 14 days

#### Step 4: Fund Transfer
```
POST /v3/profiles/{profileId}/transfers/{transferId}/payments
```
```json
{
  "type": "BALANCE"
}
```
- Funds from the pre-loaded 1M GBP sandbox balance
- May require SCA challenge in sandbox (PIN-based, not SMS)

#### Step 5: Simulate Status Changes (sandbox only)
```
POST /v1/simulation/transfers/{transferId}/processing
POST /v1/simulation/transfers/{transferId}/funds_converted
POST /v1/simulation/transfers/{transferId}/outgoing_payment_sent
POST /v1/simulation/transfers/{transferId}/bounced_back
POST /v1/simulation/transfers/{transferId}/funds_refunded
```
- **Must be called in order** (processing -> funds_converted -> outgoing_payment_sent)
- These trigger webhook events for `transfers#state-change`
- **Gotcha:** Simulating `bounced_back` to `funds_refunded` does NOT trigger a refund webhook

### Transfer State Flow
```
Normal:    incoming_payment_waiting -> processing -> funds_converted -> outgoing_payment_sent
Problem:   outgoing_payment_sent -> bounced_back -> processing -> cancelled -> funds_refunded
```

### 2.3 Multi-Currency Accounts

- **Supported:** Yes, full Balance API available
- `GET /v4/profiles/{profileId}/balances` -- list all balance accounts
- `GET /v4/profiles/{profileId}/balances/{balanceId}` -- get specific balance
- Supports up to **56 currencies**
- One STANDARD balance per currency, multiple SAVINGS balances (Jars)
- Balance conversion between currencies supported
- Account overview endpoint shows total valuation across all balances
- Sandbox pre-funded with 1M GBP; can convert to other currencies for testing

### 2.4 Recipient Management

- `POST /v1/accounts` -- create recipient
- `GET /v1/accounts?profileId={profileId}` -- list recipients
- `GET /v1/accounts/{accountId}` -- get recipient details
- `DELETE /v1/accounts/{accountId}` -- delete recipient
- `GET /v1/quotes/{quoteId}/account-requirements` -- discover required fields per target currency
- Recipient verification status returned in response (`confirmations` field)
- Full name required (first + last, each > 1 character)
- Different bank detail formats per currency/country

### 2.5 Transfer Status Tracking / Webhooks

**Webhook subscription:**
```
POST /v4/profiles/{profileId}/subscriptions
```
```json
{
  "name": "Transfer status updates",
  "trigger_on": "transfers#state-change",
  "delivery": {
    "version": "2.0.0",
    "url": "https://your-webhook-endpoint.com/wise"
  }
}
```

**Available webhook event types:**
- `transfers#state-change` -- primary event for tracking transfers
- `balances#update` -- for balance changes (including top-ups)
- Profile verification events

**Webhook payload structure:**
```json
{
  "data": {
    "resource": {
      "type": "transfer",
      "id": 12345,
      "profile_id": 67890,
      "account_id": 11111
    },
    "current_state": "outgoing_payment_sent",
    "previous_state": "funds_converted",
    "occurred_at": "2026-03-03T12:00:00Z"
  }
}
```

**Important:** Webhooks do NOT contain personally identifiable information. For full details, you must query the transfer endpoint.

**Sandbox webhook testing:** Simulation endpoints trigger real webhook calls, so you can validate your webhook handler end-to-end.

---

## 3. Rate Limits

- **General limit:** 500 requests per minute (RPM)
- **Throttling:** Requests are slowed/queued when limit exceeded (not hard-rejected with 429, based on available docs)
- **Sandbox-specific limits:** Not explicitly documented as different from production
- **Best practices recommended by Wise:** Batch requests, cache frequently accessed data, monitor usage via response headers
- **Load/performance testing:** Explicitly NOT supported in sandbox

**Assessment for POC:** 500 RPM is more than sufficient for a POC demo. Even with an agentic system making multiple calls per user action, we would be well within limits.

---

## 4. API Quality

### Protocol
- **REST API** -- standard JSON over HTTPS
- **No GraphQL** offering
- API versioning via URL path (v1, v3, v4 for different resources)

### Base URLs
| Environment | Standard | mTLS |
|-------------|----------|------|
| Sandbox | `https://api.sandbox.transferwise.tech` | `https://api-mtls.sandbox.transferwise.tech` |
| Sandbox (new) | `https://api.wise-sandbox.com` | `https://api-mtls.wise-sandbox.com` |
| Production | `https://api.wise.com` | `https://api-mtls.wise.com` |

Note: Both old (`transferwise.tech`) and new (`wise-sandbox.com`) sandbox domains appear in documentation. The newer `wise-sandbox.com` domain is used in recent examples.

### SDK Availability (Node.js)

**No official Wise-maintained SDK.** Community options:

| Package | npm Name | Status | Notes |
|---------|----------|--------|-------|
| wise-client (13pass) | `transferwise` | v2.2.0, last updated ~2025 | Promise-based, ES7. Most active community option. Has `createQuoteV2()`, `getBalancesV3()`, etc. |
| @fightmegg/transferwise | `@fightmegg/transferwise` | Inactive (12+ months) | Covers recipients, quotes, transfers |
| wise-api | `wise-api` | Unknown | Less documented |

**Recommendation for POC:** Write a thin REST wrapper using `fetch` or `axios` rather than relying on unmaintained community packages. The API is straightforward REST -- an SDK is a convenience, not a necessity.

### Documentation Quality
- **Primary docs:** https://docs.wise.com/api-reference (new platform docs, client-side rendered -- harder to scrape)
- **Legacy docs:** https://api-docs.transferwise.com/ (older but more complete in some areas)
- **GitHub:** https://github.com/transferwise/api-docs (markdown source, useful reference)
- **Postman:** Public workspace with 7 organized collections (all-endpoints, bank-flow, payouts, multi-currency-account, etc.)
  - URL: https://www.postman.com/transferwise/workspace/transferwise-s-public-workspace/
  - Pre-configured for sandbox environment
  - Automated tests that copy response data between sequential calls
- **Quality assessment:** Good overall. The new docs site (docs.wise.com) is modern but client-side rendered (hard for agents to parse). The Postman collections are excellent for hands-on testing. GitHub markdown docs are the most agent-friendly source.

---

## 5. End-to-End Demo Flow

**Yes, the complete flow is demonstrable in sandbox:**

```
1. GET  /v1/rates?source=USD&target=GBP
   -> Show live mid-market exchange rate

2. POST /v3/profiles/{profileId}/quotes
   -> Create authenticated quote, lock rate for 30 min
   -> Show: rate, fees, estimated delivery, source/target amounts

3. POST /v1/accounts
   -> Create recipient with bank details
   -> Show: recipient created, verification status

4. PATCH /v3/profiles/{profileId}/quotes/{quoteId}
   -> Update quote with target recipient account

5. POST /v3/profiles/{profileId}/transfers
   -> Create transfer from quote + recipient
   -> Show: transfer ID, initial status

6. POST /v3/profiles/{profileId}/transfers/{transferId}/payments
   -> Fund transfer from sandbox balance
   -> Show: payment initiated

7. POST /v1/simulation/transfers/{transferId}/processing
   POST /v1/simulation/transfers/{transferId}/funds_converted
   POST /v1/simulation/transfers/{transferId}/outgoing_payment_sent
   -> Simulate transfer progression
   -> Each triggers webhook to your endpoint
   -> Show: real-time status updates

8. GET  /v3/profiles/{profileId}/transfers/{transferId}
   -> Confirm final transfer status
   -> Show: completed transfer details
```

**This gives us a compelling demo:**
- Agent receives user intent ("Send $500 to John in London")
- Agent fetches FX rate and creates quote
- Agent creates/selects recipient
- Agent initiates and funds transfer
- Agent monitors webhook callbacks for status updates
- Agent reports completion to user

---

## 6. Authentication

### For POC / Personal Use: API Token (Bearer)
- Generated from sandbox account Settings > API Tokens
- Used as `Authorization: Bearer <api-token>`
- Simple, sufficient for POC
- **PSD2 restriction:** In EU/UK, personal tokens cannot fund transfers or view balance statements via API. This applies to PRODUCTION only -- sandbox testing may still work.

### For Partner/Enterprise: OAuth 2.0
- Client ID + Client Secret provided by Wise integration team
- Standard OAuth 2.0 flow
- Required for production partner integrations
- Not needed for POC sandbox work

### Strong Customer Authentication (SCA)
- Some endpoints require SCA (balance funding, statements)
- In sandbox: SCA challenges are PIN-based (not SMS/phone)
- SCA flow: receive 403 with `X-2FA-Approval` header -> sign one-time token with RSA key -> retry with signature
- **Sandbox simplification:** SCA is simulated and always succeeds with test credentials

---

## 7. Currency Support

### Production
- **56 currencies** supported in multi-currency accounts
- **ZAR (South African Rand):** Supported for send and receive
  - Send ZAR via SWIFT international payment and local transfers
  - Receive ZAR to GBP SWIFT/global account
  - ZAR balance accounts available

### Sandbox
- **Not all currency routes** work identically to production
- **Recommended stable currencies for sandbox testing:** GBP, EUR, USD
- If ZAR does not work in sandbox, fall back to GBP/EUR/USD for demo purposes and note that ZAR is production-supported
- The 1M GBP pre-funded balance can be converted to other currencies within sandbox

### Payout Methods
- `BANK_TRANSFER` (default)
- `BALANCE`
- `SWIFT`
- `SWIFT_OUR`
- `INTERAC`

---

## 8. Gotchas and Limitations for POC

### Sandbox-Specific Issues
1. **Not all currency routes work in sandbox.** If ZAR fails, fall back to GBP/EUR/USD pairs.
2. **Higher latency** than production -- endpoints are slower in sandbox.
3. **No load/performance testing** allowed in sandbox.
4. **Simulation order matters** -- status changes must be called in sequence (processing -> funds_converted -> outgoing_payment_sent).
5. **`bounced_back` to `funds_refunded` simulation** does not trigger a refund webhook.
6. **`rateType: FLOATING`** is not testable in sandbox -- only FIXED rates.
7. **Rate `from`/`to`/`group` params** for historical rates are not testable in sandbox.
8. **Email/phone notifications** do not fire in sandbox.

### Authentication Gotchas
9. **PSD2 personal token restrictions** (EU/UK production): Cannot fund transfers or view statements. For production, you would need OAuth 2.0 partner credentials.
10. **SCA required for some operations** even in sandbox (balance funding, statements). Sandbox simplifies this with PIN-based challenges.

### API Design Gotchas
11. **No official Node.js SDK.** Must write own REST client or use poorly maintained community packages.
12. **API versioning is inconsistent** across resources: v1 (profiles, recipients, rates, simulation), v3 (quotes, transfers), v4 (balances, webhooks).
13. **Quote expiration:** Rates lock for only 30 minutes. Your agent must complete the transfer creation flow within that window.
14. **Transfers must be funded within 14 days** or they expire.
15. **Two sandbox domains exist** (`api.sandbox.transferwise.tech` and `api.wise-sandbox.com`). Use the newer `wise-sandbox.com` domain.

### Data/Integration Notes
16. **Webhooks do not contain PII.** You must make a follow-up API call to get transfer details.
17. **Recipient requirements vary by currency.** Always call the account-requirements endpoint first.
18. **Sandbox accounts are isolated** from production -- no data sharing.

---

## Summary Comparison Table

| Criterion | Assessment | POC Suitability |
|-----------|------------|----------------|
| Sandbox access | Self-serve, free, instant | Excellent |
| Pre-funded balance | 1M GBP test credit | Excellent |
| FX quotes | Mid-market rate, 30-min lock | Excellent |
| Transfer simulation | Full lifecycle with simulation API | Excellent |
| Webhooks | Transfer state changes, works in sandbox | Excellent |
| Multi-currency accounts | 56 currencies, balance management | Excellent |
| ZAR support | Production yes; sandbox uncertain | Good (fallback to GBP/USD) |
| Rate limits | 500 RPM | More than sufficient |
| Node.js SDK | No official; community only | Moderate (write own client) |
| Documentation | Good docs + Postman collections | Good |
| Authentication complexity | Bearer token for sandbox | Simple for POC |

---

## Recommended Next Steps

1. **Register sandbox account** at https://sandbox.transferwise.tech/register
2. **Import Postman collection** from Wise public workspace to explore endpoints interactively
3. **Build thin Node.js REST wrapper** around the 6-8 endpoints needed for the POC flow
4. **Test GBP->EUR or USD->GBP flow first** (most stable in sandbox), then try ZAR routes
5. **Set up webhook endpoint** (use ngrok or similar for local dev) to test transfer state tracking
6. **Implement the agentic flow:** rate check -> quote -> recipient -> transfer -> fund -> track

---

## Sources

- https://docs.wise.com/guides/developer/sandbox-and-production
- https://docs.wise.com/guides/developer
- https://docs.wise.com/guides/developer/auth-and-security
- https://docs.wise.com/api-reference/quote
- https://docs.wise.com/api-reference/rate
- https://docs.wise.com/api-reference/transfer
- https://docs.wise.com/api-reference/recipient
- https://docs.wise.com/api-reference/balance
- https://docs.wise.com/api-reference/webhook
- https://docs.wise.com/api-reference/simulation
- https://docs.wise.com/guides/product/send-money
- https://docs.wise.com/guides/product/send-money/quotes
- https://docs.wise.com/guides/product/send-money/tracking-transfers
- https://docs.wise.com/guides/developer/webhooks/event-types
- https://wise.com/help/articles/2958107/getting-started-with-the-api
- https://github.com/transferwise/api-docs
- https://github.com/transferwise/public-api-postman-collection
- https://www.postman.com/transferwise/workspace/transferwise-s-public-workspace/
- https://www.npmjs.com/package/transferwise
- https://github.com/13pass/wise-client
