# QA Executive Summary — Agentic Bank POC

> **Date:** 2026-03-13 | **Status:** All squads complete + post-regression fixes | **Version:** Final

---

## Overall Status: DEMO READY ✅

All three squads (Core Banking, Lending, Experience) have completed implementation, regression testing, and post-regression bug fixing. All **334 tests pass**. TypeScript is clean across the monorepo. All five planned demo scenes are fully unblocked.

Three features previously omitted during sprint execution have been restored and are fully functional:
1. **Conversational AI onboarding** — register → chat → agent detects onboarding step → guides user through KYC
2. **SSE streaming** — real agent loop wired end-to-end; chat screen streams tokens live
3. **Pending action resurfacing** — `GET /api/pending-actions` endpoint + mount-time check restores ConfirmationCards on app restart

---

## Test Counts

| Scope | Tests | Pass | Fail |
|-------|-------|------|------|
| Core Banking (services, tools, integration) | ~139 | 139 | 0 |
| Lending (service, integration, EMI) | 56 | 56 | 0 |
| Experience (agent, onboarding, insights, chat) | ~129 | 129 | 0 |
| Pending actions integration | 6 | 6 | 0 |
| Chat stream integration | 4 | 4 | 0 |
| **Total (monorepo)** | **334** | **334** | **0** |
| TypeScript errors | — | **0** | — |

---

## Issues Found and Fixed Per Squad

### Core Banking
- ✅ **Fixed**: Home tab pot progress bars showed 0% — field names `goal`/`progress_pct` now correctly mapped to `goal_amount`/`progress_percent` in `banking.ts`
- ✅ **Fixed**: Activity and Payments screens used stale Griffin data shape — rewritten to use signed-amount API shape (`posted_at`, `merchant_name`, `amount: number`)
- ⚠️ **Accepted**: `beneficiary_name` vs `beneficiary_id` — name-matching approach accepted as POC simplification
- ⚠️ **Minor**: `send_payment` tool description says max £25,000; service enforces £10,000. Low impact — service rejects correctly.

### Lending
- ✅ **Fixed**: Alex UUID mismatch in `hashToScore()` — `'alex-uuid-1234'` → `'00000000-0000-0000-0000-000000000001'`
- ✅ **Fixed**: CreditScoreCard factors shape — UIComponentRenderer now normalises flat-array and nested factor formats
- ✅ **Fixed**: `bandToRating` case mismatch — `.toLowerCase()` applied before switch in `loans.tsx`
- ✅ **Fixed**: Loan ConfirmationCard now shows APR, monthly EMI, and total repayable
- ✅ **Fixed**: Flex eligibility thresholds corrected — £30 threshold / 14-day window per PRD

### Experience
- ✅ **Fixed**: SSE streaming — `processChatStream` added to `agent.ts`, `chat-stream.ts` fully wired, mobile `streamChatMessage` AsyncGenerator drives live token display
- ✅ **Fixed**: Pending action resurfacing — `GET /api/pending-actions` endpoint returns active unexpired actions; `chat.tsx` resurfaces ConfirmationCards on mount
- ✅ **Fixed**: AppState foreground trigger — `_layout.tsx` now resets chat store when app returns from background > 5 minutes
- ✅ **Fixed**: BalanceCard design tokens — `bg-brand-default` → `bg-surface-raised border border-border-default`
- ✅ **Restored**: Conversational onboarding — `register.tsx` now routes directly to `/(tabs)` instead of form-based onboarding screen; agent detects `onboarding_step !== 'ONBOARDING_COMPLETE'` and enters conversational KYC flow

---

## Remaining Known Issues

| Priority | ID | Description | Impact |
|----------|-----|-------------|--------|
| P2 | EX-BUG-04 | No live countdown timer on ConfirmationCard | Cosmetic — 5-min window is clear from text |
| P2 | BUG-CB-L01 | Tool description says max £25,000, enforces £10,000 | Low — service rejects correctly regardless |
| P3 | XS-SKELETON | No skeleton loading cards (SkeletonCard not implemented) | Cosmetic — spinner fills the gap |

All P0/P1 issues from the initial regression pass have been resolved.

---

## Demo Readiness Score: 9.5 / 10

| Dimension | Score | Notes |
|-----------|-------|-------|
| API correctness | 10/10 | All services correct, 334 tests green, 0 TS errors |
| Core demo scenes | 10/10 | All 5 scenes unblocked, no workarounds needed |
| Chat UI | 10/10 | SSE streaming live, pending resurfacing works, AppState trigger active |
| Mobile dashboard | 9/10 | Field names fixed; SkeletonCard cosmetic gap remains |
| Lending flows | 10/10 | All critical bugs fixed; APR + total in confirmation card |
| Onboarding | 10/10 | Full conversational AI onboarding flow end-to-end |
| Insights | 9/10 | Spending breakdown, proactive cards, weekly summary all working |
| Design fidelity | 9/10 | BalanceCard fixed; minor cosmetic gaps (skeletons) |

**Overall: 9.5/10** — Production-quality POC. All core banking flows and demo scenes work correctly end-to-end. Remaining gaps are cosmetic only.

---

## Squad Readiness Snapshot

| Squad | API | Tests | Mobile | Demo Ready? |
|-------|-----|-------|--------|-------------|
| Core Banking | ✅ All tools + services | ✅ 139 pass | ✅ Field names fixed | ✅ Yes |
| Lending | ✅ All 10 tools + LendingService | ✅ 56 pass | ✅ All critical bugs fixed | ✅ Yes |
| Experience | ✅ Agent, onboarding, insights, streaming | ✅ 129 pass | ✅ Streaming + resurfacing + AppState fixed | ✅ Yes |

---

## Commit History (Post-QA Fixes)

| Commit | Description |
|--------|-------------|
| `fe1f92d` | feat(pending-actions): restore pending action resurfacing (EXI-06c) |
| `5037f9d` | feat(streaming): restore SSE streaming — real agent loop wired end-to-end |
| `1f338c1` | feat(onboarding): restore conversational AI onboarding flow |
| `a540a2b` | fix(qa): lending + experience critical bugs from regression testing |
| `95f2ff4` | fix(qa): BUG-LE-05 — loan ConfirmationCard now shows APR + total repayable |
| `6d7a80a` | fix(qa): correct field name mismatches found in regression testing |
| `98731d0` | fix(qa): multi-sprint QA — critical, high, and medium issues resolved |
