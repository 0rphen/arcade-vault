# SPEC — SOKOBAN jugable + leaderboard (variante B — arcade contrarreloj, niveles procedurales infinitos, sin undo)

> **Estado:** Candidata (game jam)
> **Depende de:** 06-leaderboard-catalogo-supabase
> **Fecha:** 2026-08-17
> **Objetivo:** Crear el motor de Sokoban en `components/games/sokoban/` como arcade contrarreloj: almacenes pequeños generados proceduralmente uno tras otro, sin undo, con un reloj global que solo se recarga resolviendo, integrarlo en `GamePlayer` vía el registry y dar de alta su fila de catálogo y su leaderboard real en Supabase.

## Alcance

**Dentro del alcance:**

- **Motor del juego** (`components/games/sokoban/engine.ts`) — reglas de Sokoban idénticas al clásico (el jugador se mueve celda a celda; si la celda destino tiene una caja y la siguiente en esa dirección está libre, la caja se empuja; nunca se tira, nunca se empujan dos cajas a la vez), envueltas en un bucle arcade:
  - **Rondas infinitas** — cada ronda es un almacén nuevo generado en el momento; al resolverlo se genera el siguiente sin transición ni menú.
  - **Reloj global** — arranca en 60 s y baja en tiempo real (no por turnos). Resolver una ronda **suma** tiempo (`6 s por caja del nivel`, más `4 s` extra si se resolvió en menos de `par + 2` empujes). El reloj es lo único que termina la partida.
  - **Sin undo** — la única marcha atrás es `R`, que regenera la ronda actual **con el mismo tablero** desde su estado inicial y cuesta 5 s.
  - **Detección de deadlock** — como no hay undo, el motor detecta las dos situaciones irrecuperables baratas de comprobar y avisa en vez de dejar al jugador atascado: (a) caja fuera de objetivo en una esquina de dos muros ortogonales; (b) caja fuera de objetivo pegada a un muro en una línea (fila o columna) que no contiene ningún objetivo contra ese mismo muro. Al detectarse, se marca la caja en rojo, el tablero se descarta, se penaliza con 10 s y se genera una ronda nueva del mismo tamaño.
  - **Derrota:** el reloj llega a 0 → `onGameOver(score)`. No hay victoria: el juego es infinito, la meta es el leaderboard.
  - Resolución lógica fija 640×640, celda fija de 64 px (el generador nunca produce tableros de más de 10×10, así que el tablero siempre entra y se dibuja centrado).
- **Generador de niveles** (`components/games/sokoban/generator.ts`) — genera almacenes **solubles por construcción** mediante retro-arrastre (_reverse pulling_): se parte del estado resuelto y se "tira" de las cajas hacia atrás; toda posición alcanzable así es, por reversibilidad, resoluble empujando. Curva por ronda:
  | Rondas | Tablero | Cajas | Pasos de retro-arrastre |
  | ------ | ------- | ----- | ----------------------- |
  | 1–3    | 6×6     | 1     | 8                       |
  | 4–8    | 7×7     | 2     | 12                      |
  | 9–15   | 8×8     | 3     | 16                      |
  | 16–24  | 9×9     | 3     | 20                      |
  | 25+    | 10×10   | 4     | 24                      |
- **Wrapper de React** (`components/games/sokoban/sokoban-canvas.tsx`) — client component que monta el motor en un `<canvas width={640} height={640}>` vía `useEffect`/`ref`, escala por CSS dentro de `.crt-screen`, expone:
  - Callbacks `onScoreChange`, `onLevelChange` (número de ronda), `onGameOver` (solo al cambiar el valor, nunca por frame).
  - Prop `paused: boolean`.
  - Cleanup en desmontaje: cancela `requestAnimationFrame` y remueve los listeners `keydown`/`keyup` registrados por el motor.
