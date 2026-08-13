# SPEC — ZAPADOR jugable + leaderboard (variante A — misiones por nivel con reloj y detector)

> **Estado:** Candidata (game jam)
> **Depende de:** 06-leaderboard-catalogo-supabase
> **Fecha:** 2026-08-11
> **Objetivo:** Crear el motor de ZAPADOR en `components/games/zapador/`, un buscaminas de acción donde un zapador cruza a pie un campo minado a oscuras revelando el número de minas adyacentes a cada paso, con niveles cronometrados, detector recargable y 3 vidas; integrarlo en `GamePlayer` vía el registry y dar de alta su fila de catálogo y su leaderboard real.

## Alcance

**Dentro del alcance:**

- **Motor del juego** (`components/games/zapador/engine.ts`) — grilla lógica de 20×15 celdas de 32px (canvas 640×480). El jugador es un zapador que ocupa una celda y se mueve celda a celda con las flechas. Todo el campo arranca a oscuras; **al entrar en una celda se revela su número de minas adyacentes** (0–8, igual que Buscaminas). Objetivo de cada nivel: llegar a la celda de **salida** (esquina opuesta a la entrada) antes de que se acabe el reloj.
  - **Movimiento por pasos con cooldown**, no continuo: `STEP_COOLDOWN_MS = 120` entre celdas; manteniendo la flecha se avanza a ritmo constante. Sólo ortogonal (sin diagonales), sin wrap en los bordes.
  - **Pisar una mina** — cuesta 1 vida de 3, detona con flash y devuelve al zapador a la celda de entrada del nivel; el mapa revelado **se conserva** (la información ganada no se pierde), la mina detonada queda visible e inofensiva.
  - **Detector (recurso)** — tecla `D`: revela el número de minas adyacentes de las 8 celdas alrededor del zapador sin moverse. Arranca con 3 cargas por nivel, +1 carga por cada 20 celdas nuevas pisadas.
  - **Banderas** — tecla `F` marca/desmarca la celda **adyacente en la dirección mirada** (sin pisarla). Puramente informativa, no bloquea el paso, pero una bandera correcta da puntos al terminar el nivel.
  - **Reloj por nivel** — `LEVEL_TIME_S = 60`, mostrado dentro del canvas como barra. Si llega a 0, se pierde 1 vida y el nivel se reinicia con un campo nuevo.
  - **Progresión** — 6 niveles; la densidad de minas sube por nivel (ver constantes). Completar el nivel 6 entra en estado `win` y dispara `onGameOver`.
  - **Game over** — al perder la tercera vida (por mina o por reloj).
- **Wrapper de React** (`components/games/zapador/zapador-canvas.tsx`) — client component que monta el motor en un `<canvas width={640} height={480}>` vía `useEffect`/`ref`, escala por CSS dentro de `.crt-screen`, expone `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver` y la prop `paused`. Cleanup: cancela `requestAnimationFrame` y remueve `keydown`/`keyup`.
- **Registro en `components/games/registry.ts`** — entrada `zapador` → `dynamic(() => import(".../zapador-canvas"), { ssr: false })`. El registry ya existe (spec 07), no hace falta paso 0.
- **Integración en `GamePlayer`** — conecta `score`, `lives` y `level` a las casillas ya existentes del HUD (mismo cableado que Arkanoid, sin condicionales nuevas); `onGameOver` → `saveScoreAction`. El contador de cargas del detector y el reloj se dibujan dentro del canvas, no en el HUD.
- **Controles** — `←` `→` `↑` `↓` mover un paso (y fijar la dirección mirada), `D` usar detector, `F` marcar bandera en la celda de enfrente; todos con `preventDefault` mientras el canvas está montado. Sin mouse.
- **Catálogo (`games`)** — fila **nueva** vía `mcp__supabase__apply_migration` (`insert`, el id `zapador` no existe hoy): `cat = 'ARCADE'`, `color = 'yellow'`, `cover = 'cover-zapador'`, `plays = '0'`.
- **Leaderboard real** — agregar `"zapador"` a `GAMES_WITH_REAL_SCORES` en `lib/actions/scores.ts`.
- **Portada** — clase nueva `.cover-zapador` en `app/globals.css` (silueta de zapador sobre una grilla con un cono de linterna amarillo), diseñada con `/frontend-design` durante `/spec-impl`.

**Fuera de alcance (diferido):**

- **Controles táctiles/mobile** — diferido.
- **Sonido** — diferido (un beep de detector sería el primer candidato de una iteración futura).
- **Sprites / assets** — el zapador, las minas y la salida se dibujan con formas vectoriales y texto sobre canvas; no hay assets en `references/source_assets/` para este concepto (verificado: solo existe `snake-assets`).
- **Enemigos móviles / disparo** — no hay adversarios activos; la amenaza es estática (las minas) más el reloj.
- **Niveles diseñados a mano** — todos los campos son generados al azar con la densidad del nivel; no hay mapas fijos.

