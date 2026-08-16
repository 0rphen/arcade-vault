# Baseline de rendimiento — spec 12

Métricas leídas del overlay `?perf=1` (`components/games/perf-overlay.tsx`),
media móvil de FPS sobre 1 s y p95 de frame time sobre 5 s, tras 6.5 s de
partida desde la navegación.

**Entorno de medición:**

- Navegador: Chromium (Playwright 1.62.1, headless) vía Playwright MCP.
- Desktop: viewport 1280×800, sin CPU throttling (rate 1×).
- Móvil: viewport 390×844, CPU throttling 4× (`Emulation.setCPUThrottlingRate`, CDP).
- Host: Linux x64 (contenedor de desarrollo), no un dispositivo físico ni con
  GPU real — los valores absolutos no son comparables a un móvil real, y
  tampoco son estables entre corridas en este host (ver "Ruido del entorno"
  más abajo). "Antes" es una sola corrida por celda (spec original); "después"
  es la media de 2-3 corridas en desktop hechas tras confirmar que no había
  procesos `next dev` colgados compitiendo por CPU (ver nota), 1 corrida en
  móvil.

## Desktop (1280×800, sin throttling)

| Juego    | FPS medio (antes) | p95 frame (antes) | Peor frame (antes) | FPS medio (después) | p95 frame (después) | Peor frame (después) |
| -------- | ----------------- | ----------------- | ------------------ | ------------------- | ------------------- | -------------------- |
| rocas    | 48.2              | 33.4 ms           | 66.7 ms            | 57.1 (n=6)          | 25.1 ms (n=6)       | 37.5–99.9 ms         |
| caida    | 53.0              | 33.4 ms           | 83.4 ms            | 57.4 (n=3)          | 28.2 ms (n=3)       | 36.7–50.0 ms         |
| arkanoid | 53.1              | 33.4 ms           | 68.5 ms            | 57.4 (n=3)          | 28.7 ms (n=3)       | 39.0–100.8 ms        |
| snake    | 56.1              | 19.9 ms           | 50.0 ms            | 55.0 (n=3)          | 24.6 ms (n=3)       | 50.0–66.7 ms         |
| frogger  | 57.0              | 18.0 ms           | 66.7 ms            | 58.0 (n=3)          | 24.6 ms (n=3)       | 50.0–52.5 ms         |

## Móvil (390×844, CPU 4× throttling)

| Juego    | FPS medio (antes) | p95 frame (antes) | Peor frame (antes) | FPS medio (después) | p95 frame (después) | Peor frame (después) |
| -------- | ----------------- | ----------------- | ------------------ | ------------------- | ------------------- | -------------------- |
| rocas    | 57.1              | 33.3 ms           | 66.6 ms            | 60.0                | 16.8 ms             | 33.3 ms              |
| caida    | 59.0              | 22.7 ms           | 34.0 ms            | 60.0                | 16.8 ms             | 24.4 ms              |
| arkanoid | 58.1              | 17.4 ms           | 34.0 ms            | 54.1                | 16.8 ms             | 66.7 ms              |
| snake    | 60.0              | 16.8 ms           | 23.1 ms            | 60.0                | 16.8 ms             | 23.0 ms              |
| frogger  | 60.0              | 16.8 ms           | 34.4 ms            | 59.0                | 20.7 ms             | 34.4 ms              |

## Contra los presupuestos del spec

- **Desktop (≥58 FPS, p95 ≤20 ms):** ningún juego cumple el p95 de forma
  consistente después de los fixes, en este host. FPS medio ronda 55–58 en
  los 5 juegos (por debajo o al borde de 58 en corridas individuales). Ver
  "Ruido del entorno".
- **Móvil (≥50 FPS, p95 ≤28 ms):** los 5 juegos cumplen ambos umbrales de
  forma consistente después de los fixes. Antes de los fixes, `rocas`
  (33.3 ms) y `caida` (22.7 ms, al límite) eran los más ajustados; después,
  los 5 quedan en 16.8–20.7 ms de p95.

## Ruido del entorno (hallazgo del Step 6/7)

Al medir `rocas` repetidamente tras aplicar el Fix 6 (compactado in-place de
partículas/balas/asteroides, ver `compactDead` en
`components/games/asteroids/engine.ts`), el p95 desktop siguió variando entre
17 ms y 33 ms de una corrida a otra sin relación aparente con el código. Se
encontraron varios procesos `next dev` huérfanos de pasos anteriores de esta
sesión (el `pkill` en background no los había matado a todos) compitiendo por
CPU con el proceso que se estaba midiendo. Tras matarlos y confirmar un único
servidor `next dev` activo, la varianza bajó pero no desapareció — los 5
juegos, no solo `rocas`, muestran el mismo rango de p95 ruidoso en desktop
(17–33 ms) independientemente de qué fixes les aplican. Esto apunta a que el
p95 desktop en este contenedor headless sin GPU está dominado por contención
de CPU del entorno, no por el código de cada engine. El presupuesto de p95
móvil (con CPU throttling explícito y por tanto menos sensible al ruido de
fondo) sí se cumple de forma consistente en los 5 juegos después de los
fixes, que es la señal más confiable disponible en este host de que las
correcciones funcionan.

## Otros contadores (sin tocar el selector de tema)

`setTheme` redundante se mantiene en 0 antes de los fixes (por qué: ver
párrafo original más abajo) y en 1 después, en los 4 juegos tematizados
(`caida`, `arkanoid`, `snake`, `frogger`; `rocas` no tiene temas). Ese "1" es
el double-invoke de efectos de React Strict Mode en modo dev (monta → limpia
→ monta), y confirma que el guard del Fix 2 funciona: sin él, ese doble
invoke habría llamado a `engine.setTheme()` dos veces; con él, la segunda
llamada se detecta como redundante y se descarta antes de tocar el engine.
En producción (sin Strict Mode double-invoke) este contador debería quedar en 0.

`resolveXTheme(theme)` devuelve siempre la misma referencia estática de la
tabla de temas para un mismo par tema/modo — así que aunque `theme` sea un
objeto nuevo en cada render de `game-player.tsx` (problema #1 del spec), el
`useMemo` de la paleta en los wrappers ya devolvía el mismo objeto antes del
Fix 1. El guard del Fix 2 es la protección real: si `resolveXTheme` deja de
ser una tabla estática pura en el futuro, evita que un `theme` inestable
dispare `setTheme()` de más.

**`renders` (re-renders de `GamePlayer` desde el montaje) — sin cambio antes
vs. después, y es el resultado esperado, no un fix fallido.** Los 5 juegos
muestran exactamente el mismo conteo antes y después de los Fixes 1-2: rocas
4→4, caida 4→4, arkanoid 22→22, snake 6→6, frogger 4→4. Motivo: el conteo de
`renders` mide cuántas veces se re-ejecuta el componente `GamePlayer`, y eso
lo determinan sus propios `setState` (`setScore`, `setLives`, `setLevel`…)
disparados por callbacks del engine — no la estabilidad del objeto `theme` ni
de los callbacks que Fix 1 memoiza. Fix 1/2 evitan trabajo _río abajo_
(recalcular la paleta, invalidar `TouchControls`, llamar a `engine.setTheme()`
de más) pero no pueden reducir cuántas veces `GamePlayer` necesita
re-renderizarse para reflejar una puntuación nueva — eso seguiría pasando con
props perfectamente estables. La señal real de que Fix 1/2 funcionan es
`setTheme` redundante, no `renders`.
