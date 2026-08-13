# SPEC — DRAGAMINAS jugable + leaderboard (variante B — barrido de radar continuo, minas a la deriva, oleadas infinitas)

> **Estado:** Candidata (game jam)
> **Depende de:** 06-leaderboard-catalogo-supabase
> **Fecha:** 2026-08-11
> **Objetivo:** Crear el motor de DRAGAMINAS en `components/games/dragaminas/`, un juego de acción naval donde un barrido de radar rotativo ilumina intermitentemente minas que derivan hacia el buque, con munición limitada de cargas de profundidad, una sola vida, oleadas infinitas y bonus por detonaciones en cadena; integrarlo en `GamePlayer` vía el registry y dar de alta su fila de catálogo y su leaderboard real.

## Alcance

**Dentro del alcance:**

- **Motor del juego** (`components/games/dragaminas/engine.ts`) — espacio **continuo** (no grilla), resolución lógica fija 800×600, vista cenital de un mar negro. El buque es el centro de un radar que barre solo, sin intervención del jugador; las minas derivan lentamente hacia el buque y solo se ven cuando el haz pasa por encima.
  - **Buque** — rotación con `←`/`→` (`SHIP_TURN_RAD_S = 3.4`), empuje con `↑` (`SHIP_THRUST = 210 px/s²`), fricción `SHIP_DRAG = 0.985` por paso de 16ms, velocidad máxima `SHIP_MAX_SPEED = 240 px/s`. Bordes: pared sólida con rebote al 50% (sin wrap).
  - **Barrido de radar automático** — un haz gira alrededor del buque a `SWEEP_RAD_S = 1.9` rad/s (una vuelta cada ~3.3s). Toda mina dentro de `SWEEP_RANGE = 300` px alcanzada por el haz queda iluminada y se desvanece en `ECHO_FADE_MS = 2200` ms. No consume nada, no se controla: el ritmo del barrido **es** el reloj del juego.
  - **Minas a la deriva** — cada mina se mueve hacia el buque a `MINE_DRIFT_START = 14 px/s`, +1.2 px/s por oleada, tope 55 px/s. Radio de contacto `MINE_RADIUS = 14`. No persiguen con inteligencia (rumbo recalculado una vez por segundo, sin aceleración), pero no paran nunca.
  - **Cargas de profundidad con munición limitada** (`X`) — `AMMO_MAX = 6` cargas simultáneas en el pañol, recarga `RELOAD_MS = 1400` por carga. Fusible `CHARGE_FUSE_MS = 700`, radio `CHARGE_RADIUS = 52`. El buque **no** recibe daño de sus propias cargas (diferencia deliberada con la variante A).
  - **Cadenas** — una mina destruida por una carga detona a su vez con radio `MINE_CHAIN_RADIUS = 58`, pudiendo encadenar. Multiplicador de cadena: la mina n-ésima de una misma cadena vale `POINTS_PER_MINE * n` (2ª vale doble, 3ª triple...), con tope `CHAIN_MAX_MULT = 8`.
  - **Oleadas infinitas** — la oleada `n` siembra `4 + n` minas en el borde del canvas; la siguiente entra cuando quedan `<= 2` minas vivas. Sin final: el juego termina cuando pierdes.
  - **Una sola vida** — cualquier contacto con una mina termina la partida.
- **Wrapper de React** (`components/games/dragaminas/dragaminas-canvas.tsx`) — client component que monta el motor en un `<canvas width={800} height={600}>` vía `useEffect`/`ref`, escala por CSS dentro de `.crt-screen`, expone `onScoreChange`, `onLevelChange` (oleada) y `onGameOver`, más la prop `paused`. Cleanup: cancela `requestAnimationFrame` y remueve `keydown`/`keyup`.
- **Registro en `components/games/registry.ts`** — entrada `dragaminas` → `dynamic(() => import(".../dragaminas-canvas"), { ssr: false })`. El registry ya existe (spec 07), no hace falta paso 0.
- **Integración en `GamePlayer`** — el HUD muestra "Puntuación" y "Nivel" (la oleada); se oculta "Vidas" para `dragaminas` (patrón condicional ya usado para `snake`). `onGameOver` → `saveScoreAction`. La munición se dibuja dentro del canvas.
- **Controles** — `←`/`→` girar, `↑` empujar, `X` soltar carga de profundidad; todos con `preventDefault` mientras el canvas está montado. **No hay tecla de sonar** (el radar es automático). Sin mouse.
- **Catálogo (`games`)** — fila **nueva** vía `mcp__supabase__apply_migration` (`insert`, el id `dragaminas` no existe hoy): `cat = 'SHOOTER'`, `color = 'green'`, `cover = 'cover-dragaminas'`, `plays = '0'`.
- **Leaderboard real** — agregar `"dragaminas"` a `GAMES_WITH_REAL_SCORES` en `lib/actions/scores.ts`.
- **Portada** — clase nueva `.cover-dragaminas` en `app/globals.css` (haz de radar barriendo un círculo verde con ecos), diseñada con `/frontend-design` durante `/spec-impl`.

