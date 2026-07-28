# 01 — MVP Visual Arcade Vault

**Estado:** Approved
**Depende de:** —
**Fecha:** 2026-07-26

**Objetivo:** Implementar, solo como maquetación visual e interactividad de UI (sin lógica de juego real), las 6 pantallas del prototipo de referencia (biblioteca, detalle de juego, reproductor simulado, autenticación, salón de la fama) como rutas reales de Next.js App Router, reutilizando el catálogo mock y el sistema visual neon/pixel ya existente en el proyecto.

## Alcance

### Dentro del alcance

- **Rutas nuevas:**
  - `/` — Biblioteca (grid de juegos, buscador, filtro por categoría)
  - `/juegos/[id]` — Detalle de juego (info, tabla de mejores puntuaciones, botón jugar)
  - `/juegos/[id]/jugar` — Reproductor simulado (HUD, CRT animado, pausa, fin de partida, guardar puntuación)
  - `/salon` — Salón de la Fama (podio + tabla por juego, con tabs)
  - `/auth` — Inicio de sesión / registro (mock, sin backend)
- **Nav global y footer** integrados en `app/layout.tsx` (persisten entre rutas), incluyendo menú móvil (hamburguesa) con panel deslizante.
- **Catálogo mock tipado** en `lib/data.ts` (8 juegos, categorías, generador determinista de puntuaciones `seededScores`).
- **Estado mock de sesión** vía `localStorage` (`av_user`): login falso (usuario/contraseña, sin validar contra nada), "jugar como invitado", botones sociales (Google/GitHub) decorativos sin funcionalidad real.
- **Guardado mock de puntuaciones** vía `localStorage` (`av_scores`) al terminar una partida simulada en el reproductor.
- **Reproductor simulado**: score autoincremental por temporizador, subida de nivel cada 2500 pts, pausa/reanudar, botón "fin", modal de fin de partida con input de iniciales y confirmación de guardado — todo sin lógica de juego real (ni canvas, ni colisiones, ni inputs de teclado/táctiles para jugar).
- Componentes en `components/`, datos/helpers en `lib/`.
- Responsive (breakpoints ya definidos en el CSS portado: 840px para nav, 900px para detalle, 720px para salón/tabla).

### Fuera del alcance (explícitamente diferido)

- **Cualquier lógica de juego real** (los 8 juegos del catálogo son solo tarjetas/metadata; no se implementa ninguno).
- **Backend / API real**: no hay servidor de autenticación, base de datos, ni persistencia server-side. Todo el estado es local al navegador.
- **OAuth real** con Google/GitHub — los botones no disparan ningún flujo.
- **Validación de formularios** (auth) más allá de lo que ya trae el prototipo (campos libres, sin mensajes de error).
- **Internacionalización** — todo el contenido queda en español, tal como el prototipo.
- **Tests automatizados** — no hay test runner configurado en el proyecto todavía.
- **Sistema de créditos/monedas real** — el contador "CRÉDITOS · 03" en el nav queda como valor estático decorativo, igual que en el prototipo.

## Modelo de datos

### `lib/data.ts`

```typescript
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;       // clase CSS del cover generado (ej. "cover-bricks")
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;        // ej. "12.4K"
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;         // "DD/MM/AAAA"
}

export const GAMES: Game[];              // los 8 juegos, copiados tal cual del prototipo
export const CATEGORIES: GameCategory[] | "TODOS"[]; // ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"]
export const PLAYERS: string[];           // nombres usados para generar tablas mock

export function seededScores(seed: number, count?: number): ScoreRow[];
```

### `lib/session.ts` (estado mock cliente, envuelve `localStorage`)

```typescript
export interface AuthUser {
  name: string;
}

export interface SavedScore {
  game: string;   // Game.id
  score: number;
  name: string;
  at: number;     // Date.now()
}

// Claves de localStorage: "av_user", "av_scores" (mismas que el prototipo)
export function getStoredUser(): AuthUser | null;
export function storeUser(user: AuthUser): void;
export function clearUser(): void;
export function appendScore(entry: Omit<SavedScore, "at">): void;
```

No se introduce persistencia server-side, base de datos, ni esquema de versionado — es intencional dado que todo es mock.

