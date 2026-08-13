# SPEC — CRUCE NEÓN jugable + leaderboard (variante B: ascenso infinito procedural)

> **Estado:** Candidata (game jam)
> **Depende de:** 06-leaderboard-catalogo-supabase
> **Fecha:** 2026-08-11
> **Objetivo:** Crear el motor de un cruce infinito en `components/games/cruce-neon/` (bandas de tráfico y río generadas proceduralmente, cámara que asciende, una sola vida, score = distancia), integrarlo en `GamePlayer` vía el registry de juegos jugables y dar de alta su fila de catálogo y su leaderboard real en Supabase.

## Alcance

**Dentro del alcance:**

- **Motor del juego** (`components/games/cruce-neon/engine.ts`) — grilla lógica de 15 columnas de 40px (canvas 600×560, 14 filas visibles) con **mundo vertical infinito**: no hay tablero fijo ni meta, la rana asciende y el mundo se genera por delante. Sin sprites: render vectorial con formas y colores del tema neón.
  - **Generación procedural por bandas** — cada fila del mundo (`worldRow`, creciente hacia arriba) se genera una sola vez y se cachea: tipo `SAFE` (hierba), `ROAD` (carril de vehículos) o `RIVER` (carril de troncos). Se generan 8 filas por delante de la cámara y se descartan las que quedan 4 filas por debajo del borde inferior.
  - **Cámara ascendente** — sigue a la rana manteniéndola en el tercio inferior: si la rana sube por encima de `worldRow = cameraRow + 8`, la cámara interpola hacia arriba (200ms). Además hay **arrastre de corriente**: tras 3s sin avanzar, la cámara empieza a subir sola a `12 px/s` (+2 px/s cada 20 filas alcanzadas). Quedar por debajo del borde inferior del canvas = muerte.
  - **Una sola vida** — cualquier muerte (atropello, ahogo, salir por un lateral, quedar atrás de la cámara) termina la partida inmediatamente.
  - **Recolectables** — pastillas de datos que aparecen en filas `SAFE` con probabilidad 25%, en una columna libre al azar; suman puntos y son el único incentivo para desviarse lateralmente.
  - Movimiento por saltos discretos de una celda con tween de 100ms. Sobre un tronco, la rana se desplaza arrastrada. Encapsulado en `createCruceNeonEngine(canvas, callbacks)`, sin globals de módulo.
- **Wrapper de React** (`components/games/cruce-neon/cruce-neon-canvas.tsx`) — client component que monta el motor en un `<canvas width={600} height={560}>` vía `useEffect`/`ref`, escala por CSS dentro de `.crt-screen`, expone:
  - Callbacks `onScoreChange` y `onGameOver` **únicamente** (solo al cambiar el valor, nunca por frame).
  - Prop `paused: boolean`.
  - Cleanup en desmontaje: cancela `requestAnimationFrame` y remueve listeners de teclado.
- **Registro en `components/games/registry.ts`** — entrada `cruce-neon` → `dynamic(() => import(".../cruce-neon-canvas"), { ssr: false })`. El registry ya existe (creado en spec 07), no hace falta paso 0.
- **Integración en `GamePlayer`** (`components/game-player.tsx`) — consulta el registry por `game.id`; conecta `onScoreChange` al HUD y **oculta las casillas "Vidas" y "Nivel"** para este juego, mismo patrón condicional que ya usa Snake (spec 09) y que "Líneas" usa para Caída; `onGameOver` dispara `saveScoreAction`.
- **Controles** — solo flechas (`↑` `↓` `←` `→`), un salto de celda por pulsación, con `preventDefault` mientras el canvas está montado. Sin autorrepetición: se exige `keyup` entre saltos.
- **Catálogo (`games`)** — fila **nueva** vía `mcp__supabase__apply_migration` (`insert`): `id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `plays`.
- **Leaderboard real** — agregar `"cruce-neon"` a `GAMES_WITH_REAL_SCORES` en `lib/actions/scores.ts`. El resto de la capa de queries/acciones ya es genérica por `game_id`.
- **Portada** — clase nueva `.cover-cruce` en `app/globals.css`, diseñada con `/frontend-design` durante `/spec-impl` (bandas horizontales en fuga hacia arriba + silueta de rana). No se reutiliza `.cover-rana`, que pertenece a la fila `ranaria`.

**Fuera de alcance (diferido):**

- **Controles táctiles/mobile** — diferido.
- **Sonido** — diferido; no hay assets de audio para este juego en `references/`.
- **Sprites/assets externos** — no hay port ni spritesheet en `references/started-games/` ni `references/source_assets/` (solo `snake-assets`); render 100% vectorial.
- **Nichos de meta, niveles discretos y sistema de vidas** — deliberadamente ausentes (ver "Decisiones"); es lo que distingue esta variante de la A.
- **Semilla reproducible / modo diario** — la generación usa `Math.random()`; un PRNG con semilla compartible queda como feature futura.
- **Persistencia de "mejor distancia" local** — el récord ya lo cubre el leaderboard real de Supabase.

## Modelo de datos

Interfaces TypeScript de la API entre el motor y React:

```ts
// components/games/cruce-neon/engine.ts
export interface CruceNeonCallbacks {
  onScoreChange: (score: number) => void;
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
  onGameOver: (finalScore: number) => void;
}
```

`PlayableGameProps` (`components/games/types.ts`) ya cubre estos dos callbacks. **No se modifica `types.ts`.**

Constantes de balance del motor (`engine.ts`):

```ts
const CELL = 40; // px
const COLS = 15; // 600 / 40
const VISIBLE_ROWS = 14; // 560 / 40
const START_COL = 7;
const START_WORLD_ROW = 2; // arranca sobre hierba, con 2 filas seguras debajo

