# SPEC 07 — Tetris jugable + leaderboard (caida)

> **Estado:** Implemented
> **Depende de:** 06-leaderboard-catalogo-supabase
> **Fecha:** 2026-08-03
> **Objetivo:** Portar el motor de canvas de `references/started-games/03-tetris/game.js` a `components/games/caida/`, integrarlo en `GamePlayer` (vía un nuevo registry de juegos jugables) y actualizar la fila `caida` del catálogo para que muestre "TETRIS" con guardado de puntaje real en Supabase.

## Alcance

**Dentro del alcance:**

- **Paso 0 — Crear `components/games/registry.ts` y migrar `rocas`** — el registry todavía no existe (`ls components/games/` solo muestra `asteroids/`). Se extrae el mapeo `id → Canvas` que hoy vive cableado en `game-player.tsx` (`isAsteroids = game.id === 'rocas'`) a un registro genérico con `next/dynamic`, sin cambiar comportamiento observable de ROCAS.
- **Motor del juego** (`components/games/caida/engine.ts`) — port a TypeScript de `game.js`: constantes (`COLS`, `ROWS`, `BLOCK`, `COLORS`, `PIECES` — incluida la pieza N/tuerca de 8 piezas —, `LINE_SCORES`), utilidades (`collide`, `rotateCW`, `ghostY`), funciones de estado (`createBoard`, `randomPiece`, `tryRotate`, `merge`, `clearLines`, `hardDrop`, `softDrop`, `lockPiece`, `spawn`, `draw`, `drawNext`, `loop`). Resolución lógica fija del tablero 300×600 (`COLS×BLOCK` × `ROWS×BLOCK`), preview 120×120.
- **Wrapper de React** (`components/games/caida/caida-canvas.tsx`) — client component con **dos** `<canvas>` (tablero 300×600 + preview 120×120), monta el motor vía `createTetrisEngine(boardCanvasRef, nextCanvasRef, callbacks)` en `useEffect`, escala el tablero por CSS dentro de `.crt-screen`, expone:
  - Callbacks `onScoreChange`, `onLinesChange`, `onLevelChange` (solo al cambiar el valor, no cada frame).
  - Callback `onGameOver(finalScore)` cuando `spawn()` colisiona inmediatamente.
  - Prop `paused: boolean` — el wrapper llama `engine.pause()`/`engine.resume()`; el motor **no** escucha la tecla `P` (se descarta respecto al original — la pausa la controla el contenedor React, igual que ROCAS).
  - Cleanup en desmontaje: cancela `requestAnimationFrame` y remueve listeners de teclado.
- **Registro en `components/games/registry.ts`** — entrada `caida` → `dynamic(() => import(".../caida-canvas"), { ssr: false })`.
- **Integración en `GamePlayer`** (`components/game-player.tsx`) — consulta el registry por `game.id`; conecta los callbacks al estado existente (`score`, HUD con líneas/nivel, `paused`, `over`) y dispara `saveScoreAction` cuando llega `onGameOver`.
- **Controles** — `←`/`→` mover, `↑` o `X` rotar (con wall kicks `[0,-1,1,-2,2]`), `↓` soft drop (+1 punto/fila), `Espacio` hard drop (+2 puntos/celda), todos con `preventDefault` mientras el canvas está montado. Sin tecla `P`.
- **Pieza N (tuerca)** — se porta igual que en `game.js`, las 8 piezas (7 estándar + N), fiel al balance real del original.
- **Catálogo (`games`)** — `UPDATE` (no `INSERT`, la fila `caida` ya existe) vía `mcp__supabase__apply_migration`: `title` → `'TETRIS'`, `short` → `'Encaja las piezas de Tetris antes de que el techo te aplaste.'`, `long` → `'Piezas de Tetris descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.'`. `cat` (`PUZZLE`), `color` (`magenta`), `cover` (`cover-tetro`), `plays` (`'31.8K'`) no cambian.
- **Leaderboard real** — agregar `caida` a `GAMES_WITH_REAL_SCORES` en `lib/actions/scores.ts`.
- **Portada** — se reutiliza `.cover-tetro`, ya existente en `app/globals.css`. No se diseña portada nueva.

