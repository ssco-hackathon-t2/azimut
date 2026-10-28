-- Rate-Limit der Function azimut-chat erweitern: pro IP und Stunde plus ein globales Tageslimit über alle IPs.
-- Gleiche Tabelle chat_hits, gleiche Funktion chat_allow; Rückgabe jetzt 'ok', 'ip' oder 'global'.
-- Kann im SQL-Editor ausgeführt werden und lässt sich wiederholen.

-- Globale Zählung über das Zeitfenster braucht einen Index auf dem Zeitpunkt.
create index if not exists chat_hits_at on public.chat_hits (at);

drop function if exists public.chat_allow(text, int, int);

create or replace function public.chat_allow(
  p_ip_hash text,
  p_limit int,
  p_window_s int,
  p_global_limit int,
  p_global_window_s int
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Alle Aufrufe nacheinander, damit das globale Limit auch bei gleichzeitigen Anfragen hält (wenige hundert am Tag).
  perform pg_advisory_xact_lock(hashtext('public.chat_allow'));
  delete from public.chat_hits where at < now() - make_interval(secs => greatest(p_window_s, p_global_window_s));
  if (select count(*) from public.chat_hits where at >= now() - make_interval(secs => p_global_window_s)) >= p_global_limit then
    return 'global';
  end if;
  if (select count(*) from public.chat_hits where ip_hash = p_ip_hash and at >= now() - make_interval(secs => p_window_s)) >= p_limit then
    return 'ip';
  end if;
  insert into public.chat_hits (ip_hash) values (p_ip_hash);
  return 'ok';
end;
$$;

revoke execute on function public.chat_allow(text, int, int, int, int) from public, anon, authenticated;
grant execute on function public.chat_allow(text, int, int, int, int) to service_role;