## Modelo de datos

```ts
// components/games/zapador/engine.ts
export interface ZapadorCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
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
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

Estructuras internas (no exportadas):

```ts
interface Cell {
  mine: boolean;
  adjacent: number; // 0..8
  known: boolean; // ya revelada por paso o detector
  flagged: boolean;
  detonated: boolean;
}

type Dir = "up" | "down" | "left" | "right";

interface Sapper {
  col: number;
  row: number;
  facing: Dir;
}
```

Constantes de balance (`engine.ts`):

```ts
const CANVAS_W = 640;
const CANVAS_H = 480;
const CELL = 32;
const COLS = 20; // 640 / 32
const ROWS = 15; // 480 / 32

const START_LIVES = 3;
const STEP_COOLDOWN_MS = 120;
const LEVEL_TIME_S = 60;
const TOTAL_LEVELS = 6;

// minas por nivel (sobre 300 celdas; entrada, salida y sus vecinas siempre libres)
const MINES_PER_LEVEL = [20, 30, 42, 55, 70, 88];

const DETECTOR_START_CHARGES = 3;
const DETECTOR_RECHARGE_EVERY_STEPS = 20; // celdas nuevas pisadas

const POINTS_PER_NEW_CELL = 10; // celda pisada por primera vez
const POINTS_PER_CORRECT_FLAG = 20; // cobrado al completar el nivel
const LEVEL_CLEAR_BONUS = 500; // × número de nivel
const TIME_BONUS_PER_SECOND = 10; // segundos restantes al llegar a la salida
```

Fila de catálogo (`games`, `insert` — el id es nuevo, no hay fila previa que renombrar):

```sql
insert into games (id, title, short, long, cat, cover, color, plays)
values (
  'zapador',
  'ZAPADOR',
  'Cruza el campo minado a pie, paso a paso, contra el reloj.',
  'Eres el zapador: cada paso que das te dice cuantas minas te rodean, y nada mas. Seis campos cada vez mas sembrados, un detector con cargas contadas, sesenta segundos por campo y tres vidas. La logica del buscaminas, pero caminando dentro de el.',
  'ARCADE',
  'cover-zapador',
  'yellow',
  '0'
);
```

## Plan de implementación

1. **Crear `components/games/zapador/engine.ts`** — estado encapsulado en `createZapadorEngine(canvas, callbacks)`, sin globals de módulo:
   - `startLevel(n)` — genera `Cell[][]` de 20×15, reparte `MINES_PER_LEVEL[n-1]` minas al azar excluyendo la celda de entrada `(0, ROWS-1)`, la de salida `(COLS-1, 0)` y las 8 vecinas de ambas; calcula adyacencias; sitúa al zapador en la entrada y revela su celda; reinicia el reloj a 60s y el detector a 3 cargas.
   - **Garantía de camino:** tras repartir minas, BFS desde la entrada por celdas sin mina; si la salida no es alcanzable, se limpian minas del camino más corto encontrado ignorando minas hasta abrirlo (o se rehace el reparto, máximo 20 intentos antes de caer al despeje forzado). Verificable con un test manual: ningún nivel generado puede ser imposible.
   - `step(dir)` — respeta `STEP_COOLDOWN_MS`, fija `facing`, clamp a bordes; al entrar: si la celda es mina no detonada → `detonate()`; si es nueva → `known = true`, `+POINTS_PER_NEW_CELL`, contador de pasos para recarga del detector; si es la salida → `completeLevel()`.
   - `useDetector()` — si quedan cargas, marca `known = true` en las 8 vecinas (sin revelar si son mina: solo su número de adyacencia; una vecina con mina se muestra como celda "peligro" detectada, ver decisión más abajo).
   - `toggleFlag()` — sobre la celda en `facing`.
   - `detonate()` — flash 400ms, `lives--`, `onLivesChange`, zapador de vuelta a la entrada, mapa conservado; si `lives === 0` → `gameOver()`.
   - `tickClock(dt)` — descuenta el reloj; a 0 → `lives--` y `startLevel(mismo nivel)` con campo nuevo.
   - `completeLevel()` — suma `POINTS_PER_CORRECT_FLAG` por bandera correcta, `LEVEL_CLEAR_BONUS * level`, `TIME_BONUS_PER_SECOND * segundos restantes`; `onLevelChange`; nivel siguiente o `win`.
   - Loop con `requestAnimationFrame` y acumulador de tiempo (el reloj y el cooldown de paso no dependen del refresco de pantalla). Dibujo: niebla sobre celdas desconocidas, número en las conocidas, zapador, salida, minas detonadas, barra de reloj, cargas de detector.
   - `destroy()` idempotente: cancela el `rAF` y remueve `keydown`/`keyup`.
   - Verificable de forma aislada: compila con `tsc` sin `any`, sin efectos de import.

2. **Crear `components/games/zapador/zapador-canvas.tsx`** — client component con `<canvas width={640} height={480}>` y `style={{ width: "100%", height: "100%", display: "block" }}`. `useEffect` sin dependencias para montar/destruir el engine + `useEffect` de sincronización de `paused`.

3. **Agregar entrada en `components/games/registry.ts`** — `zapador: { Canvas: dynamic(() => import("@/components/games/zapador/zapador-canvas"), { ssr: false }) }`.

4. **Integrar en `components/game-player.tsx`** — conectar `score`/`lives`/`level` al HUD existente; `onGameOver` → `saveScoreAction({ gameId: 'zapador', name, score })`.

5. **Migración Supabase (`mcp__supabase__apply_migration`)** — `insert into games (...)` con la fila de arriba. Verificable con `select * from games where id = 'zapador'`.

6. **`lib/actions/scores.ts`** — agregar `"zapador"` a `GAMES_WITH_REAL_SCORES`.

7. **Portada** — diseñar `.cover-zapador` en `app/globals.css` con `/frontend-design`.

8. **Verificación manual en navegador** — `npm run dev`, `/games/zapador/jugar`: las flechas mueven al zapador a ritmo constante sin scrollear la página, cada celda nueva muestra su número, `D` revela el anillo de 8 vecinas y descuenta una carga, `F` marca la celda de enfrente, pisar una mina resta vida y devuelve a la entrada conservando el mapa, llegar a la salida suma bonus y pasa de nivel, el reloj a 0 resta vida y regenera el campo, la tercera vida perdida abre el modal con el score real; "GUARDAR PUNTUACIÓN" inserta en `scores` (visible en `/games/zapador` y `/salon` tras refrescar). Comprobar en 10 partidas seguidas que ningún nivel generado deja la salida inalcanzable. Confirmar que ningún otro juego cambia de comportamiento.

9. **`npm run build`** — compila sin errores de tipos ni de lint.

## Criterios de aceptación

Base (heredados, no omitir):

- [ ] `components/games/zapador/engine.ts` existe, exporta `createZapadorEngine`, sin `any`, sin acceder al DOM fuera de las funciones del engine.
- [ ] `components/games/zapador/zapador-canvas.tsx` existe, monta el canvas en `useEffect` y lo destruye (cancela loop, remueve listeners de teclado) al desmontar.
- [ ] El HUD de React refleja en vivo `score`, `vidas` y `nivel` reales del motor.
- [ ] El botón "PAUSA" congela el canvas (loop, reloj y cooldown detenidos) y "REANUDAR" lo continúa exactamente donde quedó.
- [ ] Al perder la tercera vida o completar el nivel 6, se abre automáticamente el modal de fin de partida con la puntuación final real, y "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` (visible en `/games/zapador` y `/salon` tras refrescar).
- [ ] El canvas escala visualmente al tamaño de `.crt-screen` sin deformarse en al menos dos anchos de ventana distintos.
- [ ] El juego aparece en el grid de `/games` con datos reales de Supabase (`games`), categoría ARCADE.
- [ ] Ningún otro juego del catálogo cambia de comportamiento.
- [ ] `npm run build` compila sin errores de tipos ni de lint.

