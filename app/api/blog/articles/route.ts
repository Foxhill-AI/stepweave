import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getPublishedArticlesPaginated, type ArticleRow } from '@/lib/supabaseClient'

const ARTICLE_SELECT = `
  id,
  title,
  slug,
  content,
  summary,
  seo_title,
  seo_description,
  status,
  author_user_account_id,
  published_at,
  created_at,
  updated_at,
  user_account:author_user_account_id ( username )
`

/**
 * GET /api/blog/articles?limit=9&offset=0&search=
 * Returns published articles with pagination. Uses SUPABASE_SERVICE_ROLE_KEY when
 * set and runs the query in this route (avoids "db.from().eq is not a function"
 * when passing client to shared lib). Otherwise uses getPublishedArticlesPaginated
 * with anon client (requires RLS policy on article).
 */
export async function GET(request: NextRequest) {
  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 9))
  const offset = Math.max(0, Number(request.nextUrl.searchParams.get('offset')) || 0)
  const search = request.nextUrl.searchParams.get('search')?.trim() || undefined
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const useServiceRole = Boolean(supabaseUrl && serviceRoleKey)

  try {
    let articles: ArticleRow[] = []
    let total = 0

    if (useServiceRole && supabaseUrl && serviceRoleKey) {
      const supabase = createClient(supabaseUrl, serviceRoleKey)
      const now = new Date().toISOString()
      let countQuery = supabase
        .from('article')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published')
        .not('published_at', 'is', null)
        .lte('published_at', now)
      let dataQuery = supabase
        .from('article')
        .select(ARTICLE_SELECT)
        .eq('status', 'published')
        .not('published_at', 'is', null)
        .lte('published_at', now)
        .order('published_at', { ascending: false })
        .range(offset, offset + limit - 1)

      const term = search?.trim().replace(/,/g, '')
      const pattern = term ? `%${term}%` : ''
      if (pattern) {
        const orFilter = `title.ilike.${pattern},summary.ilike.${pattern},content.ilike.${pattern}`
        countQuery = countQuery.or(orFilter)
        dataQuery = dataQuery.or(orFilter)
      }

      const [countRes, dataRes] = await Promise.all([countQuery, dataQuery])
      total = countRes.count ?? 0
      articles = (dataRes.data ?? []) as unknown as ArticleRow[]
      if (dataRes.error) {
        console.error('[api/blog/articles]', dataRes.error)
        articles = []
      }
    } else {
      const result = await getPublishedArticlesPaginated(limit, offset, search)
      articles = result.articles
      total = result.total
    }

    if (articles.length === 0 && total === 0) {
      console.warn(
        '[api/blog/articles] 0 articles. Check: 1) Run UPDATE in scripts/article_publish_example.sql in Supabase. 2) SUPABASE_SERVICE_ROLE_KEY in .env. 3) RLS policy "Anyone can select published articles" if not using service role.'
      )
    }
    const res = NextResponse.json({ articles, total })
    res.headers.set('X-Blog-Articles-Count', String(articles.length))
    res.headers.set('X-Blog-Use-Service-Role', useServiceRole ? '1' : '0')
    return res
  } catch (err) {
    console.error('[api/blog/articles]', err)
    return NextResponse.json({ articles: [], total: 0 }, { status: 200 })
  }
}
