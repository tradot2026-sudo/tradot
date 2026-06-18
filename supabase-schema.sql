-- Tradot: Investment Payout Tracker Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- CLIENTS TABLE
-- ============================================================
create table if not exists public.clients (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_by uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- PLANS TABLE
-- ============================================================
create type payout_frequency as enum ('daily', 'weekly', 'monthly');
create type plan_status as enum ('active', 'paused', 'completed', 'cancelled');
create type payment_mode as enum ('cash', 'bank_transfer', 'upi', 'cheque', 'other');

create table if not exists public.plans (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  plan_name text not null,
  principal_amount numeric(15, 2) not null,
  payout_type payout_frequency not null default 'monthly',
  payout_amount numeric(15, 2),        -- fixed amount per payout
  payout_percentage numeric(5, 4),      -- percentage of principal (e.g. 0.02 = 2%)
  start_date date not null,
  maturity_date date,                   -- either set manually or auto-calculated
  duration_months integer,              -- used to auto-calculate maturity date
  total_payouts integer,                -- auto-calculated
  default_payment_mode payment_mode default 'cash',
  status plan_status default 'active',
  notes text,
  created_by uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- PAYOUTS TABLE
-- ============================================================
create type payout_status as enum ('pending', 'partial', 'paid', 'overdue', 'waived');

create table if not exists public.payouts (
  id uuid default uuid_generate_v4() primary key,
  plan_id uuid references public.plans(id) on delete cascade not null,
  due_date date not null,
  expected_amount numeric(15, 2) not null,
  paid_amount numeric(15, 2) default 0,
  payment_date date,
  mode_of_payment payment_mode,
  reference_no text,
  status payout_status default 'pending',
  notes text,
  payout_number integer,                -- sequence number within plan
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_clients_created_by on public.clients(created_by);
create index if not exists idx_plans_client_id on public.plans(client_id);
create index if not exists idx_payouts_plan_id on public.payouts(plan_id);
create index if not exists idx_payouts_due_date on public.payouts(due_date);
create index if not exists idx_payouts_status on public.payouts(status);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clients_updated_at before update on public.clients
  for each row execute procedure public.handle_updated_at();

create trigger plans_updated_at before update on public.plans
  for each row execute procedure public.handle_updated_at();

create trigger payouts_updated_at before update on public.payouts
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.clients enable row level security;
alter table public.plans enable row level security;
alter table public.payouts enable row level security;

-- Clients: only creator can see/modify
create policy "Users can manage their own clients"
  on public.clients for all
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

-- Plans: accessible if user owns the client
create policy "Users can manage plans for their clients"
  on public.plans for all
  using (
    exists (
      select 1 from public.clients
      where clients.id = plans.client_id
      and clients.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clients
      where clients.id = plans.client_id
      and clients.created_by = auth.uid()
    )
  );

-- Payouts: accessible if user owns the plan's client
create policy "Users can manage payouts for their plans"
  on public.payouts for all
  using (
    exists (
      select 1 from public.plans
      join public.clients on clients.id = plans.client_id
      where plans.id = payouts.plan_id
      and clients.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.plans
      join public.clients on clients.id = plans.client_id
      where plans.id = payouts.plan_id
      and clients.created_by = auth.uid()
    )
  );
