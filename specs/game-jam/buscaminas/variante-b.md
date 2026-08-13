# SPEC — BUSCAMINAS jugable + leaderboard (variante B — teclado, rondas infinitas con 3 vidas)

> **Estado:** Candidata (game jam)
> **Depende de:** 06-leaderboard-catalogo-supabase
> **Fecha:** 2026-08-11
> **Objetivo:** Crear el motor de Buscaminas en `components/games/buscaminas/`, controlado íntegramente por teclado (cursor con flechas), con rondas infinitas de dificultad creciente y 3 vidas en vez de muerte instantánea, integrarlo en `GamePlayer` vía el registry y dar de alta su fila de catálogo y su leaderboard real en Supabase.

## Alcance

**Dentro del alcance:**

- **Motor del juego** (`components/games/buscaminas/engine.ts`) — Buscaminas con reglas clásicas de deducción (minas ocultas, números de adyacencia 0–8, cascada de ceros, banderas) sobre un tablero de tamaño **constante** 16×16, jugado en **rondas infinitas**: cada ronda reparte más minas que la anterior. Resolución lógica fija 640×640, celda de 40px, sin cambios de geometría entre rondas (solo cambia la densidad de minas).
  - **Progresión de rondas** — ronda 1: 30 minas; +6 minas por ronda; tope en 90 minas (a partir de ahí la dificultad no crece más, la ronda solo suma multiplicador de score).
  - **Vidas en vez de muerte instantánea** — revelar una celda con mina **no** termina la partida: cuesta 1 vida de 3, la mina queda marcada como detonada (visible, ya no puede volver a pisarse) y el juego continúa. Los números adyacentes ya reveladas siguen contando esa mina, así que la información del tablero sigue siendo consistente.
  - **Fin de ronda** — todas las celdas sin mina reveladas. Se suma el bonus de ronda y se genera un tablero nuevo (misma geometría, más minas), sin pausa ni pantalla intermedia más allá de un flash de 500ms.
  - **Game over** — al perder la tercera vida. Dispara `onGameOver` con el score acumulado de todas las rondas.
- **Wrapper de React** (`components/games/buscaminas/buscaminas-canvas.tsx`) — client component que monta el motor en un `<canvas width={640} height={640}>` vía `useEffect`/`ref`, escala por CSS dentro de `.crt-screen`, expone:
  - Callbacks `onScoreChange`, `onLivesChange`, `onLevelChange` (la "ronda" se mapea a la casilla "Nivel" del HUD), `onGameOver` — todos solo al cambiar el valor.
  - Prop `paused: boolean`.
  - Cleanup en desmontaje: cancela `requestAnimationFrame` y remueve los listeners de `keydown`/`keyup`.
- **Registro en `components/games/registry.ts`** — entrada `buscaminas` → `dynamic(() => import(".../buscaminas-canvas"), { ssr: false })`. El registry ya existe (spec 07), no hace falta paso 0.
- **Integración en `GamePlayer`** — conecta `score`, `lives` y `level` al HUD compartido (las tres casillas ya existen y se usan tal cual, sin condicionales nuevas); en `onGameOver` dispara `saveScoreAction`.
- **Controles — solo teclado**, con `preventDefault` mientras el canvas está montado:
  - `←` `→` `↑` `↓` mueven el cursor de celda (con repetición por auto-repeat del navegador, sin wrap en los bordes).
  - `Espacio` revela la celda bajo el cursor.
  - `F` alterna bandera.
  - `Shift` + flecha salta 5 celdas (movimiento rápido, evita que cruzar un tablero de 16 columnas sea tedioso).
  - No se usa el mouse en absoluto.
- **Catálogo (`games`)** — fila **nueva** vía `mcp__supabase__apply_migration` (`insert`, el id `buscaminas` no existe hoy): `cat = 'PUZZLE'`, `color = 'cyan'`, `cover = 'cover-buscaminas'`, `plays = '0'`.
- **Leaderboard real** — agregar `"buscaminas"` a `GAMES_WITH_REAL_SCORES` en `lib/actions/scores.ts`.
- **Portada** — clase nueva `.cover-buscaminas` en `app/globals.css` (grilla de celdas con el cursor resaltado en cian), diseñada con `/frontend-design` durante `/spec-impl`.

**Fuera de alcance (diferido):**

