# SPEC 13 — Autenticación real con Supabase Auth

> **Estado:** Implementado
> **Depende de:** 04-supabase-base-setup, 06-leaderboard-catalogo-supabase
> **Fecha:** 2026-08-17
> **Objetivo:** Reemplazar la maqueta de `/auth` por autenticación real de Supabase (email+contraseña y OAuth Google/GitHub) con sesión en cookies, perfil de jugador y estado de sesión en el nav.

## Por qué existe este spec

`app/auth/page.tsx` renderiza `components/auth-form.tsx`, un formulario sin backend: el `submit` ignora email y contraseña y hace `storeUser({ name: (user || "PLAYER1").toUpperCase().slice(0, 10) })` en `localStorage` (`lib/session.ts`, clave `av_user`). Los botones GOOGLE y GITHUB son `<button type="button">` sin `onClick`. `components/nav.tsx` lee esa misma clave para mostrar el nombre y su "logout" (`handleSignOut`) solo borra localStorage — no hay servidor involucrado en ningún punto.

Spec 04 instaló `@supabase/ssr` y dejó `lib/supabase/server.ts` con el adaptador de cookies correcto, pero decidió explícitamente no crear `middleware.ts` "porque no hay sesiones reales que refrescar aún; se crea junto con la migración de auth". Spec 06 documentó como riesgo aceptado que `scores` permite INSERT público sin validación de identidad, "para cuando exista auth real". Este spec cierra ambas deudas del lado de autenticación; la identidad de los puntajes queda en SPEC 14.

`lib/supabase/client.ts` (cliente browser) existe pero hoy no lo importa nada — este spec le da su primer consumidor.

## Alcance

**Dentro del alcance:**

- Tabla `profiles` en Supabase (vía migración MCP) con `nickname` único, y un trigger que la puebla automáticamente al crear un usuario en `auth.users`. **Sin RLS por ahora** — ver nota de alcance sobre RLS diferida.
- `proxy.ts` en la raíz del repo (el nombre correcto en Next 16.2.12 para lo que antes era `middleware.ts` — ver nota de convención) que refresca la sesión en cada request y protege `/perfil`.
- Server actions de registro, login, logout y OAuth en `lib/auth/actions.ts`.
- Helpers de servidor `getCurrentUser()` / `getCurrentProfile()` en `lib/auth/user.ts`.
- `app/auth/callback/route.ts` (intercambio de código OAuth) y `app/auth/confirm/route.ts` (confirmación de email).
- Reescritura de `components/auth-form.tsx` conectado a las server actions, con estado de error/carga, campo de nickname en el alta, pantalla "revisa tu correo" y botones OAuth funcionales.
- `app/perfil/page.tsx`: ruta protegida con nickname editable y botón de cerrar sesión.
- `components/nav.tsx` recibe el usuario/perfil por props desde `app/layout.tsx` (server component), sin `useEffect` ni flash de estado no autenticado.
- Baja de `getStoredUser`, `storeUser`, `clearUser` y la interfaz `AuthUser` de `lib/session.ts`. `appendScore` se conserva.
- Documentar en la spec la configuración manual pendiente en el dashboard de Supabase (activar providers Google/GitHub, Redirect URLs).

**Fuera de alcance (diferido):**

- `scores.user_id`, la política RLS de escritura autenticada y el input de nombre en el modal de game over → SPEC 14.
- "Mis mejores marcas" en `/perfil` → SPEC 14.
- Recuperación de contraseña, cambio de email, borrado de cuenta, avatar de usuario.
- Roles, moderación de contenido, o proteger `/games/[id]/jugar` con login obligatorio (se puede seguir jugando sin cuenta).
- **RLS en `profiles`** (políticas de SELECT/UPDATE) → spec futura. Este spec crea la tabla sin row level security habilitada; ver nota de alcance y riesgo correspondiente.

### Nota de alcance: RLS diferida

`profiles` se crea **sin** `enable row level security`. Solo la función `handle_new_user` (con `security definer`) escribe en la tabla; el resto de las operaciones (lectura pública, edición del propio nickname desde `/perfil`) quedan sin política dedicada hasta la spec futura que la agregue. Esto es una decisión explícita, no un olvido — ver la sección de Riesgos.

### Nota de convención: `proxy.ts`, no `middleware.ts`

Este repo fija `next@16.2.12`. Desde Next.js 16, lo que antes era Middleware se llama **Proxy**: el archivo va en la raíz como `proxy.ts` y exporta una función `proxy` (o default export), en runtime Node (`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`). La funcionalidad es la misma que "middleware" en la documentación de Supabase, pero el nombre de archivo y de la función cambia. Cualquier ejemplo que hable de `middleware.ts` debe adaptarse a esta convención.

## Modelo de datos

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null unique,
  created_at timestamptz not null default now()
);

-- Sin RLS en este spec (ver "Nota de alcance: RLS diferida").
-- Las políticas de SELECT/UPDATE quedan para una spec futura.

