# SPEC — DRAGAMINAS jugable + leaderboard (variante A — sonar por pings, batería limitada, campo invisible)

> **Estado:** Candidata (game jam)
> **Depende de:** 06-leaderboard-catalogo-supabase
> **Fecha:** 2026-08-11
> **Objetivo:** Crear el motor de DRAGAMINAS en `components/games/dragaminas/`, un juego de navegación a ciegas donde un buque barreminas cruza un campo de minas navales invisibles usando pings de sonar con batería limitada y cargas de profundidad para neutralizarlas; integrarlo en `GamePlayer` vía el registry y dar de alta su fila de catálogo y su leaderboard real.

## Alcance

**Dentro del alcance:**

- **Motor del juego** (`components/games/dragaminas/engine.ts`) — espacio **continuo** (no grilla), resolución lógica fija 800×600, vista cenital de un mar oscuro. El jugador controla un buque con inercia; el campo está sembrado de minas fijas **invisibles**. La única información viene del sonar.
  - **Buque** — rotación con `←`/`→` (`SHIP_TURN_RAD_S = 3.2`), empuje con `↑` (`SHIP_THRUST = 190 px/s²`), fricción de agua `SHIP_DRAG = 0.985` por frame de 16ms, velocidad máxima `SHIP_MAX_SPEED = 210 px/s`. Sin marcha atrás. Bordes del canvas: pared sólida (el buque rebota perdiendo el 50% de la velocidad), no wrap.
  - **Ping de sonar** (`Espacio`) — emite un anillo expansivo desde el buque (`PING_SPEED = 420 px/s`, alcance `PING_RANGE = 320 px`). Cuando el anillo alcanza una mina, esa mina se dibuja como un eco brillante que se va apagando en `ECHO_FADE_MS = 3500` ms. Consume `PING_COST = 20` de batería.
  - **Batería** — 100 unidades, recarga `BATTERY_REGEN_PER_S = 6` mientras el buque no empuja (motor apagado = más energía al sonar). El coste real del diseño: para ver hay que quedarse quieto, y quedarse quieto no avanza el reloj de misión.
  - **Cargas de profundidad** (`X`) — suelta una carga en la posición del buque; detona tras `CHARGE_FUSE_MS = 900` con radio `CHARGE_RADIUS = 46`. Neutraliza cualquier mina en el radio (+ puntos) — y también daña al propio buque si sigue dentro del radio al detonar. Munición ilimitada, pero el fusible obliga a alejarse.
  - **Minas** — estáticas, radio de contacto `MINE_RADIUS = 14`, radio de detonación `MINE_BLAST = 30`. Chocar contra una cuesta 1 vida de 3 y respawnea el buque en el punto de entrada con 2 segundos de invulnerabilidad; la mina impactada desaparece (detonó).
  - **Progresión por niveles** — 5 niveles; el objetivo de cada uno es **neutralizar todas las minas del campo**. `MINES_PER_LEVEL = [6, 9, 13, 17, 22]`, repartidas al azar respetando `MIN_MINE_DISTANCE = 70` px entre sí y una zona segura de radio 120 alrededor del punto de entrada. Al completar el nivel 5 → estado `win`.
  - **Game over** — al perder la tercera vida.
