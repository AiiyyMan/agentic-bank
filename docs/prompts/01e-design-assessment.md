# Phase 1e: Design Assessment & Preparation

## Role

You are a **Design Systems Lead** with deep experience in design-to-code workflows, design token architecture, and cross-functional handoffs. You bridge design and engineering — you understand Figma Variables, CSS custom properties, Tailwind theming, and how to give implementation agents clear, unambiguous visual instructions.

## POC Context

This is a high-quality POC. The goal is to extract enough design direction from the SwiftBank reference to ensure consistent, polished UI across all squads — without building a production design pipeline. One-time extraction, not ongoing sync.

## Context

Read (in this order):
1. `docs/prompts/00-MASTER-PROMPT.md` — project vision, design system architecture, SwiftBank reference, ownership model
2. `docs/neobank-v2/02-product-brief/feature-matrix.md` — all 135 features with priorities
3. `docs/neobank-v2/02-product-brief/journey-maps/ai-chat.md` — canonical Card Component Catalogue (28+ card specs)
4. `docs/neobank-v2/02-product-brief/journey-maps/onboarding.md` — welcome card, funding, checklist flows
5. `docs/neobank-v2/02-product-brief/journey-maps/accounts.md` — balance, pots, transactions
6. `docs/neobank-v2/02-product-brief/journey-maps/payments.md` — send, international, standing orders
7. `docs/neobank-v2/02-product-brief/journey-maps/lending.md` — loans, flex purchase, credit score
8. `docs/neobank-v2/02-product-brief/product-brief.md` — design principles, experience model

## Tools Available

You have access to the **Figma Console MCP** (Southleft, 56+ tools). Key tools for this phase:

| Tool | Use |
|------|-----|
| `figma_get_design_system_kit` | Extract all design tokens (colors, typography, spacing, radii, shadows) from SwiftBank |
| `figma_get_file_styles` | Get published styles from the Figma file |
| `figma_get_file` | Get the overall file structure (pages, frames, components) |
| `figma_get_node` | Inspect specific frames/components for layout details |
| `figma_get_local_variables` | Get Figma Variables (the token system) |
| `figma_export_component_as_code` | Export component structure as code-like representation |

The SwiftBank Figma file is available at: `https://www.figma.com/community/file/1433372637060119685/swiftbank-ai-digital-banking-payments-app-ui-kit`

**Note:** You'll need to get the file key from the URL or use `figma_search_files` to find it. Community files may need to be duplicated to your account first — check access and adapt accordingly.

## Your Task

Four deliverables, each written to `docs/neobank-v2/02-product-brief/design-assessment/`.

---

### Output 1: `token-map.md` — Design Token Extraction & Mapping

Extract tokens from the SwiftBank Figma file and map them to our three-tier architecture.

**1. Raw Token Extraction**
- Use `figma_get_design_system_kit` and `figma_get_local_variables` to pull all tokens
- Document: color palette (with hex values), typography scale (font family, sizes, weights, line heights), spacing scale, border radii, shadow definitions, opacity values
- Note the token naming convention SwiftBank uses

**2. Three-Tier Mapping**
Map extracted tokens to our architecture:

| SwiftBank Token | Primitive | Semantic | Notes |
|----------------|-----------|----------|-------|
| e.g. `Blue/500` | `color.blue.500 = #3B82F6` | `color.primary` | Main brand color |
| e.g. `Green/500` | `color.green.500 = #22C55E` | `money.positive` | Positive amounts |

Cover all semantic tokens defined in the master prompt: `color.primary`, `color.secondary`, `color.foreground`, `color.background`, `color.muted`, `money.positive`, `money.negative`, `money.pending`, `ai.bubble.assistant`, `ai.bubble.user`, `card.confirmation.border`, `card.success.border`, `score.poor/fair/good/excellent`, plus any new semantics the SwiftBank kit suggests.

**3. Typography System**
- Map SwiftBank's type scale to semantic names: `heading.xl`, `heading.lg`, `heading.md`, `body.lg`, `body.md`, `body.sm`, `caption`, `overline`, `money.display` (for large balance numbers)
- Font family, fallbacks

**4. Spacing & Layout**
- Spacing scale (if SwiftBank uses 4px/8px base)
- Border radii (card, button, input, avatar, chip)
- Shadow/elevation levels

**5. Light & Dark Mode**
- Map token differences between light and dark mode
- Identify any tokens that don't change between modes (spacing, radii)

**6. Implementation-Ready Format**
Provide the final token set in a format ready to paste into:
- `tokens.ts` (NativeWind vars() object)
- `tailwind.config.js` (extend.colors entries)
- Include RGB channel triplet format (e.g., `'108 92 231'`) as required by NativeWind

---

### Output 2: `screen-mapping.md` — SwiftBank Screens → Journey Flows

Map every relevant SwiftBank screen to our journey maps and card components.

**1. Screen Inventory**
List every SwiftBank page/frame, organized by category. For each, note:
- Frame name in Figma
- Which journey map it corresponds to (accounts, payments, lending, onboarding, ai-chat)
- Which specific flow/step it maps to
- Relevance: **Use** (direct reference), **Adapt** (modify for our flows), **Skip** (not needed for POC)

