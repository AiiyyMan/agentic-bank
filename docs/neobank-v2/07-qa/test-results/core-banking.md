# Core Banking Squad — QA Test Results (Phase 8 Regression)

> **QA Lead Report** | Core Banking Squad | 2026-03-14
>
> Phase 8 regression audit. Full code review, test audit, and bug triage against PRD and test plan.

---

## 1. Test Run Summary

### 1.1 Full Test Suite

| Metric | Result |
|--------|--------|
| Total test files | 31 (entire API suite) |
| Total tests | **370 passed, 0 failed** |
| TypeScript errors | **0** |
| Test runtime | 5.17s |

### 1.2 Core Banking Specific Tests

| Test File | Tests | Status | Notes |
|-----------|-------|--------|-------|
| `services/account.test.ts` | 7 | All pass | CB-01 |
| `services/payment.test.ts` | 24 | All pass | CB-08/CB-09 |
| `services/pot.test.ts` | 12 | All pass | CB-06 |
| `services/categorisation.test.ts` | 22 | All pass | CB-04 |
| `tools/core-banking-tools.test.ts` | 14 | All pass | CB-02/CB-03/CB-05 |
| `tool-validation.test.ts` (CB portions) | 45 total | All pass | CB-08/CB-09/CB-10 |
| `integration/banking.test.ts` | 10 | All pass | CB-12 through CB-16 REST |
| `integration/write-journeys.test.ts` | 12 | All pass | NEW: confirm pipeline journeys |
| `integration/standing-orders.test.ts` | 4 | All pass | CB standing orders |
| `handlers-confirm.test.ts` | 7 | All pass | Confirmation flow |
| `evals/beneficiary-resolution.test.ts` | 18 | All pass | NEW: POST-CB-04 UUID resolution |
| `adapters.test.ts` | 12 | All pass | BankingPort adapter layer |

**CB-relevant test count: ~167 tests across 12 files, all green.**

---

## 2. Previous QA Bugs — Resolution Status

This table tracks all bugs from the 2026-03-13 report.

| Bug ID | Severity | Description | Status |
|--------|----------|-------------|--------|
| BUG-CB-H01 | High | `send_payment` name vs UUID contract mismatch | FIXED — tool now requires `beneficiary_id` (UUID) + `beneficiary_name`. Execution uses UUID lookup. |
| BUG-CB-H02 | High | `progress_pct` vs `progress_percent` field name mismatch | FIXED — REST `GET /api/pots` now returns `progress_percent` and `goal_amount`, matching the mobile interface. |
| BUG-CB-M01 | Medium | `InsufficientFundsError` mapped to HTTP 400 vs expected 422 | OPEN — still 400. See §4.3 below. |
| BUG-CB-M02 | Medium | PotService does not use pending_action pattern | CLOSED AS DESIGN — pending_action is created at handler layer, not service layer. Correct by current ADR-17 design. |
| BUG-CB-M03 | Medium | activity.tsx uses Griffin transaction shape | FIXED — `activity.tsx` now uses `merchant_name`, `primary_category`, `posted_at`. |
| BUG-CB-M04 | Medium | payments.tsx filters on non-existent `direction`/`type` columns | FIXED — `payments.tsx` now reads `merchant_name` and `primary_category`. |
| BUG-CB-M05 | Medium | Home tab Pot interface uses `goal_amount` but API returned `goal` | FIXED — `GET /api/pots` now returns `goal_amount` and `progress_percent`. |
| BUG-CB-L01 | Low | Tool description says max £25,000, service enforces £10,000 | FIXED — description updated to `£0.01 and £10,000`. |
| BUG-CB-L02 | Low | No integration test for CB write tool confirm pipeline | FIXED — `write-journeys.test.ts` added with 12 tests covering send_payment, add_beneficiary, create_pot, and cross-cutting edge cases. |
| BUG-CB-L03 | Low | Contract tests not created | OPEN — see §5 gap table. |
| BUG-CB-L04 | Low | `getPotOrThrow` masks DB errors as PotNotFoundError | OPEN — see §4.4. |

