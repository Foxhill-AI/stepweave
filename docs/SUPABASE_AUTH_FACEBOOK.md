# Facebook sign-in with Supabase (Step Weave)

The app already calls `signInWithOAuth({ provider: 'facebook' })` from the login/sign-up modals and completes the session on [`/auth/callback`](../app/auth/callback/page.tsx). Enabling Facebook is done in **Meta** and the **Supabase Dashboard**; no Facebook secrets belong in `.env` in this repo.

Official reference: [Supabase — Login with Facebook](https://supabase.com/docs/guides/auth/social-login/auth-facebook).

---

## 1. Supabase: URL configuration

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. **Authentication** → **URL Configuration**.
3. Set **Site URL** to your production origin (e.g. `https://your-domain.com`).
4. Under **Redirect URLs**, add every URL Supabase may redirect to **after** auth (your app):

   - `http://localhost:3000/auth/callback` — local dev  
   - `https://your-domain.com/auth/callback` — production  

Save. Without these, the flow can fail after Facebook returns via Supabase.

---

## 2. Meta (Facebook): app + redirect URI

1. Go to [developers.facebook.com](https://developers.facebook.com/) → **My Apps** → **Create App** (pick a type that supports **Facebook Login**).
2. Add the **Facebook Login** product → **Facebook Login** → **Settings**.
3. **Valid OAuth Redirect URIs**: add Supabase Auth’s callback (not your site):

   `https://<PROJECT_REF>.supabase.co/auth/v1/callback`

   Replace `<PROJECT_REF>` with your project reference (from the Supabase project URL).

   Tip: Supabase copies this for you at **Authentication** → **Providers** → **Facebook** (Callback URL / copy button).

4. **Save changes**.

5. **Email permission (required by Supabase)**  
   Per Supabase’s docs, ensure **email** is available (e.g. under app **Use Cases** → **Authentication and Account Creation**): both `public_profile` and `email` should be allowed. Without **email**, sign-in or profiles can break.

6. **Settings** → **Basic**: copy **App ID** and **App Secret** (show secret when needed).

7. For real users outside testers, move the app toward **Live** and complete Meta’s requirements (privacy policy URL, etc.).

### Local dev with Supabase CLI

If you use the Supabase CLI with local Auth, Meta must also allow the **local** callback (see [local development](https://supabase.com/docs/guides/local-development)):

`http://localhost:54321/auth/v1/callback`

---

## 3. Supabase: enable Facebook provider

1. **Authentication** → **Providers** → **Facebook**.
2. Turn **Facebook enabled** **ON**.
3. Paste **Client ID** = Facebook **App ID**, **Client Secret** = Facebook **App Secret**.
4. **Save**.

Optional: configure the same via [Supabase Management API](https://supabase.com/docs/guides/auth/social-login/auth-facebook) (`external_facebook_enabled`, `external_facebook_client_id`, `external_facebook_secret`) if you automate infrastructure.

---

## 4. Verify in the app

1. Run the site, open login, choose **Continue with Facebook**.
2. After redirect, you should land on `/auth/callback` then home, with a session.
3. If you see `error` / `error_description` in the URL, check Meta redirect URI (must match Supabase exactly) and that the provider is saved in Supabase.

---

## 5. `user_account` row (OAuth sign-up)

Email/password sign-up inserts `user_account` in the UI; **OAuth does not** in client code. After first Facebook login, confirm a row exists for the new `auth.users` id (e.g. query `user_account` or check `/api/me/account`).

If there is no row, apply a database-side hook once (see [scripts/user_account_on_auth_user_insert.sql](../scripts/user_account_on_auth_user_insert.sql)). The example uses `WHERE NOT EXISTS` so it does not fight email sign-up that also inserts a row.

---

## Summary checklist

| Where        | Action |
|-------------|--------|
| Supabase    | URL Configuration: Site URL + Redirect URLs including `.../auth/callback` |
| Meta        | Facebook Login → Valid OAuth Redirect URIs = `https://<ref>.supabase.co/auth/v1/callback` |
| Meta        | Email (+ `public_profile`) permissions for Authentication use case |
| Supabase    | Providers → Facebook ON + App ID + App Secret |
| Database    | Optional: trigger/script so OAuth users get `user_account` |
