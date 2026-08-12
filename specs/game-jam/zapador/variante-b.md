# SPEC — ZAPADOR jugable + leaderboard (variante B — avance infinito con scroll, una sola vida)

> **Estado:** Candidata (game jam)
> **Depende de:** 06-leaderboard-catalogo-supabase
> **Fecha:** 2026-08-11
> **Objetivo:** Crear el motor de ZAPADOR en `components/games/zapador/`, un buscaminas de acción minimalista donde el campo minado se desplaza hacia abajo sin parar y el zapador debe seguir subiendo, revelando el número de minas adyacentes a cada paso, con una sola vida y score por distancia; integrarlo en `GamePlayer` vía el registry y dar de alta su fila de catálogo y su leaderboard real.

## Alcance

**Dentro del alcance:**

- **Motor del juego** (`components/games/zapador/engine.ts`) — grilla lógica de 20 columnas × 15 filas visibles de 32px (canvas 640×480), **con scroll vertical continuo**: el campo se desplaza hacia abajo y se generan filas nuevas por arriba a medida que el zapador avanza. No hay salida, no hay niveles, no hay final: el juego termina cuando pierdes.
  - **Movimiento a pasos** con `STEP_COOLDOWN_MS = 110`, ortogonal, sin diagonales. **Al entrar en una celda se revela su número de minas adyacentes** (0–8). El zapador puede moverse en las cuatro direcciones, pero el campo baja constantemente.
  - **Scroll** — velocidad `SCROLL_START_PX_S = 8` px/s, +0.6 px/s por cada fila de profundidad alcanzada, tope `SCROLL_MAX_PX_S = 40`. Si el zapador toca el borde inferior del canvas (lo alcanza el scroll), pierde.
  - **Una sola vida** — pisar una mina termina la partida de inmediato. No hay detector, no hay reintentos, no hay bonus.
  - **Score = profundidad + exploración** — `+50` por cada fila nueva de profundidad alcanzada (récord de avance, no ida y vuelta) y `+5` por cada celda nueva pisada. No hay bonus de tiempo ni de banderas.
  - **Marcas de peligro automáticas** — no hay banderas manuales: cuando la deducción es trivialmente cerrada (una celda desconocida cuyo número vecino ya revelado la determina como mina con certeza), el motor la dibuja con una marca tenue. Es una ayuda de lectura, no una acción del jugador.
  - **Generación por filas** — cada fila nueva se genera con densidad `MINE_DENSITY_START = 0.14` creciendo `+0.004` por fila, tope `0.30`, garantizando que **cada fila tiene al menos 3 celdas sin mina** (para que nunca exista un muro infranqueable de borde a borde).
- **Wrapper de React** (`components/games/zapador/zapador-canvas.tsx`) — client component que monta el motor en un `<canvas width={640} height={480}>` vía `useEffect`/`ref`, escala por CSS dentro de `.crt-screen`, expone únicamente `onScoreChange`, `onGameOver` y la prop `paused`. Cleanup: cancela `requestAnimationFrame` y remueve `keydown`/`keyup`.
- **Registro en `components/games/registry.ts`** — entrada `zapador` → `dynamic(() => import(".../zapador-canvas"), { ssr: false })`. El registry ya existe (spec 07), no hace falta paso 0.
- **Integración en `GamePlayer`** — el HUD muestra **solo "Puntuación"**: se ocultan "Vidas" y "Nivel" para `zapador` (mismo patrón condicional que ya usa `snake`). `onGameOver` → `saveScoreAction`.
- **Controles** — `←` `→` `↑` `↓` mover un paso, con `preventDefault` mientras el canvas está montado. Ninguna tecla más. Sin mouse.
- **Catálogo (`games`)** — fila **nueva** vía `mcp__supabase__apply_migration` (`insert`, el id `zapador` no existe hoy): `cat = 'ARCADE'`, `color = 'yellow'`, `cover = 'cover-zapador'`, `plays = '0'`.
- **Leaderboard real** — agregar `"zapador"` a `GAMES_WITH_REAL_SCORES` en `lib/actions/scores.ts`.
- **Portada** — clase nueva `.cover-zapador` en `app/globals.css` (grilla en fuga vertical con una silueta amarilla subiendo), diseñada con `/frontend-design` durante `/spec-impl`.

**Fuera de alcance (diferido):**

- **Controles táctiles/mobile** — diferido.
- **Sonido** — diferido.
- **Detector, banderas manuales, vidas, niveles y bonus** — excluidos deliberadamente: son exactamente el material de la variante A.
- **Sprites / assets** — todo vectorial; no hay assets de respaldo en `references/source_assets/` (solo existe `snake-assets`).
- **Power-ups / coleccionables** — ninguno; el único recurso del jugador es la información que gana caminando.

