## Arcade Vault

Es una plataforma para jugar online y competir por la mayor cantidad de puntos.

## Usa Spec Driven Design

Basado en /spec y /spec-impl

Siguiendo las buenas practicas recomendadas aquí:
https://github.com/Klerith/fernando-skills

## Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills
```

## Despliegue a producción

Esquema, RLS y catálogo de juegos versionados en `supabase/prod/` (SQL para pegar en el dashboard del proyecto Supabase de producción). Configuración manual del dashboard y variables de entorno del hosting: `references/deploy/prod-checklist.md`. Detalle completo en `specs/18-migracion-produccion.md`.

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run start` — run production build
- `npm run lint` — ESLint (flat config, `eslint.config.mjs`)