**Fuera de alcance (diferido):**

- **Controles táctiles/mobile** — diferido.
- **Sonido** — diferido.
- **Sprites / assets** — todo vectorial; no hay assets navales en `references/source_assets/` (solo existe `snake-assets`).
- **Ping manual / gestión de batería** — excluido a propósito: es el eje de la variante A.
- **Vidas múltiples, niveles finitos y bonus por nivel limpio** — excluidos; este diseño es de una vida y récord abierto.

## Modelo de datos

```ts
// components/games/dragaminas/engine.ts
export interface DragaminasCallbacks {
  onScoreChange: (score: number) => void;
  onLevelChange: (wave: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface DragaminasEngine {
  start: () => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export function createDragaminasEngine(
  canvas: HTMLCanvasElement,
  callbacks: DragaminasCallbacks,
): DragaminasEngine;
```

```tsx
// components/games/dragaminas/dragaminas-canvas.tsx
export interface DragaminasCanvasProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLevelChange: (wave: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

Estructuras internas (no exportadas):

```ts
interface Vec {
  x: number;
  y: number;
}

interface Ship {
  pos: Vec;
  vel: Vec;
  angle: number; // rad
}

interface Mine {
  pos: Vec;
  vel: Vec; // rumbo hacia el buque, recalculado 1 vez/s
  alive: boolean;
  echoUntil: number; // ms
}

interface DepthCharge {
  pos: Vec;
  detonatesAt: number; // ms
}
```

Constantes de balance (`engine.ts`):

```ts
const CANVAS_W = 800;
const CANVAS_H = 600;

const SHIP_TURN_RAD_S = 3.4;
const SHIP_THRUST = 210; // px/s²
const SHIP_DRAG = 0.985; // por paso de 16ms
const SHIP_MAX_SPEED = 240; // px/s
const SHIP_RADIUS = 11;
const WALL_BOUNCE = 0.5;

const SWEEP_RAD_S = 1.9; // ~3.3 s por vuelta
const SWEEP_RANGE = 300; // px
const SWEEP_WIDTH_RAD = 0.12; // grosor angular del haz
const ECHO_FADE_MS = 2200;

const AMMO_MAX = 6;
const RELOAD_MS = 1400; // por carga
const CHARGE_FUSE_MS = 700;
const CHARGE_RADIUS = 52;

const MINE_RADIUS = 14;
const MINE_CHAIN_RADIUS = 58;
const MINE_DRIFT_START = 14; // px/s
const MINE_DRIFT_PER_WAVE = 1.2;
const MINE_DRIFT_MAX = 55;
const MINE_RETARGET_MS = 1000;

const MINES_BASE_PER_WAVE = 4; // oleada n => 4 + n minas
const WAVE_NEXT_THRESHOLD = 2; // minas vivas restantes que disparan la siguiente oleada