## Modelo de datos

```ts
// components/games/zapador/engine.ts
export interface ZapadorCallbacks {
  onScoreChange: (score: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface ZapadorEngine {
  start: () => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export function createZapadorEngine(
  canvas: HTMLCanvasElement,
  callbacks: ZapadorCallbacks,
): ZapadorEngine;
```

```tsx
// components/games/zapador/zapador-canvas.tsx
export interface ZapadorCanvasProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

Estructuras internas (no exportadas):

```ts
interface Cell {
  mine: boolean;
  adjacent: number; // 0..8 — se calcula al generar la fila superior siguiente
  known: boolean;
  certainMine: boolean; // marca automática de peligro deducido
}

interface Field {
  rows: Cell[][]; // buffer circular de filas vivas, indexado por profundidad
  topDepth: number; // profundidad de la fila más alta generada
}
```

Constantes de balance (`engine.ts`):

```ts
const CANVAS_W = 640;
const CANVAS_H = 480;
const CELL = 32;
const COLS = 20; // 640 / 32
const VISIBLE_ROWS = 15; // 480 / 32

const STEP_COOLDOWN_MS = 110;

const SCROLL_START_PX_S = 8;
const SCROLL_ACCEL_PER_ROW = 0.6; // px/s extra por fila de profundidad
const SCROLL_MAX_PX_S = 40;

const MINE_DENSITY_START = 0.14;
const MINE_DENSITY_STEP = 0.004; // por fila generada
const MINE_DENSITY_MAX = 0.3;
const MIN_SAFE_CELLS_PER_ROW = 3;

