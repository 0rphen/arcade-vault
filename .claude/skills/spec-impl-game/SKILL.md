---
name: spec-impl-game
description: Implementa un spec aprobado de juego (mismo flujo que /spec-impl) y, al cerrar el último paso, encadena skin-designer y luego mobile-porter sobre el game-id implementado.
disable-model-invocation: true
argument-hint: <NN-spec-name>
---

# /spec-impl-game — Implementador de specs de juego + puesta a punto

Es `/spec-impl` (Fases 1–4, sin cambios) más una Fase 5 nueva: al cerrar el último paso del plan, encadena `skin-designer` y luego `mobile-porter` sobre el juego que el spec acaba de implementar. Nunca en paralelo — `mobile-porter` audita el layout/HUD que `skin-designer` acaba de modificar con el selector de tema, así que tiene que correr después de que ese cambio ya esté en el árbol.

## Session context

Current repository state:
!`git status --short`

Current branch:
!`git branch --show-current`

Specs available in this folder:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist"`

Branch-creation config:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, no config file)"`

Playable games registry:
!`cat components/games/registry.ts 2>/dev/null || echo "components/games/registry.ts does not exist"`

---

## Instrucciones

Sigue las cinco fases en orden estricto. **No avances a la siguiente fase si la anterior no se completó correctamente.**

---

### Fase 1 — Identificar el spec

El argumento recibido es: `$ARGUMENTS`

Si `$ARGUMENTS` está vacío:

- Lista los archivos disponibles en `specs/` (ya los tienes arriba).
- Pide al usuario que especifique el nombre exacto del spec.
- Detente y espera respuesta. No continúes.

Si `$ARGUMENTS` tiene valor:

- Busca el archivo en `specs/`. El usuario puede haber escrito el nombre completo (`09-snake`), solo el número (`09`) o solo el slug (`snake`). Intenta encontrar el archivo correcto en cualquiera de esos casos.
- Si no encuentras el archivo, muestra los specs disponibles y pide al usuario que corrija el nombre.
- Si lo encuentras, continúa a la Fase 2.

---

### Fase 2 — Validar el estado del spec

Lee el archivo del spec localizado en la Fase 1 con la herramienta Read.

En el contenido del archivo, busca la línea que contiene el estado del spec. La etiqueta suele ser `**Status:**` (inglés) o `**Estado:**` (español), pero puede estar en cualquier idioma. Identifícala por posición (línea de estado cerca del inicio del spec) y por la máquina de estados circundante, no por la etiqueta exacta.

**Regla absoluta:** solo puedes continuar si el estado **significa "Aprobado"** — sin importar el idioma usado.

Trata cualquiera de los siguientes (y sus equivalentes en otros idiomas) como estado **Aprobado** y continúa:

- Español: `Aprobado`
- Inglés: `Approved`
- Portugués: `Aprovado`
- Francés: `Approuvé`
- Alemán: `Genehmigt`
- Italiano: `Approvato`
- …o cualquier otra palabra en otro idioma que signifique claramente "aprobado"

Cualquier otro valor (Borrador/Draft, En revisión/In review, Implementado/Implemented, Obsoleto/Obsolete, o cualquier valor no reconocido) significa **detente** y muestra el mensaje de error de abajo.

| Categoría de estado                                 | Ejemplos (cualquier idioma)                       | Acción                                                             |
| --------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| Aprobado                                            | `Aprobado`, `Approved`, `Aprovado`, `Approuvé`, … | Continúa a la Fase 3.                                              |
| Borrador                                            | `Borrador`, `Draft`, …                            | Detente. Muestra el mensaje de error de abajo.                     |
| En revisión                                         | `En revisión`, `In review`, …                     | Detente. Muestra el mensaje de error de abajo.                     |
| Implementado                                        | `Implementado`, `Implemented`, …                  | Detente. Muestra el mensaje de error de abajo.                     |
| Obsoleto                                            | `Obsoleto`, `Obsolete`, …                         | Detente. Muestra el mensaje de error de abajo.                     |
| Línea de estado no encontrada / valor no reconocido | —                                                 | Detente. El archivo no sigue el formato esperado. Dilo al usuario. |

Si no estás seguro de si un valor significa "aprobado", **no asumas**. Detente y pide al usuario que aclare o actualice el spec con la palabra canónica.

**Mensaje de error estándar cuando el estado no significa Aprobado:**

