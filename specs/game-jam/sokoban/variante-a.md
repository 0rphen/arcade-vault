# SPEC — SOKOBAN jugable + leaderboard (variante A — campaña clásica de 12 niveles, undo y presupuesto de movimientos)

> **Estado:** Candidata (game jam)
> **Depende de:** 06-leaderboard-catalogo-supabase
> **Fecha:** 2026-08-17
> **Objetivo:** Crear el motor de Sokoban clásico en `components/games/sokoban/`, con 12 niveles fijos encadenados, undo ilimitado y presupuesto de movimientos por nivel (3 vidas), integrarlo en `GamePlayer` vía el registry y dar de alta su fila de catálogo y su leaderboard real en Supabase.

## Alcance

**Dentro del alcance:**

- **Motor del juego** (`components/games/sokoban/engine.ts`) — Sokoban clásico por turnos: el jugador se mueve celda a celda por las 4 direcciones; si la celda destino tiene una caja y la celda siguiente en esa dirección está libre (ni muro ni otra caja), la caja se empuja; en cualquier otro caso el movimiento se descarta y no consume presupuesto. El nivel se completa cuando todas las cajas están sobre casillas objetivo. Resolución lógica fija 640×640; el tamaño de celda se deriva **del nivel** (`cell = min(64, floor(640 / max(cols, rows)))`, tablero centrado), nunca del tamaño de ventana.
  - **12 niveles fijos** definidos en `components/games/sokoban/levels.ts` en notación XSB (`#` muro, ` ` suelo, `.` objetivo, `$` caja, `*` caja sobre objetivo, `@` jugador, `+` jugador sobre objetivo), diseñados a mano para este spec con dificultad creciente: 1–3 de introducción (1–2 cajas, 6×6 a 8×7), 4–8 intermedios (3 cajas, hasta 10×9), 9–12 avanzados (4–5 cajas, hasta 12×10, con pasillos que exigen orden de empuje).
  - **Undo ilimitado** (`Z`) — pila de estados; cada undo restaura posición del jugador, posición de todas las cajas y el contador de movimientos, y **cuesta puntos** (no devuelve los puntos ya restados).
  - **Reinicio de nivel** (`R`) — vuelve al estado inicial del nivel, vacía la pila de undo, cuesta puntos, **no** consume vida.
  - **Presupuesto de movimientos por nivel** = `par * 3` (siendo `par` el número de movimientos de la solución de referencia, guardado junto a cada nivel). Al agotarlo, el nivel se reinicia automáticamente y se pierde una vida (3 vidas iniciales).
  - **Derrota:** perder las 3 vidas → `onGameOver(score acumulado)`.
  - **Victoria:** completar el nivel 12 → estado `win` y `onGameOver(score acumulado + bonus final)`.
- **Wrapper de React** (`components/games/sokoban/sokoban-canvas.tsx`) — client component que monta el motor en un `<canvas width={640} height={640}>` vía `useEffect`/`ref`, escala por CSS dentro de `.crt-screen`, expone:
  - Callbacks `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver` (solo al cambiar el valor, nunca por frame).
  - Prop `paused: boolean`.
  - Cleanup en desmontaje: cancela `requestAnimationFrame` y remueve los listeners `keydown`/`keyup` registrados por el motor.
- **Registro en `components/games/registry.ts`** — entrada `sokoban` → `dynamic(() => import(".../sokoban-canvas"), { ssr: false })`. El registry ya existe (creado en spec 07), no hace falta paso 0.
- **Integración en `GamePlayer`** (`components/game-player.tsx`) — consulta el registry por `game.id`; conecta `score`, `lives` y `level` al HUD (mismas casillas que ya usa `arkanoid`, sin cambios estructurales); en `onGameOver` dispara `saveScoreAction`.
- **Controles (teclado)** — `←` `→` `↑` `↓` mover/empujar, `Z` deshacer, `R` reiniciar nivel; todos con `preventDefault` mientras el canvas está montado. Un movimiento por evento `keydown`, con cooldown de 90 ms para que el auto-repeat del sistema operativo dé un desplazamiento continuo controlable y no un salto instantáneo de 10 celdas.
- **Controles táctiles (spec 10 / gamepad MK-II spec 11)** — entrada nueva en `TOUCH_CONTROLS_CONFIG` (`components/games/touch-controls-config.ts`), sin tocar `touch-controls.tsx` ni el `engine.ts`:
  ```ts
  sokoban: {
    dpad: { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" },
    buttons: {
      a: { code: "KeyZ", label: "Deshacer" },
      b: { code: "KeyR", label: "Reiniciar nivel" },
    },
  }
  ```
  El motor escucha `code` (`ArrowUp`, `KeyZ`, `KeyR`), que es exactamente lo que despacha el bloque táctil como `KeyboardEvent` sintético.
