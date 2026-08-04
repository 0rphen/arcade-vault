# SPEC 08 — Arkanoid jugable + leaderboard

> **Estado:** Implementado
> **Depende de:** 06-leaderboard-catalogo-supabase
> **Fecha:** 2026-08-03
> **Objetivo:** Portar el motor de canvas de `references/started-games/04-arkanoid/game.js` a `components/games/arkanoid/`, integrarlo en `GamePlayer` vía el registry, renombrar la fila existente `bloque-buster` → `arkanoid` en el catálogo, y dar de alta su leaderboard real en Supabase.

## Alcance

**Dentro del alcance:**

- **Motor del juego** (`components/games/arkanoid/engine.ts`) — port a TypeScript de `game.js` + `levels.js`: paddle, pelota, bloques con colisión AABB, explosiones (4 frames), 5 niveles con patrones distintos, velocidad +10% por nivel, 3 vidas, score +10 por bloque, estado `win` al completar los 5 niveles. Resolución lógica fija 800×600, paddle 81×14, pelota 16×16. Sprites vía `spritesheet-breakout.png` portado. Sonido (`ball-bounce.mp3`, `break-sound.mp3`) copiado a `public/` y reproducido con `cloneNode().play()`. Selector de nivel en el overlay de pausa (click de mouse, solo activo si el motor está pausado).
- **Wrapper de React** (`components/games/arkanoid/arkanoid-canvas.tsx`) — client component que monta el motor en un `<canvas>` vía `useEffect`/`ref`, escala por CSS dentro de `.crt-screen`, expone:
  - Callbacks `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver` (se disparan solo cuando el valor cambia, no cada frame).
  - Callback `onResumeRequested` (nuevo) — se dispara cuando el jugador elige un nivel en el overlay de pausa, para que `GamePlayer` ponga `paused=false` y el HUD de React quede sincronizado.
  - Prop `paused: boolean`.
  - Cleanup en desmontaje: cancela `requestAnimationFrame` y remueve listeners de teclado y de click.
- **Tipo `PlayableGameProps`** (`components/games/types.ts`) — agregar `onResumeRequested?: () => void`.
- **Registro en `components/games/registry.ts`** — entrada `arkanoid` → `dynamic(() => import(".../arkanoid-canvas"), { ssr: false })`. El registry ya existe (creado en spec 07), no hace falta paso 0.
- **Integración en `GamePlayer`** (`components/game-player.tsx`) — consulta el registry por `game.id`; conecta los callbacks al HUD (`score`, `lives`, `level`); `onResumeRequested` pone `paused=false`; `onGameOver` dispara `saveScoreAction`.
- **Controles** — teclado únicamente para jugar (`←` `→` mueven la paleta), con `preventDefault` mientras el canvas está montado. El click de mouse solo está activo durante la pausa, únicamente sobre los botones de selección de nivel.
- **Catálogo (`games`)** — migración `UPDATE` (no `INSERT`) sobre la fila existente: `id` `bloque-buster` → `arkanoid`, `title` → `ARKANOID`, `short`/`long` actualizados; `cat` (`ARCADE`), `cover` (`cover-bricks`), `color` (`cyan`) y `plays` (`"12.4K"`) se mantienen sin cambios.
- **Leaderboard real** — agregar `arkanoid` a `GAMES_WITH_REAL_SCORES` en `lib/actions/scores.ts`.
- **Assets** — copiar `assets/spritesheet-breakout.png`, `assets/spritesheet.js` (portado a TS) y los 2 `.mp3` a `public/`.
- **Portada** — se reutiliza `cover-bricks` tal cual, sin cambios en `app/globals.css`.

**Fuera de alcance (diferido):**

- **Controles táctiles/mobile** — por defecto diferido.
- **Ajustes de dificultad/balance** — se porta el balance del original tal cual (5 niveles, velocidades por nivel), sin retocar constantes.
- **Control por mouse durante el juego** — el mouse solo se usa en el selector de nivel durante la pausa, nunca para mover la paleta.

## Modelo de datos

```ts
// components/games/arkanoid/engine.ts
export interface ArkanoidCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  onResumeRequested: () => void;
}

export interface ArkanoidEngine {
  start: () => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export function createArkanoidEngine(
  canvas: HTMLCanvasElement,
  callbacks: ArkanoidCallbacks,
): ArkanoidEngine;
```

```ts
// components/games/types.ts (diff)
export interface PlayableGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onGameOver: (finalScore: number) => void;
  onLivesChange?: (lives: number) => void;
  onLevelChange?: (level: number) => void;
  onLinesChange?: (lines: number) => void;
  onTripleShotChange?: (secondsLeft: number) => void;
  onResumeRequested?: () => void; // nuevo
}
```

