# Sugerencias de juegos — Arcade Vault

> Memoria del agente `game-planner`. Ver `references/implemented_games.md` para el estado actual del catálogo (jugables vs. solo-listados). Este archivo es editable a mano.

## Próximas sugerencias

<!-- El agente game-planner agrega aquí su recomendación principal tras cada sesión. -->

- [ ] **`duelo-pixel`** — Pong vs IA · VERSUS · cyan — ya listado en Supabase sin motor jugable; llena hueco de categoría VERSUS; contrato canvas 2D un jugador claro (score y game over bien definidos) · coste motor: bajo · assets: ninguno · sugerido 2026-08-05

## Consideradas y descartadas

<!-- Alternativas evaluadas y no elegidas, con motivo, para no re-proponerlas sin razón nueva. -->

- **`invasores`** — descartado por ahora en favor de `duelo-pixel` · 2026-08-05
- **`gloton`** — descartado por ahora en favor de `duelo-pixel` · 2026-08-05

## Candidatos futuros (sin priorizar)

<!-- Lista amplia generada por game-planner el 2026-08-05, más allá de duelo-pixel. Ningún id colisiona con Supabase ni con las secciones anteriores. Sin recomendación principal fijada — orden tentativo abajo, no un compromiso. Antes de proponer cualquiera de estos con /add-game, reconfirmar contra este archivo e implemented_games.md por si el catálogo cambió. -->

Orden tentativo (hueco de catálogo: PUZZLE tiene solo 1/8 juegos implementados vs. 4 ARCADE, 2 SHOOTER, 1 VERSUS — no es un compromiso de prioridad):

**PUZZLE** (hueco prioritario):

- `buscaminas` — Buscaminas · PUZZLE · cyan — coste bajo · assets: ninguno
- `bloques-2048` — 2048 · PUZZLE · magenta — coste bajo-medio · assets: ninguno
- `sokoban` — Sokoban (empuja cajas) · PUZZLE · yellow — coste medio (diseño de niveles) · assets: ninguno
- `memoria-neon` — Memory (parejas) · PUZZLE · green — coste bajo · assets: ninguno
- `columnas` — Columns (match-3 caída) · PUZZLE · magenta — coste medio, reutiliza patrón de grid de `caida` · assets: ninguno

**ARCADE**:

- `flappy-neon` — Flappy Bird clone · ARCADE · yellow — coste bajo · assets: ninguno
- `runner-pixel` — Endless runner estilo dino · ARCADE · green — coste bajo-medio · assets: ninguno
- `torre-stack` — Stack (apilar bloques) · ARCADE · magenta — coste bajo · assets: ninguno
- `qix-zona` — Qix (reclamar área) · ARCADE · cyan — coste medio · assets: ninguno
- `carrera-neon` — Carrera top-down contrarreloj · ARCADE · yellow — coste medio · assets: ninguno
- `bomber-solo` — Bomberman vs bots IA · ARCADE · green — coste medio-alto (IA de bots) · assets: ninguno
- `pinball-neon` — Pinball · ARCADE · cyan — coste alto (físicas de flippers), riesgo de scope creep · assets: ninguno

**SHOOTER**:

- `defensor-misiles` — Missile Command · SHOOTER · yellow — coste medio · assets: ninguno
- `centopeda` — Centipede clone · SHOOTER · green — coste medio · assets: ninguno
- `escuadron` — Shmup de oleadas estilo Galaga · SHOOTER · cyan — coste medio, reutiliza patrones de `rocas` · assets: ninguno
- `torreta` — Torreta fija, oleadas 360° · SHOOTER · magenta — coste bajo-medio · assets: ninguno

**VERSUS** (hoy solo `duelo-pixel`, aún sin motor):

- `duelo-tanques` — Duelo de tanques vs IA · VERSUS · yellow — coste medio · mismo fit que duelo-pixel: viable como 2D-un-jugador-vs-IA, NO si se espera multijugador real-time (requeriría infra aparte) · assets: ninguno
- `conecta-cuatro` — Conecta 4 vs IA · VERSUS · green — coste bajo (IA minimax) · requiere adaptar el contrato: sin "score" incremental natural, mapear victoria/derrota a `onGameOver` · assets: ninguno
- `ajedrez-rapido` — Ajedrez rápido vs IA · VERSUS · cyan — coste alto (motor + IA decente) · mismo problema de contrato que conecta-cuatro, más riesgo de no encajar con la estética arcade de puntaje/leaderboard · assets: ninguno
- `duelo-esgrima` — Duelo de reflejos (parry/thrust) vs IA · VERSUS · magenta — coste medio · mismo caveat que duelo-tanques (vs-IA sí, multijugador real-time no) · assets: ninguno

Ninguno tiene port o asset de respaldo en `references/started-games/` ni `references/source_assets/` (revisado 2026-08-05) — todos partirían de engine nuevo.

## Historial (implementadas)

Ver tabla "Jugables" en `references/implemented_games.md` (`rocas` → specs/05, `caida` → specs/07, `arkanoid` → specs/08, `snake` → specs/09). No se duplica aquí.
