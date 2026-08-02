# SPEC 05 — Asteroids jugable (rocas)

> **Estado:** Implementado
> **Depende de:** 04-supabase-base-setup
> **Fecha:** 2026-08-01
> **Objetivo:** Portar el motor de canvas de `references/started-games/02-asteroids/game.js` a un componente cliente de Next.js (`components/games/asteroids/`) e integrarlo en `GamePlayer` para que el juego "ROCAS" sea jugable de verdad, con HUD y guardado de puntaje reales en vez del arena simulada.

## Alcance

**Dentro del alcance:**

- **Motor del juego** (`components/games/asteroids/engine.ts`) — port a TypeScript de las clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp` y el loop (`update`/`draw`/`requestAnimationFrame`) de `game.js`, fiel al original: envolvimiento toroidal, división de asteroides por tamaño, invencibilidad parpadeante, partículas de explosión, power-up de disparo triple. Resolución lógica fija 800×600.
- **Wrapper de React** (`components/games/asteroids/asteroids-canvas.tsx`) — client component que monta el motor en un `<canvas>` vía `useEffect`/`ref`, escala el canvas por CSS al contenedor `.crt-screen` (mantiene `aspect-ratio: 4/3`), expone:
  - Callbacks `onScoreChange`, `onLivesChange`, `onLevelChange` (se disparan solo cuando el valor cambia, no cada frame).
  - Callback `onGameOver(score)` cuando el motor pasa a `state: 'gameover'`.
  - Prop `paused: boolean` — el wrapper congela/reanuda el loop del motor cuando cambia (control lo tiene el contenedor, no el motor).
  - Cleanup en desmontaje: cancela `requestAnimationFrame` y remueve listeners de teclado.
- **Integración en `GamePlayer`** (`components/game-player.tsx`) — cuando `game.id === 'rocas'`, renderiza `AsteroidsCanvas` en vez del `.game-arena` falso, conecta sus callbacks al estado existente (`score`, `lives`, `level`, `paused`, `over`) y dispara el flujo existente de guardar puntaje (`appendScore`) cuando llega `onGameOver`. El resto de juegos del catálogo sigue usando el arena falsa sin cambios.
- **Controles** — solo teclado (`←` `→` `↑` `Espacio`), igual que el original. Se pierde el foco de teclado del resto de la página mientras se juega (comportamiento ya implícito al capturar `keydown`/`keyup` globales).
- **Power-up de disparo triple** — se porta igual que en `game.js`, incluida su indicación visual en el HUD (`3x Ns` ya existe como estilo en `hud-stat`, se reutiliza o se agrega inline).

**Fuera de alcance (diferido):**

- **Controles táctiles/mobile** — el juego queda jugable solo con teclado; soporte táctil es un spec futuro.
- **Tetris y Arkanoid** (`references/started-games/03-tetris`, `04-arkanoid`) — no se tocan; cada uno tendrá su propio spec siguiendo este mismo patrón de carpeta (`components/games/<id>/`).
- **Persistencia del puntaje en Supabase** — `appendScore` sigue usando `lib/session.ts` (localStorage) como hoy; migrar a Supabase es un spec futuro ya anticipado en el spec 04.
- **Cambios al catálogo** (`lib/data.ts`) — no se toca el registro `rocas` (título, cover, `best`, `plays` estáticos se mantienen como están).
- **Sonido** — `game.js` no tiene audio; este spec tampoco lo agrega.
- **Ajustes de dificultad/balance** — se porta el balance del original tal cual (velocidades, `POWERUP_DROP_CHANCE`, etc.), sin retocar constantes.

## Modelo de datos

Este spec no introduce persistencia ni tablas nuevas — el estado del juego vive solo en memoria mientras dura la partida (igual que el original). Sí define las interfaces TypeScript de la API entre el motor y React:

```ts
// components/games/asteroids/engine.ts
export interface AsteroidsCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface AsteroidsEngine {
  start: () => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export function createAsteroidsEngine(
  canvas: HTMLCanvasElement,
  callbacks: AsteroidsCallbacks,
): AsteroidsEngine;
```

```tsx
// components/games/asteroids/asteroids-canvas.tsx
export interface AsteroidsCanvasProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

Las clases internas del motor (`Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`) son detalle de implementación de `engine.ts`, no se exponen fuera del módulo.

## Plan de implementación

1. **Crear `components/games/asteroids/engine.ts`** — Portar `game.js` a TypeScript: constantes (`W`, `H`, `RADII`, `SPEEDS`, `POINTS`, `POWERUP_*`), utilidades (`wrap`, `dist`, `rand`, `randInt`), clases `Bullet`/`Asteroid`/`Ship`/`Particle`/`PowerUp`, funciones de estado (`spawnAsteroids`, `initGame`, `nextLevel`, `explode`, `killShip`, `update`, `draw`, `drawHUD`, `drawOverlay`). Encapsular todo dentro de `createAsteroidsEngine(canvas, callbacks)` (sin globals de módulo) para poder crear/destruir instancias limpiamente. Los callbacks se invocan desde `killShip`/las transiciones de `score`/`level`/`state`. Verificable de forma aislada: el archivo compila con `tsc` sin `any` y sin efectos de import (no toca el DOM hasta que se llama `start()`).

2. **Crear `components/games/asteroids/asteroids-canvas.tsx`** — Client component (`"use client"`) con `<canvas width={800} height={600}>` estilado con CSS (`width: 100%; height: 100%; display: block`) para escalar dentro de `.crt-screen`. En `useEffect`: crea el engine con `createAsteroidsEngine`, llama `start()`, retorna cleanup que llama `destroy()`. Un segundo `useEffect` sincroniza `paused` llamando `engine.pause()`/`engine.resume()`. Sistema sigue funcionando igual para el resto de juegos (componente nuevo, no se importa todavía en ningún lado).

3. **Integrar en `components/game-player.tsx`** — Cuando `game.id === 'rocas'`: renderizar `<AsteroidsCanvas paused={paused} onScoreChange={setScore} onLivesChange={setLives} onLevelChange={setLevel} onGameOver={(finalScore) => { setScore(finalScore); endGame(); }} />` en vez del bloque `.game-arena`, y eliminar el `setInterval` de puntaje falso para este caso (queda condicionado por `game.id !== 'rocas'`). El botón "FIN" existente pasa a ser un salir manual (además del `onGameOver` automático); "PAUSA" ya controla `paused`, que ahora también congela el canvas real.

4. **Verificación manual en navegador** — `npm run dev`, ir a `/games/rocas/jugar`, confirmar: nave controlable con teclado, asteroides se dividen, HUD de React (`score`/`lives`/`level`) se actualiza en vivo, "PAUSA" congela el canvas, al perder las 3 vidas se abre el modal de guardar puntaje con el score real, "GUARDAR PUNTUACIÓN" persiste vía `appendScore` como hoy.

5. **`npm run build`** — compila sin errores de tipos ni de lint.

## Criterios de aceptación

- [x] `components/games/asteroids/engine.ts` existe, exporta `createAsteroidsEngine`, sin `any`, sin acceder al DOM fuera de las funciones del engine (nada se ejecuta al solo importar el módulo).
- [x] `components/games/asteroids/asteroids-canvas.tsx` existe, monta el canvas en `useEffect`, y lo destruye (cancela loop, remueve listeners de teclado) al desmontar.
- [x] En `/games/rocas/jugar` la nave se controla con `←` `→` `↑` `Espacio`, con envolvimiento toroidal de bordes.
- [x] Los asteroides grandes se dividen en medianos y estos en pequeños al recibir un disparo; los pequeños desaparecen sin dividirse.
- [x] El HUD de React (`score`, `lives`, `level`) refleja en vivo los valores reales del motor, no el `setInterval` falso.
- [x] El power-up de disparo triple aparece, se puede recoger, y su indicador temporal se ve en el HUD.
- [x] El botón "PAUSA" congela el canvas (loop detenido) y "REANUDAR" lo continúa exactamente donde quedó.
- [x] Al perder las 3 vidas, se abre automáticamente el modal de fin de partida con la puntuación final real, y "GUARDAR PUNTUACIÓN" la persiste vía `appendScore` (visible luego en `/salon`).
- [x] El canvas escala visualmente al tamaño de `.crt-screen` sin deformarse (mantiene proporción 4:3) en al menos dos anchos de ventana distintos.
- [x] Ningún otro juego del catálogo (`bloque-buster`, `caida`, `serpentina`, etc.) cambia de comportamiento — siguen mostrando el `.game-arena` falso.
- [x] `npm run build` compila sin errores de tipos ni de lint.

## Decisiones tomadas y descartadas

- **Solo `rocas` en este spec** — se descartó portar Tetris/Arkanoid al mismo tiempo porque cada motor tiene su propia arquitectura interna (grilla, colisiones AABB vs. circulares) y merece su propio spec; este define el patrón de carpeta `components/games/<id>/` que los siguientes reutilizan.
- **Callbacks (a) en vez de HUD dibujado en canvas (b)** — se descartó mover el HUD dentro del `draw()` del motor porque el HUD de React (`hud-stat`) ya está estilado y consistente con el resto del sitio (pixel font, glow); duplica menos CSS y mantiene un solo lugar de verdad para el look del HUD.
- **Motor encapsulado en `createAsteroidsEngine()` sin globals de módulo** — se descartó portar `game.js` tal cual (con `let ship, bullets, ...` a nivel de módulo) porque los componentes de Next.js pueden montarse/desmontarse varias veces (navegación client-side, `StrictMode` en dev) y los globals compartidos causarían loops fantasma o estado cruzado entre partidas.
- **Pausa controlada por el contenedor (`paused` prop), no por el motor** — se descartó exponer un botón de pausa dentro del canvas porque el HUD de React ya tiene el botón "PAUSA"; el motor solo obedece, no decide.
- **`onGameOver` dispara el flujo existente automáticamente** — se descartó dejar el fin de partida solo manual (botón "FIN") porque el original ya tiene su propia condición de derrota (`lives <= 0`); ignorarla haría que el jugador tuviera que salir manualmente aunque haya perdido.
- **Resolución lógica fija 800×600, escalada por CSS** — se descartó recalcular `W`/`H` dinámicamente porque cambiaría el balance del juego (velocidades, radios, spawn) respecto al original; escalar visualmente es más simple y no requiere retocar constantes del motor.
- **Se porta el power-up de disparo triple** — aunque no está en el README, sí está en `game.js` y es parte de la experiencia real del juego; se descartó recortarlo solo por no estar documentado.
- **Solo teclado, sin controles táctiles** — se descartó agregar botones on-screen ahora porque cambia la UI del `.crt` y merece su propio diseño; queda diferido explícitamente en el alcance.
- **No se toca `lib/data.ts`** — se descartó actualizar `best`/`plays` del registro `rocas` porque son datos de exhibición del catálogo, no relacionados con la jugabilidad real; cambiarlos no es parte de "hacerlo jugable".

## Riesgos identificados

- **Scroll de página por teclas capturadas** — `game.js` original no llama `preventDefault()` en `keydown` (no hacía falta en una página standalone sin scroll). Dentro de Next.js, `↑` `↓` `Espacio` pueden scrollear la página alrededor del `.crt`. Mitigación: el wrapper debe llamar `preventDefault()` en los códigos de tecla usados por el juego mientras el canvas está montado.
- **Doble montaje en desarrollo (`StrictMode`)** — Next.js en dev invoca `useEffect` dos veces; si `destroy()` no cancela bien el `requestAnimationFrame` y los listeners, pueden quedar dos loops corriendo en paralelo (input duplicado, doble velocidad aparente). Mitigación: `destroy()` debe ser idempotente y verificarse explícitamente en dev antes de dar el spec por cerrado.
- **Listeners de teclado globales entre navegaciones** — si `destroy()` falla en remover `keydown`/`keyup` al salir con "SALIR" o "VOLVER AL VAULT", quedarían listeners húerfanos acumulándose en cada partida jugada, afectando el rendimiento de toda la sesión.
- **Callbacks disparando renders excesivos** — si `onScoreChange` u otros se llaman cada frame en vez de solo al cambiar el valor, React re-renderiza `GamePlayer` a 60fps innecesariamente. Mitigación: el motor debe comparar contra el valor previo antes de invocar el callback (ya definido en el alcance, se deja como riesgo a vigilar en la implementación).
