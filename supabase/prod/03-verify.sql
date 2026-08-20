-- Arcade Vault — verificación post-migración en producción
--
-- Ejecutar DESPUÉS de 01-schema.sql y 02-seed-games.sql. Son todos
-- selects de solo lectura, sin efectos. Cada bloque documenta el valor
-- esperado en un comentario justo encima.

-- Esperado: 4 filas (auth_rate_limits, games, profiles, scores)
select tablename
from pg_tables
where schemaname = 'public'
order by tablename;

-- Esperado: relrowsecurity = true en las 4 tablas
select relname, relrowsecurity
from pg_class
where relname in ('games', 'scores', 'profiles', 'auth_rate_limits')
order by relname;

-- Esperado: 5 filas (games/select, scores/select, scores/insert,
-- profiles/select, profiles/update) — auth_rate_limits NO aparece,
-- es deliberado (deny-by-default, spec 17)
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- Esperado: reloptions incluye "security_invoker=true"
select relname, reloptions
from pg_class
where relname = 'scores_best';

-- Esperado: 1 fila — el trigger existe sobre auth.users
select tgname, relname
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where tgname = 'on_auth_user_created';

-- Esperado: el acl de ambas funciones NO debe listar a anon ni
-- authenticated (solo postgres/service_role deberían poder ejecutar)
select p.proname, p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('handle_new_user', 'auth_rate_limit_attempt');

-- Esperado: 8
select count(*) as total_games from games;

-- Esperado: 0 (todavía no hay scores/usuarios reales en prod recién migrado)
select count(*) as total_scores from scores;