- **Catálogo (`games`)** — fila **nueva** vía `mcp__supabase__apply_migration` (`insert`; el id `sokoban` no existe hoy en la tabla — verificado 2026-08-17): `cat = 'PUZZLE'`, `color = 'yellow'`, `cover = 'cover-sokoban'`, `plays = '0'`.
- **Leaderboard real** — agregar `"sokoban"` a `GAMES_WITH_REAL_SCORES` en `lib/actions/scores.ts`. El resto de la capa de queries/acciones ya es genérica.
- **Portada** — clase nueva `.cover-sokoban` en `app/globals.css` (caja amarilla con marca de aspas sobre una casilla objetivo en una grilla oscura), diseñada con `/frontend-design` durante `/spec-impl`. No se reutiliza ninguna portada existente: ninguna representa cajas sobre una grilla.

**Fuera de alcance (diferido):**

- **Sonido** — diferido.
- **Generación procedural de niveles** — esta variante es de niveles fijos y curados; la generación en caliente es el eje de la variante B.
- **Selector de nivel / continuar desde donde se quedó** — la partida siempre arranca en el nivel 1. Un selector partiría el leaderboard en ligas incomparables.
- **Detección automática de deadlocks (caja en esquina irrecuperable)** — deliberadamente no se detecta: con undo ilimitado el jugador siempre puede salir solo; el presupuesto de movimientos es la única red de seguridad.
- **Animación de interpolación del movimiento** — el jugador y las cajas saltan de celda a celda (movimiento discreto), sin tween; el loop solo redibuja.
- **Contador de empujes separado del de movimientos en el HUD** — ambos se llevan internamente, pero el HUD compartido solo muestra puntuación/vidas/nivel.

## Modelo de datos

```ts
// components/games/sokoban/engine.ts
export interface SokobanCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
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
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

Definición de niveles (`components/games/sokoban/levels.ts`, exportado y tipado, sin efectos de import):

```ts
export interface SokobanLevel {
  /** Filas en notación XSB. Todas las filas se rellenan a la misma longitud al parsear. */
  rows: string[];
  /** Movimientos de la solución de referencia; base del presupuesto y del bonus de eficiencia. */
  par: number;
}

export const LEVELS: SokobanLevel[] = [
  {
    // Nivel 1 — una caja, empuje recto
    rows: ["######", "#    #", "# $ .#", "#  @ #", "#    #", "######"],
    par: 4,
  },
  {
    // Nivel 2 — dos cajas, hay que elegir el orden
    rows: ["#######", "#  .  #", "# $$  #", "#  @  #", "#  .  #", "#######"],
    par: 12,
  },
  {
    // Nivel 3 — primer pasillo: empujar de espaldas no se puede deshacer sin Z
    rows: [
      "########",
      "#      #",
      "# #### #",
      "# $  . #",
      "# @ #  #",
      "#      #",
      "########",
    ],
    par: 14,
  },
  // ...niveles 4–12 en el mismo formato (3 cajas hasta 10×9, luego 4–5 cajas hasta 12×10)
];
```

Estructuras internas del motor (detalle de implementación, no se exportan):

```ts
type Tile = "wall" | "floor" | "goal";

interface Vec {
  x: number;
  y: number;
}

/** Snapshot mínimo para la pila de undo: solo lo que cambia dentro de un nivel. */
interface Snapshot {
  player: Vec;
  boxes: Vec[];
  moves: number;
}
```

Constantes de balance (`engine.ts`):

```ts
const CANVAS_W = 640;
const CANVAS_H = 640;
const MAX_CELL = 64; // px; cell = min(MAX_CELL, floor(640 / max(cols, rows)))

const START_LIVES = 3;
const MOVE_BUDGET_FACTOR = 3; // presupuesto del nivel = par * 3

