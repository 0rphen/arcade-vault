# SPEC — BUSCAMINAS jugable + leaderboard (variante A — clásico fiel, mouse, 3 dificultades encadenadas)

> **Estado:** Candidata (game jam)
> **Depende de:** 06-leaderboard-catalogo-supabase
> **Fecha:** 2026-08-11
> **Objetivo:** Crear el motor de Buscaminas clásico en `components/games/buscaminas/`, controlado con mouse (click izquierdo revela, click derecho bandera), con tres tableros de dificultad creciente encadenados en una sola partida, integrarlo en `GamePlayer` vía el registry y dar de alta su fila de catálogo y su leaderboard real en Supabase.

## Alcance

**Dentro del alcance:**

- **Motor del juego** (`components/games/buscaminas/engine.ts`) — Buscaminas clásico: tablero de celdas ocultas con minas repartidas al azar, número de minas adyacentes (0–8), revelado en cascada (flood fill) de las celdas con 0 adyacentes, banderas, primera celda siempre segura (las minas se reparten **después** del primer click, excluyendo la celda pulsada y sus 8 vecinas). Resolución lógica fija 640×640; el tamaño de celda cambia por nivel según una tabla de constantes fija, nunca en función del tamaño de ventana.
  - **Nivel 1 (Principiante)** — 9×9, 10 minas, celda 64px (tablero 576×576, centrado).
  - **Nivel 2 (Intermedio)** — 16×16, 40 minas, celda 40px (tablero 640×640).
  - **Nivel 3 (Experto)** — 30×16, 99 minas, celda 21px (tablero 630×336, centrado verticalmente).
  - Al despejar un nivel, se carga automáticamente el siguiente. Al despejar el nivel 3, la partida entra en estado `win` y dispara `onGameOver` con el score acumulado.
  - **Derrota:** revelar una celda con mina termina la partida de inmediato (se dibujan todas las minas y se marca en rojo la detonada) y dispara `onGameOver` con el score acumulado hasta ese momento.
- **Wrapper de React** (`components/games/buscaminas/buscaminas-canvas.tsx`) — client component que monta el motor en un `<canvas width={640} height={640}>` vía `useEffect`/`ref`, escala por CSS dentro de `.crt-screen`, expone:
  - Callbacks `onScoreChange`, `onLevelChange`, `onGameOver` (solo al cambiar el valor, nunca por frame).
  - Prop `paused: boolean`.
  - Cleanup en desmontaje: cancela `requestAnimationFrame` y remueve los listeners de `mousedown`, `contextmenu` y `keydown` registrados por el motor.
- **Registro en `components/games/registry.ts`** — entrada `buscaminas` → `dynamic(() => import(".../buscaminas-canvas"), { ssr: false })`. El registry ya existe (creado en spec 07), no hace falta paso 0.
- **Integración en `GamePlayer`** (`components/game-player.tsx`) — consulta el registry por `game.id`; conecta `score` y `level` al HUD; oculta la casilla "Vidas" para `buscaminas` (mismo patrón condicional ya usado para "Líneas" en `caida` y para ocultar vidas/nivel en `snake`); en `onGameOver` dispara `saveScoreAction`.
- **Controles** — mouse sobre el canvas: **click izquierdo** revela la celda bajo el cursor, **click derecho** alterna bandera (con `preventDefault` en `contextmenu` para que no aparezca el menú del navegador dentro del `.crt`). Teclado: solo `preventDefault` defensivo, no hay acción ligada a teclas.
- **Cronómetro interno** — el motor lleva un contador de segundos por nivel, dibujado dentro del canvas (esquina superior del tablero) y usado para el bonus de tiempo. No se expone al HUD de React (no hay casilla de tiempo en el HUD compartido).
- **Catálogo (`games`)** — fila **nueva** vía `mcp__supabase__apply_migration` (`insert`, el id `buscaminas` no existe hoy): `cat = 'PUZZLE'`, `color = 'cyan'`, `cover = 'cover-buscaminas'`, `plays = '0'`.
- **Leaderboard real** — agregar `"buscaminas"` a `GAMES_WITH_REAL_SCORES` en `lib/actions/scores.ts`. El resto de la capa de queries/acciones ya es genérica.
- **Portada** — clase nueva `.cover-buscaminas` en `app/globals.css` (grilla de celdas con una bandera cian), diseñada con `/frontend-design` durante `/spec-impl`. No se reutiliza portada existente porque ninguna representa una grilla de casillas.

**Fuera de alcance (diferido):**