- **Wrapper de React** (`components/games/dragaminas/dragaminas-canvas.tsx`) — client component que monta el motor en un `<canvas width={800} height={600}>` vía `useEffect`/`ref`, escala por CSS dentro de `.crt-screen`, expone `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver` y la prop `paused`. Cleanup: cancela `requestAnimationFrame` y remueve `keydown`/`keyup`.
- **Registro en `components/games/registry.ts`** — entrada `dragaminas` → `dynamic(() => import(".../dragaminas-canvas"), { ssr: false })`. El registry ya existe (spec 07), no hace falta paso 0.
- **Integración en `GamePlayer`** — conecta `score`, `lives` y `level` a las casillas ya existentes del HUD (mismo cableado que Arkanoid, sin condicionales nuevas); `onGameOver` → `saveScoreAction`. La batería se dibuja dentro del canvas (barra), no en el HUD.
- **Controles** — `←`/`→` girar, `↑` empujar, `Espacio` ping de sonar, `X` soltar carga de profundidad; todos con `preventDefault` mientras el canvas está montado. Sin mouse.
- **Catálogo (`games`)** — fila **nueva** vía `mcp__supabase__apply_migration` (`insert`, el id `dragaminas` no existe hoy): `cat = 'SHOOTER'`, `color = 'green'`, `cover = 'cover-dragaminas'`, `plays = '0'`.
- **Leaderboard real** — agregar `"dragaminas"` a `GAMES_WITH_REAL_SCORES` en `lib/actions/scores.ts`.
- **Portada** — clase nueva `.cover-dragaminas` en `app/globals.css` (anillos de sonar verdes sobre fondo negro con un eco puntual), diseñada con `/frontend-design` durante `/spec-impl`.

**Fuera de alcance (diferido):**

- **Controles táctiles/mobile** — diferido.
- **Sonido** — diferido, aunque el ping de sonar es el candidato más obvio del catálogo para una futura capa de audio.
- **Sprites / assets** — todo vectorial (buque como triángulo alargado, minas como círculos con espinas, ecos como anillos); no hay assets de respaldo en `references/source_assets/` (solo existe `snake-assets`).
- **Corrientes marinas / deriva del buque** — diferido; el agua solo aporta fricción.
- **Minas móviles o inteligentes** — todas las minas de esta variante son estáticas (las móviles son el terreno de la variante B).

## Modelo de datos

```ts
// components/games/dragaminas/engine.ts
export interface DragaminasCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
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
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
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
  invulnerableUntil: number; // ms
}

interface Mine {
  pos: Vec;
  alive: boolean;
  echoUntil: number; // ms — hasta cuándo se dibuja el eco del último ping
}

interface Ping {
  origin: Vec;
  radius: number;
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

const SHIP_TURN_RAD_S = 3.2;
const SHIP_THRUST = 190; // px/s²
const SHIP_DRAG = 0.985; // por paso de 16ms
const SHIP_MAX_SPEED = 210; // px/s
const SHIP_RADIUS = 11;
const WALL_BOUNCE = 0.5;
const RESPAWN_INVULN_MS = 2000;

const PING_SPEED = 420; // px/s
const PING_RANGE = 320; // px
const PING_COST = 20;
const ECHO_FADE_MS = 3500;

const BATTERY_MAX = 100;
const BATTERY_REGEN_PER_S = 6; // solo con el motor apagado

const CHARGE_FUSE_MS = 900;
const CHARGE_RADIUS = 46;

const MINE_RADIUS = 14;
const MINE_BLAST = 30;
const MIN_MINE_DISTANCE = 70;
const SAFE_SPAWN_RADIUS = 120;

const START_LIVES = 3;
const TOTAL_LEVELS = 5;
const MINES_PER_LEVEL = [6, 9, 13, 17, 22];

const POINTS_PER_MINE = 150;
const LEVEL_CLEAR_BONUS = 600; // × número de nivel
const NO_DAMAGE_LEVEL_BONUS = 400; // nivel completado sin perder vidas
```

Fila de catálogo (`games`, `insert` — el id es nuevo, no hay fila previa que renombrar):

```sql
insert into games (id, title, short, long, cat, cover, color, plays)
values (
  'dragaminas',
  'DRAGAMINAS',
  'Navega a ciegas y limpia el mar con sonar y cargas de profundidad.',
  'Un mar negro sembrado de minas que no puedes ver. Cada ping de sonar te devuelve un eco fugaz y te cuesta bateria, y la bateria solo se recarga con el motor apagado. Suelta cargas de profundidad, alejate del fusible y limpia los cinco campos sin perder tus tres cascos.',
  'SHOOTER',
  'cover-dragaminas',
  'green',
  '0'
);
```

## Plan de implementación

