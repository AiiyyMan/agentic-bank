# Griffin Sandbox API Testing Results

**Date:** 2026-03-03
**Environment:** Sandbox (test-mode)
**Base URL:** `https://api.griffin.com`
**Auth header:** `Authorization: GriffinAPIKey g-test-...`
**API prefix:** `/v0/`

---

## 1. API Index (HATEOAS Entry Point)

**Request:** `GET /v0/index`

**Response (200):**
```json
{
  "organizations-url": "/v0/organizations",
  "users-url": "/v0/users",
  "roles-url": "/v0/roles",
  "api-key-url": "/v0/api-keys/ak.tKN5D7LWTSSlmmw9BaMWlw",
  "organization-url": "/v0/organizations/<org-id>"
}
```

**Key discovery:** The index provides direct URLs to the org, users, roles, and the API key. This is the HATEOAS root -- follow links from here to discover the full API surface.

**Note:** `GET /v0/organizations` returns 405 Method Not Allowed. You must use the specific org URL from the index.

---

## 2. Organization Details

**Request:** `GET /v0/organizations/<org-id>`

**Response (200):**
```json
{
  "display-name": "McKinsey & Company",
  "organization-mode": "test-mode",
  "organization-url": "/v0/organizations/<org-id>",
  "own-legal-person-url": "/v0/legal-persons/lp.9w9zpWASXumhQNnnm4lJsw",
  "can-decide-on-verifications?": true,
  "organization-events-url": "/v0/organizations/.../events",
  "organization-individuals-url": "/v0/organizations/.../individuals",
  "organization-corporations-url": "/v0/organizations/.../corporations",
  "organization-legal-persons-url": "/v0/organizations/.../legal-persons",
  "organization-legal-persons-search-url": "/v0/organizations/.../legal-persons/search",
  "organization-bank-accounts-url": "/v0/organizations/.../bank/accounts",
  "organization-bank-accounts-search-url": "/v0/organizations/.../bank/accounts/search",
  "organization-bank-account-products-url": "/v0/organizations/.../bank/products",
  "organization-payments-url": "/v0/organizations/.../payments",
  "organization-payments-search-url": "/v0/organizations/.../payments/search",
  "organization-memberships-url": "/v0/organizations/.../memberships",
  "organization-invitations-url": "/v0/organizations/.../invitations",
  "organization-onboarding-applications-url": "/v0/organizations/.../onboarding/applications",
  "organization-workflows-url": "/v0/organizations/.../workflows",
  "organization-webhooks-url": "/v0/organizations/.../webhooks",
  "organization-api-keys-url": "/v0/organizations/.../api-keys",
  "organization-live-access-url": "/v0/organizations/.../live-access",
  "available-roles": [
    { "display-name": "Approve payments", "role-category": "banking-and-accounts" },
    { "display-name": "Compliance viewer", "role-category": "compliance" },
    { "display-name": "Accounts and payments viewer", "role-category": "banking-and-accounts" },
    { "display-name": "Team admin", "role-category": "admin" },
    { "display-name": "Compliance admin", "role-category": "compliance" },
    { "display-name": "Request payments", "role-category": "banking-and-accounts" },
    { "display-name": "Manage accounts", "role-category": "banking-and-accounts" },
    { "display-name": "Approve own payments", "role-category": "banking-and-accounts" }
  ]
}
```

**Key IDs extracted:**
| Resource | ID |
|---|---|
| Organization | `<org-id>` |
| Org's own legal person | `lp.9w9zpWASXumhQNnnm4lJsw` |
| API key | `ak.tKN5D7LWTSSlmmw9BaMWlw` |
| API key owner (user) | `ur.cv5AhN8rSEO09GiRlTUgYQ` |

---

## 3. Bank Accounts

### List Accounts
**Request:** `GET /v0/organizations/{org-id}/bank/accounts`

**Response (200):** Initially 1 account (primary), then 2 after creating Alice's account.