**Fuera de alcance (diferido):**

- **Controles táctiles/mobile** — diferido, igual que ROCAS.
- **Sonido** — el original no tiene audio; este spec tampoco lo agrega.
- **Ajustes de dificultad/balance** — se porta el balance tal cual (`COLS=10`, `ROWS=20`, `BLOCK=30`, `dropInterval = max(100, 1000-(level-1)*90)`, `LINE_SCORES=[0,100,300,500,800]`), sin retocar constantes.
- **Toggle de tema claro/oscuro propio del original** — Arcade Vault ya tiene su propio tema/CRT; no se porta el `localStorage` de tema de `game.js`.
- **Tecla `P` de pausa dentro del motor** — se descarta; la pausa es responsabilidad exclusiva del contenedor React (prop `paused`).
- **Renombrar el `id` del juego a `tetris`** — se descartó explícitamente; se reutiliza `id='caida'` ya existente en el catálogo, solo cambia el copy visible (`title`/`short`/`long`).

## Modelo de datos

Interfaces TypeScript de la API entre el motor y React (mismo formato que spec 05):

```ts
// components/games/caida/engine.ts
export interface TetrisCallbacks {
  onScoreChange: (score: number) => void;
  onLinesChange: (lines: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface TetrisEngine {
  start: () => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export function createTetrisEngine(
  boardCanvas: HTMLCanvasElement,
  nextCanvas: HTMLCanvasElement,
  callbacks: TetrisCallbacks,
): TetrisEngine;
```

```tsx
// components/games/caida/caida-canvas.tsx
export interface CaidaCanvasProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLinesChange: (lines: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

Las estructuras internas del motor (`board: number[][]`, piezas `{ type, shape, x, y }`, `COLORS`, `PIECES`) son detalle de implementación de `engine.ts`, no se exponen fuera del módulo.

Fila de catálogo (`games`, actualizada en la migración — `UPDATE`, no `INSERT`, la fila ya existe):

```sql
update games
set title = 'TETRIS',
    short = 'Encaja las piezas de Tetris antes de que el techo te aplaste.',
    long = 'Piezas de Tetris descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.'
