# SPEC NN — <Título del juego> jugable + leaderboard

> **Estado:** Borrador
> **Depende de:** 06-leaderboard-catalogo-supabase
> **Fecha:** <fecha>
> **Objetivo:** <una frase: portar/crear el motor de <juego> a `components/games/<id>/`, integrarlo en `GamePlayer` (vía el registry de juegos jugables) y dar de alta su leaderboard real en Supabase.>

## Alcance

**Dentro del alcance:**

- **Motor del juego** (`components/games/<id>/engine.ts`) — <qué se porta/crea: clases, loop, mecánicas concretas>. Resolución lógica fija <W>×<H>.
- **Wrapper de React** (`components/games/<id>/<id>-canvas.tsx`) — client component que monta el motor en un `<canvas>` vía `useEffect`/`ref`, escala por CSS dentro de `.crt-screen`, expone:
  - Callbacks `onScoreChange`, `onGameOver` (+ los específicos del juego: `onLivesChange`, `onLevelChange`, etc. — listar los que apliquen).
  - Prop `paused: boolean`.
  - Cleanup en desmontaje: cancela `requestAnimationFrame` y remueve listeners de teclado.
- <**Paso 0 condicional** — si `components/games/registry.ts` no existe todavía: crearlo y migrar `rocas` a él (sin cambio de comportamiento observable) antes de agregar este juego. Omitir esta viñeta por completo si el registry ya existe.>
- **Registro en `components/games/registry.ts`** — entrada `<id>` → `dynamic(() => import(".../<id>-canvas"), { ssr: false })`.
- **Integración en `GamePlayer`** (`components/game-player.tsx`) — consulta el registry por `game.id`; conecta los callbacks al estado existente (`score`, HUD específico, `paused`, `over`) y dispara el flujo de guardado real (`saveScoreAction`) cuando llega `onGameOver`.
- **Controles** — <teclas exactas>, con `preventDefault` mientras el canvas está montado.
- **Catálogo (`games`)** — fila nueva vía `mcp__supabase__apply_migration`: `id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `plays`.
- **Leaderboard real** — agregar `<id>` a `GAMES_WITH_REAL_SCORES` en `lib/actions/scores.ts`; el resto de la capa de queries/acciones ya es genérica, no requiere cambios.
- **Portada** — <clase `cover-<x>` reutilizada, o nueva diseñada con `/frontend-design` durante `/spec-impl`>.

**Fuera de alcance (diferido):**

- **Controles táctiles/mobile** — por defecto diferido, salvo que el usuario lo pida explícitamente.
- **Sonido** — por defecto diferido.
- **Ajustes de dificultad/balance** — se porta el balance del original tal cual (si viene de una referencia), sin retocar constantes, salvo que el usuario pida cambios.
- <cualquier otro diferido específico acordado en la Fase 3>

## Modelo de datos

Interfaces TypeScript de la API entre el motor y React (mismo formato que spec 05):

```ts
// components/games/<id>/engine.ts
export interface <Nombre>Callbacks {
  onScoreChange: (score: number) => void;
  onGameOver: (finalScore: number) => void;
  // + callbacks específicos
}