const PUSH_POINTS = 5; // por empuje válido de una caja
const BOX_ON_GOAL_POINTS = 100; // al dejar una caja sobre objetivo (se resta al sacarla)
const LEVEL_CLEAR_BASE = 500; // bonus fijo por nivel completado
const LEVEL_CLEAR_STEP = 250; // + LEVEL_CLEAR_STEP * (nivel - 1)
const EFFICIENCY_POINTS_PER_MOVE = 10; // por movimiento ahorrado bajo par * 2
const UNDO_COST = 25;
const RESTART_COST = 150;
const CAMPAIGN_BONUS = 5000; // al completar el nivel 12
```

Puntuación de un nivel completado:

```
score += LEVEL_CLEAR_BASE + LEVEL_CLEAR_STEP * (level - 1)
       + max(0, par * 2 - moves) * EFFICIENCY_POINTS_PER_MOVE
```

El score global nunca baja de 0 (los costes de undo/reinicio se aplican con `Math.max(0, ...)`).

Fila de catálogo (`games`, `insert` — el id es nuevo, no hay fila previa que renombrar):

```sql
insert into games (id, title, short, long, cat, cover, color, plays)
values (
  'sokoban',
  'SOKOBAN',
  'Empuja cada caja hasta su casilla. Sin marcha atrás gratis.',
  'Doce almacenes, una sola regla: las cajas solo se empujan, nunca se tiran. Planifica el orden antes de moverte, porque un empuje mal dado te encierra. Deshacer cuesta puntos y cada nivel tiene un presupuesto de movimientos: agótalo tres veces y se acabó el turno.',
  'PUZZLE',
  'cover-sokoban',
  'yellow',
  '0'
);
```

## Plan de implementación

1. **Crear `components/games/sokoban/levels.ts`** — interfaz `SokobanLevel` y el array `LEVELS` con los 12 niveles en notación XSB más su `par`. Los tres primeros son los del bloque de arriba; los 9 restantes se diseñan durante `/spec-impl` respetando la curva descrita (3 cajas hasta el 8, 4–5 cajas del 9 al 12) y se validan a mano jugándolos una vez cada uno para confirmar que el `par` anotado es alcanzable. Verificable: compila con `tsc`, sin efectos de import, todas las filas de un nivel tienen la misma longitud tras el padding del parser.

2. **Crear `components/games/sokoban/engine.ts`** — estado encapsulado en `createSokobanEngine(canvas, callbacks)`, sin globals de módulo:
   - `parseLevel(level)` — convierte `rows` en `tiles: Tile[][]`, `boxes: Vec[]`, `player: Vec`, y calcula `cols`/`rows`/`cell`/`offsetX`/`offsetY` para centrar el tablero en el canvas de 640×640.
   - `tryMove(dir)` — celda destino: si es muro → movimiento inválido (no cuenta, no consume presupuesto). Si tiene caja: mirar la celda siguiente; si es muro **o** tiene otra caja → inválido (nunca se empujan dos cajas a la vez). Si es válido: `pushSnapshot()`, mover jugador (y caja si aplica), `moves++`, aplicar `PUSH_POINTS`/`BOX_ON_GOAL_POINTS` (y su resta simétrica al sacar una caja de un objetivo), comprobar `isLevelClear()` y luego el presupuesto.
   - `undo()` — saca el último `Snapshot` de la pila y lo restaura; resta `UNDO_COST`. Con pila vacía es un no-op silencioso (no cobra).
   - `restart()` — restaura el estado inicial parseado del nivel, vacía la pila, resta `RESTART_COST`, **no** toca vidas.
   - `isLevelClear()` — todas las cajas sobre casillas `goal`. Al cumplirse: suma el bonus del nivel, avanza (`onLevelChange`) o, si era el 12, suma `CAMPAIGN_BONUS` y entra en `win` → `onGameOver`.
   - Presupuesto: si `moves >= par * MOVE_BUDGET_FACTOR` y el nivel no está resuelto → `lives--` (`onLivesChange`), reinicio automático del nivel sin cobrar `RESTART_COST`; con `lives === 0` → `onGameOver`.
   - Loop de dibujo con `requestAnimationFrame`: fondo, grilla, muros, objetivos (rombo hueco), cajas (cuadro amarillo con aspas; verde relleno cuando está sobre objetivo), jugador, y un panel de texto dentro del canvas con `MOV n/​N` (movimientos/presupuesto) y `NIVEL n/12`. En pausa el loop se detiene y el input se ignora.
   - Listeners: un único `keydown` en `window` con `preventDefault` sobre `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`/`KeyZ`/`KeyR`, más `keyup` para resetear el cooldown de auto-repeat. `destroy()` idempotente cancela el `rAF` y remueve ambos listeners.
   - Callbacks `onScoreChange`/`onLivesChange`/`onLevelChange` solo al cambiar el valor.
   - Verificable de forma aislada: compila con `tsc` sin `any`, sin efectos de import.

3. **Crear `components/games/sokoban/sokoban-canvas.tsx`** — client component con `<canvas width={640} height={640}>` y `style={{ width: "100%", height: "100%", display: "block" }}`. `useEffect` sin dependencias para montar/destruir el engine + `useEffect` de sincronización de `paused`.

4. **Agregar entrada en `components/games/registry.ts`** — `sokoban: { Canvas: dynamic(() => import("@/components/games/sokoban/sokoban-canvas"), { ssr: false }) }`.

5. **HUD en `components/game-player.tsx`** — para `sokoban` se muestran "Puntuación", "Vidas" y "Nivel" (las tres casillas que ya usa `arkanoid`); no hay condicional nueva que agregar salvo confirmar que "Líneas" sigue oculta.

6. **Agregar entrada en `components/games/touch-controls-config.ts`** — el bloque `sokoban` descrito en el Alcance (D-pad completo + botón A `KeyZ` + botón B `KeyR`). Sin cambios en `touch-controls.tsx` ni en el `engine.ts`.

7. **Migración Supabase (`mcp__supabase__apply_migration`)** — `insert into games (...)` con la fila de arriba. Verificable con `select * from games where id = 'sokoban'`.

8. **`lib/actions/scores.ts`** — agregar `"sokoban"` a `GAMES_WITH_REAL_SCORES`.

9. **Portada** — diseñar `.cover-sokoban` en `app/globals.css` con `/frontend-design`: grilla oscura, dos cajas amarillas con aspas y una casilla objetivo marcada.

10. **Verificación manual en navegador** — `npm run dev`, `/games/sokoban/jugar`: las flechas mueven al jugador celda a celda; empujar contra un muro o contra dos cajas en fila no mueve nada ni gasta movimientos; `Z` deshace el último movimiento (incluida la caja) y resta puntos; `R` reinicia el nivel; agotar el presupuesto reinicia el nivel y baja una vida en el HUD; completar todas las casillas objetivo pasa al nivel siguiente (HUD "Nivel"); perder las 3 vidas o terminar el nivel 12 abre el modal con el score real; "GUARDAR PUNTUACIÓN" inserta en `scores` (visible en `/games/sokoban` y `/salon` tras refrescar). Probar también en emulación táctil de DevTools (`pointer: coarse`): D-pad de 4 direcciones y botones A/B funcionando. Confirmar que ningún otro juego cambia de comportamiento.

11. **`npm run build`** — compila sin errores de tipos ni de lint.

## Criterios de aceptación

Base (heredados, no omitir):

- [ ] `components/games/sokoban/engine.ts` existe, exporta `createSokobanEngine`, sin `any`, sin acceder al DOM fuera de las funciones del engine.
- [ ] `components/games/sokoban/sokoban-canvas.tsx` existe, monta el canvas en `useEffect` y lo destruye (cancela loop, remueve listeners de teclado) al desmontar.
- [ ] El HUD de React refleja en vivo `score`, `lives` y `level` reales del motor.
- [ ] El botón "PAUSA" congela el canvas (loop detenido, teclas ignoradas) y "REANUDAR" lo continúa exactamente donde quedó.
- [ ] Al perder las 3 vidas o completar el nivel 12, se abre automáticamente el modal de fin de partida con la puntuación final real, y "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` (visible en `/games/sokoban` y `/salon` tras refrescar).
- [ ] El canvas escala visualmente al tamaño de `.crt-screen` sin deformarse en al menos dos anchos de ventana distintos.
- [ ] El juego aparece en el grid de `/games` con datos reales de Supabase (`games`), categoría PUZZLE.
- [ ] Ningún otro juego del catálogo cambia de comportamiento.
- [ ] `npm run build` compila sin errores de tipos ni de lint.

