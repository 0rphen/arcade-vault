# SPEC 03 — About page + envío de contacto por email

> **Estado:** Implementado
> **Depende de:** 02-home-english-routes
> **Fecha:** 2026-07-30
> **Objetivo:** Implementar la página `/about` portando `about.jsx` del template (hero + formulario de contacto), donde el envío del formulario dispara un correo real vía Resend a the.bebop.88@gmail.com.

## Scope

**Dentro del alcance:**

- **Componente `components/about.tsx`** — port a TSX/Next del `about.jsx` del template: hero "Acerca de", `highlight-row` (3 highlights con íconos SVG pixelados), divider banner animado, sección de contacto con formulario (nombre, email, mensaje).
- **Ruta `/about`** (`app/about/page.tsx`) que renderiza `<About />`. El link del nav ya apunta ahí (agregado en spec 02); deja de dar 404.
- **Envío real de email vía Resend** — Route Handler `app/api/contact/route.ts` (POST) que recibe `{ name, email, message }`, valida, y usa el SDK `resend` para enviar un correo a `the.bebop.88@gmail.com` con `from: onboarding@resend.dev` y subject `"Nuevo mensaje de contacto — {nombre}"`.
- **Dependencia `resend`** agregada a `package.json`.
- **Variable de entorno `RESEND_API_KEY`** — documentada (usada en el route handler vía `process.env`), ya configurada por el usuario en su entorno local.
- **Validación en el formulario:** campos no vacíos + formato de email básico (regex) antes de enviar.
- **Estados de UI del formulario:** idle → enviando → éxito (estilo `terminal-success` del template, con nombre del remitente) → error (mismo estilo terminal, línea `[FAIL]`, permite reintentar sin perder lo escrito).
- **CSS del About/Contact** — portar `.about-*`, `.highlight*`, `.hl-*`, `.contact-*`, `.tip*`, `.terminal-success` y estilos relacionados desde `references/templates/home-about/styles.css` a `app/globals.css`, evitando colisión con clases ya existentes.
- **Verificación con Playwright MCP**: navegar a `/about`, enviar el formulario con datos válidos y confirmar el estado de éxito, probar validación con campos vacíos/email inválido, sin errores de consola.

**Fuera de alcance (diferido):**

- **Persistencia del mensaje en base de datos** — no hay storage en el proyecto; solo se envía el email, no se guarda.
- **Protección anti-spam/anti-abuso** (honeypot, rate limiting) — MVP sin usuarios reales aún.
- **Traducción del contenido a inglés** — sigue en español, igual que el resto del sitio.
- **Confirmación de recepción al remitente** (email de auto-respuesta al usuario que llenó el form) — solo se notifica al equipo.

## Modelo de datos

No se introduce persistencia ni entidades en `lib/data.ts`/`lib/session.ts`. Solo un tipo local para la carga útil del formulario, definido en el propio route handler:

```ts
// app/api/contact/route.ts
interface ContactPayload {
  name: string;
  email: string;
  message: string;
}
```

Sin estado del lado del cliente más allá del `useState` local del formulario (`{ name, email, message }`, estado de envío `"idle" | "sending" | "success" | "error"`).

## Plan de implementación

1. **Dependencia y variable de entorno** — Agregar `resend` a `package.json` (`npm install resend`). Documentar `RESEND_API_KEY` (usada vía `process.env.RESEND_API_KEY`, ya configurada localmente por el usuario).

2. **Route Handler `app/api/contact/route.ts`** — `POST` que recibe `{ name, email, message }`, valida no-vacíos + formato de email (regex), instancia `new Resend(process.env.RESEND_API_KEY)` y llama `resend.emails.send({ from: "onboarding@resend.dev", to: "the.bebop.88@gmail.com", subject: `Nuevo mensaje de contacto — ${name}`, text/html con los 3 campos })`. Devuelve `200` con `{ ok: true }` en éxito o `400`/`500` con `{ ok: false, error }` en fallo (validación vs. error de Resend). Sistema queda funcional y probable con `curl` en este punto.

3. **Componente `components/about.tsx`** — Portar `about.jsx`: hero + `highlight-row` + `HighlightIcon` (SVGs) + divider + sección de contacto. Reemplazar el `onSubmit` simulado por un `fetch("/api/contact", { method: "POST", body: JSON.stringify(form) })`; estado `status: "idle" | "sending" | "success" | "error"` controla qué se renderiza (form / `terminal-success` con líneas `[OK]` / bloque de error con líneas `[FAIL]` y botón reintentar). Reusar el patrón `useReveal` local (mismo enfoque que `components/home.tsx`, sin compartir el hook entre archivos).