- **Registro en `components/games/registry.ts`** — entrada `sokoban` → `dynamic(() => import(".../sokoban-canvas"), { ssr: false })`. El registry ya existe (creado en spec 07), no hace falta paso 0.
- **Integración en `GamePlayer`** (`components/game-player.tsx`) — consulta el registry por `game.id`; conecta `score` y `level` al HUD y **oculta la casilla "Vidas"** para `sokoban` (mismo patrón condicional ya usado para `snake`); en `onGameOver` dispara `saveScoreAction`.
- **Controles (teclado)** — `←` `→` `↑` `↓` mover/empujar, `R` reintentar la ronda actual (cuesta 5 s); con `preventDefault` mientras el canvas está montado. Un movimiento por evento `keydown`, con cooldown de 70 ms (más corto que en la variante A: aquí el reloj corre y hace falta agilidad).
- **Controles táctiles (spec 10 / gamepad MK-II spec 11)** — entrada nueva en `TOUCH_CONTROLS_CONFIG` (`components/games/touch-controls-config.ts`), sin tocar `touch-controls.tsx` ni el `engine.ts`:
  ```ts
  sokoban: {
    dpad: { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" },
    buttons: { a: { code: "KeyR", label: "Reintentar ronda" } },
  }
  ```
- **Catálogo (`games`)** — fila **nueva** vía `mcp__supabase__apply_migration` (`insert`; el id `sokoban` no existe hoy en la tabla — verificado 2026-08-17): `cat = 'PUZZLE'`, `color = 'yellow'`, `cover = 'cover-sokoban'`, `plays = '0'`.
- **Leaderboard real** — agregar `"sokoban"` a `GAMES_WITH_REAL_SCORES` en `lib/actions/scores.ts`. El resto de la capa de queries/acciones ya es genérica.
- **Portada** — clase nueva `.cover-sokoban` en `app/globals.css` (caja amarilla con aspas sobre una casilla objetivo, con un arco de reloj alrededor), diseñada con `/frontend-design` durante `/spec-impl`.

**Fuera de alcance (diferido):**

- **Sonido** — diferido.
- **Niveles fijos diseñados a mano** — esta variante no tiene campaña; los 4 tableros de respaldo (`FALLBACK_LEVELS`) solo se usan si el generador falla, no como contenido.
- **Undo** — descartado explícitamente: es el eje de diseño de esta variante (ver Decisiones). La variante A sí lo tiene.
- **Semilla compartida entre jugadores (misma secuencia de tableros para todos)** — diferido; cada partida genera su propia secuencia, igual que la aleatoriedad de Tetris o Rocas.
- **Detección de deadlocks avanzados** (bloqueos por combinación de varias cajas, análisis de zonas muertas) — solo se detectan los dos casos descritos; casos más sutiles quedan a cargo del jugador y del reloj.
- **Animación de interpolación del movimiento** — movimiento discreto de celda a celda, sin tween.

## Modelo de datos

```ts
// components/games/sokoban/engine.ts
export interface SokobanCallbacks {
  onScoreChange: (score: number) => void;
  onLevelChange: (round: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface SokobanEngine {
  start: () => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export function createSokobanEngine(
  canvas: HTMLCanvasElement,
  callbacks: SokobanCallbacks,
): SokobanEngine;
```

```tsx
// components/games/sokoban/sokoban-canvas.tsx
export interface SokobanCanvasProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLevelChange: (round: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

Contrato del generador (`components/games/sokoban/generator.ts`):

```ts
export type Tile = "wall" | "floor" | "goal";

export interface Vec {
  x: number;
  y: number;
}

export interface GeneratedLevel {
  tiles: Tile[][]; // rows × cols, borde siempre "wall"
  boxes: Vec[];
  player: Vec;
  /** Empujes mínimos estimados = pasos de retro-arrastre efectivos. Base del bonus de rapidez. */
  par: number;
}

export interface RoundShape {
  cols: number;
  rows: number;
  boxes: number;
  pullSteps: number;
}

export function shapeForRound(round: number): RoundShape;

/** Genera un nivel soluble por construcción. `rng` inyectado para poder testearlo con semilla fija. */
export function generateLevel(
  shape: RoundShape,
  rng: () => number,
): GeneratedLevel | null;
```

Constantes de balance (`engine.ts`):

```ts
const CANVAS_W = 640;
const CANVAS_H = 640;
const CELL = 64; // px; el generador nunca supera 10×10

