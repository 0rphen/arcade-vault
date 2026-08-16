# SPEC 12 — Rendimiento de los juegos

> **Estado:** Implementado
> **Depende de:** 05-asteroids-rocas, 07-caida-tetris, 08-arkanoid, 09-snake, game-jam/frogger, 10-controles-tactiles-mobile, 11-gamepad-mk-ii
> **Fecha:** 2026-08-16
> **Objetivo:** Instrumentar el rendimiento de los cinco juegos jugables y corregir los problemas medidos sin alterar un solo píxel de su render.

## Por qué existe este spec

Hoy no hay ninguna instrumentación de rendimiento en el repo: no se puede afirmar qué juego va mal ni probar que una optimización sirvió. Una auditoría de código de los cinco `engine.ts` jugables (`rocas`, `caida`, `arkanoid`, `snake`, `frogger`) y de `game-player.tsx` encontró problemas concretos y verificables:

1. **Prop `theme` inestable** — `components/game-player.tsx` pasa `{ themeId, mode: themeMode }` como objeto literal nuevo en cada render. Cada actualización del HUD (score, vidas, disparo triple…) invalida el `useMemo` de la paleta en los wrappers → `engine.setTheme()` → redibujo completo extra fuera del rAF, y re-renderiza también el gamepad táctil.
2. **`dt` sin clamp en Arkanoid** — tras un frame largo (pestaña oculta, GC), la bola avanza cientos de píxeles y atraviesa bloques. Los otros cuatro engines sí acotan `dt`.
3. **Ningún engine reacciona a `visibilitychange`** — la partida sigue corriendo en segundo plano y al volver se cobra el salto de tiempo.
4. **Churn de objetos en `rocas`** — varios `Array.filter` nuevos por frame más las partículas de explosión.
5. **Assets recreados por montaje** — `snake` crea una `Image` de fruta por montaje del engine; `arkanoid` clona el elemento `<audio>` en cada disparo de SFX.

Sin medición, ninguna de estas correcciones se puede probar. Por eso el spec instrumenta primero, mide, corrige y documenta una baseline.

## Alcance

**Dentro del alcance:**

- **Overlay de métricas** (`components/games/perf-overlay.tsx`) montado por `game-player.tsx`, activo solo cuando la URL trae `?perf=1`. Muestra FPS medio (ventana de 1 s), p95 de frame time (ventana de 5 s), contador de re-renders de `GamePlayer` y contador de llamadas redundantes a `setTheme`.
- **Hook `useFrameStats`** (`lib/perf/use-frame-stats.ts`) — rAF propio que muestrea `performance.now()`, agnóstico del engine. No requiere tocar ningún `engine.ts` para medir.
- **Fix 1 — props estables en `game-player.tsx`**: `useMemo` para el objeto `theme` que se pasa a `playable.Canvas` y a `TouchControls`, `useCallback` para los callbacks (`onGameOver`, `onResumeRequested`, etc.).
- **Fix 2 — guarda en `setTheme` de cada wrapper**: solo se llama a `engineRef.current.setTheme()` si la paleta resuelta cambió de verdad (comparación de identidad tras el `useMemo`).
- **Fix 3 — clamp de `dt` en Arkanoid**, alineado con el resto de engines (tope tipo `MAX_DT`).
- **Fix 4 — pausa automática por `visibilitychange`** en los cinco engines: al ocultarse la pestaña se cancela el rAF activo; al volver a mostrarse se resetea `lastTime` antes de reanudar. Este estado de pausa automática es independiente del `isPaused` que controla el botón PAUSA del HUD — no lo pisa ni lo sustituye.
- **Fix 5 — assets a nivel de módulo**: la `Image` de fruta de `snake` y el pool de `<audio>` de `arkanoid` se crean una vez (a nivel de módulo o de primer uso memoizado), no por cada montaje/disparo.
- **Fix 6 (condicional)** — si la baseline muestra que `rocas` incumple el presupuesto, se reemplazan los `Array.filter` del bucle de partículas/balas/asteroides por compactado in-place. No se aplica si `rocas` ya cumple.
- **`references/performance_baseline.md`** — tabla por juego con FPS medio, p95 de frame time, re-renders/min, antes y después de los fixes, junto con dispositivo/navegador/throttling usados en la medición.

**Fuera de alcance (diferido):**

- Mover fondos/capas estáticas (bloques de arkanoid, carriles de frogger) a un canvas offscreen cacheado.
- Escalado del backing store por `devicePixelRatio` + `ResizeObserver` — es una mejora de nitidez, no de rendimiento, y sube el coste de fill en móvil; merece spec propio.
- Web Workers, `OffscreenCanvas`, WebGL.
- Cualquier cambio visual: el render debe quedar píxel a píxel idéntico al actual.
- Rendimiento de páginas no-juego (catálogo, salón de la fama, home) y de las consultas a Supabase.
- Activar el React Compiler para resolver inestabilidad de props — afecta a toda la app, spec propio.
- Usar el slot B del gamepad táctil o cualquier cambio funcional de controles — sin relación con este spec.

## Modelo de datos

Único tipo nuevo, en `lib/perf/use-frame-stats.ts`:

```ts
export interface FrameStats {
  fps: number; // media móvil de 1 s
  p95FrameMs: number; // percentil 95 sobre ventana de 5 s
  worstFrameMs: number;
  renders: number; // re-renders del host desde el montaje
}
```

Sin cambios en Supabase. Sin cambios en `components/games/types.ts`, salvo que la implementación descubra que necesita un campo opcional adicional en el contrato del wrapper para reportar `setTheme` redundantes al overlay.