-- Trigger: crea la fila de perfil al registrarse.
-- Lee el nickname enviado en options.data durante signUp; si no viene
-- (alta por OAuth) o si ya existe, genera uno con sufijo aleatorio.
--
-- `set search_path = ''` + nombres calificados con `public.` es obligatorio:
-- GoTrue inserta en auth.users conectado como supabase_auth_admin, cuyo
-- search_path es solo `auth` (no incluye `public`). Sin esto, la referencia
-- sin calificar a `profiles` no resuelve, el trigger lanza una excepción y
-- el INSERT en auth.users hace rollback — el alta se aborta en silencio para
-- cualquier método (email, OAuth). Ver riesgo correspondiente más abajo.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_nickname text;
  final_nickname text;
begin
  base_nickname := coalesce(new.raw_user_meta_data->>'nickname', 'PLAYER');
  final_nickname := base_nickname;
  while exists (select 1 from public.profiles where nickname = final_nickname) loop
    final_nickname := base_nickname || substr(md5(random()::text), 1, 4);
  end loop;
  insert into public.profiles (id, nickname) values (new.id, final_nickname);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

```ts
// lib/auth/user.ts
export interface CurrentProfile {
  id: string; // auth.users.id / profiles.id
  email: string;
  nickname: string;
}
```

`lib/session.ts` pierde `AuthUser`, `getStoredUser`, `storeUser`, `clearUser`. Conserva `SavedScore` y `appendScore` sin cambios (los usan los juegos sin engine real).

## Plan de implementación

1. Migración MCP `create_profiles`: crear tabla `profiles` (sin RLS), función y trigger `handle_new_user` (bloque SQL de arriba). Prueba manual: `insert into auth.users` de prueba vía dashboard genera una fila en `profiles` con nickname no vacío.
2. Configuración manual en el dashboard de Supabase (fuera del repo, documentar como paso explícito): activar providers Google y GitHub, registrar Redirect URL `<url>/auth/callback`. Prueba manual: los providers aparecen "Enabled" en Authentication → Providers.
3. Crear `app/auth/callback/route.ts` (`exchangeCodeForSession`) y `app/auth/confirm/route.ts` (`verifyOtp`). Prueba manual: `tsc --noEmit` sin errores en ambos archivos.
4. Crear `lib/auth/actions.ts` con `signUpAction`, `signInAction`, `signOutAction`, `signInWithOAuthAction(provider)`, y `lib/auth/user.ts` con `getCurrentUser()`/`getCurrentProfile()` usando `auth.getUser()` (nunca `getSession()` en servidor). Prueba manual: `tsc --noEmit` sin errores.
5. Crear `proxy.ts` en la raíz con el cliente `@supabase/ssr` de proxy, refresco de sesión, y redirect a `/auth` solo para `/perfil`. Prueba manual: visitar `/perfil` sin sesión redirige a `/auth`; visitar cualquier otra ruta no cambia de comportamiento.
6. Reescribir `components/auth-form.tsx`: pestañas actuales + campo nickname en alta, llamadas a las server actions, manejo de error/carga, pantalla "revisa tu correo", botones OAuth con `onClick` real. Corregir `React.SubmitEvent` → `React.FormEvent`. Prueba manual: registrar una cuenta nueva por email deja el formulario en estado "revisa tu correo"; el enlace del correo confirma y deja sesión iniciada.
7. Crear `app/perfil/page.tsx`: server component que lee `getCurrentProfile()`, formulario de nickname (server action `updateNicknameAction`, con mensaje de error si el nickname ya existe) y botón "Cerrar sesión". Prueba manual: cambiar el nickname a uno libre funciona; repetir un nickname existente muestra error sin romper la página.
8. Actualizar `app/layout.tsx` para resolver el usuario/perfil en servidor y pasarlo a `components/nav.tsx` por props; adaptar `nav.tsx` para recibir esas props en vez de leer `lib/session.ts`, y que el `▾` enlace a `/perfil`. Prueba manual: recargar cualquier página logueado no muestra el flash de "Iniciar Sesión" antes de mostrar el nombre.
9. Eliminar `getStoredUser`, `storeUser`, `clearUser`, `AuthUser` de `lib/session.ts` y sus importaciones muertas. Prueba manual: `tsc --noEmit` sin errores; `grep -rn "getStoredUser\|storeUser\|clearUser" --include="*.tsx" --include="*.ts"` no devuelve resultados fuera de `lib/session.ts` si aún quedara algo residual.

## Criterios de aceptación

- [x] Registrarse con email, contraseña y nickname crea un usuario en `auth.users` y una fila en `profiles` con ese nickname.
- [x] Sin confirmar el correo, iniciar sesión con esas credenciales no otorga sesión.
- [x] Confirmar el enlace del correo dejar sesión iniciada y redirige a la app.
- [x] Iniciar sesión con Google o GitHub crea sesión y una fila en `profiles` con nickname autogenerado si no existía.
- [x] `components/nav.tsx` muestra el nickname cuando hay sesión y "Iniciar Sesión" cuando no, sin flash intermedio al cargar la página.
- [x] Visitar `/perfil` sin sesión redirige a `/auth`.
- [x] En `/perfil`, cambiar el nickname a uno disponible lo persiste; repetir uno ya usado por otra cuenta muestra un error y no rompe la página.
- [x] Cerrar sesión desde `/perfil` limpia la cookie de sesión y `nav.tsx` vuelve a mostrar "Iniciar Sesión".
- [x] `npx tsc --noEmit` no reporta errores nuevos tras los cambios de este spec.
- [x] `lib/session.ts` ya no exporta `AuthUser`, `getStoredUser`, `storeUser` ni `clearUser`; `appendScore` sigue funcionando para los juegos sin engine real.
- [x] La tabla `profiles` existe sin row level security habilitada (verificable con `select relrowsecurity from pg_class where relname = 'profiles'` → `false`).

