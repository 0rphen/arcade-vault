# SPEC 10 — Controles táctiles para mobile

> **Estado:** Implementado
> **Depende de:** 05-asteroids-rocas, 07-caida-tetris, 08-arkanoid, 09-snake
> **Fecha:** 2026-08-13
> **Objetivo:** Agregar un bloque de controles táctiles (D-pad + botón de acción + botón de pausa) debajo del canvas, visible automáticamente solo en dispositivos táctiles, para que los 4 juegos jugables (rocas, caída, arkanoid, snake) sean jugables en mobile sin modificar los motores existentes.

## Alcance

**Dentro del alcance:**

- **Componente compartido `components/games/touch-controls.tsx`** — client component que renderiza el D-pad (hasta 4 flechas) + hasta 1 botón de acción + botón de pausa, recibiendo por props qué botones mostrar y qué código de tecla dispara cada uno. Usa Pointer Events (`pointerdown`/`pointerup`/`pointercancel`) por `pointerId`, soportando multi-touch real (ej. mantener "arriba" y "izquierda" en Rocas a la vez).
- **Config por juego `components/games/touch-controls-config.ts`** — mapeo declarativo `Record<gameId, TouchControlsConfig>` con qué flechas del D-pad están activas y qué código dispara cada una, más el botón de acción (si aplica):
  - `rocas`: D-pad izquierda/derecha → `ArrowLeft`/`ArrowRight` (rotar), arriba → `ArrowUp` (empuje); abajo inactivo/oculto. Acción → `Space` (disparo).
  - `caida`: D-pad izquierda/derecha → mover, abajo → caída suave (`ArrowDown`), arriba → rotar (`ArrowUp`). Acción → `Space` (caída rápida).
  - `arkanoid`: D-pad solo izquierda/derecha → `ArrowLeft`/`ArrowRight`; sin botón de acción.
  - `snake`: D-pad completo (4 direcciones); sin botón de acción.
- **Simulación de teclado** — cada botón del D-pad/acción despacha `window.dispatchEvent(new KeyboardEvent("keydown"/"keyup", { code, bubbles: true }))` con el mismo `code` que ya escuchan los 4 engines. Ningún `engine.ts` se modifica.
- **Detección de dispositivo táctil** — el bloque se renderiza solo si `window.matchMedia("(pointer: coarse)").matches` (chequeado en `useEffect`, sin desincronizar la hidratación). En desktop con mouse/teclado no aparece, aunque se achique la ventana.
- **Botón de pausa integrado** — dentro del bloque de controles táctiles, mismo `onClick`/handler que el botón "PAUSA" existente del HUD (`setPaused`); el HUD superior no cambia (conserva PAUSA/FIN/SALIR igual que hoy, en desktop y mobile).
- **D-pad deshabilitado durante la pausa** — mientras `paused === true`, los botones de dirección/acción no despachan eventos (evita mover nave/paleta/pieza estando pausado); el botón de pausa del bloque táctil sigue activo (para reanudar) y, en Arkanoid, el tap sobre el selector de nivel del canvas sigue funcionando vía click nativo (sin cambios en `engine.ts`).
- **Reordenamiento en `components/game-player.tsx`** — de arriba a abajo: HUD de stats (sin cambios) → `.crt` (canvas) → bloque de controles táctiles (nuevo, condicional) → selector de tema (`hud-theme`, se mueve debajo del bloque de controles táctiles, antes vivía junto a PAUSA/FIN/SALIR en `hud-actions`).
- **Estilos** — nuevas clases en `app/globals.css` para el bloque de controles táctiles (D-pad tipo cruz con glifos `▲▼◀▶`, botón de acción circular, coherente con la estética pixel/CRT del resto del HUD).

**Fuera de alcance (diferido):**

- **Gestos (swipe/tap sobre el canvas)** — descartado, se usa el patrón de D-pad + botones.
- **Vibración háptica (`navigator.vibrate`)** — no se agrega en este spec.
- **Rediseño del HUD superior para mobile** (achicar/reacomodar PAUSA/FIN/SALIR o el layout de `player-hud`) — fuera de alcance; solo se agrega el botón de pausa duplicado en el bloque táctil.
- **Cambios en la lógica de los 4 `engine.ts`** — se preserva el contrato actual sin tocarlos; toda la integración es vía eventos de teclado simulados.
- **Soporte a dispositivos con teclado físico + pantalla táctil simultánea (ej. tablets con teclado)** — se resuelve con el criterio único de `pointer: coarse`, sin lógica adicional para casos híbridos.

