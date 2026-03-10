# UX Research Assessment

> **Phase 6 Output** | UX Researcher | March 2026
>
> Evaluates the envisioned user experience against real user needs, competitive reality, and journey quality. Evidence-based, referencing Phase 1 research and competitor analysis.

---

## 1. Findings

### 1.1 User Needs Alignment

**The planned features address core pain points well, with some gaps.**

The persona "Alex" maps closely to the 22-35 UK young professional segment validated in market research (84% check balances digitally, 83% pay bills digitally -- ux-benchmarks.md SS2.5). The five pain points identified -- balance visibility, inconsistent saving, payment friction, international transfer complexity, and passive banking -- are directly addressed by P0 scope:

- **Balance visibility**: Solved. Balance check via chat is the simplest journey (1 message, 1 card). The Home screen also surfaces balance + pots at a glance, matching Monzo/Starling's "balance as hero element" pattern.
- **Payment friction**: Solved well. "Send GBP50 to James" completing in 1 message + 1 confirmation tap is genuinely fewer steps than Monzo (3-4 screens) or Revolut (3-4 screens). This is the strongest competitive advantage in the current design.
- **Inconsistent saving**: Partially solved. Pot creation and transfers via chat are P0. But auto-save rules and round-ups -- the features that make saving effortless and habitual -- are P1. Market research shows round-ups and automated saving are among the strongest engagement drivers (market-research.md SS2.3). Without automation, pots require the same manual discipline Alex already struggles with at Monzo.
- **International transfers**: Deferred to P1. This is acceptable for a POC, but the product brief positions it as a key differentiator against Monzo + Wise. Leaving it out of P0 weakens the switching story.
- **Passive banking**: Solved. The proactive insight engine (spending spikes, bill reminders, weekly summaries, morning greeting) directly addresses "my bank never tells me anything useful." This is genuinely differentiated -- no UK neobank delivers insights conversationally today.

**User needs identified but not addressed in current scope:**

- **Bill splitting / P2P payments**: Marked as "Expected" in the market research competitive table, used 2-5x monthly by the target demographic. Entirely absent from all priority tiers. For a 22-35 social demographic, this is a notable omission.
- **Confirmation of Payee (CoP)**: UK regulatory requirement for payment verification. Not mentioned in any PRD. Even as a POC, showing the payee name check pattern ("Is this the right James Mitchell?") would demonstrate regulatory awareness.
- **Statement export (PDF/CSV)**: P2. Acceptable for POC, but users expect it for tax/landlord purposes.
- **Subscription tracking**: P2. Increasingly important as subscription fatigue grows. Monzo and Emma do this well.

**Is the AI-first approach the right call for banking?**

Yes, with caveats. The evidence supports this:

1. No UK neobank occupies the AI-first position (ux-benchmarks.md SS3.2 gap analysis). This is a genuine white space.
2. Bank of America's Erica has 50M users and 3B+ interactions, with 60% of interactions being proactive insights -- proving demand for AI-driven banking.
3. Hey George (Erste Bank) won a UX Design Award in 2025 after overcoming chatbot trust deficits, demonstrating the approach can work if executed well.
4. The target demographic (22-35, tech-savvy, uses ChatGPT daily) is the most receptive to conversational interfaces.

**Risks of AI-first:**

- **Latency tolerance is low in banking.** The product brief targets < 500ms TTFT and < 2s for read tools. If these targets are missed in practice (LLM cold starts, network variability), the experience will feel slower than tapping a Monzo button. The `thinking` event at < 100ms is a smart mitigation, but the overall round-trip for a balance check (message send -> SSE stream -> tool execution -> card render) will be 2-4 seconds versus < 1 second on Monzo's home screen tap. Users will feel this.
- **Discovery problem.** New users will not know what the AI can do. Quick reply pills partially address this, but the onboarding checklist needs to actively demonstrate capabilities, not just list them. The current checklist (verify identity, fund account, add beneficiary, set up pot, first payment, explore features) is functional but does not create a "wow, that was helpful" moment (the Hey George standard).
- **Regression to chat support mental model.** Users conditioned by poor bank chatbots will initially treat the AI as a help desk, not a primary interface. The welcome flow and early interactions must aggressively demonstrate transactional capability, not just Q&A.

