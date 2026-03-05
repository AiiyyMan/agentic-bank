# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- 26 unit tests (Vitest + MSW) covering all critical and high-priority bugs
- Test infrastructure: mock factories for Supabase, Griffin, and Anthropic clients
- Product Requirements Document (docs/PRD.md)
- Root README.md with quick start guide
- CONTRIBUTING.md with development setup and PR process
- .env.example files for API and mobile workspaces
- GitHub issue and PR templates
- .nvmrc, .editorconfig

### Fixed
- Race condition on double-confirm — atomic status update prevents duplicate execution
- Failed executions now marked 'failed' instead of reverting to 'pending'
- Amount validation cap raised from £10,000 to £25,000 (matches loan products)
- Missing `return` in auth middleware after 500 error response
- Griffin retry off-by-one — now makes exactly 3 attempts (was 4)
- Idempotency key uses UUID instead of `Date.now()` (was defeating duplicate protection)
- Exported `calculateEMI` and `mockLoanDecision` from lending service

## [0.1.0] - 2026-03-05

### Added
- Conversational AI banking agent powered by Claude Sonnet 4
- Two-phase confirmation pattern for all write operations
- 10 Claude tools: check_balance, get_transactions, get_accounts, get_beneficiaries, get_loan_status, send_payment, add_beneficiary, apply_for_loan, make_loan_payment, respond_to_user
- Griffin BaaS integration (sandbox): accounts, payments, KYC onboarding
- Supabase Auth (email/password) with Postgres and Row-Level Security
- React Native mobile app (Expo SDK 55) with tab navigation
- Chat interface using react-native-gifted-chat with custom UI component renderers
- Rich UI cards: balance, transactions, confirmations, loan offers, loan status, errors
- Loan products: Personal Loan (£500–£25K @ 12.9%), Quick Cash (£100–£2K @ 19.9%)
- Mock loan decisioning with affordability checks
- Agent loop with max 5 tool iterations per message
- Conversation history with 20-message cap and auto-rotation
- Rate limiting (10 chat requests/minute per user)
- Health check endpoint monitoring all external services
- Turborepo monorepo with npm workspaces
- Comprehensive audit documentation (Architecture, API, Data Model, External Services, Troubleshooting, Test Plan)