Las clases/estructuras internas del motor (`Block`, `Explosion`, estado de nivel) son detalle de implementación de `engine.ts`, no se exponen fuera del módulo.

Fila de catálogo (`UPDATE`, no `INSERT`, insertada en la migración):

```sql
update games set
  id = 'arkanoid',
  title = 'ARKANOID',
  short = 'Rebota la pelota y destruye muros de bloques.',
  long = 'Controla la paleta y rebota la pelota para destruir los bloques de cada nivel. 5 niveles con patrones distintos, la pelota gana velocidad en cada uno. 3 vidas — no dejes que la pelota caiga.'
where id = 'bloque-buster';
```

## Plan de implementación

1. **Crear `components/games/arkanoid/engine.ts`** — port de `game.js` + `levels.js` a TS: constantes (paddle/pelota/bloques/velocidad), colisión AABB, explosiones, transiciones de nivel (1–5), estado `win`/`gameover`, selector de nivel en pausa vía listener de click (activo solo cuando el engine está pausado). Sonido: `cloneNode().play()` sobre 2 `<audio>` cargados desde `/sounds/`. Sprites: helpers portados de `assets/spritesheet.js` (`loadSpritesheet`/`drawSprite`/`drawFrame`) apuntando a `/sprites/spritesheet-breakout.png`. Encapsulado en `createArkanoidEngine(canvas, callbacks)`, sin globals de módulo. Verificable: compila con `tsc` sin `any`, sin efectos de import.

2. **Copiar assets** — `public/sprites/spritesheet-breakout.png`, `public/sounds/ball-bounce.mp3`, `public/sounds/break-sound.mp3`.

3. **Crear `components/games/arkanoid/arkanoid-canvas.tsx`** — client component, canvas 800×600 escalado por CSS. `useEffect` de montaje/desmontaje del engine + `useEffect` de sincronización de `paused`. Conecta `onResumeRequested` del engine a la prop homónima.

4. **Actualizar `components/games/types.ts`** — agregar `onResumeRequested?: () => void` a `PlayableGameProps`.

5. **Agregar entrada en `components/games/registry.ts`** — `arkanoid: { Canvas: dynamic(() => import("@/components/games/arkanoid/arkanoid-canvas"), { ssr: false }) }`.

6. **Integrar en `components/game-player.tsx`** — cuando el registry tiene entrada para `game.id`, conectar callbacks (`score`/`lives`/`level`) al HUD; `onResumeRequested` → `setPaused(false)`; `onGameOver` → `saveScoreAction`.

7. **Migración Supabase (`mcp__supabase__apply_migration`)** — `UPDATE` de la fila `bloque-buster` → `arkanoid` (`id`/`title`/`short`/`long`), sin tocar `cat`/`cover`/`color`/`plays`. Verificar antes de aplicar que `scores` no tenga filas con `game_id = 'bloque-buster'` (ya confirmado en 2026-08-03: 0 filas). Verificable con `select id from games`.

8. **`lib/actions/scores.ts`** — agregar `"arkanoid"` a `GAMES_WITH_REAL_SCORES`.

9. **Verificación manual en navegador** — `npm run dev`, ir a `/games/arkanoid/jugar`: paleta con flechas, bloques explotan con sonido, HUD en vivo (`score`/`lives`/`level`), "PAUSA" abre overlay con selector 1–5 (click cambia de nivel y reanuda solo), game over/win abren el modal con el score real, "GUARDAR PUNTUACIÓN" inserta en `scores` (visible en `/games/arkanoid` y `/salon` tras refrescar). Confirmar que otros juegos del catálogo no cambian de comportamiento.

10. **`npm run build`** — compila sin errores de tipos ni de lint.

## Criterios de aceptación

Base (heredados, no omitir):

- [x] `components/games/arkanoid/engine.ts` existe, exporta `createArkanoidEngine`, sin `any`, sin acceder al DOM fuera de las funciones del engine.
- [x] `components/games/arkanoid/arkanoid-canvas.tsx` existe, monta el canvas en `useEffect`, y lo destruye (cancela loop, remueve listeners de teclado/click) al desmontar.
- [x] El HUD de React refleja en vivo `score`/`lives`/`level` reales del motor.
- [x] El botón "PAUSA" congela el canvas (loop detenido) y "REANUDAR" lo continúa exactamente donde quedó.
- [x] Al perder las 3 vidas o completar el nivel 5, se abre automáticamente el modal de fin de partida con la puntuación final real, y "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` (visible en `/games/arkanoid` y `/salon` tras refrescar).
- [x] El canvas escala visualmente sin deformarse en al menos dos anchos de ventana distintos.
- [x] El juego aparece en `/games` como ARKANOID (no BLOQUE BUSTER) con datos reales de Supabase.
- [x] Ningún otro juego del catálogo cambia de comportamiento.
- [x] `npm run build` compila sin errores de tipos ni de lint.