**Chat-based onboarding assessment:**

The conversational onboarding flow is well-designed. The 10-step state machine (STARTED through ONBOARDING_COMPLETE) with persistence at each step means users can close and resume -- matching the "save progress automatically" best practice from Monzo/Revolut (ux-benchmarks.md SS2.1). The target of < 3 minutes is ambitious but achievable given mocked KYC. One concern: collecting email + password via an InputCard embedded in chat is awkward. Users expect a standard form for credentials. The login screen correctly uses a form; the signup flow should too, with the AI conversation resuming after account creation.

### 1.2 Competitive Positioning

**Genuinely differentiated:**

1. **AI as primary interface** -- no UK competitor does this. Monzo, Starling, and Revolut all have chatbots buried in support menus. Agentic Bank's chat-as-home-screen is structurally different.
2. **Proactive conversational insights** -- Monzo delivers insights via static Trends screens and push notifications. Agentic Bank delivers them as conversational cards with immediate action options ("Your dining spend is up 40%. Want a breakdown?"). This is materially better.
3. **Conversational payments** -- "Send GBP50 to James for dinner" completing in 1 message + 1 tap is the shortest payment journey of any UK neobank.
4. **Two-phase confirmation with context** -- The ability to interrupt a payment flow ("Wait, what's my balance?"), get an answer, and resume ("OK, go ahead") is something no traditional banking UI can do. This is a genuine UX innovation.

**Table stakes that are covered:**

Balance visibility, savings pots with goals, transaction categorisation, real-time balance, skeleton loading states, dark mode (token system ready), instant notifications (architecture planned).

**Table stakes that are missing or weak:**

| Feature | Status | Risk |
|---------|--------|------|
| Fee-free international card spend | Not in scope (no card issuing) | Low for POC |
| Bill splitting / P2P | Absent from all tiers | Medium -- expected by target demo |
| Card freeze/unfreeze | P1 | Low |
| Round-up savings | P1 | Medium -- key engagement driver |
| Budgeting / spending targets | P2 | Low for POC |
| Push notifications | P1 | Medium -- table stakes for neobanks |
| Direct debit management | P2 | Low for POC |

**Is the AI chat a differentiator or a gimmick?**

It is a genuine differentiator if -- and only if -- the response times are fast enough that conversations feel snappier than tapping through screens. The product brief's examples (balance check, payment, spending query) all show interactions that are objectively fewer steps than the equivalent Monzo flows. But the advantage evaporates if each step takes 3-4 seconds of AI processing. The architecture's prompt caching (ADR-16, 62% cost reduction) and pre-computed insight caches help, but real-world SSE streaming on React Native 0.83 remains the highest-risk validation (correctly flagged as Task 2b in Foundation).

The risk of gimmick perception is real for one specific scenario: users who open the app purely to check their balance (2-3x daily, the most common banking action). On Monzo, this takes 0 seconds -- the balance is right there. On Agentic Bank, the Home screen shows balance + pots, which is equivalent. But if the user opens the chat instead, they must type "what's my balance?" and wait for a response. The decision to make the Home tab a dashboard (not the chat) is correct -- it avoids forcing a conversation for the most frequent action.

### 1.3 Journey Quality

**First Open (new user):**

Well-designed. WelcomeCard with value propositions, tappable bullets for exploration, clear "Let's open your account" CTA. The conversational onboarding (name -> email/password -> DOB -> address -> KYC -> provisioning -> funding -> checklist) follows a logical order. The 4 tappable value props (speed, control, FSCS, FCA) build trust before asking for personal information. One improvement: add a time estimate ("Takes about 2 minutes") -- Monzo's "1 section down, 3 to go" progress pattern is evidence-based (ux-benchmarks.md SS2.1).

**Check Balance (most frequent action):**

Two paths, both good. (1) Home tab shows balance card immediately on launch -- zero friction, matching Monzo. (2) Chat: "What's my balance?" returns a BalanceCard in ~2 seconds. The Home tab path is critical because 84% of balance checks are habitual, not conversational.