const START_TIME_MS = 60_000;
const TIME_PER_BOX_MS = 6_000; // al resolver: + 6 s por caja del nivel
const FAST_SOLVE_BONUS_MS = 4_000; // extra si se resolvió en < par + 2 empujes
const RESTART_COST_MS = 5_000; // tecla R
const DEADLOCK_PENALTY_MS = 10_000; // caja bloqueada detectada
const MAX_TIME_MS = 99_000; // techo del reloj, para que no se acumule indefinidamente

const PUSH_POINTS = 1; // por empuje válido
const BOX_ON_GOAL_POINTS = 50; // al dejar una caja sobre objetivo (se resta al sacarla)
const ROUND_CLEAR_BASE = 200; // bonus base por ronda resuelta
const COMBO_STEP = 0.25; // multiplicador +0.25 por ronda encadenada limpia
const COMBO_MAX = 4; // tope del multiplicador
const MOVE_COOLDOWN_MS = 70;
```

Constantes del generador (`generator.ts`):

```ts
const WALL_DENSITY = 0.12; // muros interiores sembrados sobre celdas interiores
const MAX_ATTEMPTS = 200; // intentos antes de rendirse y devolver null
const MIN_DISPLACED_BOXES = 1; // al menos una caja debe terminar fuera de su objetivo
const MIN_PAR = 3; // niveles triviales (par < 3) se descartan y se regeneran
```

Puntuación de una ronda resuelta:

```
score += round(
  (ROUND_CLEAR_BASE + BOX_ON_GOAL_POINTS * cajas + PUSH_POINTS * empujes)
  * min(COMBO_MAX, 1 + COMBO_STEP * combo)
)
```

`combo` es el número de rondas consecutivas resueltas **sin** pulsar `R` y **sin** deadlock; cualquiera de las dos cosas lo devuelve a 0.

Fila de catálogo (`games`, `insert` — el id es nuevo, no hay fila previa que renombrar):

```sql
insert into games (id, title, short, long, cat, cover, color, plays)
values (
  'sokoban',
  'SOKOBAN',
  'Almacenes infinitos contra el reloj: empuja rápido o se acaba el turno.',
  'Sokoban con prisa. Cada almacén se genera al vuelo y siempre tiene solución, pero no hay deshacer: una caja empujada a una esquina es una caja perdida. Resolver rondas es la única forma de recargar el reloj, y encadenarlas sin fallar multiplica cada punto hasta x4.',
  'PUZZLE',
  'cover-sokoban',
  'yellow',
  '0'
);
```

## Plan de implementación

1. **Crear `components/games/sokoban/generator.ts`** — retro-arrastre, sin efectos de import, `rng` inyectado:
   - `shapeForRound(round)` devuelve la fila correspondiente de la tabla de curva del Alcance.
   - `generateLevel(shape, rng)`:
     1. Construir una sala `cols × rows` con borde de muro y sembrar muros interiores con `WALL_DENSITY`, descartando los que dejarían una celda de suelo aislada (comprobación por flood fill: todas las celdas de suelo deben ser mutuamente alcanzables).
     2. Colocar `shape.boxes` objetivos en celdas de suelo distintas y poner una caja sobre cada uno (estado **resuelto**); situar al jugador en una celda de suelo adyacente a alguna caja.
     3. Ejecutar `shape.pullSteps` retro-arrastres: elegir al azar una caja y una dirección tal que la celda **detrás** de la caja (donde debería estar el jugador para haberla empujado) y la celda a la que la caja retrocede sean ambas suelo libre; mover jugador y caja hacia atrás. Si en una iteración no hay ningún movimiento legal, saltarla (con un tope de 3 saltos consecutivos antes de abortar el intento).
     4. Aceptar el nivel solo si al menos `MIN_DISPLACED_BOXES` cajas quedaron fuera de su objetivo y el número de retro-arrastres efectivos (`par`) es `>= MIN_PAR`. Si no, reintentar hasta `MAX_ATTEMPTS`; agotados, devolver `null`.
   - Verificable de forma aislada: compila con `tsc` sin `any`; con una `rng` de semilla fija, 200 generaciones seguidas devuelven niveles válidos (nº de cajas === nº de objetivos, un solo jugador, todas las celdas de suelo conectadas) y ninguna cuelga el hilo.

2. **Crear `components/games/sokoban/fallback-levels.ts`** — 4 tableros fijos pequeños (6×6 a 8×8, 1–3 cajas) en notación XSB, usados **solo** cuando `generateLevel` devuelve `null`, para que una ronda nunca quede en blanco.

3. **Crear `components/games/sokoban/engine.ts`** — estado encapsulado en `createSokobanEngine(canvas, callbacks)`, sin globals de módulo:
   - `nextRound()` — `round++` (`onLevelChange`), pide `generateLevel(shapeForRound(round), Math.random)` y, si es `null`, usa `FALLBACK_LEVELS[round % 4]`. Guarda una copia del estado inicial para `R`.
   - `tryMove(dir)` — mismas reglas que el clásico: muro → inválido; caja con muro u otra caja detrás → inválido; los movimientos inválidos no cuentan. Tras un empuje válido: `PUSH_POINTS`, `BOX_ON_GOAL_POINTS` (y su resta simétrica al sacar una caja de un objetivo), comprobar `isRoundClear()` y, si no, `checkDeadlock()`.
   - `isRoundClear()` — todas las cajas sobre objetivos: suma el bonus con multiplicador de combo, suma tiempo (`TIME_PER_BOX_MS * cajas`, más `FAST_SOLVE_BONUS_MS` si `empujes < par + 2`) con techo en `MAX_TIME_MS`, `combo++`, `nextRound()`.
   - `checkDeadlock()` — recorre las cajas fuera de objetivo y aplica las dos reglas descritas (esquina de dos muros ortogonales; muro en una línea sin objetivo contra ese muro). Si alguna da positivo: marca la caja en rojo durante 700 ms (el loop sigue corriendo, el input se ignora en ese lapso), resta `DEADLOCK_PENALTY_MS`, `combo = 0`, `nextRound()`.
   - `restartRound()` (`R`) — restaura la copia del estado inicial de la ronda, resta `RESTART_COST_MS`, `combo = 0`. No cambia de tablero.
   - Reloj: se descuenta `delta` real en cada frame del `requestAnimationFrame` (no un `setInterval`), se congela en `pause()`. Al llegar a 0 → `onGameOver(score)`.
   - Render: fondo, muros, objetivos (rombo hueco), cajas (cuadro amarillo con aspas; verde relleno sobre objetivo; rojo al detectarse deadlock), jugador, **barra de tiempo** horizontal en el borde superior del canvas (verde → ámbar bajo 15 s → rojo parpadeante bajo 5 s) y el texto `RONDA n · x1.75` con el multiplicador de combo activo.
   - Listeners: un único `keydown` en `window` con `preventDefault` sobre `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`/`KeyR`, más `keyup` para resetear el cooldown de auto-repeat. `destroy()` idempotente cancela el `rAF` y remueve ambos listeners.
   - Callbacks `onScoreChange`/`onLevelChange` solo al cambiar el valor; el tiempo restante **no** se expone a React.
   - Verificable de forma aislada: compila con `tsc` sin `any`, sin efectos de import.

4. **Crear `components/games/sokoban/sokoban-canvas.tsx`** — client component con `<canvas width={640} height={640}>` y `style={{ width: "100%", height: "100%", display: "block" }}`. `useEffect` sin dependencias para montar/destruir el engine + `useEffect` de sincronización de `paused`.

5. **Agregar entrada en `components/games/registry.ts`** — `sokoban: { Canvas: dynamic(() => import("@/components/games/sokoban/sokoban-canvas"), { ssr: false }) }`.

6. **Ajustar HUD en `components/game-player.tsx`** — para `sokoban` se muestran "Puntuación" y "Nivel" (rotulado con el número de ronda); se oculta "Vidas", misma condicional que ya se usa para `snake`.

7. **Agregar entrada en `components/games/touch-controls-config.ts`** — bloque `sokoban` con D-pad completo y botón A → `KeyR`.

8. **Migración Supabase (`mcp__supabase__apply_migration`)** — `insert into games (...)` con la fila de arriba. Verificable con `select * from games where id = 'sokoban'`.

9. **`lib/actions/scores.ts`** — agregar `"sokoban"` a `GAMES_WITH_REAL_SCORES`.

10. **Portada** — diseñar `.cover-sokoban` en `app/globals.css` con `/frontend-design`.

11. **Verificación manual en navegador** — `npm run dev`, `/games/sokoban/jugar`: el reloj arranca en 60 s y baja de verdad; las flechas mueven y empujan; resolver una ronda recarga tiempo, sube el HUD "Nivel" y genera un tablero distinto; empujar una caja a una esquina se detecta como deadlock (caja en rojo, −10 s, tablero nuevo, combo a 0); `R` reintenta el mismo tablero por 5 s; el multiplicador sube encadenando rondas limpias y se reinicia al fallar; al llegar el reloj a 0 se abre el modal con el score real y "GUARDAR PUNTUACIÓN" inserta en `scores` (visible en `/games/sokoban` y `/salon` tras refrescar). Jugar al menos 15 rondas seguidas para comprobar que el generador no produce tableros triviales ni imposibles y que no hay tirones de rendimiento al generar. Probar en emulación táctil de DevTools (`pointer: coarse`). Confirmar que ningún otro juego cambia de comportamiento.

12. **`npm run build`** — compila sin errores de tipos ni de lint.

## Criterios de aceptación

Base (heredados, no omitir):

- [ ] `components/games/sokoban/engine.ts` existe, exporta `createSokobanEngine`, sin `any`, sin acceder al DOM fuera de las funciones del engine.
- [ ] `components/games/sokoban/sokoban-canvas.tsx` existe, monta el canvas en `useEffect` y lo destruye (cancela loop, remueve listeners de teclado) al desmontar.
- [ ] El HUD de React refleja en vivo `score` y `level` (ronda) reales del motor; la casilla "Vidas" no se muestra para Sokoban.
- [ ] El botón "PAUSA" congela el canvas, **detiene el reloj** e ignora las teclas; "REANUDAR" lo continúa exactamente donde quedó (el tiempo restante no se consume durante la pausa).
- [ ] Al llegar el reloj a 0 se abre automáticamente el modal de fin de partida con la puntuación final real, y "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` (visible en `/games/sokoban` y `/salon` tras refrescar).
- [ ] El canvas escala visualmente al tamaño de `.crt-screen` sin deformarse en al menos dos anchos de ventana distintos.
- [ ] El juego aparece en el grid de `/games` con datos reales de Supabase (`games`), categoría PUZZLE.
- [ ] Ningún otro juego del catálogo cambia de comportamiento.
- [ ] `npm run build` compila sin errores de tipos ni de lint.

