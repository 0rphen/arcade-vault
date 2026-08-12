# SPEC — CRUCE NEÓN jugable + leaderboard (variante A: Frogger clásico por niveles)

> **Estado:** Candidata (game jam)
> **Depende de:** 06-leaderboard-catalogo-supabase
> **Fecha:** 2026-08-11
> **Objetivo:** Crear el motor de un Frogger clásico en `components/games/cruce-neon/` (autopista + río + 5 nichos de meta, 3 vidas, timer por intento, niveles progresivos), integrarlo en `GamePlayer` vía el registry de juegos jugables y dar de alta su fila de catálogo y su leaderboard real en Supabase.

## Alcance

**Dentro del alcance:**

- **Motor del juego** (`components/games/cruce-neon/engine.ts`) — grilla lógica de 15×14 celdas de 40px (canvas 600×560), sin sprites: todo dibujado con formas y colores del tema neón (`ctx.fillRect`/`roundRect`/`arc`). Estructura de bandas fija (de arriba hacia abajo):
  - **fila 0** — zona de nichos: 5 nichos de meta (columnas 1, 4, 7, 10, 13), separados por muro; el resto de la fila es letal (choque contra el seto).
  - **filas 1–5** — río: 5 carriles de plataformas móviles (troncos de datos y grupos de tortugas que se sumergen periódicamente). Fuera de una plataforma = ahogo.
  - **fila 6** — mediana segura (isla central).
  - **filas 7–11** — autopista: 5 carriles de vehículos de velocidades y direcciones alternas. Contacto con un vehículo = atropello.
  - **fila 12** — acera de salida (spawn de la rana, columna 7).
  - **fila 13** — banda de HUD interno del canvas: barra de tiempo del intento actual.
  - Movimiento por saltos discretos de una celda con tween de 120ms (durante el salto no se acepta input nuevo). Sobre una plataforma del río, la rana se desplaza arrastrada por la velocidad del carril. Encapsulado en `createCruceNeonEngine(canvas, callbacks)`, sin globals de módulo.
- **Wrapper de React** (`components/games/cruce-neon/cruce-neon-canvas.tsx`) — client component que monta el motor en un `<canvas width={600} height={560}>` vía `useEffect`/`ref`, escala por CSS dentro de `.crt-screen`, expone:
  - Callbacks `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver` (solo al cambiar el valor, nunca por frame).
  - Prop `paused: boolean`.
  - Cleanup en desmontaje: cancela `requestAnimationFrame` y remueve listeners de teclado.