---

## 3. PRD Compliance Table

### P0 Features

| # | Feature | PRD Ref | Status | Notes |
|---|---------|---------|--------|-------|
| F1 | Check Balance via Chat | CB-02 | Implemented | `check_balance` tool → AccountService → ProviderUnavailableError on failure |
| F2 | Account Overview Screen | CB-17 | Partial | No dedicated drill-down screen at `/account-detail/[id]`. Balance visible on Home tab. Account detail screen exists at `/account/main` but is a placeholder. |
| F3 | Account Details — Copy | CB-17 | Partial | Account number displayed; no copy-to-clipboard component in scope |
| F4 | Multiple Account Listing | CB-02 | Implemented | `get_accounts` tool, `GET /api/accounts`, `total_balance` computed |
| F5 | Create Savings Pot | CB-07 | Implemented | `create_pot` → PotService → pending_action → confirmed execution. Audit_log written. |
| F6 | Deposit to Pot | CB-07 | Implemented | `transfer_to_pot` → PotService. pot_transfers record + audit_log written. |
| F7 | Withdraw from Pot | CB-07 | Implemented | `transfer_from_pot` → PotService. Locked pot rejection works. |
| F8 | Pot Goal Tracking | CB-05 | Implemented | `progress_percent` computed, capped at 100, null when no goal |
| F9 | List All Pots | CB-05 | Implemented | `get_pots` tool + `GET /api/pots`, sorted by created_at |
| F10 | Savings/Pots Section on Home Tab | CB-19 | Partial | Implemented as horizontal carousel (3 pots cap). PRD specifies vertical FlatList. Acceptable for POC. |
| F11 | Transaction List Screen | CB-18 | Implemented | `activity.tsx` renders date-grouped sections with correct field mapping |
| F12 | Date-Grouped Transaction Sections | CB-18 | Implemented | Client-side grouping in `activity.tsx` using `posted_at` |
| F13 | Transaction Categorisation | CB-04 | Implemented | Full hybrid pipeline: rule-based → cache → Haiku fallback. `is_recurring` flag present. |
| F14 | Send Money to Beneficiary | CB-10 | Implemented | `send_payment` requires UUID + name. Execution uses UUID. Confirmation flow end-to-end tested. |
| F15 | Post-Transaction Balance Display | CB-10 | Implemented | `balance_after` returned from execution via live balance fetch |
| F16 | List Beneficiaries | CB-08 | Implemented | `get_beneficiaries` tool sorted last_used_at DESC, `GET /api/beneficiaries` |
| F17 | Add Beneficiary | CB-08 | Implemented | `add_beneficiary` → validation → pending_action → confirmed execution → audit_log |
| F18 | BankingPort / Adapter Infrastructure | Foundation | Implemented | BankingPort, MockAdapter, GriffinAdapter, factory |
| F19 | Mock Banking Adapter | Foundation | Implemented | Supabase-backed mock with configure/reset API |
| F20 | Database Migrations | Foundation | Implemented | Migrations 003–018 cover all CB tables with RLS |

---

## 4. Bugs Found — Phase 8 Audit

### 4.1 Critical (P0)

None.

---

### 4.2 High (P1)

**BUG-CB-H03: `send_payment` pending_action stores `beneficiary_id` but ConfirmationCard text uses `beneficiary_name` — misaligned contracts**

- **Severity:** P1
- **Files:** `apps/api/src/tools/handlers.ts` lines 412–450 (`createPendingAction`) and 665–720 (`executeWriteTool`)
- **Description:** The `createPendingAction` function for `send_payment` builds a ConfirmationCard using `params.beneficiary_name` and also fetches bank_name via `params.beneficiary_id`. However, the `post_transaction_balance` is calculated as `balance - params.amount` at creation time, not at confirmation time. If the balance changes between tool invocation and confirmation (e.g., another payment settles), the displayed `post_transaction_balance` in the ConfirmationCard will be stale. The actual execution correctly fetches live balance post-payment, but the confirmation preview is pre-calculated. This is a display discrepancy, not a safety issue (execution re-validates at the service layer), but it means the ConfirmationCard can show an incorrect `balance_after` to the user.
- **Impact:** User sees balance_after of (e.g.) £1,000.00 in the card, confirms, then gets actual balance_after of £800.00 because another transaction settled. Misleading UX.
- **Recommendation:** Either fetch live balance immediately before creating the pending_action, or add a caveat ("estimated") to the confirmation balance display.

