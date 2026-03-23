# Architecture — Step Weave (as built)

## High-level

Single **Next.js 14** application using the **App Router**. The UI is mostly **client components** for interactive areas (marketplace, profile, cart, design tool); **Route Handlers** under `app/api/` implement backend operations (Supabase, Stripe, Printful, OpenAI, Fal).

There is **no separate BFF** or microservices repo — the Next server is the API surface.

## Folder structure (actual)

```
app/                    # Routes: page.tsx, layout.tsx, etc.
  api/                  # Route Handlers (26 route.ts files)
    auth/               # login, exchange-code
    blog/articles/
    checkout/           # Stripe Checkout session
    checkout-subscription/
    design-drafts/[id]/ # generate, pattern-image, preview-mockups, create-product
    home-products/
    order/confirmation/
    printful/           # products, stores, printfiles, placements, mockup-images, templates, placeholder-image
    products/[id]/design-image/
    subscription/       # status, upgrade, downgrade, cancel, sync-after-checkout
    webhooks/stripe/
  auth/                 # callback, reset-password, page
  design-tool/          # new draft + [id] editor
  marketplace/, cart/, profile/, item/, blog/, …
components/
  design-tool/          # DesignToolPage, AIPromptPanel, PreviewWorkspace, PlacementEditorPanel, ShoeDesignEditor, …
  ui/                   # Modal, Toast
  …                     # Navbar, Product, Cart*, Profile*, Marketplace*, etc.
lib/
  supabaseClient.ts     # Central client + many typed helpers (products, cart, orders, drafts, notifications, …)
  supabase/server.ts    # Server Supabase helper (where used)
  designDraftState.ts   # printful_placements JSON shape + math
  printful/             # mockupTask, buildMockupFiles, placementTemplate, sleep
  openai/               # moderation, prompt-interpreter
  fal/                  # generate (image)
  email.ts              # Resend
  featureFlags.ts
  blogConfig.ts
  productsForHome.ts
styles/                 # globals.css + large per-feature CSS (DesignTool, Product, …)
config/featureFlags.json
middleware.ts           # Supabase auth session on matched paths
data/cartData.json      # Static sample data (legacy/demo)
```

## Frontend ↔ backend communication

| Pattern | Usage |
|---------|--------|
| **Server Components + props** | Some pages fetch via helpers where not client-only. |
| **`fetch()` from client** | Design tool, Printful proxies, drafts — calls same-origin `/api/...`. |
| **Supabase client (`lib/supabaseClient.ts`)** | Direct browser queries with anon key + RLS (profile, cart, products listing, drafts when allowed). |
| **Route Handlers** | Anything needing **service role**, **Stripe**, **Printful API key**, **OpenAI**, **Fal**, or signed Storage URLs. |

Examples:

- **Pattern image preview:** `GET /api/design-drafts/[id]/pattern-image` — signs Storage object for private bucket.
- **AI pattern generation:** `POST /api/design-drafts/[id]/generate` — server uses OpenAI + Fal + moderation, writes to Storage/draft.
- **Printful mockups:** `POST /api/design-drafts/[id]/preview-mockups` — builds `create-task` payload from draft + `design_state`.
- **Catalog:** `GET /api/printful/products/...`, `/placements`, `/mockup-images`, `/templates` — proxy + normalize Printful responses.

## Third-party integrations (detected)

| Service | Role | Config / entry points |
|---------|------|------------------------|
| **Supabase** | Auth, Postgres, Storage | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; `middleware.ts`, `lib/supabaseClient.ts`, many `app/api/*` routes |
| **Stripe** | Checkout, subscriptions | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; `app/api/checkout/route.ts`, `checkout-subscription`, `webhooks/stripe`, `subscription/*` |
| **Printful** | Catalog, mockup generator, layout templates | `PRINTFUL_API_KEY`, `PRINTFUL_STORE_ID`; optional `PRINTFUL_PLACEHOLDER_IMAGE_URL`, `NEXT_PUBLIC_SITE_URL` for placeholder URL |
| **OpenAI** | Moderation, prompt interpretation | `OPENAI_API_KEY`, optional `OPENAI_MODERATION_MODEL`; `lib/openai/*`, `app/api/design-drafts/[id]/generate/route.ts` |
| **Fal** | Image generation | `FAL_KEY` / `FAL_API_KEY` / `FAL_AI_API_KEY`; `lib/fal/generate.ts` |
| **Resend** | Email | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`; `lib/email.ts` |

## Database schema (as visible in code)

There is **no SQL migration folder** in-repo; schema is **inferred** from `lib/supabaseClient.ts` types and `.from('table_name')` usage.

Representative tables/types include:

- **Auth-related:** `user_account`, `public_profile` (see `PublicProfileRow`)
- **Commerce:** `product`, `product_listing`, `category`, attributes/options, `cart`, `cart_item`, `order`, `order_item`, `shipping_address`
- **Content:** `article` (`ArticleRow`), `advertisement`, `user_notification`
- **Design tool:** **`design_draft`** (`DesignDraftRow`: `design_state` JSON, `pattern_image_url`, `base_model_id`, Printful provider fields, status, `final_product_id`), **`design_draft_ai_message`**

RLS policy names appear in comments (e.g. `design_draft_insert_own`).

## Main user journeys (data flow)

### 1. Browse & purchase (marketplace)

Home/marketplace components → Supabase (or `GET /api/home-products`) for listings → product detail → cart (`CartModal` / `CartPage`) → **`app/api/checkout`** creates Stripe session → confirmation / order APIs.

### 2. Subscriptions (optional feature flag)

Feature flag `SUBSCRIPTIONS` → checkout-subscription → Stripe webhook updates Supabase → `subscription/status`, upgrade/downgrade/cancel routes.

### 3. Design tool (Printful-backed product)

1. User selects base model (Printful product id) and variant — `BaseModelSelection` / `DesignToolPage`.
2. **`design_draft`** created/updated via `lib/supabaseClient.ts` (`createDesignDraft`, `updateDesignDraft`).
3. **AI path:** `AIPromptPanel` → `POST /api/design-drafts/[id]/generate` (OpenAI interpret + moderate → Fal image → Storage path on draft).
4. **Pattern display:** signed URL via `GET .../pattern-image` or public URL.
5. **Placements:** `PlacementEditorPanel` loads `/api/printful/.../placements` and `/templates`; edits `design_state.printful_placements`; optional **ShoeDesignEditor** when layout template URLs exist.
6. **Mockup preview:** `POST .../preview-mockups` → Printful `create-task` + poll; tabs in `PreviewWorkspace`.
7. **Publish:** `POST .../create-product` (creates marketplace product from draft — see route implementation).

### 4. Auth

Supabase Auth (email/password, OAuth flows) via `AuthProvider`, `AuthModal`, `app/auth/*`, `app/api/auth/*`.

## Configuration files

- `next.config.js` — minimal (`reactStrictMode`)
- `tsconfig.json` — path alias `@/*`
- `middleware.ts` — matcher excludes `_next/static`, `_next/image`, HMR, common image extensions
