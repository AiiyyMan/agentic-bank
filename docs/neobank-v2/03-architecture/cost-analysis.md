# Inference Cost Analysis

> **Principal Engineer Review** | March 2026
>
> Cost architecture audit, POC estimate, and optimisation roadmap for AgentBank's Claude API usage.

---

## 1. Cost Architecture — Where Tokens Are Consumed

Every user message triggers a chain of API calls. Each call in the agent loop re-sends the full payload:

```
Per Claude API call (input):
┌─────────────────────────────────────┬──────────┐
│ System prompt (8 blocks)            │ ~3,000   │
│ Tool definitions (47 tools × ~200)  │ ~9,400   │
│ Conversation history (varies)       │ 500–15K  │
│ Current user message                │ ~50      │
│ Tool results from this turn (if any)│ 0–2,000  │
├─────────────────────────────────────┼──────────┤
│ Base overhead (fixed per call)      │ ~12,400  │
│ Variable (grows with conversation)  │ 500–17K  │
└─────────────────────────────────────┴──────────┘

Per Claude API call (output):
┌─────────────────────────────────────┬──────────┐
│ Text response tokens                │ ~150     │
│ Tool call (name + input JSON)       │ ~100     │
│ respond_to_user + ui_components     │ ~300     │
├─────────────────────────────────────┼──────────┤
│ Typical output per call             │ 200–400  │
└─────────────────────────────────────┴──────────┘
```

**The critical multiplier:** Each tool call triggers a new API call. A turn with 1 tool call = 2 API calls. A turn with 2 tool calls = 2–3 API calls (parallel tools in one response = 2 calls; sequential = 3). The 12,400-token base overhead is re-sent every time.

### Token consumption map

| Source | Tokens | Frequency | Cacheable? |
|--------|--------|-----------|------------|
| System prompt (static blocks) | ~2,500 | Every API call | Yes |
| System prompt (dynamic: user + time) | ~500 | Every API call | No |
| Tool definitions (47 tools) | ~9,400 | Every API call | Yes |
| Conversation history | 500–15,000 | Every API call | Partially (earlier turns) |
| User message | ~50 | Once per turn | No |
| Tool results (fed back to Claude) | ~300 per tool | Per tool call | No |
| Summarisation input (Haiku) | ~20,000 | When triggered | No |

**Largest cost driver: tool definitions at 9,400 tokens per API call.** This is bigger than the system prompt and is sent identically every time — a prime caching target.

---

## 2. POC Cost Estimate (10 DAU)

### Assumptions

| Parameter | Low | Mid | High |
|-----------|-----|-----|------|
| Sessions per user per day | 1.5 | 2.5 | 4 |
| Turns per session | 6 | 10 | 15 |
| Tool calls per turn | 0.8 | 1.3 | 2.0 |
| API calls per turn (1 + tool calls) | 1.8 | 2.3 | 3.0 |
| Avg history size (mid-session) | 1,500 | 3,000 | 5,000 |
| Summarisation triggers per day | 1 | 5 | 12 |
| Sessions per day (10 users) | 15 | 25 | 40 |

### Per-turn token model (mid scenario)

```
API calls per turn: 2.3
Input per call: 12,400 (base) + 3,000 (history) + 250 (message + tool results)
            = 15,650 tokens

Input per turn:  2.3 × 15,650 = 35,995 tokens
Output per turn: ~500 tokens (text + tool call + respond_to_user)
```

### Per-session cost (mid, 10 turns)

History grows through the session. Modelling turn-by-turn with history at ~550 tokens per turn:

```
Total input per session:
  Σ(turn 0→9) 2.3 × (12,650 + 550 × turn)
  = 2.3 × [10 × 12,650 + 550 × 45]
  = 2.3 × [126,500 + 24,750]
  = 2.3 × 151,250
  = 347,875 input tokens

Total output per session:
  10 turns × 500 = 5,000 output tokens
```

### Pricing (Claude Sonnet 4.6)

| | Input | Output |
|--|-------|--------|
| Standard | $3.00 / MTok | $15.00 / MTok |
| Cache read (0.1×) | $0.30 / MTok | — |
| Cache write 5-min (1.25×) | $3.75 / MTok | — |

### Daily cost breakdown (10 DAU, mid scenario, 25 sessions/day)

**Without prompt caching:**

| Cost driver | Tokens/day | Rate | Daily cost |
|-------------|-----------|------|------------|
| Base overhead (system + tools) × API calls | 25 sess × 23 calls × 12,400 = 7.13M input | $3.00/MTok | $21.39 |
| Conversation history (variable) | 25 sess × 62,675 tokens = 1.57M input | $3.00/MTok | $4.70 |
| Output tokens | 25 sess × 5,000 = 125K output | $15.00/MTok | $1.88 |
| Summarisation (Haiku, 5 triggers) | ~100K input + 2.5K output | $1/$5 MTok | $0.11 |
| **Total** | | | **$28.08** |