**Send Payment:**

The strongest journey in the design. "Send GBP50 to James for dinner" triggers beneficiary resolution, prepares a ConfirmationCard, and completes with one tap. The context-switch example (checking balance mid-payment, then resuming) is well-thought-out and demonstrates genuine agentic capability. However, the two-phase confirmation for every payment -- including small amounts to known beneficiaries -- may feel heavy for frequent users. Monzo requires confirmation but not via a card with a 5-minute timer. Consider a lighter confirmation for small amounts to known payees (< GBP50 to a previously-paid beneficiary).

**Explore Spending:**

Good. "How much did I spend on food this month?" returns a breakdown with comparison to last month. The InsightCard format (title + body + action link) is clear. The proactive morning greeting with spending insights is differentiated. However, the P0 scope lacks chart cards (P2), which means spending data is presented as text + numbers rather than visually. Monzo's Trends screen with ring charts is the benchmark here. For a demo, visual spending breakdowns would be more impressive than text-based summaries.

**Apply for Loan:**

All P1, so not in initial scope. The design is sound: conversational eligibility check, slider card for amount/term, confirmation card for application. The decline-with-alternative pattern ("I can't offer GBP20,000, but I can offer up to GBP8,000") is empathetic and follows Zopa's best practice.

**Navigation assessment -- 4-tab + Chat FAB:**

The revised navigation (Home dashboard + Payments + Activity + Profile, with Chat as a floating modal) is a significant improvement over the earlier design where chat was the Home tab. It correctly solves the "empty chat" problem for new or low-activity users by putting balance + pots + insight cards on the Home dashboard. The ChatFAB visible on all tabs ensures the AI is always accessible without being the sole interface. This hybrid approach is well-reasoned.

One concern: the FAB overlaying the tab bar may create visual clutter, especially on smaller screens. It also partially obscures the Profile tab icon on the right side. Material Design guidance suggests FABs should be placed above (not overlapping) bottom navigation.

**Home screen comparison to competitors:**

| Element | Agentic Bank | Monzo | Starling | Revolut |
|---------|-------------|-------|---------|---------|
| Balance | Card (prominent) | Large number (hero) | Large number | Card with crypto |
| Pots/Savings | Mini progress bars below balance | Horizontal carousel | Spaces section | Vaults section |
| Spending insight | Proactive InsightCards | Trends tab (separate) | In-line summary | Limited |
| Quick actions | ChatFAB + insight action links | Action bar (Send, Request) | Action bar | Action bar |
| Transaction list | Activity tab (separate) | Below balance | Below balance | Below balance |

The Home screen is competitive. The main difference is that Agentic Bank surfaces proactive insights directly on the Home tab (rather than behind a Trends tab), which is arguably better for the target persona who "never opens the insights tab." The trade-off is less immediate transaction visibility -- users must tap to the Activity tab. This is acceptable because the morning greeting in chat provides a transaction summary.

### 1.4 Experience Risks

**Risk 1: AI response latency undermines the value proposition.**
Severity: HIGH. If the end-to-end time from message send to card render exceeds 3 seconds consistently, users will perceive the AI as slower than traditional UI. The architecture's mitigations (< 100ms thinking event, prompt caching, pre-computed insights) are well-designed but unvalidated on device. SSE streaming on React Native 0.83 is the single highest technical risk to UX quality.

**Risk 2: Card type proliferation creates cognitive load.**
Severity: MEDIUM. The design specifies 19 UIComponentTypes (balance_card, transaction_list, confirmation_card, success_card, error_card, insight_card, pot_status_card, spending_breakdown_card, quick_reply_group, welcome_card, checklist_card, input_card, quote_card, standing_order_card, flex_options_card, auto_save_rule_card, loan_offer_card, credit_score_card, payment_history_card). While each serves a purpose, users will encounter many distinct card formats in a single session. If the visual language is not extremely consistent (same border radius, same shadow, same spacing rhythm), the chat will feel like a card-dispensing machine rather than a conversation. The "no card > irrelevant card" principle in the product brief is the right instinct but requires rigorous enforcement during implementation.

