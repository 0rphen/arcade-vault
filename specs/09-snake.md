# SPEC 09 — Snake jugable + leaderboard

> **Estado:** Implementado
> **Depende de:** 06-leaderboard-catalogo-supabase
> **Fecha:** 2026-08-04
> **Objetivo:** Crear el motor de Snake en `components/games/snake/`, integrarlo en `GamePlayer` vía el registry de juegos jugables, renombrar la fila de catálogo `serpentina` → `snake` en Supabase, y dar de alta su leaderboard real.

## Alcance

**Dentro del alcance:**

- **Motor del juego** (`components/games/snake/engine.ts`) — grilla lógica de 30×20 celdas de 20px (canvas 600×400). Serpiente como array de segmentos, arranca con 3 segmentos en el centro de la grilla mirando a la derecha. Movimiento por intervalo (no por frame): 150ms inicial, -10ms cada 4 frutas comidas, piso en 70ms. Fruta se posiciona en celda libre al azar, tomada al azar del set de sprites del atlas (variedad visual, mismo puntaje cada una). Condición de derrota: choca contra el borde del canvas **o** contra su propio cuerpo. Encapsulado en `createSnakeEngine(canvas, callbacks)`, sin globals de módulo.
- **Sprites de fruta** — se portan `references/source_assets/snake-assets/sprites.js` (atlas de coordenadas) y `fruits.png` a `public/games/snake/fruits.png`, cargados por el motor vía `Image()`/`drawImage` con los recortes definidos en el atlas (se convierte `sprites.js` a un objeto TS tipado en `components/games/snake/sprites.ts`).
- **Wrapper de React** (`components/games/snake/snake-canvas.tsx`) — client component que monta el motor en un `<canvas>` vía `useEffect`/`ref`, escala por CSS dentro de `.crt-screen`, expone `onScoreChange`, `onGameOver`, prop `paused`. Sin callbacks de vidas/nivel — Snake no los usa.
- **Controles** — solo flechas (`↑` `↓` `←` `→`), con `preventDefault`. No se permite invertir la dirección 180° en un mismo frame (ej. si va a la derecha, `←` se ignora hasta el siguiente tick de movimiento).
- **Registro en `components/games/registry.ts`** — entrada `snake` → `dynamic(() => import(".../snake-canvas"), { ssr: false })`.
- **Integración en `GamePlayer`** — vía el registry existente (ya soporta múltiples juegos); HUD muestra solo `score` (sin casillas de vidas/nivel) en la posición superior derecha ya usada por el HUD actual; dispara `saveScoreAction` en `onGameOver`.
- **Renombre en catálogo (`games`)** — migración `update games set id = 'snake', title = 'SNAKE', cover = 'cover-snake', short = '...', long = '...' where id = 'serpentina'`; se conserva `cat`, `color`, `plays` de la fila actual, y se reescriben `short`/`long` para mencionar "Snake" en vez del texto genérico de "Serpentina".
- **Leaderboard real** — agregar `"snake"` a `GAMES_WITH_REAL_SCORES` en `lib/actions/scores.ts`.
- **Portada** — reutiliza `.cover-snake`, ya existe en `app/globals.css`. No se diseña portada nueva.

**Fuera de alcance (diferido):**

- **Controles táctiles/mobile** — diferido.
- **Sonido** — diferido.
- **Frutas con puntajes distintos entre sí / power-ups** — todas las frutas dan el mismo puntaje en este spec; variedad de puntaje queda para una feature futura.
- **Ajustes de balance adicionales** — el ramp de velocidad (150ms → 70ms, -10ms cada 4 frutas) es el definitivo de este spec, no un placeholder a retocar.

## Modelo de datos

Interfaces TypeScript de la API entre el motor y React:

```ts
// components/games/snake/engine.ts
export interface SnakeCallbacks {
  onScoreChange: (score: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface SnakeEngine {
  start: () => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export function createSnakeEngine(
  canvas: HTMLCanvasElement,
  callbacks: SnakeCallbacks,
): SnakeEngine;
```

```tsx
// components/games/snake/snake-canvas.tsx
export interface SnakeCanvasProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

Constantes de balance del motor (`engine.ts`):

```ts
const CELL = 20; // px
const COLS = 30; // 600 / 20
const ROWS = 20; // 400 / 20
const START_LENGTH = 3;
const START_INTERVAL_MS = 150;
const MIN_INTERVAL_MS = 70;
const SPEEDUP_EVERY_FOOD = 4;
const SPEEDUP_STEP_MS = 10;
const POINTS_PER_FRUIT = 10;
```

Atlas de sprites (`components/games/snake/sprites.ts`, portado de `sprites.js`):

```ts
export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FRUIT_SPRITES: Record<string, SpriteRect> = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  // ...resto de las 21 frutas, igual a sprites.js
};
```

Cambio en catálogo (`games`, vía migración):

```sql
update games
set id = 'snake',
    title = 'SNAKE',
    cover = 'cover-snake',
    short = 'Snake clásico: crece sin morder tu propia cola.',
    long = 'Snake, el clásico: una serpiente de luz recorre la grilla comiendo frutas. Cada fruta la alarga y acelera el ritmo. Un giro en falso contra el borde o contra tu propia cola termina la partida.'
