-- JobPilot workspace ownership and server-side AI budget.
create table if not exists public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;
revoke all on public.workspaces from anon, authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;

-- A fresh project needs ownership policies. Preserve policies already
-- installed on the existing JobPilot project (validated separately).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workspaces' and cmd = 'SELECT') then
    create policy workspaces_select_own on public.workspaces for select to authenticated
      using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workspaces' and cmd = 'INSERT') then
    create policy workspaces_insert_own on public.workspaces for insert to authenticated
      with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workspaces' and cmd = 'UPDATE') then
    create policy workspaces_update_own on public.workspaces for update to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workspaces' and cmd = 'DELETE') then
    create policy workspaces_delete_own on public.workspaces for delete to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end $$;

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  requests integer not null default 0,
  tokens bigint not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
grant select, insert, update, delete on public.ai_usage to service_role;

create or replace function public.reserve_ai_request(p_user_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare reserved integer;
begin
  insert into public.ai_usage (user_id, day, requests)
    values (p_user_id, (now() at time zone 'UTC')::date, 1)
    on conflict (user_id, day) do update
      set requests = public.ai_usage.requests + 1
      where public.ai_usage.requests < 20
    returning requests into reserved;
  return reserved is not null;
end;
$$;

create or replace function public.record_ai_usage(p_user_id uuid, p_tokens integer, p_cost numeric)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.ai_usage
    set tokens = tokens + greatest(0, least(p_tokens, 100000)),
        cost_usd = cost_usd + greatest(0, least(p_cost, 100))
    where user_id = p_user_id and day = (now() at time zone 'UTC')::date;
end;
$$;

revoke all on function public.reserve_ai_request(uuid) from public, anon, authenticated;
revoke all on function public.record_ai_usage(uuid, integer, numeric) from public, anon, authenticated;
grant execute on function public.reserve_ai_request(uuid) to service_role;
grant execute on function public.record_ai_usage(uuid, integer, numeric) to service_role;