Específicos de este juego:

- [ ] Las cajas solo se empujan (nunca se tiran) y nunca se empujan dos cajas en la misma dirección a la vez.
- [ ] Un movimiento bloqueado (muro, dos cajas en fila, caja contra muro) no mueve al jugador ni incrementa el contador de movimientos ni consume presupuesto.
- [ ] `Z` deshace el último movimiento restaurando jugador, cajas y contador de movimientos, cuesta 25 puntos, y con la pila vacía no hace nada ni cobra.
- [ ] `R` reinicia el nivel al estado inicial, vacía la pila de undo, cuesta 150 puntos y **no** consume vida.
- [ ] Agotar el presupuesto (`par * 3` movimientos) reinicia el nivel automáticamente y descuenta una vida, sin cobrar el coste de reinicio manual.
- [ ] Colocar todas las cajas sobre objetivos carga el nivel siguiente automáticamente y suma el bonus de nivel más el bonus de eficiencia (`max(0, par*2 - moves) * 10`).
- [ ] El score global nunca queda negativo (los costes se aplican con piso en 0).
- [ ] Los 12 niveles se cargan desde `levels.ts` en notación XSB y cada uno se centra en el canvas de 640×640 con su propio tamaño de celda derivado del nivel, no del viewport.
- [ ] El auto-repeat del teclado produce desplazamiento continuo a ritmo controlado (cooldown de 90 ms), no un salto instantáneo de varias celdas.
- [ ] La entrada `sokoban` de `TOUCH_CONTROLS_CONFIG` existe y, en emulación táctil, el D-pad mueve y los botones A/B deshacen y reinician.

