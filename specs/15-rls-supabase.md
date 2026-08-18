# SPEC 15 — RLS y hardening de funciones en Supabase

> **Estado:** Implementado
> **Depende de:** 06-leaderboard-catalogo-supabase, 13-supabase-auth, 14-identidad-leaderboard
> **Fecha:** 2026-08-18
> **Objetivo:** Cerrar los riesgos de seguridad a nivel de base de datos que specs 06/13/14 dejaron documentados como aceptados: habilitar RLS en `profiles`, restringir el INSERT de `scores` a `auth.uid() = user_id`, quitar `SECURITY DEFINER` de la vista `scores_best` y revocar el `EXECUTE` público de `handle_new_user()`.

## Por qué existe este spec

`references/security/checklist.md` recoge los hallazgos del linter de seguridad de Supabase (`get_advisors(type: "security")`) y de una revisión manual. Varios de esos hallazgos son riesgos que specs anteriores dejaron documentados a propósito, con la intención explícita de resolverlos en una spec futura:

- Spec 06 creó `scores` con `create policy "anyone can insert a score" ... with check (true)`, documentado como riesgo aceptado.
- Spec 13 creó `profiles` **sin** RLS, con la nota "Este spec crea la tabla sin row level security habilitada... hasta la spec futura que la agregue".
- Spec 14 reafirmó que "la protección de este spec es a nivel aplicación... la política de base de datos queda para una spec futura de RLS".

Esta es esa spec futura. El checklist también señala una vista `SECURITY DEFINER` (`scores_best`, de spec 06) y dos funciones `SECURITY DEFINER` invocables por `anon`/`authenticated` vía RPC (`handle_new_user`, de spec 13, y `rls_auto_enable`, infraestructura de la plataforma Supabase). El resto del checklist (headers de Next.js y configuración del dashboard de Auth) se resuelve en spec 16, un área distinta de este.

## Alcance

**Dentro del alcance:**

- Habilitar RLS en `profiles` con políticas `SELECT` y `UPDATE` restringidas a `auth.uid() = id`. El `INSERT` lo sigue haciendo únicamente el trigger `handle_new_user` (`SECURITY DEFINER`, bypassa RLS) — sin política de `INSERT` explícita.
- Reemplazar la política `"anyone can insert a score"` de `scores` (`INSERT ... WITH CHECK (true)`) por `WITH CHECK (auth.uid() = user_id)`.
- `ALTER VIEW scores_best SET (security_invoker = true)`.
- `REVOKE EXECUTE ON FUNCTION handle_new_user() FROM anon, authenticated`.

**Fuera de alcance (diferido):**

- `rls_auto_enable()`: es infraestructura propia de la plataforma Supabase (trigger de evento que auto-habilita RLS en tablas nuevas), no código de este repo — no se toca.
- Headers de seguridad en Next.js y configuración del dashboard de Supabase Auth (password mínimo, leaked password protection, rate limit de signup) → spec 16.
- Backfill de las filas históricas de `scores` con `user_id` null (siguen existiendo, la nueva política de INSERT no las afecta retroactivamente).
- Política de `DELETE`/`UPDATE` en `scores` — no existen hoy y no se agregan; quedan denegadas por defecto al no tener política, que es el comportamiento deseado (nadie edita ni borra puntajes).
- Política pública de `SELECT` en `profiles` para mostrar perfiles de otros usuarios — nada en el código lo necesita hoy.

## Modelo de datos

```sql
-- profiles: habilitar RLS + políticas de fila propia
alter table profiles enable row level security;

create policy "users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Sin política de INSERT: solo el trigger handle_new_user() (SECURITY DEFINER)
-- inserta filas, y ese bypassa RLS por definición.

-- scores: reemplazar la política pública de INSERT
drop policy "anyone can insert a score" on scores;

create policy "authenticated users can insert own score"
  on scores for insert
  with check (auth.uid() = user_id);

-- scores_best: quitar SECURITY DEFINER
alter view scores_best set (security_invoker = true);

-- handle_new_user: revocar ejecución directa vía RPC pública
-- Postgres otorga EXECUTE a PUBLIC por defecto al crear una función; revocarlo
-- solo de anon/authenticated no alcanza porque ambos heredan el permiso vía
-- PUBLIC. Hace falta revocarlo también de PUBLIC (detectado durante la
-- verificación manual de este paso, ver Riesgos).
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.handle_new_user() from public;
```

No hay cambios de tipos ni interfaces TypeScript en este spec — todo es DDL/DCL sobre Supabase.

