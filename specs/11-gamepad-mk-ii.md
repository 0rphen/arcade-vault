# SPEC 11 — Gamepad MK-II

> **Estado:** Implemented
> **Depende de:** 10-controles-tactiles-mobile, 05-asteroids-rocas, 07-caida-tetris, 08-arkanoid, 09-snake
> **Fecha:** 2026-08-15
> **Objetivo:** Rediseñar el bloque de controles táctiles como un gamepad neón "MK-II" tematizable, ampliando el contrato a dos botones de acción (A/B) y corrigiendo los dos bugs de despacho de teclas del componente actual.

## Por qué existe este spec

El bloque táctil de la SPEC 10 resolvió la jugabilidad en mobile pero no la presencia visual: son botones planos pegados debajo del CRT, ajenos a la estética arcade del resto del portal. `references/gamepad-assets/gamepad.html` es la dirección de diseño ya validada.

Además, el rediseño obliga a tocar `touch-controls.tsx`, que es exactamente donde viven dos bugs funcionales detectados al auditar el componente. Arreglarlos aquí evita un spec de corrección separado sobre el mismo archivo.

## Alcance

**Dentro del alcance:**

- **Rediseño de `components/games/touch-controls.tsx`** — nuevo DOM con chasis (`.gp`), columna izquierda con D-pad en cruz absoluta + hub central con gema, columna derecha con botones circulares A/B, y pastilla `START` centrada. Se conservan el nombre de archivo, el export por defecto y el gate `(pointer: coarse)`.
- **D-pad con relieve** — las 4 flechas pasan de glifos de texto a `<svg>` inline con `fill="currentColor"` (mismos paths que la referencia), con sombra inferior sólida que se hunde al pulsar y glow del color de acento.
- **Hub central decorativo** — `.gp-hub` con gema en rombo (`clip-path`) y animación `pulse-led` de 2s. `aria-hidden="true"`, no interactivo.
- **Dos botones de acción A/B** — `TouchControlsConfig.action` (objeto único) se reemplaza por `buttons: { a?: TouchButton; b?: TouchButton }` con `TouchButton = { code: string; label: string }`. Cada botón renderiza su letra `A`/`B` y expone `aria-label` con la acción real (ej. "Disparo"). Si un slot no está definido, ese botón no se renderiza.
- **Mapeo de los 4 juegos actuales** — `rocas`: A = `Space` ("Disparo"). `caida`: A = `Space` ("Caída rápida"). `arkanoid` y `snake`: sin botones. **Ningún `engine.ts` se modifica**; el slot B queda soportado por el contrato pero sin usar.
- **Botón START para pausa** — pastilla rectangular centrada dentro del chasis, etiqueta `START`, mismo `onPauseToggle` de hoy. Sustituye al `.touch-pause` circular. Sigue activo mientras `paused === true`.
- **Tematizado por juego** — el gamepad recibe la `GameThemeSelection` activa y aplica `data-gp-theme={themeId}` / `data-gp-mode={mode}` sobre `.gp`. La paleta se define en `app/globals.css` con variables locales, con 3 familias (`clasico`, `neon`, `retro`) × 2 modos. Si el juego no manda tema (`rocas`), se usa `clasico`/`dark`.
- **Fix — Arkanoid no responde al D-pad táctil** — `dispatchKey` pasa a emitir también `key` además de `code` (`new KeyboardEvent(type, { code, key, bubbles: true })`). El `key` se deriva del `code` con un mapa local (`ArrowLeft` → `"ArrowLeft"`, `Space` → `" "`). Sin esto, el engine de Arkanoid (que compara `e.key`) ignora los eventos táctiles.
- **Fix — tecla trabada al pausar** — `release()` deja de hacer early-return cuando `disabled` es `true`: el `keyup` se despacha siempre. Solo `press()` sigue respetando `disabled`. Evita que la nave siga rotando tras pausar con una dirección pulsada.
- **Estado visual de deshabilitado** — mientras `paused === true`, D-pad y A/B reciben el atributo HTML `disabled` y una clase que baja opacidad y anula el glow. START nunca se deshabilita.
- **Estilos** — el bloque `.touch-*` de `app/globals.css` (líneas 1159-1242) se reemplaza por un bloque `.gp-*` nuevo, con media query `@media (max-width: 620px)` que reduce D-pad y A/B según la referencia.

