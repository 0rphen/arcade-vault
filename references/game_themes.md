# Temas visuales por juego

Fuente: inspección de `components/games/*/engine.ts` y `components/games/types.ts`. Fecha de consulta: 2026-08-11.

Referencia para el agente `skin-designer` (`.claude/agents/skin-designer.md`): qué juegos ya tienen temas implementados y cuáles siguen pendientes, para no repetir trabajo ni proponer un juego sin engine.

## Estado del contrato `GameTheme`

`GameTheme` **ya existe** en `components/games/types.ts` (creado por `skin-designer` para `caida`, 2026-08-11): contrato base (`id`, `mode`, `background`, `grid`) + `GameThemeMode`, `GameThemeVariants<T>`, `GameThemeOption`, `GameThemeSelection`, y `theme?: GameThemeSelection` opcional en `PlayableGameProps`. Cada juego extiende el contrato base con sus slots propios en `components/games/<slug>/themes.ts`.

El selector vive en el HUD compartido (`components/game-player.tsx`, clase `.hud-theme`): aparece solo si la entrada del juego en `registry.ts` declara `themes`. Persistencia en `localStorage` con claves `arcade-vault:<game-id>:theme` y `arcade-vault:<game-id>:mode`. Default global: `clasico` / `dark`. Los juegos nuevos deben seguir este mismo patrón, no inventar otro.

## Juegos jugables (candidatos a temas)

| id         | carpeta     | título   | colores hardcodeados en `engine.ts` (aprox.) | temas (Neon/Retro/Clásico × light/dark) |
| ---------- | ----------- | -------- | -------------------------------------------- | --------------------------------------- |
| `rocas`    | `asteroids` | ROCAS    | ~7                                           | ❌ pendiente                            |
| `caida`    | `caida`     | TETRIS   | 13 (ya tematizados)                          | ✅ implementado — Clásico / Neón / Retro × dark+light |
| `arkanoid` | `arkanoid`  | ARKANOID | ~19                                          | ❌ pendiente                            |
| `snake`    | `snake`     | SNAKE    | ~2 (usa `sprites.ts` para arte)              | ❌ pendiente                            |

`caida`: slots en `components/games/caida/themes.ts` (`background`, `nextBackground`, `grid`, `blockHighlight`, `ghostAlpha`, `pieces.{i,o,t,s,z,j,l,n}`). Sin sprites — todas sus superficies son color plano y quedan dentro de la paleta. `clasico`/`dark` es hex por hex el render original.

`snake` además tiene `sprites.ts` (arte de sprites), a revisar junto con el engine si se le asignan temas.

## Juegos solo-catálogo (sin engine, no aplican todavía)

`gloton`, `invasores`, `ranaria`, `duelo-pixel` — sin componente jugable registrado en `PLAYABLE_GAMES`. No son candidatos a temas hasta pasar por `/add-game` + `/spec-impl`. Ver `references/implemented_games.md`.

## Cómo actualizar este archivo

Cuando `skin-designer` complete un juego, actualizar su fila: marcar ✅ implementado, listar los temas añadidos y anotar si se creó/extendió `GameTheme` en `types.ts`.
