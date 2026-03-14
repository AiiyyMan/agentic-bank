# Core Banking Squad — QA Test Results

> **QA Lead Report** | Core Banking Squad | 2026-03-13

---

## 1. Test Run Summary

### 1.1 Full Test Suite

| Metric | Result |
|--------|--------|
| Total test files | 27 (entire API suite) |
| Total tests | **324 passed, 0 failed** |
| TypeScript errors | **0** |
| Test runtime | 3.22s |

### 1.2 Core Banking Specific Tests

| Test File | Tests | Status |
|-----------|-------|--------|
| `services/account.test.ts` | 7 | ✅ All pass |
| `services/payment.test.ts` | 24 | ✅ All pass |
| `services/pot.test.ts` | 12 | ✅ All pass |
| `services/categorisation.test.ts` | 22 | ✅ All pass |
| `tools/core-banking-tools.test.ts` | 14 | ✅ All pass |
| `tool-validation.test.ts` (CB portions) | 43 total | ✅ All pass |
| `integration/banking.test.ts` | 10 | ✅ All pass |
| `handlers-confirm.test.ts` (shared) | 7 | ✅ All pass |

**CB-relevant test count: ~139 tests across 8 files, all green.**

---

## 2. PRD Compliance Table

### P0 Features

| # | Feature | PRD Ref | Status | Notes |
|---|---------|---------|--------|-------|
| F1 | Check Balance via Chat | CB-02 | ✅ Implemented | `check_balance` tool, AccountService, ProviderUnavailableError wired |
| F2 | Account Overview Screen | CB-17 | ⚠️ Partial | No dedicated drill-down screen (`/account-detail/[id]`). Balance visible on Home tab. |
| F3 | Account Details — Copy | CB-17 | ⚠️ Partial | Account number shown on Home tab; no dedicated copy-to-clipboard component |
| F4 | Multiple Account Listing | CB-02 | ✅ Implemented | `get_accounts` tool, `GET /api/accounts`, total_balance computed |
| F5 | Create Savings Pot | CB-07 | ✅ Implemented | `create_pot` tool → PotService → pending_action → confirmed execution |
| F6 | Deposit to Pot | CB-07 | ✅ Implemented | `transfer_to_pot` tool → PotService, pot_transfers record, audit_log |
| F7 | Withdraw from Pot | CB-07 | ✅ Implemented | `transfer_from_pot` tool → PotService, locked pot rejection |
| F8 | Pot Goal Tracking | CB-05 | ✅ Implemented | `progress_percent` computed and capped at 100; null when no goal |
| F9 | List All Pots | CB-05 | ✅ Implemented | `get_pots` tool, sorted by created_at asc, `GET /api/pots` |
| F10 | Savings/Pots Section on Home Tab | CB-19 | ⚠️ Partial | Pots section exists on Home tab. Uses horizontal carousel, not vertical FlatList as PRD specifies. Capped at 3 pots. |
| F11 | Transaction List Screen | CB-18 | ✅ Implemented | `activity.tsx` renders date-grouped sections, skeleton, empty state |
| F12 | Date-Grouped Transaction Sections | CB-18 | ✅ Implemented | Client-side grouping in `activity.tsx` |
| F13 | Transaction Categorisation | CB-04a–d | ✅ Implemented | Full hybrid pipeline: rules → cache → Haiku fallback. `is_recurring` flag implemented. |
| F14 | Send Money to Beneficiary | CB-10 | ⚠️ Partial | `send_payment` tool uses `beneficiary_name` (string), not `beneficiary_id` (UUID) as specified in PRD. Functional but deviates from contract. |
| F15 | Post-Transaction Balance Display | CB-10 | ✅ Implemented | `balance_after` returned from execution |
| F16 | List Beneficiaries | CB-08 | ✅ Implemented | `get_beneficiaries` tool, sorted last_used_at DESC, `GET /api/beneficiaries` |
| F17 | Add Beneficiary | CB-08 | ✅ Implemented | `add_beneficiary` tool → PaymentService, format validation, audit_log |
| F18 | BankingPort / Adapter Infrastructure | Foundation | ✅ Implemented | BankingPort interface, MockAdapter, GriffinAdapter, factory |
| F19 | Mock Banking Adapter | Foundation | ✅ Implemented | Full Supabase-backed mock with configure/reset API |
| F20 | Database Migrations | Foundation | ✅ Implemented | Migrations 003–018 cover all CB tables with RLS |

---

## 3. Coverage Assessment

### 3.1 Test Plan vs. Actual Test Files

The test plan specified a structured tree under `__tests__/core-banking/`, `__tests__/contracts/`, `__tests__/integration/core-banking/`, and `__tests__/e2e/`. The actual implementation uses a flatter layout.