const HOP_MS = 100;
const CAMERA_FOLLOW_ROW = 8; // filas por encima de la cámara antes de desplazarla
const CAMERA_LERP_MS = 200;
const ROWS_AHEAD = 8; // filas generadas por delante
const ROWS_BEHIND = 4; // filas conservadas por detrás antes de descartar

const IDLE_BEFORE_CURRENT_MS = 3_000; // gracia antes de que la cámara empuje sola
const CURRENT_BASE_PX_S = 12;
const CURRENT_STEP_PX_S = 2; // +2 px/s
const CURRENT_STEP_EVERY_ROWS = 20;
const CURRENT_MAX_PX_S = 40;

const POINTS_PER_ROW = 1; // por fila nueva máxima alcanzada
const POINTS_PER_PICKUP = 25;
const PICKUP_CHANCE = 0.25; // solo en filas SAFE
```

Generación procedural de bandas:

```ts
type BandKind = "SAFE" | "ROAD" | "RIVER";

interface Band {
  worldRow: number;
  kind: BandKind;
  dir: 1 | -1;
  speed: number; // px/s
  widthCells: number;
  gapPx: number;
  entities: number[]; // posiciones x en px, wrap por el ancho virtual
  pickupCol: number | null; // solo en SAFE
}

// Pesos por profundidad (filas alcanzadas):
//   0–9   → SAFE 60% / ROAD 40% / RIVER  0%   (rampa de entrada, sin río)
//   10–29 → SAFE 40% / ROAD 45% / RIVER 15%
//   30–59 → SAFE 30% / ROAD 40% / RIVER 30%
//   60+   → SAFE 22% / ROAD 42% / RIVER 36%
// Regla dura: nunca más de 4 bandas no-SAFE consecutivas (se fuerza SAFE en la 5ª).

const LANE_SPEED_BASE = 50; // px/s
const LANE_SPEED_PER_ROW = 0.7; // +0.7 px/s por fila de profundidad
const LANE_SPEED_MAX = 175;
const LANE_SPEED_JITTER = 0.25; // ±25% por carril, para que dos bandas nunca vayan iguales