- **Controles táctiles/mobile** — diferido; el juego depende de click derecho, que no tiene equivalente directo en touch (requeriría long-press, fuera de este spec).
- **Sonido** — diferido.
- **Selector de dificultad por el jugador** — no hay menú: la partida siempre arranca en nivel 1 y encadena. Un selector rompería la comparabilidad del leaderboard (todos deben jugar la misma secuencia).
- **Modo cronometrado / récord de tiempo puro** — el leaderboard de la plataforma es de score, no de tiempo; el tiempo entra solo como bonus.
- **Revelado acorde (chord / click doble sobre número satisfecho)** — diferido a una iteración futura; en este spec un click solo afecta a la celda pulsada.

## Modelo de datos

```ts
// components/games/buscaminas/engine.ts
export interface BuscaminasCallbacks {
  onScoreChange: (score: number) => void;
  onLevelChange: (level: number) => void;
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
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

Estructuras internas del motor (detalle de implementación, no se exportan):

```ts
interface Cell {
  mine: boolean;
  adjacent: number; // 0..8
  revealed: boolean;
  flagged: boolean;
}

interface LevelConfig {
  cols: number;
  rows: number;
  mines: number;
  cell: number; // px
}
```

Constantes de balance (`engine.ts`):

```ts
const CANVAS_W = 640;
const CANVAS_H = 640;

const LEVELS: LevelConfig[] = [
  { cols: 9, rows: 9, mines: 10, cell: 64 },
  { cols: 16, rows: 16, mines: 40, cell: 40 },
  { cols: 30, rows: 16, mines: 99, cell: 21 },
];

