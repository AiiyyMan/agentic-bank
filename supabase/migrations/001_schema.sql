-- Agentic Bank schema
-- Run this against your Supabase project's SQL editor

-- User profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  griffin_legal_person_url text,
  griffin_account_url text,
  griffin_onboarding_application_url text,
  display_name text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users read own profile" on profiles for select using (auth.uid() = id);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Conversations
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.conversations enable row level security;
create policy "Users see own conversations" on conversations for all using (auth.uid() = user_id);

-- Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations on delete cascade not null,
  role text not null,
  content text,
  tool_calls jsonb,
  ui_components jsonb,
  created_at timestamptz default now()
);

alter table public.messages enable row level security;
create policy "Users see own messages" on messages for all
  using (conversation_id in (select id from conversations where user_id = auth.uid()));

-- Pending actions (two-phase confirmation)
create table if not exists public.pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  tool_name text not null,
  params jsonb not null,
  status text default 'pending',
  idempotency_key text unique,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

alter table public.pending_actions enable row level security;
create policy "Users see own actions" on pending_actions for all using (auth.uid() = user_id);

-- Loan products
create table if not exists public.loan_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  min_amount numeric not null,
  max_amount numeric not null,
  interest_rate numeric not null,
  min_term_months int not null,
  max_term_months int not null
);

-- Loan applications
create table if not exists public.loan_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  amount numeric not null,
  term_months int not null,
  purpose text,
  status text default 'pending',
  decision_reason text,
  interest_rate numeric,
  monthly_payment numeric,
  created_at timestamptz default now()
);

alter table public.loan_applications enable row level security;
create policy "Users see own applications" on loan_applications for all using (auth.uid() = user_id);

-- Active loans
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references loan_applications,
  user_id uuid references auth.users not null,
  principal numeric not null,
  balance_remaining numeric not null,
  interest_rate numeric not null,
  monthly_payment numeric not null,
  term_months int not null,
  next_payment_date date,
  status text default 'active',
  disbursed_at timestamptz default now()
);

alter table public.loans enable row level security;
create policy "Users see own loans" on loans for all using (auth.uid() = user_id);

-- Seed loan products
insert into loan_products (name, min_amount, max_amount, interest_rate, min_term_months, max_term_months)
values
  ('Personal Loan', 500, 25000, 12.9, 6, 60),
  ('Quick Cash', 100, 2000, 19.9, 3, 12)
on conflict do nothing;