| Planned File | Actual Coverage | Gap? |
|-------------|-----------------|------|
| `core-banking/account-service.test.ts` | `services/account.test.ts` | None |
| `core-banking/payment-service.test.ts` | `services/payment.test.ts` | None |
| `core-banking/pot-service.test.ts` | `services/pot.test.ts` | None |
| `core-banking/categorisation.test.ts` | `services/categorisation.test.ts` | None |
| `core-banking/tools/check-balance.test.ts` | `tools/core-banking-tools.test.ts` | None |
| `core-banking/tools/get-transactions.test.ts` | `tools/core-banking-tools.test.ts` | None |
| `core-banking/tools/get-pots.test.ts` | `tools/core-banking-tools.test.ts` | None |
| `contracts/cb-tool-outputs.test.ts` | Not created | **Gap** |
| `contracts/cb-consumes.test.ts` | Not created | **Gap** |
| `integration/core-banking/payment-flow.test.ts` | Not created | **Gap** |
| `integration/core-banking/pot-lifecycle.test.ts` | Not created | **Gap** |
| `e2e/core-banking/*.test.ts` | Not created | **Gap** |

### 3.2 CB-01 AccountService Coverage vs. Test Plan

| Planned Test | Implemented? |
|-------------|-------------|
| getBalance returns balance from BankingPort | ✅ |
| getBalance wraps provider error in ProviderUnavailableError | ✅ |
| getAccounts returns main + pots with total_balance | ✅ (but note: getAccounts calls `listAccounts`, not a combined pot+main query — pots are separate) |
| getAccounts computes progress_pct correctly | ❌ — AccountService does NOT compute progress_pct; computation is in the tool handler |
| getAccounts handles pot with no goal | ❌ — same gap |

### 3.3 CB-09 PaymentService Coverage vs. Test Plan

| Planned Test | Implemented? |
|-------------|-------------|
| sendPayment validates beneficiary belongs to user | ✅ (queries by user_id) |
| sendPayment validates amount range (0.01-10000) | ✅ |
| sendPayment validates reference max 18 chars | ✅ |
| sendPayment checks sufficient balance | ✅ |
| sendPayment creates pending_action | ❌ — service does NOT create pending_action; handler does |
| executePayment re-validates balance | ✅ (calls sendPayment() internally) |
| executePayment re-validates beneficiary exists | ✅ |
| executePayment inserts payment record | ✅ (via createPayment) |
| executePayment inserts transaction record (debit) | ✅ |
| executePayment updates beneficiary last_used_at | ✅ |
| executePayment writes audit_log | ✅ |
| executePayment returns balance_after | ✅ |

### 3.4 CB-06 PotService Coverage vs. Test Plan

| Planned Test | Implemented? |
|-------------|-------------|
| createPot validates name length (1-30) | ✅ |
| createPot validates goal > 0 | ✅ |
| createPot with initial_deposit checks main balance | ✅ |
| createPot creates pending_action | ❌ — PotService executes directly, no pending_action (different from plan) |
| transferToPot validates pot ownership | ✅ (getPotOrThrow filters by user_id) |
| transferToPot validates sufficient main balance | ✅ |
| transferFromPot validates sufficient pot balance | ✅ |
| transferFromPot rejects locked pot | ✅ |
| executeTransferToPot re-validates balance | ✅ |
| executeTransferToPot writes pot_transfers record | ✅ |
| executeTransferToPot writes audit_log | ✅ |

---

## 4. Bugs Found

### 4.1 Critical

None.

---

### 4.2 High

**BUG-CB-H01: `send_payment` tool accepts beneficiary_name, not beneficiary_id (PRD deviation)**
- Severity: High
- File: `apps/api/src/tools/definitions.ts` line 93, `apps/api/src/services/payment.ts` line 38
- Description: The PRD (F14) specifies `send_payment` takes `beneficiary_id: UUID`. The implementation uses `beneficiary_name: string` and does a case-insensitive name match. This is a deliberate divergence (simpler for Claude to use) but:
  1. It contradicts the PRD contract. EX cards and tests expecting `beneficiary_id` will be wrong.
  2. Name collision is only partially handled: multiple-match error is returned, but this is a user-facing failure mode with no automated resolution.
  3. The tool description says "£0.01 and £25,000" but PaymentService enforces max £10,000. The limit stated in the tool description is wrong.
- Recommendation: Either align PRD to accepted `beneficiary_name` approach, or update the test plan contract tests to reflect the actual interface. Also fix the tool description to state max £10,000.