const POINTS_PER_MINE = 100;
const CHAIN_MAX_MULT = 8;
```

Fila de catálogo (`games`, `insert` — el id es nuevo, no hay fila previa que renombrar):

```sql
insert into games (id, title, short, long, cat, cover, color, plays)
values (
  'dragaminas',
  'DRAGAMINAS',
  'El radar barre solo. Las minas se acercan. Un casco, sin repuesto.',
  'Tu radar gira sin parar e ilumina por un instante las minas que derivan hacia ti. Seis cargas de profundidad en el panol, recarga lenta y una sola vida. Encadena detonaciones para multiplicar el puntaje mientras las oleadas se vuelven mas rapidas y mas numerosas.',
  'SHOOTER',
  'cover-dragaminas',
  'green',
  '0'
);
```

## Plan de implementación

1. **Crear `components/games/dragaminas/engine.ts`** — estado encapsulado en `createDragaminasEngine(canvas, callbacks)`, sin globals de módulo:
   - Simulación con paso fijo de 16ms y acumulador (balance independiente del refresco de pantalla).
   - **Buque** — rotación, empuje según `angle`, `drag` por paso, clamp de velocidad, rebote en los cuatro bordes con `WALL_BOUNCE`.
   - **Barrido** — `sweepAngle += SWEEP_RAD_S * dt` (normalizado a 2π). Para cada mina viva a distancia `< SWEEP_RANGE`, si su ángulo respecto al buque cae dentro de `[sweepAngle - SWEEP_WIDTH_RAD, sweepAngle]` recorrido en este paso, se fija `echoUntil = now + ECHO_FADE_MS`. La comprobación usa el arco realmente recorrido en el paso, no un umbral fijo, para no perder minas entre frames.
   - **Minas** — `spawnWave(n)` coloca `MINES_BASE_PER_WAVE + n` minas en puntos aleatorios del borde del canvas, con rumbo inicial hacia el buque y velocidad `min(MINE_DRIFT_START + n * MINE_DRIFT_PER_WAVE, MINE_DRIFT_MAX)`. Cada `MINE_RETARGET_MS` se recalcula el rumbo (sin cambiar el módulo de la velocidad). Cuando quedan `<= WAVE_NEXT_THRESHOLD` minas vivas → `wave++`, `onLevelChange`, `spawnWave(wave)`.
   - **Cargas** — `dropCharge()` requiere `ammo > 0`; descuenta y encola `DepthCharge`. Recarga: un temporizador de `RELOAD_MS` que repone una carga hasta `AMMO_MAX`. Al detonar: `detonateAt(pos, CHARGE_RADIUS, chainIndex = 1)`.
   - **Cadenas** — `detonateAt` destruye toda mina viva en el radio; cada mina destruida suma `POINTS_PER_MINE * min(chainIndex, CHAIN_MAX_MULT)` y a su vez llama `detonateAt(minePos, MINE_CHAIN_RADIUS, chainIndex + 1)`. Implementado con una **cola iterativa (BFS)**, no con recursión, y con marcado de mina como muerta antes de encolar (evita ciclos infinitos). El multiplicador aplicado se dibuja como texto flotante sobre cada mina destruida.
   - **Colisión** — `dist(ship, mine) < SHIP_RADIUS + MINE_RADIUS` con mina viva → `gameOver(score)` inmediato (una sola vida). El buque no recibe daño de sus propias cargas.
   - Dibujo: fondo negro con círculos concéntricos de radar tenues, haz con estela angular degradada, ecos de mina con alfa proporcional al tiempo restante, buque vectorial, cargas con fusible parpadeante, indicador de munición (6 puntos) y número de oleada.
   - `destroy()` idempotente: cancela el `rAF` y remueve `keydown`/`keyup`.
   - Verificable de forma aislada: compila con `tsc` sin `any`, sin efectos de import.

2. **Crear `components/games/dragaminas/dragaminas-canvas.tsx`** — client component con `<canvas width={800} height={600}>` y `style={{ width: "100%", height: "100%", display: "block" }}`. `useEffect` sin dependencias para montar/destruir el engine + `useEffect` de sincronización de `paused`.

3. **Agregar entrada en `components/games/registry.ts`** — `dragaminas: { Canvas: dynamic(() => import("@/components/games/dragaminas/dragaminas-canvas"), { ssr: false }) }`.

4. **Ajustar HUD en `components/game-player.tsx`** — para `dragaminas` se muestran "Puntuación" y "Nivel" (oleada) y se oculta "Vidas", misma condicional ya usada para `snake`. `onGameOver` → `saveScoreAction({ gameId: 'dragaminas', name, score })`.

5. **Migración Supabase (`mcp__supabase__apply_migration`)** — `insert into games (...)` con la fila de arriba. Verificable con `select * from games where id = 'dragaminas'`.

6. **`lib/actions/scores.ts`** — agregar `"dragaminas"` a `GAMES_WITH_REAL_SCORES`.

7. **Portada** — diseñar `.cover-dragaminas` en `app/globals.css` con `/frontend-design`.

8. **Verificación manual en navegador** — `npm run dev`, `/games/dragaminas/jugar`: el haz gira solo y las minas parpadean al ser barridas; las minas derivan hacia el buque y aceleran por oleada; `X` suelta cargas hasta agotar el pañol de 6 y la munición se repone cada 1.4s; una carga bien puesta encadena varias minas con multiplicador visible; el buque no muere por sus propias cargas; tocar una mina termina la partida al instante; el modal muestra el score real y "GUARDAR PUNTUACIÓN" inserta en `scores` (visible en `/games/dragaminas` y `/salon` tras refrescar). Probar una cadena de 8+ minas y confirmar que no hay recursión desbordada ni caída de framerate. Confirmar que ningún otro juego cambia de comportamiento.

9. **`npm run build`** — compila sin errores de tipos ni de lint.

## Criterios de aceptación

Base (heredados, no omitir):

- [ ] `components/games/dragaminas/engine.ts` existe, exporta `createDragaminasEngine`, sin `any`, sin acceder al DOM fuera de las funciones del engine.
- [ ] `components/games/dragaminas/dragaminas-canvas.tsx` existe, monta el canvas en `useEffect` y lo destruye (cancela loop, remueve listeners de teclado) al desmontar.
- [ ] El HUD de React refleja en vivo `score` y `nivel` (oleada) reales del motor; la casilla "Vidas" no se muestra para Dragaminas.
- [ ] El botón "PAUSA" congela el canvas (loop, barrido, deriva, fusibles y recarga detenidos) y "REANUDAR" lo continúa exactamente donde quedó.
- [ ] Al tocar una mina se abre automáticamente el modal de fin de partida con la puntuación final real, y "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` (visible en `/games/dragaminas` y `/salon` tras refrescar).
- [ ] El canvas escala visualmente al tamaño de `.crt-screen` sin deformarse en al menos dos anchos de ventana distintos.
- [ ] El juego aparece en el grid de `/games` con datos reales de Supabase (`games`), categoría SHOOTER.
- [ ] Ningún otro juego del catálogo cambia de comportamiento.
- [ ] `npm run build` compila sin errores de tipos ni de lint.

