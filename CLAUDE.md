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
- Use `/add-game` (`.claude/skills/add-game/`) to draft the spec for a new game (`specs/NN-slug.md`). It never writes code — it produces the spec ready for `/spec-impl`. It covers the three mandatory layers of any game: engine (canvas), platform integration (catalog + `/games/<id>/jugar`), and real Supabase leaderboard.

## Agents

- `game-planner` (`.claude/agents/game-planner.md`) decides which game should be added next to the catalog — weighs catalog gaps, technical fit (canvas 2D single-player contract), and available ports/assets in `references/`. Keeps a memory of past suggestions in `references/game_suggestions_todo.md` so proposals aren't repeated. Never writes specs or code — hands off to `/add-game <slug>`. Run it before `/add-game` when the next game isn't already decided.
- `game-jam` (`.claude/agents/game-jam.md`) takes a free-text theme and, without back-and-forth, proposes 3 game concepts and writes 2 full candidate specs each (`variante-a.md`/`variante-b.md`, same `game-id`, different design approach) under `specs/game-jam/<game-id>/`. Follows the same technical contract as `/add-game` (`.claude/skills/add-game/reference.md`/`template.md`) but skips the section-by-section confirmation dialog. Never writes code or runs migrations. The user reviews the 6 candidate files and picks one to formalize via `/add-game`.
- `skin-designer` (`.claude/agents/skin-designer.md`) designs and implements at least 3 visual themes (Neon, Retro, Clásico), each with a light and dark variant, for an already-implemented game. Inventories every hardcoded color in the target `engine.ts`, adds a `GameTheme` contract to `components/games/types.ts`, refactors the engine to read a palette instead of literals, and wires a persistent theme/mode selector into the HUD. Default stays `clasico`/`dark`, pixel-identical to the current render. Writes code directly — no spec, no `/spec-impl` handoff.

## Architecture

- App Router under `app/`: `app/games` (catalog + `[id]` detail + `[id]/jugar` player), `app/salon` (hall of fame), `app/auth`, `app/about` (contact form via Resend, `app/api/contact/route.ts`). `@/*` path alias maps to repo root (see `tsconfig.json`).
  - Games live in `components/games/<slug>/` — each has an `engine.ts` (canvas game loop, framework-agnostic) and a `<slug>-canvas.tsx` wrapper. `components/games/registry.ts` maps catalog `id` → component. `components/games/types.ts` holds the shared engine/wrapper contract. Current games: see `references/implemented_games.md`.
- `components/game-player.tsx` hosts a game's canvas + HUD on `/games/[id]/jugar`; `lib/actions/scores.ts` is the server action that persists a run's score to Supabase on game over.
- Supabase: `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (server), `lib/supabase/queries.ts` (catalog/leaderboard reads). Tables: `games` (catalog) and `scores` (leaderboard), seeded/migrated per spec 04/06. `lib/session.ts` handles the lightweight player session used to attribute scores.
- Styling: Tailwind CSS v4 via `@tailwindcss/postcss` (`app/globals.css`, `postcss.config.mjs`) — no `tailwind.config.js`, config is CSS-based. Game cover art uses `cover-*` classes in `app/globals.css`.
- TypeScript strict mode on.
- CI: `.github/workflows/claude.yml` (mentions/assignment), `claude-code-review.yml` (automatic PR review), `claude-issue-triage.yml`.

## Spec-driven workflow

This project follows spec-driven design using `/spec` and `/spec-impl`, per practices from https://github.com/Klerith/fernando-skills. Install skills with:

```bash
npx skills@latest add Klerith/fernando-skills
```

Specs live in `specs/` (`NN-slug.md`), numbered sequentially. Implemented so far: 01 MVP visual screens, 02 home + English routes, 03 about/contact email, 04 Supabase base setup, 05 asteroids, 06 leaderboard + catalog in Supabase, 07 tetris, 08 arkanoid, 09 snake. New games should go through `/add-game` to produce the spec before `/spec-impl`.
