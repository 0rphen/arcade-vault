---
name: add-game
description: Diseña el spec de un juego nuevo de Arcade Vault — motor de canvas, integración en GamePlayer y leaderboard real en Supabase. El juego puede portarse desde references/started-games/ o crearse desde cero. No escribe código; produce specs/NN-slug.md listo para /spec-impl.
disable-model-invocation: true
argument-hint: "nombre del juego o carpeta de references/started-games/"
---

# /add-game — Spec de juego jugable + leaderboard

Esta skill ayuda a producir el spec de un juego nuevo del catálogo de Arcade Vault, siguiendo el mismo patrón que ya cerraron los specs 05 (`asteroids-rocas`) y 06 (`leaderboard-catalogo-supabase`): un motor de canvas encapsulado, un wrapper cliente, una entrada en el catálogo (`games`) y guardado real de puntajes (`scores`). **Esta skill no escribe código.** Su único entregable es `specs/NN-slug.md`, listo para ejecutarse con `/spec-impl`.

## Filosofía

Cada juego del vault repite el mismo recorrido de tres capas: **motor** (reglas del juego en un canvas), **plataforma** (que aparezca en `/games`, sea jugable en `/games/<id>/jugar`, tenga HUD) y **leaderboard** (que su puntaje sea real en Supabase, no `localStorage`). Un spec que resuelva solo una o dos de esas capas deja el juego a medias — jugable pero sin tabla de posiciones real, o listado en el catálogo pero no jugable. Esta skill existe para que ningún spec de juego nuevo se cierre incompleto.

Esta skill es una especialización de la skill `spec` global (`~/.claude/skills/spec/SKILL.md` y su `~/.claude/skills/spec/template.md`): hereda su método (fases, forma de preguntar, desarrollo sección por sección) y lo aplica al caso concreto de un juego jugable con leaderboard. Lee esa skill primero — es el método; `reference.md` y `template.md` de este directorio son el contenido específico de dominio que se inyecta en ese método.

Lee `reference.md` (en el mismo directorio que esta skill) para el contrato técnico exacto de cada capa, y `template.md` para la estructura del spec que vas a producir. Apóyate en ambos en cada fase.

## Flujo del comando

Sigue las cuatro fases en orden. Responde siempre en el idioma del prompt inicial del usuario (si empieza en español, todo el flujo es en español; si empieza en inglés, en inglés).

### Fase 1 — Contexto

Antes de preguntar nada sobre el juego, reúne el estado actual del repo, **en este orden**:

1. **Lee `~/.claude/skills/spec/SKILL.md` y `~/.claude/skills/spec/template.md` completos.** Son el método base de todo spec de este proyecto: de ahí sale cómo se hacen las preguntas (bloques de 3–5, esperar respuesta), cómo se desarrolla el documento (sección por sección, con confirmación antes de avanzar), la estructura genérica del template (header, alcance, modelo de datos, plan de implementación, criterios de aceptación, decisiones, riesgos) y las reglas duras que ya aplican aquí (nunca generar el spec completo de una sola vez, nunca asumir decisiones no confirmadas, Fase 2 no se salta). Todo lo que sigue en esta skill es una adaptación de ese método al dominio concreto de "juego jugable + leaderboard" — no un método alternativo.
2. Lee `CLAUDE.md` y `AGENTS.md` en la raíz del proyecto (convenciones de Next.js 16, spec-driven workflow).
3. Lee `specs/05-asteroids-rocas.md` y `specs/06-leaderboard-catalogo-supabase.md` completos — son la referencia canónica de cómo se ve un spec de juego terminado en este repo (nivel de detalle, tono de las secciones, formato de "Decisiones tomadas y descartadas"), ya aplicando el método de `/spec` al caso de un juego.
4. Lee `reference.md` de esta skill (contrato técnico de motor/wrapper/registro/datos/estilos).
5. `ls specs/` para determinar el siguiente número secuencial (`NN`).
6. Verifica si `components/games/registry.ts` ya existe (`ls components/games/`). Si **no existe**, el spec que produzcas debe incluir el paso 0 de refactor (crear el registry y migrar `rocas` a él) — ver `template.md`. Si **ya existe**, omite ese paso.
7. Consulta los ids ya presentes en el catálogo con `mcp__supabase__execute_sql` (`select id from games order by id;`, solo lectura) para no proponer un `id` duplicado ni repetir el seed de un juego que ya está migrado.

No escribas nada todavía ni ejecutes migraciones — esta fase es solo de lectura.

### Fase 2 — Origen del juego

- Si `$ARGUMENTS` señala una carpeta de `references/started-games/` (o el usuario la nombra durante la conversación), léela completa: su `CLAUDE.md`, `README.md` y `game.js`. Extrae de ahí, sin preguntar: mecánicas, controles, condición de derrota, sistema de puntaje, clases/estructuras internas, resolución lógica del canvas. Esto resuelve buena parte de la sección "Motor" del spec sin necesidad de la Fase 3.
- Si el juego se crea desde cero (sin referencia): no inventes mecánicas ni balance. Todo eso se pregunta explícitamente en la Fase 3.
- Si el usuario menciona una referencia pero el juego final se va a apartar de ella en algo (ej. cambiar controles, agregar power-ups nuevos), anota la diferencia — va a la sección de decisiones del spec.

### Fase 3 — Preguntas

Pregunta en bloques de 3 a 5 (nunca una por una), esperando respuesta entre bloques. Cubre como mínimo:

**Bloque identidad/catálogo:**

