import { notFound } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { getArticleBySlug } from '@/lib/supabaseClient'
import type { Metadata } from 'next'
import '../../homepage.css'

const ARTICLE_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/** Revalidate cached article page every 60s (ISR). */
export const revalidate = 60

function formatArticleDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) return { title: 'Article not found' }
  const title = article.seo_title?.trim() || article.title
  const description = article.seo_description?.trim() || article.summary?.trim() || undefined
  const url = `${ARTICLE_BASE_URL}/blog/${article.slug}`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      publishedTime: article.published_at ?? undefined,
      url,
    },
  }
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) notFound()

  const author = article.user_account?.username ?? 'Unknown'
  const date = formatArticleDate(article.published_at)

  return (
    <div className="homepage">
      <Navbar />
      <main className="homepage-main" role="main">
        <article className="container" style={{ maxWidth: '720px', margin: '0 auto', padding: 'var(--spacing-xl) var(--spacing-md)' }}>
          <p style={{ marginBottom: 'var(--spacing-sm)' }}>
            <Link href="/blog" style={{ color: 'var(--color-primary)' }}>← Back to Blog</Link>
          </p>
          <header style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '0 0 var(--spacing-md)' }}>
              {article.seo_title?.trim() || article.title}
            </h1>
            <p style={{ color: 'var(--color-text-light)', fontSize: '0.9375rem', margin: 0 }}>
              By {author} · {date}
            </p>
          </header>
          {article.summary && (
            <p style={{ fontSize: '1.125rem', color: 'var(--color-text-light)', marginBottom: 'var(--spacing-lg)' }}>
              {article.summary}
            </p>
          )}
          <div
            className="blog-article-body"
            dangerouslySetInnerHTML={{ __html: article.content }}
            style={{
              lineHeight: 1.7,
              fontSize: '1.0625rem',
            }}
          />
        </article>
      </main>
      <Footer />
    </div>
  )
}
