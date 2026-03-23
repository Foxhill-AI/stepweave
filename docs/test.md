# Testing — current state

## What exists today

- **`npm run lint`** — Next.js ESLint (`next lint`). This is the only quality gate script besides `build`.
- **No** `jest`, `vitest`, `playwright`, `cypress`, or `@testing-library/*` in `package.json`.
- **No** `*.test.ts(x)`, `*.spec.ts(x)`, or `__tests__/` directories were found in the repository at documentation time.

## Critical flows with no automated tests

1. **Stripe checkout** session creation (`app/api/checkout/route.ts`).
2. **Stripe webhook** verification and side effects (`app/api/webhooks/stripe/route.ts`).
3. **Auth** — sign-in, OAuth callback, middleware session refresh (`middleware.ts`, `AuthProvider`, `app/auth/*`).
4. **`POST /api/design-drafts/[id]/generate`** — OpenAI, Fal, moderation, Storage, DB updates.
5. **`POST /api/design-drafts/[id]/preview-mockups`** — Printful `create-task`, polling, merge into response.
6. **`POST /api/design-drafts/[id]/create-product`** — product creation from draft.
7. **Cart → checkout → order confirmation** end-to-end.
8. **Printful proxy routes** — response shapes, error handling, 429 backoff behavior (`lib/printful/mockupTask.ts`).

## Priority before launch (suggested)

1. **Stripe webhook** — signature verification, idempotency, failure logging (manual QA + automated).
2. **Checkout → order confirmation** — happy path E2E on staging with test keys.
3. **Design draft generate** — contract or integration test with mocked OpenAI/Fal or isolated staging keys.
4. **Preview mockups** — integration test with mocked Printful HTTP or golden JSON fixtures.
5. **Auth smoke** — login/logout/session E2E.
6. **Supabase RLS** — SQL tests or integration tests against a non-production project if policy changes are frequent.

## Tools to add (not present)

| Layer | Suggested stack |
|-------|------------------|
| Unit / component | **Vitest** or **Jest** + **@testing-library/react** |
| E2E | **Playwright** against `next dev` or Vercel preview |
| API Route Handlers | **Vitest** with `fetch` to local server, or **supertest** pattern |

## Notes

- Align CI job names with product branding (**Step Weave**) even if `package.json` still says `responsive-web-template`.
- Adding tests does not require renaming the package, but documenting the canonical name in README helps contributors.