const POINTS_PER_REVEALED_CELL = 5; // por celda destapada (incluye las de la cascada)
const LEVEL_CLEAR_BONUS = [500, 1500, 4000]; // bonus fijo por despejar cada nivel
const TIME_BONUS_BASE = [200, 400, 900]; // segundos "regalados" por nivel
const TIME_BONUS_PER_SECOND = 5; // bonus = max(0, TIME_BONUS_BASE[n] - segundos) * 5
const FLAG_PENALTY = 0; // marcar/desmarcar no cuesta puntos
```

Fila de catálogo (`games`, `insert` — el id es nuevo, no hay fila previa que renombrar):

```sql
insert into games (id, title, short, long, cat, cover, color, plays)
values (
  'buscaminas',
  'BUSCAMINAS',
  'Deduce dónde están las minas antes de pisar una.',
  'El clásico campo minado, en tres tableros encadenados: 9x9, 16x16 y 30x16. Los números dicen cuántas minas te rodean; el resto es lógica pura y nervio. Un solo click equivocado termina la partida.',
  'PUZZLE',
  'cover-buscaminas',
  'cyan',
  '0'
);
```

## Plan de implementación

1. **Crear `components/games/buscaminas/engine.ts`** — estado encapsulado en `createBuscaminasEngine(canvas, callbacks)`, sin globals de módulo:
   - `board: Cell[][]` generado vacío al entrar a cada nivel; las minas se reparten en el primer click del nivel (`placeMines(safeCol, safeRow)` excluye la celda pulsada y sus 8 vecinas, garantiza que el primer click nunca detona y suele abrir una cascada).
   - `computeAdjacency()` rellena `adjacent` de cada celda tras repartir minas.
   - `reveal(col, row)` — ignora celdas con bandera o ya reveladas; si la celda tiene mina → `explode()`; si `adjacent === 0` → cascada iterativa con pila explícita (no recursión, para no reventar el stack en 30×16), sumando `POINTS_PER_REVEALED_CELL` por cada celda destapada.
   - `toggleFlag(col, row)` — solo sobre celdas no reveladas.
   - `isLevelClear()` — todas las celdas sin mina reveladas. Al cumplirse: suma `LEVEL_CLEAR_BONUS[n]` + bonus de tiempo, avanza de nivel (`onLevelChange`) o entra en `win`.
   - Loop de dibujo con `requestAnimationFrame` (el juego no simula física, pero el loop mantiene vivo el cronómetro, el hover de celda y la animación de fin de partida).
   - Listeners: `mousedown` sobre el canvas (traduciendo coordenadas de cliente a celda con `getBoundingClientRect()` y el factor de escala CSS del canvas), `contextmenu` con `preventDefault`. `destroy()` idempotente cancela el `rAF` y remueve los tres listeners.
   - Callbacks `onScoreChange`/`onLevelChange` solo al cambiar el valor.
   - Verificable de forma aislada: compila con `tsc` sin `any`, sin efectos de import.

2. **Crear `components/games/buscaminas/buscaminas-canvas.tsx`** — client component con `<canvas width={640} height={640}>` y `style={{ width: "100%", height: "100%", display: "block" }}`. `useEffect` sin dependencias para montar/destruir el engine + `useEffect` de sincronización de `paused`.

3. **Agregar entrada en `components/games/registry.ts`** — `buscaminas: { Canvas: dynamic(() => import("@/components/games/buscaminas/buscaminas-canvas"), { ssr: false }) }`.

4. **Ajustar HUD en `components/game-player.tsx`** — para `buscaminas` se muestran "Puntuación" y "Nivel"; se oculta "Vidas" (misma condicional que ya se usa para `snake`). Sin cambios en el resto del HUD.

5. **Migración Supabase (`mcp__supabase__apply_migration`)** — `insert into games (...)` con la fila de arriba. Verificable con `select * from games where id = 'buscaminas'`.

6. **`lib/actions/scores.ts`** — agregar `"buscaminas"` a `GAMES_WITH_REAL_SCORES`.

7. **Portada** — diseñar `.cover-buscaminas` en `app/globals.css` con `/frontend-design`: grilla de celdas en relieve sobre fondo oscuro, una bandera cian y un número "3" en la celda central.

8. **Verificación manual en navegador** — `npm run dev`, `/games/buscaminas/jugar`: el primer click nunca detona y abre una cascada; click derecho pone/quita bandera sin abrir el menú contextual; despejar el 9×9 pasa automáticamente al 16×16 y luego al 30×16 (HUD "Nivel" 1→2→3); pisar una mina abre el modal con el score real; "GUARDAR PUNTUACIÓN" inserta en `scores` (visible en `/games/buscaminas` y `/salon` tras refrescar). Verificar que los clicks aciertan la celda correcta con la ventana a dos anchos distintos (escala CSS). Confirmar que ningún otro juego cambia de comportamiento.

9. **`npm run build`** — compila sin errores de tipos ni de lint.

## Criterios de aceptación

Base (heredados, no omitir):

- [ ] `components/games/buscaminas/engine.ts` existe, exporta `createBuscaminasEngine`, sin `any`, sin acceder al DOM fuera de las funciones del engine.
- [ ] `components/games/buscaminas/buscaminas-canvas.tsx` existe, monta el canvas en `useEffect` y lo destruye (cancela loop, remueve listeners de mouse/teclado) al desmontar.
- [ ] El HUD de React refleja en vivo `score` y `level` reales del motor; la casilla "Vidas" no se muestra para Buscaminas.
- [ ] El botón "PAUSA" congela el canvas (loop y cronómetro detenidos, clicks ignorados) y "REANUDAR" lo continúa exactamente donde quedó.
- [ ] Al pisar una mina o completar el nivel 3, se abre automáticamente el modal de fin de partida con la puntuación final real, y "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` (visible en `/games/buscaminas` y `/salon` tras refrescar).
- [ ] El canvas escala visualmente al tamaño de `.crt-screen` sin deformarse en al menos dos anchos de ventana distintos.
- [ ] El juego aparece en el grid de `/games` con datos reales de Supabase (`games`), categoría PUZZLE.
- [ ] Ningún otro juego del catálogo cambia de comportamiento.
- [ ] `npm run build` compila sin errores de tipos ni de lint.

Específicos de este juego:

- [ ] El primer click de cada nivel nunca detona una mina (las minas se reparten después, excluyendo la celda pulsada y sus 8 vecinas).
- [ ] Revelar una celda con 0 minas adyacentes destapa en cascada todo el área contigua hasta el borde de números, sin desbordar el stack en el tablero 30×16.
- [ ] Click derecho alterna la bandera y **no** abre el menú contextual del navegador; una celda con bandera no puede revelarse con click izquierdo.
- [ ] Cada celda destapada suma 5 puntos (también las abiertas por cascada); despejar un nivel suma su bonus fijo más el bonus de tiempo.
- [ ] Al despejar el nivel N se carga automáticamente el N+1 con su tamaño de celda propio, y el HUD "Nivel" cambia.
- [ ] Al detonar una mina se revelan todas las minas del tablero y la detonada se dibuja destacada antes de abrir el modal.
- [ ] Los clicks aciertan la celda correcta cuando el canvas está escalado por CSS (coordenadas traducidas con `getBoundingClientRect()`).

## Decisiones tomadas y descartadas