const ROAD_WIDTH_CELLS = [1, 1, 2]; // auto/auto/camión
const RIVER_WIDTH_CELLS = [2, 3, 4]; // troncos
const ROAD_GAP_PX = [180, 260]; // rango, sorteado por banda
const RIVER_GAP_PX = [120, 200]; // rango, sorteado por banda
```

Fila de catálogo (`games`, **`insert`** — el `id` es nuevo, no hay fila previa que renombrar):

```sql
insert into games (id, title, short, long, cat, cover, color, plays)
values (
  'cruce-neon',
  'CRUCE NEÓN',
  'Sube sin parar: cada fila cruzada es un punto, un error es el final.',
  'Una rana de luz asciende por una autopista de datos que no termina nunca. Carriles de tráfico y ríos de troncos se generan sin descanso, cada vez más rápidos, y si te quedas quieto la corriente te arrastra hacia atrás. Una sola vida: tu puntaje es hasta dónde llegaste.',
  'ARCADE',
  'cover-cruce',
  'green',
  '0'
);
```

## Plan de implementación

1. **Crear `components/games/cruce-neon/engine.ts`** — estado encapsulado en `createCruceNeonEngine(canvas, callbacks)`:
   - **Generador de bandas**: `getBand(worldRow)` consulta un `Map<number, Band>`; si no existe, sortea `kind` según los pesos por profundidad, aplica la regla de máximo 4 bandas no-SAFE consecutivas, sortea `dir`, `speed` (`min(LANE_SPEED_MAX, LANE_SPEED_BASE + worldRow * LANE_SPEED_PER_ROW)` con jitter ±25%), `widthCells`, `gapPx` y las posiciones iniciales de entidades; en `SAFE`, con `PICKUP_CHANCE` asigna `pickupCol`. Purga las bandas con `worldRow < cameraRow - ROWS_BEHIND`.
   - **Rana**: `{ worldRow, col, xPx, hopFrom, hopTo, hopStartedAt }`. Tween de `HOP_MS`, colisión evaluada al aterrizar. Salir por el lateral izquierdo/derecho del canvas = muerte (no hay wrap horizontal).
   - **Colisiones**: AABB contra entidades en bandas `ROAD`; en bandas `RIVER`, si el centro de la rana no cae sobre ningún tronco → ahogo; sobre tronco, `xPx += speed * dir * dt` (si el arrastre la saca del canvas → muerte).
   - **Cámara**: `cameraPx` interpola hacia `(ranaWorldRow - CAMERA_FOLLOW_ROW) * CELL` en `CAMERA_LERP_MS`; además suma la corriente (`CURRENT_BASE_PX_S + floor(maxRow / CURRENT_STEP_EVERY_ROWS) * CURRENT_STEP_PX_S`, tope `CURRENT_MAX_PX_S`) cuando pasaron `IDLE_BEFORE_CURRENT_MS` desde el último avance. Rana por debajo del borde inferior visible = muerte.
   - **Puntuación**: `POINTS_PER_ROW` por cada `worldRow` nuevo por encima del máximo alcanzado (retroceder y volver no repuntúa); `POINTS_PER_PICKUP` al recoger una pastilla. `onScoreChange` solo al cambiar el valor.
   - **Game over**: cualquier muerte llama `onGameOver(score)` una sola vez (bandera de estado terminal, el loop se detiene).
   - `destroy()` idempotente: cancela `requestAnimationFrame` y remueve `keydown`/`keyup`.
   - Verificable de forma aislada: compila con `tsc` sin `any`, sin efectos al importar el módulo.

2. **Crear `components/games/cruce-neon/cruce-neon-canvas.tsx`** — client component con `<canvas width={600} height={560}>` y `style={{ width: "100%", height: "100%", display: "block" }}`. `useEffect` sin dependencias para montar/destruir el engine + `useEffect` que sincroniza `paused`.

3. **Agregar entrada en `components/games/registry.ts`** — `"cruce-neon": { Canvas: dynamic(() => import("@/components/games/cruce-neon/cruce-neon-canvas"), { ssr: false }) }`.

4. **Ajustar HUD en `components/game-player.tsx`** — ocultar las casillas `hud-stat lives` y `hud-stat level` cuando `game.id === "cruce-neon"`, extendiendo la condición que ya existe para `snake`. Solo se muestra "Puntuación".

5. **Migración Supabase (`mcp__supabase__apply_migration`)** — `insert into games (...) values ('cruce-neon', ...)` con la fila de arriba. Verificable con `select * from games where id = 'cruce-neon'`.

6. **`lib/actions/scores.ts`** — `GAMES_WITH_REAL_SCORES` pasa de `["rocas", "caida", "arkanoid", "snake"]` a incluir `"cruce-neon"`.

7. **Portada** — diseñar `.cover-cruce` en `app/globals.css` con `/frontend-design`, junto a `.cover-rana`/`.cover-snake` (mismo patrón `background` + `::after`, sin imágenes).

8. **Verificación manual en navegador** — `npm run dev`, `/games/cruce-neon/jugar`: las flechas saltan una celda por pulsación, el mundo se genera indefinidamente hacia arriba, la cámara sigue a la rana y empieza a empujar sola tras 3s quieto, las primeras 10 filas no tienen río, los carriles aceleran con la profundidad, las pastillas suman 25, cualquier muerte abre el modal con el score real y "GUARDAR PUNTUACIÓN" inserta en `scores` (visible en `/games/cruce-neon` y `/salon` tras refrescar). Jugar una partida larga (>100 filas) vigilando memoria/FPS para confirmar que las bandas viejas se purgan. Confirmar que ningún otro juego cambia de comportamiento.

9. **`npm run build`** — compila sin errores de tipos ni de lint.

## Criterios de aceptación

Base (heredados, no omitir):

- [ ] `components/games/cruce-neon/engine.ts` existe, exporta `createCruceNeonEngine`, sin `any`, sin acceder al DOM fuera de las funciones del engine.
- [ ] `components/games/cruce-neon/cruce-neon-canvas.tsx` existe, monta el canvas en `useEffect`, y lo destruye (cancela loop, remueve listeners de teclado) al desmontar.
- [ ] El HUD de React refleja en vivo el puntaje real del motor; las casillas "Vidas" y "Nivel" no se muestran para este juego.
- [ ] El botón "PAUSA" congela el canvas (loop, cámara y corriente detenidos) y "REANUDAR" lo continúa exactamente donde quedó, sin que la corriente avance durante la pausa.
- [ ] Al morir se abre automáticamente el modal de fin de partida con la puntuación final real, y "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` (visible en `/games/cruce-neon` y `/salon` tras refrescar).
- [ ] El canvas escala visualmente al tamaño de `.crt-screen` sin deformarse en al menos dos anchos de ventana distintos.
- [ ] El juego aparece en el grid de `/games` con datos reales de Supabase (`games`), categoría ARCADE.
- [ ] Ningún otro juego del catálogo cambia de comportamiento.
- [ ] `npm run build` compila sin errores de tipos ni de lint.

