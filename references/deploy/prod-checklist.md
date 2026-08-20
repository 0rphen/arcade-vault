# Checklist de despliegue a producción

Todo lo que **no** es SQL y hay que configurar a mano en el dashboard del
proyecto Supabase de producción y en el hosting. Complementa
`supabase/prod/*.sql`. Recolectado de specs 13, 16 y 17.

Claude no tiene ni debe tener acceso al proyecto de producción — este
checklist lo ejecuta el usuario.

## 1. Supabase Auth → URL Configuration

- [ ] `Site URL` = dominio real de producción (ej. `https://arcade-vault.example.com`, sin `/` final).
- [ ] `Redirect URLs` incluye `https://<dominio>/auth/callback` (lo consume `app/auth/callback/route.ts`).

## 2. Supabase Auth → Providers

- [ ] Email habilitado, con **Confirm email** en ON (spec 13 lo asume — sin confirmación no hay verificación de que el correo es real).
- [ ] Google habilitado, con **credenciales OAuth nuevas** (no reusar las de dev). Callback a registrar en Google Cloud Console: `https://<prod-project-ref>.supabase.co/auth/v1/callback`.
- [ ] GitHub habilitado, mismo criterio: credenciales OAuth nuevas, callback `https://<prod-project-ref>.supabase.co/auth/v1/callback`.

## 3. Supabase Auth → Passwords (spec 16)

- [ ] `Minimum password length` = 8.
- [ ] `Leaked password protection` = habilitado.

## 4. Supabase Auth → Rate Limits (spec 16)

- [ ] Rate limit de signups por IP activo (valor por defecto del dashboard, sin endurecer a un número custom).
- [ ] **SMTP:** el SMTP por defecto de Supabase limita a pocos emails/hora. En producción real conviene configurar SMTP propio (el proyecto ya usa Resend para `/about` vía `RESEND_API_KEY`) — si no, los signups van a fallar con `email rate limit exceeded` apenas haya tráfico real (mismo límite que ya bloqueó verificaciones manuales durante spec 15).

## 5. Variables de entorno del hosting (Vercel u equivalente)

Todas las del proyecto **prod** de Supabase, no las de dev:

| Variable                        | Origen                                                       | Consumida en                                                |
| ------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Settings → API del proyecto prod                             | `lib/supabase/{client,server,queries,admin}.ts`, `proxy.ts` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API del proyecto prod                             | mismos archivos                                             |
| `SUPABASE_SERVICE_ROLE_KEY`     | Settings → API del proyecto prod (secreta, nunca al cliente) | `lib/supabase/admin.ts`                                     |
| `NEXT_PUBLIC_SITE_URL`          | dominio de producción, sin `/` final                         | `lib/auth/actions.ts` (`getOrigin()`)                       |
| `RESEND_API_KEY`                | cuenta de Resend                                             | `app/api/contact/route.ts`                                  |

- [ ] `SUPABASE_DB_PASSWORD` **no** se setea en el hosting — es solo para conexión directa local/CLI, no la usa la app en runtime.
- [ ] Las 5 variables de arriba están seteadas en el proyecto del hosting (no solo en `.env` local).

## 6. Rol de solo lectura para pooling directo (`supabase/prod/04-readonly-role.sql`)

- [ ] Reemplazar `<PASSWORD_FUERTE>` en el script por una generada con `openssl rand -base64 32` antes de pegarlo en el SQL Editor.
- [ ] Ejecutar `04-readonly-role.sql` después de `01`–`03`.
- [ ] Correr las verificaciones incluidas al final del archivo (roles y grants).
- [ ] Guardar la password del usuario `arcade_vault_reader` en un gestor de secretos — nunca en el repo ni en `.env`.

## 7. Post-deploy

- [ ] Correr `get_advisors(type: "security")` desde el dashboard de prod (Advisors) y confirmar que **no** aparecen `rls_disabled_in_public`, `security_definer_view` ni `auth_leaked_password_protection`.
- [ ] `.mcp.json` del repo sigue apuntando al project-ref de **dev** — así debe quedar. El proyecto de prod no se agrega al MCP.

## 8. Humo end-to-end en el dominio de producción

- [ ] `/games` lista los 8 juegos del catálogo.
- [ ] Signup con un email real: llega el correo y el enlace de confirmación apunta a `NEXT_PUBLIC_SITE_URL`, no a un header `host` de la request.
- [ ] Login funciona tras confirmar el correo.
- [ ] Jugar y guardar un puntaje logueado inserta la fila en `scores`.
- [ ] `/salon` muestra el puntaje recién guardado.
- [ ] `/perfil` permite editar el nickname.
- [ ] 6 intentos de login fallidos seguidos desde la misma IP disparan el mensaje de rate limit en el 6to intento.
- [ ] `curl -sI https://<dominio>/` devuelve `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin`.