Específicos de este juego:

- [x] La paleta se mueve con `←`/`→`, con `preventDefault`.
- [x] Al golpear un bloque se suman 10 puntos, se reproduce el sonido de rotura y se muestra la animación de explosión (4 frames).
- [x] La pelota rebota en paredes y paleta con el sonido correspondiente.
- [x] Al completar todos los bloques de un nivel (1–4) se carga el siguiente nivel automáticamente con velocidad incrementada; al completar el nivel 5 el juego pasa a estado `win`.
- [x] En pausa se muestra el overlay con selector de nivel (botones 1–5); al hacer click en uno, el motor cambia de nivel, llama `onResumeRequested`, y `GamePlayer` pone `paused=false` (el botón del HUD refleja "PAUSA" de nuevo, no queda desincronizado).
- [x] La fila `id=arkanoid` existe en `games` (`bloque-buster` ya no existe como `id`).

## Decisiones tomadas y descartadas

- **Renombrar `bloque-buster` → `arkanoid` vía `UPDATE`, no `INSERT` nuevo + `DELETE` del viejo** — se descartó crear una fila nueva porque no hay `scores` asociados a `bloque-buster` (verificado), un `UPDATE` simple evita huérfanos y mantiene un solo id histórico.
- **Se porta el selector de nivel en pausa con click de mouse** — se descartó forzarlo a teclado (1–5) porque el original ya lo resuelve así y es una interacción acotada (solo en pausa), no compite con el alcance "solo teclado para jugar".
- **Nuevo callback `onResumeRequested` en vez de que el motor se autoreanude en silencio** — se descartó dejar que `engine.resume()` interno actúe sin avisar a React porque `paused` es estado que React posee (`game-player.tsx`); sin el callback el botón PAUSA/REANUDAR quedaría desincronizado del estado real del canvas.
- **Se portan sonido y sprites (assets reales) en vez de vectores/tonos programáticos** — a diferencia de ROCAS (formas vectoriales) y Tetris, el original de Arkanoid depende visualmente del spritesheet y se pidió fidelidad completa; se acepta el costo de copiar binarios (png + 2 mp3) a `public/`.
- **Resolución 800×600, paddle 81×14** (valor real de `game.js`, no el 162×14 desactualizado del `CLAUDE.md` de la referencia) — se prioriza el código fuente sobre la documentación cuando difieren.
- **No se toca `cover-bricks` en `globals.css`** — se descartó renombrar la clase porque el estilo visual ya está diseñado y el campo `cover` no depende del `id`.
- **Ambigüedad resuelta durante la implementación: overlay genérico "EN PAUSA" de `GamePlayer` vs. overlay de selector de nivel dibujado en el canvas** — el `div.crt-content` genérico (preexistente, usado por todos los juegos al pausar) no tenía `pointer-events: none` y bloqueaba los clicks a los botones 1–5 dibujados en el canvas. Se decidió (con el usuario) mantener ambos overlays visibles a la vez pero aplicar `pointer-events: "none"` a ese `div` solo cuando `game.id === "arkanoid"`, dejando pasar el click al canvas. Se descartó ocultar el overlay genérico por completo para arkanoid porque el usuario prefirió conservar el texto "EN PAUSA" visible por consistencia con el resto del catálogo.

## Riesgos identificados

Reutilizados de spec 05:

- **Scroll de página por teclas capturadas** — mitigación: `preventDefault()` en `←`/`→` mientras el canvas está montado.
- **Doble montaje en desarrollo (`StrictMode`)** — mitigación: `destroy()` idempotente, verificado en dev.
- **Listeners de teclado/click globales entre navegaciones** — mitigación: `destroy()` remueve `keydown`/`keyup` y el listener de click del canvas al salir.
- **Callbacks disparando renders excesivos** — mitigación: comparar contra el valor previo antes de invocar el callback.

Propios de este juego:

- **Autoplay de audio bloqueado por el navegador** — los `<audio>` creados vía `cloneNode().play()` pueden fallar silenciosamente si el usuario no interactuó aún con la página (política de autoplay). Mitigación: ninguna especial en este spec, igual que el original; se ignora el error de la promesa de `play()` para no romper el loop.
- **Migración `UPDATE` del `id` en `games`** — a diferencia de un `INSERT`, cambia una PK ya referenciada por la FK de `scores.game_id`; se verificó que no hay filas de `scores` para `bloque-buster` antes de aprobar este spec, pero si alguien inserta una entre la aprobación y la ejecución de `/spec-impl`, la migración fallaría por integridad referencial (se resolvería re-verificando antes de aplicar).
- **Peso de assets binarios (spritesheet PNG + 2 mp3) en el repo** — mitigación: ninguna, se acepta como en el proyecto original.