where id = 'serpentina';
```

## Plan de implementación

1. **Crear `components/games/snake/sprites.ts`** — portar el atlas de `references/source_assets/snake-assets/sprites.js` a TypeScript tipado (`FRUIT_SPRITES: Record<string, SpriteRect>`). Copiar `fruits.png` a `public/games/snake/fruits.png`. Verificable: el archivo compila con `tsc`, no accede al DOM.

2. **Crear `components/games/snake/engine.ts`** — grilla 30×20 celdas de 20px, canvas 600×400. Estado encapsulado en `createSnakeEngine(canvas, callbacks)`: serpiente (array de segmentos, arranca en 3 celdas centradas mirando a la derecha), dirección con buffer de un solo giro por tick (evita invertir 180° en el mismo frame), fruta en celda libre aleatoria con sprite aleatorio de `FRUIT_SPRITES`, loop por intervalo (`setTimeout`/`requestAnimationFrame` con acumulador, no directamente ligado a 60fps), velocidad 150ms→70ms (-10ms cada 4 frutas), +10 puntos por fruta, derrota al chocar con el borde o con su propio cuerpo. Callbacks `onScoreChange`/`onGameOver` solo al cambiar el valor. `destroy()` idempotente (cancela loop, remueve `keydown`). Verificable de forma aislada: compila con `tsc` sin `any`, sin efectos de import.

3. **Crear `components/games/snake/snake-canvas.tsx`** — client component con `<canvas width={600} height={400}>` escalado por CSS. `useEffect` de montaje/desmontaje del engine + `useEffect` de sincronización de `paused`.

4. **Agregar entrada en `components/games/registry.ts`** — `snake: { Canvas: dynamic(() => import("@/components/games/snake/snake-canvas"), { ssr: false }) }`.

5. **Ajustar HUD en `components/game-player.tsx`** — las casillas `hud-stat lives` y `hud-stat level` (hoy siempre visibles) se ocultan cuando `game.id === "snake"`, mismo patrón condicional que ya usa la casilla "Líneas" para `caida`. Snake solo muestra "Puntuación".

6. **Migración Supabase (`mcp__supabase__apply_migration`)** — verificar antes `select count(*) from scores where game_id = 'serpentina'` (debería ser 0); luego `update games set id='snake', title='SNAKE', cover='cover-snake', short='...', long='...' where id='serpentina'`. Verificable con `mcp__supabase__execute_sql` (`select * from games where id='snake'`).

7. **`lib/actions/scores.ts`** — reemplazar `"rocas", "caida", "arkanoid"` por `"rocas", "caida", "arkanoid", "snake"` en `GAMES_WITH_REAL_SCORES`.

8. **Verificación manual en navegador** — `npm run dev`, ir a `/games/snake/jugar`: flechas mueven la serpiente sin invertir 180° en un tick, comer fruta suma 10 puntos y la alarga, cada 4 frutas la velocidad sube (intervalo -10ms, piso 70ms), chocar con borde o con el propio cuerpo termina la partida y abre el modal con el score real, "GUARDAR PUNTUACIÓN" inserta en `scores` (visible en `/games/snake` y `/salon`). Confirmar que otros juegos no cambian de comportamiento.

9. **`npm run build`** — compila sin errores de tipos ni de lint.

## Criterios de aceptación

Base (heredados):

- [x] `components/games/snake/engine.ts` existe, exporta `createSnakeEngine`, sin `any`, sin acceder al DOM fuera de las funciones del engine.
- [x] `components/games/snake/snake-canvas.tsx` existe, monta el canvas en `useEffect`, y lo destruye (cancela loop, remueve listeners de teclado) al desmontar.
- [x] El HUD de React refleja en vivo el puntaje real del motor; las casillas "Vidas" y "Nivel" no se muestran para Snake.
- [x] El botón "PAUSA" congela el canvas (loop detenido) y "REANUDAR" lo continúa exactamente donde quedó.
- [x] Al chocar con el borde o con su propio cuerpo, se abre automáticamente el modal de fin de partida con la puntuación final real, y "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` (visible en `/games/snake` y `/salon` tras refrescar).
- [x] El canvas escala visualmente al tamaño de `.crt-screen` sin deformarse en al menos dos anchos de ventana distintos.
- [x] El juego aparece en `/games` como "SNAKE" (ya no "SERPENTINA"), con `id` `snake`.
- [x] Ningún otro juego del catálogo cambia de comportamiento.
- [x] `npm run build` compila sin errores de tipos ni de lint.

