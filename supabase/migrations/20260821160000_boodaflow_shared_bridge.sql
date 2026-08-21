-- BoodaFlow shared paper-only bridge for Alpha Hunter + Kavora Markets.
-- Additive by design: existing Alpha Hunter and Kavora runtimes remain intact
-- while both systems migrate to this normalized coordination layer.

create table if not exists public.boodaflow_candidates (
  id uuid primary key default gen_random_uuid(),
  candidate_id text not null unique,
  schema_version text not null default '1.0',
  observed_at timestamptz not null,
  received_at timestamptz not null default now(),
  source_system text not null,
  source_event_id text,
  symbol text not null,
  market text,
  signal text not null check (signal in ('BUY', 'SELL', 'HOLD', 'OBSERVE')),
  raw_confidence numeric not null check (raw_confidence >= 0 and raw_confidence <= 1),
  adjusted_confidence numeric check (adjusted_confidence is null or (adjusted_confidence >= 0 and adjusted_confidence <= 1)),
  score numeric,
  price numeric not null check (price > 0),
  liquidity_usd numeric check (liquidity_usd is null or liquidity_usd >= 0),
  data_freshness jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  safety jsonb not null default '{}'::jsonb,
  status text not null default 'generated'
    check (status in ('generated', 'enriched', 'accepted', 'rejected', 'expired')),
  idempotency_key text not null unique,
  paper boolean not null default true check (paper = true),
  live_trading_enabled boolean not null default false check (live_trading_enabled = false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.boodaflow_candidates is
  'Normalized paper-only candidate bus shared by Alpha Hunter discovery and Kavora/BoodaFlow analysis.';

create index if not exists boodaflow_candidates_observed_at_idx
  on public.boodaflow_candidates (observed_at desc);
create index if not exists boodaflow_candidates_source_symbol_idx
  on public.boodaflow_candidates (source_system, symbol, observed_at desc);
create index if not exists boodaflow_candidates_status_idx
  on public.boodaflow_candidates (status, observed_at desc);

create table if not exists public.boodaflow_decisions (
  id uuid primary key default gen_random_uuid(),
  decision_id text not null unique,
  candidate_id text references public.boodaflow_candidates(candidate_id) on delete restrict,
  decision_version text not null default '1.0',
  action text not null check (action in ('ACCEPT', 'REJECT', 'HOLD', 'EXIT', 'HALT')),
  adjusted_confidence numeric check (adjusted_confidence is null or (adjusted_confidence >= 0 and adjusted_confidence <= 1)),
  risk_decision jsonb not null default '{}'::jsonb,
  portfolio_context jsonb not null default '{}'::jsonb,
  reason_codes text[] not null default '{}'::text[],
  evidence_snapshot jsonb not null default '{}'::jsonb,
  decided_at timestamptz not null default now(),
  idempotency_key text not null unique,
  paper boolean not null default true check (paper = true),
  live_trading_enabled boolean not null default false check (live_trading_enabled = false),
  created_at timestamptz not null default now()
);

comment on table public.boodaflow_decisions is
  'Final paper-only BoodaFlow decision ledger. Only this coordination layer may authorize mutation of the combined paper portfolio.';

create index if not exists boodaflow_decisions_candidate_idx
  on public.boodaflow_decisions (candidate_id, decided_at desc);
create index if not exists boodaflow_decisions_action_idx
  on public.boodaflow_decisions (action, decided_at desc);

create table if not exists public.boodaflow_portfolio_runtime (
  id smallint primary key default 1 check (id = 1),
  mode text not null default 'paper' check (mode = 'paper'),
  live_trading_enabled boolean not null default false check (live_trading_enabled = false),
  status text not null default 'HALTED' check (status in ('RUNNING', 'DEGRADED', 'HALTED')),
  reason_code text not null default 'NOT_STARTED',
  state jsonb not null default '{"cashBalance":10000,"portfolioValue":10000,"positions":[],"closedTrades":[]}'::jsonb,
  lease_owner uuid,
  lease_until timestamptz,
  last_heartbeat_at timestamptz,
  last_decision_at timestamptz,
  run_count bigint not null default 0 check (run_count >= 0),
  consecutive_errors integer not null default 0 check (consecutive_errors >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.boodaflow_portfolio_runtime is
  'Single authoritative combined Alpha Hunter + Kavora paper portfolio runtime. Live-money execution is structurally disabled.';

insert into public.boodaflow_portfolio_runtime (id)
values (1)
on conflict (id) do nothing;

alter table public.boodaflow_candidates enable row level security;
alter table public.boodaflow_decisions enable row level security;
alter table public.boodaflow_portfolio_runtime enable row level security;

-- Server-only bridge. No browser/client access is required.
revoke all on table public.boodaflow_candidates from anon, authenticated;
revoke all on table public.boodaflow_decisions from anon, authenticated;
revoke all on table public.boodaflow_portfolio_runtime from anon, authenticated;

grant all on table public.boodaflow_candidates to service_role;
grant all on table public.boodaflow_decisions to service_role;
grant all on table public.boodaflow_portfolio_runtime to service_role;
