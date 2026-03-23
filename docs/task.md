# Task audit — codebase status

Honest assessment based on source inspection (TODOs, comments, structure, and known runtime behaviors).

## 1. Incomplete / TODO / placeholder

| Item | Evidence |
|------|-----------|
| **Clone product** | `components/MyProductsTab.tsx`: `// TODO: clone product + variants` |
| **Manual design mode** | `ManualEditorPlaceholder.tsx` — sidebar/pills UI only; not wired to draft uploads / Printful like the AI path |
| **Media uploader** | `MediaUploaderUI.tsx`: **“UI only – no actual upload”** in `handleDrop` / `handleClick` |
| **Branding vs package name** | `package.json`: `responsive-web-template` vs app title **Step Weave** — may confuse CI/docs |
| **Shoe template overlay** | `ShoeDesignEditor` centers overlay on template image; API rows can include `print_area_*` / `template_width` — **not** used yet for pixel-perfect alignment on the PNG |

## 2. Stubbed or missing integrations

- **Fal / OpenAI / Printful / Stripe / Resend:** work only when env vars are set; some routes return 503 if keys missing.
- **Blog / contact / newsletter:** controlled by `lib/featureFlags.ts` (`NEXT_PUBLIC_FEATURE_*`) — often disabled in local dev.

## 3. Known fragile or failure modes (code + logs)

- **Printful mockup generator:** **429** rate limits, long polling, tasks ending **`failed`** or **Internal Server Error** — UI may show empty or fallback mockups.
- **`create-task` 400** if `option_groups` filters out all variants (e.g. invalid group names). Layout template images use **`GET /mockup-generator/templates/{productId}`**, not a fake `"Template"` option group.
- **Middleware:** If `_next` static assets were matched, client chunks could fail — `middleware.ts` documents excluding `_next/static`, `_next/image`, HMR, and image extensions.

## 4. Appears finished / working (as implemented)

- App Router pages: marketplace, product, cart, profile, design-tool, auth, marketing pages.
- **Design drafts** in `lib/supabaseClient.ts`; **DesignToolPage** with variant selection, **AIPromptPanel**, **PreviewWorkspace**, **PlacementEditorPanel**, **PlacementCanvasPreview**, optional **ShoeDesignEditor**.
- **Printful routes:** products, printfiles, placements, mockup-images, templates, placeholder-image, stores.
- **Draft APIs:** `generate`, `pattern-image`, `preview-mockups`, `create-product`.
- **Stripe:** checkout, webhook, subscription lifecycle routes (require dashboard + env alignment).
- **Supabase** session refresh in middleware; **Resend** helpers in `lib/email.ts`.
- **`npm run lint`** (Next.js ESLint).