**Primary account (pre-existing):**
```json
{
  "account-url": "/v0/bank/accounts/<primary-account-id>",
  "primary-account": true,
  "pooled-funds": false,
  "available-balance": { "currency": "GBP", "value": "1000000.00" },
  "account-balance": { "currency": "GBP", "value": "1000000.00" },
  "account-status": "open",
  "display-name": "Primary account",
  "bank-product-type": "operational-account",
  "bank-addresses": [{
    "account-holder": "Primary account",
    "bank-id": "000001",
    "bank-id-code": "gbdsc",
    "account-number": "00162887",
    "account-number-code": "bban"
  }],
  "owner-url": "/v0/legal-persons/lp.9w9zpWASXumhQNnnm4lJsw",
  "beneficiary-url": "/v0/legal-persons/lp.9w9zpWASXumhQNnnm4lJsw",
  "controller-url": "/v0/legal-persons/lp.9w9zpWASXumhQNnnm4lJsw",
  "account-transactions-url": "/v0/bank/accounts/.../transactions",
  "account-payments-url": "/v0/bank/accounts/.../payments",
  "account-admissions-url": "/v0/bank/accounts/.../admissions",
  "account-submissions-url": "/v0/bank/accounts/.../submissions"
}
```

### Open a Bank Account
**Request:** `POST /v0/organizations/{org-id}/bank/accounts`

**Required fields:**
- `bank-product-type` -- enum: `savings-account`, `client-money-account`, `safeguarding-account`, `embedded-account`, `operational-account`
- `owner-url` -- legal person URL
- `display-name` -- string

**Example (success):**
```json
// Request
{
  "bank-product-type": "embedded-account",
  "owner-url": "/v0/legal-persons/lp.r1VyiersSniy0qrfAgG28w",
  "display-name": "Alice Embedded Account"
}

// Response (200)
{
  "account-url": "/v0/bank/accounts/<test-account-id>",
  "account-status": "opening",
  "available-balance": { "currency": "GBP", "value": "0.00" },
  "account-balance": { "currency": "GBP", "value": "0.00" },
  "bank-addresses": [],
  "bank-product-type": "embedded-account",
  "close-account-url": "/v0/bank/accounts/.../actions/close"
}
```

**Sandbox behavior:** The account immediately transitions from `opening` to `open` status, gets assigned a sort code + account number, and is auto-funded with 1,000,000 GBP.

### Close a Bank Account
**Request:** `POST /v0/bank/accounts/{account-id}/actions/close`
**Body:** `{}`

**Response:** Returns the account object with `"account-status": "closing"`.

---

## 4. Legal Persons

### List Legal Persons
**Request:** `GET /v0/organizations/{org-id}/legal-persons`

**Response (200):**
```json
{
  "legal-persons": [
    {
      "display-name": "McKinsey & Company",
      "legal-person-type": "corporation",
      "legal-person-status": "onboarded",
      "application-status": "accepted"
    }
  ],
  "links": { "prev": null, "next": null },
  "meta": { "page": { "total": 1 } }
}
```

### Create a Legal Person (Individual)
**Request:** `POST /v0/organizations/{org-id}/legal-persons`

```json
// Request
{
  "display-name": "Test User Alice",
  "legal-person-type": "individual"
}

// Response (200)
{
  "legal-person-type": "individual",
  "display-name": "Test User Alice",
  "created-at": "2026-03-03T21:27:56.926Z",
  "legal-person-url": "/v0/legal-persons/lp.r1VyiersSniy0qrfAgG28w",
  "legal-person-bank-payees-url": "/v0/legal-persons/.../bank/payees",
  "legal-person-documents-url": "/v0/legal-persons/.../documents",
  "legal-person-claims-url": "/v0/legal-persons/.../claims",
  "legal-person-decisions-url": "/v0/legal-persons/.../decisions",
  "legal-person-verifications-url": "/v0/legal-persons/.../verifications"
}
```

**Note:** No `legal-person-status` field returned -- the person is created but not yet onboarded. They can still own bank accounts in sandbox without being onboarded.

### Legal Person Details (After Onboarding)
```json
{
  "legal-person-status": "onboarded",
  "legal-person-type": "individual",
  "display-name": "Bob Test Onboarding",
  "legal-name": "Bob Test",
  "application-status": "accepted",
  "latest-risk-rating-url": "/v0/risk-ratings/rr.rfc2bgRCQOK9-SbAenQJnQ",
  "latest-decision": {
    "decision-outcome": "accepted",
    "decision-maker": "system",
    "verification-url": "/v0/verifications/vn.pCdx7O05UXaCA-r9CMq0yQ"
  }
}
```

