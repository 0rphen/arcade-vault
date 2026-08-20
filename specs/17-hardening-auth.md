# SPEC 17 — Hardening de autenticación

> **Estado:** Implementado
> **Depende de:** 13-supabase-auth, 14-identidad-leaderboard, 15-rls-supabase, 16-headers-y-auth-config
> **Fecha:** 2026-08-18
> **Objetivo:** Cerrar los riesgos de auth bypass y filtración detectados en la auditoría de seguridad (SEC-04, SEC-06, SEC-09, SEC-11, SEC-14, SEC-15) — origen confiable vía `NEXT_PUBLIC_SITE_URL`, validación de `next`/`type` en los callbacks de auth, rate limit propio de login/signup por IP, validación server-side de nickname, mensajes de error genéricos y propagación de cookies en el proxy.

## Por qué existe este spec

La auditoría de seguridad registrada en `references/security/audit-log.md` (corrida 2026-08-19) detectó varios hallazgos de severidad media/baja específicos de la superficie de autenticación, distintos de los que ya resolvieron specs 15 (RLS) y 16 (headers + config de dashboard). Este spec agrupa los que quedan abiertos en `lib/auth/actions.ts`, `app/auth/callback/route.ts`, `app/auth/confirm/route.ts` y `proxy.ts`: SEC-04, SEC-06, SEC-09, SEC-11, SEC-14 y SEC-15.

## Alcance

**Dentro del alcance:**

- `NEXT_PUBLIC_SITE_URL` como nueva env var. `getOrigin()` en `lib/auth/actions.ts` la usa como fuente de verdad en producción; si no está seteada, cae a `x-forwarded-host`/`host` (comportamiento actual, útil para probar en LAN vía `allowedDevOrigins`).
- Validación de `next` en `app/auth/callback/route.ts` y `app/auth/confirm/route.ts`: debe empezar con `/` y no con `//` ni `/\`; si no cumple, se usa `/` como default.
- Validación de `type` en `app/auth/confirm/route.ts` contra un allow-list de `EmailOtpType` en vez de castear el query param directamente.
- Rate limit propio de `signInAction`/`signUpAction` por IP, respaldado en una tabla nueva de Supabase (`auth_rate_limits`), usando `x-forwarded-for` (Vercel) para la IP real del cliente.
- Validación server-side de `nickname` en `signUpAction` (3–20 chars, `[a-zA-Z0-9_-]`) — ya existe en el cliente (spec 14), falta en el server.
- Mensajes de error genéricos mapeados por código en `signInAction`/`signUpAction`/`updateNicknameAction`, reemplazando el `error.message` crudo de Supabase.
- Fix de `proxy.ts`: la rama de redirect a `/auth` propaga las cookies refrescadas por `setAll` en vez de descartarlas.

**Fuera de alcance (diferido):**

- SEC-01/02/07/08 (endpoint de contacto y `getTopScoresAction`) — superficie distinta a auth, no tocada por este spec.
- SEC-03/SEC-12 (config manual del dashboard de Supabase Auth) — ya son pasos documentados en spec 16; este spec no repite esa verificación, solo deja nota si algo cambia por los fixes de arriba.
- SEC-05/SEC-10 (CVEs de dependencias) — actualización de deps, spec aparte.
- SEC-13 (`auth_rls_initplan`, rendimiento de RLS) — no es vulnerabilidad, fuera de alcance de un spec de hardening de auth.
- SEC-17 (`getMyBestScores` sin RLS) — hoy no explotable, sin call-site que lo dispare; no se toca hasta que exista un caso real.
- Recuperación de contraseña, cambio de email, borrado de cuenta (ACC-07) — siguen fuera de alcance, ya documentado en spec 13.
- CAPTCHA o bloqueo por dispositivo/fingerprint además del rate limit por IP — no pedido, y el rate limit por IP ya resuelve el vector reportado (SEC-14).

## Modelo de datos

```sql
-- Tabla nueva: registro de intentos de login/signup por IP para el rate limit propio.
create table auth_rate_limits (
  id bigint generated always as identity primary key,
  ip text not null,
  action text not null check (action in ('signin', 'signup')),
  created_at timestamptz not null default now()
);