## Plan de implementación

1. Migración MCP `profiles_enable_rls`: `alter table profiles enable row level security` + políticas `select`/`update` de fila propia (bloque SQL de arriba). Prueba manual: `select relrowsecurity from pg_class where relname = 'profiles'` → `true`; con la anon key, `select * from profiles` sin sesión devuelve 0 filas; logueado, `/perfil` sigue mostrando el nickname propio y permite editarlo.
2. Migración MCP `scores_restrict_insert_policy`: `drop policy` + `create policy` de INSERT en `scores` (bloque SQL de arriba). Prueba manual: jugar y guardar un puntaje logueado sigue insertando la fila (usa `auth.uid()` real vía `saveScoreAction`); un INSERT directo con la anon key sin sesión, o con `user_id` de otro usuario, es rechazado por RLS.
3. Migración MCP `scores_best_security_invoker`: `alter view` (bloque SQL de arriba). Prueba manual: `/salon` y `/games` siguen mostrando el mejor puntaje por juego sin cambios visibles; se verifica con `select reloptions from pg_class where relname = 'scores_best'` → incluye `security_invoker=true`.
4. Migración MCP `handle_new_user_revoke_execute`: `revoke execute` (bloque SQL de arriba). Prueba manual: registrar una cuenta nueva por email sigue creando su fila en `profiles` (el trigger no depende de ese grant); una llamada directa a `/rest/v1/rpc/handle_new_user` con la anon key devuelve 401/403 en vez de ejecutar la función.
5. Ejecutar `get_advisors(type: "security")` de Supabase tras las 4 migraciones. Prueba manual: ya no aparecen `rls_disabled_in_public` (profiles), `security_definer_view` (scores_best), ni los dos `*_security_definer_function_executable` de `handle_new_user`. Solo quedan los de `rls_auto_enable` (fuera de alcance) y `auth_leaked_password_protection` (spec 16).

## Criterios de aceptación

- [x] `select relrowsecurity from pg_class where relname = 'profiles'` → `true`.
- [x] Con la anon key y sin sesión, `select * from profiles` devuelve 0 filas.
- [x] Logueado, `/perfil` sigue mostrando el nickname propio y permite editarlo a uno disponible.
- [x] Guardar un puntaje logueado (flujo normal de `saveScoreAction`) sigue insertando la fila en `scores` correctamente.
- [x] Un INSERT directo en `scores` con la anon key, sin sesión o con un `user_id` que no coincide con `auth.uid()`, es rechazado por RLS.
- [x] `/salon` y `/games` siguen mostrando el mejor puntaje por juego sin cambios visibles tras el fix de `scores_best`.
- [x] Registrar una cuenta nueva por email o OAuth sigue creando su fila en `profiles` con nickname válido. **Verificado por evidencia indirecta, no por signup en vivo**: dos intentos de registrar una cuenta de prueba chocaron con el rate limit de emails de Supabase (`email rate limit exceeded`, el mismo límite que resuelve spec 16) antes de llegar al `insert` en `auth.users`. Se confirmó en cambio que `auth.users` y `profiles` siguen 1:1 sin huérfanos (`users_without_profile = 0`) y que el trigger `handle_new_user` no fue modificado en este spec — solo se le revocó `EXECUTE` directo, que en Postgres no afecta su disparo como trigger `SECURITY DEFINER`.
- [x] Una llamada a `/rest/v1/rpc/handle_new_user` con la anon key no ejecuta la función (403/401). Verificado con `has_function_privilege('anon', 'public.handle_new_user()', 'execute')` → `false` (y lo mismo para `authenticated`).
- [x] `get_advisors(type: "security")` ya no reporta `rls_disabled_in_public` (profiles), `security_definer_view` (scores_best), ni `anon_security_definer_function_executable`/`authenticated_security_definer_function_executable` para `handle_new_user`.
- [x] Las filas históricas de `scores` sin `user_id` siguen visibles en `/salon` sin errores (13 filas al momento de la verificación, no 3 — creció desde spec 14, comportamiento esperado).

## Decisiones tomadas y descartadas