---

### 4.3 Medium (P2)

**BUG-CB-M06: HTTP error code mapping — `INSUFFICIENT_FUNDS` and `POT_LOCKED` both return 502**

- **Severity:** P2
- **File:** `apps/api/src/routes/banking.ts` lines 209–218 (`handleServiceError`)
- **Description:** The error map handles `NOT_FOUND` → 404, `VALIDATION_ERROR` → 400, `INSUFFICIENT_FUNDS` → 400, `FORBIDDEN` → 403, and all other codes → 502. The `POT_LOCKED` code (`err.code === 'POT_LOCKED'`) falls into the 502 branch. Similarly, `BENEFICIARY_NOT_FOUND` (from `InvalidBeneficiaryError`) also falls to 502. These are client errors that should be 422 or 400, not 502 (which implies server/provider failure). A 502 response causes mobile clients to show a generic "Banking provider unavailable" error instead of the domain-specific message.
- **Impact:** When a user tries to withdraw from a locked pot via REST, they receive a 502 response with the correct error message, but the HTTP status misleads any client code that checks the status code to determine error type.
- **Recommendation:** Add explicit handling: `err.code === 'POT_LOCKED' ? 422 : err.code === 'BENEFICIARY_NOT_FOUND' ? 422 : 502`.

**BUG-CB-M07: `validateAmount` in `validation.ts` has an unreachable branch — max is £25,000 but PaymentService enforces £10,000**

- **Severity:** P2
- **File:** `apps/api/src/lib/validation.ts` line 17, `apps/api/src/services/payment.ts` line 104
- **Description:** `validateAmount()` rejects amounts above £25,000. The `send_payment` tool's `validateToolParams` uses `validateAmount()`, which would allow up to £25,000. However, `PaymentService.sendPayment()` separately enforces a £10,000 limit via `PaymentLimitExceededError`. The tool description (now correctly) says £10,000. But because `validateToolParams` runs first (in `handleToolCall` before the service call), an amount of £15,000 passes `validateToolParams` and enters `createPendingAction` — the ConfirmationCard is shown to the user. Only when they confirm does `executeWriteTool` → `executePayment` → `sendPayment` reject it with `PaymentLimitExceededError`. Users will see a confirmation card for a payment they cannot actually execute.
- **Impact:** A user asked to confirm a £12,000 payment gets a ConfirmationCard shown, but confirmation fails at execution time. Poor UX — the error should surface before creating the pending_action.
- **Note:** `executeWriteTool` for `send_payment` does NOT call `PaymentService.sendPayment()` — it goes directly to `adapter.createPayment()`. The £10,000 cap in `PaymentService` is only enforced when going through the service class. The `executeWriteTool` path bypasses `PaymentService` entirely. This means amounts between £10,000.01 and £25,000 will actually succeed at execution time via the adapter, with no service-level limit enforced.
- **Recommendation:** Either: (a) add a £10,000 cap to `validateToolParams` for `send_payment`, or (b) route `executeWriteTool`'s `send_payment` case through `PaymentService.executePayment()` to enforce all business rules consistently.

**BUG-CB-M08: Duplicate payment records possible on network retry — idempotency_key only covers `transactions` table, not `payments` table**