1. **Crear `components/games/dragaminas/engine.ts`** — estado encapsulado en `createDragaminasEngine(canvas, callbacks)`, sin globals de módulo:
   - `startLevel(n)` — reparte `MINES_PER_LEVEL[n-1]` minas con rechazo por distancia (`MIN_MINE_DISTANCE` entre minas, `SAFE_SPAWN_RADIUS` respecto al punto de entrada, centro-izquierda del canvas); resetea buque, batería y listas de pings/cargas.
   - Integración del buque por paso de tiempo fijo (acumulador de 16ms) para que el balance no dependa del refresco: rotación, empuje según `angle`, `drag`, clamp a `SHIP_MAX_SPEED`, rebote en los cuatro bordes con `WALL_BOUNCE`.
   - `emitPing()` — si `battery >= PING_COST`, descuenta y crea un `Ping{origin: ship.pos, radius: 0}`. Cada frame, `radius += PING_SPEED * dt`; para cada mina viva cuya distancia al origen esté dentro de `[radius - 6, radius + 6]`, se fija `echoUntil = now + ECHO_FADE_MS`. El ping se descarta al superar `PING_RANGE`.
   - `dropCharge()` — añade `DepthCharge{pos: ship.pos, detonatesAt: now + CHARGE_FUSE_MS}`. Al detonar: destruye toda mina viva a distancia `< CHARGE_RADIUS` (+`POINTS_PER_MINE` cada una, con eco de explosión visible), y si el buque está dentro del radio, cuesta 1 vida.
   - `checkCollisions()` — contacto buque-mina (`dist < SHIP_RADIUS + MINE_RADIUS`) fuera de invulnerabilidad → mina destruida sin puntos, `lives--`, `onLivesChange`, respawn en el punto de entrada con `RESPAWN_INVULN_MS`.
   - `isLevelClear()` — sin minas vivas. Suma `LEVEL_CLEAR_BONUS * level` (+ `NO_DAMAGE_LEVEL_BONUS` si no se perdió vida en el nivel), `onLevelChange`, siguiente nivel o `win`.
   - Batería: `battery = min(BATTERY_MAX, battery + BATTERY_REGEN_PER_S * dt)` solo si `↑` no está pulsada.
   - Dibujo: fondo negro con retícula tenue, buque vectorial, anillos de ping activos, ecos de minas con alfa proporcional al tiempo restante de `echoUntil`, cargas con fusible parpadeante, barra de batería, contador de minas restantes.
   - `destroy()` idempotente: cancela el `rAF` y remueve `keydown`/`keyup`.
   - Verificable de forma aislada: compila con `tsc` sin `any`, sin efectos de import.

2. **Crear `components/games/dragaminas/dragaminas-canvas.tsx`** — client component con `<canvas width={800} height={600}>` y `style={{ width: "100%", height: "100%", display: "block" }}`. `useEffect` sin dependencias para montar/destruir el engine + `useEffect` de sincronización de `paused`.

3. **Agregar entrada en `components/games/registry.ts`** — `dragaminas: { Canvas: dynamic(() => import("@/components/games/dragaminas/dragaminas-canvas"), { ssr: false }) }`.

4. **Integrar en `components/game-player.tsx`** — conectar `score`/`lives`/`level` al HUD existente; `onGameOver` → `saveScoreAction({ gameId: 'dragaminas', name, score })`.

5. **Migración Supabase (`mcp__supabase__apply_migration`)** — `insert into games (...)` con la fila de arriba. Verificable con `select * from games where id = 'dragaminas'`.

6. **`lib/actions/scores.ts`** — agregar `"dragaminas"` a `GAMES_WITH_REAL_SCORES`.

7. **Portada** — diseñar `.cover-dragaminas` en `app/globals.css` con `/frontend-design`.

8. **Verificación manual en navegador** — `npm run dev`, `/games/dragaminas/jugar`: el buque gira y acelera con inercia y rebota en los bordes; `Espacio` emite un anillo que ilumina las minas que toca y descuenta 20 de batería; con el motor apagado la batería sube; `X` suelta una carga que detona a los 0.9s y neutraliza minas cercanas (+150 cada una) y también daña al buque si sigue encima; chocar con una mina resta vida y respawnea con invulnerabilidad visible; limpiar el campo pasa de nivel (HUD "Nivel"); la tercera vida perdida abre el modal con el score real y "GUARDAR PUNTUACIÓN" inserta en `scores` (visible en `/games/dragaminas` y `/salon` tras refrescar). Confirmar que ningún otro juego cambia de comportamiento.