```
❌ No puedo implementar este spec.

Estado actual: [ESTADO ENCONTRADO]
Solo trabajo con specs cuyo estado signifique "Aprobado" (p. ej. `Aprobado`, `Approved`,
o el equivalente en otro idioma).

Para continuar tienes dos opciones:
  1. Si el spec está listo para implementarse, ábrelo y cambia el estado
     a "Aprobado" (o el término equivalente que use tu equipo) manualmente.
     Ese cambio lo hace la persona, no el agente.
  2. Si el spec todavía necesita trabajo, usa /spec [nombre] para retomarlo.
```

No ofrezcas alternativas, no sugieras "puedo empezar igual si quieres". El bloqueo es intencional.

---

### Fase 3 — Crear la rama git y cambiar a ella

Una vez confirmado que el estado significa `Aprobado`:

1. Deriva el nombre de la rama del nombre completo del archivo del spec, sin extensión. Formato: `spec-NN-slug`. Ejemplos:

   - `09-snake.md` → rama `spec-09-snake`
   - `12-frogger.md` → rama `spec-12-frogger`

2. Lee el flag `AutoCreateBranch` de la config de creación de rama mostrada en el contexto de sesión de arriba.

   - Si el archivo de config no existe, el valor falta, o el valor no es reconocido → trátalo como `true` (el default).
   - Solo un `false` explícito (en cualquier capitalización) desactiva la creación automática de rama.

   **Si `AutoCreateBranch` es `true` (default):** procede sin preguntar.

   - Si la rama **no existe**: créala con `git checkout -b spec-NN-slug`.
   - Si **ya existe**: informa al usuario que la rama ya existía (puede significar que se retoma trabajo previo).
   - En ambos casos: cambia a la rama con `git checkout spec-NN-slug` y confirma que el cambio fue exitoso antes de continuar.

   **Si `AutoCreateBranch` es `false`:** pregunta antes de tocar git. Muestra:

   ```
   AutoCreateBranch está en false.
   ¿Crear y cambiar a la rama spec-NN-slug? [y/N]
   ```

   - Si el usuario responde **sí**: crea/cambia a la rama exactamente como en el caso `true` de arriba.
   - Si el usuario responde **no** o deja vacío: **no crees ninguna rama.** Dile al usuario que implementarás en la rama actual (la mostrada en el contexto de sesión de arriba) y pide confirmación explícita para continuar ahí. No improvises — espera la respuesta.

3. Confirma visualmente al usuario que el spec está listo y qué rama está activa:

   ```
   ✅ Listo para implementar.

   Spec:   specs/NN-slug.md
   Rama:   spec-NN-slug  (activa)   (← o la rama actual, si no se creó una nueva)
   Estado: Aprobado   (← repite el valor real encontrado en el spec)
   ```

4. **Todavía no empieces a implementar.** Primero muestra el resumen del spec al usuario para que lo tenga fresco. Extrae y muestra:
   - El **objetivo** (la línea después de `**Objetivo:**` / `**Objective:**` / equivalente).
   - El **alcance** (la sección `## Alcance` / `## Scope` / equivalente).
   - El **plan de implementación** (la sección con los pasos numerados — `## Plan de implementación` / `## Implementation plan` / equivalente).
   - Los **criterios de aceptación** (el checklist — `## Criterios de aceptación` / `## Acceptance criteria` / equivalente).

Empareja los encabezados de sección por significado, no por texto exacto — el spec puede estar en cualquier idioma.

---

### Fase 4 — Implementar paso a paso

Después de mostrar el resumen del spec, dile al usuario:

```
Voy a implementar el spec siguiendo el plan de implementación al pie de la letra.
Me detendré después de cada paso para que revises el diff.

¿Empezamos con el Paso 1?
```

Espera confirmación explícita ("sí", "dale", "adelante", o equivalente). No empieces sin ella.

Una vez confirmado, sigue estas reglas durante toda la implementación:

**Una regla por encima de todas:** implementa lo que dice el spec. Si algo del spec te parece subóptimo, menciónalo como observación pero implementa lo acordado. Los cambios al spec van al spec, no al código por sorpresa.

**Ritmo de trabajo:**

- Implementa un paso del plan.
- Muestra un resumen de qué archivos tocaste y qué hiciste.
- Di: `Paso N completado. ¿Puedes revisar el diff y avisarme si sigo con el Paso N+1?`
- Espera confirmación antes de continuar.

**Si durante la implementación encuentras una ambigüedad** que el spec no resuelve:

- Detente.
- Describe la ambigüedad exactamente.
- Presenta dos o tres opciones concretas.
- Espera la decisión del usuario.
- No improvises.

**Si el usuario pide algo fuera del alcance del spec:**

