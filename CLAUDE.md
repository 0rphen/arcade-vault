# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault — online arcade platform, players compete for high scores. Fresh Next.js App Router scaffold (minimal custom code yet).

## Critical: Next.js version

This repo pins `next@16.2.12` — a version with breaking changes vs. training data. Before writing any App Router code (routing, data fetching, config, server/client components), read the relevant doc in `node_modules/next/dist/docs/01-app/` first. Don't assume older Next.js APIs still apply.

No test runner is configured yet.

## Skills
Use always /frontend-design to design user interfaces.

## Architecture

- App Router under `app/` (`app/layout.tsx`, `app/page.tsx`). `@/*` path alias maps to repo root (see `tsconfig.json`).
- Styling: Tailwind CSS v4 via `@tailwindcss/postcss` (`app/globals.css`, `postcss.config.mjs`) — no `tailwind.config.js`, config is CSS-based.
- TypeScript strict mode on.

## Spec-driven workflow

This project follows spec-driven design using `/spec` and `/spec-impl`, per practices from https://github.com/Klerith/fernando-skills. Install skills with:

```bash
npx skills@latest add Klerith/fernando-skills
```