## Plan de implementación

1. **Datos y sesión mock** — Crear `lib/data.ts` (tipos `Game`, `ScoreRow`, `GAMES`, `CATEGORIES`, `PLAYERS`, `seededScores`) y `lib/session.ts` (`getStoredUser`, `storeUser`, `clearUser`, `appendScore` sobre `localStorage`). Sistema queda funcional aunque sin UI todavía.

2. **Nav global en el layout** — Crear `components/nav.tsx` (client component: estado de menú móvil, estado de sesión leído de `lib/session.ts`, links a `/`, `/salon`, `/auth`) y montarlo en `app/layout.tsx` junto con el footer existente del prototipo, dentro de `#root` y antes de `{children}`. Reemplaza el `page.tsx` de scaffold por defecto en el siguiente paso, pero el nav ya es visible y navegable.

3. **Biblioteca (`/`)** — Reescribir `app/page.tsx` con `components/game-card.tsx` y `components/library.tsx` (hero, buscador, chips de categoría, grid de tarjetas con efecto tilt). Usa `GAMES`/`CATEGORIES` de `lib/data.ts`. Cada tarjeta enlaza a `/juegos/[id]`.

4. **Detalle de juego (`/juegos/[id]`)** — Crear `app/juegos/[id]/page.tsx` + `components/game-detail.tsx` (cover, tags, descripción, stats, leaderboard con `seededScores`, botones "Jugar ahora" → `/juegos/[id]/jugar` y "Volver al Vault" → `/`). `generateStaticParams` a partir de `GAMES` (opcional pero recomendado); 404 vía `notFound()` si el `id` no existe.

5. **Reproductor simulado (`/juegos/[id]/jugar`)** — Crear `app/juegos/[id]/jugar/page.tsx` + `components/game-player.tsx` (client component con toda la simulación: HUD, temporizador de score, niveles, pausa, CRT animado, modal de fin de partida que guarda vía `appendScore`). Salir vuelve a `/juegos/[id]`, "volver al vault" a `/`.

6. **Autenticación (`/auth`)** — Crear `app/auth/page.tsx` + `components/auth-form.tsx` (tabs iniciar sesión/crear cuenta, campos libres, botón "jugar como invitado", botones sociales decorativos). Al enviar, llama a `storeUser` y redirige a `/`.

7. **Salón de la Fama (`/salon`)** — Crear `app/salon/page.tsx` + `components/hall-of-fame.tsx` (tabs por juego, podio top 3, tabla completa con `seededScores`, fila destacada "tu mejor marca" si hay sesión). Botón "Volver a la biblioteca" → `/`.

8. **Repaso final** — Revisar responsive en los tres breakpoints (840/900/720px), confirmar que el nav marca el link activo según la ruta actual (usando `usePathname`), y que cerrar sesión desde el nav limpia `localStorage` y refresca el estado sin recargar la página.

## Criterios de aceptación