where id = 'caida';
```

## Plan de implementación

0. **Crear `components/games/registry.ts` y migrar `rocas`** — extraer el mapeo `id → Canvas` que hoy vive cableado en `game-player.tsx` (`isAsteroids = game.id === 'rocas'`) a un registro genérico con `next/dynamic`. `GamePlayer` pasa a consultar el registry. Verificable: `/games/rocas/jugar` se comporta exactamente igual que antes.

1. **Crear `components/games/caida/engine.ts`** — Portar `game.js` a TypeScript: constantes (`COLS`, `ROWS`, `BLOCK`, `COLORS`, `PIECES` con las 8 piezas, `LINE_SCORES`), utilidades (`collide`, `rotateCW`, `ghostY`), funciones de estado (`createBoard`, `randomPiece`, `tryRotate`, `merge`, `clearLines`, `hardDrop`, `softDrop`, `lockPiece`, `spawn`, `draw`, `drawNext`, `loop`). Encapsulado en `createTetrisEngine(boardCanvas, nextCanvas, callbacks)`, sin globals de módulo. Sin escucha de tecla `P`. Verificable de forma aislada: compila con `tsc` sin `any`, sin efectos de import.

2. **Crear `components/games/caida/caida-canvas.tsx`** — client component con `<canvas width={300} height={600}>` (tablero) y `<canvas width={120} height={120}>` (preview), tablero escalado por CSS (`width: 100%; height: 100%; display: block`) dentro de `.crt-screen`. `useEffect` de montaje/desmontaje del engine + `useEffect` de sincronización de `paused`.

3. **Agregar entrada en `components/games/registry.ts`** — `caida: { Canvas: dynamic(() => import("@/components/games/caida/caida-canvas"), { ssr: false }) }`.

4. **Integrar en `components/game-player.tsx`** — cuando el registry tiene una entrada para `game.id`, renderizar su `Canvas` en vez del `.game-arena` falso; conectar callbacks al HUD (`score`, `lines`, `level`); en `onGameOver`, llamar `saveScoreAction({ gameId: game.id, name, score })`.

5. **Migración Supabase (`mcp__supabase__apply_migration`)** — `update games set title/short/long ... where id = 'caida'`. Verificable con `mcp__supabase__execute_sql` (`select title, short, long from games where id = 'caida'`).

6. **`lib/actions/scores.ts`** — agregar `caida` a `GAMES_WITH_REAL_SCORES`.

7. **Verificación manual en navegador** — `npm run dev`, ir a `/games/caida/jugar`: piezas caen y se controlan con `←`/`→`/`↑`ó`X`/`↓`/`Espacio`, preview de la siguiente pieza visible, HUD en vivo (`score`/`lines`/`level`), "PAUSA" congela el canvas, al colisionar el spawn se abre el modal de fin de partida con el score real, "GUARDAR PUNTUACIÓN" inserta en `scores` (visible en `/games/caida` con título "TETRIS" y en `/salon` tras refrescar). Confirmar que otros juegos del catálogo no cambian de comportamiento.

8. **`npm run build`** — compila sin errores de tipos ni de lint.

## Criterios de aceptación

Base (heredados, no omitir):

- [x] `components/games/registry.ts` existe y `ROCAS` sigue funcionando igual que antes tras la migración del paso 0.
- [x] `components/games/caida/engine.ts` existe, exporta `createTetrisEngine`, sin `any`, sin acceder al DOM fuera de las funciones del engine.
- [x] `components/games/caida/caida-canvas.tsx` existe, monta ambos canvas en `useEffect`, y los destruye (cancela loop, remueve listeners de teclado) al desmontar.
- [x] El HUD de React refleja en vivo `score`, `lines` y `level` reales del motor.
- [x] El botón "PAUSA" congela el canvas (loop detenido) y "REANUDAR" lo continúa exactamente donde quedó.
- [x] Al cumplirse la condición de game over (spawn colisiona), se abre automáticamente el modal de fin de partida con la puntuación final real, y "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` (visible en `/games/caida` y `/salon` tras refrescar).
- [x] El canvas del tablero escala visualmente al tamaño de `.crt-screen` sin deformarse en al menos dos anchos de ventana distintos.
- [x] `/games/caida` muestra `title = 'TETRIS'` con el copy actualizado, `cover-tetro` sin cambios.
- [x] Ningún otro juego del catálogo cambia de comportamiento.
- [x] `npm run build` compila sin errores de tipos ni de lint.

Específicos de este juego:

- [x] `←`/`→` mueven la pieza, `↑` u `X` la rotan con wall kicks, `↓` hace soft drop (+1 punto/fila), `Espacio` hace hard drop (+2 puntos/celda).
- [x] Las 8 piezas (7 estándar + N/tuerca) aparecen con sus colores correspondientes.
- [x] La pieza fantasma (ghost piece) se dibuja en la posición de aterrizaje con opacidad reducida.
- [x] La preview de la siguiente pieza (segundo canvas) se actualiza cada vez que se genera una nueva pieza.
- [x] Al completar una o más líneas, se eliminan, el puntaje suma según `LINE_SCORES[cleared] * level`, y el nivel sube cada 10 líneas acumuladas (con el consecuente aumento de velocidad de caída).
- [x] La tecla `P` no tiene efecto dentro del canvas; la pausa solo responde al botón "PAUSA" del HUD.

## Decisiones tomadas y descartadas

