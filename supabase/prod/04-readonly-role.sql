-- Arcade Vault — rol de solo lectura + usuario dedicado para pooling directo
--
-- Separa permisos de credenciales: `arcade_vault_readonly` es un rol grupo
-- (NOLOGIN) que concentra los GRANT de solo lectura; `arcade_vault_reader`
-- es el usuario con password que hereda esos permisos y es lo único que se
-- comparte para conectar por fuera de la app (Supavisor / pooler directo,
-- sin las claves anon/service_role ni la password real de `postgres`).
--
-- Por qué dos roles y no uno: en Postgres los ATRIBUTOS de rol (LOGIN,
-- BYPASSRLS, CONNECTION LIMIT, ALTER ROLE ... SET) no se heredan por
-- pertenencia a un grupo — solo se heredan los GRANT de privilegios. Ese
-- reparto es intencional: BYPASSRLS/límite/timeout van en el usuario.
--
-- BYPASSRLS (en el usuario): ve TODAS las filas de TODAS las tablas de
-- `public`, sin pasar por las policies de RLS (scores/games públicos, pero
-- también profiles y auth_rate_limits completos). Decisión deliberada — si
-- más adelante se quiere acotar el alcance, quitar BYPASSRLS del usuario y
-- las policies existentes (games/select, scores/select, profiles/select)
-- van a filtrar lo que puede ver.
--
-- Reemplazar '<PASSWORD_FUERTE>' antes de ejecutar. Generar con algo como:
--   openssl rand -base64 32

begin;

-- 1) Rol grupo: solo permisos, nunca se conecta directamente.
create role arcade_vault_readonly with nologin;

-- Solo conexión a la db actual + uso del schema public.
-- No se toca el schema `auth` (datos de sesión/credenciales) ni `storage`.
grant connect on database postgres to arcade_vault_readonly;
grant usage on schema public to arcade_vault_readonly;

-- Lectura de todo lo que exista hoy en public (tablas + vistas).
grant select on all tables in schema public to arcade_vault_readonly;

-- Lectura automática de lo que se cree en el futuro en public, sin tener
-- que volver a correr este script por cada tabla nueva. Ojo: solo cubre
-- objetos creados por el rol que corre este script (normalmente `postgres`,
-- que es quien también corre las migraciones de 01-schema.sql).
alter default privileges in schema public
  grant select on tables to arcade_vault_readonly;

-- 2) Usuario con credenciales: el único dato que se comparte para conectar.
create role arcade_vault_reader with
  login
  password '<PASSWORD_FUERTE>'
  inherit
  nosuperuser
  nocreatedb
  nocreaterole
  bypassrls
  connection limit 5;

grant arcade_vault_readonly to arcade_vault_reader;

-- Evita que una query pesada/olvidada quede colgada indefinidamente.
alter role arcade_vault_reader set statement_timeout = '30s';

commit;

-- Connection string (pooler Supavisor, no el puerto directo 5432):
--   postgresql://arcade_vault_reader.<PROJECT_REF>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres
-- <PROJECT_REF> y <region> están en Project Settings → Database del
-- dashboard de prod. Puerto 6543 = transaction mode (recomendado para
-- scripts/queries puntuales); 5432 en el pooler = session mode si hace
-- falta SET/prepared statements.

-- Verificación (solo lectura):
-- select rolname, rolcanlogin, rolbypassrls, rolconnlimit
--   from pg_roles where rolname like 'arcade_vault%' order by rolname;
--   -- esperado: arcade_vault_readonly con rolcanlogin=false;
--   --           arcade_vault_reader con rolcanlogin=true, rolbypassrls=true, rolconnlimit=5
-- select table_name, privilege_type from information_schema.role_table_grants
--   where grantee = 'arcade_vault_readonly' order by table_name;
--   -- esperado: solo SELECT, sobre games/scores/profiles/auth_rate_limits/scores_best

-- Rotar la password del usuario sin tocar los permisos del grupo:
--   alter role arcade_vault_reader password '<PASSWORD_NUEVA>';

-- Revocar el acceso de este usuario (el grupo y sus GRANT quedan intactos):
--   drop role arcade_vault_reader;

-- Agregar un segundo usuario de solo lectura con los mismos permisos:
-- repetir el bloque "2) Usuario con credenciales" de arriba con otro
-- nombre de rol y su propio GRANT arcade_vault_readonly to <nombre>.