Específicos de este juego:

- [ ] Cada pulsación de flecha produce exactamente un salto de una celda; mantener la tecla presionada no encadena saltos.
- [ ] El mundo se genera indefinidamente hacia arriba: no existe fila final ni pantalla de "nivel completado".
- [ ] Avanzar a una fila nunca alcanzada suma exactamente 1 punto; retroceder y volver a subir no vuelve a puntuar.
- [ ] Las primeras 10 filas no contienen bandas de río (rampa de entrada) y nunca aparecen más de 4 bandas no-SAFE consecutivas.
- [ ] La velocidad base de los carriles crece con la profundidad (`50 + 0.7 × fila`, tope 175 px/s) y cada banda tiene su propio jitter, de modo que dos bandas contiguas nunca se mueven idénticas.
- [ ] Tras 3 segundos sin avanzar, la cámara empieza a subir sola (12 px/s, +2 px/s cada 20 filas, tope 40 px/s); quedar por debajo del borde inferior del canvas termina la partida.
- [ ] Cualquier muerte (atropello, ahogo, arrastre fuera del canvas, salida lateral, quedar atrás de la cámara) termina la partida al instante: no hay vidas ni reintentos dentro de una misma partida.
- [ ] Las pastillas de datos aparecen solo en filas seguras (~25% de ellas) y suman 25 puntos al recogerlas.
- [ ] Tras una partida de más de 100 filas, las bandas por debajo de la cámara se han descartado (el `Map` de bandas no crece sin límite).

## Decisiones tomadas y descartadas

- **Diferencia clave con la variante A: mundo infinito procedural y muerte instantánea, en vez de tablero fijo con nichos, niveles y 3 vidas** — aquí no hay meta ni "ganar": el puntaje es literalmente hasta dónde llegaste, y la dificultad sube de forma continua con la profundidad en vez de por saltos de nivel. Alguien elige B si quiere partidas cortas, rejugabilidad alta y un leaderboard que se sienta como una carrera de récords (el score es directamente comparable entre jugadores: "filas"); alguien elige A si quiere la estructura y el momento de logro del arcade original. Se descartó el enfoque de A porque el tablero fijo hace que, superado cierto nivel de habilidad, todas las partidas se parezcan.
- **Una sola vida en vez de 3** — se descartó el sistema de vidas porque con generación procedural el reintento no puede reponer un estado "de tablero" coherente (¿reaparece dónde, en qué banda?), y porque la muerte instantánea es lo que da tensión a un endless. Como consecuencia el HUD no necesita casilla de vidas.
- **Score = filas alcanzadas (1 punto/fila) en vez de +10 por fila** — se descartó la escala de A para que el número del leaderboard sea legible como distancia real ("312" = 312 filas). Las pastillas (+25) son el único componente que rompe la equivalencia exacta, a cambio de dar una decisión interesante (arriesgarse lateralmente vs. subir directo).
- **Presión por cámara/corriente en vez de temporizador** — se descartó el timer de 30s de la variante A porque en un endless no hay "intento" que cronometrar; la corriente cumple la misma función (castigar la parálisis) sin necesidad de UI de tiempo ni de un callback extra en `PlayableGameProps`.
- **HUD solo con `score`** — se descartó reutilizar las casillas "Vidas"/"Nivel" del HUD compartido porque ninguno de los dos conceptos existe aquí; se ocultan condicionalmente en `game-player.tsx`, exactamente el patrón ya establecido por Snake (spec 09).
- **Rampa de entrada sin río en las primeras 10 filas y tope de 4 bandas no-SAFE consecutivas** — se descartó una generación puramente aleatoria porque puede producir arranques imposibles (río en la primera fila) o muros de 8 carriles seguidos sin descanso; las dos reglas duras acotan la varianza sin volver el mundo predecible.
- **`Math.random()` sin semilla** — se descartó implementar un PRNG con semilla (que habilitaría "run diario" y specs reproducibles) porque agrega superficie sin pedido explícito; queda anotado como diferido.
- **`insert` de una fila nueva `cruce-neon`, no `update` de la fila existente `ranaria`** — mismo criterio que la variante A: un spec de game jam no compromete una fila viva del catálogo. Además, en esta variante el juego se aleja bastante del "Frogger" que describe el copy de `ranaria` ("Cruza la autopista de pixeles" sugiere el clásico de tablero fijo), así que un id propio es más honesto. Riesgo de duplicación anotado abajo.
- **Render vectorial, sin sprites** — no hay port ni spritesheet en `references/` (solo `snake-assets`); mismo criterio que `rocas`/`caida`, y encaja con la estética neón del sitio.
- **Portada propia `.cover-cruce`** — se descartó reutilizar `.cover-rana` porque pertenece visualmente a `ranaria` y dos tarjetas idénticas en el grid confunden.
- **`plays` inicial `'0'`** — se descartó inventar una cifra de fantasía tipo `'6.4K'`; este juego nace sin historial real.