Específicos de este juego:

- [ ] Al pisar una celda por primera vez se revela su número de minas adyacentes y se suman 10 puntos; volver a pisarla no suma nada.
- [ ] El movimiento respeta un cooldown de 120ms por celda: mantener la flecha avanza a ritmo constante, no un salto por evento de teclado.
- [ ] `D` revela las 8 celdas vecinas y descuenta una carga; sin cargas, no hace nada; se recupera 1 carga cada 20 celdas nuevas pisadas.
- [ ] `F` marca/desmarca la celda inmediatamente en la dirección mirada, sin moverse ni pisarla.
- [ ] Pisar una mina resta 1 vida, devuelve al zapador a la entrada y **conserva** el mapa revelado; la mina queda visible y ya no vuelve a detonar.
- [ ] Llegar a la salida completa el nivel y suma bonus fijo (500 × nivel), bonus de tiempo (10 × segundos restantes) y 20 por cada bandera correcta.
- [ ] El reloj de 60s por nivel se agota → 1 vida menos y campo nuevo del mismo nivel.
- [ ] En ningún nivel generado la salida queda inalcanzable (verificación BFS al generar).

## Decisiones tomadas y descartadas

- **La información se gana caminando (no clickeando)** — es la premisa que separa a ZAPADOR de `buscaminas`: no es un tablero que se resuelve desde fuera, es un campo que se atraviesa desde dentro, con el coste de que cada consulta te expone. Se descartó permitir revelar celdas a distancia libremente (sería Buscaminas con otro skin).
- **Reloj de 60s por nivel — diferencia central con la variante B** — la presión temporal es lo que convierte la deducción en decisión rápida: siempre puedes ir seguro, pero no te alcanza el tiempo. Se descartó el juego sin reloj (opción de la variante B, que en cambio presiona con un scroll continuo). Alguien elige esta variante si quiere una campaña estructurada, con objetivos, recursos y final; elige la B si quiere una sola sesión de tensión continua y récord puro.
- **6 niveles con final (`win`) en vez de infinito** — se descartó el endless aquí a propósito: con detector, banderas y bonus de tiempo, el diseño ya tiene suficientes sistemas; un final acotado hace legible la curva.
- **Detector como recurso limitado, no como visión permanente** — se descartó dar visión de radio 1 gratis y continua porque eliminaría toda decisión: el juego se reduce a caminar mirando el radar. Las cargas obligan a elegir _cuándo_ mirar.
- **El detector revela la adyacencia de las vecinas, no si son mina** — se descartó el detector que dice "hay mina ahí" porque resuelve el puzzle en vez de informarlo; revelar sus números mantiene la deducción como la mecánica principal.
- **Al morir se conserva el mapa revelado** — se descartó reiniciar el campo entero tras cada mina porque castiga con pérdida de información, lo más frustrante posible en un juego de deducción; la vida perdida ya es castigo suficiente.
- **Sin diagonales** — se descartó el movimiento en 8 direcciones porque volvería ambigua la lectura de "la celda de enfrente" para las banderas y complicaría el cooldown.
- **BFS de verificación al generar el campo** — se descartó confiar en que un reparto aleatorio siempre deja camino: con 88 minas sobre 300 celdas la probabilidad de un muro infranqueable no es despreciable, y un nivel imposible es un game over injusto garantizado.
- **Reloj y cargas dentro del canvas, no en el HUD** — se descartó agregar callbacks nuevos a `PlayableGameProps` (`onTimeChange`, `onChargesChange`): dispararían por segundo/por uso para todos los juegos y el HUD compartido no tiene casillas para ellos.
- **Formas vectoriales, sin assets** — se descartó buscar spritesheets: no hay nada en `references/source_assets/` para este concepto y el estilo neón/CRT del sitio se sostiene bien con vectores (precedente: ROCAS).