## Decisiones tomadas y descartadas

- **Sí:** dos specs separadas (13 auth core, 14 identidad en leaderboard). Cada una queda commiteable y verificable por sí sola; el plan de implementación de "todo junto" era demasiado largo para un solo checklist.
- **Sí:** `proxy.ts` en vez de `middleware.ts`, siguiendo la convención de Next 16.2.12 de este repo.
- **Sí:** confirmación de email obligatoria (`app/auth/confirm/route.ts`). Es el default de Supabase y evita cuentas creadas con correos ajenos.
- **No:** magic link / OTP sin contraseña. Cambiaría toda la UI ya diseñada de la maqueta (pestañas iniciar sesión / crear cuenta) sin que el usuario lo haya pedido.
- **Sí:** nickname pedido en el formulario de registro, con trigger de respaldo para OAuth y colisiones. Evita una pantalla de onboarding extra.
- **No:** onboarding obligatorio de nickname tras el primer login. Añadía una ruta protegida más sin necesidad, dado que el trigger ya garantiza un nickname válido.
- **Sí:** invitados pueden seguir jugando sin cuenta; solo se bloquea el guardado del puntaje (eso se implementa en SPEC 14, no aquí).
- **No:** proteger `/games/[id]/jugar` completo con login. Rompería la experiencia actual de "probar antes de registrarte".
- **Sí:** `nav.tsx` recibe el usuario por props desde un server component en vez de `useEffect` + `localStorage`. Elimina el flash de estado no autenticado y es el patrón recomendado en la guía de autenticación de Next.js para datos de sesión reutilizados en el shell de la UI.
- **No:** habilitar RLS en `profiles` en este spec. Decisión explícita del usuario para acotar el alcance — queda para una spec futura, siguiendo el mismo patrón que spec 06 usó con `scores` (documentar el riesgo aceptado en vez de resolverlo de inmediato).

## Riesgos identificados

| Riesgo                                                                                                                                                                                                                                                                              | Mitigación                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Providers OAuth sin configurar en el dashboard                                                                                                                                                                                                                                      | Paso 2 del plan de implementación es explícito y verificable antes de escribir código de UI para esos botones.                                                                                                                                                                                                                                |
| Usar `getSession()` en servidor (no verifica firma) en vez de `getUser()`                                                                                                                                                                                                           | `lib/auth/user.ts` centraliza el acceso y solo expone `getCurrentUser()`/`getCurrentProfile()` basados en `getUser()`; no se llama a `getSession()` en ningún server component.                                                                                                                                                               |
| Colisión de nickname en el trigger bloquea el alta de la cuenta                                                                                                                                                                                                                     | El trigger reintenta con sufijo aleatorio hasta encontrar uno libre, nunca deja que el `insert` falle por unicidad.                                                                                                                                                                                                                           |
| `proxy.ts` mal configurado bloquea rutas públicas por error                                                                                                                                                                                                                         | El `matcher` excluye explícitamente assets estáticos y el redirect a `/auth` solo aplica a `/perfil`; criterio de aceptación cubre que el resto de rutas no cambia de comportamiento.                                                                                                                                                         |
| `profiles` sin RLS: cualquiera con la anon key puede leer o escribir toda la tabla directamente (no solo vía la app)                                                                                                                                                                | Riesgo aceptado a propósito para este spec, igual que spec 06 hizo con `scores`. Mitigación real (política `select`/`update` con `auth.uid() = id`) queda documentada como pendiente para una spec futura de RLS.                                                                                                                             |
| `handle_new_user()` sin `search_path` fijo y con referencias sin calificar a `profiles` aborta el `INSERT` en `auth.users` por completo (excepción no capturada dentro de un trigger `security definer`), rompiendo el alta por email y por OAuth sin ningún error visible en la UI | Detectado durante la verificación manual de este spec (no en el plan original). Corregido con `set search_path = ''` + `public.profiles`/`public.handle_new_user` calificados en la función del modelo de datos de arriba. Verificable con `select proconfig from pg_proc where proname = 'handle_new_user'` → debe incluir `search_path=""`. |

## Lo que **no** entra en este spec

- Vincular `scores` a la cuenta del jugador (SPEC 14).
- Recuperación de contraseña, cambio de email o borrado de cuenta.
- Roles y moderación.
- Bloquear el acceso a los juegos sin sesión.
- RLS en `profiles` (queda como riesgo aceptado y documentado, no resuelto).

Cada uno de esos, si llega, va en su propio spec.
