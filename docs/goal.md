# Product goals — inferred from the codebase

## What this application is

**Step Weave** (site metadata in `app/layout.tsx`) is a **content- and commerce-oriented web app**: marketplace, user profiles, cart/checkout, optional blog/newsletter/contact (feature-flagged), and a **design tool** for creating **print-on-demand style products** using **Printful** as the fulfillment/catalog backend, with **Supabase** for data and auth and **Stripe** for payments/subscriptions.

It began from a **responsive web template** (`package.json` name `responsive-web-template`) and has grown domain-specific features (design drafts, Printful integration, AI pattern generation).

## Primary use cases (implemented flows)

### A. Discover and buy products

1. User lands on home / marketplace / search / explore.
2. Opens product detail (`Product`, `item/[id]`).
3. Adds to cart; opens cart modal or cart page.
4. Checkout via Stripe (`app/api/checkout/route.ts`).
5. Order confirmation flow (`app/order/confirmation`, `app/api/order/confirmation`).

### B. Creator / seller profile

1. Sign up / sign in (Supabase Auth — `AuthModal`, `AuthProvider`).
2. Profile and tabs (`ProfilePage`, `MyProductsTab`, `OrdersTab`, `SettingsTab`, etc.).
3. Manage listed products and related data via Supabase client helpers.

### C. Design a Printful-based product (core differentiator)

1. Open **Design tool** (`/design-tool`, `/design-tool/[id]`).
2. Choose **base model** (Printful product id) and **variant** (size/color — drives print areas).
3. **AI mode:** describe pattern → server expands/interprets prompt (OpenAI), moderates, generates image (Fal), stores pattern on draft, updates preview.
4. **Manual mode:** UI shell only (`ManualEditorPlaceholder`) — not a full manual design pipeline tied to Printful uploads in the same way as AI.
5. Adjust **per-placement layout** (`printful_placements` in `design_state`): visual editor + optional shoe template overlay when Printful returns layout template images.
6. Refresh **mockup previews** (Printful mockup generator) in `PreviewWorkspace`.
7. Save draft and **create product** from draft (`create-product` API) to list for sale.

### D. Optional: membership / subscription

Gated by `isFeatureEnabled(FEATURE_KEYS.SUBSCRIPTIONS)` and related env — Stripe subscription checkout and webhook sync.

## Out of scope for the current version (as evidenced by code)

- **Full manual design editor:** `ManualEditorPlaceholder` is explicitly a **placeholder** (sidebar + fake controls); no real upload-to-placement pipeline comparable to AI in manual mode.
- **Media uploader component:** `MediaUploaderUI` comment: **“UI only – no actual upload”** — not wired to Storage.
- **Product clone:** `MyProductsTab` contains **TODO: clone product + variants** — not implemented.
- **Automated test suite:** No Jest/Vitest/Playwright in `package.json`; no `*.test.*` files found — shipping quality relies on manual QA.
- **Tailwind:** Project uses **CSS files** under `styles/`, not Tailwind (no `tailwind.config` in project root).

## Non-goals (do not assume from repo alone)

- In-house print fulfillment (Printful is the integration point).
- Mobile native apps (web only).
- Exact parity with Printful’s own mockup editor (this app composes APIs + custom UI).