Específicos de este juego:

- [ ] Las cajas solo se empujan (nunca se tiran) y nunca se empujan dos cajas en la misma dirección a la vez; un movimiento bloqueado no mueve nada.
- [ ] Todos los niveles generados son solubles (construidos por retro-arrastre desde el estado resuelto) y tienen tantas cajas como objetivos, un solo jugador y todas las celdas de suelo conectadas.
- [ ] La curva de tamaño/cajas por ronda sigue la tabla del spec (6×6/1 caja en la ronda 1, 10×10/4 cajas de la 25 en adelante).
- [ ] Resolver una ronda suma 6 s por caja, más 4 s extra si se resolvió en menos de `par + 2` empujes, con techo de 99 s.
- [ ] El multiplicador de combo sube 0,25 por ronda encadenada sin `R` ni deadlock, tope x4, y vuelve a x1 en cuanto ocurre cualquiera de las dos cosas.
- [ ] Empujar una caja a una esquina de dos muros (o contra un muro en una línea sin objetivos) se detecta como deadlock: caja en rojo, −10 s, combo a 0, ronda nueva; el jugador nunca queda atascado sin salida.
- [ ] `R` reintenta **el mismo tablero** desde su estado inicial y cuesta 5 s.
- [ ] No existe ninguna forma de deshacer un movimiento individual.
- [ ] Si el generador agota sus 200 intentos, se carga un tablero de `FALLBACK_LEVELS` en vez de dejar la ronda vacía o colgar el loop.
- [ ] La barra de tiempo del canvas cambia de color bajo 15 s y parpadea bajo 5 s.
- [ ] La entrada `sokoban` de `TOUCH_CONTROLS_CONFIG` existe y, en emulación táctil, el D-pad mueve y el botón A reintenta la ronda.