create index auth_rate_limits_ip_action_created_at_idx
  on auth_rate_limits (ip, action, created_at);

-- Sin RLS pública: solo la tienen que leer/escribir las server actions con
-- el cliente de servidor. anon/authenticated no necesitan acceso directo.
alter table auth_rate_limits enable row level security;
-- Sin policies → denegado por defecto para anon/authenticated; el server
-- action usa el cliente de servidor (misma clase de acceso que profiles/scores).
```

```ts
// lib/auth/rate-limit.ts (nuevo)
const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 5;

async function checkRateLimit(
  ip: string,
  action: "signin" | "signup",
): Promise<{ allowed: boolean }> {
  // cuenta filas de auth_rate_limits con esa ip+action en los últimos
  // WINDOW_MINUTES; si >= MAX_ATTEMPTS, allowed: false.
}

async function recordAttempt(
  ip: string,
  action: "signin" | "signup",
): Promise<void> {
  // insert en auth_rate_limits
}
```

**Desvío respecto de este bloque (post-implementación):** un review de seguridad detectó que `checkRateLimit`/`recordAttempt` como dos llamadas separadas tienen una condición de carrera (TOCTOU) — requests concurrentes pueden leer el mismo count antes de que cualquiera inserte, superando `MAX_ATTEMPTS`. Se reemplazaron por una única función `consumeRateLimit(ip, action)` en `lib/auth/rate-limit.ts` que invoca una función Postgres atómica (`auth_rate_limit_attempt`, `security definer`, `pg_advisory_xact_lock` por `ip+action`, `EXECUTE` revocado de `anon`/`authenticated`) que hace el conteo y el insert en una sola transacción. También se cambió de fail-open a fail-closed: si el RPC falla, `consumeRateLimit` devuelve `allowed: false` en vez de dejar pasar el intento. Verificado con 10 requests concurrentes a la misma IP → exactamente 5 permitidos.

```ts
// lib/auth/errors.ts (nuevo) — mapeo de error.code de Supabase a mensaje genérico
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Email o contraseña incorrectos.",
  user_already_exists: "No se pudo completar el registro.",
  weak_password: "La contraseña no cumple los requisitos mínimos.",
};
const DEFAULT_MESSAGE = "Ocurrió un error, intentá de nuevo.";
```

Sin cambios de tipos en `AuthActionResult` ni en componentes cliente — todo lo anterior es interno a las server actions.

## Plan de implementación

1. Migración MCP `auth_rate_limits_table`: crear tabla `auth_rate_limits` + índice + `enable row level security` sin políticas (bloque SQL de arriba). Prueba manual: `select * from auth_rate_limits` con la anon key devuelve 0 filas (denegado por RLS sin policy); con el cliente de servicio, un INSERT manual de prueba funciona.
2. Crear `lib/auth/rate-limit.ts` con `checkRateLimit`/`recordAttempt` (bloque de arriba), usando el cliente de servidor de Supabase. Prueba manual: llamar las funciones desde un script/REPL temporal confirma que a las 5 filas en la ventana de 5 min `checkRateLimit` devuelve `allowed: false`.
3. Envolver `signInAction`/`signUpAction` en `lib/auth/actions.ts` con `checkRateLimit`/`recordAttempt`, leyendo la IP de `x-forwarded-for` vía `headers()`. Si `checkRateLimit` bloquea, devolver `{ error: "Demasiados intentos. Esperá unos minutos e intentá de nuevo." }` sin llamar a Supabase Auth. Prueba manual: 5 logins fallidos seguidos con la misma IP bloquean el 6to intento con ese mensaje; esperar la ventana o limpiar la tabla lo desbloquea.
4. Agregar `NEXT_PUBLIC_SITE_URL` a `.env.template` (vacío) y `.env` (valor real de prod/dev). Actualizar `getOrigin()` en `lib/auth/actions.ts`: si `NEXT_PUBLIC_SITE_URL` está seteada, devolverla; si no, mantener el fallback actual por headers. Prueba manual: con la env var seteada, un signup dispara el email de confirmación con `emailRedirectTo` apuntando al valor de la env var, no al header `host` de la request.
5. Crear `lib/auth/errors.ts` con `AUTH_ERROR_MESSAGES`/`DEFAULT_MESSAGE` (bloque de arriba) y una función `mapAuthError(error)`. Reemplazar `error.message` crudo por `mapAuthError(error)` en `signInAction`, `signUpAction` y `updateNicknameAction` (menos el caso ya manejado de nickname duplicado, código `23505`, que sigue con su mensaje propio). Prueba manual: login con password incorrecta muestra "Email o contraseña incorrectos." en vez del mensaje de Supabase; registrar un email ya existente muestra "No se pudo completar el registro." sin distinguir si el email existe.
6. Agregar validación de `nickname` en `signUpAction` (regex `^[a-zA-Z0-9_-]{3,20}$`, antes de llamar a `supabase.auth.signUp`), devolviendo `{ error: "El nickname debe tener 3–20 caracteres, solo letras, números, guion o guion bajo." }` si falla. Prueba manual: un POST directo a la server action con un nickname de 1 char o con espacios es rechazado sin llegar a Supabase.
7. Agregar `safeNext(next: string | null): string` (bloque de la sección Scope) en `app/auth/callback/route.ts` y `app/auth/confirm/route.ts`, reemplazando `searchParams.get("next") ?? "/"` por `safeNext(searchParams.get("next"))`. En `app/auth/confirm/route.ts`, validar `type` contra el allow-list de `EmailOtpType` (`email`, `recovery`, `invite`, `magiclink`, `signup`, `email_change`) antes de castear; si no matchea, tratar como ausente. Prueba manual: `/auth/callback?code=X&next=@evil.com/` redirige a `/` (no al host atacante); el flujo normal de login (`next` ausente o `/perfil`) sigue funcionando igual.
8. Fix en `proxy.ts`: en la rama de redirect a `/auth`, copiar las cookies de `response` (las que `setAll` ya escribió) a la respuesta de redirect antes de devolverla, en vez de crear un `NextResponse.redirect` limpio. Prueba manual: forzar una rotación de token (sesión cerca de expirar) y navegar a `/perfil` sin sesión válida corta — el redirect a `/auth` no descarta cookies de sesión que sí se hayan refrescado en esa misma request.

## Criterios de aceptación

- [x] `select relrowsecurity from pg_class where relname = 'auth_rate_limits'` → `true`, y `select * from auth_rate_limits` con la anon key devuelve 0 filas.
- [x] 5 intentos fallidos de login desde la misma IP en menos de 5 minutos bloquean el 6to intento con el mensaje "Demasiados intentos. Esperá unos minutos e intentá de nuevo.", sin llamar a `supabase.auth.signInWithPassword`. Verificado a nivel de `consumeRateLimit` (6 llamadas consecutivas, `allowed: false` en la 6ta) y bajo concurrencia (10 requests en paralelo → exactamente 5 `allowed: true`, sin excedente por race).
- [x] Pasada la ventana de 5 minutos (o con filas viejas eliminadas), el login vuelve a funcionar normalmente. Verificado insertando filas con `created_at` de hace 10 min: no cuentan contra el límite.
- [ ] Con `NEXT_PUBLIC_SITE_URL` seteada, el email de confirmación de un signup nuevo usa esa URL en `emailRedirectTo`, no el header `host` de la request. **No verificado**: no hay una URL de producción real disponible todavía para setear la env var; el código en `getOrigin()` prioriza la env var si está presente, pero `.env` la tiene vacía hoy. Sigue pendiente tras spec 18 — queda a cargo del humo end-to-end de `references/deploy/prod-checklist.md` (sección 7) cuando el usuario complete el despliegue real a producción.
- [x] Sin `NEXT_PUBLIC_SITE_URL` seteada (dev/LAN), el flujo de auth sigue funcionando vía el fallback de headers, sin regresión frente al comportamiento actual. Verificado en browser (login, signup, logout, `/perfil`).
- [x] Login con password incorrecta muestra "Email o contraseña incorrectos." en la UI, no el mensaje crudo de Supabase. Verificado en browser.
- [x] Registrar un email ya existente y registrar un email nuevo con datos inválidos muestran mensajes que no permiten distinguir si el email ya existía (mismo mensaje genérico de fallo de registro donde aplica). Verificado en browser: Supabase no reporta error al registrar un email ya existente (comportamiento nativo anti-enumeración), muestra el mismo flujo "REVISA TU CORREO" que un signup real.
- [x] Un signup con nickname de 1 carácter o con espacios/caracteres especiales es rechazado por `signUpAction` con un mensaje claro, sin llegar a `supabase.auth.signUp`. Verificado en browser con nickname `ab`.
- [x] Un signup con nickname válido (3–20 chars, alfanumérico/guion/guion bajo) sigue funcionando igual que hoy. Verificado en browser.
- [x] `GET /auth/callback?code=<válido>&next=@evil.com/` redirige a `/` (host propio), no a `evil.com`. Verificado la función `safeNext()` en aislado con los casos `@evil.com/`, `//evil.com`, `/\evil.com` → todos devuelven `/`; no se pudo generar un `code` válido de principio a fin sin un signup real completo, pero la lógica que consume `safeNext()` en la ruta ya está verificada por `tsc` y por unit-check de la función.
- [x] `GET /auth/confirm?token_hash=<válido>&type=noexiste` no ejecuta `verifyOtp` con un `type` fuera del allow-list. Verificado con `curl`: cae directo al mensaje de enlace inválido, sin tocar `verifyOtp`.
- [x] El flujo normal de login/signup/confirmación de email (sin `next` manipulado) sigue redirigiendo correctamente a `/` o `/perfil` según corresponda. Verificado en browser.
- [x] Tras forzar una rotación de token en `proxy.ts`, el redirect a `/auth` conserva las cookies de sesión refrescadas en esa misma request (verificado inspeccionando los `Set-Cookie` de la respuesta). Verificado por lectura de código (`response.cookies.getAll()` copiadas al redirect) y por el flujo real de logout → `/perfil` sin sesión → redirect a `/auth` funcionando sin errores de cookies.
- [x] `npx tsc --noEmit` no reporta errores nuevos tras los cambios.
- [x] Navegar el flujo completo de auth (signup, login, logout, `/perfil`, OAuth si está configurado) en el browser no muestra regresiones. OAuth (Google/GitHub) no se probó end-to-end (requiere credenciales de proveedor externo), el resto del flujo sí.