- Recuérdale que está fuera del alcance de este spec.
- Sugiere anotarlo para el siguiente spec.
- No lo implementes en esta rama.

**Al terminar el último paso**, no muestres todavía el cierre final de `/spec-impl` — continúa directo a la Fase 5. La Fase 5 es la que cierra la skill.

---

### Fase 5 — Puesta a punto del juego (skin-designer → mobile-porter)

Esta fase es lo único que distingue `/spec-impl-game` de `/spec-impl`. Corre automáticamente al terminar el último paso del plan de implementación — no pidas confirmación adicional para lanzarla.

1. **Resolver el `game-id`.** En este orden:
   - Revisa el diff de `components/games/registry.ts` hecho durante la Fase 4: la nueva entrada agregada a `PLAYABLE_GAMES` (`id → Canvas`) es el `game-id`.
   - Si no es obvio del diff, revisa el spec: el `id` que declara para `components/games/<id>/` y para la fila de la tabla `games` en Supabase (mismo patrón que `specs/09-snake.md`).
   - Si el spec **no introduce ni modifica ningún `game-id` jugable** (p. ej. specs de infraestructura como `10-controles-tactiles-mobile.md` o `11-gamepad-mk-ii.md`, que tocan el sistema pero no dan de alta un juego nuevo): dilo explícitamente al usuario —

     ```
     Este spec no introduce ni modifica un game-id jugable, así que no corresponde
     encadenar skin-designer/mobile-porter. Puesta a punto omitida.
     ```

     y termina aquí, sin lanzar ningún agente. Ve directo al cierre (paso 5 de esta fase).

2. **Verificar prerequisitos.** Confirma que el `game-id` resuelto existe en `PLAYABLE_GAMES` (`components/games/registry.ts`) — ambos agentes lo exigen como precondición dura. Si no está ahí (implementación incompleta), no lances ningún agente y repórtalo como bloqueo, sin inventar un id.

3. **Lanzar `skin-designer`** con la tool Agent (`subagent_type: "skin-designer"`), pasando el `<game-id>` resuelto como argumento junto con una línea de contexto (qué spec se acaba de implementar). Espera a que termine por completo antes de seguir — no lo des por terminado hasta ver su resumen final.

4. **Solo cuando `skin-designer` haya terminado**, lanza `mobile-porter` (`subagent_type: "mobile-porter"`) con el mismo `<game-id>`. **Nunca en paralelo, nunca antes de que `skin-designer` cierre** — `mobile-porter` audita en Playwright el layout mobile que incluye el selector de tema/modo que `skin-designer` acaba de agregar al HUD, así que necesita ese cambio ya en el árbol.

5. **Cierre final.** Reporta al usuario:
   - Los pasos del plan de implementación completados (Fase 4).
   - Resultado de `skin-designer`: temas añadidos, archivos tocados (o "omitido" si la Fase 5 se detuvo en el paso 1).
   - Resultado de `mobile-porter`: hueco táctil/layout cerrado, o "sin cambios — ya estaba cubierto" (o "omitido").
   - El recordatorio de cierre de `/spec-impl`:

     ```
     ✅ Todos los pasos del plan están implementados (y, si aplicaba, la puesta a
     punto de temas/mobile ya corrió).

     Siguiente paso: verificar los criterios de aceptación del spec uno por uno.
     Si todos pasan, actualiza el estado del spec a "Implementado" (o el equivalente
     en el idioma de tu repo) y haz el commit final antes de mergear esta rama.
     ```

---

## Reglas duras

- **`skin-designer` y `mobile-porter` corren siempre en ese orden y nunca en paralelo.** `mobile-porter` depende del layout que `skin-designer` deja escrito.
- **No relances un agente que ya reportó "nada que corregir"** dentro de la misma corrida de la Fase 5.
- **Si un agente falla o reporta un bloqueo real**, repórtalo tal cual y sigue con el siguiente paso de la Fase 5 (no abortes toda la fase) — la única excepción es que el `game-id` no exista en `PLAYABLE_GAMES`, ahí no se lanza ningún agente.
- **No toques la skill global `/spec-impl`** (`~/.agents/skills/spec-impl/SKILL.md`) ni los archivos de definición de los agentes (`.claude/agents/skin-designer.md`, `.claude/agents/mobile-porter.md`) desde esta skill.
- **Los agentes no escriben specs ni ejecutan migraciones** — su entregable es código funcionando más un resumen; no les pidas nada fuera de su contrato ya definido en sus propios `.md`.
- **No saltes la Fase 2** (gate de estado "Aprobado") por ningún motivo, igual que en `/spec-impl`.