Específicos de este juego:

- [ ] El haz de radar gira solo a ~1.9 rad/s sin intervención del jugador; no existe tecla de sonar.
- [ ] Una mina alcanzada por el haz dentro de 300px se ilumina y se desvanece en 2.2s; ninguna mina en rango queda sin iluminar por caer "entre frames" (la comprobación usa el arco recorrido en el paso).
- [ ] Las minas derivan hacia el buque, recalculando rumbo una vez por segundo, con velocidad creciente por oleada (14 px/s inicial, tope 55).
- [ ] El pañol tiene 6 cargas máximo y repone una cada 1.4s; sin munición, `X` no hace nada.
- [ ] Una carga detona a los 700ms con radio 52 y **no** daña al buque.
- [ ] Una mina destruida por una carga detona en cadena (radio 58); la n-ésima mina de la cadena vale 100 × n puntos, con tope ×8, y el multiplicador se muestra en pantalla.
- [ ] Una cadena larga (8+ minas) se resuelve sin recursión desbordada, sin bucles infinitos y sin caída perceptible de framerate.
- [ ] Cuando quedan 2 o menos minas vivas entra la oleada siguiente (4 + n minas) y el HUD "Nivel" avanza.
- [ ] Cualquier contacto con una mina termina la partida de inmediato (una sola vida).

## Decisiones tomadas y descartadas

