# SPEC 18 — Migración de Supabase dev a producción

> **Estado:** Implementado
> **Depende de:** 04-supabase-base-setup, 06-leaderboard-catalogo-supabase, 13-supabase-auth, 15-rls-supabase, 16-headers-y-auth-config, 17-hardening-auth
> **Fecha:** 2026-08-20
> **Objetivo:** Producir los artefactos versionados en el repo que permiten desplegar el esquema, RLS, funciones y catálogo de juegos de Arcade Vault en un proyecto Supabase de **producción**, nuevo y separado del de desarrollo, sin que Claude tenga acceso a ese proyecto.

## Por qué existe este spec

El proyecto tenía un solo Supabase (dev), construido incrementalmente vía `mcp__supabase__apply_migration` a lo largo de specs 04–17. No existe carpeta `supabase/` en el repo — el esquema solo vivía dentro del proyecto dev, sin versionar. Al aparecer un proyecto de producción nuevo (vacío, sin acceso de Claude por diseño), hacía falta reconstruir ese esquema como artefactos ejecutables por el usuario, no replayar las 17 migraciones tal cual (el historial incluye renombres y updates intermedios — `caida`→TETRIS, `bloque-buster`→`arkanoid`, `serpentina`→`snake` — que son ruido para un proyecto nuevo).

## Alcance

**Dentro del alcance:**

- Reconstrucción del esquema completo desde el **estado final** de dev: tablas `games`, `scores`, `profiles`, `auth_rate_limits`; vista `scores_best`; funciones `handle_new_user()` y `auth_rate_limit_attempt(...)`; trigger `on_auth_user_created`; RLS + policies; `revoke execute` de las funciones `SECURITY DEFINER`.
- Seed del catálogo `games` (8 filas) como `insert ... on conflict do update`, re-ejecutable.
- Script de verificación post-migración (solo `select`s).
- Checklist de configuración manual del dashboard de Auth y de variables de entorno del hosting, que no vive en SQL.

**Agregado post-implementación (2026-08-20):** `supabase/prod/04-readonly-role.sql` — rol grupo `arcade_vault_readonly` + usuario `arcade_vault_reader` (`BYPASSRLS`) para conexión directa de solo lectura vía pooler (Supavisor), sin exponer la password de `postgres`. No es un cambio de esquema, es un artefacto de acceso; no reabre los criterios de aceptación ya cerrados de este spec.

**Fuera de alcance (deliberado):**

- Datos de `scores` (13 filas), `profiles` (3) y usuarios de `auth.users` (3) de dev — son datos de prueba, no se migran. Prod arranca con el catálogo pero sin historial de partidas ni cuentas.
- Cualquier ejecución contra el proyecto de producción — este spec entrega archivos que el usuario ejecuta por su cuenta desde el SQL Editor del dashboard de prod.
- Agregar el proyecto de prod a `.mcp.json` — sigue apuntando solo a dev.
- Supabase CLI / `supabase link` / `supabase db push` — se eligió un script SQL consolidado para pegar en el dashboard en vez de migraciones versionadas vía CLI, para no depender de que el usuario tenga el CLI autenticado contra prod.

## Modelo de datos

Sin cambios de estructura sobre dev — este spec **reconstruye** el estado final ya existente en dev como archivos ejecutables contra prod. El detalle completo vive en `supabase/prod/01-schema.sql` (comentado); resumen:

```sql
-- 4 tablas, RLS enabled en las 4:
-- games(id, title, short, long, cat, cover, color, plays, created_at)
-- scores(id, game_id -> games.id, name, score, created_at, user_id -> auth.users.id on delete set null)
-- profiles(id -> auth.users.id on delete cascade, nickname unique, created_at)
-- auth_rate_limits(id, ip, action check in ('signin','signup'), created_at)

-- 1 vista: scores_best (security_invoker = true)

-- 2 funciones SECURITY DEFINER, search_path fijo '', EXECUTE revocado de
-- public/anon/authenticated: handle_new_user(), auth_rate_limit_attempt(...)

-- 1 trigger: on_auth_user_created after insert on auth.users

-- 5 policies: games/select, scores/select, scores/insert (auth.uid() = user_id),
-- profiles/select y profiles/update (auth.uid() = id).
-- auth_rate_limits sin policies — deny-by-default intencional (spec 17).
```

## Plan de implementación

1. Inventariar el estado final de dev vía MCP (`list_tables verbose`, `list_migrations`, `pg_policies`, `pg_get_functiondef`, `pg_get_triggerdef`, `pg_indexes`, `information_schema.role_table_grants`) para tener el esquema completo, no solo el historial de migraciones. Prueba manual: el inventario cubre las 4 tablas, la vista, ambas funciones, el trigger y las 5 policies sin faltantes.
2. Escribir `supabase/prod/01-schema.sql`: tablas → índices → vista → funciones (copiadas literal de `pg_get_functiondef`) → trigger → RLS + policies → revokes, envuelto en `begin`/`commit`. Prueba manual: releer el archivo contra el inventario del paso 1, objeto por objeto.
3. Escribir `supabase/prod/02-seed-games.sql`: `insert ... on conflict (id) do update` con las 8 filas reales de `games` en dev. Prueba manual: diff entre el `select` de dev y las filas del archivo.
4. Escribir `supabase/prod/03-verify.sql`: `select`s de solo lectura con el valor esperado documentado en comentario arriba de cada uno (conteo de tablas, `relrowsecurity`, `pg_policies`, `reloptions` de `scores_best`, trigger, `proacl` de las funciones, conteo de `games`).
5. Escribir `references/deploy/prod-checklist.md`: URL Configuration, Providers (Email/Google/GitHub con credenciales OAuth nuevas), Passwords, Rate Limits, SMTP, env vars del hosting, post-deploy (`get_advisors`), humo end-to-end. Prueba manual: cada ítem del checklist referencia el spec o archivo de código donde se originó el requisito.
6. Cerrar el criterio de aceptación pendiente de `specs/17-hardening-auth.md` sobre `NEXT_PUBLIC_SITE_URL` una vez que el checklist de este spec (paso 5, sección env vars) lo cubra como parte del despliegue a prod.