## Modelo de datos

No se agregan tablas ni cambios en Supabase — esta feature es 100% cliente. Se define el contrato TypeScript entre `game-player.tsx`, la config por juego y el componente compartido. **Diseño pensado para extensibilidad**: agregar controles táctiles a un juego futuro solo requiere una entrada nueva en `TOUCH_CONTROLS_CONFIG`, sin tocar `touch-controls.tsx` ni el `engine.ts` del juego.

```ts
// components/games/touch-controls-config.ts
export interface TouchControlsConfig {
  /** Qué flechas del D-pad están activas para este juego, y qué `code` de teclado disparan. */
  dpad: {
    up?: string; // ej. "ArrowUp"
    down?: string;
    left?: string;
    right?: string;
  };
  /** Botón de acción único, opcional. Ausente = el juego no muestra botón de acción. */
  action?: {
    code: string; // ej. "Space"
    label: string; // ej. "DISPARO", "CAÍDA RÁPIDA"
  };
}

export const TOUCH_CONTROLS_CONFIG: Record<string, TouchControlsConfig> = {
  rocas: {
    dpad: { up: "ArrowUp", left: "ArrowLeft", right: "ArrowRight" },
    action: { code: "Space", label: "DISPARO" },
  },
  caida: {
    dpad: {
      up: "ArrowUp",
      down: "ArrowDown",
      left: "ArrowLeft",
      right: "ArrowRight",
    },
    action: { code: "Space", label: "CAÍDA RÁPIDA" },
  },
  arkanoid: {
    dpad: { left: "ArrowLeft", right: "ArrowRight" },
  },
  snake: {
    dpad: {
      up: "ArrowUp",
      down: "ArrowDown",
      left: "ArrowLeft",
      right: "ArrowRight",
    },
  },
};
```

```tsx
// components/games/touch-controls.tsx
export interface TouchControlsProps {
  config: TouchControlsConfig;
  /** Deshabilita D-pad/acción sin ocultar el bloque (se usa cuando paused === true). */
  disabled: boolean;
  onPauseToggle: () => void;
  paused: boolean;
}

export default function TouchControls(props: TouchControlsProps): JSX.Element;
```

`game-player.tsx` consulta `TOUCH_CONTROLS_CONFIG[game.id]`; si no hay entrada (juego sin motor real, o futuro juego que aún no sumó su config), no se renderiza el bloque — un juego nuevo queda automáticamente sin controles táctiles hasta que alguien agregue su entrada, no rompe nada por omisión.

## Plan de implementación

1. **Crear `components/games/touch-controls-config.ts`** — interfaz `TouchControlsConfig` y el `Record<string, TouchControlsConfig>` con las 4 entradas (`rocas`, `caida`, `arkanoid`, `snake`) según el mapeo confirmado. Verificable: compila con `tsc`, sin efectos de import.

2. **Crear `components/games/touch-controls.tsx`** — client component. Renderiza el D-pad (solo las flechas presentes en `config.dpad`), el botón de acción (solo si `config.action` existe) y el botón de pausa (siempre, si el bloque se renderiza). Cada botón de dirección/acción usa `onPointerDown`/`onPointerUp`/`onPointerCancel` (por `pointerId`, soporta multitouch) para despachar `window.dispatchEvent(new KeyboardEvent("keydown"/"keyup", { code, bubbles: true }))`. Cuando `disabled` es `true`, los botones de dirección/acción no despachan eventos (el de pausa sigue activo). Verificable: compila con `tsc` sin `any`.

3. **Estilos en `app/globals.css`** — clases nuevas para el bloque de controles táctiles: contenedor debajo de `.crt`, D-pad en cruz con glifos `▲▼◀▶`, botón de acción circular, botón de pausa, estética coherente con el resto del HUD pixel/CRT (colores/fuentes ya definidos como variables CSS del proyecto).

4. **Integrar en `components/game-player.tsx`**:
   - Detectar `pointer: coarse` en un `useEffect` (`window.matchMedia("(pointer: coarse)").matches`) y guardar en un estado `isTouchDevice`.
   - Consultar `TOUCH_CONTROLS_CONFIG[game.id]`; si existe y `isTouchDevice` es `true`, renderizar `<TouchControls>` debajo de `.crt`, pasando `disabled={paused}`, `paused`, y `onPauseToggle={() => setPaused((p) => !p)}` (mismo handler que ya usa el botón "PAUSA" del HUD).
   - Mover el bloque `hud-theme` (selector de tema + claro/oscuro) para que se renderice debajo del bloque de controles táctiles en vez de dentro de `hud-actions`.

