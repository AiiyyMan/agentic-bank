-- Migration 020: Add idempotency_key to transactions for safe payment deduplication
--
-- Prevents duplicate transaction rows if a confirmed payment is retried
-- (network error, app crash after execution, etc.).
-- Key format: 'txn-{pending_action_id}'

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
