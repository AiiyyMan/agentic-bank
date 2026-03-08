# Plan Assessment: Agentic Bank POC

> **Phase 1e Output 4** | Design Systems Lead | March 2026
>
> Holistic review of scope, journeys, design system readiness, cross-squad risks, technical feasibility, and demo readiness before handoff to architecture.

---

## 1. Scope Assessment

### 1.1 Can 143 Features Ship in a POC?

No -- not if "ship" means production-quality. But 143 is achievable if the priorities hold and the team treats P1/P2 as stretch goals that are only built when P0 is demo-stable.

The 59 P0 features are the real product. They cover a complete story: onboard, fund, check balance, pay someone, see insights, manage savings -- all through chat. That is enough for a compelling demo. The P1 and P2 tiers exist to guide what comes next, not to promise what ships on day one.

**Recommendation:** Treat the P0 set as the hard scope boundary. P1 features enter the sprint only after their P0 dependencies are demo-stable and have passing integration tests. Do not interleave P0 and P1 work within the same squad in the same sprint.

### 1.2 Priority Mis-assignments

| # | Feature | Current | Proposed | Rationale |
|---|---------|---------|----------|-----------|
| 106 | Proactive card engine (rank + rate-limit) | P0 (L) | P0 -- correct but flag as critical path | Underpins morning greeting (#107), spending spike (#102), weekly summary (#103). If this slips, half the demo breaks. |
| 39 | Standing order execution (simulated) | P1 (M) | P2 | Requires a scheduled job (Supabase cron or equivalent). Creating and listing standing orders (P1) is enough for the demo; simulated execution adds infrastructure cost for no visible user value. |
| 84 | Biometric setup (Face ID/Touch ID) | P1 (M) | P1 -- but defer until after P0 freeze | Expo LocalAuthentication is straightforward, but biometric prompts during confirmation cards (>=250 threshold) add branching logic to the core confirmation flow. Build the confirmation flow first, add biometric as a gate afterwards. |
| 78 | Open Banking link + pull funds | P1 (L) | P2 | Mocked entirely. An L-complexity mock adds no demo value over the bank transfer path (which shows real account details). The UX flow is interesting but the engineering effort is better spent elsewhere. |
| 133 | Storybook 9 setup | P1 (M) | P1 -- but last P1 to build | Storybook is a dev tool, not a user feature. Every other P1 delivers user-visible value first. |
| 112 | Spending breakdown chart card | P2 (L) | P2 -- correct | Victory Native XL integration is a rabbit hole. The text-based spending breakdown card (#105) covers the demo. |

### 1.3 Features That Sound Simple but Are Not

| Feature | Apparent Size | Real Size | Why |
|---------|--------------|-----------|-----|
| #92 Two-phase confirmation flow | L (correctly rated) | XL in practice | This is the backbone of every write operation. It spans: pending_actions table, timeout logic, double-submission prevention, re-rendering pending cards on app reopen, biometric gate (P1), and cancel/expire states. Every squad depends on it. |

**#92 Cross-squad ownership clarification:**
- **EX owns the infrastructure:** `createPendingAction()` utility, ConfirmationCard component, `POST /api/confirm/:id` and `POST /api/reject/:id` routes, timeout/expiry logic, and the `expired` cleanup job. This is a Foundation F1b deliverable and must be ready before squads start parallel work.
- **CB and LE consume it:** Their tool handlers (e.g., `send_payment`, `apply_loan`) call `createPendingAction()` with domain-specific params (`tool_name`, `params` JSONB). EX's infrastructure handles rendering, confirmation, rejection, and expiry -- the consuming squads do not need to know how the confirmation UI works.
| #31 Beneficiary name resolution (fuzzy match) | M | M-L | "James" must match "James Mitchell" but not "James Chen" when there is only one James. When there are two, it must trigger disambiguation (#32). The fuzzy match logic needs careful threshold tuning. Levenshtein alone will produce false positives on short names. |
| #94 Streaming responses (SSE) | M | M-L on mobile | React Native does not have native EventSource. The team must use a polyfill (e.g., `react-native-sse` or a fetch-based reader). Reconnection on network drop, background/foreground transitions, and partial message buffering all add hidden complexity. |
| #106 Proactive card engine | L (correctly rated) | L-XL | Must evaluate 8+ rule types on app open in <1 second. If the transaction volume is high, the aggregation queries become expensive. Needs a caching or pre-computation strategy. |
| #22 Transaction categorisation (rule-based) | M | M | The merchant-to-category mapping needs to cover at least the top 50 UK merchants for the demo to look real. A thin map will produce "Uncategorised" for most transactions, undermining the insight engine. |

---

## 2. Journey Completeness

### 2.1 Accounts Journey

**Status: COMPLETE for P0.**

Every P0 flow is end-to-end:
- Balance check: query -> tool -> balance card. No gaps.
- View all accounts: query -> tool -> multiple account cards. No gaps.
- Create pot: multi-turn conversation -> confirmation -> pot card. No gaps.
- Deposit/withdraw from pot: single message -> confirmation -> success. No gaps.
- Pot goal tracking: progress bar renders from pot metadata. No gaps.
- Savings tab: drill-down from chat or direct tab access. No gaps.

**Dead-end flagged:** If Alex says "Move 1,000 to savings" but has no pots, the AI must offer to create one. The accounts journey map covers the empty-pots case ("You don't have any savings pots yet. Want to create one?") but this response is not explicitly wired into the `transfer_to_pot` tool's error handling. The domain service must check for pot existence and return a structured error that the AI can act on.

**Edge case gap:** The safety threshold warning ("Moving 1,000 would leave you with 230, and your phone bill is due Friday") requires cross-referencing balance, transfer amount, AND upcoming standing orders/DDs. Standing orders are P1. For P0, the AI should warn based on balance alone ("This would leave your main account at 230. Want to proceed?") without bill context.

### 2.2 Payments Journey

**Status: COMPLETE for P0 domestic. International is P1 and self-contained.**

- Send domestic payment: message -> beneficiary resolution -> confirmation -> success. No gaps.
- Beneficiary disambiguation: fuzzy match -> quick reply pills -> selection. No gaps.
- Add new beneficiary: conversational multi-turn -> confirmation. No gaps.
- Beneficiary not found: graceful redirect to add-beneficiary flow. No gaps.
- Insufficient funds: clear message with alternative suggestion. No gaps.

**Dead-end flagged:** The payment flow assumes the AI resolves beneficiary names before calling `send_payment`. But the current tool definition (in `definitions.ts`) takes `beneficiary_name` as a string. If Claude passes "James" and the backend cannot resolve it, the domain service must return a structured disambiguation response (not a raw error). The service layer needs a `get_beneficiaries` call internally or the AI must be instructed (via system prompt) to always call `get_beneficiaries` first before `send_payment`.

**Observation:** The `send_payment` tool currently lacks a `beneficiary_id` parameter. It uses `beneficiary_name`, which means resolution happens at the handler level. This is fragile. Consider adding `beneficiary_id` as an optional parameter so the AI can pass an unambiguous ID after disambiguation.

### 2.3 Lending Journey

**Status: ALL P1. Not required for P0 demo. Self-contained.**

The lending journey is well-designed and internally complete. No P0 dependencies.

**Risk if promoted to demo:** The loan slider card (#47) requires real-time client-side recalculation as the user drags sliders. This means a PMT formula implementation in React Native with debounced state updates. It is the most complex single component in the entire card catalogue. If lending is included in the demo, this card will take 2-3 days alone.

**Flex Purchase dependency:** Flex Purchase (#56-63) requires linking back to original transactions via `transaction_id`. The `flex_plans` table schema references `transaction_id`, but the current transactions come from Griffin (or mock). The Griffin transaction IDs must be stable and stored locally (in Supabase) for the foreign key to work. This is an implicit migration dependency.

### 2.4 Onboarding Journey

**Status: COMPLETE for P0. Well-specified.**

Every step has explicit flows, edge cases, and error states. The state machine (STARTED -> ... -> ONBOARDING_COMPLETE) enables resume. The getting-started checklist provides post-onboarding guidance.

**Dead-end flagged:** The onboarding flow uses the same chat interface as the main experience. After onboarding completes, the chat context must transition from "onboarding mode" (where the AI collects data and provisions accounts) to "banking mode" (where tools are available). The system prompt needs a conditional section: if `onboarding_status !== 'complete'`, restrict tools to onboarding-only; after completion, expose the full tool registry. This transition is not explicitly specified.

**Edge case gap:** If a user abandons onboarding and returns days later, the `onboarding_state` resumes at the right step, but the chat history will show the old onboarding messages alongside new context. The "New conversation" separator should fire automatically on resume to avoid a jarring mix of old and new messages.

### 2.5 AI Chat Journey

**Status: COMPLETE for P0. This is the most critical journey.**

The card component catalogue in `ai-chat.md` is comprehensive: 28+ card specifications covering P0 through P2. The proactive insight strategy, tone guidelines, and multi-turn conversation examples are all well-defined.

**Critical gap: Tool registry vs. implementation.** The journey map defines 9 Experience squad tools (`respond_to_user`, `get_spending_insights`, `get_spending_by_category`, `get_weekly_summary`, `search_transactions`, `get_upcoming_bills`, `get_proactive_cards`, `get_payment_history`, `get_value_prop_info`), but the current codebase (`apps/api/src/tools/definitions.ts`) only implements 9 tools total -- and most are Core Banking tools. The spending and insight tools do not exist yet. This is expected at this stage, but it means the Experience squad has the largest tool development backlog.

**~~50-message cap concern~~** **RESOLVED (ADR-05):** Each tool-using turn generates 3 messages: user message, assistant message with tool_use, tool_result. The original 50-message cap gave only ~8-10 meaningful interactions. ADR-05 increases the cap to 100 messages with summarisation at 80 (oldest 60 compressed, last 20 kept verbatim), giving ~25 multi-tool interactions per conversation.

---

## 3. Design System Readiness

### 3.1 Token Architecture -- Current State

The three-tier token architecture (primitive -> semantic -> component) is sound and already implemented in production-ready form:

- **Primitives:** 12 colour palettes, 13 spacing steps, 12 radii, 6 shadows, full typography scale -- all declared as CSS custom properties in `apps/mobile/global.css`.
- **Semantics:** Light and dark mode mappings for background, surface, text, border, brand, and status colours -- all flattened to literal RGB triplets (no nested `var()` refs). Dark mode via `@media (prefers-color-scheme: dark)` override block.
- **Components:** Token JSON files exist in `docs/.../tokens/` but are NOT yet consumed by the build pipeline. The `global.css` file implements primitives and semantics directly; component tokens are still in documentation only.

### 3.2 Stack Decision (Resolved 2026-03-07)

**RESOLVED.** The codebase has been downgraded from NativeWind v5 (preview) to **NativeWind v4.2 (stable) + Tailwind CSS v3.4**. Rationale: v5 is pre-release with known bugs (Modal breakage, `@import` deserialization errors on native, no stable release date). A POC must be stable, not bleeding-edge.

Current stack:
- **NativeWind v4.2.2** (production-stable, pinned)
- **Tailwind CSS v3.4.17** (stable)
- **No Gluestack UI** -- components built directly from `agent-design-instructions.md` specs
- Tokens: CSS variables (flattened RGB triplets) in `global.css` + `tailwind.config.js` mappings
- Dark mode: `@media (prefers-color-scheme: dark)` in `global.css` + NativeWind `dark:` variant
- Runtime tokens: `theme/tokens.ts` for JS-only contexts (navigation, charts)
- Fonts: Inter loaded via `@expo-google-fonts/inter` with splash screen gate
- Icons: `phosphor-react-native` + `react-native-svg`

All documentation updated to reflect this stack.

### 3.3 Font Bundling

The design tokens specify `Inter` as the base font family (`--font-family-base: "Inter"`). Expo does not ship Inter by default. The team must:

1. Install `@expo-google-fonts/inter` or bundle Inter as a custom asset
2. Load the font in `_layout.tsx` before rendering (Expo's `useFonts` hook)
3. Map font weights to the correct Inter variants (Regular, Medium, SemiBold, Bold)

This is straightforward but must happen in foundation setup, not discovered mid-sprint.

### 3.4 Banking-Specific Token Gaps

The semantic token layer covers general UI well but lacks banking-specific tokens needed by the card catalogue:

| Missing Token | Used By | Suggested Value (Light) |
|--------------|---------|------------------------|
| `--color-money-positive` | Transaction credits, balance increases | `var(--color-success-60)` |
| `--color-money-negative` | Transaction debits | `var(--color-text-primary)` (not red -- debit is normal) |
| `--color-money-pending` | Pending transactions | `var(--color-warning-60)` |
| `--color-ai-bubble-bg` | Assistant message background | `var(--color-gray-5)` |
| `--color-ai-bubble-user-bg` | User message background | `var(--color-brand-50)` |
| `--color-card-confirmation-border` | Confirmation card accent | `var(--color-warning-40)` |
| `--color-card-success-border` | Success card accent | `var(--color-success-40)` |
| `--color-card-error-border` | Error card accent | `var(--color-destructive-40)` |
| `--color-score-poor` | Credit score <400 | `var(--color-destructive-50)` |
| `--color-score-fair` | Credit score 400-599 | `var(--color-warning-50)` |
| `--color-score-good` | Credit score 600-799 | `var(--color-success-50)` |
| `--color-score-excellent` | Credit score 800+ | `var(--color-brand-50)` |

**DONE (2026-03-07).** All banking tokens added to `global.css` as flattened RGB triplets with both light and dark mode values. Mapped in `tailwind.config.js`.

### 3.5 Component Token Resolution

The `components.json` file uses aliases like `{color.brand.default}` which reference semantic tokens. But the semantic token file has these under mode prefixes: `light.color.brand.default` / `dark.color.brand.default`. In the actual CSS implementation (`global.css`), this is already solved -- semantic tokens like `--color-brand-default` automatically swap values via the dark mode media query. The JSON files are documentation artefacts; the CSS is the source of truth for runtime. This is fine, but it means the JSON files and the CSS must stay in sync manually. Any token added to the JSON must also be added to `global.css`.

### 3.6 Hardcoded Colours in Codebase

The root layout (`apps/mobile/app/_layout.tsx`) uses hardcoded hex colours:

```typescript
headerStyle: { backgroundColor: '#1a1a2e' },
headerTintColor: '#fff',
contentStyle: { backgroundColor: '#0f0f23' },
```

**DONE (2026-03-07).** Replaced with semantic tokens via `useTokens()` hook from `theme/tokens.ts`. The layout now uses `t.surface.raised` for headers and `t.background.primary` for content, with Inter font loading and splash screen gate.

---

## 4. Cross-Squad Risks

### 4.1 Experience Squad Overload — RESOLVED (2026-03-07)

**Original problem:** The Experience squad owned 43 of 59 P0 features (73%), including chat infrastructure, all card components, the insight engine, onboarding, and the design system. This was the single biggest risk to the project.

**Resolution: Approach 4 (Hybrid) — Redistribute + Parallel Agent Streams**

Three changes reduce and rebalance the load:

1. **Design system marked DONE.** Features #126-132 and #135 (8 features) were completed in Phases 1e-1f. Token architecture, NativeWind config, dark mode, banking tokens, and the `useTokens()` hook are all shipped and committed.

2. **Transaction categorisation (#22) moved to Core Banking.** Rule-based categorisation operates on CB's transaction data and merchant mappings. CB owns the data, CB owns the logic.

3. **Remaining 34 EX P0 features split into 4 parallel agent streams.** Each stream runs in an isolated git worktree with shared CLAUDE.md conventions, following Anthropic's recommended [Agent Teams](https://code.claude.com/docs/en/agent-teams) and [worktree patterns](https://code.claude.com/docs/en/common-workflows#run-parallel-claude-code-sessions-with-git-worktrees).

**Revised squad distribution:**

| Squad | P0 Remaining | Notes |
|-------|-------------|-------|
| Core Banking (CB) | 17 | +1 (#22 categorisation) |
| Lending (LE) | 0 | All P1 |
| Experience (EX) | 34 | -8 DONE, -1 moved to CB. Split into 4 parallel streams. |

**Parallel stream breakdown:**

| Stream | Scope | Features | Size |
|--------|-------|----------|------|
| **EX-Infra** | Chat interface, card renderer, confirmation flow, tool registry, streaming, conversation state, system prompt | #89-100 | 12 |
| **EX-Cards** | 8 critical-path cards + remaining chat cards, typing indicator, quick replies, error cards | #5, #12, #19, #25, #26, #91, #93, #97, #99, #67, #68 | 11 |
| **EX-Onboarding** | Welcome → data collection → KYC → provisioning → checklist + auth integration | #69-77, #80, #81, #119 | 10 |
| **EX-Insights** | Spending queries, spike detection, weekly summary, proactive engine, morning greeting, beneficiary AI | #31, #32, #101-107 | 10 |

**Sequencing:**

```
Days 1-5:   EX-Infra ─────────────────────► (foundation, no deps)
Days 4-10:  EX-Cards ──────────────────────► (starts when card renderer lands)
Days 4-10:  EX-Onboarding ────────────────► (starts when chat interface lands)
Days 5-12:  EX-Insights ──────────────────► (starts when tool registry lands)
```

**Why this works with agentic development:**

- Each stream touches **different files**: cards in `components/cards/`, onboarding in `app/(auth)/`, insights in `api/src/tools/experience.ts` and `api/src/services/insights/`, infra in `api/src/routes/chat.ts` and `components/chat/`. Minimal merge conflicts.
- Anthropic's [C compiler case study](https://www.anthropic.com/engineering/building-c-compiler) demonstrated 16 parallel agents producing 100,000 lines — the key insight is parallelism works when agents touch different files.
- Shared CLAUDE.md ensures all streams follow the same token conventions, NativeWind patterns, and component guidelines.
- Git worktrees give each stream full filesystem isolation with shared history.

**What still needs human oversight:**

- Review the **card renderer API** (props contract) before EX-Cards starts
- Review the **tool registry interface** before EX-Insights starts
- The **confirmation flow** (#92) is the most cross-cutting P0 feature — it must be reviewed before any write-operation card ships
- Monitor agent output quality and enforce the PR checklist from FRONTEND-GUIDE.md

**8 critical-path cards** (must be built first in EX-Cards, as they unblock CB and LE demos):
- BalanceCard (P0, exists -- needs redesign to use tokens)
- ConfirmationCard (P0, exists -- needs redesign)
- SuccessCard (P0)
- ErrorCard (P0, exists -- needs redesign)
- InsightCard (P0)
- TransactionListCard (P0, exists -- needs redesign)
- QuickReplies (P0)
- WelcomeCard (P0, onboarding)

### 4.2 Tool Registry as Bottleneck

The tool registry (feature #95) is owned by Experience but depends on tool definitions from all three squads. Current state: 9 tools in `definitions.ts`, all defined by a single developer. The registry needs to scale to 30+ tools across squads.

**Risk:** If tool definitions are not standardised early, squads will define incompatible schemas. The AI's system prompt must describe all tools; inconsistent naming or parameter conventions will confuse the model and degrade response quality.

**Mitigation:** Define a `ToolDefinition` interface in `packages/shared` during foundation. Include: name (snake_case), description (include what the tool returns, not just what it does), input_schema, output_schema, type (read/write), squad owner. Review all tool definitions in a single PR before implementation begins.

### 4.3 Database Schema Dependencies

Tables that span squad boundaries:

| Table | Primary Squad | Also Used By | Conflict Risk |
|-------|--------------|-------------|---------------|
| `messages` | EX | All (tool results stored as content_blocks) | HIGH -- schema changes affect all squads |
| `pending_actions` | EX | CB, LE (write tools create pending actions) | HIGH -- confirmation flow is cross-cutting |
| `profiles` | EX | CB (account references), LE (credit score) | MEDIUM |
| `flex_plans` | LE | EX (card rendering, insight engine) | LOW -- LE owns, EX reads |
| `transactions` | CB | EX (insights), LE (flex eligibility) | MEDIUM -- EX queries extensively |

**Mitigation:** All shared table schemas must be defined in foundation phase. Use Supabase migrations with a single migration directory. Squads propose schema changes via PR; cross-squad tables require two approvals.

### 4.4 Merge Conflict Hotspots

Highest-risk files for concurrent edits:

1. **`apps/api/src/tools/definitions.ts`** -- Every new tool adds to this file. Solution: split into `tools/core-banking.ts`, `tools/lending.ts`, `tools/experience.ts` with an `index.ts` barrel that merges them.
2. **`apps/api/src/server.ts`** -- Every new route registers here. Solution: use Fastify's autoload plugin or a route registration pattern that reads from a directory.
3. **`apps/mobile/app/_layout.tsx`** -- Navigation structure, providers, theme. Solution: extract providers into a `Providers.tsx` wrapper; keep layout minimal.
4. **`packages/shared/src/types/`** -- Shared TypeScript interfaces. Solution: one file per domain (already partially done: `griffin.ts`, `lending.ts`, `api.ts`). Add `chat.ts`, `insights.ts`.
5. **`apps/mobile/global.css`** -- Token definitions. Solution: this file changes rarely after foundation. Lock it early.

---

## 5. Technical Feasibility Flags

### 5.1 SSE Streaming on React Native

React Native does not support `EventSource` natively. The current chat route (`apps/api/src/routes/chat.ts`) will need to stream responses. Options:

- **`react-native-sse`** -- Community library, works but has reconnection issues
- **`fetch` with `ReadableStream`** -- React Native 0.83 (Hermes) supports this via the new streaming fetch API. This is the preferred approach.
- **Fallback:** Long-polling as a degraded mode if streaming proves unreliable

The team must validate streaming fetch works on both iOS and Android with the current React Native 0.83 / Hermes setup during foundation. Do not discover this in sprint 2.

### 5.2 50-Message Conversation Cap

Each tool-using turn adds messages to the history:
- User message (1)
- Assistant message with `tool_use` block (1)
- Tool result message (1)
- If chained tools: additional `tool_use` + `tool_result` pairs

A morning greeting that calls `get_proactive_cards` (1 tool call, 3 messages) followed by a balance check (2 tool calls if it fetches and responds, 5 messages) and a payment (3 tool calls: get_beneficiaries, send_payment, respond_to_user, 7 messages) has consumed 15 messages for 3 user interactions.

**At 50 messages, Alex gets roughly 8-10 meaningful interactions before hitting the cap.**

> **RESOLVED (ADR-05):** Cap increased to 100 messages. At 80 messages, a post-response background job (Haiku) summarises the oldest 60 into a single system message, keeping the last 20 verbatim. This gives Alex ~25 multi-tool interactions per conversation — sufficient for demo and early use.

### 5.3 Proactive Insight Engine Performance

The insight engine must evaluate on app open in <1 second:
- Current balance state
- Upcoming bills (standing orders within 48h)
- Category spending vs. 30-day averages
- Savings milestones since last session
- Recurring payment patterns
- Flex-eligible transactions

This requires 4-6 database queries. On Supabase's free tier with cold connections, each query takes 50-200ms. Six queries sequentially = 300-1200ms. This is borderline.

**Mitigation:** Run all queries in parallel (`Promise.all`). Pre-compute category averages daily (Supabase scheduled function) and cache in a `user_insights_cache` table. On app open, read the cache + real-time balance in 2 queries instead of 6.

### 5.4 Wise API Integration Complexity (P1)

Wise integration is rated P1/L and requires:
- New API client with sandbox credentials
- Recipient management (country-specific field requirements)
- Quote creation with time-limited validity (28 minutes)
- Transfer creation and funding
- Status polling or webhooks

This is effectively a separate integration project. Wise's sandbox is well-documented but has quirks (simulating status transitions requires manual API calls). Budget 3-5 days for a developer who has not used the Wise API before.

### 5.5 Loan Slider Card Real-Time Recalculation

The loan offer card (#47) requires:
- Two sliders (amount, term) with snap points
- Client-side PMT formula: `M = P * [r(1+r)^n] / [(1+r)^n - 1]`
- Debounced state updates as sliders move (every 16ms at 60fps is too frequent)
- Total interest and total repayment recalculated on every change

This is the most interactive card in the catalogue. It needs `react-native-reanimated` for smooth slider animation (already installed) and careful state management to avoid jank. Budget 2 days for this single component.

### 5.6 Hardcoded Styles vs. Token System

The current codebase has components using inline styles with hardcoded hex values (e.g., `_layout.tsx` uses `#1a1a2e`, `#0f0f23`; the existing card components likely have similar patterns). The design token system in `global.css` is well-structured but is not yet consumed by any existing component.

**Risk:** If card components are built before the token migration, the team will accumulate tech debt that requires a second pass to replace hardcoded values with utility classes. This doubles the work.

**Mitigation:** The first foundation task must be: migrate `_layout.tsx` and all existing components to use NativeWind utility classes with semantic tokens. Establish the pattern before any new cards are built. Create a `CONTRIBUTING.md` rule: no hex values in component code; use `className="bg-surface-default text-text-primary"` patterns only.

---

## 6. Demo Readiness Checklist

### 6.1 Five Most Impressive Demo Flows

**Flow 1: Morning Greeting with Proactive Insights**
> Alex opens the app at 8:15am. The AI greets her by name, shows her balance, warns about tomorrow's phone bill, and notes a 40% dining overspend -- all without being asked.

Why it impresses: Shows the "AI-first" proposition instantly. No other banking app does this. The audience sees the value in the first 5 seconds.

Dependencies: #89 (chat), #106 (insight engine), #107 (morning greeting), #102 (spending spike), #5 (balance card), #105 (insight card).

**Flow 2: "Send 50 to James for dinner" -- One Message to Payment**
> Alex types a natural language instruction. The AI resolves the beneficiary, prepares the payment, shows a confirmation card with all details. Alex taps Confirm. Done.

Why it impresses: Demonstrates agentic capability -- the AI uses tools, resolves ambiguity, and executes. Compares favourably to 4-screen payment flow in competitors.

Dependencies: #24 (send payment), #25 (confirmation card), #26 (success card), #31 (fuzzy match), #92 (confirmation flow).

**Flow 3: Full Conversational Onboarding**
> A new user opens the app for the first time. The AI greets them with a branded welcome card, collects information through natural conversation, verifies identity (mocked), provisions a bank account, and shows funding options -- all in under 3 minutes.

Why it impresses: Replaces a multi-screen form with a conversation. Shows trust signals (FSCS, FCA) organically. The getting-started checklist at the end provides direction.

Dependencies: #67-80 (full onboarding flow), #119 (Supabase Auth), #120/121 (banking adapter).

**Flow 4: "How Much Did I Spend on Food?" -- Spending Intelligence**
> Alex asks a natural language question. The AI breaks down food spending by subcategory, compares to last month, identifies the biggest transaction, and offers actionable follow-ups.

Why it impresses: Shows the AI understands financial context, not just data. The comparison and insight layer differentiates from static analytics.

Dependencies: #101 (spending by category), #104 (comparison), #22 (categorisation), #105 (insight card).

**Flow 5: Payday Flow -- Salary Detection to Savings**
> The AI detects a salary credit, celebrates it, shows the updated balance, suggests moving money to savings (based on past behaviour), and executes the transfer with one confirmation tap.

Why it impresses: Demonstrates progressive autonomy -- the AI recognises a pattern and acts on it. Shows the cross-journey connection between accounts, savings, and insights.

Dependencies: #108 (payday detection), #7 (deposit to pot), #25 (confirmation card), #106 (insight engine).

### 6.2 Demo Anti-Patterns to Avoid

1. **Do not demo lending as the first flow.** It is all P1 and the slider card is the hardest component. If it has bugs, it undermines confidence.
2. **Script "New conversation" between major demo flows.** The 100-message cap with summarisation (ADR-05) is generous, but fresh context gives Claude better tool selection accuracy.
3. **Do not show an empty chat on launch.** The proactive greeting must be fast and reliable. If the insight engine is slow, pre-compute the greeting for the demo user.
4. **Do not skip the confirmation card.** The two-phase flow IS the trust story. Rushing past it defeats the purpose.

---

## 7. Recommendations

### 7.1 Top 5 Changes Before Architecture

**1. ~~Fix the NativeWind/Tailwind version references across all documentation.~~ DONE (2026-03-07).**
Downgraded to NativeWind v4.2 (stable) + Tailwind CSS v3.4. No Gluestack. Components built directly from agent-design-instructions.md specs. All docs, configs, and token files updated.

**2. Split the tool definitions file before squads start coding.**
Restructure `apps/api/src/tools/` into per-squad files with a barrel export. Define a shared `ToolDefinition` interface in `packages/shared`. This prevents merge conflicts and establishes ownership. Do this in foundation, not later.

**3. ~~Add banking-specific semantic tokens to `global.css`.~~ DONE (2026-03-07).**
All 11 missing tokens added to `global.css` with light and dark mode variants: money.positive/negative/pending, AI bubble/avatar colours, card accent borders, credit score range colours, overlay.

**4. Validate SSE streaming on React Native 0.83 during foundation.**
Build a minimal proof-of-concept: server streams a simple message, mobile app renders it token-by-token. If `ReadableStream` via fetch does not work reliably on both platforms, identify the fallback (react-native-sse, long-polling) before sprint 1. Do not discover streaming is broken while building the chat interface.

**5. Increase the conversation message cap to 100 or implement summarisation.**
At 50 messages, Alex runs out of context after 8-10 interactions. For the demo, 100 is safe. For anything beyond, implement a summarisation strategy: when history exceeds 80 messages, compress the oldest 60 into a 2-3 sentence summary and keep the most recent 20 verbatim. Add this to the architecture spec.

### 7.2 Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | ~~**Experience squad bottleneck.**~~ **MITIGATED (2026-03-07).** Reduced from 43→34 P0 features (8 DONE, 1 moved to CB). Remaining 34 split into 4 parallel agent streams (EX-Infra, EX-Cards, EX-Onboarding, EX-Insights). | LOW | MEDIUM | Parallel worktree streams. Shared CLAUDE.md for consistency. Human review gates on card renderer API, tool registry interface, and confirmation flow before dependent streams start. |
| R2 | ~~NativeWind v5 preview instability.~~ **RESOLVED.** Downgraded to NativeWind v4.2.2 (stable). Pinned in `package.json`. | LOW | LOW | No action needed. |
| R3 | **Proactive insight engine misses the <1s target.** Six sequential database queries on Supabase free tier under cold-start conditions exceed the budget. | MEDIUM | HIGH | Pre-compute daily aggregates. Use `Promise.all` for parallel queries. Cache user insights. If still slow, degrade gracefully: show greeting with balance only, load insights asynchronously. |
| R4 | **Two-phase confirmation flow takes longer than estimated.** It touches pending_actions table, timeout logic, re-rendering on app reopen, and is a dependency for EVERY write operation across ALL squads. | MEDIUM | HIGH | Build this first in the Experience squad's sprint. No write tool can be demo'd without it. Allocate 3-4 days, not the 1-2 that "L complexity" suggests. |
| R5 | ~~**50-message cap creates poor demo experience.**~~ **RESOLVED (ADR-05).** Cap increased to 100 messages with summarisation at 80. ~25 multi-tool interactions per conversation. | LOW | LOW | No action needed. Summarisation implemented as Foundation Task 5 (06b-foundation-code.md). |

---

## 8. Summary

The plan is ambitious but structurally sound. The 59 P0 features tell a complete story: Alex opens the app, onboards through conversation, checks her balance, sends money, gets spending insights, and manages savings -- all through an AI-first chat interface. The design token system is already implemented in CSS and ready for component consumption.

The remaining issues to resolve before architecture:

1. ~~**Documentation-to-code alignment:** Stack decision made, downgraded to NativeWind v4.2 (stable).~~ **DONE (2026-03-07).**
2. ~~**Design system blockers:** CSS var nesting, dark mode selector, missing deps, shadows, hardcoded colours.~~ **DONE (2026-03-07).** All blockers resolved: flattened CSS vars, `@media (prefers-color-scheme)` dark mode, Inter fonts, Phosphor icons, react-native-svg, runtime tokens, splash screen gate.
3. ~~**Experience squad load:** 73% of P0 features in one squad.~~ **RESOLVED (2026-03-07).** Approach 4 (Hybrid): 8 design system features marked DONE, categorisation moved to CB, remaining 34 EX P0 features split into 4 parallel agent streams (EX-Infra → EX-Cards / EX-Onboarding / EX-Insights). See §4.1.
4. **Technical validation:** SSE streaming on React Native must be validated in foundation (Task 2b in 06b-foundation-code.md), not discovered mid-sprint. ~~50-message cap~~ resolved by ADR-05 (100 messages + summarisation).

Item 4 partially remains (SSE validation). The project is ready for architecture.