## Decisiones tomadas y descartadas

- **Generación procedural infinita en vez de campaña de niveles fijos — diferencia central con la variante A** — se descartaron los niveles curados porque el objetivo aquí es rejugabilidad y leaderboard: nadie memoriza la solución, cada partida es distinta y la comparación entre jugadores mide lectura rápida del tablero, no memoria. Quien quiera puzzles diseñados con intención y tiempo para pensarlos, elige la variante A; quien quiera una partida de 3 minutos que se pueda repetir veinte veces, elige esta.
- **Retro-arrastre (_reverse pulling_) como método de generación, no "colocar cajas al azar y verificar con un solver"** — se descartó el enfoque generar-y-verificar porque resolver Sokoban es PSPACE-completo: un solver dentro del loop del juego es un riesgo real de congelar la pestaña. Partir del estado resuelto y tirar hacia atrás garantiza solubilidad por construcción, en tiempo lineal en los pasos de arrastre.
- **Sin undo, con detección de deadlock como contrapartida** — se descartó el undo (que la variante A sí tiene) porque anula la tensión: si cualquier error se deshace gratis, el reloj deja de importar. Pero sin undo hay que evitar que el jugador quede encerrado sin darse cuenta, así que el motor detecta las dos formas baratas de bloqueo y corta la ronda él mismo, cobrando 10 s. La regla implícita del diseño: el castigo es tiempo, nunca "quedarse mirando un tablero muerto".
- **Solo dos reglas de deadlock (esquina y muro sin objetivo en la línea)** — se descartó un detector exhaustivo (zonas muertas precalculadas, bloqueos entre varias cajas) porque el coste de implementarlo y el riesgo de falsos positivos —cortar una ronda que en realidad tenía solución— son mucho peores que dejar algún bloqueo sutil sin detectar: en ese caso el jugador todavía tiene `R` por 5 s.
- **Reloj global recargable en vez de vidas o de un temporizador por ronda** — se descartaron las vidas (usadas en la variante A) porque no dan sensación de prisa, y se descartó el reloj por ronda porque premiaría abandonar rondas difíciles esperando el reset. Un solo reloj que solo se recarga resolviendo hace que cada segundo perdido pese.
- **Techo de 99 s en el reloj** — se descartó dejarlo acumular sin límite: un jugador muy bueno podría amasar diez minutos de colchón en las rondas fáciles y volver la partida interminable (y con ello, el modal de score, inalcanzable).
- **Multiplicador de combo por rondas limpias encadenadas** — se descartó puntuar cada ronda de forma plana porque no distinguiría a quien resuelve 20 rondas sin errores de quien resuelve 20 tropezando en la mitad; el combo es el que crea la curva de riesgo (usar `R` es barato en tiempo pero caro en multiplicador).
- **`R` reintenta el mismo tablero, no genera uno nuevo** — se descartó regenerar porque permitiría "rerollear" tableros difíciles por solo 5 s; reintentar el mismo mantiene la decisión honesta (o lo resuelves, o comes el deadlock).
- **Celda fija de 64 px y tope de 10×10 en el generador** — se descartó una celda variable (que sí usa la variante A, por tener niveles de tamaños dispares): con tableros generados es preferible acotar el tamaño y mantener el render idéntico ronda a ronda, para que el ojo no tenga que reajustarse con el reloj corriendo.
- **Tiempo dibujado como barra dentro del canvas, no como casilla del HUD** — se descartó agregar un callback `onTimeChange` al contrato compartido: se dispararía varias veces por segundo, para todos los juegos, solo por esta variante. La barra dentro del canvas además queda a un golpe de vista del tablero.
- **HUD con score y ronda, sin vidas** — la casilla "Vidas" no tiene significado aquí; se oculta con la misma condicional ya usada para `snake`, sin cambios estructurales en el HUD.
- **`rng` inyectado en `generateLevel`** — se descartó llamar a `Math.random()` directamente dentro del generador para poder ejercitarlo con una semilla fija durante el desarrollo (200 generaciones reproducibles) aunque en el juego real se pase `Math.random`.
- **Portada nueva `.cover-sokoban`** — igual que en la variante A: ninguna portada existente representa cajas sobre una grilla.