- [ ] `/` muestra el hero, el buscador, los chips de categoría y el grid con los 8 juegos de `GAMES`.
- [ ] Escribir en el buscador filtra las tarjetas por título (case-insensitive); seleccionar un chip filtra por categoría; combinar ambos funciona a la vez.
- [ ] Si el filtro no arroja resultados, se muestra el estado vacío ("NO HAY RESULTADOS").
- [ ] Click en una tarjeta (o en su botón "JUGAR") navega a `/juegos/[id]` con el `id` correcto.
- [ ] `/juegos/[id]` muestra cover, tags, descripción, stats (partidas, mejor global, dificultad) y una tabla de mejores puntuaciones no vacía.
- [ ] Navegar a `/juegos/id-inexistente` resulta en 404 (`notFound()`).
- [ ] Botón "JUGAR AHORA" navega a `/juegos/[id]/jugar`; botón "VOLVER AL VAULT" navega a `/`.
- [ ] `/juegos/[id]/jugar` muestra el HUD (jugador, puntuación, vidas, nivel) y el CRT animado; la puntuación sube automáticamente mientras no está en pausa ni terminado.
- [ ] Botón "PAUSA" detiene el incremento de puntuación y muestra el overlay "EN PAUSA"; "REANUDAR" lo retoma.
- [ ] Botón "FIN" abre el modal de fin de partida con la puntuación final congelada.
- [ ] En el modal, guardar la puntuación (con iniciales) persiste una entrada en `localStorage` bajo `av_scores` y muestra el mensaje de confirmación.
- [ ] "JUGAR DE NUEVO" reinicia score/vidas/nivel y cierra el modal; "VOLVER AL VAULT" navega a `/`.
- [ ] `/auth` permite alternar entre pestañas "INICIAR SESIÓN" / "CREAR CUENTA"; enviar cualquiera de los dos formularios guarda un usuario mock en `localStorage` (`av_user`) y redirige a `/`.
- [ ] "JUGAR COMO INVITADO" navega a `/` sin crear sesión.
- [ ] Con sesión iniciada, el nav muestra el nombre de usuario en vez del botón "Iniciar Sesión"; hacer click permite cerrar sesión y vuelve a mostrar "Iniciar Sesión".
- [ ] `/salon` muestra tabs por juego, podio (top 3) y tabla completa; cambiar de tab cambia los datos mostrados.
- [ ] Con sesión iniciada, la tabla de `/salon` incluye la fila destacada "tu mejor marca"; sin sesión, no aparece.
- [ ] El nav resalta como activo el link correspondiente a la ruta actual (`/` y sus subrutas de detalle/reproductor resaltan "Biblioteca"; `/salon` resalta "Salón de la Fama").
- [ ] En viewport ≤840px, el nav colapsa a hamburguesa y el panel lateral se abre/cierra correctamente.
- [ ] `npm run build` (o el comando de build de Next configurado) compila sin errores de tipos ni de lint.

## Decisiones tomadas y descartadas

- **Rutas reales de App Router en vez de SPA por hash** — se descartó el patrón de router-por-hash del prototipo porque el proyecto ya usa App Router; URLs limpias y compartibles son más acordes a un Next.js real. Costo: el estado de `route` en memoria del prototipo se reemplaza por navegación de Next (`next/link`, `useRouter`, `usePathname`) y parámetros dinámicos (`[id]`).
- **Persistencia mock vía `localStorage`** — se mantiene igual que el prototipo (login falso, puntuaciones) porque el objetivo es demostrar los estados de la UI (logueado/invitado, puntuación guardada) sin construir backend, que está fuera de alcance.
- **`styles.css` portado casi literal** — ya estaba hecho en un PR previo (`app/globals.css`, `app/layout.tsx` con las fuentes vía `next/font/google`); se reutiliza en vez de reescribir con utilidades Tailwind, evitando reescribir ~950 líneas de CSS ajustado (glow, clip-path, animaciones) con riesgo de perder fidelidad visual.
- **Catálogo mock idéntico al prototipo** (mismos 8 juegos, nombres, categorías, descripciones y "mejores puntuaciones") — no se pidieron cambios de contenido.
- **Reproductor con simulación completa** (score autoincremental, pausa, modal de fin, guardado) en vez de una versión más estática — se decidió mantener toda la interactividad del prototipo porque demuestra el flujo completo de una partida sin necesitar lógica de juego real.
- **Botones sociales (Google/GitHub) decorativos, sin ocultarlos** — se mantienen visibles pero sin funcionalidad, igual que el prototipo, ya que no hay OAuth real en el alcance de este MVP.
- **Nav y footer en `app/layout.tsx`** (no en cada `page.tsx`) — evita remontar el estado del menú móvil en cada navegación y sigue el patrón estándar de layouts persistentes de App Router.
- **URLs en español** (`/juegos/[id]`, `/juegos/[id]/jugar`, `/salon`, `/auth`) — coherente con que todo el contenido y dominio del producto está en español.
- **Estructura `components/` + `lib/`** en vez de co-locación dentro de `app/` — sigue la convención más común de proyectos Next.js App Router y separa claramente UI de datos/helpers.
- **`Arcade Vault.html` descartado, solo usado como referencia** — confirmado con el usuario: solo aporta el orden de ensamblado de scripts y carga de fuentes del prototipo original, sin información adicional relevante para la implementación en Next.js.