## Decisiones tomadas y descartadas

- **Campaña de 12 niveles fijos y curados — diferencia central con la variante B** — se descartó la generación procedural porque el Sokoban bueno vive del diseño intencionado: un nivel generado al azar rara vez tiene ese "ajá" de orden de empujes. Quien quiera el puzzle de verdad, con niveles que se pueden aprender y re-optimizar, elige esta variante; quien quiera partidas cortas e infinitas con presión de reloj, elige la B.
- **Undo ilimitado (con coste en puntos) en vez de undo limitado o inexistente** — se descartó quitar el undo porque sin él un empuje a una esquina obliga a un reinicio completo, y eso convierte un juego de planificación en uno de memoria de intentos. El coste de 25 puntos preserva la tensión: deshacer es siempre posible, nunca gratis.
- **Presupuesto de movimientos (`par * 3`) + 3 vidas como condición de derrota** — el Sokoban clásico no tiene game over, pero el contrato de la plataforma exige uno claro para disparar `onGameOver` y guardar en `scores`. Se descartó un cronómetro global (arruinaría el ritmo contemplativo del género, y es justamente lo que hace la variante B) y se descartó "fin de partida solo al completar el nivel 12" (dejaría partidas eternas sin cierre para quien se atasca).
- **El reinicio manual (`R`) cuesta puntos pero no vida; el reinicio por presupuesto agotado cuesta vida pero no puntos** — se descartó cobrar ambas cosas en los dos casos porque castigaría dos veces el mismo error; así el jugador tiene una salida barata en vidas (reiniciar a tiempo) y una cara (dejar que se agote el presupuesto).
- **Bonus de eficiencia sobre `par * 2`, no sobre `par`** — se descartó exigir la solución óptima para puntuar porque casi nadie la encuentra a la primera y el bonus quedaría siempre en 0; con el doble del par como umbral, jugar bien (aunque no perfecto) se nota en el score.
- **Sin detección de deadlocks** — se descartó marcar automáticamente las posiciones irrecuperables (caja en esquina) porque con undo ilimitado el jugador tiene la herramienta para salir, y avisarle le quitaría la parte de aprender a leer el tablero. La variante B sí los detecta, porque allí no hay undo.
- **Movimiento discreto sin animación de interpolación** — se descartó el tween entre celdas: agrega estado de animación que hay que sincronizar con la pausa y con el undo (¿qué pasa si se deshace a mitad de una animación?), sin aportar a la mecánica.
- **Un movimiento por `keydown` con cooldown de 90 ms** — se descartó ignorar el auto-repeat por completo (obligaría a martillar la tecla en pasillos largos) y también procesarlo sin cooldown (el jugador cruzaría media sala de un tirón y perdería el control del empuje).
- **Niveles en notación XSB (`#$.*@+`) en un archivo `levels.ts` aparte** — se descartó codificar los tableros como matrices de enteros porque XSB es legible a simple vista en el diff, es el formato estándar del género y permite pegar/adaptar niveles rápidamente durante `/spec-impl`.
- **Tamaño de celda derivado del nivel (`min(64, 640/max(cols,rows))`), canvas 640×640 constante** — se descartó recalcularlo según el viewport: rompería la regla de resolución lógica fija de `reference.md`. Depender solo de los datos del nivel mantiene el render determinista.
- **HUD con vidas y nivel (mismas casillas que Arkanoid)** — se descartó agregar una casilla nueva de "Movimientos" al HUD compartido: obligaría a un callback más (`onMovesChange`) disparándose en cada tecla para todos los juegos; el contador de movimientos y el presupuesto se dibujan dentro del canvas.
- **Portada nueva `.cover-sokoban`** — se descartó reutilizar `.cover-tetro` (la otra PUZZLE) porque su motivo son piezas cayendo, no cajas sobre una grilla.

