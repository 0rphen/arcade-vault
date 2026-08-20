-- Arcade Vault — esquema de producción
--
-- Reconstruido desde el estado FINAL del proyecto Supabase de desarrollo
-- (no es un replay de las 17 migraciones de dev — esas incluyen renombres
-- y updates intermedios que son ruido para un proyecto nuevo).
--
-- Fuente: specs 04, 06, 13, 14, 15, 16, 17. Ejecutar UNA SOLA VEZ contra un
-- proyecto Supabase de producción vacío, pegando este archivo completo en
-- el SQL Editor del dashboard.
--
-- Orden: tablas -> índices -> vista -> funciones -> trigger -> RLS ->
-- policies -> revokes. Respeta las dependencias de FK y de "función antes
-- de trigger que la usa".
--
-- Nota importante sobre auth_rate_limits: la tabla queda con RLS
-- habilitado y SIN policies a propósito (deny-by-default para anon y
-- authenticated). Solo la leen/escriben las funciones SECURITY DEFINER de
-- este mismo archivo. No agregar policies "para arreglarlo" — es el diseño
-- de spec 17.

begin;

-- ============================================================
-- 1. Tablas
-- ============================================================

create table games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat text not null,
  cover text not null,
  color text not null,
  plays text not null,
  created_at timestamptz not null default now()
);

create table scores (
  id bigint generated always as identity primary key,
  game_id text not null references games (id),
  name text not null,
  score integer not null,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null unique,
  created_at timestamptz not null default now()
);

create table auth_rate_limits (
  id bigint generated always as identity primary key,
  ip text not null,
  action text not null check (action in ('signin', 'signup')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. Índices no-PK (los índices de PK/unique ya los crea la
--    columna primary key / unique de arriba)
-- ============================================================

create index scores_game_id_score_idx on scores (game_id, score desc);
create index scores_user_id_score_idx on scores (user_id, score desc);
create index auth_rate_limits_ip_action_created_at_idx
  on auth_rate_limits (ip, action, created_at);

-- ============================================================
-- 3. Vista scores_best (mejor puntaje por juego)
-- ============================================================

create view scores_best as
  select game_id, max(score) as best
  from scores
  group by game_id;

-- security_invoker: la vista corre con los permisos de quien la
-- consulta, no con los del creador (spec 15, evita que sea un
-- security-definer-view implícito).
alter view scores_best set (security_invoker = true);

-- ============================================================
-- 4. Funciones (SECURITY DEFINER, search_path fijo vacío)
-- ============================================================

create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  base_nickname text;
  final_nickname text;
begin
  base_nickname := coalesce(new.raw_user_meta_data->>'nickname', 'PLAYER');
  final_nickname := base_nickname;
  while exists (select 1 from public.profiles where nickname = final_nickname) loop
    final_nickname := base_nickname || substr(md5(random()::text), 1, 4);
  end loop;
  insert into public.profiles (id, nickname) values (new.id, final_nickname);
  return new;
end;
$function$;

create or replace function public.auth_rate_limit_attempt(p_ip text, p_action text, p_max_attempts integer, p_window_minutes integer)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_count bigint;
begin
  -- serializa llamadas concurrentes para el mismo ip+action, evita el
  -- race entre el count y el insert bajo requests en paralelo.
  perform pg_advisory_xact_lock(hashtext(p_ip || ':' || p_action)::bigint);

  select count(*) into v_count
  from public.auth_rate_limits
  where ip = p_ip
    and action = p_action
    and created_at >= now() - (p_window_minutes || ' minutes')::interval;

  if v_count >= p_max_attempts then
    return false;
  end if;

  insert into public.auth_rate_limits (ip, action) values (p_ip, p_action);
  return true;
end;
$function$;

-- ============================================================
-- 5. Trigger: crea el profile al registrarse un usuario nuevo
-- ============================================================

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 6. RLS + policies
-- ============================================================

alter table games enable row level security;
alter table scores enable row level security;
alter table profiles enable row level security;
alter table auth_rate_limits enable row level security;

create policy "games are publicly readable"
  on games for select
  using (true);

create policy "scores are publicly readable"
  on scores for select
  using (true);

create policy "authenticated users can insert own score"
  on scores for insert
  with check (auth.uid() = user_id);

create policy "users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- auth_rate_limits: sin políticas -> denegado por defecto para anon y
-- authenticated. Solo el cliente de servidor (service role) y las
-- funciones SECURITY DEFINER de arriba lo tocan.

-- ============================================================
-- 7. Revocar EXECUTE público de las funciones SECURITY DEFINER
-- ============================================================
-- Postgres otorga EXECUTE a PUBLIC por defecto al crear una función;
-- anon/authenticated heredan ese permiso vía PUBLIC, así que hay que
-- revocarlo explícitamente de los tres.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.auth_rate_limit_attempt(text, text, integer, integer) from public, anon, authenticated;

commit;