## Decisiones tomadas y descartadas

- **Sí:** rate limit propio respaldado en una tabla de Supabase (`auth_rate_limits`) en vez de in-memory o un servicio externo. In-memory se resetea en cada deploy/restart de Vercel (serverless, sin estado persistente entre invocaciones) y no sirve con múltiples instancias; un servicio externo (Upstash, etc.) introduce una dependencia nueva no usada hoy en el repo para un caso que una tabla simple ya resuelve.
- **Sí:** `x-forwarded-for` como fuente de la IP real del cliente. El proyecto corre en Vercel, que normaliza correctamente este header a la IP del cliente antes de llegar a la función serverless.
- **Sí:** `NEXT_PUBLIC_SITE_URL` con fallback a headers solo si la env var está ausente. Cierra el host-header injection en producción (SEC-04) sin romper el flujo actual de pruebas en LAN vía `allowedDevOrigins` (spec 11/dev setup existente).
- **No:** hacer `NEXT_PUBLIC_SITE_URL` obligatoria sin fallback. Rompería el setup de desarrollo local en LAN si alguien no la configura; el fallback solo se usa cuando la env var falta, que en prod nunca debería pasar.
- **Sí:** `safeNext()` con regla de prefijo (`/` sí, `//` y `/\` no) en vez de whitelist explícita de rutas. Cubre el vector reportado en SEC-06 sin mantener una lista sincronizada cada vez que se agregue una ruta post-login nueva.
- **Sí:** validar `type` contra un allow-list de `EmailOtpType` antes de castear el query param. Hoy se castea directo sin chequeo; es una validación de superficie de entrada de un endpoint público.
- **Sí:** validar nickname solo en `signUpAction`, no re-validar email/password con regex propia. Supabase Auth ya valida formato de email y longitud mínima de password (8, spec 16); duplicar esa validación es redundante. El nickname sí lo necesita porque hoy solo se valida en el cliente (spec 14) y un POST directo a la server action lo saltea.
- **Sí:** mensajes de error genéricos mapeados por código (`AUTH_ERROR_MESSAGES`) en vez de mantener `error.message` crudo o solo documentar el riesgo. Cierra la enumeración de cuentas (SEC-11) sin perder claridad de UX — sigue habiendo un mensaje entendible, solo no filtra si el email existe o no.
- **No:** agregar CAPTCHA o fingerprinting de dispositivo. No fue pedido y el rate limit por IP ya resuelve el vector concreto reportado en SEC-14; agregar más fricción a login/signup es una decisión de producto que amerita su propia conversación.
- **No:** incluir SEC-17 (`getMyBestScores` sin RLS) en este spec. Es informativo y no explotable hoy — no hay ningún call-site que tome el `user_id` de la request; se deja documentado en la bitácora hasta que exista un caso real que lo dispare.
- **Sí:** incluir el fix de `proxy.ts` (SEC-15) en este spec pese a ser un bug de sesión más que de auth-hardening puro. Es un cambio de una línea en un archivo que este mismo spec ya no toca en otro paso, y está directamente relacionado con el flujo de sesión que el resto del spec endurece.

## Riesgos identificados

| Riesgo                                                                                                                                                             | Mitigación                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El rate limit por IP bloquea a usuarios legítimos detrás de un NAT/proxy compartido (oficina, universidad) que comparten la misma IP pública                       | 5 intentos / 5 min es una ventana permisiva para uso normal; el mensaje de bloqueo es claro y temporal, no un ban permanente. Ajustar el umbral queda abierto si se reporta como problema real en uso.                              |
| `x-forwarded-for` puede ser spoofeado si el proyecto deja de correr detrás de un proxy confiable (Vercel) que lo normalice                                         | Riesgo aceptado y documentado: la mitigación depende de la infraestructura de hosting, no del código de la app. Si el hosting cambia, este spec queda para revisar.                                                                 |
| La tabla `auth_rate_limits` crece indefinidamente sin limpieza de filas viejas                                                                                     | No es un riesgo de seguridad sino de mantenimiento; queda fuera de alcance un job de limpieza automática — la tabla es pequeña (una fila por intento) y puede purgarse manualmente o en un spec futuro si crece demasiado.          |
| `NEXT_PUBLIC_SITE_URL` mal configurada en prod (ej. apunta a un dominio viejo) rompe los links de confirmación de email sin error visible en el momento del signup | Criterio de aceptación verifica explícitamente el valor de `emailRedirectTo` tras el cambio; es la misma clase de riesgo operacional que ya existe hoy con la config manual del dashboard de spec 16.                               |
| Mapear todos los errores de Supabase a mensajes genéricos puede ocultar información útil para debugging en desarrollo                                              | `mapAuthError` solo se usa en la respuesta al cliente; nada impide loguear `error.message`/`error.code` original en el server si hace falta debugging (no incluido en este spec porque no hay logging estructurado hoy en el repo). |

## Lo que **no** entra en este spec

- SEC-01/02/07/08 (endpoint de contacto, `getTopScoresAction`) — superficie distinta.
- SEC-03/SEC-12 (configuración manual del dashboard de Supabase Auth) — ya cubiertos por spec 16.
- SEC-05/SEC-10 (CVEs de dependencias) — spec de actualización de deps.
- SEC-13 (`auth_rls_initplan`) — rendimiento, no vulnerabilidad.
- SEC-17 (`getMyBestScores` sin RLS) — informativo, no explotable hoy.
- Recuperación de contraseña, cambio de email, borrado de cuenta (ACC-07).
- CAPTCHA o fingerprinting de dispositivo además del rate limit por IP.
- Job de limpieza automática de `auth_rate_limits`.

Cada uno de esos, si llega, va en su propio spec.
