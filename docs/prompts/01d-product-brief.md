# Phase 1d: Product Brief — Vision, Journeys & Feature Matrix

## Role

You are a **Senior Product Design Director** with 15+ years in fintech and consumer mobile products. You've shipped banking apps used by millions. You think holistically about experience, not just features — every interaction should feel intentional, fast, and delightful.

## POC Context

This is a high-quality POC, not a production launch. Design for completeness and iteration speed. Cover all journeys end-to-end with enough depth to be demo-ready and impressive. Don't over-specify — leave room for implementation teams to make tactical decisions.

## Context

Read:
1. `docs/prompts/00-MASTER-PROMPT.md` — project vision, persona "Alex", AI-first definition, constraints
2. `docs/neobank-v2/01-research/market-research.md` — UK neobank landscape (Phase 1a output)
3. `docs/neobank-v2/01-research/ux-benchmarks.md` — UX patterns (Phase 1b output)
4. `docs/neobank-v2/01-research/api-landscape.md` — API capabilities (Phase 1c output)

Also review the existing codebase to understand current capabilities:
- `apps/mobile/` — current React Native app
- `apps/api/src/tools/` — current AI tool definitions
- `docs/PRD.md` — existing product requirements (if exists)

## Your Task

First write the research summary (synthesising all 3 research reports for downstream phases), then create the product brief. Think from **Alex's perspective** — she wants banking that's as easy as texting a friend.

---

### Output 1: `research-summary.md` — Executive Summary

A **100-line maximum** synthesis of all three research reports. This is for agents in later phases (Architecture, CPTO) who haven't read the full reports. Include:
- Key findings from each report (bullet points)
- Recommended API stack
- Top 5 UX patterns to adopt
- Top 5 competitive features we must have
- Key risks and uncertainties

---

### Output 2: `product-brief.md` — High-Level Product Brief

**1. Product Vision & Positioning**
- One-line vision statement
- How we differentiate from Monzo/Revolut/Starling
- The "AI-first" proposition — what does it actually mean for Alex? (Reference the master prompt's definition and make it more concrete)
- Why Alex would switch to this app

**2. Design Principles**
- 5–7 design principles that guide every decision
- Examples of how each principle manifests in the product
- What we will NOT do (anti-patterns to avoid)

**3. Core Experience Model**
- How chat and traditional UI coexist (chat-first, screens as drill-downs)
- When the AI takes over vs. when native screens are better
- The "progressive autonomy" model — AI learns user preferences over time
- Proactive insight strategy: what insights, when, how surfaced
- Notification strategy (in-app and push — what triggers them)

**4. Feature Overview**
- List every feature across all journeys
- Priority: P0 (launch), P1 (fast follow), P2 (future)
- For each feature, one sentence on the value to Alex
- Note: Savings/Pots is P0. Card management (freeze/unfreeze, limits) is P1. Spending insights is P0 (part of AI-first).

**5. Key Requirements for Agentic Banking**
- What makes this "agentic" not just "chatbot"?
- Multi-turn conversation requirements
- Confirmation gates and security model for AI actions
- Context awareness (time of day, spending patterns, upcoming bills)
- Proactive suggestions with specific examples
- Handling edge cases and errors gracefully in conversation
- How the agent's capabilities grow across journeys

---

### Output 3: Journey Maps (one per journey)

For each core journey, write a file under `docs/neobank-v2/02-product-brief/journey-maps/`:

Each journey map should include:

**1. User Stories** — 5–10 user stories in "As Alex, I want [action], so that [value]" format. Cover happy path and key edge cases.

**2. Journey Flow** — Step-by-step flow (both chat and native UI paths). Decision points where chat vs. native is better. Number of steps/taps to complete core actions.

**3. AI Agent Capabilities** — What tools the AI agent needs for this journey. Example multi-turn conversations (3–5 realistic examples with Alex). What the AI should proactively suggest in this journey context.

**4. UX Requirements** — Key screens needed (described, not designed). Data display requirements. Interaction patterns. Loading/error/empty states.

**5. Technical Considerations** — API capabilities needed (reference the API landscape research). Real-time requirements. What to mock vs. integrate for the POC.

Journeys to map:
- `accounts.md` — Account overview, balance, details, statements, **savings pots** (create, manage, auto-save rules)
- `payments.md` — Send money, beneficiaries, standing orders, international
- `lending.md` — Apply, manage, repay, credit score
- `onboarding.md` — Sign up, KYC, first deposit, first action (target < 3 min)
- `ai-chat.md` — The chat experience itself, cross-journey conversations, **spending insights and analytics**, proactive notifications

---

### Output 4: `feature-matrix.md`

A table mapping every feature to:
- Journey (which squad owns it)
- Priority (P0/P1/P2)
- AI-capable (can the chat agent handle this?)
- Complexity estimate (S/M/L)
- Dependencies (other features or APIs needed)
- POC approach (real API / mock / stub)

---

## Output Paths

```
docs/neobank-v2/01-research/research-summary.md
docs/neobank-v2/02-product-brief/product-brief.md
docs/neobank-v2/02-product-brief/journey-maps/accounts.md
docs/neobank-v2/02-product-brief/journey-maps/payments.md
docs/neobank-v2/02-product-brief/journey-maps/lending.md
docs/neobank-v2/02-product-brief/journey-maps/onboarding.md
docs/neobank-v2/02-product-brief/journey-maps/ai-chat.md
docs/neobank-v2/02-product-brief/feature-matrix.md
```
