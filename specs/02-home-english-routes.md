# 02 — Home (landing) y renombrado de rutas a inglés

**Estado:** Implementado
**Depende de:** 01-mvp-visual-screens
**Fecha:** 2026-07-29

**Objetivo:** Implementar la nueva página de aterrizaje (Home/landing de marketing) en `/games/`, agregarla al nav como "Inicio" junto con un acceso (sin implementar) a "Acerca de", y renombrar las rutas existentes de detalle/reproductor de juego de `/juegos/*` a `/games/*` para que todo el enrutado del sitio quede en inglés.

## Alcance

### Dentro del alcance

- **Ruta nueva `/games/`** — Home/landing de marketing (`components/home.tsx` + `app/games/page.tsx`), portado de `references/templates/home-about/home.jsx`: hero, sección "por qué Arcade Vault", preview de juegos, stats, actividad en vivo/top jugadores, pricing y CTA final. Contenido en español (igual que el resto del sitio), solo la URL en inglés.
- **Datos mock del Home copiados tal cual del template** (stats "12+ juegos", ticker de actividad, top jugadores, plan de precios "$0/siempre") — estáticos, sin conectar a `lib/data.ts`.
- **Renombrado de rutas de juego:** `app/juegos/[id]` → `app/games/[id]`, `app/juegos/[id]/jugar` → `app/games/[id]/jugar`. Reemplazo limpio, sin redirects desde las rutas viejas en español.
- **Actualización de referencias internas** a las rutas renombradas en `components/game-card.tsx`, `components/game-detail.tsx`, `components/game-player.tsx`.
- **Nav actualizado (`components/nav.tsx`):**
  - Nuevo link "Inicio" → `/games` (landing).
  - Link "Biblioteca" se mantiene apuntando a `/` (grid de juegos existente), y su estado activo cubre también `/games/[id]` y `/games/[id]/jugar` (detalle/reproductor), pero no `/games` exacto (que es "Inicio").
  - Nuevo link "Acerca de" → `/about`, visible en el nav de escritorio y en el panel móvil, sin página implementada (Next.js mostrará su 404 por defecto al hacer click).
  - Orden de links en el nav (desktop y móvil): Inicio, Biblioteca, Salón de la Fama, Acerca de.
- **Verificación con MCP de Playwright** al finalizar: navegación entre `/`, `/games`, `/games/[id]`, `/games/[id]/jugar`, `/salon`, `/auth`, estado activo del nav, y confirmación de que `/juegos/*` ya no resuelve.

### Fuera del alcance (explícitamente diferido)

- **Implementación de la página `/about`** — solo se agrega el link en el nav; el contenido (`about.jsx` del template, formulario de contacto) queda para un spec futuro.
- **Traducción del contenido a inglés** — todo el texto del sitio, incluido el nuevo Home, permanece en español.
- **Conexión del Home a datos reales** (`lib/data.ts`, `seededScores`) — el preview de juegos, stats y rankings del Home quedan como contenido estático copiado del template.
- **Redirects desde `/juegos/*`** — no se configuran; es un reemplazo limpio.
- **Sistema de créditos/monedas real, OAuth real, tests automatizados** — igual que en `01-mvp-visual-screens`, siguen fuera de alcance.

## Modelo de datos

Este spec no introduce estructuras de datos nuevas — reutiliza `lib/data.ts` y `lib/session.ts` tal como existen (el Home no se conecta a ellos, ver alcance).

## Plan de implementación

1. **Renombrar rutas de juego** — Mover `app/juegos/[id]/page.tsx` → `app/games/[id]/page.tsx` y `app/juegos/[id]/jugar/page.tsx` → `app/games/[id]/jugar/page.tsx` (borrar `app/juegos/`). Actualizar hrefs afectados: `components/game-card.tsx` (`/juegos/${game.id}` → `/games/${game.id}`), `components/game-detail.tsx` (`/juegos/${game.id}/jugar` → `/games/${game.id}/jugar`), `components/game-player.tsx` (`router.push('/juegos/${game.id}')` → `/games/${game.id}`). El sitio queda funcional con las mismas pantallas, solo con URLs en inglés.

2. **Componente Home** — Crear `components/home.tsx` portando `references/templates/home-about/home.jsx` a TSX/Next: reemplazar `navigate({name: ...})` por `next/link`/`useRouter` apuntando a `/` (biblioteca), `/games/[id]` (detalle) y `/auth`; conservar `useReveal` (IntersectionObserver) como hook local o efecto en el propio componente; mantener `FloatingSilhouettes`, `MiniCard`, `FeatureIcon` como subcomponentes o funciones internas del mismo archivo. Usar `GAMES.slice(0, 6)` de `lib/data.ts` solo para poblar el preview de juegos (ids/covers reales para que los links a `/games/[id]` funcionen); el resto del contenido (stats, ticker, top jugadores, pricing) queda estático como en el template.

3. **Ruta `/games`** — Crear `app/games/page.tsx` que renderiza `<Home />`.

4. **Actualizar `components/nav.tsx`** — Agregar "Inicio" (`/games`) y "Acerca de" (`/about`) en desktop y panel móvil, en el orden Inicio/Biblioteca/Salón de la Fama/Acerca de. Ajustar `isActive`: `"inicio"` activo solo en `pathname === "/games"`; `"biblioteca"` activo en `pathname === "/"` o `pathname.startsWith("/games/")` (detalle/reproductor, excluyendo `/games` exacto); `"about"` activo en `pathname === "/about"`.

