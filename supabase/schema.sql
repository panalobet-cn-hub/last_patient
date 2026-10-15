-- The Last Patient: one-event schema. Run this entire file in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  session_token_hash text not null unique,
  recovery_code_hash text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  is_winner boolean not null default false,
  active boolean not null default true
);
-- One attempt per employee for this one-time event; completed sessions are retained.
create unique index if not exists one_active_session_per_employee
  on public.game_sessions(employee_id) where active = true and completed_at is null;
create index if not exists game_sessions_employee_idx on public.game_sessions(employee_id);

create table if not exists public.clue_progress (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  clue_number integer not null check (clue_number between 1 and 4),
  completed_at timestamptz not null default now(),
  unique(session_id, clue_number)
);
create index if not exists clue_progress_session_idx on public.clue_progress(session_id, clue_number);

create table if not exists public.game_winners (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.game_sessions(id),
  employee_id uuid not null references public.employees(id),
  completed_at timestamptz not null default now(),
  -- Every row must use this same value, making only one winner possible for the event.
  event_singleton boolean not null default true unique check (event_singleton = true)
);

-- Keep all tables inaccessible to anon/authenticated clients. The app uses its server-only service key.
alter table public.employees enable row level security;
alter table public.game_sessions enable row level security;
alter table public.clue_progress enable row level security;
alter table public.game_winners enable row level security;
revoke all on public.employees, public.game_sessions, public.clue_progress, public.game_winners from anon, authenticated;

-- This function is the authoritative, race-safe clue validator.
create or replace function public.complete_clue(p_session_id uuid, p_clue_number integer)
returns table(outcome text, completed_count integer) language plpgsql security definer set search_path = public as $$
declare v_count integer; v_completed timestamptz; v_active boolean;
begin
  if p_clue_number < 1 or p_clue_number > 4 then return query select 'invalid_clue', 0; return; end if;
  select gs.active and gs.completed_at is null into v_active from game_sessions gs where gs.id=p_session_id for update;
  if coalesce(v_active,false)=false then return query select 'session_inactive', 0; return; end if;
  select cp.completed_at into v_completed from clue_progress cp where cp.session_id=p_session_id and cp.clue_number=p_clue_number;
  if v_completed is not null then
    select count(*)::integer into v_count from clue_progress where session_id=p_session_id;
    return query select 'already_complete', v_count; return;
  end if;
  select count(*)::integer into v_count from clue_progress where session_id=p_session_id;
  if p_clue_number <> v_count + 1 then return query select 'out_of_order', v_count; return; end if;
  insert into clue_progress(session_id,clue_number) values(p_session_id,p_clue_number) on conflict(session_id,clue_number) do nothing;
  select count(*)::integer into v_count from clue_progress where session_id=p_session_id;
  return query select 'completed', v_count;
end; $$;
revoke all on function public.complete_clue(uuid, integer) from public, anon, authenticated;
grant execute on function public.complete_clue(uuid, integer) to service_role;

-- Call only after the server has checked the secret answer. The unique singleton winner
-- constraint guarantees one winner even if two correct requests arrive simultaneously.
create or replace function public.claim_winner(p_session_id uuid)
returns table(outcome text, winner_session_id uuid, winner_employee_id uuid, finished_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_employee uuid; v_count integer; v_existing game_winners%rowtype; v_finished timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('the-last-patient-single-event-winner'));
  select employee_id, completed_at into v_employee, v_finished from game_sessions
    where id=p_session_id and active=true for update;
  if v_employee is null then return query select 'session_inactive', null::uuid, null::uuid, null::timestamptz; return; end if;
  select count(*)::integer into v_count from clue_progress where session_id=p_session_id;
  if v_count <> 4 then return query select 'clues_incomplete', null::uuid, null::uuid, null::timestamptz; return; end if;
  select * into v_existing from game_winners limit 1;
  if found then
    if v_existing.session_id=p_session_id then
      return query select 'you_won', v_existing.session_id, v_existing.employee_id, v_existing.completed_at;
    else
      return query select 'already_won', v_existing.session_id, v_existing.employee_id, v_existing.completed_at;
    end if;
    return;
  end if;
  v_finished := clock_timestamp();
  insert into game_winners(session_id,employee_id,completed_at) values(p_session_id,v_employee,v_finished);
  update game_sessions set completed_at=v_finished,is_winner=true,active=false where id=p_session_id;
  return query select 'you_won', p_session_id, v_employee, v_finished;
end; $$;
revoke all on function public.claim_winner(uuid) from public, anon, authenticated;
grant execute on function public.claim_winner(uuid) to service_role;
