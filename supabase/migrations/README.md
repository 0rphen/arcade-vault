# supabase/migrations

Espejo versionado en el repo de las migraciones aplicadas al proyecto Supabase de **desarrollo** vía `mcp__supabase__apply_migration`.

## Convención (vigente desde 2026-08-20)

Cualquier cambio de esquema en dev (tabla, columna, policy, función, trigger, índice, vista, etc.) se aplica en dos pasos, en este orden:

1. `mcp__supabase__apply_migration` contra el proyecto dev, con `name` en snake_case describiendo el cambio (igual que las migraciones ya existentes: `create_games_and_scores`, `add_user_id_to_scores`, etc.). Esto lo aplica y lo deja trackeado en el historial remoto de Supabase (`mcp__supabase__list_migrations`).
2. Inmediatamente después, escribir el mismo SQL en un archivo nuevo acá: `<version>_<name>.sql`, donde `<version>` es el mismo timestamp `YYYYMMDDHHMMSS` que devolvió `apply_migration` (visible en `list_migrations`) y `<name>` el mismo nombre usado en el paso 1.

No se reescriben ni se editan migraciones ya aplicadas — un fix se hace como migración nueva.

## Por qué

Antes de esta convención, el esquema de dev solo vivía en el proyecto remoto (17 migraciones aplicadas vía `apply_migration` entre specs 04–17, sin archivo local — ver `specs/18-migracion-produccion.md`). Versionar cada migración nueva como archivo acá permite:

- Auditar el historial de esquema en el repo/git, no solo en el dashboard de Supabase.
- Reconstruir o replayar el esquema contra otro proyecto (por ejemplo un futuro refresh de `supabase/prod/`) sin depender de acceso al proyecto dev.

## Relación con `supabase/prod/`

`supabase/prod/` (spec 18) es un snapshot consolidado del estado final de dev, pensado para pegar una sola vez en un proyecto de producción nuevo — no se actualiza migración por migración. Esta carpeta (`supabase/migrations/`) es el historial incremental de dev hacia adelante. Si el catálogo de juegos o el esquema cambian después de spec 18, `supabase/prod/02-seed-games.sql` (u otro archivo de `prod/`) se actualiza a mano cuando corresponda migrar ese cambio a producción — no automáticamente por cada migración de dev.

## Migraciones previas a esta convención

Las 17 migraciones aplicadas a dev entre 2026-08-03 y 2026-08-20 (specs 04–17) no tienen archivo local — ver `mcp__supabase__list_migrations` para el historial remoto completo, y `specs/18-migracion-produccion.md` para el estado final reconstruido. No se backfillean retroactivamente.