9. **`npm run build`** — compila sin errores de tipos ni de lint.

## Criterios de aceptación

Base (heredados, no omitir):

- [ ] `components/games/dragaminas/engine.ts` existe, exporta `createDragaminasEngine`, sin `any`, sin acceder al DOM fuera de las funciones del engine.
- [ ] `components/games/dragaminas/dragaminas-canvas.tsx` existe, monta el canvas en `useEffect` y lo destruye (cancela loop, remueve listeners de teclado) al desmontar.
- [ ] El HUD de React refleja en vivo `score`, `vidas` y `nivel` reales del motor.
- [ ] El botón "PAUSA" congela el canvas (loop, pings, fusibles y regeneración de batería detenidos) y "REANUDAR" lo continúa exactamente donde quedó.
- [ ] Al perder la tercera vida o completar el nivel 5, se abre automáticamente el modal de fin de partida con la puntuación final real, y "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` (visible en `/games/dragaminas` y `/salon` tras refrescar).
- [ ] El canvas escala visualmente al tamaño de `.crt-screen` sin deformarse en al menos dos anchos de ventana distintos.
- [ ] El juego aparece en el grid de `/games` con datos reales de Supabase (`games`), categoría SHOOTER.
- [ ] Ningún otro juego del catálogo cambia de comportamiento.
- [ ] `npm run build` compila sin errores de tipos ni de lint.

Específicos de este juego:

- [ ] Las minas son invisibles por defecto: solo se dibujan como eco tras ser alcanzadas por un ping, con desvanecimiento de 3.5s.
- [ ] Cada ping cuesta 20 de batería y no puede emitirse sin batería suficiente; la batería solo se recarga (6/s) con el motor apagado.
- [ ] El anillo de ping se expande a 420 px/s y desaparece al alcanzar 320 px de radio.
- [ ] Una carga de profundidad detona 900ms después de soltarse, neutraliza toda mina a menos de 46px (+150 puntos cada una) y **también** resta una vida si el buque sigue dentro del radio.
- [ ] Chocar con una mina resta 1 vida (sin sumar puntos), destruye la mina y respawnea el buque con 2s de invulnerabilidad visible.
- [ ] Al neutralizar la última mina del campo se pasa automáticamente al nivel siguiente, con bonus 600 × nivel y 400 extra si no se perdió ninguna vida en ese nivel.
- [ ] El buque rebota en los bordes del canvas perdiendo la mitad de su velocidad (sin wrap-around).
- [ ] Ningún campo generado coloca una mina a menos de 120px del punto de entrada ni dos minas a menos de 70px entre sí.

## Decisiones tomadas y descartadas