**BUG-CB-H02: Field name inconsistency — `progress_pct` vs `progress_percent` between REST and tool endpoints**
- Severity: High
- File: `apps/api/src/routes/banking.ts` line 140 vs `apps/api/src/tools/handlers.ts` line 184
- Description: The REST endpoint `GET /api/pots` returns `progress_pct` while the tool handler `get_pots` returns `progress_percent`. The mobile Home tab (`index.tsx`) uses `progress_percent` from the `getPots()` API call (which hits REST). These field names are inconsistent and will cause the mobile pots section to silently show `0%` for all goals when fetching via REST (since `progress_pct` is returned, not `progress_percent`).
- Evidence: `index.tsx` line 41 declares `progress_percent: number | null` and line 201 renders `pot.progress_percent`. `GET /api/pots` returns `progress_pct`. The fields don't match.
- Recommendation: Standardise to `progress_pct` throughout (REST, tool output, mobile types).

---

### 4.3 Medium

**BUG-CB-M01: `InsufficientFundsError` mapped to HTTP 400, not 422 as per implementation plan**
- Severity: Medium
- File: `apps/api/src/routes/banking.ts` line 209
- Description: Implementation plan section 3.2 specifies `InsufficientFundsError` → HTTP 422. The route's `handleServiceError` function maps `INSUFFICIENT_FUNDS` to 400. `POT_LOCKED` (also specified as 422) falls through to 502. Neither POT_LOCKED nor BENEFICIARY_NOT_FOUND are handled explicitly.
- Impact: Mobile client gets unexpected HTTP status codes; integration tests against REST that check status codes would fail if written per the plan.

**BUG-CB-M02: PotService does not use pending_action pattern for write operations**
- Severity: Medium
- File: `apps/api/src/services/pot.ts`
- Description: Per the test plan (CB-06) and implementation plan, PotService methods were intended to create `pending_action` rows and use the two-phase confirmation pattern. The actual implementation executes writes directly. Confirmation is handled at the tool handler layer (`createPendingAction` in `handlers.ts`). This is a design divergence — not a functional bug, but the service-level test plan assertions about "createPot creates pending_action" will not be satisfied at the service level.

**BUG-CB-M03: Activity screen uses Griffin transaction shape, not local enriched shape**
- Severity: Medium
- File: `apps/mobile/app/(tabs)/activity.tsx` lines 11-18, 60-65
- Description: The `Transaction` interface in `activity.tsx` uses `direction`, `type`, `date` — the Griffin transaction shape. The API `GET /api/transactions` returns the enriched local shape: `merchant_name`, `primary_category`, `detailed_category`, `category_icon`, `posted_at`. The grouping code uses `tx.date` (line 65) but the API returns `posted_at`. When real data is loaded, transactions will not render correctly: merchant names won't show, date grouping will fail silently, and category icons won't be used.

**BUG-CB-M04: Payments screen filters on Griffin transaction fields that don't exist in local schema**
- Severity: Medium
- File: `apps/mobile/app/(tabs)/payments.tsx` line 73
- Description: The payments screen filters transactions with `tx.direction === 'debit' && tx.type === 'payment'`. The local `transactions` table has no `direction` or `type` columns (returns `primary_category`, `amount`). This means the "Recent Payments" list will always be empty even with real transaction data.

**BUG-CB-M05: Home tab `Pot` interface uses `goal_amount` but API returns `goal`**
- Severity: Medium
- File: `apps/mobile/app/(tabs)/index.tsx` line 39 vs `apps/api/src/routes/banking.ts` line 137
- Description: The `Pot` interface in `index.tsx` declares `goal_amount: number | null` and `progress_percent: number | null`. The REST endpoint returns `goal` and `progress_pct`. Combined with BUG-CB-H02, this means:
  - Progress bars never render (uses `progress_percent`, API returns `progress_pct`)
  - Goal visibility check `pot.goal_amount != null` always evaluates false (API returns `goal`, not `goal_amount`)

---

### 4.4 Low

**BUG-CB-L01: `send_payment` tool description states max £25,000, service enforces £10,000**
- Severity: Low
- File: `apps/api/src/tools/definitions.ts` line 89
- Description: Tool description says "The amount must be between £0.01 and £25,000" but `PaymentService.sendPayment` throws `PaymentLimitExceededError` at £10,001. Claude may attempt payments up to £25,000, which will fail with an error.

**BUG-CB-L02: No test coverage for `executeConfirmedAction` path for CB write tools**
- Severity: Low
- File: `apps/api/src/tools/handlers.ts`
- Description: The `handlers-confirm.test.ts` file has 7 tests for the confirmation flow, but they do not include CB-specific tools (create_pot, transfer_to_pot, transfer_from_pot, send_payment, add_beneficiary, delete_beneficiary). Only the mock generic flow is tested. No integration test verifies full payment flow: tool_use → pending_action → confirm → payment record.