**With prompt caching (system + tools cached):**

| Cost driver | Tokens/day | Rate | Daily cost |
|-------------|-----------|------|------------|
| Cache write (1st call per session) | 25 × 11,900 = 297.5K | $3.75/MTok | $1.12 |
| Cache read (remaining calls) | 25 × 22 calls × 11,900 = 6.55M | $0.30/MTok | $1.96 |
| Dynamic input (uncached) | 25 × 23 × 500 + 1.57M = 1.86M | $3.00/MTok | $5.57 |
| Output tokens | 125K | $15.00/MTok | $1.88 |
| Summarisation (Haiku) | ~100K input + 2.5K output | $1/$5 MTok | $0.11 |
| **Total** | | | **$10.64** |

### Monthly summary (10 DAU)

| Scenario | Without caching | With caching | Savings |
|----------|----------------|--------------|---------|
| **Low** | $380/mo | $145/mo | 62% |
| **Mid** | $840/mo | $320/mo | 62% |
| **High** | $1,680/mo | $640/mo | 62% |

---

## 3. Cost at Scale

### Linear extrapolation

| DAU | Sessions/day | Monthly (no cache) | Monthly (cached) |
|-----|-------------|-------------------|------------------|
| 10 | 25 | $840 | $320 |
| 100 | 250 | $8,400 | $3,200 |
| 1,000 | 2,500 | $84,000 | $32,000 |

### What compounds (non-linear risks)

| Pattern | Why it compounds | Impact at 1K DAU |
|---------|-----------------|------------------|
| **Longer sessions over time** | Returning users have longer conversations as they do more with the app. Mid-scenario shifts from 10→15 turns. | +50% cost per session |
| **History growth within sessions** | Later turns in long sessions carry 10-15K history tokens. The 80-message summarisation threshold means the worst-case context is ~20 messages × 550 tokens = 11K before summarisation kicks in. | Token cost per turn doubles by end of session |
| **Power users** | 10% of users do 60% of sessions. A few users running 30-turn deep sessions with multiple tool calls per turn can dominate the bill. | Top 10% users could be 40% of spend |
| **Agent loops that go deep** | A turn that triggers 3-4 tool calls means 4-5 API calls, each re-sending the full base overhead. | A 4-tool turn costs 2× a 1-tool turn |

### What stays flat

| Pattern | Why | Note |
|---------|-----|------|
| System prompt + tool definitions (with caching) | Cached at $0.30/MTok vs $3.00/MTok | Only scales if cache misses increase |
| Summarisation | Haiku at $0.001 per call | Negligible even at 1K DAU |
| Output tokens | Responses are short (banking answers, not essays) | ~$57/day at 1K DAU — manageable |

### Break-even point

At ~$32K/month (1K DAU with caching), the cost is $32/user/month. A neobank with £5-10/month revenue per user would need to reduce this significantly before production. This is fine for a POC where cost demonstrates the economics for investors, but the architecture should have a clear path to $3-5/user/month at scale.

---

## 4. High-Risk Patterns

### HR-1: Base overhead re-sent on every loop iteration (HIGHEST IMPACT)

The 12,400-token base (system prompt + tools) is sent with every API call in the agent loop. A 10-turn session with 1.3 tool calls/turn = 23 API calls = 285,200 tokens of base overhead alone. **This is 82% of total input tokens.**

Without caching, this costs $0.86/session. With caching, $0.13/session. **Caching is not optional — it is the single biggest cost lever.**

### HR-2: 47 tool definitions sent every call

Tool definitions (9,400 tokens) are the largest single block. All 47 tools are sent even during onboarding when only 4 are available. This is wasteful both in cost and in Claude's tool selection accuracy.

**Cost of sending all tools vs. onboarding subset:**
- All tools: 9,400 tokens × 23 calls = 216,200 tokens/session
- Onboarding tools only (4 tools): ~800 tokens × 23 calls = 18,400 tokens/session
- Savings during onboarding: 197,800 tokens/session = $0.59 uncached

**However:** Dynamic tool loading breaks prompt caching (see §5 trade-off). For most sessions (post-onboarding), all tools are needed. Keep all tools loaded and rely on caching.

### HR-3: No max_tokens guard on output

Without `max_tokens`, a single response could consume the full 64K output limit. At $15/MTok, a runaway 64K output response costs $0.96 — nearly the cost of an entire session. With 5 loop iterations, worst case is $4.80 per turn.

