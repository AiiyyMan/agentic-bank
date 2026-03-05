-- Add content_blocks column for structured message storage (tool_use/tool_result blocks)
alter table public.messages
  add column if not exists content_blocks jsonb;
