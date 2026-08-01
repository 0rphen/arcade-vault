# SPEC 04 — Setup base de Supabase

> **Estado:** Implementado
> **Depende de:** 03-about-contact-email
> **Fecha:** 2026-08-01
> **Objetivo:** Instalar el SDK de Supabase (`@supabase/supabase-js` + `@supabase/ssr`) y crear los clientes de browser y de servidor en `lib/supabase/`, sin migrar todavía ninguna feature existente (auth, puntajes, catálogo).

## Alcance

**Dentro del alcance:**

- **Dependencias** — agregar `@supabase/supabase-js` y `@supabase/ssr` a `package.json`.
- **Cliente de browser** (`lib/supabase/client.ts`) — `createBrowserClient()` de `@supabase/ssr`, usando `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Cliente de servidor** (`lib/supabase/server.ts`) — `createServerClient()` de `@supabase/ssr`, para usarse en Server Components y Route Handlers, siguiendo el patrón oficial de Supabase para Next.js App Router (lectura/escritura de cookies vía `next/headers`).
- **Variables de entorno** — documentar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `.env.template`; el usuario ya tiene el proyecto Supabase creado y agrega los valores reales en su `.env` local (mismo patrón que `RESEND_API_KEY` en el spec 03). `SUPABASE_DB_PASSWORD` ya existe en `.env` de antes, no se toca.
- **Verificación** — `npm run build` compila sin errores de tipos ni de lint con ambos clientes creados (no hace falta que estén importados/usados en ninguna pantalla todavía).

**Fuera de alcance (diferido):**

- **Migración de autenticación** (`components/auth-form.tsx`, `lib/session.ts`) a Supabase Auth — spec futuro.
- **Migración de puntajes/leaderboard** (`appendScore`, `/salon`) a una tabla de Supabase — spec futuro.
- **Migración del catálogo de juegos** (`lib/data.ts`) a una tabla de Supabase — spec futuro.
- **`middleware.ts`** para refresco de sesión — se agrega junto con el spec de auth, no ahora.
- **Definición de esquema/tablas en Supabase** (SQL, migraciones) — no hay ninguna tabla que crear todavía, este spec es solo el cliente.
- **Verificación de conexión real contra Supabase** (healthcheck, query de prueba) — queda cubierto solo por el build; la conexión real se prueba cuando exista una feature que use el cliente.

## Modelo de datos

Este spec no introduce estructuras de datos ni tablas en Supabase. Solo agrega configuración de cliente:

```ts
// lib/supabase/client.ts
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

```ts
// lib/supabase/server.ts
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: ..., setAll: ... } }
  );
}
```

## Plan de implementación

1. **Dependencias** — `npm install @supabase/supabase-js @supabase/ssr`. Sistema sigue funcionando igual, sin cambios de comportamiento.

2. **Variables de entorno** — Agregar `NEXT_PUBLIC_SUPABASE_URL=` y `NEXT_PUBLIC_SUPABASE_ANON_KEY=` a `.env.template`. Documentar que el usuario debe completar los valores reales en su `.env` local (ya tiene el proyecto Supabase creado).

3. **Cliente de browser (`lib/supabase/client.ts`)** — Función `createClient()` con `createBrowserClient()` de `@supabase/ssr`, leyendo las dos env vars `NEXT_PUBLIC_*`. No se importa en ningún componente todavía.

4. **Cliente de servidor (`lib/supabase/server.ts`)** — Función async `createClient()` con `createServerClient()` de `@supabase/ssr`, usando `cookies()` de `next/headers` (Server Components/Route Handlers) según el patrón oficial de Supabase para Next.js App Router. No se importa en ningún route handler todavía.

5. **Verificación** — `npm run build` compila sin errores de tipos ni de lint con ambos archivos en el repo.

## Criterios de aceptación

- [x] `package.json` incluye `@supabase/supabase-js` y `@supabase/ssr` como dependencias.
- [x] `.env.template` incluye `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (vacíos).
- [x] `lib/supabase/client.ts` existe y exporta una función que crea un cliente de browser válido (tipado, sin `any`).
- [x] `lib/supabase/server.ts` existe y exporta una función async que crea un cliente de servidor válido usando `cookies()` de `next/headers`.
- [x] Ninguna pantalla, componente o route handler existente cambia de comportamiento (auth, puntajes y catálogo siguen en localStorage/estático como antes).
- [x] `npm run build` compila sin errores de tipos ni de lint.

## Decisiones tomadas y descartadas

- **Solo setup base, sin migrar features** — se descartó migrar auth/puntajes/catálogo en el mismo spec porque son tres dominios distintos con sus propias decisiones de esquema y UX; cada uno merece su propio spec (siguiendo el mismo patrón que separó Home de About).
- **`@supabase/supabase-js` + `@supabase/ssr`** — se descartó usar solo `supabase-js` porque el proyecto va a necesitar auth con sesión persistida entre Server/Client Components más adelante; instalar `@supabase/ssr` ahora evita reinstalar y reescribir los clientes en el spec de auth.
- **Dos clientes separados (`lib/supabase/client.ts` y `server.ts`)** — se descartó un cliente único porque `@supabase/ssr` requiere manejo de cookies distinto en browser vs. servidor; es el patrón oficial recomendado por Supabase para Next.js App Router.
- **Sin `middleware.ts` todavía** — se descartó agregarlo en este spec porque no hay sesiones reales que refrescar aún; se crea junto con la migración de auth para evitar código muerto sin uso verificable.
- **Sin healthcheck de conexión real** — se descartó crear una ruta de prueba porque no hay forma de verificar una conexión "útil" sin datos reales; la verificación de este spec es de tipos/build, la conexión real se prueba naturalmente cuando el spec de auth o puntajes use estos clientes.
- **Env vars documentadas en `.env.template`, valores en `.env` local del usuario** — mismo patrón que `RESEND_API_KEY` en el spec 03; el usuario ya tiene el proyecto Supabase creado y completa los valores él mismo.
- **`SUPABASE_DB_PASSWORD` existente en `.env` no se toca** — no se usa en este spec (no hay acceso directo a Postgres, solo el cliente vía API/anon key); queda documentado que existe por si un spec futuro lo necesita (ej. migraciones SQL directas).

## Riesgos identificados

- **Env vars ausentes en producción** — si `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` no están seteadas en el entorno de deploy, cualquier código que llame a `createClient()` fallará en runtime; no hay validación al build time. Mitigación: documentado como prerequisito manual, igual que `RESEND_API_KEY`.
- **`NEXT_PUBLIC_*` expone la anon key en el bundle del cliente** — es el comportamiento esperado de Supabase (la anon key está diseñada para ser pública y depende de Row Level Security para proteger los datos), pero cualquier tabla que se cree en specs futuros debe tener RLS configurado antes de exponer datos sensibles.
