# Post-POC Backlog

> Items accepted as out-of-scope for the POC demo but logged for the next implementation phase.

---

## P1 — Should Fix Next Sprint

| ID | Squad | Item | File | Notes |
|----|-------|------|------|-------|
| ~~POST-CB-01~~ | ~~Core Banking~~ | ~~Multi-account support in account detail screen~~ | ✅ Done — `account/[id].tsx` passes `id` to `getBalance(id)` and `getTransactions(10, id)`; API routes accept optional `account_id` query param; transactions filtered by `account_id` when provided |

---

## P2 — Nice to Have

| ID | Squad | Item | File | Notes |
|----|-------|------|------|-------|
| POST-LE-03 | Lending | **Seed realistic loan payment history for demo** | `scripts/seed.ts` or `scripts/demo-reset.ts` | `LoanStatusCard` now shows "X of Y payments" from `loan_payments` rows. Seed data should include Alex with an active loan and several paid instalments so the progress display is meaningful during demo. |



| ID | Squad | Item | Notes |
|----|-------|------|-------|
| POST-EX-01 | Experience | Live countdown timer on ConfirmationCard | Show "3m 45s remaining" using `setInterval` against `expires_at` |
| ~~POST-EX-02~~ | ~~Experience~~ | ~~SkeletonCard animate-pulse~~ | ✅ Done — Reanimated opacity loop, each line pulses independently |
| POST-LE-01 | Lending | **Dynamic personalised credit score factors** | Currently static strings per tier in `lending-service.ts`. Fix: analyse user's actual transaction history (spending by category, recurring payments, balance trends) to generate personalised positive factors and improvement tips per user. |
| POST-CB-02 | Core Banking | Vertical FlatList for pots section | PRD spec; currently horizontal carousel of 3 |
| ~~POST-EX-03~~ | ~~Experience~~ | ~~Beneficiary resolution eval tests~~ | ✅ Done — 18 tests covering exact match, case variants, partial match, ambiguity, whitespace, unicode |
| ~~POST-CB-03~~ | ~~Core Banking~~ | ~~Upgrade Clipboard to expo-clipboard~~ | ✅ Done — `expo-clipboard` installed, `account/[id].tsx` updated to `setStringAsync` |

| POST-CB-05 | Core Banking | **Unified beneficiary model** | Current model only supports UK domestic payments (sort code + account number). Future state: unified `beneficiaries` table with `payment_type` enum (`domestic`, `international_swift`, `international_sepa`, `faster_payments`, `bacs`), type-specific detail columns (IBAN, BIC/SWIFT, routing number), and a single disambiguation + selection UI that works across all payment rails. International payment tools to be scoped separately. |

## P3 — Product Decisions Required

| ID | Item | Decision Needed |
|----|------|-----------------|
| POST-LE-02 | **Replace extrapolated spending spike detection with rolling median algorithm** | Research complete — see `docs/neobank-v2/08-post-poc/spending-spike-detection-research.md`. Recommended fix: Algorithm A (Median Rolling Window) — compare 30-day rolling actual spend against median of 6 prior 30-day windows. Eliminates early-month false spikes entirely. Threshold: 1.8x, noise floor: £10, min 2 transactions. Implement in `apps/api/src/services/insight.ts` `detectSpendingSpikes()`. |
| POST-CB-04 | `send_payment` uses beneficiary name not UUID | Product: accept name-matching approach formally or enforce UUID contract? |