- **Mouse** — deliberadamente excluido; es el eje de diseño que separa esta variante de la A.
- **Controles táctiles/mobile** — diferido.
- **Sonido** — diferido.
- **Tableros de otros tamaños / selector de dificultad** — la geometría es siempre 16×16; la dificultad la da la densidad de minas por ronda.
- **Chord (revelado acorde sobre número satisfecho)** — diferido.

## Modelo de datos

```ts
// components/games/buscaminas/engine.ts
export interface BuscaminasCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (round: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface BuscaminasEngine {
  start: () => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export function createBuscaminasEngine(
  canvas: HTMLCanvasElement,
  callbacks: BuscaminasCallbacks,
): BuscaminasEngine;
```

```tsx
// components/games/buscaminas/buscaminas-canvas.tsx
export interface BuscaminasCanvasProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (round: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

Estructuras internas (detalle de implementación, no exportadas):

```ts
interface Cell {
  mine: boolean;
  adjacent: number; // 0..8
  revealed: boolean;
  flagged: boolean;
  detonated: boolean; // mina ya pisada: visible, inofensiva
}

interface Cursor {
  col: number;
  row: number;
}
```

Constantes de balance (`engine.ts`):

```ts
const CANVAS_W = 640;
const CANVAS_H = 640;
const COLS = 16;
const ROWS = 16;
const CELL = 40; // 16 * 40 = 640

const START_LIVES = 3;
const START_MINES = 30;
const MINES_PER_ROUND = 6;
const MAX_MINES = 90;

const POINTS_PER_REVEALED_CELL = 5; // por celda destapada (incluye cascada)
const POINTS_PER_CORRECT_FLAG = 25; // se cobra al cerrar la ronda, solo banderas sobre minas reales
const ROUND_CLEAR_BONUS = 300; // × número de ronda
const CURSOR_JUMP = 5; // celdas por Shift+flecha
const ROUND_FLASH_MS = 500;
```

Fila de catálogo (`games`, `insert` — el id es nuevo, no hay fila previa que renombrar):

```sql
insert into games (id, title, short, long, cat, cover, color, plays)
values (
  'buscaminas',
  'BUSCAMINAS',
  'Despeja campos minados ronda tras ronda, con tres vidas.',
  'Campo minado 16x16 y un cursor de neon que mueves con las flechas. Los numeros dicen cuantas minas te rodean. Aqui pisar una no te mata: te cuesta una de tus tres vidas. Cada ronda despejada trae mas minas y mas puntos, hasta que la tercera explosion apaga la pantalla.',
  'PUZZLE',
  'cover-buscaminas',
  'cyan',
  '0'
);
```

## Plan de implementación

1. **Crear `components/games/buscaminas/engine.ts`** — estado encapsulado en `createBuscaminasEngine(canvas, callbacks)`, sin globals de módulo:
   - `board: Cell[][]` de 16×16; `startRound(n)` reparte `min(START_MINES + (n-1) * MINES_PER_ROUND, MAX_MINES)` minas al azar y calcula la adyacencia. El **primer `Espacio` de cada ronda** relanza el reparto si cayó una mina bajo el cursor o en sus 8 vecinas (garantía de apertura segura, igual que el primer click del clásico).
   - `moveCursor(dx, dy, jump)` — clamp a los bordes, sin wrap.
   - `reveal()` — sobre la celda del cursor: si tiene bandera, se ignora; si tiene mina no detonada → `detonate()` (marca `detonated`, `lives--`, `onLivesChange`, flash rojo de 300ms, sin terminar la partida salvo que `lives === 0`); si `adjacent === 0` → cascada iterativa con pila explícita, +5 por celda destapada.
   - `toggleFlag()` — solo sobre celdas no reveladas.
   - `isRoundClear()` — todas las celdas sin mina reveladas (las minas detonadas no bloquean el cierre de ronda). Al cerrarse: `+ POINTS_PER_CORRECT_FLAG` por cada bandera correcta, `+ ROUND_CLEAR_BONUS * round`, flash de `ROUND_FLASH_MS`, `round++`, `onLevelChange`, nuevo tablero.
   - Loop con `requestAnimationFrame` (dibujo, parpadeo del cursor, flashes de ronda/detonación).
   - Listeners `keydown`/`keyup` con `preventDefault` en flechas, `Space` y `KeyF`. `destroy()` idempotente cancela el `rAF` y remueve ambos listeners.
   - Callbacks solo al cambiar el valor.
   - Verificable de forma aislada: compila con `tsc` sin `any`, sin efectos de import.

2. **Crear `components/games/buscaminas/buscaminas-canvas.tsx`** — client component con `<canvas width={640} height={640}>` y `style={{ width: "100%", height: "100%", display: "block" }}`. `useEffect` sin dependencias para montar/destruir el engine + `useEffect` de sincronización de `paused`.

3. **Agregar entrada en `components/games/registry.ts`** — `buscaminas: { Canvas: dynamic(() => import("@/components/games/buscaminas/buscaminas-canvas"), { ssr: false }) }`.

4. **Integrar en `components/game-player.tsx`** — conectar `onScoreChange`/`onLivesChange`/`onLevelChange` a las casillas ya existentes del HUD (mismo cableado que Arkanoid, sin condicionales nuevas); `onGameOver` → `saveScoreAction({ gameId: 'buscaminas', name, score })`.

5. **Migración Supabase (`mcp__supabase__apply_migration`)** — `insert into games (...)` con la fila de arriba. Verificable con `select * from games where id = 'buscaminas'`.

6. **`lib/actions/scores.ts`** — agregar `"buscaminas"` a `GAMES_WITH_REAL_SCORES`.

7. **Portada** — diseñar `.cover-buscaminas` en `app/globals.css` con `/frontend-design`: grilla de celdas oscuras con una celda enmarcada en cian (el cursor) y un par de números neón alrededor.

8. **Verificación manual en navegador** — `npm run dev`, `/games/buscaminas/jugar`: las flechas mueven el cursor sin scrollear la página, `Shift`+flecha salta 5 celdas, `Espacio` revela, `F` marca; pisar una mina resta una vida y la partida sigue; despejar el tablero incrementa la ronda en el HUD y regenera el campo con más minas; a la tercera mina se abre el modal con el score real y "GUARDAR PUNTUACIÓN" inserta en `scores` (visible en `/games/buscaminas` y `/salon` tras refrescar). Confirmar que ningún otro juego cambia de comportamiento.

9. **`npm run build`** — compila sin errores de tipos ni de lint.

## Criterios de aceptación

Base (heredados, no omitir):

- [ ] `components/games/buscaminas/engine.ts` existe, exporta `createBuscaminasEngine`, sin `any`, sin acceder al DOM fuera de las funciones del engine.
- [ ] `components/games/buscaminas/buscaminas-canvas.tsx` existe, monta el canvas en `useEffect` y lo destruye (cancela loop, remueve listeners de teclado) al desmontar.
- [ ] El HUD de React refleja en vivo `score`, `vidas` y `nivel` (ronda) reales del motor.
- [ ] El botón "PAUSA" congela el canvas (loop detenido, teclas ignoradas) y "REANUDAR" lo continúa exactamente donde quedó.
- [ ] Al perder la tercera vida se abre automáticamente el modal de fin de partida con la puntuación final real, y "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` (visible en `/games/buscaminas` y `/salon` tras refrescar).
- [ ] El canvas escala visualmente al tamaño de `.crt-screen` sin deformarse en al menos dos anchos de ventana distintos.
- [ ] El juego aparece en el grid de `/games` con datos reales de Supabase (`games`), categoría PUZZLE.
- [ ] Ningún otro juego del catálogo cambia de comportamiento.
- [ ] `npm run build` compila sin errores de tipos ni de lint.

