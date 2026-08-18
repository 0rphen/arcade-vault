# SPEC 16 — Headers de seguridad y configuración de Supabase Auth

> **Estado:** Approved
> **Depende de:** 13-supabase-auth
> **Fecha:** 2026-08-18
> **Objetivo:** Agregar los headers de seguridad HTTP recomendados en `next.config.ts` y documentar/verificar la configuración manual del dashboard de Supabase Auth (password mínimo de 8 caracteres, leaked password protection, rate limit de signups por IP).

## Por qué existe este spec

`references/security/checklist.md` recoge un checklist básico de seguridad. Dos de sus ítems son configuración pura (no DB), separada de los hallazgos de RLS/funciones `SECURITY DEFINER` que resuelve spec 15:

- Headers de seguridad HTTP en Next.js — hoy `next.config.ts` solo tiene `allowedDevOrigins`, sin `headers()`.
- Tres ajustes del dashboard de Supabase Auth: longitud mínima de contraseña, leaked password protection (`auth_leaked_password_protection`, WARN en `get_advisors`) y rate limit de signups por IP.

Este spec sigue el mismo patrón que spec 13 usó para la configuración manual de providers OAuth: documentarla como paso explícito del plan de implementación, verificable, en vez de asumir que "ya está hecho" en el dashboard.

## Alcance

**Dentro del alcance:**

- `headers()` async en `next.config.ts`, aplicado a `/:path*`, con los 3 headers del checklist: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
- Configuración manual verificada en el dashboard de Supabase (Authentication → Policies/Providers según corresponda):
  - Minimum password length: 8.
  - Leaked password protection: habilitada.
  - Rate limit de signups por IP (anti-bot): habilitado con el valor por defecto del dashboard.

**Fuera de alcance (diferido):**

- Content-Security-Policy, HSTS, Permissions-Policy — no pedidos por el checklist ni por el usuario en este spec.
- RLS y funciones `SECURITY DEFINER` de Supabase → spec 15.
- Cambios en `lib/auth/actions.ts` o `components/auth-form.tsx` para reflejar mensajes de error específicos de estas nuevas reglas del dashboard (p. ej. "contraseña filtrada") — el manejo de errores genérico ya existente se conserva tal cual.

## Modelo de datos

Este spec no introduce estructuras de datos nuevas — es configuración (headers HTTP en `next.config.ts` y ajustes del dashboard de Supabase Auth). Se omite esta sección.

```ts
// next.config.ts
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.5.116"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
```

## Plan de implementación

1. Editar `next.config.ts`: agregar `securityHeaders` y la función `async headers()` aplicando `/:path*` (bloque de arriba), conservando `allowedDevOrigins` existente. Prueba manual: `npm run dev`, `curl -sI http://localhost:3000/` muestra `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin`; navegar el sitio en el browser no muestra regresiones (nav, juegos, `/salon`, `/auth`).
2. Configuración manual en el dashboard de Supabase → Authentication → Policies (Password): fijar "Minimum password length" en 8. Prueba manual: intentar registrarse con una contraseña de 7 caracteres es rechazado por Supabase Auth con un mensaje de error.
3. Configuración manual en el dashboard de Supabase → Authentication → Policies (Password): habilitar "Leaked password protection". Prueba manual: intentar registrarse con una contraseña conocida y filtrada (p. ej. `password123`) es rechazada.
4. Configuración manual en el dashboard de Supabase → Authentication → Rate Limits: habilitar/confirmar el límite de signups por IP (valor por defecto del dashboard, sin endurecerlo a un número custom). Prueba manual: el panel de Rate Limits muestra el límite de signup activo (no "unlimited"/deshabilitado).
5. Ejecutar `get_advisors(type: "security")` de Supabase tras los pasos 2–4. Prueba manual: ya no aparece `auth_leaked_password_protection`.

## Criterios de aceptación

- [ ] `curl -sI` a cualquier ruta del sitio (dev o prod) devuelve `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin`.
- [ ] Navegar nav, catálogo de juegos, `/salon` y `/auth` en el browser no muestra regresiones tras agregar los headers.
- [ ] En el dashboard de Supabase, "Minimum password length" está fijado en 8.
- [ ] Registrarse con una contraseña de menos de 8 caracteres es rechazado con un mensaje de error visible en `components/auth-form.tsx`.
- [ ] "Leaked password protection" está habilitado en el dashboard.
- [ ] Registrarse con una contraseña filtrada conocida es rechazado con un mensaje de error visible.
- [ ] El rate limit de signups por IP está activo (no deshabilitado) en el dashboard.
- [ ] `get_advisors(type: "security")` ya no reporta `auth_leaked_password_protection`.
- [ ] `npx tsc --noEmit` no reporta errores nuevos tras el cambio en `next.config.ts`.

## Decisiones tomadas y descartadas

- **Sí:** solo los 3 headers del checklist (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`), sin CSP/HSTS/Permissions-Policy. Decisión explícita del usuario para acotar el alcance a lo pedido; agregar CSP en particular requeriría auditar todos los orígenes externos que carga la app (Supabase, fuentes, etc.), que no es parte de este checklist.
- **No:** agregar Strict-Transport-Security. Next.js/el hosting ya suele forzar HTTPS en producción; añadirlo sin confirmarlo con el usuario sería una decisión no pedida.
- **Sí:** las 3 configuraciones de Supabase Auth como pasos manuales documentados y verificables, mismo patrón que spec 13 usó para activar los providers OAuth en el dashboard. Ninguna de las tres es código del repo.
- **No:** endurecer el rate limit de signups a un número específico. El checklist solo pide "limitar signups por IP (anti-bot)"; el valor por defecto del dashboard de Supabase ya cumple ese objetivo sin que el usuario haya pedido un número concreto.
- **No:** cambiar los mensajes de error en `components/auth-form.tsx` para casos específicos (contraseña filtrada, muy corta). El manejo de error genérico ya existente (spec 13) muestra el mensaje que devuelve Supabase; no hay necesidad de un mensaje custom por tipo de error.

## Riesgos identificados

| Riesgo                                                                                                        | Mitigación                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `X-Frame-Options: DENY` rompe algún flujo que embeba el sitio en un iframe (p. ej. previews de algún hosting) | Nada en el repo usa iframes propios ni se embebe intencionalmente hoy; criterio de aceptación cubre navegación manual del sitio completo tras el cambio.                                        |
| Minimum password length en 8 o leaked password protection rechazan silenciosamente sin mensaje claro en la UI | `components/auth-form.tsx` ya maneja y muestra errores genéricos de Supabase Auth (spec 13); criterio de aceptación verifica que el mensaje de error es visible, no solo que el registro falla. |
| Los pasos manuales del dashboard se olvidan o revierten fuera de este flujo (no versionados en el repo)       | Igual riesgo que spec 13 con OAuth providers — se documenta como paso explícito y verificable con `get_advisors`, que puede re-ejecutarse en cualquier momento para confirmar el estado real.   |

## Lo que **no** entra en este spec

- Content-Security-Policy, HSTS, Permissions-Policy.
- RLS y funciones `SECURITY DEFINER` de Supabase → spec 15.
- Mensajes de error custom por tipo de fallo de autenticación.
- Endurecer el rate limit de signups a un valor numérico específico.

Cada uno de esos, si llega, va en su propio spec.