## Riesgos identificados

Reutilizados de spec 05 (aplican igual aquí):

- **Scroll de página por teclas capturadas** — mitigación: `preventDefault()` en `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`/`KeyR` mientras el canvas está montado.
- **Doble montaje en desarrollo (`StrictMode`)** — mitigación: `destroy()` idempotente, verificado explícitamente en dev (dos loops descontarían el reloj al doble de velocidad, un síntoma muy visible).
- **Listeners de teclado globales entre navegaciones** — mitigación: `destroy()` remueve `keydown`/`keyup` al salir.
- **Callbacks disparando renders excesivos** — mitigación: comparar contra el valor previo antes de invocar `onScoreChange`/`onLevelChange`.

Propios de este juego:

- **El generador es el riesgo número uno de esta variante** — si el retro-arrastre está mal implementado (por ejemplo, si permite "tirar" de una caja hacia una celda donde el jugador no podría haberse situado), puede producir tableros irresolubles pese a la garantía teórica. Mitigación: la comprobación de cada retro-arrastre exige que **ambas** celdas (la de destino de la caja y la de destino del jugador, detrás de ella) sean suelo libre; se ejercita con 200 generaciones de semilla fija antes de cerrar el paso 1, y se juega manualmente una muestra de tableros de cada tamaño.
- **Niveles triviales o degenerados** — con pocos pasos de retro-arrastre, las cajas pueden quedar a un empuje de su objetivo, o incluso encima de él; una racha de esos regala tiempo infinito. Mitigación: `MIN_DISPLACED_BOXES` y `MIN_PAR` descartan y regeneran esos casos.
- **Coste de generación dentro del frame** — con `MAX_ATTEMPTS = 200` y flood fills de conectividad, el peor caso podría producir un salto perceptible entre rondas en un 10×10. Mitigación: los tableros son diminutos (máximo 100 celdas), pero el paso 11 exige verificar 15 rondas seguidas sin tirón; si aparece, se genera la ronda `n+1` en cuanto se resuelve la `n` (prefetch de un nivel por delante), no en la transición.
- **Falso positivo de deadlock** — la regla del "muro sin objetivo en la línea" es correcta para una caja aislada, pero si se implementa mal (por ejemplo, mirando la fila entera en vez del tramo contiguo de muro) podría cortar rondas resolubles y frustrar al jugador con 10 s de penalización injusta. Mitigación: la regla se limita al tramo de muro contiguo a la caja, y en la verificación manual se prueba explícitamente el caso de caja pegada a un muro con un objetivo al otro extremo del mismo tramo.
- **Reloj y pausa desincronizados** — si el tiempo se descuenta con `Date.now()` en vez de con el `delta` acumulado del loop, al reanudar tras una pausa larga se evaporaría todo el tiempo restante de golpe. Mitigación: el reloj solo avanza con el `delta` de frames efectivamente ejecutados; `pause()` detiene el `rAF`, y al reanudar se descarta el primer `delta` (que abarcaría toda la pausa).
- **Deadlocks no detectados + `R` desconocido para el jugador** — un bloqueo sutil sin detección deja al jugador quemando el reloj sin saber que su única salida es `R`. Mitigación: la ayuda de controles del juego menciona `R` y su coste, y la barra de tiempo hace evidente el desgaste.
- **Aleatoriedad sin semilla compartida** — dos jugadores nunca juegan la misma secuencia de tableros, así que el leaderboard compara habilidad promedio, no la misma prueba. Mitigación: ninguna; los demás juegos del catálogo (Tetris, Rocas) tienen exactamente la misma propiedad.
- **Partidas muy cortas al principio de la curva de aprendizaje** — un jugador nuevo puede perder en 60 s sin resolver nada y no volver. Mitigación: las rondas 1–3 son de 6×6 con una sola caja, resolubles en pocos segundos, precisamente para que el reloj se recargue antes del primer apuro.