- **Sí:** partir en dos specs (15 base de datos, 16 headers + config de Auth). Son áreas independientes entre sí — ninguna bloquea a la otra — y mantiene cada spec commiteable y verificable por separado, mismo patrón que specs 13/14.
- **No:** un solo spec para todo el checklist. El checklist mezcla DDL de Supabase, config de Next.js y config de dashboard; separarlo evita un plan de implementación con pasos de naturaleza muy distinta en un mismo checklist.
- **Sí:** política de INSERT en `scores` con `auth.uid() = user_id`. Cierra exactamente el riesgo que spec 06 y spec 14 dejaron documentado como aceptado ("un INSERT directo con la anon key... podría escribir cualquier user_id"); es coherente con que `saveScoreAction` ya exige sesión desde spec 14.
- **No:** dejar `with check(true)` en `scores`. Ya no tiene justificación una vez que la app nunca inserta sin sesión.
- **Sí:** `profiles` con SELECT/UPDATE restringidos a la fila propia, sin SELECT público. Nada en el código lee el perfil de otro usuario; abrir SELECT público sería una superficie de exposición sin consumidor real.
- **Sí:** `scores_best` con `security_invoker = true` en vez de recrear la vista desde cero. Es un `ALTER VIEW` de una línea, no cambia la query ni el resultado, y `scores` ya es de lectura pública así que no hay diferencia funcional.
- **Sí:** revocar `EXECUTE` de `handle_new_user()` solo para `anon`/`authenticated`, no tocar el trigger. El trigger se ejecuta como `SECURITY DEFINER` sin depender de esos grants; revocar el `EXECUTE` público solo cierra la vía de RPC directa.
- **No:** tocar `rls_auto_enable()`. Es infraestructura propia de la plataforma Supabase (nombre y comportamiento de trigger de evento sugieren que la gestiona Supabase, no este repo) — modificarla está fuera del control del repo y puede ser sobrescrita por la plataforma en cualquier momento.

## Riesgos identificados

| Riesgo                                                                                                                                                                                                     | Mitigación                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| La nueva política de INSERT en `scores` rompe el guardado de puntajes si `saveScoreAction` no envía `user_id` correctamente                                                                                | Spec 14 ya resuelve `user_id` desde `getCurrentUser()` en servidor antes de insertar; criterio de aceptación verifica el flujo normal de guardado tras la migración.                                                                                                                                         |
| Habilitar RLS en `profiles` bloquea la lectura que hace `getCurrentProfile()` en `lib/auth/user.ts` si la sesión no se propaga correctamente al cliente Supabase de servidor                               | `getCurrentProfile()` ya usa el cliente de servidor con cookies de sesión (spec 13); la política `auth.uid() = id` coincide exactamente con ese patrón de acceso. Criterio de aceptación cubre `/perfil` explícitamente.                                                                                     |
| `security_invoker = true` en `scores_best` expone la vista a la RLS de `scores` en vez de bypassarla, y si en el futuro `scores` restringe su SELECT público, la vista dejaría de mostrar datos sin aviso  | Hoy `scores` tiene SELECT público (`"scores are publicly readable"`), sin cambios en este spec; se documenta como dependencia implícita para cualquier spec futura que toque esa política.                                                                                                                   |
| Revocar `EXECUTE` de `handle_new_user()` rompe el alta de cuentas si el trigger sí dependiera de ese grant                                                                                                 | Postgres ejecuta funciones `SECURITY DEFINER` invocadas por triggers con los privilegios del owner de la función, no del rol que dispara el evento — el `REVOKE` no afecta la invocación vía trigger. Criterio de aceptación verifica alta de cuenta nueva tras la migración.                                |
| `rls_auto_enable()` queda fuera de alcance con el WARN sin resolver                                                                                                                                        | Riesgo aceptado a propósito: es infraestructura de la plataforma Supabase, no del repo; se documenta como no resuelto, igual que specs previas documentaron riesgos aceptados.                                                                                                                               |
| `revoke execute ... from anon, authenticated` no revoca el acceso real: Postgres otorga EXECUTE a PUBLIC por defecto, y ambos roles heredan el permiso vía PUBLIC sin importar el revoke explícito por rol | Detectado durante la verificación manual del paso 4 (no en el plan original): `has_function_privilege('anon', ..., 'execute')` seguía devolviendo `true` tras el primer revoke. Se agregó `revoke execute on function public.handle_new_user() from public;` — verificado que ambos roles quedan en `false`. |

## Lo que **no** entra en este spec

- Headers de seguridad en Next.js y configuración del dashboard de Supabase Auth (password mínimo, leaked password protection, rate limit de signup) → spec 16.
- Modificar o eliminar `rls_auto_enable()`.
- Backfill o borrado de las filas históricas de `scores` sin `user_id`.
- Políticas de `UPDATE`/`DELETE` en `scores`, o `SELECT` público en `profiles`.

Cada uno de esos, si llega, va en su propio spec.
