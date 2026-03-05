# Contributing to Agentic Bank

## Development Setup

### Prerequisites

- Node.js 22 (see `.nvmrc`)
- npm 10+
- Accounts: Griffin (sandbox), Supabase, Anthropic — see [README](README.md#external-accounts-required)

### Getting Started

```bash
# Clone and install
git clone <repo-url>
cd agentic-bank
npm install

# Set up environment
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
# Fill in your credentials — see comments in each .env.example

# Set up database
# Paste supabase/migrations/001_schema.sql into your Supabase SQL Editor

# Verify tests pass
cd apps/api && npm test
```

## Making Changes

### Branch Naming

```
feature/short-description   # New functionality
fix/short-description       # Bug fixes
docs/short-description      # Documentation only
test/short-description      # Test additions/changes
```

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add scheduled payment tool
fix: prevent double-confirm race condition
docs: update API reference for loan endpoints
test: add auth middleware error path tests
refactor: extract tool validation into shared utility
```

### Pull Requests

- Fill out the [PR template](.github/PULL_REQUEST_TEMPLATE.md)
- Link related issues
- Keep PRs focused — under 400 lines preferred
- Include tests for changed behaviour

## Testing

### Running Tests

```bash
# From repo root
npm test --workspace=apps/api

# Or from API directory
cd apps/api && npm test

# Watch mode (during development)
cd apps/api && npx vitest
```

### Writing Tests

This project uses a **test-first approach**: write a failing test that demonstrates the bug or expected behaviour, then implement the fix/feature.

**Test location:** `apps/api/src/__tests__/`

**Mock patterns:**
- Use `vi.hoisted()` for mock objects referenced in `vi.mock()` factories (Vitest hoists `vi.mock` above variable declarations)
- Supabase mock uses a chainable query builder — all methods return `this`, terminal `.single()` returns configurable promises
- Griffin mock uses `vi.fn()` stubs for each API method
- Use `mockResolvedValueOnce()` to queue sequential responses for tests that make multiple DB calls

**Example test structure:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSupabase, mockSingle } = vi.hoisted(() => {
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const chain: Record<string, any> = {};
  for (const m of ['from', 'select', 'insert', 'update', 'eq', 'single']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = mockSingle;
  return { mockSupabase: chain, mockSingle };
});

vi.mock('../lib/supabase.js', () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

describe('Feature', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should do the expected thing', async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: '1' }, error: null });
    // ... test
  });
});
```

See existing tests in `apps/api/src/__tests__/` for more patterns.

## Project Conventions

- **TypeScript strict mode** — avoid `any` unless explicitly justified
- **Two-phase confirmation** — all write tools must create a pending action, never execute directly
- **Read vs write tools** — read tools execute immediately; write tools require user confirmation
- **Error handling** — use `ToolError` factories from `lib/errors.ts`; always return errors to Claude (don't throw)
- **Logging** — use Pino logger from `lib/logger.ts` with structured context

## Adding a New Tool

1. Define the tool schema in `apps/api/src/tools/definitions.ts`
2. Add to `READ_ONLY_TOOLS` or `WRITE_TOOLS` set
3. Add to `ALL_TOOLS` array and `TOOL_PROGRESS` map
4. Implement the handler in `apps/api/src/tools/handlers.ts`
5. Write tests in `apps/api/src/__tests__/`
6. Update the system prompt in `apps/api/src/services/agent.ts` if Claude needs guidance on when to use the tool

## Where to Start

- Look at [open issues](../../issues) for tasks tagged `good first issue`
- Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the system design
- Read [docs/API.md](docs/API.md) for the full API reference
- The codebase is small enough to read end-to-end in an hour