**Must set `max_tokens: 4096` for chat, `max_tokens: 1024` for summarisation.**

### HR-4: Summarisation input is expensive (but rare)

When summarisation triggers, the Haiku call ingests the oldest 60 messages (~20K tokens). At Haiku pricing ($1/MTok), this is only $0.02 — acceptable. But if the summarisation threshold drops or triggers more frequently, this grows. The current 80-message threshold is sensible.

### HR-5: No circuit breaker on the agent loop

The 5-iteration hard limit caps the worst case at 5 API calls per turn (6 including the final respond_to_user call). But there's no cost budget per turn. If Claude calls expensive tools that return large results (e.g., `get_transactions` returning 100 items × 50 tokens = 5,000 tokens), the 5th iteration could be sending 30K+ history.

---

## 5. Optimisation Opportunities (Ranked by Impact)

### Tier 1 — Must-do for POC

| # | Optimisation | Monthly savings (10 DAU) | Effort |
|---|-------------|-------------------------|--------|
| **O-1** | **Prompt caching** — Add `cache_control: { type: "ephemeral" }` on tool definitions + static system prompt blocks. Tools go in the `tools` field (cached first in Anthropic's hierarchy). Static system blocks get a cache breakpoint after the last static block. | **$520/mo (62%)** | Low — 10 lines of code |
| **O-2** | **Set `max_tokens: 4096`** — Prevents runaway output. Also required by the API (requests fail without it). | Prevents worst-case $4.80/turn blowups | Trivial |
| **O-3** | **Onboarding tool subsetting** — During onboarding (4-6 tools needed), only send those tools. Post-onboarding, send all 47. Cache both configurations separately. | $15-30/mo (small, but improves accuracy) | Low |

### Tier 2 — Should-do before scaling past 100 DAU

| # | Optimisation | Projected savings | Effort |
|---|-------------|-------------------|--------|
| **O-4** | **Token-based summarisation trigger** — Replace 80-message threshold with 60K token budget (measured via `count_tokens` endpoint). Prevents expensive late-session turns. | 10-20% on long sessions | Medium |
| **O-5** | **Tool result truncation** — Cap tool results at 2,000 tokens. Transaction lists beyond 20 items get summarised before feeding back to Claude. | 5-10% on data-heavy turns | Medium |
| **O-6** | **Hard-coded confirmation responses** — When a payment confirms successfully, return a SuccessCard + template text without another Claude API call. Saves a full round-trip for the most predictable response in the system. | 5-8% (saves ~1 API call per write flow) | Low |
| **O-7** | **1-hour cache TTL** — Use `cache_control: { type: "ephemeral", ttl: "1h" }` instead of default 5-min. Costs 2× on write vs 1.25× but keeps cache alive across sessions. For users who message every 10-20 minutes, this eliminates repeated cache writes. | 3-5% | Trivial |

### Tier 3 — Consider for 1K+ DAU

| # | Optimisation | Projected savings | Effort |
|---|-------------|-------------------|--------|
| **O-8** | **Model routing** — Route simple queries ("what's my balance?") to Haiku instead of Sonnet. Use a lightweight classifier (keyword match or Haiku) to triage. | 20-40% if 50% of queries are simple | High |
| **O-9** | **Conversation history caching** — Cache the first N turns of conversation history using additional `cache_control` breakpoints (max 4 per request). Earlier turns rarely change. | 10-15% on long sessions | Medium |
| **O-10** | **Batch proactive insights** — Generate morning greeting cards and proactive insights via the Batch API (50% off, 24h turnaround) during off-peak hours instead of real-time. | 50% on insight generation cost | Medium |

---

## 6. Model Selection Review

| Task | Current model | Right choice? | Notes |
|------|--------------|---------------|-------|
| **Main chat** | Sonnet 4.6 ($3/$15) | **Yes** | Best balance for tool-using conversation. Opus would be 1.7× more expensive with marginal quality gain for banking tasks. |
| **Summarisation** | Haiku 4.5 ($1/$5) | **Yes** | Simple task, Haiku is appropriate. Cost is negligible ($0.02 per trigger). |
| **Transaction categorisation** | Haiku 4.5 ($1/$5) | **Yes** | High-volume classification, Haiku sufficient. |
| **Proactive insights** | Not specified | **Should be Haiku** | Insight generation (spending patterns, anomaly detection) can use Haiku with structured prompts. Only the final user-facing phrasing needs Sonnet quality. |
| **Simple queries** (balance, "thanks", "ok") | Sonnet 4.6 | **Consider Haiku** | ~30-50% of messages are simple lookups or acknowledgements. Haiku could handle these at 67% less cost. Requires a routing layer (see O-8). |

### Model routing trade-off

Routing to Haiku for simple queries saves money but adds complexity and latency (classifier call before main call). For POC, the added complexity isn't worth it — stick with Sonnet for everything and optimise via caching. At 1K+ DAU, model routing becomes worthwhile.

---

## 7. Agent Loop Cost Risks

### Current safeguards

| Safeguard | Status | Assessment |
|-----------|--------|------------|
| MAX_TOOL_ITERATIONS = 5 | Documented | Good — caps worst case at 6 API calls per turn |
| `max_tokens` | **Not set** | Must fix — unbounded output is a cost risk |
| Tool result size limits | **Not documented** | Should add — large results inflate all subsequent calls |

### Worst-case turn cost

```
Scenario: User asks "show me everything" → Claude calls 3 tools in parallel,
then 2 more sequentially, then respond_to_user.

API call 1: 12,400 (base) + 5,000 (history) + 50 (message) = 17,450 input
  Output: 3 tool_use blocks = ~300 output
API call 2: 17,450 + 300 + 3 × 500 (results) = 19,250 input
  Output: 2 tool_use blocks = ~200 output
API call 3: 19,250 + 200 + 2 × 500 = 20,450 input
  Output: respond_to_user = ~400 output

Total input: 57,150 tokens → $0.17
Total output: 900 tokens → $0.014
Turn cost: $0.18
```

With caching, base overhead (11,900 tokens × 3 calls = 35,700) drops to $0.011 cached reads, bringing the turn down to ~$0.07. Acceptable.

### Recommended circuit breakers

1. **`max_tokens: 4096`** on all chat API calls — already flagged as MF-6.
2. **Per-turn token budget: 80K input tokens.** If a turn would exceed this (deep loops + large history), truncate tool results or error gracefully.
3. **Per-session cost cap: $2.00.** Log a warning when a session exceeds this. At 10 DAU this would rarely trigger; at 1K DAU it catches runaway sessions.
4. **Tool result size cap: 2,000 tokens.** Truncate large results (transaction lists, spending breakdowns) with a note to Claude that results were truncated.

---

## 8. Summary — Top 3 Architectural Changes by Cost Impact

### 1. Implement prompt caching (O-1) — saves 62%

The single highest-impact change. System prompt + tool definitions (11,900 tokens) are sent identically on every API call. With caching at 0.1× read price, this transforms the cost structure. **Estimated savings: $520/month at 10 DAU, $5,200/month at 100 DAU.**

Implementation: ~10 lines of code. Structure `tools` and `system` fields with `cache_control` breakpoints.

```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 4096,
  tools: allToolDefinitions,  // Cached automatically (first in hierarchy)
  system: [
    { type: 'text', text: PERSONA_BLOCK + TOOL_USAGE_RULES + CONVERSATION_RULES },
    { type: 'text', text: CARD_USAGE_POLICY + CARD_RENDERING_RULES + SAFETY_RULES,
      cache_control: { type: 'ephemeral' } },  // Breakpoint after last static block
    { type: 'text', text: buildDynamicContext(user, session) },  // Not cached
  ],
  messages: conversationHistory,
});
```

### 2. Set `max_tokens` and output guards (O-2) — prevents blowups

Not an optimisation — a requirement. Without `max_tokens`, requests fail (Anthropic requires it). With an unbounded output, a single runaway response could cost $0.96. Set `max_tokens: 4096` for chat, `max_tokens: 1024` for summarisation.

### 3. Hard-code confirmation responses (O-6) — saves an API call per write flow

When the user confirms a payment and it succeeds, the response is deterministic: a SuccessCard with the transaction details + "Done — £50 sent to James." This doesn't need Claude. Skipping the API call saves ~15,000 input tokens (base + history) per confirmation. For a user doing 2-3 payments per session, this saves ~$0.10/session or ~8% overall.

---

## Appendix: Pricing Reference (March 2026)

| Model | Input/MTok | Output/MTok | Cache read | Cache write (5min) |
|-------|-----------|-------------|------------|-------------------|
| Sonnet 4.6 | $3.00 | $15.00 | $0.30 | $3.75 |
| Haiku 4.5 | $1.00 | $5.00 | $0.10 | $1.25 |
| Opus 4.6 | $5.00 | $25.00 | $0.50 | $6.25 |

Minimum cacheable: 2,048 tokens (Sonnet), 4,096 tokens (Haiku/Opus). Cache TTL: 5 min default, 1 hour optional. Max 4 cache breakpoints per request.