5. **Verificación manual con DevTools (emulación táctil + `pointer: coarse`)** — para cada uno de los 4 juegos (`/games/rocas/jugar`, `/games/caida/jugar`, `/games/arkanoid/jugar`, `/games/snake/jugar`) en modo dispositivo móvil de Chrome DevTools:
   - El bloque de controles táctiles aparece debajo del canvas; en un viewport de escritorio sin emulación táctil, no aparece.
   - Cada botón del D-pad mueve/rota/empuja según corresponda; en Rocas, mantener "arriba" + "izquierda" simultáneamente empuja y rota a la vez (multitouch).
   - El botón de acción dispara disparo (Rocas) / caída rápida (Caída); Arkanoid y Snake no muestran botón de acción.
   - El botón de pausa del bloque táctil pausa/reanuda igual que el del HUD; con el juego en pausa, tocar el D-pad no mueve nada.
   - En Arkanoid, con el juego en pausa, tocar los botones de selección de nivel dibujados en el canvas sigue cambiando de nivel y reanudando (tap dispara el `click` nativo del engine sin cambios).
   - El selector de tema (donde aplica: caída/arkanoid/snake) sigue funcionando, ahora ubicado debajo del bloque de controles táctiles.
   - Confirmar que en desktop (mouse + teclado, sin emulación táctil) el comportamiento no cambia: no aparece el bloque, teclado funciona igual que antes.

6. **`npm run build`** — compila sin errores de tipos ni de lint.

## Criterios de aceptación

- [ ] `components/games/touch-controls-config.ts` existe, exporta `TouchControlsConfig` y `TOUCH_CONTROLS_CONFIG` con entradas para `rocas`, `caida`, `arkanoid` y `snake` según el mapeo confirmado.
- [ ] `components/games/touch-controls.tsx` existe, es un client component, sin `any`, y no modifica ningún `engine.ts` de los 4 juegos.
- [ ] El bloque de controles táctiles se muestra solo cuando `window.matchMedia("(pointer: coarse)").matches` es `true`; en desktop (mouse + teclado) no aparece.
- [ ] En Rocas, el D-pad expone izquierda/derecha (rotar) y arriba (empuje), y el botón de acción dispara (`Space`); mantener dos botones a la vez produce ambos efectos simultáneamente (multitouch real vía Pointer Events).
- [ ] En Caída, el D-pad expone las 4 direcciones (izquierda/derecha mover, abajo caída suave, arriba rotar) y el botón de acción hace caída rápida (`Space`).
- [ ] En Arkanoid, el D-pad expone solo izquierda/derecha; no se muestra botón de acción.
- [ ] En Snake, el D-pad expone las 4 direcciones; no se muestra botón de acción.
- [ ] El bloque de controles táctiles incluye un botón de pausa que pausa/reanuda igual que el botón "PAUSA" del HUD superior (ambos quedan sincronizados).
- [ ] Con el juego en pausa, tocar el D-pad o el botón de acción no dispara ningún evento de teclado; el botón de pausa del bloque táctil sigue activo para reanudar.
- [ ] En Arkanoid, con el juego en pausa, tocar (tap) los botones de selección de nivel dibujados en el canvas sigue funcionando sin cambios en `engine.ts`.
- [ ] El selector de tema (caída/arkanoid/snake) se renderiza debajo del bloque de controles táctiles, y sigue funcionando igual que antes.
- [ ] Ningún `engine.ts` de los 4 juegos fue modificado; toda la integración es vía `KeyboardEvent` simulados despachados en `window`.
- [ ] Ningún otro comportamiento de escritorio (teclado, HUD, mouse en Arkanoid) cambia.
- [ ] `npm run build` compila sin errores de tipos ni de lint.

## Decisiones tomadas y descartadas

