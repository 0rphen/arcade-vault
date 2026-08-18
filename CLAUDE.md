# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault — online arcade platform, players compete for high scores. Catalog of playable canvas games (`/games`) backed by a real Supabase leaderboard, plus auth and a contact form.

## Critical: Next.js version

This repo pins `next@16.2.12` — a version with breaking changes vs. training data. Before writing any App Router code (routing, data fetching, config, server/client components), read the relevant doc in `node_modules/next/dist/docs/01-app/` first. Don't assume older Next.js APIs still apply.

No test runner is configured yet.

## Skills

- Use always `/frontend-design` to design user interfaces (new covers, HUD, screens).
- Use `/add-game` (`.claude/skills/add-game/`) to draft the spec for a new game (`specs/NN-slug.md`). It never writes code — it produces the spec ready for `/spec-impl-game`. It covers the three mandatory layers of any game: engine (canvas), platform integration (catalog + `/games/<id>/jugar`), and real Supabase leaderboard.
- Use `/spec-impl-game` (`.claude/skills/spec-impl-game/`) instead of plain `/spec-impl` to implement a game spec — same Fases 1–4, plus a Fase 5 that chains `skin-designer` then `mobile-porter` on the game-id just implemented.

## Agents

Typical chain for a new game: `game-planner` → `/add-game` → `/spec-impl-game` (which itself chains `skin-designer` → `mobile-porter`) → `game-performance`.

- `game-planner` (`.claude/agents/game-planner.md`) — decides which game to add next to the catalog; keeps memory in `references/game_suggestions_todo.md`.
- `game-jam` (`.claude/agents/game-jam.md`) — takes a free-text theme and writes 2 candidate spec variants (`variante-a.md`/`variante-b.md`) for one game concept under `specs/game-jam/<game-id>/`.
- `skin-designer` (`.claude/agents/skin-designer.md`) — implements at least 3 visual themes (Neon, Retro, Clásico) × light/dark for an already-implemented game, code directly, no spec.
- `mobile-porter` (`.claude/agents/mobile-porter.md`) — audits/fixes a given game's mobile experience (canvas, HUD, touch controls) per spec 10.
- `game-performance` (`.claude/agents/game-performance.md`) — audits/optimizes a given game's rendering performance per spec 12, logs results in `references/performance_baseline.md`.

Each agent's full contract, guardrails, and phases live in its own `.md` file above — read that file for details beyond this one-line summary.

## Architecture

- App Router under `app/`: `app/games` (catalog + `[id]` detail + `[id]/jugar` player), `app/salon` (hall of fame), `app/auth`, `app/about` (contact form via Resend, `app/api/contact/route.ts`). `@/*` path alias maps to repo root (see `tsconfig.json`).
  - Games live in `components/games/<slug>/` — each has an `engine.ts` (canvas game loop, framework-agnostic) and a `<slug>-canvas.tsx` wrapper. `components/games/registry.ts` maps catalog `id` → `PlayableGameEntry` (`{ Canvas, themes? }`). `components/games/types.ts` holds the shared engine/wrapper contract, including the optional `GameTheme`/`GameThemeSelection` contract used by themed games. Current games: see `references/implemented_games.md`.
- `components/game-player.tsx` hosts a game's canvas + HUD on `/games/[id]/jugar` (theme selector in `.hud-theme` when the game declares `themes`, perf overlay via `?perf=1`); `lib/actions/scores.ts` is the server action that persists a run's score to Supabase on game over.
- Themes (spec 11/skin-designer): per-game palettes in `components/games/<slug>/themes.ts`, selection persisted in `localStorage` (`arcade-vault:<game-id>:theme` / `:mode`), default `clasico`/`dark`. Status per game: `references/game_themes.md`.
- Touch controls & gamepad (spec 10/11): `components/games/touch-controls.tsx` + `touch-controls-config.ts` — adding a new game means adding a `TOUCH_CONTROLS_CONFIG` entry, not touching the shared component.
- Performance instrumentation (spec 12): `lib/perf/use-frame-stats.ts`, `lib/perf/perf-counters.ts`, `components/games/perf-overlay.tsx` (overlay behind `?perf=1`). Baseline measurements: `references/performance_baseline.md`.
- Supabase: `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (server), `lib/supabase/queries.ts` (catalog/leaderboard reads). Tables: `games` (catalog) and `scores` (leaderboard), seeded/migrated per spec 04/06. `lib/session.ts` handles the lightweight player session used to attribute scores.
- Styling: Tailwind CSS v4 via `@tailwindcss/postcss` (`app/globals.css`, `postcss.config.mjs`) — no `tailwind.config.js`, config is CSS-based. Game cover art uses `cover-*` classes in `app/globals.css`.
- `references/` doubles as living documentation, not just assets: `implemented_games.md` (catalog status), `game_themes.md`, `performance_baseline.md`, `game_suggestions_todo.md` are sources of truth kept updated by their respective agents; `started-games/`, `templates/`, `gamepad-assets/` hold ports and design assets.
- TypeScript strict mode on.
- CI: `.github/workflows/claude.yml` (mentions/assignment), `claude-code-review.yml` (automatic PR review), `claude-issue-triage.yml`.

## Spec-driven workflow

This project follows spec-driven design using `/spec` and `/spec-impl`, per practices from https://github.com/Klerith/fernando-skills. Install skills with:

```bash
npx skills@latest add Klerith/fernando-skills
```

Specs live in `specs/` (`NN-slug.md`), numbered sequentially. Implemented so far: 01 MVP visual screens, 02 home + English routes, 03 about/contact email, 04 Supabase base setup, 05 asteroids, 06 leaderboard + catalog in Supabase, 07 tetris, 08 arkanoid, 09 snake, 10 mobile touch controls, 11 gamepad MK-II, 12 game performance instrumentation. New games go through `/add-game` (spec) then `/spec-impl-game` (implementation + theme/mobile follow-up).

`specs/game-jam/<game-id>/` holds unnumbered candidate specs produced by the `game-jam` agent — not committed work, just proposals pending review. `frogger` (playable today) shipped from `specs/game-jam/frogger/01-frogger-core.md` outside the normal `NN-` numbering.