## Riesgos identificados

Reutilizados de spec 05 (aplican igual aquí):

- **Scroll de página por teclas capturadas** — mitigación: `preventDefault()` en `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`/`KeyZ`/`KeyR` mientras el canvas está montado.
- **Doble montaje en desarrollo (`StrictMode`)** — mitigación: `destroy()` idempotente, verificado explícitamente en dev (dos listeners duplicarían cada movimiento, moviendo al jugador dos celdas por tecla).
- **Listeners de teclado globales entre navegaciones** — mitigación: `destroy()` remueve `keydown`/`keyup` al salir.
- **Callbacks disparando renders excesivos** — mitigación: comparar contra el valor previo antes de invocar `onScoreChange`/`onLivesChange`/`onLevelChange`.

Propios de este juego:

- **Niveles mal diseñados o con `par` mal anotado** — es el riesgo principal de coste de esta variante: un `par` demasiado bajo hace el presupuesto imposible y regala derrotas; uno demasiado alto anula la tensión y el bonus de eficiencia. Mitigación: jugar y cronometrar cada uno de los 12 niveles a mano durante `/spec-impl`, anotando el `par` real obtenido, no uno estimado.
- **Nivel irresoluble por error de transcripción XSB** — falta un muro, sobra una caja, hay más cajas que objetivos. Mitigación: el parser valida al cargar que `nº de cajas === nº de objetivos` y que existe exactamente un jugador; si falla, lanza en tiempo de carga durante el desarrollo en vez de dejar un nivel jugable-pero-imposible en producción.
- **Filas XSB de longitud desigual** — es habitual escribirlas recortando espacios finales; sin padding, el índice de columna se desalinea y aparecen muros donde no los hay. Mitigación: el parser rellena todas las filas a la longitud máxima con muro, no con suelo (evita "fugas" fuera del almacén).
- **Deadlock temprano en un nivel con presupuesto ajustado** — un jugador novato puede encerrar una caja en el movimiento 3 y luego gastar el presupuesto entero dando vueltas sin entender que ya perdió. Mitigación parcial: el contador `MOV n/N` dibujado en el canvas hace visible que el presupuesto se agota; la salida correcta (`Z` o `R`) está en la pantalla de controles del juego.
- **Pila de undo creciendo sin límite en una partida larga** — cada `Snapshot` guarda un array de cajas; miles de movimientos en 12 niveles son irrelevantes en memoria (decenas de KB), pero la pila debe vaciarse al cambiar de nivel y al reiniciar. Mitigación: `resetLevel()` limpia la pila explícitamente; se verifica que no se pueda deshacer "hacia atrás" a un nivel ya completado.
- **Partida potencialmente larga sin cierre** — un jugador atascado en el nivel 9 puede pasar mucho tiempo antes de perder las 3 vidas. Mitigación: ninguna en este spec; el presupuesto de movimientos acota cada intento y el botón "FIN" del HUD sigue disponible (existe la variante B, de rondas cortas, para el perfil opuesto).
- **Bonus de eficiencia dependiente de datos anotados a mano** — a diferencia de un cálculo derivado del estado, `par` es un número escrito por una persona; si se retoca un nivel más adelante y no se actualiza el `par`, tanto el presupuesto como el bonus quedan mal en silencio. Mitigación: mantener `par` y `rows` juntos en la misma entrada de `LEVELS`, nunca en tablas separadas.