4. **Ruta `app/about/page.tsx`** — Renderiza `<About />`. El nav ya apunta a `/about` (spec 02); deja de dar 404 automáticamente.

5. **CSS** — Portar a `app/globals.css` las clases `.about-*`, `.highlight*`, `.hl-*`, `.contact-*`, `.tip*`, `.terminal-success` y afines desde `references/templates/home-about/styles.css`, revisando colisión de nombres antes de pegar. Agregar estilo para el estado de error (variante roja del `terminal-success`, reutilizando `--magenta` o un rojo consistente con la paleta).

6. **Verificación con Playwright MCP** — Levantar el dev server; navegar a `/about`; probar validación (campos vacíos, email inválido) sin llamar al API; enviar formulario válido y confirmar el estado de éxito (requiere `RESEND_API_KEY` configurada); confirmar sin errores de consola y que el nav resalta "Acerca de" como activo.

## Criterios de aceptación

- [x] `/about` muestra el hero completo (kicker, título, misión, 3 highlights con íconos) y el divider animado.
- [x] La sección de contacto muestra el intro (kicker, título, tips) y el formulario con campos nombre/email/mensaje.
- [x] Enviar el formulario con algún campo vacío muestra el shake y no dispara el request.
- [x] Enviar el formulario con un email mal formado (ej. `"abc"`) se rechaza sin llamar al API.
- [x] Enviar el formulario con datos válidos hace `POST /api/contact`, y en éxito reemplaza el form por el estado `terminal-success` con el nombre del remitente.
- [x] `POST /api/contact` con payload válido envía un email real vía Resend a `the.bebop.88@gmail.com` con subject `"Nuevo mensaje de contacto — {nombre}"` y los 3 campos en el cuerpo.
- [x] Si Resend falla (ej. `RESEND_API_KEY` inválida), el formulario muestra el estado de error estilo terminal (`[FAIL]`) sin perder los datos escritos, con botón para reintentar.
- [x] El link "Acerca de" en el nav (desktop y móvil) navega a `/about` sin 404, y el nav resalta "Acerca de" como activo solo en esa ruta.
- [x] `npm run build` compila sin errores de tipos ni de lint.
- [x] Verificación manual con Playwright MCP: recorrido de `/about`, validación de formulario, envío exitoso, sin errores de consola.

## Decisiones tomadas y descartadas

- **Envío real vía Resend, no simulado** — se descartó mantener el `setSent` local del template porque el usuario pidió explícitamente "envío de correo" real, no solo la UI.
- **Sin persistencia en base de datos** — se descartó guardar el mensaje porque el proyecto no tiene storage/DB configurado aún; agregar uno sería un cambio mayor fuera del alcance de este spec. Solo se envía el email.
- **`from: onboarding@resend.dev` (sandbox)** — se descartó pedir un dominio verificado porque el usuario no tiene uno listo; el sandbox de Resend permite enviar de inmediato con cualquier API key, suficiente para el MVP.
- **Destinatario `the.bebop.88@gmail.com` (no `hohner.rojas@gmail.com`)** — el sandbox de Resend solo permite enviar a la dirección de la cuenta con la que se registró la API key; `the.bebop.88@gmail.com` es esa cuenta, por lo que se ajustó el destinatario tras la implementación inicial del route handler.
- **Sin protección anti-spam (honeypot/rate limiting)** — se descartó por sobre-construcción; el proyecto es un MVP sin tráfico real. Queda como riesgo identificado para revisar si el formulario recibe abuso.
- **`RESEND_API_KEY` ya configurada por el usuario** — no se genera `.env.example` nuevo ni se agrega lógica de fallback; el route handler asume que la variable existe en el entorno.
- **`useReveal` duplicado en `about.tsx` en vez de compartido con `home.tsx`** — consistente con cómo el template original define el hook por archivo; extraerlo a un hook compartido (`lib/use-reveal.ts`) se descartó por ser una refactorización no pedida, fuera del alcance de portar el template.
- **Validación de email con regex simple en cliente y servidor** — se descartó una librería de validación (zod, etc.) por ser innecesaria para un solo campo; se usa una regex básica duplicada en `about.tsx` y `route.ts`.

## Riesgos identificados

- **Sandbox de Resend (`onboarding@resend.dev`)** puede tener límites de entrega o filtrarse a spam en algunos proveedores; si se vuelve un problema, requiere verificar un dominio propio en Resend (fuera de este spec).
- **`RESEND_API_KEY` ausente o inválida en producción** — el endpoint fallará en runtime; no hay validación de la env var al build time, solo se refleja como error en el estado del formulario al momento del envío.
- **Sin anti-spam** — el endpoint podría recibir abuso si se hace público. Mitigación diferida (ver "Fuera de alcance").
