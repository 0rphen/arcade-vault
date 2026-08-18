# SPEC 14 — Identidad real en el leáderboard

> **Estado:** Implementado
> **Depende de:** 06-leaderboard-catalogo-supabase, 13-supabase-auth
> **Fecha:** 2026-08-17
> **Objetivo:** Vincular cada puntaje a una cuenta real de Supabase para que nadie pueda firmar una marca con el nombre de otro jugador.

## Por qué existe este spec

Spec 06 creó `scores` con la política `create policy "anyone can insert a score" on scores for insert with check (true)` y la documentó como riesgo aceptado: "cualquiera con la anon key puede insertar puntajes arbitrarios... queda documentado para cuando exista auth real". `lib/actions/scores.ts` valida longitud y rango del `name`, pero no la identidad de quien lo envía; `components/game-player.tsx` deja el nombre en un `<input>` editable en el modal de game over (`setName(e.target.value.toUpperCase().slice(0, 10))`), así que cualquiera puede firmar su puntaje con el nickname de otro jugador.

SPEC 13 ya deja disponibles `getCurrentUser()` / `getCurrentProfile()` y la tabla `profiles`. Este spec usa esa base para cerrar el hueco: el nombre que aparece en el Salón de la Fama pasa a resolverse en el servidor a partir de la sesión, no del texto que envía el cliente.

## Alcance

**Dentro del alcance:**

- Columna `scores.user_id` (nullable, `references auth.users`) y su índice. **Sin cambios de RLS** — ver nota de alcance sobre RLS diferida.
- `saveScoreAction` deja de aceptar `name`: resuelve `user_id` y `nickname` desde la sesión en el servidor y rechaza la llamada si no hay sesión. Esta es la única barrera contra la suplantación en este spec — se aplica a nivel de aplicación, no de base de datos.
- `insertScore` en `lib/supabase/queries.ts` escribe `user_id` además de `name` y `score`.
- `components/game-player.tsx`: se quita el input "TUS INICIALES"; con sesión el modal muestra el nickname y el botón Guardar, sin sesión muestra un aviso con enlace a `/auth` en vez del botón.
- Query `getMyBestScores(userId)` y sección "MIS MEJORES MARCAS" en `/perfil`.
- Se restaura la fila "TU MEJOR MARCA" en `components/hall-of-fame.tsx` (quitada en spec 06 por falta de auth) y se resaltan las filas propias del usuario logueado.

**Fuera de alcance (diferido):**

- Backfill o borrado de las 3 filas de `scores` que ya existen sin `user_id` — se conservan como marcas históricas anónimas.
- Rate limiting o detección de puntajes imposibles.
- Migrar los juegos sin engine real (los que usan `appendScore`/localStorage) al leáderboard de Supabase.
- **Política RLS de INSERT en `scores`** que exija `auth.uid() = user_id` → spec futura de RLS. La política pública actual (`with check (true)`, de spec 06) se mantiene sin cambios; ver nota de alcance y riesgo correspondiente.

### Nota de alcance: RLS diferida

Igual que en SPEC 13, este spec no toca row level security. `scores` sigue con la política de INSERT pública de spec 06. La protección contra suplantación que entrega este spec es de nivel aplicación: `saveScoreAction` exige sesión y resuelve `user_id`/`nickname` en el servidor, así que la app ya no permite firmar el puntaje de otro. Un INSERT hecho directamente contra Supabase con la anon key, sin pasar por la app, todavía podría escribir cualquier `user_id` — ese cierre queda para la spec futura de RLS.

## Modelo de datos

```sql
alter table scores add column user_id uuid references auth.users(id) on delete set null;
create index scores_user_id_score_idx on scores (user_id, score desc);

-- Sin cambios de RLS en este spec: se mantiene la política pública de INSERT
-- creada en spec 06 ("anyone can insert a score", with check (true)).
-- Restringirla a auth.uid() = user_id queda para la spec futura de RLS.
```

```ts
// lib/actions/scores.ts — firma nueva
export async function saveScoreAction(entry: {
  gameId: string;
  score: number;
}): Promise<void>;
```

```ts
// lib/supabase/queries.ts
export interface DbBestScoreRow {
  gameId: string;
  score: number;
  date: string;
}
export async function getMyBestScores(
  userId: string,
): Promise<DbBestScoreRow[]>;
```

`DbScoreRow` (`{ rank, name, score, date }`) no cambia: `name` se mantiene como columna desnormalizada para que el Salón siga leyendo un texto simple, incluidas las filas históricas sin `user_id`.

## Plan de implementación