const POINTS_PER_DEPTH_ROW = 50; // solo al superar el récord de profundidad
const POINTS_PER_NEW_CELL = 5;
const SAFE_START_ROWS = 3; // las 3 primeras filas nunca tienen minas
```

Fila de catálogo (`games`, `insert` — el id es nuevo, no hay fila previa que renombrar):

```sql
insert into games (id, title, short, long, cat, cover, color, plays)
values (
  'zapador',
  'ZAPADOR',
  'Sube por el campo minado infinito antes de que te alcance.',
  'El campo minado se desplaza hacia ti y no se detiene nunca. Cada paso revela cuantas minas te rodean, y esa es toda la informacion que vas a tener. Una sola vida, sin detector y sin segundas oportunidades: solo cuenta hasta donde llegaste.',
  'ARCADE',
  'cover-zapador',
  'yellow',
  '0'
);
```

## Plan de implementación

1. **Crear `components/games/zapador/engine.ts`** — estado encapsulado en `createZapadorEngine(canvas, callbacks)`, sin globals de módulo:
   - **Campo por filas con buffer circular** — `generateRow(depth)` reparte minas con densidad `min(MINE_DENSITY_START + depth * MINE_DENSITY_STEP, MINE_DENSITY_MAX)`, forzando al menos `MIN_SAFE_CELLS_PER_ROW` celdas libres (si el sorteo deja menos, se despejan celdas al azar hasta alcanzar el mínimo). Las `SAFE_START_ROWS` primeras filas son siempre libres. La adyacencia de una fila solo puede calcularse cuando existe la fila superior, así que siempre se genera **una fila de margen por encima** de la visible.
   - Las filas que salen por abajo del canvas se descartan del buffer (memoria acotada, no crece con la partida).
   - `step(dir)` — cooldown por tiempo real, clamp lateral (sin wrap), permite bajar; al entrar en celda nueva: `known = true`, `+POINTS_PER_NEW_CELL`; si es mina → `gameOver()`; si la profundidad supera el récord → `+POINTS_PER_DEPTH_ROW` por cada fila nueva superada.
   - `updateCertainMarks()` — tras cada revelación, para cada celda conocida con número N: si sus vecinas desconocidas son exactamente N, todas se marcan `certainMine = true`. Recalcular solo en el entorno 5×5 de la celda revelada (no todo el campo) para no costar por frame.
   - `tickScroll(dt)` — desplaza el campo `scrollSpeed * dt`; `scrollSpeed = min(SCROLL_START_PX_S + depth * SCROLL_ACCEL_PER_ROW, SCROLL_MAX_PX_S)`. Si la fila del zapador sale por el borde inferior → `gameOver()`.
   - Dibujo: niebla en celdas desconocidas, número en las conocidas, marca de peligro en `certainMine`, zapador, y un degradado de aviso en el borde inferior cuando el scroll está cerca.
   - Loop con `requestAnimationFrame` y acumulador de tiempo real (scroll y cooldown independientes del refresco).
   - `destroy()` idempotente: cancela el `rAF` y remueve `keydown`/`keyup`.
   - Verificable de forma aislada: compila con `tsc` sin `any`, sin efectos de import.

2. **Crear `components/games/zapador/zapador-canvas.tsx`** — client component con `<canvas width={640} height={480}>` y `style={{ width: "100%", height: "100%", display: "block" }}`. `useEffect` sin dependencias para montar/destruir el engine + `useEffect` de sincronización de `paused`.

3. **Agregar entrada en `components/games/registry.ts`** — `zapador: { Canvas: dynamic(() => import("@/components/games/zapador/zapador-canvas"), { ssr: false }) }`.

4. **Ajustar HUD en `components/game-player.tsx`** — para `zapador` se ocultan las casillas "Vidas" y "Nivel", igual que ya se hace para `snake`; solo se muestra "Puntuación". `onGameOver` → `saveScoreAction({ gameId: 'zapador', name, score })`.

5. **Migración Supabase (`mcp__supabase__apply_migration`)** — `insert into games (...)` con la fila de arriba. Verificable con `select * from games where id = 'zapador'`.

6. **`lib/actions/scores.ts`** — agregar `"zapador"` a `GAMES_WITH_REAL_SCORES`.

7. **Portada** — diseñar `.cover-zapador` en `app/globals.css` con `/frontend-design`.

8. **Verificación manual en navegador** — `npm run dev`, `/games/zapador/jugar`: las flechas mueven al zapador sin scrollear la página, cada celda nueva muestra su número, el campo baja de forma continua y acelera con la profundidad, pisar una mina termina la partida al instante, dejarse alcanzar por el borde inferior también, el score sube por profundidad récord y por celdas nuevas, el modal muestra el score real y "GUARDAR PUNTUACIÓN" inserta en `scores` (visible en `/games/zapador` y `/salon` tras refrescar). Jugar 3 minutos seguidos y comprobar que el uso de memoria no crece (buffer circular de filas). Confirmar que ningún otro juego cambia de comportamiento.

9. **`npm run build`** — compila sin errores de tipos ni de lint.

## Criterios de aceptación

Base (heredados, no omitir):

- [ ] `components/games/zapador/engine.ts` existe, exporta `createZapadorEngine`, sin `any`, sin acceder al DOM fuera de las funciones del engine.
- [ ] `components/games/zapador/zapador-canvas.tsx` existe, monta el canvas en `useEffect` y lo destruye (cancela loop, remueve listeners de teclado) al desmontar.
- [ ] El HUD de React refleja en vivo el `score` real del motor; las casillas "Vidas" y "Nivel" no se muestran para Zapador.
- [ ] El botón "PAUSA" congela el canvas (loop y scroll detenidos) y "REANUDAR" lo continúa exactamente donde quedó.
- [ ] Al pisar una mina o ser alcanzado por el borde inferior, se abre automáticamente el modal de fin de partida con la puntuación final real, y "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` (visible en `/games/zapador` y `/salon` tras refrescar).
- [ ] El canvas escala visualmente al tamaño de `.crt-screen` sin deformarse en al menos dos anchos de ventana distintos.
- [ ] El juego aparece en el grid de `/games` con datos reales de Supabase (`games`), categoría ARCADE.
- [ ] Ningún otro juego del catálogo cambia de comportamiento.
- [ ] `npm run build` compila sin errores de tipos ni de lint.

Específicos de este juego:

- [ ] El campo se desplaza hacia abajo de forma continua, arrancando a 8 px/s y acelerando 0.6 px/s por fila de profundidad, con tope en 40 px/s.
- [ ] Las 3 primeras filas están garantizadamente libres de minas (arranque justo).
- [ ] Cada fila generada tiene al menos 3 celdas sin mina: nunca existe un muro infranqueable de borde a borde.
- [ ] Pisar una celda por primera vez revela su número de minas adyacentes y suma 5 puntos; superar el récord de profundidad suma 50 por fila.
- [ ] Retroceder y volver a avanzar **no** vuelve a sumar puntos de profundidad (solo cuenta el récord).
- [ ] Una celda desconocida deducible con certeza como mina (por un número vecino ya satisfecho) se dibuja automáticamente con marca de peligro; no existen banderas manuales.
- [ ] Pisar una mina termina la partida de inmediato (una sola vida, sin reintentos).
- [ ] Tras 3 minutos de partida continua, el consumo de memoria se mantiene estable (las filas fuera de pantalla se descartan).

## Decisiones tomadas y descartadas