5. **CSS del Home** — Portar los estilos específicos del Home desde `references/templates/home-about/styles.css` (`.home-*`, `.feature-*`, `.mini-*`, `.stat-*`, `.activity-*`, `.pricing-*`, `.final-*`) a `app/globals.css`, evitando duplicar reglas ya existentes (nav, botones, tipografía) que el proyecto ya porta desde `01-mvp-visual-screens`.

6. **Verificación con Playwright MCP** — Levantar el servidor de desarrollo y, con el MCP de Playwright, navegar `/`, `/games`, `/games/[id]` (con un id real de `GAMES`), `/games/[id]/jugar`, `/salon`, `/auth`; confirmar que el nav resalta el link correcto en cada ruta, que `/games` muestra el Home completo (hero, features, preview, stats, actividad, pricing, CTA final) sin errores de consola, y que `/juegos/[id]` ya no existe (404).

## Criterios de aceptación

- [ ] `/games` muestra el Home completo: hero con CTAs, sección "por qué Arcade Vault", preview de juegos, stats, actividad en vivo/top jugadores, pricing y CTA final.
- [ ] El preview de juegos en `/games` muestra 6 juegos reales de `GAMES` y cada tarjeta navega a `/games/[id]` con el id correcto.
- [ ] Los CTAs del Home ("Explorar juegos", "Insertar moneda", "Ver todos los juegos") navegan a `/` (biblioteca); "Crear cuenta" / "Empezar gratis" navegan a `/auth`.
- [ ] `/games/[id]` y `/games/[id]/jugar` funcionan igual que antes (mismo comportamiento que `/juegos/[id]` y `/juegos/[id]/jugar`), y `/juegos/[id]` ya no resuelve (404).
- [ ] El nav (desktop y móvil) muestra los links en el orden: Inicio, Biblioteca, Salón de la Fama, Acerca de.
- [ ] En `/games`, el nav resalta "Inicio" como activo (no "Biblioteca").
- [ ] En `/`, `/games/[id]` y `/games/[id]/jugar`, el nav resalta "Biblioteca" como activo (no "Inicio").
- [ ] En `/salon`, el nav resalta "Salón de la Fama"; en `/auth`, ninguno de los cuatro links de sección se marca activo.
- [ ] El link "Acerca de" apunta a `/about`; al hacer click, se muestra el 404 por defecto de Next.js (no hay crash ni pantalla en blanco).
- [ ] `npm run build` compila sin errores de tipos ni de lint.
- [ ] Verificación manual con Playwright MCP: recorrido de `/`, `/games`, `/games/[id]`, `/games/[id]/jugar`, `/salon`, `/auth` sin errores de consola, con capturas confirmando el estado activo del nav en cada ruta.

## Decisiones tomadas y descartadas

- **Home (landing) en `/games`, Biblioteca se queda en `/`** — se descartó mover la Biblioteca a `/games` y dejar el Home en `/` porque el usuario confirmó explícitamente que el Home ocupa la ruta traducida de `/juegos` (→ `/games`), y la Biblioteca no se toca en este spec.
- **Renombrado completo de `/juegos/*` a `/games/*` sin redirects** — se descartó agregar redirects en `next.config` porque el proyecto es un MVP recién implementado sin usuarios reales ni bookmarks que proteger; un reemplazo limpio es más simple.
- **Contenido del Home en español, solo la URL en inglés** — coherente con `01-mvp-visual-screens`, que ya estableció español como idioma de contenido de todo el sitio; traducir el contenido completo se descartó por ser un cambio mayor que merece su propio spec.
- **Datos mock del Home estáticos (sin conectar a `lib/data.ts`), salvo el preview de juegos** — se decidió usar `GAMES` solo donde es indispensable para que los links funcionen (preview de 6 juegos con id real); el resto (stats, ticker, top jugadores, pricing) se copia tal cual del template para minimizar esfuerzo, ya que esta fase es solo maquetación visual.
- **"Acerca de" se agrega al nav sin implementar `/about`** — se descartó crear un stub "próximamente" porque el usuario prefirió el 404 nativo de Next.js; el spec de `/about` queda pendiente y explícitamente fuera de alcance.
- **`isActive("biblioteca")` cubre `/games/[id]` y `/games/[id]/jugar` pero no `/games` exacto** — necesario porque el detalle y el reproductor del juego viven bajo el mismo prefijo `/games` que el Home; se distingue por coincidencia exacta de pathname para que "Inicio" y "Biblioteca" no se marquen activos simultáneamente.

## Riesgos identificados

- **Colisión de nombres de clases CSS** — `styles.css` del template (`.feature-card`, `.stat-block`, etc.) podría chocar con clases ya existentes en `app/globals.css` portadas en `01-mvp-visual-screens`. Mitigación: revisar `globals.css` antes de pegar y renombrar si hay colisión.
- **Rutas dinámicas bajo `/games`** — al convivir `app/games/page.tsx` (Home) con `app/games/[id]/page.tsx` (detalle), cualquier futuro sub-path estático de `/games` (ej. `/games/nuevo`) quedaría capturado por `[id]` en vez de por una ruta propia. No bloquea este spec, pero es algo a tener en cuenta en specs futuros.
