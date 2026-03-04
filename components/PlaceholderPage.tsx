'use client'

import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import '@/app/homepage.css'

type Props = { title: string }

export default function PlaceholderPage({ title }: Props) {
  return (
    <div className="homepage">
      <Navbar />
      <Subnavbar />
      <main className="homepage-main" style={{ padding: '3rem 1.5rem', textAlign: 'center' }} role="main">
        <h1 style={{ marginBottom: '0.5rem' }}>{title}</h1>
        <p style={{ color: 'var(--text-secondary, #666)', marginBottom: '1.5rem' }}>This page is coming soon.</p>
        <Link href="/" className="footer-link" style={{ textDecoration: 'underline' }}>Back to home</Link>
        {' · '}
        <Link href="/contact" className="footer-link" style={{ textDecoration: 'underline' }}>Contact us</Link>
      </main>
      <Footer />
    </div>
  )
}