- **Severity:** P2
- **File:** `apps/api/src/tools/handlers.ts` lines 685–702
- **Description:** In `executeWriteTool` for `send_payment`, the `transactions` table upsert uses `idempotency_key: 'txn-{actionId}'` with `ignoreDuplicates: true`. However, there is no corresponding record inserted into the `payments` table — the handler calls `adapter.createPayment()` and relies on the adapter's payment record. For the `MockBankingAdapter`, no `payments` table row is written at all. For `GriffinAdapter`, the payment is created in Griffin but not locally stored. The `PaymentService.executePayment()` (which does insert into `payments`) is NOT called from `executeWriteTool` — the handler bypasses the service class. This means the `GET /api/payments` endpoint has no data to show after confirming a payment via the agent chat flow.
- **Impact:** Payment history (`GET /api/payments`, `get_payment_history` tool) will show no records after payments made via chat. The payments screen and payment history tool are effectively non-functional for chat-initiated payments.
- **Recommendation:** `executeWriteTool` `send_payment` should also insert a row into the `payments` table (or call `PaymentService.executePayment()` which does both the transaction and payment insert).

---

### 4.4 Low (P3)

**BUG-CB-L05: `getPotOrThrow` masks Supabase DB errors as PotNotFoundError**

- **Severity:** P3
- **File:** `apps/api/src/services/pot.ts` lines 254–267
- **Description:** `getPotOrThrow` treats any error from Supabase (including DB connectivity failures, schema errors, etc.) identically to a "not found" scenario — both result in `PotNotFoundError`. When the database is temporarily unavailable, the error presented to the user will be "Pot X not found" rather than a provider-unavailable error with a retry suggestion.
- **Recommendation:** Check `error` first: if `error && !data`, check `error.code`. If it's a DB connectivity error (e.g., code 500xx), throw `DomainError('PROVIDER_UNAVAILABLE', ...)` instead of `PotNotFoundError`.

**BUG-CB-L06: `buildConfirmationSummary` for `delete_beneficiary` shows UUID, not name**

- **Severity:** P3
- **File:** `apps/api/src/tools/handlers.ts` lines 514–520
- **Description:** The `delete_beneficiary` confirmation summary shows `'Beneficiary ID': String(params.beneficiary_id)` (a raw UUID). The user sees "Beneficiary ID: a0000000-..." in the ConfirmationCard. This is unfriendly — the name should be fetched and shown instead (as is done for `send_payment`).
- **Recommendation:** Before building the summary, fetch the beneficiary name by UUID (same pattern as the bank_name enrichment for `send_payment`) and include `'Name': ben.name` in the details.

**BUG-CB-L07: Contract tests still not created**

- **Severity:** P3
- **File:** Missing `apps/api/src/__tests__/contracts/cb-tool-outputs.test.ts`
- **Description:** The QA test plan specified contract tests verifying CB tool output shapes match EX card renderer expectations. These were not created in this sprint either. The required contracts cover: `check_balance → BalanceCard`, `get_pots → PotStatusCard`, `get_transactions → TransactionListCard`, `send_payment → ConfirmationCard`, confirmed payment → `SuccessCard`, and `get_payment_history → PaymentHistoryCard`. No test currently verifies that tool output fields match what the card components expect.
- **Recommendation:** Create `apps/api/src/__tests__/contracts/cb-tool-outputs.test.ts` as specified in the test plan.

**BUG-CB-L08: `validateAmount` accepts £0.01 but the `amount > 0` check fires first — dead code**

- **Severity:** P3
- **File:** `apps/api/src/lib/validation.ts` lines 10–13
- **Description:** Line 10 checks `if (amount <= 0)` and returns an error. Line 12 checks `if (amount < 0.01)`. Since any amount ≤ 0 is already rejected, the `amount < 0.01` branch only fires for amounts in the range (0, 0.01), which is a floating point edge case. The intent is correct but the condition ordering means `amount = 0.005` returns "Amount must be positive" rather than "Minimum amount is £0.01", which is a slightly misleading error message.
- **Recommendation:** Reorder: check `< 0.01` first (covers both the zero and sub-penny case with the most specific message).

---

## 5. Coverage Gaps Against Test Plan