**Fuera de alcance (diferido):**

- **Mostrar el gamepad en desktop** con eco visual del teclado — descartado; se mantiene el gate `(pointer: coarse)`.
- **Usar realmente el slot B en algún juego** — requiere tocar engines (ej. hiperespacio en `rocas`, hold de pieza en `caida`); va en su propio spec.
- **Stick analógico o zona de arrastre** — no se agrega; sigue siendo D-pad discreto.
- **Gestos swipe/tap sobre el canvas** — sigue descartado desde la SPEC 10.
- **Vibración háptica (`navigator.vibrate`)** — no entra.
- **Que el gamepad lea las paletas `GameTheme` de cada engine** — descartado; esas paletas son de canvas, no de UI. El gamepad tiene su propia tabla de color indexada por `themeId`/`mode`.
- **Rediseño del HUD superior** (`PAUSA`/`FIN`/`SALIR`) y del selector de tema — sin cambios.

## Modelo de datos

Sin cambios en Supabase — la feature es 100% cliente. Cambia el contrato TypeScript entre `game-player.tsx`, la config por juego y el componente.

```ts
// components/games/touch-controls-config.ts
export interface TouchButton {
  code: string; // ej. "Space"
  label: string; // ej. "Disparo" — va al aria-label, no a la cara del botón
}

export interface TouchControlsConfig {
  dpad: { up?: string; down?: string; left?: string; right?: string };
  /** Botones de acción. Slot ausente = ese botón no se renderiza. */
  buttons?: { a?: TouchButton; b?: TouchButton };
}
```

```ts
// components/games/touch-controls.tsx
export interface TouchControlsProps {
  config: TouchControlsConfig;
  disabled: boolean;
  onPauseToggle: () => void;
  paused: boolean;
  /** Tema activo del juego. Ausente → "clasico"/"dark". */
  theme?: GameThemeSelection;
}
```

Convenciones:

- Las caras de los botones muestran siempre `A` y `B`; la acción concreta vive solo en `aria-label`.
- La paleta del gamepad se resuelve en CSS por `[data-gp-theme][data-gp-mode]`, no en JS.
- Cada familia define 4 variables locales sobre `.gp`: `--gp-accent` (D-pad, hub, botón B), `--gp-accent-2` (botón A), `--gp-chassis` (gradiente del chasis) y `--gp-face` (cara de las teclas).

## Plan de implementación

1. **Ampliar el contrato en `touch-controls-config.ts`** — agregar `TouchButton`, cambiar `action` por `buttons`, y actualizar las 4 entradas (`rocas` y `caida` con slot `a`; `arkanoid` y `snake` sin `buttons`). El proyecto queda con error de tipos en `touch-controls.tsx` hasta el paso 2 — ambos pasos son un solo commit.
2. **Corregir los dos bugs en `touch-controls.tsx`** — añadir el mapa `code → key` y emitirlo en `dispatchKey`; quitar el early-return de `release()`. Prueba manual: en Arkanoid móvil la pala se mueve con el D-pad; manteniendo `◀` y tocando START, la pala se detiene.
3. **Reescribir el DOM del componente** — chasis `.gp`, columnas, D-pad absoluto con SVGs, hub con gema, botones A/B, pastilla START. Prueba manual: los 4 juegos renderizan el gamepad y siguen siendo jugables.
4. **Reescribir el bloque de estilos en `app/globals.css`** — reemplazar las líneas 1159-1242 por el bloque `.gp-*` en familia `clasico`/`dark`, más la media query de 620px. Prueba manual: a 390×844 el gamepad no desborda ni provoca scroll horizontal.
5. **Añadir las 6 paletas** — variables locales por `[data-gp-theme="…"][data-gp-mode="…"]` para las 3 familias × 2 modos.
6. **Cablear el tema** — `touch-controls.tsx` acepta la prop `theme` y escribe los `data-*` con fallback `clasico`/`dark`; `game-player.tsx` se la pasa desde la selección de tema activa.
7. **Aplicar el estado deshabilitado** — atributo `disabled` + clase apagada en D-pad y A/B cuando `paused === true`; START exento.

## Criterios de aceptación

