-- All agent credentials and decisions are server only. The workspace JSON is
-- deliberately separate so a browser save cannot overwrite a scheduled run.
create table public.agent_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  resume_id text not null default '',
  daily_limit integer not null default 2 check (daily_limit between 1 and 5),
  min_salary integer not null default 0 check (min_salary between 0 and 10000000),
  blocked_companies text[] not null default '{}',
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  hh_user_id text,
  updated_at timestamptz not null default now(),
  check (not enabled or (access_token is not null and resume_id <> ''))
);
alter table public.agent_settings enable row level security;
revoke all on public.agent_settings from public, anon, authenticated;
grant select, insert, update, delete on public.agent_settings to service_role;

create table public.agent_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  vacancy_id text not null,
  title text not null,
  company text not null,
  status text not null check (status in ('reserved', 'sent', 'review', 'skipped')),
  reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, vacancy_id)
);
create index agent_attempts_day on public.agent_attempts (user_id, created_at desc);
alter table public.agent_attempts enable row level security;
revoke all on public.agent_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.agent_attempts to service_role;

-- The row lock serializes concurrent cron invocations for a user. Any
-- ambiguous outcome occupies a slot and cannot be automatically retried.
create function public.reserve_agent_attempt(
  p_user_id uuid, p_vacancy_id text, p_title text, p_company text, p_daily_limit integer
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare claimed integer;
begin
  perform 1 from public.agent_settings
    where user_id = p_user_id and enabled and daily_limit = p_daily_limit
    for update;
  if not found then return false; end if;
  if (select count(*) from public.agent_attempts
      where user_id = p_user_id and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
        and status in ('reserved', 'sent', 'review')) >= p_daily_limit then
    return false;
  end if;
  insert into public.agent_attempts(user_id, vacancy_id, title, company, status)
    values (p_user_id, p_vacancy_id, p_title, p_company, 'reserved')
    on conflict do nothing returning 1 into claimed;
  return claimed = 1;
end;
$$;
revoke all on function public.reserve_agent_attempt(uuid,text,text,text,integer) from public, anon, authenticated;
grant execute on function public.reserve_agent_attempt(uuid,text,text,text,integer) to service_role;
