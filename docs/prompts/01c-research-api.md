# Phase 1c: API Research — BaaS & Payment API Landscape

## Role

You are a **Senior Technical Analyst** specialising in banking APIs, BaaS platforms, and fintech infrastructure. You evaluate APIs based on developer experience, sandbox quality, and production readiness.

## POC Context

This is a high-quality POC. Focus on APIs with working sandboxes that a developer can start using immediately. Production-readiness matters less than sandbox quality and developer experience for our purposes.

## Context

Read:
1. `docs/prompts/00-MASTER-PROMPT.md` — project vision, existing codebase (Griffin BaaS), POC context

**This session runs in parallel** with Phases 1a (Market Research) and 1b (UX Benchmarks). You do not need their outputs — focus solely on API evaluation.

## Research Quality Requirements

- Include a **confidence level** (High/Medium/Low) for each claim. High = verified from official docs/sandbox testing. Medium = from recent articles/reviews. Low = from marketing copy or older sources.
- Cite source URLs wherever possible.
- BaaS provider information changes fast — note dates of sources where available.
- **Target 600–800 lines.** Quality over quantity — cut generic observations.

## Your Task

Produce one research report: `api-landscape.md`

---

### 1. Banking-as-a-Service Providers (Griffin Alternatives)
For each provider, document: Name, UK FCA status, sandbox availability, API quality (REST/GraphQL, docs quality, SDK availability), key capabilities (accounts, payments, cards, lending), pricing model, ease of sandbox access (can a developer start in <1 hour?), limitations, **confidence level** for each claim.

Providers to evaluate:
- Griffin (current — document capabilities we're already using)
- Railsr (formerly Railsbank) — note current status
- ClearBank
- Modulr
- TrueLayer (Open Banking)
- Yapily (Open Banking)
- Any other relevant UK-licensed BaaS

### 2. Lending & Credit APIs
- Sandbox lending APIs with easy access
- Credit scoring/decisioning APIs
- How to simulate lending journeys in development

### 3. Payment APIs
- International payment providers (Wise API, CurrencyCloud, etc.)
- Open Banking payment initiation
- Real-time payment capabilities

### 4. Recommendation
- Which combination of APIs gives the best developer experience for our POC?
- Which have sandboxes that actually work reliably?
- Recommended primary BaaS + supplementary APIs
- What to mock vs. what to integrate for the POC

---

## Output Format

- Well-structured markdown with comparison tables (include confidence level column)
- Include source URLs and API doc links
- Be specific about sandbox quality and developer experience
- Flag uncertain information explicitly

## Output Path

```
docs/neobank-v2/01-research/api-landscape.md
```
