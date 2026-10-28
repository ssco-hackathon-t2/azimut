-- Rate-Limit der Function azimut-chat: Edge-Function-Instanzen teilen keinen Speicher, der Zähler liegt daher hier.
-- Gespeichert wird nur ein SHA-256-Hash der IP; Einträge älter als das Zeitfenster werden bei jedem Aufruf gelöscht.
create table if not exists public.chat_hits (
  ip_hash text not null,
  at timestamptz not null default now()
);
create index if not exists chat_hits_ip_at on public.chat_hits (ip_hash, at);

-- RLS ohne Policies: anon und authenticated sehen nichts, nur der Service-Key der Function kommt dran.
alter table public.chat_hits enable row level security;
revoke all on table public.chat_hits from anon, authenticated;

create or replace function public.chat_allow(p_ip_hash text, p_limit int, p_window_s int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  -- Gleichzeitige Anfragen derselben IP nacheinander zählen.
  perform pg_advisory_xact_lock(hashtext(p_ip_hash));
  delete from public.chat_hits where at < now() - make_interval(secs => p_window_s);
  select count(*) into n from public.chat_hits where ip_hash = p_ip_hash;
  if n >= p_limit then
    return false;
  end if;
  insert into public.chat_hits (ip_hash) values (p_ip_hash);
  return true;
end;
$$;

revoke execute on function public.chat_allow(text, int, int) from public, anon, authenticated;
-- Ausdrücklich, weil der Default-Grant fehlen kann, wenn die Data API bei der Projekterstellung aus war.
grant execute on function public.chat_allow(text, int, int) to service_role;
