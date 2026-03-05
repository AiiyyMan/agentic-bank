# Documentation Best Practices Guide — Agentic Bank

> **Purpose:** Practical writing guidance for every document this project needs. Use this alongside [DOC-ASSESSMENT-PROMPT.md](./DOC-ASSESSMENT-PROMPT.md) to produce documentation that developers actually read.

---

## General Principles

1. **Lead with the answer.** Every doc should answer "what do I need to know right now?" in the first 3 lines. Context and history go later.
2. **Write for scanning, not reading.** Most developers skim. Use headers, tables, bullet points, and code blocks. Avoid walls of prose.
3. **One source of truth.** Never duplicate information across files. Cross-reference instead. Duplicated info decays at different rates and creates contradictions.
4. **Keep it honest.** Document what IS, not what you wish it was. Mark planned features clearly. Developers lose trust fast when docs don't match reality.
5. **Test your docs.** Follow your own setup instructions from a fresh clone. If a step fails, the docs are wrong.
6. **Version your docs with the code.** When a PR changes behaviour, the docs update goes in the same PR.

---

## Document-Specific Guidance

### README.md (Root)

**Goal:** A developer lands on the GitHub page and decides within 30 seconds whether to clone it.

**Structure:**
```
# Project Name
One-sentence description.

[screenshot or architecture diagram]

## What This Is
2-3 sentences: what it does, who it's for, what makes it interesting.
Be explicit about status: demo / portfolio / production.

## Quick Start
Numbered steps from clone to running app. Be honest about prerequisites.

## Prerequisites
- Node version (link to .nvmrc)
- External accounts needed (with signup links)
- Estimated setup time

## Architecture
One paragraph + link to docs/ARCHITECTURE.md.
Include the system diagram inline if it's small enough.

## Project Structure
Monorepo tree showing top-level dirs only.

## Development
Commands table: dev, test, build, lint.

## Documentation
Bulleted list linking to every doc in docs/.

## License
```

**Anti-patterns to avoid:**
- Badges nobody reads (keep to 3 max: build, tests, license)
- "Table of Contents" that duplicates the header list — GitHub already renders one
- Aspirational features listed as if they exist
- Setup instructions that assume tools are already installed

**Agentic Bank specifics:**
- Be upfront that 3 external service accounts are needed (Griffin, Supabase, Anthropic)
- Provide realistic time estimate: "~30 minutes for full setup including external accounts"
- Link directly to each service's signup page
- Show the two-phase confirmation pattern early — it's the most interesting architectural choice

---

### PRD (Product Requirements Document)

**Goal:** Anyone (developer, designer, PM) understands what the product does and why — not how it's built.

**Structure:**
```
# Product Requirements — Agentic Bank

## Vision
What problem does this solve? For whom? In one paragraph.

## Target Users
Primary persona(s). What are they trying to accomplish?

## Feature Areas

### [Feature Name] (e.g., Account Balance)
- **User story:** As a [user], I want to [action] so that [outcome]
- **Scope:** What's in v1 / what's planned / what's excluded
- **Status:** Shipped | In Progress | Planned
- **Acceptance criteria:** Bulleted list of what "done" means

### [Next Feature]...

## Non-Functional Requirements
- Security (auth, RLS, confirmation gates)
- Performance targets
- Accessibility
- Supported platforms

## Out of Scope
Explicit list of what this project deliberately does NOT do.

## Success Metrics
How do you know the product works? (Even for a demo: "user can complete a payment end-to-end")
```

**Writing tips:**
- Write user stories from the user's perspective, not the system's. "As a customer, I want to send money to a friend" not "The system shall process payment requests."
- Keep acceptance criteria testable. "Balance updates within 3 seconds" not "Balance updates quickly."
- The PRD is NOT architecture docs. Don't mention Fastify, Supabase, or TypeScript here. Link to ARCHITECTURE.md for that.
- Update status fields when features ship. A stale PRD is worse than no PRD.

**Agentic Bank specifics:**
- Feature areas: Onboarding/KYC, Account Balance, Payments, Loans, Chat Interface, Transaction History
- The two-phase confirmation is a PRODUCT decision (safety) not just a technical one — explain the user-facing "why"
- Distinguish between what Griffin sandbox supports vs. what a production banking app would need
- Be clear this is a demo/portfolio project, not production banking software

---

### CONTRIBUTING.md

**Goal:** A first-time contributor goes from "I want to help" to "PR submitted" with zero guesswork.

**Structure:**
```
# Contributing to Agentic Bank

## Development Setup
1. Fork and clone
2. Prerequisites (link to README)
3. Install dependencies
4. Set up environment (link to .env.example)
5. Run tests to verify setup

## Making Changes
- Branch naming: feature/description, fix/description
- Commit messages: conventional commits (feat:, fix:, docs:, test:)
- One concern per commit

## Testing
- All PRs must include tests for changed behaviour
- Run: npm test (from root or apps/api)
- Test-first approach: write failing test → fix → verify
- Mock patterns: see docs/TEST-PLAN.md

## Pull Requests
- Fill out the PR template
- Link related issues
- Keep PRs focused (< 400 lines preferred)
- Expect review within [timeframe]

## Code Style
- TypeScript strict mode
- No any unless explicitly justified
- [Linter/formatter config if applicable]

## Where to Start
- Issues labelled "good first issue"
- See docs/ for architecture and API reference
```

**Anti-patterns:**
- Don't write a Code of Conduct from scratch — use Contributor Covenant and link to it
- Don't document style rules that your linter already enforces
- Don't require CLA signing for a portfolio project

---

### CHANGELOG.md

**Goal:** Users and contributors understand what changed between versions, without reading git log.