- [ ] `npx tsc --noEmit` pasa sin errores.
- [ ] En Arkanoid, en un viewport de 390×844, mantener `◀` del D-pad mueve la pala a la izquierda.
- [ ] En Rocas, mantener `▲`, tocar START y soltar deja la nave detenida (no sigue acelerando al reanudar).
- [ ] En Rocas el gamepad muestra un único botón de acción con la cara `A` y `aria-label="Disparo"`; el botón B no está en el DOM.
- [ ] En Arkanoid y Snake no se renderiza ningún botón A ni B.
- [ ] El botón START pausa y reanuda, y sigue respondiendo mientras el juego está pausado.
- [ ] Con el juego pausado, los botones del D-pad tienen el atributo `disabled` y no despachan eventos de teclado.
- [ ] Cambiar el tema en el HUD de Snake cambia los colores del gamepad sin recargar la página.
- [ ] En Rocas (sin temas) el gamepad se renderiza con `data-gp-theme="clasico"` y `data-gp-mode="dark"`.
- [ ] En un viewport de 1280×800 con puntero fino el gamepad no se renderiza.
- [ ] A 390×844 la página no tiene scroll horizontal en ninguno de los 4 juegos.
- [ ] La consola del navegador no registra errores ni warnings al montar el gamepad.
- [ ] Cada botón interactivo tiene un `aria-label` descriptivo; el hub tiene `aria-hidden="true"`.

## Decisiones

- **Sí:** ampliar el contrato a A/B aunque hoy ningún juego use B. El chasis de referencia tiene dos botones; dejar el hueco listo evita reabrir el contrato cuando llegue el primer juego que lo necesite.
- **No:** mapear B a alguna acción secundaria existente. Obligaría a tocar los `engine.ts`, que la SPEC 10 deliberadamente dejó intactos.
- **Sí:** B como pausa fue considerado y descartado. Mezcla una función de sistema con una de juego y deja el gamepad sin START, que es el patrón arcade esperado.
- **Sí:** paleta propia del gamepad indexada por `themeId`/`mode`. `GameTheme` describe colores de canvas (`background`, `grid`, piezas) y no tiene tokens de chasis ni de teclas.
- **No:** que el gamepad importe las paletas de cada engine. Acoplaría un componente de plataforma a cuatro módulos de juego distintos.
- **Sí:** fallback `clasico`/`dark` para juegos sin temas. Es el default ya establecido por el trabajo de `skin-designer`.
- **Sí:** derivar `key` desde `code` en `dispatchKey`, en vez de cambiar el engine de Arkanoid para que lea `e.code`. Mantiene intacta la regla de no tocar engines y de paso blinda el componente ante futuros engines que lean `e.key`.
- **No:** mostrar el gamepad en desktop con eco de teclado. Es vistoso pero no aporta jugabilidad y añade una superficie de estado que mantener.
- **Sí:** despachar siempre el `keyup` en `release()`. Un `keyup` de más es inofensivo; uno de menos deja el juego con una tecla trabada.
- **Sí:** letras `A`/`B` en la cara y acción en `aria-label`. Las etiquetas largas ("CAÍDA RÁPIDA") no caben legibles en un botón circular de 74px.

## Riesgos

| Riesgo                                                                                | Mitigación                                                                                                                  |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| El chasis de 760px de la referencia desborda en pantallas de 360px                    | La media query de 620px reduce D-pad a 144px y A/B a 64px; el criterio de aceptación verifica ausencia de scroll horizontal |
| Cambiar `action` por `buttons` rompe cualquier consumidor existente                   | El único consumidor es `touch-controls.tsx`; `npx tsc --noEmit` detecta cualquier otro                                      |
| Un `code` sin entrada en el mapa `code → key` emite `key: undefined`                  | El mapa cubre los 5 códigos en uso (4 flechas + `Space`); si falta, se emite el propio `code` como `key`                    |
| Alguna familia de tema deja texto o glifos con contraste insuficiente en modo `light` | Cada familia define sus 4 variables completas; ninguna hereda parcialmente del modo `dark`                                  |

## Lo que **no** entra en este spec

- Usar el botón B en algún juego (requiere tocar engines).
- Mostrar el gamepad en desktop.
- Stick analógico, gestos swipe o vibración háptica.
- Rediseño del HUD superior o del selector de tema.
- Cambios en cualquier `engine.ts`.

Cada uno de esos, si llega, va en su propio spec.
