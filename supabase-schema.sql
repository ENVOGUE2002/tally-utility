create table if not exists public.piece_rate_app_state (
  app_id text primary key,
  state_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.piece_rate_app_state enable row level security;

drop policy if exists "anon can read shared app state" on public.piece_rate_app_state;
create policy "anon can read shared app state"
on public.piece_rate_app_state
for select
to anon
using (true);

drop policy if exists "anon can write shared app state" on public.piece_rate_app_state;
create policy "anon can write shared app state"
on public.piece_rate_app_state
for insert
to anon
with check (true);

drop policy if exists "anon can update shared app state" on public.piece_rate_app_state;
create policy "anon can update shared app state"
on public.piece_rate_app_state
for update
to anon
using (true)
with check (true);