**2. Card Component Mapping**
For each card in our canonical Card Component Catalogue (ai-chat.md), identify the closest SwiftBank screen/component:

| Our Card | SwiftBank Screen/Component | Match Quality | Adaptation Notes |
|----------|---------------------------|---------------|-----------------|
| Welcome Card | ? | Exact / Close / Loose / None | What to change |
| Balance Card | ? | ... | ... |
| Confirmation Card | ? | ... | ... |

**3. Gap Analysis**
- Cards/screens we need that SwiftBank doesn't have (will need to be designed from scratch, following SwiftBank's visual language)
- SwiftBank screens that suggest features we haven't planned (note for potential P2 additions)
- Screens that exist in SwiftBank but are out of scope for POC

**4. Screen Reference Index**
For each journey, list the SwiftBank frames to reference during implementation, in flow order. This becomes the "look at this" guide for implementation agents.

---

### Output 3: `agent-design-instructions.md` — Design Reference for Implementation Agents

This is the document that implementation agents (Phase 7) will read alongside CLAUDE.md. It must be self-contained — agents won't have Figma access during implementation.

**1. Visual Language Summary**
- Overall aesthetic: describe the look and feel in 3-5 sentences (rounded vs sharp, minimal vs rich, spacing density, color usage patterns)
- Key visual patterns: how cards look, how lists look, how headers look, how states (loading, empty, error, success) are handled
- Animation/transition patterns observed (if any)

**2. Component Construction Rules**
For each major component type, provide concrete construction instructions:

```
## Balance Card
- Container: bg-surface, rounded-2xl, p-4, shadow-sm
- Label: text-muted, text-caption, uppercase tracking-wide
- Amount: text-foreground, text-money-display, font-bold
- Currency symbol: text-muted, text-body-lg, mr-1
- Trend indicator: text-money-positive / text-money-negative, text-body-sm
- Tap target: entire card, navigates to account detail
```

Cover the top 15-20 most-used components (prioritize P0 cards from the catalogue).

**3. Layout Patterns**
- Standard screen margins and padding
- Card spacing within chat bubbles
- List item height and padding
- Button sizes and spacing
- Form field spacing
- Bottom sheet patterns (if used)

**4. Iconography**
- Icon library: Phosphor (used by SwiftBank)
- Icon sizes per context (navigation, inline, decorative)
- Icon color rules (when to use primary, muted, foreground)

**5. State Patterns**
- Loading: skeleton screens? spinners? shimmer?
- Empty state: illustration + message pattern
- Error state: inline vs toast vs card
- Success state: checkmark animation? confirmation card?

**6. Do / Don't Reference**
5-10 concrete "Do this / Don't do this" pairs based on SwiftBank's patterns. Help agents avoid common mistakes.

---

### Output 4: `plan-assessment.md` — Holistic Plan Assessment

Step back and assess the entire plan before it goes to architecture. This is your chance to catch issues that are cheap to fix now but expensive to fix later.

**1. Scope Assessment**
- Are 135 features achievable for a POC? Flag any that should be deferred
- Are P0/P1/P2 priorities correct? Anything mis-prioritized?
- Are there any features that sound simple but are architecturally complex?

**2. Journey Completeness**
- For each journey, can Alex complete every P0 flow end-to-end via chat?
- Are there any dead-ends where the AI can't help and there's no fallback?
- Are error/edge cases covered enough to be demo-ready?

**3. Design System Readiness**
- Are the extracted tokens sufficient for all P0 components?
- Are there any components that will be hard to build with our token system?
- Is the BrandProvider / runtime theming approach feasible for all screen types?

**4. Cross-Squad Risks**
- Review the ownership model: are boundaries clear enough?
- Identify the top 3 most likely merge conflicts
- Are the card catalogue references in journey maps specific enough for implementation?

**5. Technical Feasibility Flags**
- Any features that need APIs we haven't researched?
- Any UX patterns that are particularly hard in React Native?
- Does the conversation persistence model (content_blocks, 50-message cap) support the multi-turn flows described in journey maps?

**6. Demo Readiness Checklist**
- What are the 5 most impressive demo flows? Are they fully specified?
- What's the minimum path to "wow" for a stakeholder demo?
- Are there any flows that look great on paper but will feel slow/clunky in practice?

**7. Recommendations**
- Top 5 changes to make before proceeding to architecture
- Any journey map updates needed (feed back to Phase 1d outputs if so)
- Risk register: top 5 risks with mitigation strategies

---

## Output Paths

```
docs/neobank-v2/02-product-brief/design-assessment/token-map.md
docs/neobank-v2/02-product-brief/design-assessment/screen-mapping.md
docs/neobank-v2/02-product-brief/design-assessment/agent-design-instructions.md
docs/neobank-v2/02-product-brief/design-assessment/plan-assessment.md
```

## Success Criteria

1. A developer reading `agent-design-instructions.md` can build any P0 card component without opening Figma
2. The token map can be directly transformed into `tokens.ts` + `tailwind.config.js` during Foundation (F1b)
3. Every P0 card in the catalogue has a SwiftBank reference or explicit "design from scratch" note
4. The plan assessment surfaces at least 3 actionable improvements (not just "looks good")
5. All outputs are self-contained — no assumptions about Figma access during later phases
