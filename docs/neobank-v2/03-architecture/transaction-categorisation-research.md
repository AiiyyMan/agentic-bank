# Transaction Categorisation Research

> **Date:** 2026-03-09
> **Author:** Principal Engineer (AI-assisted)
> **Status:** Research complete — awaiting decision
> **Audience:** CPTO / Tech Lead — decision on categorisation approach before build begins

---

## Table of Contents

1. [Best Practices Summary](#1-best-practices-summary)
2. [Dataset Inventory](#2-dataset-inventory)
3. [Approach Comparison](#3-approach-comparison)
4. [Sandbox & Integration Notes](#4-sandbox--integration-notes)
5. [Recommended Category Taxonomy](#5-recommended-category-taxonomy)
6. [Recommendation](#6-recommendation)

---

## 1. Best Practices Summary

Eight key findings from how production PFM systems handle transaction categorisation today.

### 1.1 Hybrid pipelines are the industry standard

Every mature PFM system (Monzo, Revolut, Plaid, Yodlee, Ntropy) uses a layered approach: rule-based matching for high-confidence merchants first, then ML/AI for ambiguous transactions, with human review or user correction as the final fallback. No production system relies on a single technique.

### 1.2 Category count sweet spot: 10-16 primary, 50-100 detailed

Plaid's PFCv2 taxonomy (December 2025) uses **16 primary categories and 92 detailed subcategories** — the most widely adopted standard in the industry. Yodlee uses 21 high-level categories with 626 detail categories (too granular for consumer PFM). Monzo uses 12 consumer-facing categories. The research consensus is that 10-16 top-level categories is the right balance: fewer feels reductive, more overwhelms users. Subcategories should exist in the data model but only surface on drill-down.

### 1.3 Merchant name normalisation is the hardest unsolved problem

"AMZN Mktp US*1234" must become "Amazon". "TESCO STORES 2345 LONDON" must become "Tesco". This merchant cleaning step is where most categorisation errors originate. Without normalisation, even perfect category logic fails because the input is noisy. Production systems maintain merchant databases with 100M+ entities (Ntropy) or rely on MCC codes as a fallback signal.

### 1.4 MCC codes are useful but insufficient

Merchant Category Codes (ISO 18245) are four-digit codes assigned by payment networks. They cover ~800 merchant types and provide a reliable first-pass signal — a transaction at MCC 5411 (Grocery Stores) is almost certainly groceries. However, MCCs are assigned per-merchant, not per-transaction, so a supermarket that also sells fuel gets a single MCC. MCCs also don't exist for bank transfers, direct debits, or standing orders. Griffin BaaS likely provides MCCs for card transactions but not for Faster Payments.

### 1.5 User corrections are the highest-quality training signal

When a user reclassifies a transaction, that correction is ground truth. Production systems (Monzo, Revolut, Plaid) capture these corrections and use them to: (a) apply the same override to future transactions from the same merchant for that user, (b) aggregate corrections across users to retrain global models. Even at POC scale, storing user corrections in a `category_overrides` table is cheap insurance for later ML training.

### 1.6 Accuracy benchmarks: 85-95% is production-grade

- Rule-based systems: 60-70% accuracy (known merchants only, poor on unknowns)
- Basic ML (TF-IDF + SVM): 90-94% on clean datasets (drops on noisy real-world data)
- Fine-tuned transformers (BERT-family): 93-95% on Open Banking transaction data
- LLMs (GPT-4, Claude) zero-shot: ~60-75% without merchant context; 85-90% with good prompting
- Third-party APIs (Ntropy, Plaid Enrich): 90-95%+ (backed by 100M+ entity databases)

Key insight: accuracy depends more on merchant normalisation quality than on the classification algorithm itself.

### 1.7 "Uncategorised" must be a first-class category

Every production system includes an explicit "Other" or "General" category. Forcing every transaction into a category creates false confidence. The better approach: categorise what you can with high confidence, mark the rest as "Other", and use that pool as a prioritised queue for model improvement.

### 1.8 Income categorisation requires different logic

Income transactions (salary, refunds, interest, benefits) look fundamentally different from spending. They typically have fewer merchants to match against, and the key signals are amount patterns (same amount monthly = salary) and reference text ("SALARY", "DWP", "HMRC"). Most systems treat income and expense categorisation as separate pipelines.

---

## 2. Dataset Inventory

Available open-source or freely accessible datasets for training or benchmarking.

| Dataset | Source | Size | Categories | Licence | Quality | Notes |
|---------|--------|------|------------|---------|---------|-------|
| **Kaggle: Bank Transaction Data** | [Kaggle (apoorvwatsky)](https://www.kaggle.com/datasets/apoorvwatsky/bank-transaction-data) | 5.3 MB, ~thousands of rows | Uncategorised (raw narrations) | CC0 Public Domain | Low | Indian bank data. No pre-labelled categories — requires manual annotation. Useful for testing normalisation, not classification. |
| **Kaggle: Bank Customer Segmentation** | [Kaggle (shivamb)](https://www.kaggle.com/datasets/shivamb/bank-customer-segmentation) | 1M+ transactions, 25 MB | Transaction types (not spending categories) | Original Authors | Low | Indian bank. Designed for customer segmentation, not category classification. No merchant names. |
| **Wells Fargo Campus Analytics Challenge** | Various Kaggle mirrors | 40K train + 10K test | Labelled spending categories | Academic use | Medium | US-specific merchant names. Categories aligned with US spending patterns. Requires scraping — not always reliably available. |
| **Open Bank Transaction Data (Firat et al.)** | [University of Nottingham](https://people.cs.nott.ac.uk/blaramee/research/financeVis/firat23moneyVis.pdf) | 6,500 transactions, 7 years | Anonymised | Academic | Medium | Small but real. Anonymised merchant names limit usefulness for merchant-to-category mapping. Good for pattern analysis. |
| **French Open Banking Dataset** (Arxiv 2504.12319) | [arXiv](https://arxiv.org/html/2504.12319v1) | 94K train + 110K test | 84 categories | Research | High | Best quality in this list. French bank data, real merchant names. Achieved 95% F1 with Word2Vec + Random Forest. Not publicly downloadable — methodology is the value. |
| **GoMask Synthetic Banking Dataset** | [GoMask.ai](https://gomask.ai/marketplace/datasets/banking-transaction-categorization-dataset) | Synthetic (size varies) | Standard PFM categories | Commercial | Medium | Synthetic data. Useful for pipeline testing, not for training production models. |
| **SME Transactions (Arxiv 2508.05425)** | [arXiv](https://arxiv.org/html/2508.05425v1) | Research dataset | Business categories | Research | Medium | SME-focused, not consumer. Achieved 73.5% with fine-tuning, 60.4% GPT-4o zero-shot. Demonstrates the difficulty of the problem on real data. |

### Assessment

There is **no single, high-quality, freely available, UK-focused consumer transaction dataset with labelled categories**. This is a known gap in the open-source ecosystem — real transaction data is sensitive and banks do not share it. For AgentBank's POC:

- The mock transaction seeder (120 transactions for demo user Alex) is the primary dataset.
- The French Open Banking paper's methodology is more valuable than the dataset itself.
- If ML training is pursued later, synthetic data generation (as per the SME paper) or user correction data are the realistic paths.

---

## 3. Approach Comparison

### Summary Table

| Criterion | A: LLM (Claude) | B: Rule-based | C: Open Source ML | D: Third-party API | E: Hybrid (Rules + LLM) |
|-----------|-----------------|---------------|-------------------|--------------------|-----------------------|
| **Accuracy** | 85-90% with good prompting; drops on ambiguous merchants | 95%+ on known merchants; 0% on unknowns (falls to "Other") | 90-95% if well-trained; needs data | 90-95%+ (Ntropy, Plaid) | 95%+ known; 85-90% unknown |
| **Implementation effort** | Low — already in stack, prompt engineering only | Very low — a JSON map + lookup function | High — model selection, training, serving infra | Medium — API integration, error handling | Low-Medium — rules + LLM fallback |
| **Ongoing maintenance** | None (model updates handled by Anthropic) | High — must add new merchants manually | Medium — periodic retraining | None (vendor maintains) | Low — rules for top merchants, LLM handles tail |
| **Cost per transaction** | ~$0.0003-0.001 (Haiku 4.5 batch) | $0 | $0 (compute costs only) | $0.001-0.01+ per transaction | $0 for rules; ~$0.0003 for LLM fallback |
| **Latency** | 200-500ms (API call) | <1ms | 10-50ms (local inference) | 100-300ms (API call) | <1ms rules; 200-500ms LLM fallback |
| **Stack fit** | Excellent — Anthropic API already integrated | Excellent — pure Node.js | Poor — requires Python ML stack, model hosting | Good — REST API, but new vendor dependency | Excellent — Node.js rules + existing Anthropic API |
| **Data privacy** | Transaction data sent to Anthropic API | No data leaves server | No data leaves server | Data sent to third party | Partial — only unknowns sent to API |
| **Scalability** | API rate limits; cost scales linearly | Infinite | Depends on hosting | Depends on vendor tier | Best of both |
| **UK relevance** | Good — Claude understands UK merchants | Depends on your merchant list | Depends on training data | Ntropy/Tink good for UK | Good |
| **POC verdict** | Viable but wasteful for known merchants | **Best for POC core** | Overkill for POC | Unnecessary dependency | **Best overall for POC** |

### Detailed Analysis

#### A. LLM-based (Claude on server)

**How it works:** Send merchant name + amount + transaction description to Claude (Haiku 4.5 for cost efficiency) with a system prompt listing valid categories. Returns category + confidence.

**Pros:**
- Zero additional infrastructure — Anthropic API already integrated
- Handles unknown merchants gracefully ("Costa Coffee" → Dining without any rules)
- Can extract nuance: "Uber" could be Transport or Dining (Uber Eats) based on amount
- Prompt caching reduces cost for repeated system prompts

**Cons:**
- Overkill for known merchants ("Tesco" → Groceries doesn't need an LLM)
- Latency: 200-500ms per call vs <1ms for a lookup
- Cost: ~$0.0003 per transaction with Haiku batch, but multiplied by every transaction in the system
- Non-deterministic: same input can produce different outputs across calls
- Privacy: transaction data sent to Anthropic (acceptable for POC, may need review for production)

**Cost model for AgentBank:**
- 120 seeded transactions: ~$0.04 one-time cost with Haiku 4.5
- 50 users × 60 transactions/month: 3,000 calls/month = ~$0.90/month
- Negligible at POC scale. At 10K users it becomes ~$180/month — still manageable.

#### B. Rule-based / keyword matching

**How it works:** A JavaScript object mapping merchant name prefixes to categories. `"TESCO" → "Groceries"`, `"UBER" → "Transport"`, etc. With optional MCC code fallback.

**Pros:**
- Deterministic — same input always produces same output
- Zero latency, zero cost, zero external dependencies
- Easy to test, debug, and audit
- Already specified in the PRD (F13: top 50 UK merchants → category + icon)

**Cons:**
- Zero coverage for unknown merchants (all fall to "Other")
- Requires manual maintenance as new merchants appear
- Brittle to merchant name variations without normalisation logic
- Cannot handle contextual categorisation (Uber Transport vs Uber Eats)

**Fit for AgentBank:** This is already the planned P0 approach per the PRD. The question is whether to enhance it.

#### C. Open Source ML model (self-hosted)

**How it works:** Fine-tune a BERT-based or sentence-transformer model on labelled transaction data. Deploy as a microservice (Python/FastAPI) or use ONNX runtime in Node.js.

**Pros:**
- High accuracy (90-95%) when well-trained on representative data
- Full control over model, no external dependencies
- Low per-transaction cost after initial training
- Deterministic (same model version = same output)

**Cons:**
- Requires training data that doesn't exist for UK consumer transactions
- Needs ML infrastructure: Python runtime, model serving, GPU for training
- Significant upfront engineering effort (weeks, not days)
- Adds operational complexity (model versioning, monitoring, retraining pipeline)
- The Node.js + Supabase stack has no ML infrastructure currently

**Fit for AgentBank:** Wrong choice for POC. The engineering cost is disproportionate to the value. Revisit at production scale if categorisation accuracy becomes a competitive differentiator and user correction data provides training signal.

#### D. Third-party categorisation API

**How it works:** Send transactions to a specialised categorisation service (Ntropy, Plaid Enrich, Tink, TrueLayer). They maintain merchant databases and ML models.

**Pros:**
- Highest accuracy out-of-the-box (90-95%+)
- Merchant normalisation included (clean merchant names)
- Multi-geography support (Ntropy, Tink strong in UK/EU)
- Additional enrichment: logos, locations, recurring detection

**Cons:**
- New vendor dependency and data processing agreement required
- Transaction data sent to third party (GDPR implications for a UK bank)
- Cost: typically $0.001-0.01+ per transaction (opaque pricing from most vendors)
- Integration effort: API keys, error handling, fallback logic
- Vendor lock-in on category taxonomy

**Fit for AgentBank:** Unnecessary complexity for a POC with 120 seeded mock transactions. Worth evaluating at production scale, particularly Ntropy (strong UK coverage, LLM-based) or Tink (owned by Visa, strong in EU/UK open banking).

#### E. Hybrid: Rules + LLM fallback

**How it works:** Two-tier pipeline:
1. **Fast path (rules):** Lookup merchant name against a map of top 50-100 UK merchants. If match found, return category instantly.
2. **Slow path (LLM):** If no rule matches, send to Claude Haiku with a structured prompt. Cache the result for that merchant name so subsequent transactions from the same merchant skip the LLM.

**Pros:**
- Best of both worlds: deterministic for known merchants, intelligent for unknowns
- 95%+ of seeded transactions hit the fast path (free, instant)
- LLM handles the long tail gracefully
- Merchant-level caching means each unknown merchant triggers only one LLM call
- Already uses infrastructure in the stack (no new dependencies)
- Natural path to production: replace LLM fallback with trained ML model later

**Cons:**
- Slightly more complex than pure rules (two code paths + cache)
- Still sends some data to Anthropic API (unknowns only)
- Need to handle LLM failure gracefully (fallback to "Other")

**Cost model:**
- 50 UK merchants covered by rules = ~80% of transactions = $0
- Remaining 20% (24 of 120 seeded): ~$0.008 total with Haiku
- With merchant-level caching, only unique unknown merchants trigger calls (~10-15 calls total)
- Effectively free at POC scale

---

## 4. Sandbox & Integration Notes

### Ntropy

- **Sandbox:** 2,000 free test transactions, then paid plans. Sign up at ntropy.com for dashboard access.
- **Integration:** REST API, Node.js SDK available. Send transaction description + amount + account holder type → get category + merchant name + logo.
- **UK coverage:** Strong. Multi-geo, multi-lingual, 100M+ entity database.
- **Privacy:** Transaction data sent to Ntropy servers. GDPR-compliant (EU-based). Enriched data isolated per API key.
- **Pricing:** Not publicly listed. Dashboard-based billing. Blog suggests they compete on price vs LLM inference costs.
- **Verdict:** Best third-party option for UK banking. Worth a sandbox evaluation if categorisation accuracy becomes a priority post-POC.

### Tink (Visa)

- **Sandbox:** Free sandbox environment with test data. Enterprise tier required for production.
- **Integration:** REST API, strong documentation. Transaction classification supported for UK, Ireland, France.
- **UK coverage:** Excellent — owned by Visa, deep UK open banking integration.
- **Privacy:** EU-based (Stockholm). GDPR-compliant. Visa-owned = strong data governance.
- **Pricing:** Starts at ~€0.50/user/month for standard tier. Custom pricing for enrichment features.
- **Verdict:** Strongest regulatory pedigree. Overkill for POC — more suited to production open banking integration.

### Plaid Enrich

- **Sandbox:** Available via Plaid dashboard. Free tier for development.
- **Integration:** REST API, excellent Node.js SDK. Well-documented PFCv2 taxonomy (16 primary, 92 detailed categories).
- **UK coverage:** Primarily US-focused. UK support exists but is secondary.
- **Privacy:** US-based company. Data sharing model may raise concerns for UK FCA-regulated entity.
- **Pricing:** Per-transaction pricing, varies by volume. Not publicly listed.
- **Verdict:** Best taxonomy design (PFCv2 is the industry reference). Less suitable for UK-only banking product.

### TrueLayer

- **Sandbox:** Free development tier with test data.
- **Integration:** REST API. Transaction classification supported for UK, Ireland, France.
- **UK coverage:** Strong — UK-founded, FCA-regulated.
- **Privacy:** UK-based. Strong regulatory alignment.
- **Pricing:** Custom. Scale and Enterprise tiers only.
- **Verdict:** Good UK fit but basic categorisation compared to Ntropy. Better known for payment initiation than enrichment.

### Summary

| Service | Free Sandbox | UK Coverage | Node.js SDK | Best For |
|---------|-------------|-------------|-------------|----------|
| Ntropy | 2K transactions | Strong | Yes | Best accuracy, merchant enrichment |
| Tink | Yes (test data) | Excellent | Yes | Open banking + categorisation bundle |
| Plaid Enrich | Yes | Moderate | Yes | US-focused PFM, great taxonomy reference |
| TrueLayer | Yes | Strong | Yes | UK open banking, basic categorisation |

**None of these are recommended for POC.** The hybrid rules + LLM approach covers the POC need without adding vendor dependencies. File this section for the production scaling decision.

---

## 5. Recommended Category Taxonomy

Based on analysis of Plaid PFCv2, Monzo's 12 categories, Ntropy's consumer taxonomy, and the PRD's existing F13 specification.

### Design principles

1. **Match user mental models** — categories should map to how people think about spending ("I spent too much eating out") not accounting codes.
2. **10-15 primary categories** — enough to be useful, few enough to scan at a glance.
3. **Include Income and Education** — per requirements.
4. **Every category gets a Phosphor icon** — already specified in the data model.
5. **"Other" is explicit** — never force-classify low-confidence transactions.

### Recommended categories (14 primary)

| # | Category | Phosphor Icon | Justification |
|---|----------|---------------|---------------|
| 1 | **Groceries** | `ShoppingCart` | Highest-frequency spending category. Supermarkets, corner shops. |
| 2 | **Dining** | `ForkKnife` | Restaurants, cafes, takeaways, food delivery. Separate from groceries because spending behaviour and budget control differ. |
| 3 | **Transport** | `Train` | Tubes, buses, trains, fuel, parking, rideshare. High-frequency, budget-relevant. |
| 4 | **Bills & Utilities** | `Receipt` | Rent, council tax, energy, water, broadband, mobile. Recurring fixed costs that users want to track separately from discretionary spending. |
| 5 | **Shopping** | `ShoppingBag` | Clothing, electronics, Amazon, general retail. The catch-all for non-food purchases. |
| 6 | **Entertainment** | `FilmSlate` | Streaming, cinema, concerts, gaming, events. Discretionary spending users often want to reduce. |
| 7 | **Health** | `Heartbeat` | NHS prescriptions, dentist, optician, gym, pharmacy. UK-relevant: most healthcare is free, so this captures the paid touchpoints. |
| 8 | **Travel** | `Airplane` | Hotels, flights, holiday bookings. Separate from transport because it's infrequent, high-value, and planned. |
| 9 | **Education** | `GraduationCap` | Tuition, courses, books, school supplies. Required per brief. Relevant for student banking and lifelong learning. |
| 10 | **Personal Care** | `Sparkle` | Haircuts, beauty, cosmetics. Monzo added this based on user demand — it's a real budget category people track. |
| 11 | **Subscriptions** | `ArrowsClockwise` | Netflix, Spotify, SaaS, magazine subscriptions. Cross-cuts other categories but users specifically want to see recurring digital payments grouped. |
| 12 | **Transfers** | `ArrowsLeftRight` | Peer-to-peer payments, pot transfers, standing orders to other accounts. Not "spending" but appears in transaction lists. |
| 13 | **Income** | `Money` | Salary, benefits, refunds, interest. Required per brief. Treated as a separate pipeline — see §1.8. |
| 14 | **Other** | `DotsThree` | Anything that doesn't fit. Explicit, not hidden. Target: <10% of transactions should land here. |

### Changes from PRD F13

The PRD specified 10 categories: `Groceries, Dining, Transport, Entertainment, Shopping, Bills, Health, Travel, Education, Other`. This recommendation adds:

- **Personal Care** — validated by Monzo's user research as a real demand.
- **Subscriptions** — increasingly important in the streaming/SaaS era. Users specifically ask "what am I paying for monthly?"
- **Transfers** — necessary because transfers appear in transaction feeds but aren't spending.
- **Income** — required by the brief and needed for the insight engine.

The rename from "Bills" to "Bills & Utilities" better describes the category scope.

### Data model compatibility

The existing `transactions` table already has `category TEXT` and `category_icon TEXT` columns. These 14 categories fit directly with no schema changes. An enum or check constraint can be added in a migration:

```sql
ALTER TABLE transactions
ADD CONSTRAINT valid_category CHECK (
  category IN (
    'Groceries', 'Dining', 'Transport', 'Bills & Utilities',
    'Shopping', 'Entertainment', 'Health', 'Travel',
    'Education', 'Personal Care', 'Subscriptions',
    'Transfers', 'Income', 'Other'
  )
);
```

---

## 6. Recommendation

### For POC: Approach E — Hybrid (Rules + LLM fallback)

**This is the recommended approach.** Here is the rationale:

**Why not pure rules (B)?** The PRD already specifies rule-based as the P0 approach with 50 UK merchants. This works for the seeded demo data but falls apart the moment a real user makes a transaction at a merchant not in the map. Every unknown → "Other" is a bad user experience.

**Why not pure LLM (A)?** Sending "Tesco" to Claude Haiku to get back "Groceries" is wasteful — it's 200ms and $0.0003 for something a hashmap does in 0.001ms for free. LLM adds value only for the unknown tail.

**Why not ML (C)?** No training data, no ML infrastructure, and the POC has 120 seeded transactions. This is a production-scale decision.

**Why not third-party (D)?** Adds a vendor dependency, data sharing agreement, and integration effort for a problem that the hybrid approach solves adequately. Revisit when user scale demands accuracy beyond what rules + LLM provides.

### Implementation plan

```
categorise_transaction(merchant_name, amount, description)
│
├─ Step 1: Normalise merchant name
│   └─ Strip trailing codes, uppercase, trim
│   └─ "TESCO STORES 2345 LONDON" → "TESCO"
│
├─ Step 2: Rule lookup (fast path)
│   └─ Check normalised name against merchant_category_map
│   └─ If match → return { category, icon, source: 'rule' }
│
├─ Step 3: Merchant cache lookup
│   └─ Check Supabase merchant_categories table
│   └─ If cached → return { category, icon, source: 'cache' }
│
├─ Step 4: LLM classification (slow path)
│   └─ Call Claude Haiku with merchant_name + amount + description
│   └─ Prompt constrains output to valid category enum
│   └─ Cache result in merchant_categories table
│   └─ Return { category, icon, source: 'llm' }
│
└─ Step 5: Fallback
    └─ If LLM fails → return { category: 'Other', icon: 'DotsThree', source: 'fallback' }
```

### Supporting infrastructure

1. **`merchant_categories` cache table** — merchant_name (normalised) → category + icon. Populated by LLM on first encounter. Grows organically as new merchants appear.

2. **`category_overrides` table** — user_id + transaction_id → corrected category. Stores user corrections for future ML training. Applied on read (override takes precedence over auto-categorisation).

3. **Merchant normalisation function** — the single highest-value piece of code in the pipeline. Prefix matching, common suffix stripping, known alias mapping. Start simple, iterate.

### Cost at scale

| Scale | Rule hits (80%) | LLM calls (20% unique merchants) | Monthly cost |
|-------|-----------------|-----------------------------------|-------------|
| POC (50 users) | ~2,400/mo | ~50 unique merchants | ~$0.015 |
| Early production (1K users) | ~48,000/mo | ~200 unique merchants | ~$0.06 |
| Growth (10K users) | ~480,000/mo | ~500 unique merchants | ~$0.15 |

With merchant-level caching, LLM cost is proportional to **unique merchants**, not transaction volume. This is the key insight — merchant diversity grows logarithmically while transaction volume grows linearly.

### Trade-offs the decision-maker should weigh

| Factor | Hybrid (recommended) | Pure rules (current plan) |
|--------|----------------------|--------------------------|
| Accuracy on known merchants | Identical (95%+) | Identical (95%+) |
| Accuracy on unknown merchants | 85-90% (LLM) | 0% (all → "Other") |
| Implementation complexity | ~2 days more | Baseline |
| External dependency | Anthropic API (already in stack) | None |
| Path to production ML | Natural — cache table becomes training data | Manual — no learning |
| Data privacy | Some transactions hit Anthropic API | All data stays on server |

**If data privacy is an absolute constraint** (no transaction data to any external API), go with pure rules (B) and accept the "Other" rate. But note that AgentBank already sends full conversation context to Anthropic for the chat agent — the categorisation data is less sensitive than the conversational data already flowing.

**If the team wants maximum simplicity for POC**, pure rules (B) as specified in F13 is fine. The hybrid approach is a ~2-day incremental investment that meaningfully improves the user experience and sets up the data pipeline for future ML.

### Decisions made

- [x] **Approve hybrid approach (E)** — rules + LLM fallback + merchant cache
- [x] **Adopt Plaid PFCv2 taxonomy** — 16 primary categories, 111 subcategories as the internal data model
- [x] **Add `is_recurring` tag** — cross-cutting subscription flag across all categories (Netflix stays in ENTERTAINMENT, but tagged `is_recurring: true` for subscription management views)
- [ ] ~~Stay with pure rules (B)~~ — superseded
- [ ] ~~Evaluate third-party sandbox~~ — not needed for POC
- [ ] ~~Approve expanded 14-category taxonomy~~ — superseded by PFCv2 adoption

---

## Sources

- [Plaid PFCv2 Taxonomy (CSV)](https://plaid.com/documents/transactions-personal-finance-category-taxonomy.csv)
- [Plaid Transactions Categorization Blog](https://plaid.com/blog/transactions-categorization-taxonomy/)
- [Monzo: New Categories Blog](https://monzo.com/blog/2018/05/09/new-categories)
- [Ntropy Transaction Enrichment Docs](https://docs.ntropy.com/enrichment/introduction)
- [Ntropy Categories Docs](https://docs.ntropy.com/enrichment/categories)
- [Tink Pricing](https://tink.com/pricing/)
- [TrueLayer Pricing Guide](https://blog.finexer.com/truelayer-pricing-uk/)
- [Open Banking Transaction Classification (arXiv 2504.12319)](https://arxiv.org/html/2504.12319v1)
- [SME Transaction Categorisation with Synthetic Data (arXiv 2508.05425)](https://arxiv.org/html/2508.05425v1)
- [LLM Banking Classification Benchmarks (arXiv 2311.06102)](https://arxiv.org/pdf/2311.06102)
- [Meniga: Transaction Categorisation Guide](https://www.meniga.com/resources/transaction-categorisation/)
- [Meniga: PFM Trends](https://www.meniga.com/resources/pfm-trends/)
- [Yodlee Transaction Categorization](https://developer.yodlee.com/Yodlee_API/Transaction_Categorization)
- [Kaggle: Bank Transaction Data](https://www.kaggle.com/datasets/apoorvwatsky/bank-transaction-data)
- [Kaggle: Bank Customer Segmentation](https://www.kaggle.com/datasets/shivamb/bank-customer-segmentation)
- [MCC Codes (Wikipedia)](https://en.wikipedia.org/wiki/Merchant_category_code)
- [COICOP Classification (UN)](https://unstats.un.org/unsd/classifications/coicop)
- [Claude API Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Tapix: How to Categorise Transactions](https://www.tapix.io/resources/post/how-to-categorise-transactions)
- [Codat: How Transaction Categorization Works](https://codat.io/blog/how-does-bank-transaction-categorization-actually-work/)