---

## 5. Payments

### Payment Flow
1. **Create payment** -- `POST /v0/bank/accounts/{account-id}/payments`
2. **Submit payment** -- `POST /v0/payments/{payment-id}/submissions`
3. Payment transitions through: `processing` -> `delivered`

### Create Payment (Internal -- Griffin-to-Griffin)
```json
// Request
{
  "creditor": {
    "creditor-type": "griffin-bank-account",
    "account-url": "/v0/bank/accounts/<test-account-id>"
  },
  "payment-amount": { "currency": "GBP", "value": "100.00" }
}

// Response (200) - Payment created
{
  "payment-url": "/v0/payments/pm.2A7qmQXVQmKUS_9DgtFQNw",
  "payment-direction": "outbound-payment",
  "payment-reference": "Sent from McKinsey & Company",
  "payment-amount": { "currency": "GBP", "value": "100.00" },
  "creditor": {
    "creditor-type": "uk-domestic",
    "account-holder": "Alice Embedded Account",
    "account-number": "00161304",
    "uk-domestic-sort-code": "000001"
  },
  "debtor": {
    "account-holder": "Primary account",
    "account-number": "00162887",
    "account-url": "/v0/bank/accounts/<primary-account-id>"
  },
  "created-via": "api",
  "created-by-user": {
    "user-email": "user@example.com",
    "given-name": "Jane",
    "surname": "Doe"
  },
  "payment-submissions-url": "/v0/payments/.../submissions"
}
```

### Submit Payment
```json
// Request: POST /v0/payments/{payment-id}/submissions
{ "payment-scheme": "fps" }

// Response (200)
{
  "submission-url": "/v0/submissions/ps.1VHNr7fGUpuvcFLW4el4Wg",
  "submission-status": "processing",
  "submission-scheme-information": {
    "payment-scheme": "fps",
    "end-to-end-identification": "MPFP35GFFFJ7NLSI7ENDLDZDPE"
  },
  "payment-url": "/v0/payments/pm.2A7qmQXVQmKUS_9DgtFQNw"
}
```

**Submission status progresses:** `processing` -> `delivered` (instant in sandbox).

### Creditor Types (for payment creation)
| creditor-type | Use case |
|---|---|
| `griffin-bank-account` | Transfer to another Griffin account (internal) |
| `payee` | Transfer to a pre-registered payee |
| `uk-domestic` | Direct UK domestic payment (sort code + account number) |

### Payment to External Payee
```json
{
  "creditor": {
    "creditor-type": "payee",
    "payee-url": "/v0/payees/pe.cl5B-S00QDKYn3EGVUKlLA"
  },
  "payment-amount": { "currency": "GBP", "value": "50.00" },
  "payment-reference": "Test external payment"
}
```

### Balance Verification After Payment
| Account | Before | After |
|---|---|---|
| Primary (debtor) | 1,000,000.00 GBP | 999,900.00 GBP |
| Alice (creditor) | 1,000,000.00 GBP | 1,000,100.00 GBP |

---

## 6. Transactions

**Request:** `GET /v0/bank/accounts/{account-id}/transactions`

```json
{
  "account-transactions": [
    {
      "account-transaction-url": "/v0/bank/transactions/tr.kRIljVmLXqGRpfhaFAtpqg",
      "balance-change": { "currency": "GBP", "value": "100.00" },
      "balance-change-direction": "debit",
      "account-balance": { "currency": "GBP", "value": "999900.00" },
      "transaction-origin-type": "payment",
      "effective-at": "2026-03-03T21:28:59.xxx",
      "processed-at": "2026-03-03T21:28:59.xxx"
    },
    {
      "balance-change": { "currency": "GBP", "value": "1000000.00" },
      "balance-change-direction": "credit",
      "transaction-origin-type": "deposit",
      "account-balance": { "currency": "GBP", "value": "1000000.00" }
    }
  ]
}
```