## Criterios de aceptación

- [x] `supabase/prod/01-schema.sql` reconstruye, objeto por objeto, el inventario relevado de dev: 4 tablas con sus columnas/constraints/FKs exactos, 4 índices no-PK, 1 vista con `security_invoker=true`, 2 funciones `SECURITY DEFINER`/`search_path ''` idénticas a `pg_get_functiondef`, 1 trigger, RLS habilitado en las 4 tablas, 5 policies, y `revoke execute` de ambas funciones sobre `public`/`anon`/`authenticated`.
- [x] `supabase/prod/02-seed-games.sql` contiene las 8 filas reales de `games` en dev, con `on conflict do update` para ser re-ejecutable.
- [x] `supabase/prod/03-verify.sql` es de solo lectura (sin `insert`/`update`/`delete`/`alter`) y cada bloque documenta el valor esperado.
- [x] `references/deploy/prod-checklist.md` cubre URL Configuration, Providers, Passwords, Rate Limits, SMTP, env vars (con tabla de origen/consumidor) y humo end-to-end, sin duplicar lo que ya resuelve el SQL.
- [x] Ningún paso de este spec ejecutó código contra un proyecto Supabase de producción — todo el trabajo fue lectura de dev + escritura de archivos en el repo.
- [x] `specs/17-hardening-auth.md` mantiene su criterio de `NEXT_PUBLIC_SITE_URL` como pendiente hasta que el usuario complete el checklist de este spec contra el hosting real; no se marca cerrado por adelantado sin verificación real.

## Decisiones tomadas y descartadas

- **Sí:** reconstruir desde el estado final de dev en vez de exportar y replayar las 17 migraciones tal cual. El historial tiene renombres y correcciones intermedias (títulos de juegos, fixes de `search_path`, RLS habilitada/deshabilitada dos veces) que no aportan nada a un proyecto nuevo y solo agregan pasos de migración innecesarios.
- **Sí:** solo migrar el catálogo `games`. `scores`/`profiles`/usuarios de dev son datos de prueba; migrar usuarios reales de `auth.users` requeriría exportar password hashes vía `pg_dump` directo a la base (no disponible por MCP) y no tiene sentido para un lanzamiento de producción que arranca sin usuarios.
- **Sí:** SQL consolidado para pegar en el dashboard en vez de Supabase CLI (`supabase link`/`db push`). Evita depender de que el usuario tenga el CLI instalado y autenticado contra prod; el trade-off es que prod no queda con historial de migraciones versionado por el CLI — aceptado, puede adoptarse más adelante si hace falta.
- **No:** agregar el proyecto de prod a `.mcp.json`. Contradice la restricción explícita del usuario de que Claude no tenga acceso a producción.
- **Sí:** documentar en `03-verify.sql` los valores esperados como comentarios en vez de un script que falle solo (`assert`). Mantiene el archivo como solo-lectura seguro de pegar sin riesgo, a costa de que la comparación la haga el usuario a simple vista.

## Riesgos identificados

| Riesgo                                                                                    | Mitigación                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El usuario pega `01-schema.sql` dos veces por error                                       | Está envuelto en `begin`/`commit`; un segundo `create table` sin `if not exists` falla y aborta la transacción entera sin dejar estado a medias. No se usó `if not exists` a propósito, para que un reintento accidental sea obvio en vez de silencioso. |
| Las credenciales OAuth de dev se reusan por error en prod                                 | `prod-checklist.md` lo marca explícito como "no reusar las de dev", con la URL de callback específica de prod a registrar en cada proveedor.                                                                                                             |
| Signups reales fallan por el rate limit de SMTP por defecto de Supabase                   | Documentado en el checklist (sección 4) con la recomendación de configurar SMTP propio antes de tráfico real — mismo límite que ya bloqueó verificaciones manuales en spec 15.                                                                           |
| El seed de `games` queda desactualizado si el catálogo de dev cambia después de este spec | `02-seed-games.sql` usa `on conflict do update`, por lo que puede re-ejecutarse en el futuro para resincronizar sin necesidad de un spec nuevo.                                                                                                          |

## Lo que **no** entra en este spec

- Migración de `scores`, `profiles` o usuarios de `auth.users` de dev a prod.
- Cualquier ejecución de SQL o configuración directamente contra el proyecto de producción por parte de Claude.
- Supabase CLI / migraciones versionadas vía `supabase db push`.
- Configuración de SMTP propio, dominio, DNS o el deploy del hosting en sí — el checklist los referencia como pasos del usuario, no los ejecuta.

Cada uno de esos, si llega, va en su propio spec.