- **Simular `KeyboardEvent` nativos en vez de agregar una API de touch a cada engine** — se descartó modificar los 4 `engine.ts` porque ya escuchan `keydown`/`keyup` en `window`; despachar eventos sintéticos con el mismo `code` logra el mismo efecto sin tocar código probado y estable, y mantiene el contrato engine/wrapper intacto.
- **Pointer Events (`pointerdown`/`pointerup`/`pointercancel`) en vez de Touch Events** — se prefiere sobre `touchstart`/`touchend` porque soporta multitouch por `pointerId` igual que Touch Events, pero además funciona con mouse/trackpad (útil para probar en DevTools sin emulación táctil real).
- **Detección por `pointer: coarse` en vez de breakpoint de ancho de viewport** — se descartó mostrar el bloque solo por ancho de pantalla porque un desktop con ventana angosta (o modo split-screen) no debería mostrar controles táctiles; el criterio es si el dispositivo primario es táctil, no el tamaño de pantalla.
- **Layout fijo (D-pad + hasta 1 acción + pausa) con botones ocultos por juego, en vez de un layout a medida por juego** — confirmado en la fase de preguntas: un mismo componente reutilizable en los 4 juegos, cada uno oculta lo que no usa (ej. Arkanoid sin botón de acción), preservando consistencia visual sin renunciar a extensibilidad para juegos futuros.
- **Controles debajo del canvas, no superpuestos** — se descartó el patrón de overlay semitransparente encima del canvas (visto inicialmente en una imagen de referencia) a pedido explícito del usuario; los controles ocupan una franja fija propia debajo de `.crt`, sin tapar nunca el área de juego.
- **Botón de pausa duplicado en el bloque táctil, HUD superior sin cambios** — se descartó mover el botón "PAUSA" del HUD a mobile (lo que rompería la paridad visual con desktop); en cambio se agrega un botón adicional dentro del bloque táctil que llama al mismo handler, para que quede al alcance del pulgar sin alterar el HUD existente.
- **Selector de tema reubicado debajo del bloque de controles táctiles** — a pedido explícito del usuario, se saca de `hud-actions` (donde hoy convive con PAUSA/FIN/SALIR) para dejar esa fila más compacta en mobile y priorizar los controles de juego por encima del selector de tema, de uso poco frecuente durante la partida.
- **D-pad deshabilitado (no oculto) durante la pausa** — se descartó ocultar el bloque completo al pausar porque el botón de pausa/reanudar debe seguir siendo tocable; solo se desactivan los botones de dirección/acción para evitar mover nave/paleta/pieza mientras el juego está detenido.
- **Tap en el selector de nivel de Arkanoid sin cambios en `engine.ts`** — se confirmó que un tap dispara el evento `click` nativo del navegador (el bloque de controles táctiles no cubre el canvas, así que no hay ningún `preventDefault` de por medio que lo bloquee); no se agrega un listener táctil redundante.
- **Config declarativa (`TOUCH_CONTROLS_CONFIG`) en vez de props hardcodeadas por juego** — se prioriza la extensibilidad pedida por el usuario: sumar controles táctiles a un juego futuro es agregar una entrada al `Record`, no tocar `touch-controls.tsx`.

## Riesgos identificados

- **Doble input si el usuario tiene teclado y touch a la vez (ej. tablet con teclado Bluetooth)** — el `KeyboardEvent` sintético del botón táctil y una tecla física presionada simultáneamente podrían generar estados de `keydown` inconsistentes en los engines (que trackean `keys[e.key]` con `onKeyUp` propio). Mitigación: ninguna especial en este spec, es un caso extremo no contemplado; el criterio `pointer: coarse` ya asume dispositivo primario táctil.
- **`KeyboardEvent` sintético no dispara comportamiento nativo del navegador (scroll, etc.)** — al despacharse vía `dispatchEvent` en vez de venir de hardware real, algunos navegadores podrían tratarlo distinto (ej. no bloquear scroll aunque el engine llame `preventDefault()` sobre el evento sintético). Mitigación: el bloque de controles táctiles vive en su propio contenedor con controles nativos de botón (no gestos de swipe), por lo que no depende de bloquear el scroll del documento.
- **`pointerId` no liberado si el dedo sale del área del botón sin `pointerup`** — mitigación: manejar también `pointercancel` y `pointerleave` para liberar el estado "presionado" y despachar el `keyup` correspondiente, evitando que una dirección quede "trabada" como presionada indefinidamente.
- **Desincronización de hidratación** — la detección de `pointer: coarse` no puede leerse en el render inicial de SSR sin desincronizar la hidratación (mismo patrón ya usado para leer `localStorage` del tema en este archivo). Mitigación: se lee en `useEffect`, con el bloque oculto por defecto hasta que el efecto corre.
- **Botón de acción con label distinto por juego** — mitigación: el `label` es parte de `TouchControlsConfig`, no hardcodeado en `touch-controls.tsx`, así que agregar/cambiar un juego no requiere tocar el componente compartido.