**BUG-CB-L03: Contract tests not created**
- Severity: Low
- File: Missing `__tests__/contracts/cb-tool-outputs.test.ts` and `cb-consumes.test.ts`
- Description: The QA plan specified contract tests verifying CB tool output shapes match EX card renderer expectations (BalanceCard, PotStatusCard, PaymentHistoryCard contracts). These were not created.

**BUG-CB-L04: PotService `getPotOrThrow` uses `single()` without handling non-ownership**
- Severity: Low
- File: `apps/api/src/services/pot.ts` line 260
- Description: `getPotOrThrow` filters by `user_id` correctly, so ownership is enforced. However, if Supabase returns an error (e.g., DB unavailable) rather than `data: null`, the error object is not logged or forwarded — the function throws `PotNotFoundError` regardless. This masks DB errors as not-found errors.

---

## 5. Coverage Gaps Against Test Plan

| Test Plan Section | Gap Description | Risk |
|------------------|-----------------|------|
| CB-04: 50 merchants categorised | Only 3-4 merchants spot-tested (TESCO, TFL, NETFLIX). The plan required all 50 known UK merchants verified. | Medium — merchant map may be incomplete |
| CB-07: Pot tools create valid ConfirmationCards | No test verifies ConfirmationCard UI data shape from pot tools | Low — card rendering is EX responsibility |
| CB-10: Integration test full payment flow | No integration test: tool → pending_action → confirm → DB records | High for demo correctness |
| CB-11: Payment history filter by beneficiary | Not tested in integration | Low |
| Reject/Cancel path | No tests for expired action or double-confirm paths via CB tools | Medium |
| CB-17: Account Detail screen | Screen not created; no tests | Medium — PRD P0 item |
| CB-19: Pots section matches spec | Implementation is horizontal carousel (3 pots), PRD requires vertical FlatList | Low (POC) |
| E2E scenarios (E2E-1 through E2E-3) | No E2E tests using agent loop harness | Low for POC |

---

## 6. Recommendations

### Must Fix Before Demo

1. **BUG-CB-H02 (High):** Standardise `progress_pct` field name across REST endpoint and tool handler. This is the minimum fix needed for Home tab pot progress bars to render.

2. **BUG-CB-M03 (Medium):** Update `activity.tsx` `Transaction` interface to use `merchant_name` and `posted_at` from the enriched local schema so the Activity tab renders real data.

3. **BUG-CB-M05 (Medium):** Update Home tab `Pot` interface to use `goal` and `progress_pct` to match the REST response shape.

4. **BUG-CB-M04 (Medium):** Update `payments.tsx` payment filter to use `primary_category === 'TRANSFER_OUT'` rather than `direction === 'debit' && type === 'payment'`.

### Should Fix

5. **BUG-CB-H01 (High):** Align the `send_payment` tool contract — either update the PRD to reflect the `beneficiary_name` approach, or update the tool description to be accurate. Fix tool description max amount from £25,000 to £10,000.

6. **BUG-CB-M01 (Medium):** Map `INSUFFICIENT_FUNDS` → 422 and add explicit handling for `POT_LOCKED` → 422 and `BENEFICIARY_NOT_FOUND` → 422 in `handleServiceError`.

7. **BUG-CB-L01 (Low):** Fix tool description for `send_payment` to state correct max of £10,000.

### Nice to Have

8. Add integration test for full payment flow (tool → pending_action → confirm → payment record + audit_log).
9. Add contract tests for CB tool output shapes matching EX card renderer expectations.
10. Create Account Detail drill-down screen (`CB-17`) for full PRD P0 compliance.

---

## 7. Summary Assessment

**POC Demo Readiness: 7/10**

The Core Banking API layer is solid: all 324 tests pass, TypeScript is clean, domain services implement correct business logic with proper error handling, validation, and audit logging. The AI tooling (check_balance, get_transactions, get_pots, get_beneficiaries, send_payment, add_beneficiary, create_pot, transfer_to_pot, transfer_from_pot, delete_beneficiary, get_payment_history) is fully implemented with the two-phase confirmation pattern.

The primary risk is in the **mobile screens**: there are field name mismatches between the REST API response shapes and the TypeScript interfaces in the mobile components. Without fixes, the Home tab pot progress bars, the Activity screen transaction list, and the Payments screen will render incorrectly with real data.

The `send_payment` tool deliberately deviates from the PRD by accepting `beneficiary_name` instead of `beneficiary_id`. This simplifies the Claude agent flow and is functionally correct, but it should be formally reconciled against the PRD and any dependent EX contract tests.