Específicos de Snake:

- [x] Comer una fruta suma exactamente 10 puntos y agrega un segmento a la serpiente.
- [x] No se puede invertir la dirección 180° en un mismo tick de movimiento (ej. yendo a la derecha, presionar `←` no causa colisión inmediata contra el propio cuello).
- [x] La velocidad del intervalo de movimiento baja 10ms cada 4 frutas comidas, con piso en 70ms (arranca en 150ms).
- [x] Las frutas se dibujan usando los sprites del atlas (`fruits.png`), con variedad visual entre apariciones.
- [x] Chocar contra cualquier borde del canvas (600×400) termina la partida.

## Decisiones tomadas y descartadas

- **`UPDATE` de la fila `serpentina` → `snake` en vez de `INSERT` nuevo + `DELETE`** — se descartó insertar una fila nueva porque no hay `scores` reales asociados a `serpentina` todavía (nunca tuvo motor real); actualizar in-place es más simple y no duplica el juego en el catálogo.
- **`short`/`long` reescritos mencionando "Snake"** — se descartó dejar el texto en español genérico ("una serpiente...") porque el usuario pidió explícitamente que el copy nombre "Snake" para consistencia con el nuevo título.
- **Sin bordes envolventes (wrap-around)** — se descartó el comportamiento toroidal (como Rocas) porque el usuario confirmó que chocar contra el borde también termina la partida; es el Snake clásico, no una variante.
- **Todas las frutas dan el mismo puntaje (10 pts)** — se descartó variar puntaje por fruta en este spec; la variedad del atlas es solo visual. Puntajes diferenciados por fruta queda como feature futura explícita.
- **HUD solo con `score`, sin vidas ni nivel** — se descartó reutilizar las casillas "Vidas"/"Nivel" del HUD compartido (como hacen Rocas/Caída/Arkanoid) porque Snake no tiene esos conceptos; se ocultan condicionalmente en `game-player.tsx`, mismo patrón que ya usa "Líneas" para Caída.
- **Loop por intervalo variable, no ligado directo a 60fps** — se descartó mover la serpiente cada frame de `requestAnimationFrame` porque el ramp de velocidad (150ms→70ms) necesita un timing independiente del refresco de pantalla; se implementa con acumulador de tiempo dentro del loop.
- **Sprites porteados a `public/games/snake/fruits.png` + `sprites.ts` tipado** — se descartó dejar `fruits.png` en `references/` y cargarlo desde ahí porque esa carpeta no se sirve en producción; los assets del juego deben vivir en `public/`.
- **Sin power-ups ni sonido** — se descartó agregarlos porque no estaban en el pedido original y el patrón del proyecto (Rocas, Caída, Arkanoid) los deja fuera del primer spec de cada juego salvo que estén en una referencia existente.

## Riesgos identificados

- **Scroll de página por teclas capturadas** — mitigación: `preventDefault()` en `↑` `↓` `←` `→` mientras el canvas está montado.
- **Doble montaje en desarrollo (`StrictMode`)** — mitigación: `destroy()` idempotente, verificado explícitamente en dev (dos loops de intervalo corriendo en paralelo duplicarían la velocidad percibida).
- **Listeners de teclado globales entre navegaciones** — mitigación: `destroy()` remueve `keydown` al salir.
- **Callbacks disparando renders excesivos** — mitigación: comparar contra el valor previo antes de invocar `onScoreChange`.
- **`UPDATE` de `id` en `games` con FK desde `scores.game_id`** — si llegara a existir alguna fila en `scores` con `game_id = 'serpentina'` (no debería, pero no está verificado con un `SELECT` explícito antes de migrar), el `UPDATE` fallaría o dejaría huérfanas esas filas. Mitigación: `/spec-impl` verifica `select count(*) from scores where game_id = 'serpentina'` antes de aplicar la migración.
- **Buffer de dirección mal implementado** — si el giro se aplica inmediatamente en vez de en el siguiente tick de movimiento, un jugador podría presionar dos flechas opuestas muy rápido y provocar una colisión inválida contra su propio cuello. Mitigación: la dirección solicitada se guarda y se aplica una sola vez por tick del loop, no por evento de teclado.
