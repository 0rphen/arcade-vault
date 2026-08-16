# Temas visuales por juego

Fuente: inspección de `components/games/*/engine.ts` y `components/games/types.ts`. Fecha de consulta: 2026-08-11.

Referencia para el agente `skin-designer` (`.claude/agents/skin-designer.md`): qué juegos ya tienen temas implementados y cuáles siguen pendientes, para no repetir trabajo ni proponer un juego sin engine.

## Estado del contrato `GameTheme`

`GameTheme` **ya existe** en `components/games/types.ts` (creado por `skin-designer` para `caida`, 2026-08-11): contrato base (`id`, `mode`, `background`, `grid`) + `GameThemeMode`, `GameThemeVariants<T>`, `GameThemeOption`, `GameThemeSelection`, y `theme?: GameThemeSelection` opcional en `PlayableGameProps`. Cada juego extiende el contrato base con sus slots propios en `components/games/<slug>/themes.ts`.

El selector vive en el HUD compartido (`components/game-player.tsx`, clase `.hud-theme`): aparece solo si la entrada del juego en `registry.ts` declara `themes`. Persistencia en `localStorage` con claves `arcade-vault:<game-id>:theme` y `arcade-vault:<game-id>:mode`. Default global: `clasico` / `dark`. Los juegos nuevos deben seguir este mismo patrón, no inventar otro.

## Juegos jugables (candidatos a temas)

| id         | carpeta     | título   | colores hardcodeados en `engine.ts` (aprox.)                    | temas (Neon/Retro/Clásico × light/dark)               |
| ---------- | ----------- | -------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| `rocas`    | `asteroids` | ROCAS    | ~7                                                              | ❌ pendiente                                          |
| `caida`    | `caida`     | TETRIS   | 13 (ya tematizados)                                             | ✅ implementado — Clásico / Neón / Retro × dark+light |
| `arkanoid` | `arkanoid`  | ARKANOID | 11 (ya tematizados; ladrillos/pala/bola/explosiones por sprite) | ✅ implementado — Clásico / Neón / Retro × dark+light |
| `snake`    | `snake`     | SNAKE    | 3 (ya tematizados; frutas por sprite)                           | ✅ implementado — Clásico / Neón / Retro × dark+light |
| `frogger`  | `frogger`   | FROGGER  | 24 (ya tematizados; sin sprites)                                | ✅ implementado — Clásico / Neón / Retro × dark+light |

`caida`: slots en `components/games/caida/themes.ts` (`background`, `nextBackground`, `grid`, `blockHighlight`, `ghostAlpha`, `pieces.{i,o,t,s,z,j,l,n}`). Sin sprites — todas sus superficies son color plano y quedan dentro de la paleta. `clasico`/`dark` es hex por hex el render original.

`snake`: slots en `components/games/snake/themes.ts` (`background`, `grid`, `snakeHead`, `snakeBody`, `fruitHalo`). Reutiliza el contrato `GameTheme` ya existente (no se extendió `types.ts`). Las frutas son sprites del atlas `public/games/snake/fruits.png` (`sprites.ts`) y **quedan fuera de la paleta**: sólo se les añade un halo detrás (`fruitHalo`) para legibilidad en modo claro. `clasico`/`dark` es hex por hex el render original (`#000`, cabeza `#7dffb0`, cuerpo `#3ddc84`, sin rejilla ni halo: ambos slots valen `"transparent"` y el engine los omite).

`arkanoid`: slots en `components/games/arkanoid/themes.ts` (`background`, `grid`, `hudText`, `overlayScrim`, `overlayText`, `pauseScrim`, `pauseText`, `levelButtonActive`, `levelButtonIdle`, `levelButtonBorder`, `levelButtonActiveLabel`, `levelButtonIdleLabel`). Reutiliza el contrato `GameTheme` ya existente (no se extendió `types.ts`). Ladrillos, pala, bola y explosiones vienen de `/sprites/spritesheet-breakout.png` y **quedan fuera de la paleta** (no re-tematizables sin assets nuevos). `grid` se usa como marco interior del área de juego y vale `#000` en `clasico`/`dark`, así que el render por defecto es idéntico píxel a píxel al original.

`frogger`: slots en `components/games/frogger/themes.ts` (`background`, `grid`, `goalZone`, `river`, `safe`, `road`, `cars[3]`, `carWheel`, `truckBody`, `truckCab`, `log`, `logGrain`, `turtleShell`, `turtleShellInner`, `turtleSubmerged`, `goalSlot`, `goalBorder`, `goalFilled`, `frog`, `frogEye`, `frogPupil`, `timerHigh/Mid/Low`, `hudText`, `hudTextShadow`, `hudLife`). Reutiliza el contrato `GameTheme` ya existente (no se extendió `types.ts`). Sin sprites: todas las superficies son color plano y están dentro de la paleta. `grid` se usa para separadores de carril y vale `"transparent"` en `clasico`/`dark`, así que el render por defecto es hex por hex el original.

## Juegos solo-catálogo (sin engine, no aplican todavía)

`gloton`, `invasores`, `ranaria`, `duelo-pixel` — sin componente jugable registrado en `PLAYABLE_GAMES`. No son candidatos a temas hasta pasar por `/add-game` + `/spec-impl`. Ver `references/implemented_games.md`.

## Cómo actualizar este archivo

Cuando `skin-designer` complete un juego, actualizar su fila: marcar ✅ implementado, listar los temas añadidos y anotar si se creó/extendió `GameTheme` en `types.ts`.