**Risk 3: Confirmation fatigue for frequent users.**
Severity: MEDIUM. Every write operation -- including moving GBP10 to a savings pot -- requires a ConfirmationCard with Confirm/Cancel buttons and a 5-minute timer. For Alex's daily pot transfers and weekly James payments, this will feel bureaucratic after the first week. The design correctly identifies biometric gates for >= GBP250, but does not address lightweight confirmation for small, repeated actions. Recommendation: for amounts < GBP50 to previously-used beneficiaries or own pots, consider a single inline "Confirm" button without the full card treatment.

**Risk 4: Accessibility gaps in current specs.**
Severity: MEDIUM. The design spec covers the basics well (44x44px touch targets, WCAG AA contrast, accessibilityLabel on icons, monetary amounts read as words, reduced motion support). Gaps:
- **Screen reader navigation order in chat**: FlatList with inverted rendering may confuse VoiceOver focus order. Needs explicit testing.
- **Keyboard navigation**: No mention of hardware keyboard support (relevant for iPad, Bluetooth keyboard users).
- **Dynamic type / font scaling**: Not mentioned. If Inter is loaded at fixed sizes without respecting system font scaling preferences, users with accessibility settings will have a degraded experience.
- **Colour-blind users**: The spending breakdown uses "category colours" but no mention of patterns or icons as redundant coding. The credit score gauge relies on colour bands (green/yellow/orange/red) without secondary indicators.

**Risk 5: Empty or repetitive chat feed.**
Severity: LOW-MEDIUM. If Alex opens the app multiple times per day, the chat feed will accumulate greeting messages, balance cards, and insight cards. By the third morning check, seeing "Good morning, Alex! Here's your balance:" again may feel robotic. The design has no mention of greeting variation, conversational memory of prior greetings, or suppression of redundant insights already seen. The summarisation at 80 messages helps with context window management but not with perceived repetitiveness.

**Risk 6: Missing features users expect from a modern UK neobank.**
Severity: MEDIUM for POC demo context. Key omissions:
- **Push notifications** (P1) -- without these, the "proactive" promise is limited to in-app. Alex must open the app to learn her bill is due tomorrow.
- **Card management** (P1) -- no virtual card display, no freeze/unfreeze, no PIN view. Users associate their bank with their card.
- **Bill splitting** (absent) -- the most social banking feature for 22-35s.
- **Open Banking** (absent) -- Alex's use case explicitly involves a legacy bank for salary + Monzo for spending. Without aggregation, the "one app for everything" promise is incomplete.

---

## 2. Risks (Ranked)

| # | Risk | Severity | Likelihood | Mitigation |
|---|------|----------|------------|------------|
| R1 | AI response latency exceeds 3s, making chat slower than traditional UI | High | Medium | SSE validation in Foundation (Task 2b). Fallback: aggressive caching, simpler prompts, direct API calls for common queries |
| R2 | Users treat AI as support chatbot, not primary interface | High | High | Onboarding must demonstrate transactional capability early. First action prompt should be "Send money" or "Create a pot" -- not "Ask me anything" |
| R3 | Confirmation fatigue on repeated small actions | Medium | High | Differentiate confirmation UX by amount/recipient familiarity. Inline confirm for < GBP50 to known payees |
| R4 | Card type proliferation creates visual noise | Medium | Medium | Strict visual consistency. All cards share identical border radius, shadow, spacing. Limit to 2-3 card types per response |
| R5 | Missing push notifications limit proactive value | Medium | Certain (P1) | Prioritise push notifications early in P1. Without them, proactive insights only work when the app is open |
| R6 | Bill splitting absence weakens social banking story | Medium | Certain (not planned) | Add as P1 or acknowledge as out-of-scope for POC. Do not position as "one app for everything" without it |
| R7 | Screen reader and dynamic type gaps | Medium | Medium | Add explicit accessibility test plan for VoiceOver with inverted FlatList. Test dynamic type scaling |
| R8 | Chat feed becomes repetitive with daily use | Low-Medium | Medium | Vary greeting language. Track which insights have been shown. Suppress duplicate insight types within 24 hours |