Específicos de este juego:

- [ ] El juego es 100% jugable sin mouse: flechas mueven el cursor, `Espacio` revela, `F` marca, `Shift`+flecha salta 5 celdas; ninguna acción requiere click.
- [ ] El cursor no sale del tablero (clamp en los bordes, sin wrap) y es visible en todo momento (parpadeo).
- [ ] Revelar una mina resta exactamente 1 vida, deja la mina visible como detonada e inofensiva, y la partida continúa mientras queden vidas.
- [ ] La primera revelación de cada ronda nunca detona (el reparto se rehace si hay mina en el cursor o sus vecinas).
- [ ] Revelar una celda con 0 adyacentes destapa en cascada el área contigua, sin recursión y sin desbordar el stack.
- [ ] Al despejar todas las celdas sin mina, la ronda sube (HUD "Nivel"), se cobran +25 por bandera correcta y +300 × ronda, y se genera un tablero nuevo con 6 minas más (tope 90).
- [ ] Las flechas y `Espacio` no scrollean la página mientras el canvas está montado.

## Decisiones tomadas y descartadas

- **Control 100% teclado — diferencia central con la variante A** — se descartó el mouse a propósito: elimina el hit-testing sobre un canvas escalado por CSS (fuente real de bugs, ver riesgos de la variante A), elimina el conflicto con el menú contextual del click derecho, y deja el juego alineado con el resto del catálogo (Rocas, Tetris, Snake, Arkanoid son todos de teclado). Alguien elige esta variante si quiere consistencia de plataforma y menos riesgo técnico; elige la A si quiere la sensación exacta del Buscaminas de escritorio.
- **3 vidas en vez de muerte instantánea — segunda diferencia con la A** — se descartó la regla clásica de "una mina y se acabó" porque, combinada con rondas infinitas, produce partidas de 20 segundos para un jugador medio y un leaderboard dominado por la suerte del primer tablero. Con 3 vidas la partida tiene arco y el score mide cuántas rondas aguantas. Coste asumido: no es Buscaminas "puro" (por eso existe la variante A).
- **Rondas infinitas sobre geometría fija 16×16, no tres tableros con final** — se descartó el formato "3 niveles y ganas" de la variante A porque un juego de leaderboard funciona mejor sin techo de score. Aquí no se puede "terminar" el juego, solo aguantar más rondas.
- **La mina detonada queda visible e inofensiva** — se descartó eliminarla del tablero (recalculando la adyacencia) porque invalidaría los números ya revelados y rompería la deducción hecha hasta ese momento.
- **La ronda se mapea a la casilla "Nivel" del HUD** — se descartó agregar un callback nuevo (`onRoundChange`) a `PlayableGameProps` porque semánticamente es lo mismo que `level` y el HUD ya tiene esa casilla cableada.
- **Banderas premiadas al cerrar la ronda, no al colocarlas** — se descartó puntuar la bandera en el momento de ponerla porque permitiría farmear puntos marcando y desmarcando; se cobran una sola vez, al final, y solo las correctas.
- **Salto de 5 celdas con `Shift`** — se descartó dejar solo el movimiento de a una celda porque cruzar 16 columnas con auto-repeat es tedioso, y se descartó el wrap-around en los bordes porque desorienta al leer el tablero.
- **Cascada iterativa con pila explícita, no recursiva** — mismo criterio que la variante A: evita stack overflow en tableros poco poblados.
- **Portada nueva `.cover-buscaminas`** — ninguna portada existente representa una grilla de casillas.