**Format:** Follow [Keep a Changelog](https://keepachangelog.com/):

```markdown
# Changelog

## [Unreleased]

### Added
- 26 unit tests covering all critical and high-priority bugs (#PR)

### Fixed
- Race condition on double-confirm: atomic status update prevents duplicate execution
- Failed executions now marked 'failed' instead of reverting to 'pending'
- Amount validation cap raised from £10,000 to £25,000 to support loan applications
- Missing return in auth middleware after 500 error
- Griffin retry off-by-one: now makes exactly 3 attempts
- Idempotency key uses UUID instead of Date.now()
- Exported calculateEMI and mockLoanDecision from lending service

## [0.1.0] - 2026-03-05
### Added
- Initial implementation: chat, payments, loans, KYC onboarding
- Two-phase confirmation for all write operations
- Griffin BaaS integration (sandbox)
- Supabase auth + Postgres with RLS
```

**Tips:**
- Group by: Added, Changed, Deprecated, Removed, Fixed, Security
- Write entries for humans, not machines. "Fixed race condition on double-confirm" not "Updated handlers.ts line 281"
- Link to PRs or issues where possible
- The [Unreleased] section is your staging area — move entries to a version when you tag a release

---

### .env.example Files

**Goal:** Developer copies the file, fills in values, and the app starts.

**Rules:**
- One `.env.example` per workspace that has its own runtime (`apps/api/`, `apps/mobile/`)
- Include every variable the app reads, with a descriptive comment
- Use obviously-fake placeholder values that will fail loudly (not silently)
- Group variables by service
- Never commit real credentials — `.env` must be in `.gitignore`

**Format:**
```bash
# ── Supabase ──────────────────────────────────────────
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# ── Griffin BaaS (sandbox) ────────────────────────────
# Sign up: https://app.griffin.com
GRIFFIN_API_KEY=your-griffin-api-key
GRIFFIN_ORG_ID=your-org-id
# These URLs are found in your Griffin dashboard under Organization > Accounts
GRIFFIN_RELIANCE_WORKFLOW_URL=https://api.griffin.com/v0/workflows/your-workflow-id
GRIFFIN_PRIMARY_ACCOUNT_URL=https://api.griffin.com/v0/bank/accounts/your-account-id

# ── Anthropic ─────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Agentic Bank specifics:**
- The Griffin URLs are the hardest to find — add a one-line instruction for where to get each one
- Note that Supabase has a placeholder fallback in the code (and whether that's safe to rely on for development)

---

### LICENSE

**Goal:** Legal clarity in one file.

**Guidance:**
- **MIT** if you want maximum adoption (portfolio project, demo)
- **Apache 2.0** if you want patent protection
- Pick one and add the file. Without it, the project is "all rights reserved" by default — nobody can legally use or fork it.
- Use the full license text, not a summary. GitHub auto-detects standard licenses.

---

### GitHub Templates

#### .github/ISSUE_TEMPLATE/bug_report.md
```markdown
---
name: Bug Report
about: Something isn't working as expected
labels: bug
---

## Description
[What happened?]

## Steps to Reproduce
1.
2.
3.

## Expected Behaviour
[What should have happened?]

## Actual Behaviour
[What happened instead?]

## Environment
- OS:
- Node version:
- Branch/commit:
```

#### .github/ISSUE_TEMPLATE/feature_request.md
```markdown
---
name: Feature Request
about: Suggest a new feature or improvement
labels: enhancement
---

## Problem
[What problem does this solve?]

## Proposed Solution
[How should it work?]

## Alternatives Considered
[What else did you think about?]
```

#### .github/PULL_REQUEST_TEMPLATE.md
```markdown
## What
[One sentence: what does this PR do?]

## Why
[What problem does it solve? Link to issue if applicable.]

## How
[Brief description of the approach.]

## Testing
- [ ] New/updated tests included
- [ ] All tests pass (`npm test`)
- [ ] Manual testing performed (describe below)

## Screenshots
[If applicable]
```

**Tips:**
- Keep templates short. Long templates get ignored or deleted.
- Required fields should be questions, not fill-in-the-blank labels
- Match the PR template to your actual review process

---

### .nvmrc / .node-version

Single line, no comments:
```
22
```

This ensures `nvm use` picks up the right version. Place at repo root.

---

### .editorconfig

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

---

## Writing Checklist

Use this before merging any documentation PR:

- [ ] **First 3 lines** answer the reader's most likely question
- [ ] **No stale info** — does it match the current code?
- [ ] **Tested setup steps** — did you follow them from scratch?
- [ ] **No duplication** — is this the single source of truth, or should it be a cross-reference?
- [ ] **Code examples work** — are they copy-pasteable? Do they use current API?
- [ ] **Status labels updated** — Shipped/In Progress/Planned all accurate?
- [ ] **Scannability** — can someone find what they need in 10 seconds?
- [ ] **Honest about gaps** — limitations, known issues, and missing features are documented?

---

## Recommended Writing Order

Write documents in this order to minimize rework:

1. **PRD** — defines what the product is and does. Everything else references this.
2. **.env.example files** — forces you to document every external dependency.
3. **README.md** — now you can write "what this is" (from PRD) and "how to set up" (from .env.example).
4. **CHANGELOG.md** — capture what's already been built and fixed.
5. **CONTRIBUTING.md** — setup references README, testing references existing tests.
6. **LICENSE** — pick one, add the file. 30 seconds.
7. **GitHub templates** — copy from above, adjust to your process.
8. **.nvmrc + .editorconfig** — config files, not writing. 2 minutes.
9. **Audit doc refresh** — update ARCHITECTURE.md and friends to be contributor-friendly rather than audit artifacts.

Each step builds on the previous. The PRD informs the README. The .env.example informs the setup steps. The README informs CONTRIBUTING.md.
