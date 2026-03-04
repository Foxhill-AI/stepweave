# Blog / Articles (4.4)

## Configuration

In `.env`:

- **`NEXT_PUBLIC_ENABLE_BLOG`** — Set to `true` to enable the blog. When `false`, `/blog` and `/blog/[slug]` return 404 and the Blog link is hidden in the navbar and footer.
- **`NEXT_PUBLIC_ARTICLE_SEARCH_ENABLED`** — Set to `true` to show the search bar on the blog index and use server-side search (by title, summary, content).

Example:

```env
NEXT_PUBLIC_ENABLE_BLOG=true
NEXT_PUBLIC_ARTICLE_SEARCH_ENABLED=true
```

## Tables

Uses the `article` table. For an article to appear on `/blog` it must have:

- `status = 'published'` (not `draft` or `archived`)
- `published_at` set (not null) and in the past or now: `published_at <= NOW()`

If the blog shows "Loading articles…" then no articles (empty list), check:

1. **RLS**: Run `scripts/article_select_policy.sql` in Supabase (SQL Editor) so the app can read published articles.
2. **Data**: In Supabase Table Editor → `article`, ensure each row has `status = 'published'` and `published_at` filled with a date ≤ today.

## Flows

- **4.4.1 View Blog Index** — `/blog` lists published articles with pagination (9 per page). Optional search when `ARTICLE_SEARCH_ENABLED` is true.
- **4.4.2 View Article** — `/blog/[slug]` is server-rendered with SEO meta (seo_title, seo_description). Returns 404 if the article is not found or not published. ISR revalidate: 60 seconds.

## Stripe webhook

No Stripe dependency for the blog.