export interface <Nombre>Engine {
  start: () => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export function create<Nombre>Engine(
  canvas: HTMLCanvasElement,
  callbacks: <Nombre>Callbacks,
): <Nombre>Engine;
```

```tsx
// components/games/<id>/<id>-canvas.tsx
export interface <Nombre>CanvasProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onGameOver: (finalScore: number) => void;
  // + específicos
}
```

Fila de catálogo (`games`, insertada en la migración):

```sql
insert into games (id, title, short, long, cat, cover, color, plays)
values ('<id>', '<title>', '<short>', '<long>', '<CAT>', 'cover-<x>', '<color>', '<plays>');
```

## Plan de implementación

<Incluir el paso 0 SOLO si `components/games/registry.ts` no existe. Renumerar si se omite.>

0. **Crear `components/games/registry.ts` y migrar `rocas`** — extraer el mapeo `id → Canvas` que hoy vive cableado en `game-player.tsx` (`isAsteroids = game.id === 'rocas'`) a un registro genérico con `next/dynamic`. `GamePlayer` pasa a consultar el registry. Verificable: `/games/rocas/jugar` se comporta exactamente igual que antes.

1. **Crear `components/games/<id>/engine.ts`** — <detalle específico según lo acordado en Fase 2/3: qué se porta, constantes, clases>. Encapsulado en `create<Nombre>Engine(canvas, callbacks)`, sin globals de módulo. Verificable de forma aislada: compila con `tsc` sin `any`, sin efectos de import.

2. **Crear `components/games/<id>/<id>-canvas.tsx`** — client component con `<canvas width={<W>} height={<H>}>` escalado por CSS. `useEffect` de montaje/desmontaje del engine + `useEffect` de sincronización de `paused`.

3. **Agregar entrada en `components/games/registry.ts`** — `<id>: { Canvas: dynamic(() => import("@/components/games/<id>/<id>-canvas"), { ssr: false }) }`.

4. **Integrar en `components/game-player.tsx`** — cuando el registry tiene una entrada para `game.id`, renderizar su `Canvas` en vez del `.game-arena` falso; conectar callbacks al HUD; en `onGameOver`, llamar `saveScoreAction({ gameId: game.id, name, score })`.

5. **Migración Supabase (`mcp__supabase__apply_migration`)** — `insert into games (...)` con la fila de este juego. Verificable con `mcp__supabase__list_tables`/consulta directa.

6. **`lib/actions/scores.ts`** — agregar `<id>` a `GAMES_WITH_REAL_SCORES`.

7. **Portada** — <si aplica: diseñar `.cover-<x>` en `app/globals.css` con `/frontend-design`>.

8. **Verificación manual en navegador** — `npm run dev`, ir a `/games/<id>/jugar`: <controles>, HUD en vivo, "PAUSA" congela el canvas, game over abre el modal con el score real, "GUARDAR PUNTUACIÓN" inserta en `scores` (visible en `/games/<id>` y `/salon` tras refrescar). Confirmar que otros juegos del catálogo no cambian de comportamiento.

9. **`npm run build`** — compila sin errores de tipos ni de lint.

## Criterios de aceptación

Base (heredados, no omitir):

- [ ] `components/games/<id>/engine.ts` existe, exporta `create<Nombre>Engine`, sin `any`, sin acceder al DOM fuera de las funciones del engine.
- [ ] `components/games/<id>/<id>-canvas.tsx` existe, monta el canvas en `useEffect`, y lo destruye (cancela loop, remueve listeners de teclado) al desmontar.
- [ ] El HUD de React refleja en vivo los valores reales del motor (score + los específicos del juego).
- [ ] El botón "PAUSA" congela el canvas (loop detenido) y "REANUDAR" lo continúa exactamente donde quedó.
- [ ] Al cumplirse la condición de game over, se abre automáticamente el modal de fin de partida con la puntuación final real, y "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` (visible en `/games/<id>` y `/salon` tras refrescar).
- [ ] El canvas escala visualmente al tamaño de `.crt-screen` sin deformarse en al menos dos anchos de ventana distintos.
- [ ] El juego aparece en el grid de `/games` con datos reales de Supabase (`games`).
- [ ] Ningún otro juego del catálogo cambia de comportamiento.
- [ ] `npm run build` compila sin errores de tipos ni de lint.

Específicos de este juego:

- [ ] <mecánica particular 1>
- [ ] <mecánica particular 2>

## Decisiones tomadas y descartadas

- <decisiones específicas de este juego, mismo formato que spec 05: opción elegida — se descartó **X** porque **Y**.>

## Riesgos identificados

Reutilizar cuando aplique (de spec 05):

- **Scroll de página por teclas capturadas** — mitigación: `preventDefault()` en los códigos usados por el juego mientras el canvas está montado.
- **Doble montaje en desarrollo (`StrictMode`)** — mitigación: `destroy()` idempotente, verificado explícitamente en dev.
- **Listeners de teclado globales entre navegaciones** — mitigación: `destroy()` remueve `keydown`/`keyup` al salir.
- **Callbacks disparando renders excesivos** — mitigación: comparar contra el valor previo antes de invocar el callback.

Más los riesgos propios de este juego:

- <riesgo específico>