- **Registro en `components/games/registry.ts`** — entrada `cruce-neon` → `dynamic(() => import(".../cruce-neon-canvas"), { ssr: false })`. El registry ya existe (creado en spec 07), no hace falta paso 0.
- **Integración en `GamePlayer`** (`components/game-player.tsx`) — consulta el registry por `game.id`; conecta `score`/`lives`/`level` al HUD existente (las tres casillas ya usadas por Arkanoid, sin cambios de layout); en `onGameOver` dispara `saveScoreAction({ gameId, name, score })`.
- **Controles** — solo flechas (`↑` `↓` `←` `→`), un salto de celda por pulsación, con `preventDefault` mientras el canvas está montado. Sin autorrepetición: mantener la tecla presionada no encadena saltos (se exige `keyup` entre saltos).
- **Catálogo (`games`)** — fila **nueva** vía `mcp__supabase__apply_migration` (`insert`): `id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `plays`.
- **Leaderboard real** — agregar `"cruce-neon"` a `GAMES_WITH_REAL_SCORES` en `lib/actions/scores.ts`. El resto de la capa de queries/acciones ya es genérica por `game_id`, no requiere cambios.
- **Portada** — clase nueva `.cover-cruce` en `app/globals.css`, diseñada con `/frontend-design` durante `/spec-impl` (carriles horizontales de luz + silueta de rana). No se reutiliza `.cover-rana`, que pertenece a la fila `ranaria` del catálogo.

**Fuera de alcance (diferido):**

- **Controles táctiles/mobile** — diferido, igual que el resto del catálogo.
- **Sonido** — diferido; no hay assets de audio para este juego en `references/`.
- **Sprites/assets externos** — no hay port ni spritesheet de Frogger en `references/started-games/` ni en `references/source_assets/` (solo `snake-assets`); todo el render es vectorial y programático.
- **Extras del arcade original** — cocodrilos en los nichos, mosca de bonus, rana rescatable a lomo de tronco, serpientes sobre la mediana: fuera de este spec, quedan como features futuras.
- **Callback de HUD para el temporizador** — no se agrega un `onTimeChange` a `PlayableGameProps`; el tiempo se dibuja dentro del canvas (fila 13).

## Modelo de datos

Interfaces TypeScript de la API entre el motor y React:

```ts
// components/games/cruce-neon/engine.ts
export interface CruceNeonCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface CruceNeonEngine {
  start: () => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export function createCruceNeonEngine(
  canvas: HTMLCanvasElement,
  callbacks: CruceNeonCallbacks,
): CruceNeonEngine;
```

```tsx
// components/games/cruce-neon/cruce-neon-canvas.tsx
export interface CruceNeonCanvasProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

`PlayableGameProps` (`components/games/types.ts`) ya cubre estos cuatro callbacks (`onLivesChange`/`onLevelChange` son opcionales y existen desde spec 08). **No se modifica `types.ts`.**

Constantes de balance del motor (`engine.ts`):

```ts
const CELL = 40; // px
const COLS = 15; // 600 / 40
const ROWS = 14; // 560 / 40
const HOME_ROW = 0;
const HOME_COLS = [1, 4, 7, 10, 13];
const RIVER_ROWS = [1, 2, 3, 4, 5];
const MEDIAN_ROW = 6;
const ROAD_ROWS = [7, 8, 9, 10, 11];
const START_ROW = 12;
const START_COL = 7;
const TIMER_ROW = 13;

const START_LIVES = 3;
const HOP_MS = 120; // duración del tween de salto
const ATTEMPT_TIME_MS = 30_000; // tiempo por intento en nivel 1
const TIME_STEP_PER_LEVEL_MS = 2_000; // -2s por nivel
const MIN_ATTEMPT_TIME_MS = 20_000;
const SPEED_STEP_PER_LEVEL = 0.15; // ×1.15 acumulativo
const MAX_SPEED_MULT = 2.0;

const POINTS_PER_NEW_ROW = 10; // solo por fila nunca alcanzada en el intento
const POINTS_PER_HOME = 50;
const POINTS_PER_SECOND_LEFT = 10; // bonus de tiempo al llegar a un nicho
const POINTS_LEVEL_COMPLETE = 200; // los 5 nichos ocupados
```

Definición declarativa de carriles (nivel 1; los niveles siguientes solo multiplican `speed`):

```ts
interface Lane {
  row: number;
  dir: 1 | -1;
  speed: number; // px/s a nivel 1
  widthCells: number; // ancho de cada entidad en celdas
  gapPx: number; // separación entre entidades del mismo carril
  kind: "car" | "truck" | "log" | "turtle";
}

const LANES: Lane[] = [
  // autopista (abajo → arriba)
  { row: 11, dir: 1, speed: 60, widthCells: 1, gapPx: 200, kind: "car" },
  { row: 10, dir: -1, speed: 90, widthCells: 1, gapPx: 240, kind: "car" },
  { row: 9, dir: 1, speed: 130, widthCells: 1, gapPx: 300, kind: "car" },
  { row: 8, dir: -1, speed: 75, widthCells: 2, gapPx: 320, kind: "truck" },
  { row: 7, dir: 1, speed: 160, widthCells: 1, gapPx: 360, kind: "car" },
  // río (abajo → arriba)
  { row: 5, dir: -1, speed: 70, widthCells: 3, gapPx: 220, kind: "turtle" },
  { row: 4, dir: 1, speed: 60, widthCells: 3, gapPx: 240, kind: "log" },
  { row: 3, dir: 1, speed: 90, widthCells: 5, gapPx: 300, kind: "log" },
  { row: 2, dir: -1, speed: 80, widthCells: 3, gapPx: 200, kind: "turtle" },
  { row: 1, dir: 1, speed: 110, widthCells: 2, gapPx: 260, kind: "log" },
];

const TURTLE_CYCLE_MS = 6_000; // 4s a flote + 2s sumergidas
const TURTLE_SUBMERGED_MS = 2_000;
```

Fila de catálogo (`games`, **`insert`** — el `id` es nuevo, no hay fila previa que renombrar):

```sql
insert into games (id, title, short, long, cat, cover, color, plays)
values (
  'cruce-neon',
  'CRUCE NEÓN',
  'Cruza la autopista y el río de datos sin morir en el intento.',
  'Una rana de luz debe atravesar cinco carriles de tráfico y un río de troncos hasta ocupar los cinco nichos del otro lado. El reloj corre en cada intento, las tortugas se hunden sin avisar y cada nivel completo acelera todo un 15%. Tres vidas, ni una más.',
  'ARCADE',
  'cover-cruce',
  'green',
  '0'
);
```

## Plan de implementación

1. **Crear `components/games/cruce-neon/engine.ts`** — estado encapsulado en `createCruceNeonEngine(canvas, callbacks)`:
   - `LANES` (tabla de arriba) instanciadas al iniciar cada nivel: cada carril genera entidades espaciadas `widthCells * CELL + gapPx` a lo largo de un ancho virtual `> COLS * CELL`, y hace wrap por el borde opuesto al salir.
   - Rana: `{ row, col, xPx, hopFrom, hopTo, hopStartedAt }`. Salto con tween lineal de `HOP_MS` sobre `xPx`/`yPx`; la posición lógica (`row`/`col`) se actualiza al inicio del salto, la colisión se evalúa al terminarlo.
   - Colisiones: AABB rana vs. vehículo en las `ROAD_ROWS`; en `RIVER_ROWS`, si el centro de la rana no cae sobre ninguna plataforma a flote → ahogo (tortuga sumergida no cuenta como plataforma). Arrastre: mientras está sobre una plataforma, `xPx += laneSpeed * dt`; si sale del canvas arrastrada → ahogo.
   - Nichos: llegar a `HOME_ROW` solo es válido alineado con una columna de `HOME_COLS` libre; nicho ya ocupado o seto → muerte.
   - Puntuación: `POINTS_PER_NEW_ROW` por fila superada por primera vez en el intento (`maxRowReached`), `POINTS_PER_HOME` + `segundosRestantes * POINTS_PER_SECOND_LEFT` al ocupar un nicho, `POINTS_LEVEL_COMPLETE` al ocupar los cinco.
   - Timer del intento: `ATTEMPT_TIME_MS - (level-1) * TIME_STEP_PER_LEVEL_MS`, piso `MIN_ATTEMPT_TIME_MS`; llegar a 0 cuesta una vida.
   - Nivel: al llenar los 5 nichos, `level++`, nichos vacíos de nuevo, multiplicador de velocidad `min(MAX_SPEED_MULT, 1 + level * SPEED_STEP_PER_LEVEL)`.
   - Game over: `lives` llega a 0 → `onGameOver(score)`.
   - Callbacks solo al cambiar el valor (comparación contra el valor previo, patrón de `asteroids/engine.ts`). `destroy()` idempotente: cancela `requestAnimationFrame` y remueve `keydown`/`keyup`.
   - Verificable de forma aislada: compila con `tsc` sin `any`, sin efectos al importar el módulo.

2. **Crear `components/games/cruce-neon/cruce-neon-canvas.tsx`** — client component con `<canvas width={600} height={560}>` y `style={{ width: "100%", height: "100%", display: "block" }}`. `useEffect` sin dependencias para montar/destruir el engine + `useEffect` que sincroniza `paused` con `engine.pause()`/`engine.resume()`.

3. **Agregar entrada en `components/games/registry.ts`** — `"cruce-neon": { Canvas: dynamic(() => import("@/components/games/cruce-neon/cruce-neon-canvas"), { ssr: false }) }`.

4. **Integrar en `components/game-player.tsx`** — el registry ya resuelve el montaje; conectar `onScoreChange`/`onLivesChange`/`onLevelChange` al HUD (mismas casillas que Arkanoid, sin ocultar ninguna) y `onGameOver` → `saveScoreAction`.

5. **Migración Supabase (`mcp__supabase__apply_migration`)** — `insert into games (...) values ('cruce-neon', ...)` con la fila de arriba. Verificable con `select * from games where id = 'cruce-neon'`.

6. **`lib/actions/scores.ts`** — `GAMES_WITH_REAL_SCORES` pasa de `["rocas", "caida", "arkanoid", "snake"]` a incluir `"cruce-neon"`.

7. **Portada** — diseñar `.cover-cruce` en `app/globals.css` con `/frontend-design`, en el bloque de covers junto a `.cover-rana`/`.cover-snake` (mismo patrón `background` + `::after`, sin imágenes).

8. **Verificación manual en navegador** — `npm run dev`, `/games/cruce-neon/jugar`: las flechas saltan una celda por pulsación, los vehículos matan, el agua ahoga salvo sobre tronco/tortuga a flote, las tortugas se hunden cada 6s, la rana se arrastra con la plataforma, llegar a un nicho suma 50 + bonus de tiempo y respawnea en la acera, llenar los 5 nichos sube de nivel y acelera todo, agotar el timer o perder las 3 vidas abre el modal con el score real y "GUARDAR PUNTUACIÓN" inserta en `scores` (visible en `/games/cruce-neon` y `/salon` tras refrescar). Confirmar que ningún otro juego cambia de comportamiento.

9. **`npm run build`** — compila sin errores de tipos ni de lint.

## Criterios de aceptación

Base (heredados, no omitir):

- [ ] `components/games/cruce-neon/engine.ts` existe, exporta `createCruceNeonEngine`, sin `any`, sin acceder al DOM fuera de las funciones del engine.
- [ ] `components/games/cruce-neon/cruce-neon-canvas.tsx` existe, monta el canvas en `useEffect`, y lo destruye (cancela loop, remueve listeners de teclado) al desmontar.
- [ ] El HUD de React refleja en vivo `score`, `lives` y `level` reales del motor.
- [ ] El botón "PAUSA" congela el canvas (loop y temporizador detenidos) y "REANUDAR" lo continúa exactamente donde quedó, sin consumir tiempo del intento durante la pausa.
- [ ] Al perder la última vida se abre automáticamente el modal de fin de partida con la puntuación final real, y "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` (visible en `/games/cruce-neon` y `/salon` tras refrescar).
- [ ] El canvas escala visualmente al tamaño de `.crt-screen` sin deformarse en al menos dos anchos de ventana distintos.
- [ ] El juego aparece en el grid de `/games` con datos reales de Supabase (`games`), categoría ARCADE.
- [ ] Ningún otro juego del catálogo cambia de comportamiento.
- [ ] `npm run build` compila sin errores de tipos ni de lint.

Específicos de este juego:

- [ ] Cada pulsación de flecha produce exactamente un salto de una celda; mantener la tecla presionada no encadena saltos.
- [ ] Tocar un vehículo en cualquiera de las 5 filas de autopista resta una vida y reinicia el intento desde la acera (fila 12, columna 7).
- [ ] En las 5 filas de río, estar fuera de una plataforma a flote (o sobre una tortuga sumergida) resta una vida por ahogo.
- [ ] Sobre un tronco o tortuga, la rana se desplaza con la plataforma; si la plataforma la saca del canvas, pierde una vida.
- [ ] Las tortugas cumplen el ciclo de 6s (4s a flote, 2s sumergidas) y se distinguen visualmente en cada estado.
- [ ] Ocupar un nicho suma 50 puntos más 10 por cada segundo restante del temporizador, y la rana reaparece en la acera con el timer reiniciado.
- [ ] Intentar entrar a un nicho ya ocupado, o al seto entre nichos, resta una vida.
- [ ] Ocupar los 5 nichos suma 200 puntos, sube el nivel, vacía los nichos y multiplica ×1.15 la velocidad de todos los carriles (tope ×2.0).
- [ ] Agotar el temporizador del intento (30s en nivel 1, −2s por nivel, piso 20s) resta una vida.
- [ ] Avanzar a una fila más alta que la máxima alcanzada en el intento suma 10 puntos; retroceder y volver a avanzar no vuelve a puntuar.

## Decisiones tomadas y descartadas

- **`insert` de una fila nueva `cruce-neon`, no `update` de la fila existente `ranaria`** — el catálogo ya tiene `ranaria` ("Cruza la autopista de pixeles", ARCADE, `cover-rana`) como placeholder sin motor, y la tentación era renombrarla como se hizo con `bloque-buster`→`arkanoid` (spec 08) y `serpentina`→`snake` (spec 09). Se descartó para esta candidata porque un spec de game jam no debe comprometer una fila viva del catálogo: si el usuario promueve esta variante vía `/add-game`, ahí puede decidir conscientemente reutilizar `ranaria` con un `update` (opción más limpia a largo plazo, evita dos Froggers en el grid) en vez de insertar un id nuevo. Queda anotado como riesgo abajo.
- **Diferencia clave con la variante B: estructura fija por niveles y 3 vidas, en vez de scroll infinito procedural** — esta variante es el Frogger de máquina recreativa: tablero de tamaño fijo visible entero, meta explícita (5 nichos), progresión discreta por niveles y economía de vidas. Alguien elige A si quiere un juego con "objetivo" claro, sesiones con tensión de completar el tablero y un HUD rico (score/vidas/nivel) coherente con Arkanoid. Se descartó aquí el enfoque endless porque diluye el momento de logro de llenar los cinco nichos, que es la firma del clásico.
- **Timer dibujado en el canvas (fila 13), sin nuevo callback de HUD** — se descartó agregar `onTimeChange?: (msLeft: number) => void` a `PlayableGameProps` porque dispararía renders de React varias veces por segundo (el patrón del proyecto es "callback solo al cambiar el valor", y el tiempo cambia siempre); una barra dentro del canvas cuesta cero renders y no toca el contrato compartido.
- **Salto discreto con tween de 120ms, no movimiento continuo** — se descartó mover la rana con velocidad continua estilo `rocas` porque el timing de Frogger depende de decidir "¿salto ahora o espero?" con posiciones de celda discretas; el tween es solo cosmético y no cambia la lógica de colisión (que se evalúa al aterrizar).
- **Sin autorrepetición de teclado** — se descartó aceptar saltos mientras la tecla sigue presionada porque un `keydown` repetido del sistema haría cruzar la autopista sin control; se exige `keyup` entre saltos, mismo espíritu que el buffer de dirección de Snake (spec 09).
- **Render vectorial, sin sprites** — no existe port ni spritesheet de Frogger en `references/` (solo `snake-assets`); se descartó inventar dependencia de assets binarios y se sigue el criterio de `rocas`/`caida` (formas dibujadas con `ctx`), que además encaja mejor con la estética neón del sitio.
- **Portada propia `.cover-cruce` en vez de reutilizar `.cover-rana`** — se descartó reutilizar la clase existente porque pertenece visualmente a la fila `ranaria`; si ambas coexisten en el grid, dos tarjetas idénticas confunden.
- **HUD completo (score/vidas/nivel) sin ocultar casillas** — se descartó el patrón de Snake (ocultar "Vidas"/"Nivel" en `game-player.tsx`) porque aquí ambos conceptos existen de verdad; no hay cambios condicionales de HUD que agregar.
- **`plays` inicial `'0'`** — se descartó inventar una cifra de fantasía tipo `'6.4K'` (como tienen las filas sembradas en spec 06) porque este juego nace sin historial real.

## Riesgos identificados

Reutilizados de spec 05 (aplican igual aquí):

- **Scroll de página por teclas capturadas** — `↑` `↓` `←` `→` scrollean la página alrededor del `.crt`. Mitigación: `preventDefault()` en esos códigos mientras el canvas está montado.
- **Doble montaje en desarrollo (`StrictMode`)** — dos loops en paralelo duplicarían la velocidad de los carriles y el consumo del temporizador. Mitigación: `destroy()` idempotente, verificado explícitamente en dev.
- **Listeners de teclado globales entre navegaciones** — mitigación: `destroy()` remueve `keydown`/`keyup` al salir.
- **Callbacks disparando renders excesivos** — mitigación: comparar contra el valor previo antes de invocar `onScoreChange`/`onLivesChange`/`onLevelChange`.

Propios de este juego:

- **Convivencia con la fila `ranaria` del catálogo** — si se aplica el `insert` sin tocar `ranaria`, `/games` mostrará dos juegos de cruzar la autopista, uno jugable y otro no. Mitigación: al promover esta candidata con `/add-game`, decidir explícitamente entre (a) `update` sobre `ranaria` reutilizando su `id`, o (b) `insert` de `cruce-neon` + retiro/rescritura del copy de `ranaria`.
- **Balance del río imposible de cruzar con los valores propuestos** — las 10 velocidades y `gapPx` de `LANES` son de diseño, no portadas de un original medido; si dos carriles contiguos del río quedan en fase opuesta con huecos grandes, puede haber configuraciones donde ningún salto sea seguro. Mitigación: verificación manual en el paso 8 y ajuste de `gapPx`/`speed` carril por carril antes de cerrar el spec (a diferencia de specs 07/08, aquí el balance **sí** es retocable porque no hay original que respetar).
- **Arrastre sobre plataforma con `xPx` desalineado de la grilla** — la rana sobre un tronco deja de estar centrada en una columna; si el salto siguiente redondea mal (`Math.round(xPx / CELL)`), puede aterrizar en una celda inesperada o "teletransportarse" medio bloque. Mitigación: definir explícitamente que la posición de columna al saltar desde una plataforma se calcula con `Math.round`, y cubrirlo en la verificación manual saltando desde troncos en los dos sentidos.
- **Aceleración acumulativa hasta ×2.0 puede volver el nivel 5+ injugable** — mitigación: `MAX_SPEED_MULT = 2.0` como tope duro, revisable tras la verificación manual.
- **Pausa y temporizador desincronizados** — si el timer usa `Date.now()` absoluto en vez de acumular `dt` del loop, pausar durante 30 segundos mataría a la rana al reanudar. Mitigación: el temporizador se descuenta solo con el `dt` del loop activo, nunca con reloj de pared.