**Transaction origin types observed:** `deposit`, `payment`
**Balance change directions:** `credit`, `debit`

---

## 7. Bank Account Products

**Request:** `GET /v0/organizations/{org-id}/bank/products`

**10 products available:**

| Product | Class | Funding | Owner Type | Product URL ID |
|---|---|---|---|---|
| Bare trust savings | savings | pooled | corporation | `bp.<redacted>` |
| Pooled safeguarding | safeguarding | pooled | corporation | `bp.<redacted>` |
| Easy access savings business | savings | dedicated | corporation | `bp.<redacted>` |
| Easy access savings consumer | savings | dedicated | individual | `bp.<redacted>` |
| Embedded consumer | embedded | dedicated | individual | `bp.<redacted>` |
| Dedicated client money | client-money | dedicated | corporation | `bp.<redacted>` |
| Pooled client money | client-money | pooled | corporation | `bp.<redacted>` |
| Dedicated safeguarding | safeguarding | dedicated | corporation | `bp.<redacted>` |
| Operational | operational | dedicated | corporation | `bp.<redacted>` |
| Embedded business | embedded | dedicated | corporation | `bp.<redacted>` |

**For agentic banking (individual end-users):**
- `Embedded consumer` (<embedded-product-id>) -- most relevant, individual owner, instant access
- `Easy access savings consumer` (<savings-product-id>) -- individual owner, same/next-day notice

---

## 8. Workflows (Onboarding)

**Request:** `GET /v0/organizations/{org-id}/workflows`

**6 workflows available:**

| Workflow | Type | Legal Person Type | ID |
|---|---|---|---|
| Individual - Account Owners | Verify (full KYC) | individual | `wf.<redacted>` |
| LTD Company - Account Owners | Verify (full KYC) | corporation | `wf.<redacted>` |
| Reliance Individual - Account Owners | Reliance | individual | `wf.<redacted>` |
| Reliance Sole Trader - Account Owners | Reliance | individual | `wf.<redacted>` |
| Reliance LTD Company - Account Owners | Reliance | corporation | `wf.<redacted>` |
| Sole Trader - Account Owners | Verify (full KYC) | individual | `wf.<redacted>` |

### Reliance Individual Required Claims (minimum for onboarding):
- `individual-identity` (given-name, surname, date-of-birth)
- `individual-residence` (address fields)
- `tax-residencies` (array of country codes, e.g. `["GB"]`)
- `tax-identification-numbers-by-country` (`tins-by-country` object)
- `us-citizen` (`us-citizen?` boolean -- note the `?` in the field name)
- `reliance-verification` (methods + standard)
- `external-risk-rating` (enum: `low-risk`, `medium-risk`, `high-risk`, `prohibited-risk`)

### Full KYC Individual Required Claims (15 claims):
`contact-details`, `tax-residencies`, `mobile-number`, `individual-identity`, `nationality`, `individual-sources-of-funds`, `cash-payments`, `individual-purposes-of-account`, `tax-identification-numbers-by-country`, `us-citizen`, `employment`, `individual-income`, `individual-residence`, `initial-deposit`, `international-payments-countries`

---

## 9. Onboarding Applications

### Create Application (Reliance Workflow)
**Request:** `POST /v0/organizations/{org-id}/onboarding/applications`

```json
{
  "workflow-url": "/v0/workflows/<workflow-id>",
  "subject-profile": {
    "subject-profile-type": "individual",
    "display-name": "Bob Test Onboarding",
    "claims": [
      {
        "claim-type": "individual-identity",
        "given-name": "Bob",
        "surname": "Test",
        "date-of-birth": "1990-01-15"
      },
      {
        "claim-type": "individual-residence",
        "building-number": "10",
        "street-name": "Downing Street",
        "city": "London",
        "postal-code": "SW1A 2AA",
        "country-code": "GB"
      },
      {
        "claim-type": "tax-residencies",
        "tax-residencies": ["GB"]
      },
      {
        "claim-type": "tax-identification-numbers-by-country",
        "tins-by-country": {}
      },
      {
        "claim-type": "us-citizen",
        "us-citizen?": false
      },
      {
        "claim-type": "reliance-verification",
        "reliance-verification-methods": ["manual-document"],
        "reliance-verification-standard": "jmlsg"
      },
      {
        "claim-type": "external-risk-rating",
        "external-risk-rating": "low-risk"
      }
    ]
  }
}
```