- **Minas invisibles + sonar de recurso — diferencia central con la variante B** — la premisa "buscaminas" aquí se traduce a información escasa y cara: no ves nada, y verlo cuesta batería que solo se recupera parándote. Se descartó mostrar las minas permanentemente (eso es la variante B) porque eliminaría el ingrediente de deducción/memoria que conecta el concepto con el tema del jam. Alguien elige esta variante si quiere tensión lenta, exploración y gestión de recursos; elige la B si quiere acción constante y reflejos.
- **Espacio continuo, no grilla** — se descartó reutilizar la grilla de `buscaminas`/`zapador` para que los tres conceptos del jam no acaben siendo el mismo juego con distinto tema; aquí la deducción es espacial y aproximada (recuerdas dónde viste un eco), no combinatoria.
- **Rebote en los bordes, no wrap-around** — se descartó el toroide de ROCAS porque un campo de minas cerrado se lee como un espacio con límites navegables, y el wrap permitiría escapar de una situación comprometida sin coste.
- **Batería que solo regenera con el motor apagado** — se descartó la regeneración constante porque anularía la elección: con recarga pasiva, la estrategia óptima sería pinguear sin parar. El acoplamiento motor/sonar es el corazón del diseño.
- **Cargas de profundidad con fusible y daño propio** — se descartó el disparo directo instantáneo (estilo ROCAS) porque convertiría el juego en un shooter y quitaría el peso del posicionamiento; el fusible obliga a comprometerse con una decisión y retirarse.
- **Munición ilimitada de cargas** — se descartó limitarla: ya hay dos recursos escasos (batería y vidas), un tercero volvería el juego tacaño sin añadir decisiones nuevas.
- **Chocar con una mina no da puntos** — se descartó premiar la "limpieza por embestida"; si detonar con el casco puntuara, la estrategia degenerada sería ignorar el sonar y arrasar el campo a golpes.
- **5 niveles con final (`win`) en vez de oleadas infinitas** — se descartó el endless aquí para que la variante B pueda ocupar ese espacio; además el campo estático se agota naturalmente al limpiarse.
- **Batería dibujada en el canvas, no en el HUD** — se descartó agregar un callback nuevo a `PlayableGameProps` (se actualizaría continuamente y el HUD compartido no tiene casilla para ello).
- **Todo vectorial, sin assets** — se descartó buscar sprites: no hay assets navales en `references/source_assets/` y el look "pantalla de sonar" es precisamente vectorial (precedente directo: ROCAS).

## Riesgos identificados

Reutilizados de spec 05 (aplican igual aquí):

- **Scroll de página por teclas capturadas** — `↑`/`←`/`→`/`Espacio` scrollean el contenedor del `.crt`. Mitigación: `preventDefault()` en los códigos usados mientras el canvas está montado.
- **Doble montaje en desarrollo (`StrictMode`)** — dos loops duplicarían velocidades y consumo de batería. Mitigación: `destroy()` idempotente, verificado en dev.
- **Listeners de teclado globales entre navegaciones** — mitigación: `destroy()` remueve `keydown`/`keyup` al salir.
- **Callbacks disparando renders excesivos** — mitigación: comparar contra el valor previo antes de invocar cada callback.

Propios de este juego:

- **Frustración por invisibilidad total** — un jugador que no entiende el acoplamiento motor/batería puede pasar el primer minuto chocando a ciegas y abandonar. Mitigación: el nivel 1 tiene solo 6 minas y una zona segura amplia; el eco de 3.5s es generoso a propósito. Si en playtest sigue siendo opaco, la primera palanca es subir `ECHO_FADE_MS`.
- **Memoria del jugador como única persistencia de información** — los ecos se apagan y no queda registro en pantalla de dónde estaban las minas. Es intencional, pero puede resultar injusto en los niveles de 17–22 minas. Mitigación posible (no incluida en este spec, anotada como iteración): dejar una marca tenue permanente en la posición del último eco confirmado.
- **Daño propio por carga de profundidad percibido como bug** — morir por tu propia carga sin entender por qué es la queja más probable. Mitigación: el radio de la carga se dibuja como círculo de aviso mientras el fusible corre, y la carga parpadea acelerando antes de detonar.
- **Reparto aleatorio con rechazo puede no converger** — con 22 minas, `MIN_MINE_DISTANCE = 70` y la zona segura, el muestreo por rechazo podría iterar mucho o quedarse sin sitio. Mitigación: máximo de 200 intentos por mina y relajación progresiva de `MIN_MINE_DISTANCE` (hasta 50) si no converge.
- **Integración de física dependiente del framerate** — con `SHIP_DRAG` aplicado por frame, el comportamiento cambiaría entre 60Hz y 144Hz. Mitigación: paso de simulación fijo de 16ms con acumulador, `drag` aplicado por paso, no por frame renderizado.
- **Precisión del anillo de ping** — a 420 px/s y 60fps el anillo avanza 7px por frame; con una banda de detección de ±6px una mina podría quedar "entre frames" y no devolver eco. Mitigación: banda de detección ligada al avance real del frame (`max(6, PING_SPEED * dt)`), no un valor fijo.