1. Migración MCP `add_user_id_to_scores`: agregar columna e índice (bloque SQL de arriba), sin tocar políticas. Prueba manual: la columna `user_id` existe y es nullable; las 3 filas existentes siguen visibles con `user_id` null; la política `"anyone can insert a score"` sigue activa sin cambios.
2. Actualizar `insertScore` en `lib/supabase/queries.ts` para aceptar y escribir `user_id`. Prueba manual: `tsc --noEmit` sin errores.
3. Reescribir `saveScoreAction` en `lib/actions/scores.ts`: quitar `name` de la firma, resolver `getCurrentUser()`/`getCurrentProfile()` de SPEC 13, lanzar error si no hay sesión, pasar `user_id` y `nickname` a `insertScore`. Prueba manual: llamar la acción sin sesión (dev tools) lanza el error esperado y no inserta fila; llamada con sesión inserta la fila con el nickname correcto.
4. Actualizar `components/game-player.tsx`: quitar el estado `name` y el input del modal; mostrar el nickname de sesión y el botón Guardar, o el aviso "inicia sesión para guardar tu puntaje" con enlace a `/auth` cuando no hay sesión. Prueba manual: jugar ROCAS logueado guarda el puntaje sin pedir nombre; jugar sin sesión muestra el aviso y no hay botón de guardar.
5. Agregar `getMyBestScores` en `lib/supabase/queries.ts` y la sección "MIS MEJORES MARCAS" en `app/perfil/page.tsx`. Prueba manual: tras guardar un puntaje, `/perfil` lo muestra para el juego correspondiente.
6. Restaurar "TU MEJOR MARCA" en `components/hall-of-fame.tsx` usando `getMyBestScores`, y resaltar las filas del usuario en la tabla general. Prueba manual: en `/salon`, con sesión y al menos un puntaje propio, la fila destacada coincide con la marca guardada en el paso anterior.

## Criterios de aceptación

- [x] Llamar `saveScoreAction` sin sesión iniciada lanza un error y no inserta ninguna fila.
- [x] Guardar un puntaje logueado inserta la fila con `user_id` igual al usuario de la sesión y `name` igual al nickname actual.
- [x] El modal de game over ya no tiene un campo de texto para el nombre.
- [x] Sin sesión, el modal de game over no ofrece guardar el puntaje y enlaza a `/auth`.
- [x] `/perfil` muestra "mis mejores marcas" con al menos el juego recién jugado tras guardar un puntaje.
- [x] `/salon` vuelve a mostrar "TU MEJOR MARCA" cuando hay sesión con puntajes propios.
- [x] Las 3 filas históricas de `scores` (sin `user_id`) siguen visibles en `/salon` sin errores.
- [x] `npx tsc --noEmit` no reporta errores nuevos tras los cambios de este spec.

## Decisiones tomadas y descartadas

- **Sí:** `user_id` nullable y conservar las filas históricas tal cual. Borrarlas no aporta nada y rompería la continuidad del Salón para nadie en particular.
- **No:** hacer `user_id` `not null` desde el inicio. Habría forzado a limpiar datos de prueba sin necesidad real.
- **Sí:** `name` se mantiene como columna desnormalizada en vez de resolverse por `join` a `profiles` en cada lectura. Si el jugador cambia su nickname después, las marcas viejas conservan el nombre con el que se lograron — se documenta como aceptado, no como bug.
- **No:** unir `scores` con `profiles` en cada consulta del Salón. Más simple mantener `name` como snapshot; evita que un cambio de nickname reescriba el historial de puntajes.
- **Sí:** el modal de game over pasa de "input editable" a "nombre resuelto por servidor + aviso si no hay sesión". Es el cambio que efectivamente cierra la posibilidad de suplantación, que era el problema documentado en spec 06.
- **No:** exigir sesión para jugar. Solo se exige para guardar el puntaje, conforme a lo decidido en SPEC 13.
- **No:** reemplazar la política RLS de INSERT de `scores` en este spec. Decisión explícita del usuario para acotar el alcance — la protección de este spec es a nivel aplicación (`saveScoreAction` exige sesión); la política de base de datos queda para una spec futura, mismo patrón usado en SPEC 13 con `profiles`.
- **Sí (desviación acordada durante la implementación):** `DbScoreRow` gana un campo `isMine: boolean`, aunque el spec decía que la interfaz "no cambia". Sin este campo derivado no había forma de cumplir con exactitud el criterio de aceptación "resaltar las filas propias del usuario" en `/salon` — comparar por `name` fallaría si otro jugador tuvo el mismo nickname o si el usuario lo cambió después (el propio `name` es un snapshot, ver decisión anterior). `isMine` se calcula en servidor comparando `user_id` con la sesión actual; no se expone `user_id` al cliente.

## Riesgos identificados

| Riesgo                                                                                                                                                                            | Mitigación                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cambiar la firma de `saveScoreAction` rompe llamadores no actualizados                                                                                                            | No hay test runner en el repo; `npx tsc --noEmit` es la red de seguridad y es parte de los criterios de aceptación.                                                                                                                                                                       |
| Nickname editado después de guardar puntajes deja `name` desfasado respecto a `profiles.nickname`                                                                                 | Aceptado explícitamente en las decisiones: `name` es un snapshot al momento del puntaje, no un valor vivo.                                                                                                                                                                                |
| `scores` sigue con INSERT público (`with check (true)`): un INSERT directo con la anon key, sin pasar por la app, puede escribir cualquier `user_id`, incluido el de otro jugador | Riesgo aceptado a propósito para este spec, igual que spec 06 y SPEC 13 con `profiles`. La app ya no permite la suplantación (`saveScoreAction` resuelve la identidad en servidor); cerrar el hueco a nivel de base de datos queda documentado como pendiente para la spec futura de RLS. |

## Lo que **no** entra en este spec

- Backfill o borrado de puntajes anónimos históricos.
- Rate limiting o validación anti-trampa de puntajes.
- Llevar los juegos sin engine real al leáderboard de Supabase.
- Política RLS de INSERT en `scores` exigiendo `auth.uid() = user_id` (queda como riesgo aceptado y documentado, no resuelto).

Cada uno de esos, si llega, va en su propio spec.