**Response (200):**
```json
{
  "onboarding-application-url": "/v0/onboarding/applications/oa.BmmE3_HAXgul7CCfDCaqxg",
  "onboarding-application-status": "submitted"
}
```

**Sandbox behavior:** Immediately transitions to `complete` with `decision-outcome: "accepted"`. A legal person is auto-created with status `onboarded`.

### Get Application Details
```json
{
  "onboarding-application-status": "complete",
  "decision-outcome": "accepted",
  "legal-person-url": "/v0/legal-persons/lp.3TA0dhM9XwuPieJfPuwQBA",
  "verification-url": "/v0/verifications/vn.pCdx7O05UXaCA-r9CMq0yQ",
  "workflow-url": "/v0/workflows/<workflow-id>"
}
```

---

## 10. Payees (External Bank Accounts)

### Create Payee
**Request:** `POST /v0/legal-persons/{legal-person-id}/bank/payees`

```json
// Request
{
  "account-holder": "External Test Account",
  "account-number": "12345678",
  "bank-id": "040004"
}

// Response (200)
{
  "payee-url": "/v0/payees/pe.cl5B-S00QDKYn3EGVUKlLA",
  "payee-status": "active",
  "account-holder": "External Test Account",
  "account-number": "12345678",
  "bank-id": "040004",
  "country-code": "GB",
  "legal-person-url": "/v0/legal-persons/lp.9w9zpWASXumhQNnnm4lJsw"
}
```

---

## 11. Webhooks

### Create Webhook
**Request:** `POST /v0/organizations/{org-id}/webhooks`

```json
// Request
{
  "webhook-destination-url": "https://example.com/webhook",
  "webhook-description": "Test webhook"
}

// Response (200)
{
  "webhook-url": "/v0/webhooks/wh.7kcXC1R7SeesJre5UrCxXw",
  "webhook-state": "active",
  "webhook-destination-url": "https://example.com/webhook",
  "webhook-description": "Test webhook",
  "test-webhook-url": "/v0/webhooks/.../actions/test",
  "deactivate-webhook-url": "/v0/webhooks/.../actions/deactivate",
  "organization-url": "/v0/organizations/<org-id>"
}
```

---

## 12. Events

**Request:** `GET /v0/organizations/{org-id}/events`

Returns a stream of events for the organization. Event types observed:
- `payment-created` -- when a payment is created
- `transaction-created` -- when a transaction posts to an account
- `account-status-updated` -- when account status changes (e.g., opening -> open)

Events include full payload details. Useful for event-driven architectures.

---

## 13. Verifications

**Request:** `GET /v0/verifications/{verification-id}`

```json
{
  "verification-url": "/v0/verifications/vn.pCdx7O05UXaCA-r9CMq0yQ",
  "verification-status": "checks-complete",
  "risk-rating": "low-risk",
  "legal-person-url": "/v0/legal-persons/lp.3TA0dhM9XwuPieJfPuwQBA",
  "workflow-url": "/v0/workflows/<workflow-id>",
  "verification-resources-url": "/v0/verifications/.../resources",
  "verification-risk-assessments-url": "/v0/verifications/.../risk-assessments",
  "verification-profiles-url": "/v0/verifications/.../profiles",
  "verification-checks-url": "/v0/verifications/.../checks"
}
```

---

## 14. API Key Details

**Request:** `GET /v0/api-keys/{api-key-id}`

```json
{
  "api-key-name": "AgenticBank",
  "api-key-live?": false,
  "api-key-url": "/v0/api-keys/ak.tKN5D7LWTSSlmmw9BaMWlw",
  "organization-url": "/v0/organizations/<org-id>",
  "user-url": "/v0/users/ur.cv5AhN8rSEO09GiRlTUgYQ"
}
```

---

## 15. Roles

**Request:** `GET /v0/roles`