| Test Plan Section | Gap Description | Risk | Status |
|------------------|-----------------|------|--------|
| CB-04: 50 merchants categorised | Tests cover ~4 merchants (TESCO, TFL, NETFLIX, SPOTIFY). 50-merchant assertion not present. | Medium — merchant map may be incomplete | Open |
| CB-07: Pot tools create valid ConfirmationCards | No test verifies ConfirmationCard shape from `create_pot`, `transfer_to_pot`, `transfer_from_pot` | Low | Open |
| CB-10: Full payment flow with payments table write | No test verifies a chat payment flow results in a `payments` table row (see BUG-CB-M08) | High | Open |
| CB-11: get_payment_history after actual payment | No test verifies `get_payment_history` returns the payment just executed via agent | High | Open |
| Reject/Cancel path — expired action | No dedicated test for expired action on CB write tools (covered abstractly in confirm.test.ts but not CB-specific) | Medium | Open |
| CB-17: Account Detail screen | `/account/main` screen is a placeholder. Full account detail (transactions, copy-to-clipboard) not implemented. | Medium | Open |
| E2E agent loop scenarios (E2E-1 through E2E-3) | No E2E tests using agent loop harness with mocked Anthropic responses | Low for POC | Open |
| contracts/cb-tool-outputs.test.ts | Not created. BUG-CB-L07. | Low | Open |

---

## 6. New Tests Written in This Audit

The following gaps identified in the previous audit were closed between 2026-03-13 and 2026-03-14:

| Test File | Coverage Added |
|-----------|---------------|
| `integration/write-journeys.test.ts` (12 tests) | `send_payment` confirm pipeline: adapter called with UUID + amount + reference; `balance_after` returned; UUID not found returns tool error; expired action returns 400; concurrent confirm returns 400; `add_beneficiary` confirm pipeline; `create_pot` confirm pipeline; unauthorized confirm; action not found; adapter failure marked as failed. |
| `evals/beneficiary-resolution.test.ts` (18 tests) | Name resolution: exact match, case-insensitive, unicode, special chars, partial non-match, ambiguous (duplicates), whitespace edge cases. |
| `tool-validation.test.ts` additions (45 total, up from 13) | Coverage added for `create_pot`, `transfer_to_pot`, `transfer_from_pot`, `delete_beneficiary`, `flex_purchase`, `create_standing_order`, `cancel_standing_order`, `pay_off_flex`, onboarding tools. |

---

## 7. Input Validation Coverage

