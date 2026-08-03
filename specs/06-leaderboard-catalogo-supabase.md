# SPEC 06 — Leaderboard y catálogo de juegos en Supabase

> **Estado:** Implementado
> **Depende de:** 05-asteroids-rocas
> **Fecha:** 2026-08-02
> **Objetivo:** Migrar el catálogo de juegos y el sistema de puntuaciones (salón de la fama + tabla de mejores puntuaciones por juego) de datos mock (`lib/data.ts`, `localStorage`) a tablas reales de Supabase (`games`, `scores`), con guardado real solo para ROCAS y `best` calculado dinámicamente desde los puntajes reales.

## Alcance

**Dentro del alcance:**

- **Tabla `games`** en Supabase — creada vía migración (`mcp__supabase__apply_migration`), sembrada con los 8 juegos actuales de `lib/data.ts` (`id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `plays`). `best` **no** es columna: se calcula en query desde `scores`.
- **Tabla `scores`** en Supabase — creada vía migración, vacía al lanzar (sin seed). Columnas: `id`, `game_id` (FK a `games.id`), `name`, `score`, `created_at`.
- **RLS** — `SELECT` público en ambas tablas; `INSERT` público (anon) solo en `scores`. `games` sin `INSERT`/`UPDATE`/`DELETE` públicos (catálogo de solo lectura desde el cliente).
- **Capa de acceso a datos** (`lib/supabase/queries.ts` o similar) — funciones tipadas para: listar juegos (`getGames`), obtener un juego por id con su `best` calculado (`getGameById`), listar mejores puntuaciones de un juego (`getTopScores(gameId, limit)`), insertar un puntaje (`insertScore`).
- **`/games`** (`components/home.tsx`) — el grid/preview de juegos pasa a leer de Supabase (`getGames`) vía Server Component, en vez de `GAMES` estático.
- **`/games/[id]`** (`app/games/[id]/page.tsx` + `components/game-detail.tsx`) — `game` y la tabla "MEJORES PUNTUACIONES" pasan a leer de Supabase (`getGameById`, `getTopScores`). Si `scores` no tiene filas para ese juego, se muestra estado vacío ("AÚN NO HAY PUNTAJES") en vez de la tabla.
- **`/salon`** (`components/hall-of-fame.tsx`) — tabs, podio y tabla completa leen `getTopScores` por juego seleccionado desde Supabase. Estado vacío real cuando un juego no tiene puntajes (sin podio si hay menos de 3 filas).
- **Guardado de puntaje en ROCAS** (`components/game-player.tsx`) — cuando `game.id === 'rocas'` y se confirma "GUARDAR PUNTUACIÓN", se llama `insertScore` (Supabase) en vez de `appendScore` (localStorage).
- **`generateStaticParams`** de `/games/[id]` pasa a derivarse de `getGames()` (async).

**Fuera de alcance (diferido):**

- **Guardado real para los otros 7 juegos** — siguen usando `appendScore` (localStorage) sin cambios; sus puntajes no aparecen en `/salon` ni en su propia tabla de detalle (que ahora lee de Supabase, vacía para ellos).
- **Autenticación real / Supabase Auth** — el nombre sigue siendo texto libre ingresado en el modal, como hoy. `lib/session.ts` (`av_user`) no se toca.
- **"Tu mejor marca" en `/salon`** — hoy depende de datos simulados (`youScore`/`youRank` inventados); sin auth real y sin guardado real para el usuario logueado, se elimina esa fila en vez de mantenerla con datos falsos.
- **Campo `plays` dinámico** — sigue siendo estático (columna fija en `games`), no hay tracking de partidas jugadas en este spec.
- **Migración del campo `best` de vuelta a `lib/data.ts`** — `lib/data.ts` deja de ser fuente de verdad para `GAMES`/`seededScores` en las pantallas migradas; se evalúa en un spec futuro si se elimina del todo o se conserva para otros usos (tipos `GameCategory`, `CATEGORIES`, `PLAYERS` se mantienen).
- **Rate limiting / validación anti-abuso en `scores`** — INSERT público sin restricciones, según lo decidido.
- **Migrar `duelo-pixel`, `caida`, etc. a jugables reales** — no es parte de este spec (ya cubierto por specs de motor de juego individuales).

## Modelo de datos

### Tablas en Supabase

```sql
-- games: catálogo de juegos, solo lectura desde el cliente
create table games (
  id text primary key,              -- ej. "rocas", coincide con Game.id actual
  title text not null,
  short text not null,
  long text not null,
  cat text not null,                -- 'ARCADE' | 'PUZZLE' | 'SHOOTER' | 'VERSUS'
  cover text not null,              -- clase CSS del cover, ej. "cover-rocas"
  color text not null,              -- 'cyan' | 'magenta' | 'yellow' | 'green'
  plays text not null,              -- ej. "15.6K", estático
  created_at timestamptz not null default now()
);

-- scores: puntajes reales, insertados públicamente (anon)
create table scores (
  id bigint generated always as identity primary key,
  game_id text not null references games(id),
  name text not null,
  score integer not null,
  created_at timestamptz not null default now()
);

create index scores_game_id_score_idx on scores (game_id, score desc);

alter table games enable row level security;
alter table scores enable row level security;

create policy "games are publicly readable" on games
  for select using (true);

create policy "scores are publicly readable" on scores
  for select using (true);

create policy "anyone can insert a score" on scores
  for insert with check (true);
```

`games` se siembra en la misma migración con un `insert` de los 8 registros actuales de `lib/data.ts` (sin `best`, que ya no es columna).

### Tipos TypeScript (`lib/supabase/queries.ts`)

```ts
export interface DbGame {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
  plays: string;
}

export interface GameWithBest extends DbGame {
  best: number; // MAX(score) real, o 0 si no hay puntajes
}

export interface DbScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // formateado desde created_at, "DD/MM/AAAA"
}