---

## 3. Recommendations

### Recommendation 1: Validate latency on-device before committing to chat-first for all journeys

**What:** During Foundation Task 2b (SSE streaming validation), measure the full round-trip from message send to card render on a physical device over a cellular connection. If the p95 exceeds 3 seconds for a balance check, add a "fast path" where the Home tab BalanceCard calls the REST endpoint directly (bypassing the AI) for the most frequent action.

**Why:** The AI-first proposition lives or dies on perceived speed. Monzo loads balance in < 500ms. If the AI path takes 3-4 seconds, users will learn to avoid chat for simple queries -- undermining the entire value proposition. The Home tab dashboard is the safety net; make sure it is excellent.

**Evidence:** Market research shows balance checking is the most frequent banking action at 2-3x daily (market-research.md SS2.5). UX benchmarks show payment notifications are "2x faster" at challengers than legacy banks (ux-benchmarks.md SS2.2). Speed is the baseline expectation.

### Recommendation 2: Differentiate confirmation UX by risk level

**What:** Implement two tiers of write confirmation:

- **Full ConfirmationCard** (current design): Amounts >= GBP50, new beneficiaries, loan applications, first-time payees. Shows all details, Confirm/Cancel buttons, 5-minute timer.
- **Inline confirmation**: Amounts < GBP50 to previously-paid beneficiaries, pot transfers to own pots. Single line: "Move GBP20 to Holiday Fund? [Yes] [No]" -- no card, no timer, no balance-after calculation.

**Why:** The two-phase confirmation is a security invariant and should remain for meaningful transactions. But applying the full card treatment to a GBP10 pot transfer that Alex does weekly will create friction fatigue. Monzo's confirmation is a simple review screen, not a timed card. The UX benchmarks note that "positive friction" is important for payments (ux-benchmarks.md SS2.3) but should be proportional to risk.

**Evidence:** Product brief Principle 5 ("Progressive Autonomy") already envisions reducing friction over time. Start with a lighter confirmation for low-risk actions rather than waiting for the AI to learn patterns.

### Recommendation 3: Strengthen the onboarding "aha moment"

**What:** After account provisioning, instead of going straight to the checklist, trigger a live demonstration: the AI proactively says "Your account is ready! Let me show you what I can do" and executes a balance check (showing the GBP0 balance card), then says "When money arrives, I'll notice. I also track your spending, remind you about bills, and help you save. Try asking me something!" with quick replies: "Show me my account details" / "Create a savings pot" / "What else can you do?"

**Why:** The Hey George case study (ux-benchmarks.md SS3.1) found that the key to overcoming chatbot distrust was "replacing bad memories with memorable moments." The current onboarding ends with a static checklist, which does not create a "wow" moment. A live demonstration of the AI doing something useful -- even with a zero balance -- establishes the mental model of "this is a tool, not a chatbot."

**Evidence:** Erica's success is attributed to 60% of interactions being proactive (ux-benchmarks.md SS3.2). The first interaction sets expectations. If the first post-onboarding experience is a checklist, users will categorise the AI as a to-do list manager, not a personal banker.

### Additional quick wins (implementation-level):

1. **Add time estimate to onboarding welcome**: "Takes about 2 minutes" below the CTA. Monzo's sectioned progress is evidence-based for reducing drop-off.
2. **Vary morning greetings**: Maintain a small rotation of greeting templates ("Morning, Alex", "Hey Alex, here's your update", "Happy Wednesday, Alex") to avoid the robotic same-greeting-daily problem.
3. **Add colour-blind-safe secondary indicators**: Use icons or patterns alongside colour in the credit score gauge and spending category dots. This is cheap to implement and meaningfully improves accessibility.
4. **Test FAB placement on small screens**: Verify the ChatFAB does not obscure the Profile tab icon on devices < 375px wide. Consider placing it above the tab bar rather than overlapping.

---

*Assessment complete. The envisioned experience is well-positioned in a genuine market gap. The primary risk is execution quality on latency and streaming reliability -- the design decisions are sound, but the AI-first promise demands performance that has not yet been validated on-device.*
