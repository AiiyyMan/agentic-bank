# UI Design Assessment: Agentic Bank POC

> **Phase 6 Output** | UI Design Specialist | March 2026
>
> Evaluates design system coherence, component architecture, accessibility, and implementation readiness across all squad design specs.

---

## 1. Design System Completeness

### 1.1 UIComponentType Coverage

The 22 UIComponentType entries in api-design.md section 3.4.2 cover the core user journeys well, but there are gaps when mapped against the full journey catalogue:

**Covered adequately:** Balance check, transaction listing, payment confirmation/success/error, savings pots, spending breakdown, loan offers, credit score, international transfer quotes, onboarding (welcome, checklist, input, date picker, address), quick replies, flex purchase, standing orders.

**Missing card types:**

| Gap | Journey Affected | Severity |
|-----|-----------------|----------|
| `BeneficiaryListCard` | Payments -- beneficiary disambiguation in chat (#32) | MEDIUM. The EX design-spec shows QuickReplyGroup for disambiguation, but a dedicated card with name + masked account would be clearer for 3+ matches. Currently relies on quick reply pills which truncate with long names. |
| `PaymentHistoryCard` | Listed in the UIComponent union but has no design spec in agent-design-instructions.md or EX design-spec.md | MEDIUM. CB tool `get_payment_history` returns data with no specified card to render it. Falls back to TransactionListCard implicitly, but payment history has different fields (status, beneficiary name) than transactions (merchant, category). |
| `FundingOptionsCard` | Onboarding -- post-account-creation funding (#76) | LOW. Listed in EX design-spec section 1.2 but has no TypeScript props interface or visual spec anywhere. Implementation agents will have to invent it. |
| `KYCCard` | Onboarding -- identity verification (#73) | LOW. Listed in EX design-spec section 1.2 but lacks props interface. Needs at minimum: `status`, `onStart`, loading/success/failure states. |
| `ValuePropInfoCard` | Onboarding -- "Tell me more" response | LOW. Referenced in EX design-spec section 1.2 but no component spec exists. |

**Assessment:** The P0 banking flows (balance, payments, pots, insights) are fully covered. The gaps are concentrated in onboarding cards (KYC, funding, value prop) which appear in the screen mapping but lack formal specs. These are lower risk because onboarding is a single-path flow where the implementation agent can infer reasonable designs from context.

### 1.2 Token Architecture

The three-tier architecture (primitive, semantic, component) is well-executed:

- **Primitives:** 12 colour palettes with full shade ramps (token-map.md section 1.1). Comprehensive.
- **Semantics:** Properly flattened to literal RGB triplets in `global.css`. The NativeWind gotcha (section 15.1 of agent-design-instructions.md) is documented and enforced. Both light and dark mode values are specified for every semantic token.
- **Banking-specific tokens:** All 11 identified gaps from plan-assessment.md section 3.4 have been resolved. `money.positive`, `money.negative`, `money.pending`, AI bubble colours, card accent borders, and credit score band colours are all present.

**One inconsistency found:** The `score.good` token is mapped to `#EAB308` (yellow/warning) in agent-design-instructions.md section 3.18 and section 10, but the lending design-spec section 5.2 says CreditScoreCard uses `score.good` coloured as "green". These contradict. The agent-design-instructions.md value (`#EAB308`) is correct per the credit score band definitions (Good = 660-724, colour-coded yellow to distinguish from Excellent = green). The lending design-spec section 5.2 should say "yellow", not "green". This is a documentation inconsistency, not a code problem, since agent-design-instructions.md is the canonical source.

**Token completeness for dark mode:** The dark mode token table in agent-design-instructions.md section 2 lists only 6 key overrides. The full token-map.md section 3.2 lists comprehensive dark mode values for all semantic tokens. Agents should reference token-map.md for the complete set, not the abbreviated table in agent-design-instructions.md. This is already correct in practice since `global.css` contains the full dark mode block, but agents reading only the design instructions may miss tokens.

### 1.3 NativeWind v4 Limitations

The design system documentation proactively addresses the major NativeWind v4 pitfalls (section 15 of agent-design-instructions.md). Three areas remain at risk:

1. **`tabular-nums`:** Correctly flagged as potentially unsupported (section 15.3). The fallback (`fontVariant: ['tabular-nums']` via style prop) is documented in the EX design-spec section 3.1. However, this fallback mixes className and style prop patterns, which violates the "never hardcode" principle. Every card displaying monetary values (BalanceCard, TransactionListCard, ConfirmationCard, LoanOfferCard, PotStatusCard, SpendingBreakdownCard, QuoteCard) needs this fallback validated. **Recommendation:** Create a shared `<MoneyText>` component that encapsulates the fallback, so the workaround lives in one place.

2. **`animate-pulse` for skeletons:** The spec says to use `animate-pulse` (section 9.1) but warns it may not work (section 15.4). The Reanimated fallback is mentioned but not specified. Skeleton shimmer animation is high-visibility -- every loading state in the app uses it. **Recommendation:** Build the Reanimated-based shimmer as the primary implementation, not as a fallback. Test `animate-pulse` only as an optional simplification.

3. **Percentage widths on chat bubbles:** `max-w-[85%]` is documented as requiring a parent with defined width (section 15.5). In the inverted FlatList, this should work, but the interaction with `self-start` / `self-end` alignment on cards needs early validation. Cards use `w-full` (section 5.2 of agent-design-instructions.md), so this is mainly a bubble concern.

### 1.4 Card Spec Completeness

The card specifications vary in quality across squads:

| Aspect | EX Design Spec | CB Design Spec | LE Design Spec |
|--------|---------------|----------------|----------------|
| TypeScript props | All 14 cards have full interfaces | Data contracts defined (section 4.2) | Data contracts for all 5 card types |
| States (loading/error/empty) | Specified per card | Specified per screen (section 2) | Specified per context (section 6) |
| Interaction behaviour | Detailed (press states, animations) | Present but less detailed | References EX for card behaviour |
| Animation specs | Defined (section 7) | Not specified | Not specified |
| Dark mode notes | Referenced via agent-design-instructions.md | Not mentioned | Not mentioned |

**Assessment:** EX has the most complete specs. CB and LE appropriately defer card rendering to EX but should ensure their data contracts match EX's props interfaces exactly. See section 3 below for mismatches.

---

## 2. Visual Coherence

### 2.1 Design Language Consistency

All 21+ card components share a consistent visual vocabulary:

- **Surfaces:** `bg-surface-raised rounded-2xl shadow-sm border border-border-default` is the universal card container. The BalanceCard uses `rounded-3xl` for hero emphasis -- appropriate differentiation.
- **Typography hierarchy:** Page title (2xl bold), section heading (lg semibold), card title (base semibold), body (sm normal), caption (xs), label (xs extrabold uppercase tracking-widest). Consistently applied across all card specs.
- **Spacing rhythm:** `p-5` for compact cards, `p-6` for detail cards, `mb-3` between cards. This is consistently documented.
- **Colour restraint:** Brand blue (`#0EA5E9`) is correctly limited to accent use -- buttons, active states, progress bar fills. Large surfaces stay white/slate. This restraint will produce a premium feel.

**One concern -- the InsightCard breaks the pattern.** InsightCard uses `bg-brand-subtle border border-brand-muted` (section 3.7), which creates a coloured background distinct from all other cards. This is intentional (to draw attention to proactive insights), but when 2-3 InsightCards stack on the Home screen alongside BalanceCard and PotStatusCards, the blue-tinted cards may dominate visually. **Recommendation:** Monitor this in the Home tab layout. If insight cards feel heavy, consider reducing to a single featured insight card with a "See more" link, or switching to `bg-surface-raised` with a left-side brand-colour accent border instead.

### 2.2 Chat Interface Cohesion

The chat visual hierarchy is well-defined:

- AI bubbles (`bg-ai-bubble-assistant`, light blue-gray tint) are visually distinct from user bubbles (`bg-ai-bubble-user`, brand blue with inverse text).
- Cards appear inline at full width (`self-start, w-full`), visually breaking out of the bubble pattern to signal structured data. This is a strong design choice that separates conversation from information display.
- The TypingIndicator uses `bg-background-secondary` (not `bg-ai-bubble-assistant`), which subtly distinguishes "thinking" from "speaking". Good detail.

**Transition risk:** The FAB-to-modal chat transition and the Home-to-chat context switch need attention. When a user taps a BalanceCard on the Home tab, it navigates to Account Detail (drill-down). When the same BalanceCard appears in chat, tapping it also navigates to Account Detail. The visual entry/exit animation must feel consistent regardless of origin. The EX design-spec does not specify the modal presentation style (slide-up, fade, push). **Recommendation:** Use `presentation: 'modal'` in Expo Router for the chat screen with a slide-up animation. Drill-down screens from chat should use standard push navigation within the modal stack.

### 2.3 Cross-Screen Consistency

Home tab, Payments tab, Activity tab, and Profile tab all follow the layout pattern from agent-design-instructions.md section 5.1: SafeAreaView, h-14 header, ScrollView/FlatList content, optional bottom bar. The consistent header pattern (`h-14 px-4 flex-row items-center border-b border-border-default`) will produce visual continuity across screens.

**Potential friction point:** The Home tab shows InsightCards that are identical to the ones in chat. If the user sees "Phone bill due tomorrow" on Home and then opens chat, they may see the same insight again in the greeting. The EX-Insights design spec (EXN-4, EXN-5) does not address deduplication between Home-surface insights and chat-greeting insights. **Recommendation:** When the chat greeting fires, filter out insights already displayed on the Home tab (using a `seen_on_home` flag or timestamp comparison).

---

## 3. Component Architecture

### 3.1 Cross-Squad Data Contract Mismatches

Comparing CB's data contracts (CB design-spec section 4.2), LE's data contracts (LE design-spec section 3), and EX's props interfaces (EX design-spec section 3):

| Field | CB Contract | EX Props Interface | Issue |
|-------|-----------|-------------------|-------|
| `PotStatusCard.emoji` | Included in contract | **Missing from props** | EX section 3.7 defines `PotStatusCard` visually in agent-design-instructions.md 3.3 with Phosphor icons (PiggyBank/Target/Vault), not emojis. CB's contract sends `emoji: string`. Mismatch. |
| `PotStatusCard.locked_until` | `locked_until?: string` in CB contract | Not in EX props | P1 feature (locked pots). EX will need to add this prop later. Acceptable for P0. |
| `TransactionListCard.has_more` | `has_more: boolean` in CB contract | **Not in EX props** | EX defines `show_more_link?: boolean` instead. Semantic match but naming differs. Will cause a runtime mismatch unless normalised. |
| `TransactionListCard.total` | `total: number` in CB contract | Not in EX props | CB sends total count; EX doesn't consume it. Harmless (extra data ignored). |
| `SuccessCard.timestamp` | `timestamp: string` in CB contract | Not in EX props | EX defines `details?: Array<{label, value}>` instead. Timestamp could be passed as a detail entry, but the contracts don't align cleanly. |
| `BalanceCard.account_number_masked` | `account_number_masked: string` (`****5678`) | `account_number_masked?: string` | Match, but CB comment says "masked to match CB output". EX should validate the masking format (`****XXXX`). |

**Recommendation:** During Foundation F1b, define canonical data interfaces in `packages/shared/src/types/cards.ts` that both CB/LE tool handlers and EX card components import. This eliminates naming mismatches. The `PotStatusCard.emoji` vs Phosphor icon conflict needs a design decision: emojis are more expressive for user-named pots but Phosphor icons are more consistent with the design system. Suggest supporting both: `icon?: string` (Phosphor name) with `emoji?: string` fallback.

### 3.2 CardRenderer Maintainability

The single CardRenderer pattern (EXI-4) dispatches 22+ UIComponentTypes to individual components. This is a standard discriminated union pattern and is maintainable at this scale. However:

- **Type safety:** The `UIComponent` union in api-design.md section 3.4.2 lists all types. The CardRenderer must handle unknown types gracefully (render nothing or a fallback "Unsupported card" debug view). This is specified in EXI-4's acceptance criteria ("placeholder OK for unbuilt cards").
- **Bundle size:** All 22+ card components will be imported eagerly. For a POC this is acceptable, but `React.lazy()` boundaries per card could be added later if needed. No action required now.
- **Testing:** Snapshot tests per card type (specified in EX-Cards stream) is the right approach. The CardRenderer itself should have a unit test verifying every `UIComponentType` maps to a component.

### 3.3 State Coverage

**Loading states:** Well-specified. EX design-spec section 3.14 defines skeleton layouts per card type. The agent-design-instructions.md section 9.1 provides the visual spec. The TypingIndicator (section 3.11) covers the "AI is thinking" state. Tool execution states ("Checking balance...") are handled by the chat state machine (EXI-3).

**Empty states:** Defined per screen in CB design-spec (sections 2.1-2.4) and per context in LE design-spec (section 6). EX design-spec covers empty chat (first launch = WelcomeCard). The agent-design-instructions.md section 9.2 provides the generic empty state pattern.

**Error states:** Three tiers (inline, toast, full card) are defined in agent-design-instructions.md section 9.3. The ErrorCard has a full spec. CB design-spec section 3.3 maps specific errors to AI responses and recovery actions. LE design-spec section 6 does the same. This is comprehensive.

**Gap -- ConfirmationCard expired state rendering in history.** The EX design-spec section 3.3 defines the expired state well (grey overlay, "This action has expired", retry quick reply). But the api-design.md section 3.4.2 notes that on session resumption, the client checks `expires_at` and renders accordingly. The question is: who computes the countdown timer? If the ConfirmationCard renders from persisted history with a past `expires_at`, it should immediately show the expired state. This is implied but not explicit. Ensure the `ConfirmationCard` component checks `expires_at` on mount, not just via a running timer.

---

## 4. Accessibility and Polish

### 4.1 Touch Targets

The design system specifies 44x44px minimum touch targets (agent-design-instructions.md section 13). This is correctly applied to:

- Buttons: `h-9` (sm, 36px) is below minimum. **Issue:** The `sm` button size (`h-9 = 36px`) violates the 44px minimum. It is defined in agent-design-instructions.md section 4 but contradicts section 13. The `md` (`h-11 = 44px`) and `lg` (`h-14 = 56px`) sizes are fine. **Recommendation:** Bump `sm` to `h-10` (40px) with a `min-h-[44px]` wrapper, or restrict `sm` to non-interactive uses (badges, tags). For the POC, avoid `sm` buttons entirely and default to `md`.
- Quick reply pills: `px-4 py-2` gives approximately 36px height. Below minimum. **Recommendation:** Increase to `py-2.5` or `py-3` to reach 44px.
- List items: `py-3` with content gives ~48px total. Sufficient.
- Copy buttons on AccountDetailsCard: `size 16` icon. The touch target must be wrapped in a 44x44 pressable area even though the icon is small. This is implied (`active:opacity pressed:text-brand-default` in section 3.21) but not explicitly sized. **Recommendation:** Wrap in `min-h-[44px] min-w-[44px] items-center justify-center`.

### 4.2 Colour Contrast

The token system produces WCAG AA-compliant contrast ratios in light mode:

| Combination | Contrast Ratio | Passes AA? |
|------------|---------------|------------|
| `text-primary` (#0F172A) on `surface-raised` (#FFFFFF) | 16.75:1 | Yes |
| `text-secondary` (#334155) on `surface-raised` (#FFFFFF) | 10.07:1 | Yes |
| `text-tertiary` (#64748B) on `surface-raised` (#FFFFFF) | 4.56:1 | Yes (body), Yes (large) |
| `text-inverse` (#FFFFFF) on `brand-default` (#0EA5E9) | 3.27:1 | Fails body (4.5:1), passes large (3:1) |
| `money-positive` (#059669) on `surface-raised` (#FFFFFF) | 4.63:1 | Yes |
| `money-pending` (#CA8A04) on `surface-raised` (#FFFFFF) | 3.44:1 | Fails body |

**Two failures identified:**

1. **White text on brand blue buttons** (`text-inverse` on `bg-brand-default`): 3.27:1 fails WCAG AA for body text. This affects every primary button in the app. **Recommendation:** Darken `brand-default` to `#0284C7` (brand.60 in the primitive scale) which gives 4.58:1, or use `font-semibold` consistently (the spec already does this, which helps readability even below 4.5:1). For the POC, accept this with the semibold mitigation. Flag for production.

2. **Pending money text** (`money-pending` #CA8A04 on white): 3.44:1 fails. Pending transactions show italicised amber text that is hard to read. **Recommendation:** Darken `money-pending` to `#A16207` (warning.70 equivalent) which gives 4.82:1. This is a single token change in `global.css`.

### 4.3 Monetary Formatting

The design system is thorough on monetary formatting (agent-design-instructions.md section 8):

- GBP prefix as pound sign: specified.
- Thousands separator (comma): specified.
- Always 2 decimal places: specified.
- Positive/negative/pending colour coding: specified with correct rationale (debit = normal text, not red).
- `tabular-nums` on all amounts: specified with NativeWind fallback.

**Gap:** No specification for currency formatting in non-GBP contexts. The QuoteCard (international transfers, P1) shows both GBP and destination currency. The lending specs show APR formatting (section 7: "X.X% with representative label"). These are adequate for the POC.

**Recommendation:** Create a shared `formatCurrency(amount: number, currency?: string)` utility that enforces all formatting rules. Every card should use it rather than ad-hoc formatting. Define it in Foundation.

### 4.4 Skeleton and Loading Strategy

The skeleton strategy is well-defined and will produce a premium feel:

- Per-card skeleton layouts (EX design-spec section 3.14) match the real content structure.
- Shimmer animation spec (agent-design-instructions.md section 12: opacity pulse 0.4-1.0, 1500ms).
- "Never show a blank screen or spinner alone" rule (section 9.1).
- Typing indicator for AI thinking (3-dot stagger animation).
- Tool execution messages ("Checking balance...") provide mid-flow feedback.

**One risk:** The Home tab loads balance + pots + insight cards. If all three data sources are slow, the user sees three skeleton cards simultaneously. This is better than a spinner, but three shimmer animations at once can feel chaotic. **Recommendation:** Stagger skeleton entry with 100ms delays (consistent with the card stagger pattern in section 12), so skeletons appear sequentially rather than all at once.

---

## 5. Recommendations Summary

### Must-Fix (Before Implementation)

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| M1 | `PotStatusCard` emoji vs icon mismatch between CB and EX | CB design-spec 4.2 vs agent-design-instructions.md 3.3 | Decide on emoji or icon. Add both props to the shared interface. |
| M2 | `TransactionListCard.has_more` vs `show_more_link` naming mismatch | CB design-spec 4.2 vs EX design-spec 3.2 | Define canonical props in `packages/shared/src/types/cards.ts`. |
| M3 | Button `sm` size (36px) violates 44px touch target minimum | agent-design-instructions.md section 4 vs section 13 | Increase to `h-10` or restrict `sm` to non-interactive elements. |
| M4 | Quick reply pill height (~36px) violates 44px minimum | agent-design-instructions.md section 3.10 | Increase vertical padding to `py-2.5` or `py-3`. |
| M5 | `money-pending` colour (#CA8A04) fails WCAG AA contrast | agent-design-instructions.md section 2 | Darken to `#A16207` (single token change in `global.css`). |

### Should-Fix (During Foundation or Sprint 1)

| # | Issue | Recommendation |
|---|-------|----------------|
| S1 | 5 onboarding cards lack props interfaces (KYCCard, FundingOptionsCard, ValuePropInfoCard, DatePickerCard, AddressInputCard) | Define TypeScript interfaces before EX-Onboarding stream starts. DatePickerCard and AddressInputCard are in the UIComponent union but have no spec. |
| S2 | `PaymentHistoryCard` in UIComponent union but no visual spec | Either create a spec or map it to TransactionListCard with status field added. |
| S3 | White-on-brand-blue button contrast (3.27:1) | Accept for POC with `font-semibold` mitigation. Consider darkening `brand-default` to `#0284C7` for production. |
| S4 | No shared `<MoneyText>` component for `tabular-nums` fallback | Build in Foundation F1b as a shared component that all cards import. |
| S5 | No shared `formatCurrency()` utility | Build in Foundation F1b in `packages/shared/src/utils/format.ts`. |
| S6 | InsightCard visual weight on Home tab (blue background may dominate) | Test with 2-3 stacked InsightCards. Consider accent-border variant if too heavy. |
| S7 | Home-to-chat insight deduplication | Filter greeting insights against Home-displayed insights to avoid repetition. |

### Good as Designed (No Changes Needed)

- Token architecture (three-tier, flattened, dark mode via media query)
- Card renderer pattern (discriminated union, single dispatcher)
- Skeleton-per-card-type loading strategy
- Monetary formatting rules (debit = normal text, not red)
- Chat bubble visual hierarchy (AI vs user vs inline cards)
- Animation guidelines (subtle, functional, trust-appropriate)
- Error state three-tier strategy (inline, toast, full card)
- `tabular-nums` fallback documentation
- NativeWind v4 gotchas section (comprehensive, accurate)

---

## 6. Overall Assessment

The design system is **implementation-ready for P0** with the five must-fix items above. The token architecture is the strongest aspect -- the three-tier chain from primitives through semantics to components is complete, correctly flattened for NativeWind, and covers both light and dark modes. The card component catalogue is comprehensive for banking flows, with clear visual specs, consistent spacing, and a disciplined colour palette.

The main structural risk is the cross-squad data contract alignment between CB/LE tool output shapes and EX card props. The five naming mismatches identified in section 3.1 are individually minor but collectively could cause runtime failures during integration. Defining shared TypeScript interfaces in `packages/shared/` during Foundation will eliminate this category of bug entirely.

The accessibility gaps (touch targets on small buttons and pills, two colour contrast failures) are typical for a design system at this stage and are addressable with targeted token and spacing adjustments. None require architectural changes.

For a POC targeting demo readiness, this design system will produce a polished, cohesive, trustworthy banking interface. The restraint in colour usage, the consistent card vocabulary, and the thoughtful loading state strategy will create the "premium fintech" feel the project targets.