- **Reutilizar `id='caida'` en vez de crear `id='tetris'`** — se descartó insertar una fila nueva porque `caida` ya existía en el catálogo con `cover-tetro`, `cat=PUZZLE` y descripciones que ya encajaban con Tetris; era el placeholder reservado para este juego desde spec 06.
- **`UPDATE` de `title`/`short`/`long`, no `INSERT`** — consecuencia directa de la decisión anterior: la fila ya existe, solo se actualiza el copy visible para que diga "TETRIS" en vez de "CAÍDA". `cat`, `color`, `cover` y `plays` no cambian porque ya eran correctos.
- **Se porta la pieza N/tuerca (8 piezas)** — se descartó recortarla a las 7 piezas estándar del README porque está en `game.js` real y es parte del balance jugado, mismo criterio que el power-up de disparo triple en spec 05 (se porta lo que está en el código, no solo lo documentado).
- **Se descarta el toggle de tema del original** — Arcade Vault ya tiene su propio sistema de tema/CRT consistente en todo el sitio; el `localStorage` de tema de `game.js` es una feature de la página standalone, no del juego en sí.
- **Se descarta la tecla `P` de pausa dentro del motor** — se sigue el patrón de ROCAS (spec 05): la pausa es responsabilidad exclusiva del contenedor React vía prop `paused`; el motor solo obedece, no decide. Mantener `P` además del botón hubiera requerido sincronizar dos fuentes de verdad para el mismo estado.
- **Motor recibe dos `<canvas>` (`boardCanvas`, `nextCanvas`) en vez de uno solo** — se descartó forzar el patrón de un único canvas de `reference.md` (dibujando la preview como overlay) porque el original ya separa tablero y preview limpiamente en dos elementos; replicarlo tal cual es más simple que inventar un overlay nuevo, y establece el patrón para futuros juegos que necesiten más de un canvas.
- **Motor encapsulado en `createTetrisEngine()` sin globals de módulo** — mismo criterio que spec 05: evita estado cruzado entre montajes/desmontajes de React (`StrictMode`, navegación client-side).
- **No se toca `app/globals.css`** — se descartó crear una clase de portada nueva porque `.cover-tetro` ya existe y ya está pensada para este juego (nombre literal "tetro").

## Riesgos identificados

Reutilizados de spec 05 (aplican igual aquí):

- **Scroll de página por teclas capturadas** — `←`/`→`/`↑`/`↓`/`Espacio` pueden scrollear la página alrededor del `.crt`. Mitigación: `preventDefault()` en los códigos usados por el juego mientras el canvas está montado.
- **Doble montaje en desarrollo (`StrictMode`)** — puede duplicar loops (`requestAnimationFrame`) o listeners si `destroy()` no es idempotente. Mitigación: `destroy()` cancela el loop y remueve listeners de forma segura ante llamadas repetidas.
- **Listeners de teclado globales entre navegaciones** — si `destroy()` falla al salir del juego, quedan listeners huérfanos acumulándose entre partidas. Mitigación: cleanup verificado explícitamente en dev antes de cerrar el spec.
- **Callbacks disparando renders excesivos** — mitigación: comparar contra el valor previo antes de invocar `onScoreChange`/`onLinesChange`/`onLevelChange`.

Propios de este juego:

- **Dos canvas por motor rompe el contrato de un solo canvas de `reference.md`** — el registry y `PlayableGameEntry` asumían implícitamente un canvas por juego; si algún consumidor futuro (HUD genérico, tipos compartidos) asume un solo canvas, puede requerir ajuste al integrar `caida`. Mitigación: `caida-canvas.tsx` encapsula ambos canvas internamente, el registry solo ve un componente `Canvas` estándar (mismo contrato externo que `PlayableGameProps`).
- **`UPDATE` sobre una fila existente en vez de `INSERT`** — si la migración se aplica dos veces o con una condición `where` incorrecta, podría afectar otra fila o no aplicar el cambio. Mitigación: revisar el `WHERE id = 'caida'` con el usuario antes de aplicar, verificar con `execute_sql` después.
- **Wall kicks del original (`[0,-1,1,-2,2]`) son básicos**, no el sistema SRS completo — piezas pegadas a paredes/otras piezas pueden fallar rotaciones que un jugador de Tetris "moderno" esperaría. Mitigación: ninguna en este spec, se porta el original tal cual (documentado como diferido en ajustes de balance).