- **Scroll continuo en vez de reloj por nivel — diferencia central con la variante A** — la presión aquí es espacial y visible, no un número que baja: ves cuánto te queda de campo. Elimina reloj, niveles, salida y pantallas intermedias, y deja una sola pregunta por segundo ("¿este paso es seguro o me estoy dejando alcanzar?"). Alguien elige esta variante si quiere un juego de récord corto y rejugable con reglas que se explican en una frase; elige la A si quiere una campaña con recursos, objetivos y final.
- **Una sola vida, sin detector ni banderas** — se descartó todo el aparato de sistemas de la variante A porque con scroll continuo cada sistema extra compite por la atención del jugador en el peor momento. El minimalismo aquí es la decisión de diseño, no una omisión.
- **Marcas de peligro automáticas en vez de banderas manuales** — se descartó la tecla `F` porque marcar a mano bajo presión de scroll es un impuesto de tiempo, no una decisión interesante; el motor marca solo lo trivialmente deducible y deja al jugador las decisiones ambiguas, que son las que importan.
- **Score por profundidad récord, no por avance neto** — se descartó puntuar cualquier movimiento hacia arriba porque permitiría farmear subiendo y bajando la misma fila; solo el récord suma.
- **Generación por filas con buffer circular** — se descartó pregenerar un campo grande y hacer scroll sobre él (memoria innecesaria y techo artificial de profundidad); las filas viejas se descartan al salir de pantalla.
- **Mínimo de 3 celdas libres por fila** — se descartó confiar en el azar: con densidad 0.30 la probabilidad de una fila completamente minada no es cero, y sería una muerte garantizada e injusta.
- **Se permite retroceder (bajar)** — se descartó forzar avance obligatorio hacia arriba porque a veces la única jugada segura es rodear por debajo; el scroll ya castiga suficientemente la demora.
- **HUD solo con `score`** — se descartó reutilizar las casillas "Vidas"/"Nivel" del HUD compartido porque este diseño no tiene ninguno de esos conceptos; se ocultan condicionalmente, mismo patrón ya aplicado a `snake`.
- **Scroll y cooldown por tiempo real, no por frames** — se descartó ligarlos al `requestAnimationFrame` porque en pantallas de 120/144Hz el juego correría al doble de velocidad.

## Riesgos identificados

Reutilizados de spec 05 (aplican igual aquí):

- **Scroll de página por teclas capturadas** — las flechas scrollean el contenedor del `.crt`. Mitigación: `preventDefault()` en los cuatro códigos mientras el canvas está montado.
- **Doble montaje en desarrollo (`StrictMode`)** — dos loops duplicarían la velocidad de scroll. Mitigación: `destroy()` idempotente, verificado en dev.
- **Listeners de teclado globales entre navegaciones** — mitigación: `destroy()` remueve `keydown`/`keyup` al salir.
- **Callbacks disparando renders excesivos** — el score sube muy seguido (cada celda nueva). Mitigación: `onScoreChange` solo cuando el valor cambia realmente, nunca por frame.

Propios de este juego:

- **Tensión mal calibrada entre scroll y deducción** — si el scroll es demasiado rápido, deducir es imposible y el juego se vuelve azar puro; demasiado lento y no hay tensión. Es el riesgo principal de este diseño. Mitigación: las tres constantes de scroll están aisladas y son el único objeto de playtest; el rango 8→40 px/s (0.25→1.25 filas/s) es un punto de partida, no un dogma.
- **Fugas de memoria por filas acumuladas** — si el buffer no descarta filas fuera de pantalla, una partida larga crece sin límite. Mitigación: buffer circular acotado a `VISIBLE_ROWS + 2`, verificado con una partida de 3 minutos.
- **Cálculo de adyacencia con filas aún no generadas** — el número de una celda de la fila superior depende de una fila que todavía no existe. Mitigación: generar siempre una fila de margen por encima de la visible y calcular la adyacencia con un frame de retraso respecto a la generación.
- **Coste de `updateCertainMarks()`** — recorrer todo el campo por revelación sería innecesariamente caro. Mitigación: limitar el recálculo al entorno 5×5 de la celda revelada, y solo al revelar (no por frame).
- **Marcas automáticas percibidas como "el juego juega por mí"** — si el motor marca demasiado, la deducción interesante desaparece. Mitigación: la regla es estrictamente la trivial (vecinas desconocidas == número), sin propagación multi-paso.
- **Adivinanza forzada con una sola vida** — a densidad alta pueden aparecer situaciones sin jugada segura, y aquí un error acaba la partida. Mitigación: es aceptado como parte del techo de dificultad (el scroll ya implica que las partidas terminan igual); el mínimo de celdas libres por fila evita el caso extremo.