export async function getGames(): Promise<DbGame[]>;
export async function getGameById(id: string): Promise<GameWithBest | null>;
export async function getTopScores(
  gameId: string,
  limit?: number,
): Promise<DbScoreRow[]>;
export async function insertScore(entry: {
  gameId: string;
  name: string;
  score: number;
}): Promise<void>;
```

`Game`, `ScoreRow`, `GameCategory`, `GameColor`, `CATEGORIES`, `PLAYERS` de `lib/data.ts` se mantienen (tipos y datos que no dependen de Supabase); `GAMES` y `seededScores` se eliminan del archivo.

## Plan de implementación

1. **Migración Supabase** — vía `mcp__supabase__apply_migration`: crear tablas `games` y `scores` con RLS/policies como en el modelo de datos, más el `insert` de seed de los 8 juegos actuales (sin `best`). Verificable con `mcp__supabase__list_tables`. Sistema Next.js sigue funcionando igual (nada lo consume todavía).

2. **Capa de queries (`lib/supabase/queries.ts`)** — Implementar `getGames`, `getGameById` (con `best` vía `select max(score)` sobre `scores` filtrado por `game_id`, o `0` si no hay filas), `getTopScores` (ordenado por `score desc`, `limit` default 12, mapeado a `DbScoreRow` con `rank` y `date` formateada), `insertScore`. Usa `lib/supabase/server.ts` (Server Components/Route Handlers). Verificable de forma aislada con `tsc`, sin uso todavía en ninguna pantalla.

3. **`lib/data.ts`** — Eliminar `GAMES` y `seededScores`. Mantener `Game`/`GameCategory`/`GameColor`/`ScoreRow`/`CATEGORIES`/`PLAYERS`. Esto rompe temporalmente los imports existentes (`home.tsx`, `game-detail.tsx`, `hall-of-fame.tsx`, `app/games/[id]/page.tsx`) — se corrigen en los pasos siguientes, por lo que se hace en el mismo commit/paso que el consumo real para no dejar el build roto entre pasos.

4. **`/games` (`components/home.tsx` + `app/games/page.tsx`)** — Convertir la carga del grid a Server Component que llama `getGames()` y pasa los datos a `Home` (o mover el fetch a `app/games/page.tsx` y pasar `games` como prop). Reemplaza el `import { GAMES } from "@/lib/data"` por los datos recibidos.

5. **`/games/[id]` (`app/games/[id]/page.tsx` + `components/game-detail.tsx`)** — `generateStaticParams` usa `getGames()` (async). El page llama `getGameById(id)` (404 si `null`) y `getTopScores(id, 10)`. `GameDetail` recibe `game: GameWithBest` y `scores: DbScoreRow[]`; si `scores.length === 0`, renderiza el estado vacío "AÚN NO HAY PUNTAJES" en vez de la lista.

6. **`/salon` (`components/hall-of-fame.tsx`)** — Convertir a que reciba `games: DbGame[]` desde un Server Component padre (`app/salon/page.tsx` llama `getGames()`), y al cambiar de tab hace fetch client-side de `getTopScores(tab)` (vía Route Handler o Server Action, ya que el componente es `"use client"`). Elimina la fila "TU MEJOR MARCA" y su lógica (`youRank`/`youScore`/`getStoredUser` deja de usarse ahí). Si `rows.length < 3`, no renderiza el podio; si `rows.length === 0`, muestra estado vacío en vez de tabla.

7. **Guardado real en ROCAS (`components/game-player.tsx`)** — Cuando `game.id === 'rocas'`, el botón "GUARDAR PUNTUACIÓN" llama a `insertScore({ gameId: game.id, name, score })` (vía Route Handler/Server Action, ya que `appendScore` actual corre en cliente) en vez de `appendScore`. Para el resto de juegos, sigue llamando `appendScore` sin cambios.

8. **Verificación manual en navegador** — `npm run dev`: `/games` muestra el grid con datos reales de Supabase; `/games/rocas` muestra "AÚN NO HAY PUNTAJES" (tabla vacía al inicio); jugar y guardar una partida de ROCAS hace que aparezca en `/games/rocas` y en `/salon` (tab ROCAS) tras refrescar; otros juegos (`/games/serpentina`, etc.) siguen guardando en `localStorage` sin romper nada y muestran "AÚN NO HAY PUNTAJES" en su detalle/salón.

9. **`npm run build`** — compila sin errores de tipos ni de lint.

## Criterios de aceptación

- [x] Existen las tablas `games` y `scores` en Supabase con RLS habilitado y las policies definidas (verificable con `mcp__supabase__list_tables`/`get_advisors`).
- [x] `games` contiene los 8 juegos sembrados (mismos `id`/`title`/etc. que tenía `GAMES` en `lib/data.ts`).
- [x] `lib/data.ts` ya no exporta `GAMES` ni `seededScores`; sigue exportando `Game`, `GameCategory`, `GameColor`, `ScoreRow`, `CATEGORIES`, `PLAYERS`.
- [x] `lib/supabase/queries.ts` exporta `getGames`, `getGameById`, `getTopScores`, `insertScore`, tipados sin `any`.
- [x] `/games` muestra el grid de juegos con datos reales de Supabase (no de `lib/data.ts`).
- [x] `/games/[id]` con un juego sin puntajes reales muestra "AÚN NO HAY PUNTAJES" en vez de una tabla falsa.
- [x] `/games/id-inexistente` sigue devolviendo 404.
- [x] `/salon` lee juegos y puntajes reales por tab desde Supabase; un juego sin puntajes muestra estado vacío y no muestra podio si hay menos de 3 filas.
- [x] La fila "TU MEJOR MARCA" ya no aparece en `/salon`.
- [x] Jugar una partida de ROCAS y confirmar "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` (visible en `/games/rocas` y en `/salon` tras refrescar).
- [x] Guardar puntaje en cualquier otro juego (ej. `serpentina`) sigue usando `appendScore`/`localStorage` sin errores, y no aparece en `/salon` ni en su propia tabla de detalle (que ahora es real).
- [x] `game.best` mostrado en `/games/[id]` refleja `MAX(score)` real de `scores` para ese juego (o `0`/estado equivalente si no hay puntajes).
- [x] `npm run build` compila sin errores de tipos ni de lint.

