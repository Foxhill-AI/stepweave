# CLAUDE.md — AI assistant guide for this codebase

## Project identity

- **Name in package.json:** `responsive-web-template` (branding in app is **Step Weave**).
- **Stack:** Next.js **14** (App Router), React 18, **TypeScript** (no Tailwind — styling is **plain CSS** in `styles/`).
- **Data:** **Supabase** (Postgres + Auth + Storage) via `@supabase/supabase-js` and `@supabase/ssr`.
- **Scripts:** `npm run dev`, `npm run dev:clean` (deletes `.next` then `next dev` — use when chunks/cache break), `npm run build`, `npm run lint`. **There is no test runner configured.**

## Folder layout (where things live)

| Area | Path | Notes |
|------|------|--------|
| Routes & layouts | `app/` | `page.tsx`, `layout.tsx`, dynamic `[id]` / `[slug]` segments |
| API (server) | `app/api/**/route.ts` | Route Handlers only; no `pages/api` |
| UI components | `components/` | Includes `components/design-tool/*`, `components/ui/*` |
| Shared logic | `lib/` | **`lib/supabaseClient.ts` is very large** — most DB/API helpers live here |
| Printful | `lib/printful/*` | `mockupTask.ts`, `buildMockupFiles.ts`, `placementTemplate.ts`, `sleep.ts` |
| AI | `lib/openai/*`, `lib/fal/*` | Moderation + prompt interpreter; Fal image generation |
| Design draft types | `lib/designDraftState.ts` | `printful_placements` compact `{ s, dx, dy }` + helpers |
| Global CSS | `styles/globals.css` + feature CSS files imported by pages/components |
| Feature flags | `lib/featureFlags.ts`, `config/featureFlags.json` | Env-driven `NEXT_PUBLIC_FEATURE_*` |
| Middleware | `middleware.ts` | Supabase session refresh; **must not run on `/_next/`** |

## Conventions observed in code

1. **Client vs server:** `'use client'` on interactive components; server components by default. API secrets only in Route Handlers / server code.
2. **Supabase:** Browser client in `lib/supabaseClient.ts`; server/service usage often passes `SUPABASE_SERVICE_ROLE_KEY` in API routes (e.g. signed URLs, drafts). Middleware uses anon key + cookies (`@supabase/ssr`).
3. **Printful:** All catalog/mockup calls use `https://api.printful.com` with `Authorization: Bearer` + header **`X-PF-Store-Id`**. Layout/silhouette images: **`GET /mockup-generator/templates/{productId}`**. Do **not** use `option_groups: ["Template"]` on `create-task` — that is not a valid mockup style filter and yields 400 (“No variants to generate”).
4. **Design tool state:** Draft pattern lives on `design_draft.pattern_image_url` (Storage path); placement transforms in `design_state.printful_placements` as `{ s, dx, dy }` per placement key. Full Printful `position` is derived via `compactToPrintfulPosition` in `lib/designDraftState.ts`.
5. **Imports:** `@/` maps to project root (see `tsconfig.json`).
6. **Styling:** Class names are semantic/BEM-like (`design-tool-*`, `placement-editor-*`). New UI should match existing CSS files rather than introducing Tailwind unless the project explicitly migrates.

## Key rules for assistants

- **Do not break middleware:** Keep skipping `/_next/`, `favicon.ico`, and static extensions per `middleware.ts` matcher — otherwise client bundles can fail to load (stuck “Loading…”).
- **Do not put secrets in client bundles:** Only `NEXT_PUBLIC_*` belongs in browser code.
- **Respect RLS:** Client helpers assume Supabase RLS policies (e.g. `design_draft_*_own`). Service role routes bypass RLS — use only server-side.
- **Monolith caution:** Before adding new Supabase helpers, check if `lib/supabaseClient.ts` already has a pattern; avoid duplicating query logic across files without reason.

## What to avoid touching without explicit intent

- **Production auth/payment flows:** `middleware.ts`, `app/api/webhooks/stripe/route.ts`, `app/api/checkout*/route.ts`, `app/api/subscription/*` — require careful testing.
- **README clone instructions** if they point at an external template repo — may be legacy; confirm with the team before rewriting marketing docs.
- **Mass refactor of `lib/supabaseClient.ts`** without a plan — high blast radius.

## Related docs

- `docs/architecture.md` — structure, integrations, data flow  
- `docs/goal.md` — product intent and scope  
- `docs/task.md` — gaps and TODOs  
- `docs/test.md` — testing reality (minimal today)
