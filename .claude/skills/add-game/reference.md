# Contrato técnico — juego jugable + leaderboard en Arcade Vault

Este documento describe, capa por capa, cómo se integra un juego real en Arcade Vault. Es la referencia técnica que `/add-game` usa para rellenar el spec — no se le pregunta al usuario nada de esto, se toma como dado salvo que un caso concreto no encaje.

Fuente de verdad: `specs/05-asteroids-rocas.md`, `specs/06-leaderboard-catalogo-supabase.md`, y el código de `rocas` (`components/games/asteroids/`).

## 1. Motor del juego

`components/games/<id>/engine.ts` — TypeScript puro, sin JSX, sin acceder al DOM fuera de las funciones que lo necesitan (nada se ejecuta al solo importar el módulo).

Exporta una factory:

```ts
export interface <Nombre>Callbacks {
  onScoreChange: (score: number) => void;
  onGameOver: (finalScore: number) => void;
  // + callbacks específicos del juego: onLivesChange, onLevelChange, etc.
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

Reglas no negociables (ver `components/games/asteroids/engine.ts`):

- **Sin `any`.**
- **Sin globals de módulo** (`let ship, bullets, ...` a nivel de archivo) — todo el estado vive encapsulado dentro de la factory, para poder crear/destruir instancias limpiamente entre montajes de React (navegación client-side, `StrictMode` en dev monta/desmonta dos veces).
- **Callbacks solo al cambiar el valor**, nunca una vez por frame — comparar contra el valor previo antes de invocar (ver `engine.ts:373-395` de asteroids como referencia exacta del patrón).
- **`destroy()` idempotente** — cancela el `requestAnimationFrame` pendiente y remueve todos los listeners de teclado (`keydown`/`keyup`) que el engine haya registrado. Si no lo hace, quedan listeners huérfanos entre partidas o dos loops corriendo en paralelo por el doble montaje de `StrictMode`.
- **Captura de teclado con `preventDefault`** en los códigos que el juego usa (evita que `↑`/`↓`/`Espacio` scrolleen la página alrededor del `.crt`).
- **Resolución lógica fija**, escalada después por CSS — no recalcular dimensiones dinámicamente, cambiaría el balance del juego (velocidades, radios, spawn) respecto al original si viene de una referencia.

## 2. Wrapper de React

`components/games/<id>/<id>-canvas.tsx` — client component (`"use client"`). Patrón exacto de `components/games/asteroids/asteroids-canvas.tsx`:

- `<canvas>` con `width`/`height` lógicos fijos (los de la Fase 3) y `style={{ width: "100%", height: "100%", display: "block" }}` para escalar dentro de `.crt-screen` manteniendo proporción.
- Un `useEffect` **sin dependencias** (`eslint-disable-next-line react-hooks/exhaustive-deps` si hace falta) que crea el engine con `create<Nombre>Engine`, llama `start()`, y en el cleanup llama `destroy()`.
- Un segundo `useEffect` que sincroniza la prop `paused`: llama `engine.pause()`/`engine.resume()` cuando cambia. El motor solo obedece, no decide — el botón de pausa vive en el HUD de React (`GamePlayer`), no dentro del canvas.
- Props: siempre `paused: boolean`, `onScoreChange`, `onGameOver`, más los callbacks específicos del juego (vidas, nivel, power-ups temporales, etc.) definidos en la Fase 3 del spec.

## 3. Registro de juegos jugables (`components/games/registry.ts`)

Con más de un motor real, `GamePlayer` no puede seguir ramificando con `game.id === 'rocas'`. El registry centraliza qué juegos tienen motor real y cómo montarlos:

```ts
// components/games/registry.ts
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { PlayableGameProps } from "@/components/games/types"; // paused + callbacks comunes

export interface PlayableGameEntry {
  Canvas: ComponentType<PlayableGameProps>;
  // metadatos de qué casillas del HUD aplican a este juego: hasLives, hasLevel, etc.
}

export const PLAYABLE_GAMES: Record<string, PlayableGameEntry> = {
  rocas: {
    Canvas: dynamic(
      () => import("@/components/games/asteroids/asteroids-canvas"),
      {
        ssr: false,
      },
    ),
  },
  // <id-nuevo>: { Canvas: dynamic(() => import("@/components/games/<id>/<id>-canvas")), ... }
};
```

`GamePlayer` consulta `PLAYABLE_GAMES[game.id]`: si existe, renderiza `Canvas` en vez del `.game-arena` simulado y expone el HUD según los metadatos de la entrada; si no existe, sigue con el arena falsa sin cambios (comportamiento actual para los juegos que aún no tienen motor).

**Si `components/games/registry.ts` todavía no existe** (primer juego después de `rocas`), el spec debe incluir un paso 0 que lo cree y migre `rocas` a él, sin cambiar comportamiento observable — antes de agregar el juego nuevo.

## 4. Catálogo (tabla `games`)

Una fila nueva vía `mcp__supabase__apply_migration` (nunca desde `/add-game`, que solo escribe el spec — la migración la ejecuta `/spec-impl`):

```sql
insert into games (id, title, short, long, cat, cover, color, plays)
values ('<id>', '<title>', '<short>', '<long>', '<cat>', 'cover-<x>', '<color>', '<plays>');
```

`best` no es columna — sale de la vista `scores_best` (`select game_id, max(score) as best from scores group by game_id`), que ya usan `getGameById`/`getGamesWithBest`. No hay nada que tocar en `lib/supabase/queries.ts`: `getGames`, `getGameById`, `getTopScores`, `insertScore` ya son genéricos por `game_id`, sirven para cualquier juego nuevo sin cambios.

## 5. Guardado real de puntaje

`lib/actions/scores.ts` tiene un set `GAMES_WITH_REAL_SCORES` (hoy solo `"rocas"`) que decide qué juegos guardan en Supabase vía `saveScoreAction` en vez de `appendScore`/`localStorage`. Agregar el `id` del juego nuevo a ese set es el único cambio necesario en esa capa — `saveScoreAction` ya valida nombre (máx. 10 caracteres) y rango de score (entero, 0–999999), `GamePlayer` ya llama a la acción cuando el juego tiene motor real.

## 6. Estilos de portada

Clase `cover-<id>` en `app/globals.css` (bloque de covers, junto a `.cover-rocas`, `.cover-tetro`, etc.), consumida por `components/game-card.tsx`. Si el juego reutiliza una portada existente, no se agrega clase nueva. Si necesita una propia, se diseña con `/frontend-design` durante `/spec-impl` — `/add-game` no la diseña, solo deja anotado en el spec que hace falta.

## Qué no cambia nunca

- `lib/supabase/queries.ts` — genérico, no se toca por juego nuevo.
- `lib/data.ts` — solo mantiene tipos (`Game`, `GameCategory`, `GameColor`, `ScoreRow`, `CATEGORIES`, `PLAYERS`), ya no es fuente de datos del catálogo.
- Los juegos que aún no tienen motor real siguen con `.game-arena` simulado y `appendScore`/`localStorage` sin cambios — un juego nuevo con motor real no afecta a los demás.