## Decisiones tomadas y descartadas

- **Migrar catálogo + puntajes juntos, no en specs separados** — se descartó dividirlos porque `best` (catálogo) depende de `scores` (puntajes); separarlos dejaría un spec a medias sin poder calcular `best` real.
- **Solo ROCAS guarda en Supabase, el resto sigue en `localStorage`** — se descartó forzar a los 7 juegos simulados a escribir en Supabase porque sus puntajes son números de temporizador sin valor real; mezclarlos en la tabla real ensuciaría el leaderboard. Costo aceptado: sus tablas de detalle/salón quedan vacías hasta que tengan motor real (como en spec 05).
- **Estado vacío real en vez de seed de `seededScores`** — se descartó sembrar `scores` con datos falsos para no repetir el problema que motivó esta migración (mostrar puntajes que no son de partidas reales).
- **`best` calculado en query (`MAX(score)`), no columna en `games`** — se descartó guardar `best` como columna fija porque desincronizarse del `scores` real sería el mismo problema que tiene hoy `lib/data.ts`; calcularlo en cada lectura mantiene una sola fuente de verdad.
- **Se elimina la fila "TU MEJOR MARCA" de `/salon`** — se descartó mantenerla con datos inventados (`youScore`/`youRank`) porque ahora convive con puntajes reales; mostrar una marca falsa junto a datos reales sería engañoso. Sin auth real no hay forma de calcularla de verdad, así que se remueve en vez de simularla.
- **RLS: `INSERT` público sin restricciones en `scores`** — se descartó agregar validación/rate-limit porque el comportamiento actual (guardar en `localStorage` sin validar) ya es igual de abierto; se documenta como riesgo, no se resuelve aquí.
- **Migración aplicada directo con MCP contra el proyecto real** — se descartó generar solo un archivo `.sql` manual porque ya se cuenta con `mcp__supabase__apply_migration` conectado al proyecto del usuario, evitando el paso manual.
- **`lib/data.ts` conserva tipos/`CATEGORIES`/`PLAYERS`** — se descartó eliminar el archivo por completo porque esos exports no dependen de Supabase y otros componentes (filtros de categoría, etc.) los siguen usando.