## Riesgos identificados

Reutilizados de spec 05 (aplican igual aquí):

- **Scroll de página por teclas capturadas** — flechas y `Espacio` scrollean el contenedor del `.crt`. Mitigación: `preventDefault()` en esos códigos mientras el canvas está montado.
- **Doble montaje en desarrollo (`StrictMode`)** — mitigación: `destroy()` idempotente, verificado explícitamente en dev.
- **Listeners de teclado globales entre navegaciones** — mitigación: `destroy()` remueve `keydown`/`keyup` al salir.
- **Callbacks disparando renders excesivos** — mitigación: comparar contra el valor previo antes de invocar `onScoreChange`/`onLivesChange`/`onLevelChange`.

Propios de este juego:

- **Auto-repeat del teclado y revelados accidentales** — mantener `Espacio` pulsado con auto-repeat podría revelar varias celdas seguidas al mover el cursor. Mitigación: `Espacio` y `F` se procesan solo en el flanco de bajada (ignorar `event.repeat`), a diferencia de las flechas, donde el auto-repeat sí se aprovecha.
- **Perder vidas se siente arbitrario si el flash no es claro** — sin retroalimentación visual fuerte, el jugador puede no entender por qué bajó el contador. Mitigación: flash rojo de pantalla de 300ms + la mina detonada dibujada con marca permanente.
- **El equilibrio 30 → 90 minas puede volverse imposible o trivial** — la densidad de 90/256 (35%) genera tableros donde la deducción pura no alcanza y hay que adivinar. Mitigación: el tope existe justo para que la dificultad se estabilice; si en pruebas resulta injusto, la constante `MAX_MINES` es el único valor a mover.
- **Adivinanza forzada (tableros no resolubles por lógica)** — es un defecto conocido del Buscaminas clásico y se agrava con densidad alta. Mitigación parcial: las 3 vidas amortiguan exactamente ese caso; se descartó implementar un generador de tableros garantizadamente resolubles (coste alto, fuera de un spec de jam).
- **Partidas potencialmente muy largas en rondas altas** — un jugador bueno podría encadenar muchas rondas. Mitigación: la densidad creciente acota en la práctica; no hay límite duro de tiempo.
- **Aleatoriedad sin semilla** — cada partida es un tablero distinto; el leaderboard compara habilidad promedio, igual que el resto del catálogo.
