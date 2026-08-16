# Juegos implementados

Fuente: tabla `games` en Supabase + `components/games/registry.ts`. Fecha de consulta: 2026-08-15.

## Jugables (engine + leaderboard real)

| id         | título            | categoría | descripción corta                                             | spec                |
| ---------- | ----------------- | --------- | ------------------------------------------------------------- | ------------------- |
| `rocas`    | ROCAS (Asteroids) | SHOOTER   | Pulveriza asteroides en gravedad cero.                        | 05                  |
| `caida`    | TETRIS            | PUZZLE    | Encaja las piezas de Tetris antes de que el techo te aplaste. | 07                  |
| `arkanoid` | ARKANOID          | ARCADE    | Rebota la pelota y destruye muros de bloques.                 | 08                  |
| `snake`    | SNAKE             | ARCADE    | Snake clásico: crece sin morder tu propia cola.               | 09                  |
| `frogger`  | FROGGER           | ARCADE    | Cruza la carretera y el río sin convertirte en papilla.       | game-jam/frogger/01 |

Cada uno tiene `engine.ts` (canvas game loop) y `<slug>-canvas.tsx` en `components/games/<slug>/`, registrados en `components/games/registry.ts`, con puntuaciones persistidas vía `lib/actions/scores.ts`.

`frogger` reemplazó (mismo patrón que `bloque-buster`→`arkanoid` y `serpentina`→`snake`) al placeholder de catálogo `ranaria`: la fila de Supabase se actualizó in place (`id`, `title`, `cover`, `color`), no se insertó una fila nueva.

## Solo catálogo (sin engine todavía)

Presentes en la tabla `games` (portada, categoría, descripción) pero sin componente jugable registrado — no tienen entrada en `PLAYABLE_GAMES`.

| id            | título      | categoría | descripción corta                          |
| ------------- | ----------- | --------- | ------------------------------------------ |
| `gloton`      | GLOTÓN      | ARCADE    | Devora puntos y escapa de los fantasmas.   |
| `invasores`   | INVASORES   | SHOOTER   | Defiende el planeta de filas alienígenas.  |
| `duelo-pixel` | DUELO PIXEL | VERSUS    | Dos paletas. Una pelota. Reflejos máximos. |

Para implementarlos, usar `/add-game` seguido de `/spec-impl`.