## Riesgos identificados

- **INSERT público sin validación en `scores`** — cualquiera con la anon key puede insertar puntajes arbitrarios (scores absurdos, nombres ofensivos) en ROCAS. Mitigación: ninguna en este spec; queda documentado para cuando exista auth real o moderación.
- **`getGameById`/`getTopScores` sin caché** — cada visita a `/games/[id]` o cambio de tab en `/salon` dispara queries reales a Supabase; con tráfico alto podría notarse latencia. Mitigación: fuera de alcance, se evalúa revalidación/caché de Next si se vuelve un problema real.
- **Inconsistencia entre `localStorage` y Supabase para 6 de 8 juegos** — un usuario que guarda puntaje en `serpentina` no lo verá reflejado en ningún lado real (ni `/salon` ni su propio detalle), lo cual puede confundir. Mitigación: documentado como comportamiento esperado hasta que cada juego tenga su propio motor real (patrón de spec 05).
- **Migración de esquema aplicada contra el proyecto Supabase real del usuario** — a diferencia de código, no es reversible con un simple `git revert`; un error en el DDL/seed requeriría una migración de corrección o `mcp__supabase__reset_branch` si se usa una branch de desarrollo. Mitigación: revisar el SQL con el usuario antes de aplicarlo en `/spec-impl`.