- **Control por mouse (click izq/der) — diferencia central con la variante B** — se descartó el cursor por teclado porque el Buscaminas real _es_ un juego de mouse y el objetivo de esta variante es fidelidad: quien busque la sensación exacta del clásico de escritorio elige esta. La variante B, en cambio, es 100% teclado. La contrapartida asumida aquí: dependencia de click derecho (incómodo en trackpads, imposible en touch) y necesidad de traducir coordenadas con la escala CSS del canvas.
- **Tres dificultades encadenadas en una sola partida, sin selector** — se descartó un menú de dificultad porque partiría el leaderboard en tres ligas incomparables dentro de una sola fila de `games`. Encadenar 9×9 → 16×16 → 30×16 da una curva y un score único comparable.
- **Un error = fin de partida (sin vidas)** — es la regla del clásico y la fuente de toda su tensión. La variante B relaja esto con 3 vidas; se descartó aquí a propósito.
- **Primer click siempre seguro** — se descartó repartir minas antes del primer click porque perder en el click número uno, sin información, es puro azar y arruina un leaderboard de habilidad.
- **Cronómetro dibujado dentro del canvas, no en el HUD** — se descartó agregar una casilla "Tiempo" al HUD compartido porque obligaría a un callback nuevo (`onTimeChange`) disparándose cada segundo para todos los juegos; el tiempo aquí solo alimenta el bonus.
- **Cascada iterativa con pila explícita, no recursiva** — se descartó el flood fill recursivo por el riesgo real de stack overflow en el tablero 30×16 casi vacío.
- **Tamaño de celda por nivel en tabla fija, canvas 640×640 constante** — se descartó recalcular la celda según el tamaño de ventana (rompe la regla de resolución lógica fija de `reference.md` y haría el hit-testing dependiente del viewport).
- **Sin chord (click doble sobre número satisfecho)** — se descartó para el primer spec: añade una regla de interacción más que testear sin cambiar la esencia; queda como feature futura explícita.
- **Portada nueva `.cover-buscaminas`** — se descartó reutilizar `.cover-tetro` (también PUZZLE) porque su motivo son piezas cayendo, no una grilla de casillas.

## Riesgos identificados

Reutilizados de spec 05 (aplican igual aquí):

- **Scroll de página por teclas capturadas** — mitigación: `preventDefault()` en los códigos que el juego escuche mientras el canvas está montado.
- **Doble montaje en desarrollo (`StrictMode`)** — mitigación: `destroy()` idempotente, verificado explícitamente en dev (dos loops duplicarían el cronómetro).
- **Listeners globales entre navegaciones** — mitigación: `destroy()` remueve `mousedown`, `contextmenu` y `keydown` al salir.
- **Callbacks disparando renders excesivos** — mitigación: comparar contra el valor previo antes de invocar `onScoreChange`/`onLevelChange`.

Propios de este juego:

- **Hit-testing con el canvas escalado por CSS** — el canvas se dibuja a 640×640 lógicos pero se muestra al tamaño de `.crt-screen`; si las coordenadas del click no se dividen por el factor de escala real (`rect.width / canvas.width`), los clicks aciertan la celda equivocada, y el error crece hacia los bordes. Mitigación: traducir siempre con `getBoundingClientRect()` y verificarlo explícitamente a dos anchos de ventana distintos.
- **Click derecho y menú contextual dentro del `.crt`** — sin `preventDefault` en `contextmenu`, poner una bandera abre el menú del navegador encima del juego. Mitigación: listener dedicado, removido en `destroy()`.
- **Overlay de pausa capturando clicks** — el `div.crt-content` genérico de `GamePlayer` no tiene `pointer-events: none` (problema ya documentado en spec 08 con Arkanoid); aquí es benigno (durante la pausa _queremos_ bloquear clicks), pero conviene verificar que al reanudar los clicks vuelvan a llegar al canvas.
- **Celdas de 21px en el nivel 3 sobre un CRT escalado hacia abajo** — los números de 1 dígito pueden volverse ilegibles en ventanas angostas. Mitigación: fuente bold y colores por número (esquema clásico 1=azul, 2=verde, 3=rojo...) adaptado a la paleta neón; si aun así falla, es candidato a reducir el nivel 3 a 24×14.
- **Partida potencialmente muy larga** — un experto puede tardar varios minutos en el 30×16, y el modal de score solo aparece al final. Mitigación: ninguna en este spec; se acepta como parte del género (es la razón de que exista la variante B, de rondas más cortas).
- **Aleatoriedad sin semilla** — dos jugadores nunca resuelven el mismo tablero, así que el leaderboard compara habilidad promedio, no la misma prueba. Mitigación: ninguna; los demás juegos del catálogo (Tetris, Rocas) tienen exactamente la misma propiedad.