- **Radar automático en vez de ping manual con batería — diferencia central con la variante A** — el jugador no decide cuándo ver: el haz impone su ritmo y toda la habilidad se traslada a posicionarse y actuar en la ventana que el barrido concede. Elimina un recurso a gestionar y sube la cadencia del juego. Alguien elige esta variante si quiere un arcade tenso y rejugable de partidas cortas; elige la A si prefiere exploración lenta, decisiones de recurso y una campaña con final.
- **Minas móviles que derivan hacia el buque — segunda diferencia con la A** — en la A las minas son un campo estático que se limpia con paciencia; aquí vienen a por ti, así que la información caduca sola y esconderse no es opción. Se descartó una IA de persecución real (aceleración, evasión) por ser cara e injusta: la deriva lenta con retarget por segundo basta para generar presión legible.
- **Una sola vida y oleadas infinitas** — se descartó el formato de 5 niveles con `win` de la variante A porque este diseño busca la curva de récord típica de arcade (partidas de 2–5 minutos, "una más").
- **Sin daño propio por cargas** — se descartó el fuego amigo de la variante A porque, con minas persiguiéndote y una sola vida, morir por tu propia carga sería castigo doble; aquí la carga es un arma, no un compromiso.
- **Munición limitada con recarga en vez de batería de sonar** — el recurso escaso se mueve del "ver" al "actuar": no se puede spamear cargas por todo el mapa, hay que elegir dónde. Se descartó munición infinita porque haría irrelevante la puntería.
- **Sistema de cadenas con multiplicador creciente (tope ×8)** — se descartó puntuar todas las minas igual porque entonces la jugada óptima sería la más aburrida (una carga por mina); el multiplicador premia esperar a que las minas se agrupen, que es una decisión arriesgada e interesante. El tope evita puntajes desbocados en una sola jugada afortunada.
- **Cadena resuelta con cola iterativa (BFS), no recursión** — se descartó la implementación recursiva por riesgo de stack overflow y de ciclos si una mina se reprocesa; las minas se marcan muertas antes de encolarse.
- **La oleada entra con 2 minas vivas restantes, no con 0** — se descartó esperar al campo vacío porque genera huecos muertos donde no pasa nada; el solapamiento mantiene la presión continua.
- **La oleada se mapea a la casilla "Nivel" del HUD** — se descartó agregar un callback nuevo a `PlayableGameProps`; semánticamente es lo mismo que `level`.
- **Rebote en bordes, no wrap-around** — mismo criterio que la variante A: con minas convergiendo, el wrap sería un escape gratuito.
- **Todo vectorial, sin assets** — no hay assets navales en `references/`; la estética de pantalla de radar es vectorial por naturaleza (precedente: ROCAS).

## Riesgos identificados

Reutilizados de spec 05 (aplican igual aquí):

- **Scroll de página por teclas capturadas** — `↑`/`←`/`→` scrollean el contenedor del `.crt`. Mitigación: `preventDefault()` en los códigos usados mientras el canvas está montado.
- **Doble montaje en desarrollo (`StrictMode`)** — dos loops duplicarían la velocidad del barrido y de la deriva. Mitigación: `destroy()` idempotente, verificado en dev.
- **Listeners de teclado globales entre navegaciones** — mitigación: `destroy()` remueve `keydown`/`keyup` al salir.
- **Callbacks disparando renders excesivos** — el score sube en ráfagas durante las cadenas. Mitigación: `onScoreChange` solo cuando el valor cambia, una vez por paso de simulación, no por mina destruida.
- **Física dependiente del framerate** — mitigación: paso fijo de 16ms con acumulador; `drag` aplicado por paso, no por frame renderizado.

Propios de este juego:

- **Minas perdidas "entre frames" por el haz** — con `SWEEP_WIDTH_RAD` fijo y saltos de frame grandes (pestaña en segundo plano, GPU cargada), una mina podría no ser iluminada nunca y matar sin aviso. Mitigación: comprobar el arco realmente recorrido en el paso, no un umbral angular constante; además, acotar `dt` acumulado (máx. 100ms por frame) para que un salto de pestaña no teletransporte el barrido ni las minas.
- **Cadenas explosivas descontroladas** — una cadena mal implementada puede colgarse (ciclo) o generar puntajes absurdos. Mitigación: cola iterativa, marcado previo de mina muerta, y tope `CHAIN_MAX_MULT = 8`. Además, `saveScoreAction` valida el rango 0–999999: una partida excepcional podría acercarse al techo, lo que conviene verificar en playtest.
- **Dificultad que escala sin techo real** — con oleadas infinitas y deriva creciente, la partida puede volverse imposible de golpe o, al revés, eternizarse si el jugador aprende a orbitar los bordes. Mitigación: `MINE_DRIFT_MAX = 55` acota por arriba; el rebote en paredes (en vez de wrap) evita el kiting infinito por el borde.
- **Una sola vida percibida como brutal si el eco dura poco** — 2.2s de eco con minas móviles significa que la posición mostrada ya está desactualizada al reaccionar. Es intencional, pero es la primera constante a revisar en playtest junto con `SWEEP_RAD_S`.
- **Legibilidad del haz sobre el CRT** — el efecto de barrido con estela degradada puede saturar visualmente sobre el filtro CRT del sitio y ocultar los ecos. Mitigación: eco y haz en niveles de brillo claramente distintos (eco muy brillante, estela tenue), afinado con `/frontend-design` si hace falta.
- **Concentración de minas al spawnear en el borde** — si varias minas entran por el mismo punto, llegan como un muro. Mitigación: repartir los puntos de entrada de cada oleada en sectores distintos del perímetro.
