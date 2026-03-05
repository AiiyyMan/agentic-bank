# Griffin Full API Surface Analysis

> Research date: 2026-03-03
> Sources: docs.griffin.com, github.com/griffinbank, updates.griffin.com
> API version: v0 (current)
> Base URL: https://api.griffin.com/v0

---

## Table of Contents

1. [API Overview & Architecture](#1-api-overview--architecture)
2. [Authentication & API Keys](#2-authentication--api-keys)
3. [Organizations](#3-organizations)
4. [Legal Persons (Customers)](#4-legal-persons-customers)
5. [Claims (Customer Data)](#5-claims-customer-data)
6. [Workflows](#6-workflows)
7. [Verifications (KYC/KYB)](#7-verifications-kyckyb)
8. [Decisions](#8-decisions)
9. [Companies House](#9-companies-house)
10. [Reliance Onboarding](#10-reliance-onboarding)
11. [Bank Accounts](#11-bank-accounts)
12. [Bank Products](#12-bank-products)
13. [Pooled Account Membership](#13-pooled-account-membership)
14. [Payments](#14-payments)
15. [Payment Submissions](#15-payment-submissions)
16. [Payment Admissions](#16-payment-admissions)
17. [Transactions](#17-transactions)
18. [Payees (Beneficiaries)](#18-payees-beneficiaries)
19. [Confirmation of Payee (CoP)](#19-confirmation-of-payee-cop)
20. [Webhooks & Events](#20-webhooks--events)
21. [Users, Memberships, Roles & Invitations](#21-users-memberships-roles--invitations)
22. [Message Signatures](#22-message-signatures)
23. [Connectivity](#23-connectivity)
24. [Sandbox vs Live](#24-sandbox-vs-live)
25. [MCP Server (12 Tools)](#25-mcp-server-12-tools)
26. [POC Relevance Assessment](#26-poc-relevance-assessment)
27. [What Griffin Stores vs What We Store](#27-what-griffin-stores-vs-what-we-store)

---

## 1. API Overview & Architecture

### Design Principles
- **RESTful** with resource-oriented URLs, JSON request/response bodies
- **Navigable**: API structured as a tree with organization at root. Start at `/v0/index` and follow hypermedia links in responses
- **Versioned**: Current version `v0` in URL prefix. 12 months migration window when new versions ship
- **Pagination**: Cursor-based with `page[size]`, `page[before]`, `page[after]` params
- **Filtering**: `filter[field][eq]=value`, `filter[field][in][]=value` patterns
- **Sorting**: `sort=-created-at` (prefix `-` for descending)
- **Include**: `include=` param to embed related resources in responses

### Rate Limits
- **50 concurrent in-flight requests** per organization (429 if exceeded)
- **3 concurrent payment submission requests** per bank account
- Backoff and request tracking recommended

### Request Headers (all requests)
```
Authorization: GriffinAPIKey $GRIFFIN_API_KEY
Content-Type: application/json
Accept: application/json
```

---

## 2. Authentication & API Keys

### How Auth Works
- API keys created via dashboard (Settings > API keys)
- Key shown **once** at creation -- store securely or regenerate
- Passed in `Authorization: GriffinAPIKey <secret>` header
- Access level determined by user's role in the organization
- **Message signatures** required in live (optional in sandbox) for request integrity

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v0/api-keys/{api-key-id}` | Get a specific API key's metadata |
| `DELETE` | `/v0/api-keys/{api-key-id}` | Revoke/delete an API key |
| `GET` | `/v0/organizations/{org-id}/api-keys` | List all API keys for organization |
| `POST` | `/v0/organizations/{org-id}/api-keys` | Create a new API key |
| `GET` | `/v0/users/{user-id}/api-keys` | List API keys for a specific user |

### Key Response Fields
- `api-key-url`, `api-key-name`, `api-key-secret` (only on creation)
- `created-at`, `api-key-live?` (boolean)

### POC Relevance: MEDIUM
We need API keys for integration but won't manage them programmatically in the POC. Dashboard creation is sufficient.

---

## 3. Organizations

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v0/index` | Navigation root -- returns `organization-url` and all top-level URLs |
| `GET` | `/v0/organizations/{org-id}` | Get organization details |

### Key Response Fields from Index
```json
{
  "organizations-url": "/v0/organizations",
  "users-url": "/v0/users",
  "roles-url": "/v0/roles",
  "session-url": "/v0/session",
  "api-key-url": "/v0/api-keys/ak.xxx"
}
```

### Key Response Fields from Organization
- `organization-url`, `display-name`
- `organization-bank-accounts-url` -- for creating accounts
- `organization-legal-persons-url` -- for creating customers
- `organization-events-url` -- for listing events
- `organization-webhooks-url` -- for webhook management
- `organization-workflows-url` -- for verification workflows
- `organization-payments-url` -- for payment listing
- `organization-invitations-url`
- `organization-api-keys-url`
- `organization-mode`: `"test-mode"` or `"live-mode"`
- `own-legal-person-url` -- your organization's legal person

### POC Relevance: HIGH
The organization is our root resource. We need to fetch it once at startup to discover all sub-resource URLs.

---

## 4. Legal Persons (Customers)

In Griffin, **both your organization and your customers** are represented as legal persons. Types:
- `individual` -- a human person
- `corporation` -- any non-human entity (company, trust, etc.)

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v0/organizations/{org-id}/legal-persons` | Create a new legal person (customer) |
| `GET` | `/v0/organizations/{org-id}/legal-persons` | List legal persons (paginated) |
| `POST` | `/v0/organizations/{org-id}/legal-persons/search` | Search legal persons with filters |
| `GET` | `/v0/legal-persons/{lp-id}` | Get legal person details |
| `PUT` | `/v0/legal-persons/{lp-id}` | Update legal person |
| `GET` | `/v0/legal-persons/{lp-id}/history` | List history events for a legal person |

### Create Legal Person Request
```json
{
  "display-name": "Henry Davis",
  "legal-person-type": "individual",
  "claims": [
    {
      "claim-type": "individual-identity",
      "date-of-birth": "1990-01-15",
      "given-name": "Henry",
      "surname": "Davis"
    },
    {
      "claim-type": "contact-details",
      "email-address": "henry@example.com"
    },
    {
      "claim-type": "individual-residence",
      "address-line-1": "123 Example St",
      "city": "London",
      "postal-code": "E1 1AA",
      "country-code": "GB"
    },
    {
      "claim-type": "mobile-number",
      "mobile-number": "+447700900000"
    }
  ]
}
```

### Key Claim Types (Individual)
| Claim Type | Data Captured |
|------------|--------------|
| `individual-identity` | Full name, date of birth |
| `contact-details` | Email address |
| `individual-residence` | Address |
| `mobile-number` | Phone number |
| `employment` | Employer, job title |
| `individual-income` | Annual income |
| `individual-purposes-of-account` | Account usage, fund sources, deposit amounts |
| `tax-residency` | Tax residency country, tax ID |

### Key Claim Types (Corporation)
| Claim Type | Data Captured |
|------------|--------------|
| `uk-company-register` | Company number, registration |
| `corporation-identity` | Business name, incorporation date |
| `corporation-contact` | Company contact details |

### Key Response Fields
- `legal-person-url`, `legal-person-type`
- `display-name`, `application-status`
- `latest-decision` (with `decision-outcome`: `"accepted"` or `"rejected"`)
- `legal-person-verifications-url`
- `legal-person-claims-url`
- `legal-person-bank-payees-url`
- `legal-person-decisions-url`

### POC Relevance: HIGH
Core to customer onboarding. Every banking customer must be created as a legal person first.

---

## 5. Claims (Customer Data)

Claims are **unverified data points** attached to a legal person. They become verified when used in an accepted verification.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v0/legal-persons/{lp-id}/claims` | Create/submit claims |
| `GET` | `/v0/legal-persons/{lp-id}/claims` | List claims (filterable by verification-status) |
| `DELETE` | `/v0/claims/{claim-id}` | Delete a claim (e.g., remove a director) |

### Filtering
```
GET /v0/legal-persons/{lp-id}/claims?filter[verification-status][eq]=unverified
```

### Key Fields
- `claim-type`, claim-specific data fields
- `verification-status`: `"verified"` or `"unverified"`

### POC Relevance: MEDIUM
Needed for customer data updates post-onboarding. Claims can be re-submitted independently and re-verified.

---

## 6. Workflows

Workflows define the set of checks to run during verification. Different workflow types for different customer types.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v0/organizations/{org-id}/workflows` | List organization workflows |
| `GET` | `/v0/workflows/{wf-id}` | Get specific workflow details |

### Key Response Fields
- `workflow-url`, `workflow-name`
- `required-claim-types` -- what data the workflow needs
- `legal-person-type` -- `"individual"` or `"corporation"`

### Example Workflows
- "Individual - Account Owners"
- "Corporation - Limited Company"
- "Reliance LTD Company"

### POC Relevance: HIGH
Must fetch workflow URL before running verification. Cache workflow IDs at startup.

---

## 7. Verifications (KYC/KYB)

Griffin's **Verify** product runs KYC/KYB checks including identity verification (via Veriff), PEP/sanctions screening, and anti-fraud checks.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v0/legal-persons/{lp-id}/verifications` | Start verification against a legal person |
| `GET` | `/v0/legal-persons/{lp-id}/verifications` | List verifications for a legal person |
| `GET` | `/v0/verifications/{vn-id}` | Get verification status |
| `GET` | `/v0/verifications/{vn-id}/profiles` | Get verification profiles |
| `GET` | `/v0/verifications/{vn-id}/resources` | Get ID&V check links (Veriff URLs) |

### Create Verification Request
```json
{
  "workflow-url": "/v0/workflows/wf.xxx"
}
```

### Verification Status Lifecycle
```
pending -> in-progress -> checks-complete | checks-declined | errored
```

### ID&V Flow (for individuals)
1. Submit verification with workflow URL
2. Get resources to obtain `idv-check-url` (Veriff link)
3. Customer completes selfie + ID photo on Veriff
4. Poll verification or listen for webhook events
5. Check `application-status` on legal person for final decision

### ID&V Re-use
- **Within 30 days**: Previous selfie/ID reused automatically
- **After 30 days**: Customer must redo ID&V

### Supported Jurisdictions
UK, EU, UAE, Hong Kong, Australia, Singapore, USA, Malaysia

### Onboarding Models
| Model | Who Runs CDD | Griffin's Role | Eligibility |
|-------|-------------|---------------|-------------|
| **Verify** | Griffin | Full KYC + manual review | Regulated & unregulated |
| **Reliance** | You (regulated firm) | PEP/sanctions only | Regulated only |
| **Outsourced** | You or partner | Data presence validation | Regulated & unregulated (3yr+) |

### POC Relevance: HIGH
Core KYC flow. Every customer must be verified before they can hold accounts. Verify is the recommended model for our POC.

---

## 8. Decisions

Decisions record the outcome of verification for a legal person.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v0/legal-persons/{lp-id}/decisions` | List all decisions for a legal person |
| `POST` | `/v0/legal-persons/{lp-id}/decisions` | Create a decision (manual decision) |

### Key Response Fields
- `decision-outcome`: `"accepted"` or `"rejected"`
- `decision-maker` -- who/what made the decision
- `created-at`

### POC Relevance: MEDIUM
Useful for checking onboarding outcomes programmatically.

---

## 9. Companies House

Lookup UK company details directly from Companies House registry.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v0/companies-house/companies/{company-number}` | Look up a UK company |

### Key Response Fields
- Company name, status, type
- Registered office address
- Directors, PSCs (persons with significant control)
- Incorporation date

### POC Relevance: MEDIUM
Useful for auto-populating company details during business customer onboarding.

---

## 10. Reliance Onboarding

For regulated firms that conduct their own CDD and attest results to Griffin.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v0/organizations/{org-id}/onboarding/applications` | Create onboarding application |
| `GET` | `/v0/onboarding/applications/{oa-id}` | Get application status |

### Application Status Lifecycle
```
submitted -> processing -> complete (accepted/declined) | errored
```

### POC Relevance: LOW
We will use Verify, not Reliance, for our POC.

---

## 11. Bank Accounts

### Account Types

| Type | `bank-product-type` | Purpose | FSCS Protected |
|------|---------------------|---------|----------------|
| **Operational** | `operational-account` | Your organization's own funds | No |
| **Safeguarding** | `safeguarding-account` | EMI/PI customer funds (regulatory) | No |
| **Client Money** | `client-money-account` | Investment/legal customer funds | No |
| **Embedded** | `embedded-account` | End-user banking (all-purpose) | Yes (up to £120k) |
| **Easy Access Savings** | `savings-account` | Customer savings with interest | Yes (up to £120k) |
| **Bare Trust** | `savings-account` (bare-trust) | Pooled savings | Yes |

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v0/organizations/{org-id}/bank/accounts` | Open a bank account |
| `GET` | `/v0/organizations/{org-id}/bank/accounts` | List bank accounts (paginated) |
| `POST` | `/v0/organizations/{org-id}/bank/accounts/search` | Search bank accounts |
| `GET` | `/v0/bank/accounts/{ba-id}` | Get bank account details |
| `PATCH` | `/v0/bank/accounts/{ba-id}` | Update bank account (e.g., display name) |
| `POST` | `/v0/bank/accounts/{ba-id}/actions/close` | Close a bank account |

### Open Account Request (Operational)
```json
{
  "bank-product-type": "operational-account",
  "display-name": "Acme Ltd Expenses"
}
```

### Open Account Request (Embedded - for customer)
```json
{
  "bank-product-type": "embedded-account",
  "owner-url": "/v0/legal-persons/lp.xxx"
}
```

### Open Account Request (Safeguarding - dedicated)
```json
{
  "bank-product-type": "safeguarding-account",
  "pooled-funds": false,
  "beneficiary-url": "/v0/legal-persons/lp.xxx"
}
```

### Account Status Lifecycle
```
opening -> open -> closing -> closed
```
Strictly linear, irreversible.

| Action | Opening | Open | Closing | Closed |
|--------|---------|------|---------|--------|
| Receive payments | No | Yes | No | No |
| Make payments | No | Yes | Yes | No |
| Transfer money | No | Yes | Yes | No |
| Earn interest | No | Yes | No | No |

### Key Response Fields
- `account-url`, `account-status` (`opening`/`open`/`closing`/`closed`)
- `display-name`, `bank-product-type`
- `account-balance`, `available-balance` (both `{currency, value}`)
- `bank-addresses` -- contains sort code + account number
- `account-transactions-url` -- for listing transactions
- `account-payments-url` -- for creating payments
- `account-admissions-url` -- for inbound payments
- `account-submissions-url` -- for outbound payment submissions
- `close-account-url` -- for closing
- `owner-url`, `beneficiary-url` (where applicable)
- `pooled-funds` (boolean, for safeguarding/client money)

### Close Account Errors (HTTP 422)
- `account-not-found`
- `account-already-closing` / `account-already-closed`
- `account-not-open`
- `primary-account-not-closeable`

### Dedicated vs Pooled Accounts
| Aspect | Dedicated | Pooled |
|--------|-----------|--------|
| Account per customer | Yes (unique sort code/account number) | No (single shared account) |
| Balance tracking | Griffin tracks per-account | You must track per-customer |
| Transaction history | Per-account via API | Shared, you must allocate |
| Reconciliation | Simple | Manual |
| Best for | Simplicity, risk reduction | Established firms with ledger tech |

### Primary Account
- Automatically created when your org is set up
- Cannot be closed
- Used for: Griffin billing, commission deposits, safeguarding interest payments

### POC Relevance: HIGH
Core banking functionality. We need operational accounts for the platform and embedded/safeguarding accounts for customers.

---

## 12. Bank Products

Bank products define the templates/configurations for account types.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v0/organizations/{org-id}/bank/products` | List available bank products |
| `GET` | `/v0/bank/products/{bp-id}` | Get bank product details |
| `POST` | `/v0/bank/products/{bp-id}/accounts` | Open account with specific product |

### POC Relevance: LOW-MEDIUM
Alternative path to opening accounts via product reference rather than `bank-product-type` string.

---

## 13. Pooled Account Membership

For pooled accounts (safeguarding or client money), members must be explicitly managed.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v0/bank/accounts/{ba-id}/membership` | List pool members |
| `POST` | `/v0/bank/accounts/{ba-id}/membership-updates` | Add/remove members |

### Manage Members Request
```json
{
  "additions": ["/v0/legal-persons/lp.xxx"],
  "deletions": ["/v0/legal-persons/lp.yyy"]
}
```

### Regulatory Requirements
- Only `compliance` role can manage members
- Membership must be confirmed every 24 hours (even if no changes: send empty additions/deletions)
- A pooled account with **no members cannot receive payments**

### POC Relevance: LOW
Only relevant if we use pooled accounts. Dedicated accounts are simpler for POC.

---

## 14. Payments

Payments are the core money movement resource. Griffin supports two payment schemes:
- **`fps`** (Faster Payments) -- external UK domestic payments
- **`book-transfer`** -- internal transfers between Griffin accounts in the same organization

From July 2025, you must specify the scheme explicitly.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v0/bank/accounts/{ba-id}/payments` | Create a payment (outbound) |
| `GET` | `/v0/bank/accounts/{ba-id}/payments` | List payments for an account |
| `GET` | `/v0/organizations/{org-id}/payments` | List all payments in org |
| `POST` | `/v0/organizations/{org-id}/payments/search` | Search payments with filters |
| `GET` | `/v0/payments/{pm-id}` | Get payment details |
| `PATCH` | `/v0/payments/{pm-id}` | Update payment metadata |

### Create Payment Request
```json
{
  "creditor": {
    "creditor-type": "uk-domestic",
    "account-number": "35890906",
    "account-number-code": "bban",
    "bank-id": "000000",
    "bank-id-code": "gbdsc",
    "account-holder": "John Doe"
  },
  "payment-amount": {
    "currency": "GBP",
    "value": 20.00
  },
  "payment-reference": "Invoice 123"
}
```

### Creditor Types
| Type | Description | Key Fields |
|------|-------------|------------|
| `uk-domestic` (SCAN) | External UK bank account | `account-number`, `bank-id`, `account-holder` |
| `payee` | Pre-registered payee | `payee-url` |
| `griffin-bank-account` | Another Griffin account | `account-url` |

### Payment Response Fields
- `payment-url`, `payment-direction` (`outbound-payment`/`inbound-payment`)
- `payment-amount`, `creditor`, `debtor`
- `payment-reference`
- `payment-submissions-url` -- use to submit payment
- `payment-admissions-url` -- for inbound payment tracking

### Payment Error Codes (HTTP 422)
| Error Code | Meaning |
|------------|---------|
| `account-restricted` | Account has restrictions preventing payments |
| `payee-not-active` | Payee is not active |
| `same-debtor-and-beneficiary` | Cannot pay yourself |
| `mixed-currencies` | Currency mismatch |
| `mixed-organizations` | Cross-org payment not allowed for this type |
| `payment-amount-exceeds-scheme-limit` | Amount exceeds scheme maximum |
| `bank-account-closed` | Source account is closed |
| `insufficient-funds` | Not enough money |
| `payee-deactivated` | Payee has been deactivated |
| `no-postal-address` | Debtor address not registered |
| `profile-not-found` | Debtor info not registered |
| `cop-required` | Confirmation of Payee check needed first |

### POC Relevance: HIGH
Core payment functionality. We need to create and manage payments.

---

## 15. Payment Submissions

A submission represents the actual sending of an outbound payment through a scheme.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v0/payments/{pm-id}/submissions` | Submit a payment for processing |
| `GET` | `/v0/payments/{pm-id}/submissions` | List submissions for a payment |
| `GET` | `/v0/submissions/{ps-id}` | Get submission status |
| `GET` | `/v0/bank/accounts/{ba-id}/submissions` | List submissions for an account |

### Submit Payment Request
```json
{
  "payment-scheme": "fps"
}
```
or
```json
{
  "payment-scheme": "book-transfer"
}
```

### Submission Status Lifecycle
```
processing -> delivered | failed
              |
              scheduled -> processing -> delivered | failed
```

| Status | Meaning |
|--------|---------|
| `processing` | Payment is being processed |
| `scheduled` | Future-dated or withdrawal-schedule delayed |
| `delivered` | Successfully processed, funds confirmed debited |
| `failed` | Payment unsuccessful; funds credited back if debited |

### Key Response Fields
- `submission-url`, `submission-status`
- `submission-scheme-information` (contains `end-to-end-identification`)
- `scheduled-at` (if scheduled)

### POC Relevance: HIGH
Every outbound payment requires a submission. Track status via polling or webhooks.

---

## 16. Payment Admissions

An admission represents the receiving side of an inbound payment.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v0/admissions/{pa-id}` | Get admission details |
| `GET` | `/v0/bank/accounts/{ba-id}/admissions` | List admissions for an account |
| `GET` | `/v0/payments/{pm-id}/admissions` | List admissions for a payment |

### Admission Status Lifecycle
```
processing -> delivered | rejected | returned
```

### Key Response Fields
- `admission-url`, `admission-status`
- `admission-scheme-information`
- `payment-url`

### POC Relevance: HIGH
Needed to track inbound payments. Use webhooks for real-time notification.

---

## 17. Transactions

Transactions are the immutable ledger entries representing actual money movement.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v0/bank/accounts/{ba-id}/transactions` | List transactions for an account |
| `GET` | `/v0/bank/transactions/{tr-id}` | Get transaction details |

### Key Response Fields
- `transaction-url`, `account-url`
- `balance-change`: `{currency, value}`
- `balance-change-direction`: `"debit"` or `"credit"`
- `post-datetime` -- when the transaction was posted
- `processed-at`
- Related payment/submission/admission URLs

### Filtering & Sorting
- Sort by `post-datetime` or `processed-at`
- Filter by date ranges, direction, etc.

### POC Relevance: HIGH
Core to displaying account activity, balances, and transaction history.

---

## 18. Payees (Beneficiaries)

Payees store reusable payment recipient details, associated with a legal person (shared across all accounts under that legal person).

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v0/legal-persons/{lp-id}/bank/payees` | Create a payee |
| `GET` | `/v0/legal-persons/{lp-id}/bank/payees` | List payees for a legal person |
| `GET` | `/v0/payees/{pe-id}` | Get payee details |
| `PATCH` | `/v0/payees/{pe-id}` | Update payee |

### Create Payee Request
```json
{
  "account-holder": "John Doe",
  "account-number": "35890906",
  "bank-id": "000000"
}
```

With Confirmation of Payee reference:
```json
{
  "account-holder": "John Doe",
  "account-number": "35890906",
  "bank-id": "000000",
  "cop-request-url": "/v0/cop-request/cp.xxx"
}
```

### Key Response Fields
- `payee-url`, `payee-status` (`active`/`deactivated`)
- `account-holder`, `account-number`, `bank-id`
- `country-code` (always `"GB"`)

### POC Relevance: HIGH
Payees are the recommended way to manage recurring payment recipients. Create once, reference by URL in payments.

---

## 19. Confirmation of Payee (CoP)

CoP validates that payment details match the receiving bank's records before sending money (UK regulatory requirement).

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v0/organizations/{org-id}/cop-request` | Create a CoP check |
| `GET` | `/v0/cop-request/{cp-id}` | Get CoP result |
| `POST` | `/v0/simulation/organizations/{org-id}/cop-request/simulate/{type}` | **[Sandbox Alpha]** Simulate CoP outcomes |

### CoP Request
```json
{
  "account-number": "12345678",
  "bank-id": "123456",
  "account-classification": "personal",
  "name": "John Smith",
  "secondary-reference-data": "12345678910",
  "requester-legal-person-url": "/v0/legal-persons/lp.xxx"
}
```

### CoP Results
| Result | Status | Meaning |
|--------|--------|---------|
| `match` | `verified` | All details match |
| `close-match` | `unverified` | Name/type slightly different |
| `no-match` | `unverified` | Details don't match |
| `account-not-found` | Error (400) | Account doesn't exist |
| `verification-unavailable` | Error (503) | Service outage |

### Close Match Reasons
- `close-match-name` -- name variation
- `close-match-name-business-personal` -- wrong account type
- `match-name-business-personal` -- name matches but type wrong

### No Match Reasons
- `no-match-name` -- name doesn't match
- `no-match-secondary-ref` -- secondary reference wrong
- `account-not-supported` -- receiving firm unsupported
- `account-switched` -- account moved to different provider

### Simulation Types (Sandbox)
Endpoint: `/v0/simulation/organizations/{org-id}/cop-request/simulate/{cop-simulation-type}`
Available types: `match`, `close-match`, `no-match`, `account-switched`, `account-not-found`, `verification-unavailable`

Non-simulated sandbox requests default to `match`.

### POC Relevance: HIGH
Required before creating payees for FPS payments. Important for payment safety.

---

## 20. Webhooks & Events

### Webhook Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v0/organizations/{org-id}/webhooks` | Create a webhook |
| `GET` | `/v0/organizations/{org-id}/webhooks` | List webhooks |
| `GET` | `/v0/webhooks/{wh-id}` | Get webhook details |
| `PATCH` | `/v0/webhooks/{wh-id}` | Update webhook |
| `DELETE` | `/v0/webhooks/{wh-id}` | Delete webhook |
| `POST` | `/v0/webhooks/{wh-id}/actions/activate` | Activate webhook |
| `POST` | `/v0/webhooks/{wh-id}/actions/deactivate` | Deactivate webhook |
| `POST` | `/v0/webhooks/{wh-id}/actions/test` | Send test event |
| `GET` | `/v0/webhooks/{wh-id}/actions/test` | Get test event status |

### Event Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v0/events/{ev-id}` | Get a specific event |
| `GET` | `/v0/organizations/{org-id}/events` | List all org events |

### Webhook Constraints
- **Only one webhook per organization** -- receives ALL events
- HTTPS destination required
- At-least-once delivery (duplicates possible)
- Event ordering NOT guaranteed
- Signatures used for validation (RFC 9421)

### Known Event Types
| Event Type | Trigger |
|------------|---------|
| `test-event` | Manual test webhook |
| `transaction-created` | Funds deposited/withdrawn |
| `submission-created` | Payment submission initiated |
| `submission-updated` | Submission status changed |
| `admission-created` | Inbound payment processing started |
| `admission-updated` | Admission status changed |
| `payment-created` | Payment resource created |
| `account-status-created` | Account created |
| `account-status-updated` | Account status changed |
| `onboarding-application-updated` | Onboarding status changed |
| `verification-resource-created` | ID&V link available |
| `verification-resource-updated` | ID&V status changed |

### Event Payload Example
```json
{
  "event-type": "transaction-created",
  "event-url": "/v0/events/ev.xxx",
  "event-payload": {
    "account-url": "/v0/bank/accounts/ba.xxx",
    "balance-change": {
      "currency": "GBP",
      "value": "20.00"
    },
    "balance-change-direction": "debit",
    "post-datetime": "2023-11-22T17:10:42.223Z"
  }
}
```

### Create Webhook Request
```json
{
  "webhook-destination-url": "https://your-app.com/webhooks/griffin",
  "webhook-description": "Main production webhook"
}
```

### POC Relevance: HIGH
Webhooks are essential for real-time payment tracking, account status monitoring, and KYC flow completion. The single-webhook-per-org model simplifies our setup.

---

## 21. Users, Memberships, Roles & Invitations

### User Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v0/users/{user-id}` | Get user details |
| `GET` | `/v0/users/{user-id}/memberships` | List user's org memberships |
| `GET` | `/v0/users/{user-id}/api-keys` | List user's API keys |

### Membership Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v0/memberships/{mp-id}` | Get membership details |
| `DELETE` | `/v0/memberships/{mp-id}` | Delete membership (remove from org) |
| `GET` | `/v0/organizations/{org-id}/memberships` | List org memberships |

### Role Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v0/roles` | List all available roles |
| `GET` | `/v0/roles/{role-id}` | Get role details |
| `GET` | `/v0/memberships/{mp-id}/roles` | List roles for a membership |
| `PUT` | `/v0/memberships/{mp-id}/roles` | Update roles for a membership |

### Invitation Endpoint

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v0/organizations/{org-id}/invitations` | Invite a user to the org |

### Known Roles
- **Team member** -- default, no access until upgraded
- **Team admin** -- can manage team, invitations
- **Compliance** -- can manage pooled account members, reliance onboarding

### POC Relevance: LOW
Team management is handled via dashboard for our POC. Programmatic role management not needed initially.

---

## 22. Message Signatures

HTTP message signatures for request integrity and authenticity verification.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v0/security/message-signature/verify` | Verify a message signature |

Also: JWKS public keys at `https://api.griffin.com/v0/security/public-keys`

### Requirements
- **Required in live mode**, optional in sandbox
- Uses RFC 9421 HTTP Message Signatures
- Public/private key pair cryptography
- Key rotation supported via multiple signatures

### POC Relevance: LOW (sandbox), MEDIUM (live)
Not needed for POC in sandbox. Required for production deployment.

---

## 23. Connectivity

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v0/ping` | Health check / connectivity test |
| `GET` | `/v0/index` | API navigation root |
| `GET` | `/v0/session` | Current session info |

### POC Relevance: LOW
Useful for health checks and initial setup only.

---

## 24. Sandbox vs Live

### Key Differences

| Feature | Sandbox | Live |
|---------|---------|------|
| **Cost** | Free, no fees | Paid |
| **Payments** | Not sent to real schemes; always succeed | Real schemes; can be rejected |
| **Onboarding checks** | Simulated (no real ID&V) | Real third-party verification |
| **Account numbers** | Simulated; unreachable by schemes | Real; scheme-accessible |
| **Interest** | Not available | Paid on balances |
| **Test money** | £1,000,000 auto-credited per account | Real funds only |
| **Message signatures** | Optional | Required |
| **Data** | Test data only | Real customer data |
| **NDA** | Not required | Required |

### Simulation Endpoints (Sandbox Only)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v0/simulation/organizations/{org-id}/cop-request/simulate/{type}` | Simulate CoP outcomes |

### Key Notes
- Sandbox and live are **separate organizations** -- resources do not transfer
- API keys, users, legal persons must be recreated for live
- Sandbox payments always succeed (useful for POC)
- Sandbox ID&V is mocked (no selfies/photos captured)

### POC Relevance: HIGH
We will build entirely in sandbox for the POC.

---

## 25. MCP Server (12 Tools)

Griffin provides an official MCP server (beta) for AI agent integration.

### Available Tools
| Tool | Maps to API |
|------|-------------|
| `create-and-submit-payment` | POST payments + POST submissions |
| `open-operational-account` | POST bank/accounts |
| `close-bank-account` | POST close action |
| `list-bank-accounts` | GET bank/accounts |
| `list-legal-persons` | GET legal-persons |
| `list-payments` | GET payments |
| `list-payees` | GET payees |
| `get-bank-account` | GET bank/accounts/{id} |
| `get-legal-person` | GET legal-persons/{id} |
| `get-payment` | GET payments/{id} |
| `get-payee` | GET payees/{id} |
| `list-transactions` | GET transactions |

### What MCP Does NOT Cover (API gaps for our POC)
The MCP server only exposes 12 of the ~80+ API operations. Notable missing capabilities:

1. **Customer onboarding** -- no create-legal-person, no claims, no verifications
2. **KYC/KYB flows** -- no workflow lookup, no verification, no ID&V
3. **Payee management** -- no create-payee, no update-payee
4. **CoP checks** -- no confirmation of payee
5. **Webhook management** -- no create/manage webhooks
6. **Events** -- no event listing
7. **Search** -- no search endpoints
8. **Account details** -- no update account, no embedded/safeguarding account creation
9. **Pooled membership** -- no member management
10. **Transactions detail** -- no get individual transaction

### POC Relevance: HIGH
The MCP server is our starting point, but we need to build additional tools for the full agentic experience.

---

## 26. POC Relevance Assessment

### Tier 1: Must Have for POC

| Domain | Key Endpoints | Why |
|--------|--------------|-----|
| Organizations | GET index, GET org | Bootstrap all resource URLs |
| Legal Persons | CRUD + search | Customer creation and management |
| Claims | POST claims | Customer data submission |
| Workflows | GET list | Required before verification |
| Verifications | POST verify, GET status | KYC/KYB compliance |
| Bank Accounts | Open, list, get, close | Core banking |
| Payments | Create + submit | Money movement |
| Submissions | POST submit, GET status | Payment execution |
| Admissions | GET status | Inbound payment tracking |
| Transactions | List, get | Account activity |
| Payees | Create, list, get | Payment recipients |
| CoP | Create check | Payment safety |
| Webhooks | Create, test | Real-time notifications |
| Events | List | Event history |

### Tier 2: Nice to Have

| Domain | Key Endpoints | Why |
|--------|--------------|-----|
| Companies House | GET lookup | Auto-populate company info |
| Decisions | List, create | Manual KYC decisions |
| Bank Products | List | Account configuration options |
| Message Signatures | Verify | Production security |

### Tier 3: Not Needed for POC

| Domain | Why Not |
|--------|---------|
| Reliance Onboarding | Using Verify model |
| Users/Memberships/Roles | Dashboard management |
| Invitations | Dashboard management |
| Pooled Membership | Using dedicated accounts |

---

## 27. What Griffin Stores vs What We Store

### Griffin Stores (System of Record)
- Legal person identity (names, DOB, addresses, tax info)
- KYC/KYB verification status and decisions
- Bank account details (sort code, account number, balances)
- Transaction history (immutable ledger)
- Payment records and status
- Payee details
- Webhook configurations
- API key metadata
- Companies House lookup cache
- CoP check results

### We Must Store
- **User-to-legal-person mapping** -- linking our app users to Griffin legal persons
- **Session/auth state** -- our application's user sessions
- **Business logic** -- rules for when to initiate payments, approval workflows
- **UI state** -- user preferences, notification preferences
- **Pooled account ledger** (if using pooled accounts) -- per-customer balance tracking
- **Audit logs** -- our application-level audit trail
- **Webhook processing state** -- idempotency keys for webhook deduplication
- **Payment intent** -- pre-payment business context (invoices, orders, etc.)

### Griffin Does NOT Store
- Your application's user accounts
- Business logic or approval workflows
- Invoice/order data
- Customer communication preferences
- Application-level permissions beyond API roles

---

## Complete Endpoint Count

**Total unique endpoint paths: ~80+**

| Domain | Endpoint Count |
|--------|---------------|
| API Keys | 5 |
| Connectivity/Navigation | 3 |
| Events | 2 |
| Webhooks | 9 |
| Message Signatures | 2+ |
| Legal Persons | 6 |
| Claims | 3 |
| Workflows | 2 |
| Verifications | 5 |
| Decisions | 2 |
| Companies House | 1 |
| Reliance Onboarding | 2 |
| Bank Accounts | 6 |
| Bank Products | 3 |
| Pooled Membership | 2 |
| Payments | 6 |
| Submissions | 4 |
| Admissions | 3 |
| Transactions | 2 |
| Payees | 4 |
| CoP | 3 |
| Organizations | 2 (including index) |
| Users | 1 |
| Roles | 4 |
| Memberships | 4 |
| Invitations | 1 |
| **TOTAL** | **~80** |

vs **MCP Server: 12 tools** (covering ~15% of the API surface)

---

## Open Banking

Griffin supports Open Banking for operational accounts in live mode:
- Partnered with tell.money for API standards compliance
- Only regulated providers from UK Open Banking Directory
- Supports read-only access and payment initiation
- Users can grant/revoke third-party access via Griffin app
- **Not available in sandbox**

### POC Relevance: LOW
Not available in sandbox; not needed for initial POC.

---

## Payment Lifecycle Summary

### Outbound Payment (FPS or Book Transfer)
```
1. Create Payment        POST /bank/accounts/{id}/payments
   -> payment-url, payment-submissions-url

2. Submit Payment        POST /payments/{id}/submissions
   -> submission-url, submission-status: "processing"

3. Track Status          GET /submissions/{id}  OR  webhook events
   -> submission-status: "processing" -> "delivered" | "failed"
   -> (if savings: "scheduled" -> "processing" -> "delivered")

4. Transaction Created   (webhook: transaction-created)
   -> debit on sender account
```

### Inbound Payment
```
1. Payment Received      (webhook: payment-created)
   -> inbound payment resource created

2. Admission Created     (webhook: admission-created)
   -> admission-status: "processing"

3. Admission Updated     (webhook: admission-updated)
   -> admission-status: "delivered" | "rejected" | "returned"

4. Transaction Created   (webhook: transaction-created)
   -> credit on receiver account
```

### Credit Payment Recovery (CPR)
- Available for FPS/Bacs payments >= £25 within 36 months
- Inbound claims: recipient has 15 days to dispute
- Outbound claims: submit via support@griffin.com
- Up to 20 working days, no guarantee of recovery