8 roles available, categorized as:
- **banking-and-accounts:** Approve payments, Accounts and payments viewer, Request payments, Manage accounts, Approve own payments
- **compliance:** Compliance viewer, Compliance admin
- **admin:** Team admin

---

## Key Findings & API Patterns

### Authentication
- Header: `Authorization: GriffinAPIKey {key}`
- Key prefix `g-test-` determines sandbox environment
- `api-key-live?` field confirms test vs. live

### HATEOAS Pattern
- Every response includes URL fields for related resources (e.g., `account-transactions-url`, `payment-submissions-url`)
- Follow links rather than constructing URLs manually
- Pagination uses `links.prev` / `links.next` (null when no more pages)
- Collection responses include `meta.page.total` for total count

### ID Format
All IDs use a two-letter prefix indicating resource type:
| Prefix | Resource |
|---|---|
| `og.` | Organization |
| `lp.` | Legal Person |
| `ba.` | Bank Account |
| `bp.` | Bank Product |
| `pm.` | Payment |
| `ps.` | Payment Submission |
| `tr.` | Transaction |
| `pe.` | Payee |
| `wf.` | Workflow |
| `oa.` | Onboarding Application |
| `vn.` | Verification |
| `rr.` | Risk Rating |
| `wh.` | Webhook |
| `ak.` | API Key |
| `ur.` | User |
| `re.` | Role |
| `ev.` | Event |

### Kebab-case Everywhere
All field names use kebab-case (e.g., `account-balance`, `legal-person-type`, `payment-amount`). Boolean fields sometimes include `?` suffix (e.g., `us-citizen?`, `api-key-live?`, `can-decide-on-verifications?`, `disabled?`).

### Currency Format
All monetary values are `{ "currency": "GBP", "value": "1000.00" }` with string amounts (not numbers).

### Sandbox Specifics
1. **Auto-funding:** New accounts get 1,000,000.00 GBP immediately
2. **Instant settlement:** FPS payments are delivered instantly
3. **Auto-approval:** Onboarding applications are accepted immediately by "system" decision-maker
4. **Account lifecycle:** `opening` -> `open` transition is instant
5. **Sort codes:** All sandbox accounts use `000001` sort code

### Error Handling
Griffin returns highly descriptive errors:
```json
{
  "errors": [
    {
      "title": "Invalid enum value",
      "status": "400",
      "detail": "Not a valid value for the 'bank-product-type' enum.",
      "field": "bank-product-type",
      "allowed": ["savings-account", "client-money-account", ...],
      "source": { "pointer": "bank-product-type" },
      "links": { "about": "https://docs.griffin.com/docs/errors/..." }
    }
  ]
}
```

Errors include:
- The invalid value submitted
- The field name
- Allowed values (for enums)
- JSON pointer to the error location
- Link to documentation

### Payment Flow Summary
```
1. Create legal person (or via onboarding application)
2. Open bank account (specify product type + owner)
3. Create payment (specify creditor type + amount)
4. Submit payment (specify payment-scheme: "fps")
5. Payment delivered, balances updated
```

### Complete End-to-End Flow Tested
1. Started at API index
2. Discovered org (`<org-id>`)
3. Created legal person "Test User Alice" (individual)
4. Opened embedded account for Alice
5. Account auto-funded with 1,000,000 GBP
6. Created payment of 100.00 GBP from Primary -> Alice
7. Submitted payment via FPS scheme
8. Payment delivered instantly
9. Verified balances updated correctly
10. Created external payee
11. Created payment to external payee
12. Created onboarding application via reliance workflow for "Bob"
13. Application auto-accepted, legal person created with `onboarded` status
14. Created and tested webhook
15. Verified events stream captured all actions
16. Tested account closure (status -> `closing`)

### Payment Scheme
Only `fps` (Faster Payments Service) was tested. This is the standard UK real-time payment scheme. Other schemes may be available (BACS, CHAPS) but were not tested.

### Reliance Verification Methods (allowed values)
- `manual-document`
- `physical`
- `electronic`
- `manual-biometric`

Standard: `jmlsg` (Joint Money Laundering Steering Group)

### External Risk Rating (allowed values)
- `low-risk`
- `medium-risk`
- `high-risk`
- `prohibited-risk`