| Validation Path | Coverage | Notes |
|----------------|----------|-------|
| `send_payment.beneficiary_id` (UUID format) | Tested | `validateToolParams` + unit tests |
| `send_payment.amount` (> 0, ≤ 10,000, 2dp) | Partial | `validateToolParams` enforces via `validateAmount`. But `validateAmount` max is £25,000 (BUG-CB-M07). |
| `send_payment.reference` (max 18 chars) | Service-only | `PaymentService.sendPayment` validates. Not enforced in `validateToolParams` spec. |
| `add_beneficiary.sort_code` (6 digits) | Tested | Both `validateToolParams` and `PaymentService.addBeneficiary` |
| `add_beneficiary.account_number` (8 digits) | Tested | Both paths |
| `add_beneficiary.name` (1-40 chars) | Service-only | `PaymentService.addBeneficiary` validates but `validateToolParams` only checks `required`. |
| `create_pot.name` (1-30 chars) | Service-only | PotService validates; `validateToolParams` only checks `required` for `name`. |
| `create_pot.goal` (> 0) | Service-only | PotService validates; `validateToolParams` only checks type. |
| `transfer_to_pot.amount` | Tested | `validateToolParams` + service |
| `transfer_from_pot.amount` | Tested | `validateToolParams` + service |
| Date range validation (start > end) | Not tested | No test verifies `start_date > end_date` returns a validation error from `get_transactions` |
| Merchant ILIKE injection | Implemented | `banking.ts` and `handlers.ts` both escape `%_\` before ILIKE. Not explicitly tested. |

---

## 8. RLS and Security Audit

| Security Check | Status | Evidence |
|---------------|--------|---------|
| All routes require Bearer JWT | Confirmed | `preHandler: authMiddleware` on every route in `banking.ts` |
| Beneficiary ownership enforced before payment | Confirmed | `executeWriteTool send_payment` queries `beneficiaries` with `.eq('user_id', user.id)` |
| Pot ownership enforced | Confirmed | `getPotOrThrow` filters `.eq('user_id', userId)` |
| Beneficiary ownership enforced before delete | Confirmed | `PaymentService.deleteBeneficiary` queries `.eq('user_id', userId)` |
| Pending action ownership enforced | Confirmed | `executeConfirmedAction` checks `action.user_id !== userId` |
| Audit log written on all writes | Confirmed for: | `payment.created`, `beneficiary.added`, `beneficiary.deleted`, `pot.created`, `pot.transferred` |
| Service role used only for audit_log | Confirmed | `writeAudit` uses `getSupabase()` (service-role); user operations use per-request client |
| Amount bounds enforced | Partial | See BUG-CB-M07 — send_payment allows up to £25,000 at tool-validation layer |

---

## 9. Recommendations

### Must Fix Before Demo

1. **BUG-CB-M08 (P2): Chat payments don't create `payments` table rows.** `GET /api/payments` and `get_payment_history` show empty history after every chat payment. Fix `executeWriteTool send_payment` to insert a `payments` row (or route through `PaymentService.executePayment`).

2. **BUG-CB-M07 (P2): £10,000 payment limit not enforced at tool validation layer.** A user can be shown a ConfirmationCard for £15,000 then get a surprising failure. Add `if (amount > 10000) return validationError('Maximum payment is £10,000')` to the `send_payment` spec in `TOOL_PARAM_SPECS`.

### Should Fix

3. **BUG-CB-M06 (P2): `POT_LOCKED` and `BENEFICIARY_NOT_FOUND` map to HTTP 502.** Add explicit 422 mappings in `handleServiceError`.

4. **BUG-CB-H03 (P1): ConfirmationCard `balance_after` is stale.** Fetch live balance immediately before inserting the pending_action, or clearly label the displayed balance as "estimated".

5. **BUG-CB-L06 (P3): `delete_beneficiary` ConfirmationCard shows UUID.** Fetch the beneficiary name by UUID before building the summary (same as `send_payment`'s bank_name enrichment).

### Nice to Have

6. **BUG-CB-L05 (P3):** Distinguish DB errors from not-found in `getPotOrThrow`.
7. **BUG-CB-L07 (P3):** Create contract tests in `__tests__/contracts/cb-tool-outputs.test.ts`.
8. Add `send_payment.reference` max-18-char validation to `validateToolParams` spec.
9. Add `add_beneficiary.name` length validation to `validateToolParams` spec.
10. Add `get_transactions` date range validation (start > end → 400) to the REST route.

---

## 10. Summary Assessment

**POC Demo Readiness: 8.5/10**

Significant progress since the 2026-03-13 report. All mobile field-name mismatches resolved. The send_payment tool now correctly uses UUID-based beneficiary resolution with comprehensive eval coverage (18 tests). The write-journey integration tests (12 tests) close the critical gap in confirm pipeline coverage. All 370 tests pass, TypeScript is clean.

The two issues most likely to affect a live demo are:
- **BUG-CB-M08**: Chat payments don't appear in payment history (`get_payment_history` returns empty).
- **BUG-CB-M07**: Amounts between £10,001 and £25,000 pass the pre-confirmation validation, creating a confusing UX where the ConfirmationCard appears but confirmation either silently succeeds at the adapter level (bypassing the £10k service limit) or fails with a confusing error.

The confirmation pipeline, pot lifecycle, beneficiary management, and transaction categorisation are all well-tested and correct. The audit trail (audit_log) is written consistently for all writes. RLS ownership checks are in place on every domain service.
