-- Migration 018: Add summary column to conversations for summarisation (ADR-05)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS summary TEXT;