## Plan de implementación

1. Crear `lib/perf/use-frame-stats.ts` y `components/games/perf-overlay.tsx`. Montar el overlay en `game-player.tsx` leyendo `window.location.search` dentro de un `useEffect` (evita `useSearchParams` y su límite de Suspense en Next 16). Sistema jugable, overlay inerte sin el query param.
2. Medir la baseline de los 5 juegos con `?perf=1` (desktop y viewport móvil 390×844 con throttling, vía Playwright MCP) y volcarla en `references/performance_baseline.md`, columna "antes".
3. Aplicar Fix 1 y Fix 2 (host + wrappers). Re-medir contador de re-renders y de `setTheme` redundantes.
4. Aplicar Fix 3 (clamp en Arkanoid) y Fix 4 (`visibilitychange` en los 5 engines).
5. Aplicar Fix 5 (assets a nivel de módulo en `snake` y `arkanoid`).
6. Evaluar Fix 6 contra la baseline; aplicarlo solo si `rocas` sigue incumpliendo el presupuesto tras los pasos anteriores.
7. Completar `references/performance_baseline.md` con la columna "después" y verificar contra los presupuestos.

Cada paso deja los cinco juegos jugables y sin cambios visuales.

## Criterios de aceptación

- [x] `?perf=1` muestra el overlay en `/games/<id>/jugar`; sin el parámetro, el overlay no se monta ni ejecuta su rAF.
- [~] Los 5 juegos alcanzan ≥58 FPS medios y p95 de frame time ≤20 ms en desktop. **No se cumple de forma consistente en este host** — ver "Ruido del entorno" en `references/performance_baseline.md`: el p95 desktop (17–33 ms) varía por contención de CPU del contenedor headless, no por el código de cada engine (los 5 juegos, no solo los que reciben más fixes, muestran el mismo ruido). El presupuesto móvil, menos sensible a ese ruido por el throttling explícito, sí se cumple en los 5.
- [x] Los 5 juegos alcanzan ≥50 FPS medios y p95 de frame time ≤28 ms en viewport móvil (Playwright, 390×844, CPU 4× throttling).
- [x] El contador de `setTheme` redundantes queda en 0 durante una partida completa sin tocar el selector de tema. Las únicas lecturas no-cero medidas son un "1" causado por el double-invoke de efectos de React Strict Mode en dev (el guard del Fix 2 lo detecta y descarta); en producción, sin ese double-invoke, queda en 0.
- [~] Los re-renders de `GamePlayer` por minuto bajan respecto a la baseline en los 5 juegos. **No baja — resultado esperado, no un fix fallido.** El conteo de `renders` está determinado por los `setState` propios de `GamePlayer` (`setScore`, `setLives`…) disparados por callbacks del engine, no por la estabilidad de `theme`/callbacks que corrigen Fix 1/2. La señal real de que Fix 1/2 funcionan es `setTheme` redundante = 0, documentado arriba. Decisión tomada con el usuario en Step 7: documentar como esperado en vez de perseguir el número.
- [x] Arkanoid: tras 5 s con la pestaña oculta, la bola no atraviesa ningún bloque al volver. Verificado con Playwright: canvas congelado byte a byte durante los 5 s completos, reanuda sin salto y sin disparar game over espurio.
- [x] Con la pestaña oculta, ningún engine mantiene un rAF vivo. Verificado en los 5 juegos: canvas congelado (capturas idénticas) durante toda la ventana oculta.
- [~] Capturas antes/después de cada juego, en el mismo tema y estado inicial, son idénticas píxel a píxel. **Verificado solo visualmente, no con un diff automatizado.** No había un paquete Playwright/Node local disponible en este entorno para scriptear una comparación byte a byte fuera de las herramientas ya usadas; se confirmó visualmente en cada paso (3-6) que el layout, HUD y arte de arkanoid/rocas/snake no cambiaron. Pendiente si se quiere el diff automatizado formal.
- [x] `npm run build` y `npm run lint` pasan.
- [x] `references/performance_baseline.md` existe con las 5 filas y ambas columnas (antes/después).

## Decisiones tomadas y descartadas

- **Instrumentar antes de optimizar** — sin cifras no se puede probar ninguna mejora ni detectar una regresión.
- **Overlay activado por query param en vez de solo-dev** — permite medir en un móvil real contra el deploy; solo-dev dejaría ciego justo el caso más lento.
- **rAF propio del overlay en vez de instrumentación dentro de cada engine** — mide el presupuesto real del hilo principal sin tocar los cinco `engine.ts` para el hook de medición.
- **Sin capas offscreen ni DPR** — decisión explícita del usuario: esta iteración es de bajo riesgo y no cambia cómo se dibuja.
- **Sin React Compiler** — resolver la inestabilidad de props a mano; activar el compiler es una decisión de toda la app, spec propio.
- **Fix de `rocas` condicionado a la medición** — no se reescribe el bucle de partículas si el juego ya cumple el presupuesto tras los fixes 1-5.

## Riesgos identificados

- **Regresión visual silenciosa** al memoizar la paleta o cachear assets — mitigado por el criterio de comparación píxel a píxel.
- **Mediciones no reproducibles** entre máquinas — la baseline registra dispositivo, navegador y throttling usados, para que la comparación antes/después sea consistente.
- **`visibilitychange` en conflicto con la pausa manual** — la pausa automática debe ser un estado separado de `isPaused`; si no, al volver de una pausa manual con la pestaña oculta el juego podría reanudarse solo.