## Riesgos identificados

Reutilizados de spec 05 (aplican igual aquí):

- **Scroll de página por teclas capturadas** — `↑` `↓` `←` `→` scrollean la página alrededor del `.crt`. Mitigación: `preventDefault()` en esos códigos mientras el canvas está montado.
- **Doble montaje en desarrollo (`StrictMode`)** — dos loops en paralelo duplicarían la velocidad de la cámara y de los carriles. Mitigación: `destroy()` idempotente, verificado explícitamente en dev.
- **Listeners de teclado globales entre navegaciones** — mitigación: `destroy()` remueve `keydown`/`keyup` al salir.
- **Callbacks disparando renders excesivos** — mitigación: comparar contra el valor previo antes de invocar `onScoreChange` (crítico aquí: el score cambia de a 1 punto por fila y podría dispararse muy seguido en rachas rápidas).

Propios de este juego:

- **Fuga de memoria por bandas nunca purgadas** — el `Map<number, Band>` crece una entrada por fila generada; en una partida de miles de filas sin purga, el consumo y el coste de dibujo suben sin techo. Mitigación: descartar explícitamente `worldRow < cameraRow - ROWS_BEHIND` en cada frame, verificado en el paso 8 con una partida larga.
- **Generación procedural que produce estados imposibles** — dos bandas de río contiguas con troncos en fase opuesta y `gapPx` alto pueden no ofrecer ningún salto seguro; el jugador muere sin haber cometido un error. Mitigación parcial: rangos acotados de `gapPx` (`RIVER_GAP_PX = [120, 200]`, más estrechos que en carretera) y regla de máximo 4 bandas no-SAFE seguidas; si aun así aparecen muros injugables en la verificación manual, endurecer los rangos (a diferencia de specs 07/08, aquí el balance **sí** es retocable porque no hay original que respetar).
- **Convivencia con la fila `ranaria` del catálogo** — si se aplica el `insert` sin tocar `ranaria`, `/games` mostrará dos juegos de cruzar la autopista, uno jugable y otro no. Mitigación: decidirlo explícitamente al promover la candidata con `/add-game`.
- **Cámara que mata sin aviso claro** — un jugador que muere "por quedarse atrás" sin entender por qué percibe el juego como injusto. Mitigación: señal visual dedicada (borde inferior parpadeando en rojo desde 1s antes de que la corriente empiece a empujar), incluida en el render del motor.
- **Score dependiente de la cámara, no del jugador** — si la corriente empujara la cámara por encima de la rana y eso contara como progreso, el score se inflaría solo. Mitigación: el score se calcula exclusivamente con `maxWorldRow` de **la rana**, nunca con la posición de la cámara.
- **Pausa y corriente desincronizadas** — si la corriente usa reloj de pared (`Date.now()`) en vez del `dt` del loop, pausar 30 segundos mataría al jugador al reanudar. Mitigación: cámara y corriente se integran solo con el `dt` del loop activo.
