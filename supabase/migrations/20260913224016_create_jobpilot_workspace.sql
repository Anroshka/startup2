create table if not exists public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;

grant select, insert, update, delete on public.workspaces to authenticated;

create policy "users can read own workspace"
on public.workspaces
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "users can insert own workspace"
on public.workspaces
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users can update own workspace"
on public.workspaces
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users can delete own workspace"
on public.workspaces
for delete
to authenticated
using ((select auth.uid()) = user_id);