## Riesgos identificados

Reutilizados de spec 05 (aplican igual aquí):

- **Scroll de página por teclas capturadas** — flechas y letras de acción. Mitigación: `preventDefault()` en los códigos usados mientras el canvas está montado.
- **Doble montaje en desarrollo (`StrictMode`)** — dos loops harían correr el reloj al doble de velocidad. Mitigación: `destroy()` idempotente, verificado en dev.
- **Listeners de teclado globales entre navegaciones** — mitigación: `destroy()` remueve `keydown`/`keyup` al salir.
- **Callbacks disparando renders excesivos** — mitigación: comparar contra el valor previo antes de invocar cada callback.

Propios de este juego:

- **Campo generado imposible (salida inalcanzable)** — riesgo real con densidad alta. Mitigación: BFS de validación con hasta 20 re-repartos y despeje forzado del camino como último recurso.
- **Tensión entre reloj y deducción** — si 60s resultan demasiado poco para un campo de 88 minas, el juego degenera en correr al azar (justo lo que el diseño quiere evitar). Mitigación: `LEVEL_TIME_S` y `MINES_PER_LEVEL` son las dos constantes a ajustar en playtest; están aisladas y documentadas.
- **Cooldown de paso mal implementado (ligado a frames)** — a 144Hz el zapador se movería más rápido que a 60Hz. Mitigación: acumulador de tiempo real (`performance.now()`), no conteo de frames.
- **Auto-repeat de `D`/`F`** — mantener la tecla podría gastar todas las cargas o alternar banderas sin control. Mitigación: procesar `D` y `F` solo en el flanco de bajada (ignorar `event.repeat`).
- **Sobrecarga de sistemas para un solo spec** — detector + banderas + reloj + vidas + bonus es mucha superficie para una primera implementación; el riesgo es que ningún sistema quede bien afinado. Mitigación: si hay que recortar, el orden de sacrificio es banderas → detector → bonus de tiempo (y en el extremo, se está describiendo la variante B).
- **Legibilidad de celdas de 32px con niebla** — números pequeños sobre celdas oscuras en un CRT escalado pueden costar de leer. Mitigación: contraste alto por número y celda conocida claramente diferenciada de la niebla.
