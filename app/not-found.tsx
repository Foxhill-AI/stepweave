import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export default function NotFound() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', textAlign: 'center' }}>
        <p style={{ fontSize: '6rem', fontWeight: 700, lineHeight: 1, margin: '0 0 0.5rem', color: 'var(--color-primary, #0066cc)' }}>404</p>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.75rem' }}>Page not found</h1>
        <p style={{ color: '#666', marginBottom: '2rem', maxWidth: '360px' }}>
          We couldn&apos;t find what you were looking for. It may have been moved or deleted.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link
            href="/"
            style={{ background: 'var(--color-primary, #0066cc)', color: '#fff', padding: '0.65rem 1.5rem', borderRadius: '6px', fontWeight: 600, textDecoration: 'none' }}
          >
            Go home
          </Link>
          <Link
            href="/marketplace"
            style={{ border: '1.5px solid #ccc', padding: '0.65rem 1.5rem', borderRadius: '6px', fontWeight: 600, textDecoration: 'none', color: 'inherit' }}
          >
            Browse shoes
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