1. `id` — slug único del catálogo (ej. `rocas`, `tetris`). Ya validado contra los ids existentes en la Fase 1.
2. `title`, `short` (descripción corta de card), `long` (descripción del detalle).
3. `cat` — una de `ARCADE | PUZZLE | SHOOTER | VERSUS`.
4. `color` — una de `cyan | magenta | yellow | green` (acento visual del juego en el catálogo).
5. `plays` — string estático de exhibición (ej. `"15.6K"`), como los demás juegos del seed.

**Bloque portada:** 6. ¿La portada reutiliza una clase `cover-*` ya existente en `app/globals.css`, o necesita una nueva? Si es nueva, el spec debe indicar que se diseña con `/frontend-design` durante `/spec-impl` (regla ya establecida en `CLAUDE.md` del proyecto), no un placeholder improvisado aquí.

**Bloque motor (si no vino ya resuelto por una referencia en Fase 2):** 7. Resolución lógica fija del canvas (ancho × alto). 8. Controles exactos — qué teclas se capturan con `preventDefault` mientras el canvas está montado. 9. Condición de game over y reglas de puntaje (qué suma puntos, cuándo se pierde una vida si aplica). 10. Qué se porta tal cual del original (si hay uno) y qué se recorta explícitamente para este spec (sonido, dificultad dinámica, etc. — por defecto diferidos, como en spec 05).

**Bloque HUD:** 11. Qué callbacks necesita el wrapper más allá de `onScoreChange`/`onGameOver`: ¿tiene vidas (`onLivesChange`)? ¿niveles (`onLevelChange`)? ¿algún estado temporal propio (como el `onTripleShotChange` de ROCAS)? Si el juego no tiene vidas o niveles, pregunta explícitamente qué reemplaza esas casillas del HUD — no lo asumas.

**Bloque alcance:** 12. Confirmar los diferidos por defecto: controles táctiles/móvil, sonido, ajustes de balance/dificultad — a menos que el usuario pida explícitamente incluir alguno.

Si alguna respuesta abre una funcionalidad claramente más grande (multijugador, matchmaking, chat), señala que merece su propio spec aparte y pregunta si queda fuera de alcance de este.

**Casos que no encajan en el molde:** si el juego no es de canvas 2D de un solo jugador (ej. es basado en DOM, es multijugador en tiempo real, no tiene "game over" claro), dilo explícitamente y propone ajustar la sección de Alcance del spec en vez de forzar el contrato de `reference.md` tal cual.

### Fase 4 — Escribir el spec

Usa `template.md` (de este directorio) como esqueleto de contenido, pero desarróllalo siguiendo al pie de la letra el método de la Fase 3 de `~/.claude/skills/spec/SKILL.md` leído en la Fase 1: sección por sección, mostrando cada una formateada en markdown, preguntando "¿Esta sección queda así o quieres ajustar algo?" y esperando confirmación antes de pasar a la siguiente. No saltes secciones ni las combines en una sola respuesta.

1. Header (estado `Borrador`, depende de `06-leaderboard-catalogo-supabase`, fecha, objetivo en una frase).
2. Alcance (dentro/fuera).
3. Modelo de datos (fila de `games`, interfaces TypeScript del motor — igual formato que spec 05).
4. Plan de implementación — parte del esqueleto fijo de `template.md` (paso 0 condicional + pasos 1–8), adaptado con los nombres concretos de este juego.
5. Criterios de aceptación — hereda los criterios base de `template.md` y agrega los específicos de este juego (mecánica particular, power-ups, etc.).
6. Decisiones tomadas y descartadas.
7. Riesgos identificados (reutiliza los riesgos genéricos de motor/canvas de spec 05 cuando apliquen — scroll por teclas capturadas, doble montaje en `StrictMode`, listeners huérfanos — y agrega los propios del juego).

Al confirmar la última sección:

1. Determina el número secuencial (`NN`) y el slug (`<id-o-nombre-corto>`).
2. Confirma el nombre de archivo propuesto con el usuario antes de escribir.
3. Escribe `specs/NN-slug.md` con estado `Borrador`.
4. Confirma al usuario: ruta del archivo creado, recordatorio de que sigue en `Borrador` hasta que lo revise, y que el siguiente paso es `/spec-impl NN-slug`.
5. **Para aquí.** No propongas implementar, no escribas código, no toques Supabase.

## Reglas duras

- **Nunca escribas código.** Ni motor, ni componentes, ni CSS. Solo el archivo `.md` del spec.
- **Nunca ejecutes `mcp__supabase__apply_migration`** ni ninguna escritura contra Supabase — solo lecturas (`execute_sql` de solo consulta, `list_tables`) en la Fase 1.
- **El spec siempre cubre las tres capas** (motor, integración en la plataforma, leaderboard real). Si el usuario pide dejar alguna fuera explícitamente (ej. "que por ahora siga en localStorage"), documéntalo como decisión consciente en la sección de decisiones, no lo omitas en silencio.
- **No asumas nombres de archivo, `id` o mecánicas que el usuario no confirmó.** Si falta un dato, pregúntalo.
- **No generes el spec completo de una sola vez.** Sección por sección, con confirmación.

## Argumentos

Si se invoca `/add-game 03-tetris`, trata `03-tetris` como una carpeta candidata dentro de `references/started-games/` y arranca la Fase 2 verificando si existe. Si se invoca `/add-game` sin argumentos, pregunta primero si el juego viene de una referencia existente o se diseña desde cero.
