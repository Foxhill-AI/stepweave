import Link from 'next/link'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import '../homepage.css'
import './help.css'

export const metadata: Metadata = {
  title: 'Help Center | Step Weave',
  description:
    'Step Weave Help Center — answers to common questions about ordering, returns, and the design tool.',
}

export default function HelpPage() {
  return (
    <div className="homepage">
      <Navbar />
      <Subnavbar />
      <main className="homepage-main" role="main">
        <article className="help-page help-index">
          <h1 className="help-page-title">Help Center</h1>
          <p className="help-page-intro">
            Answers to the questions we hear most often. Pick a category below, or scroll to
            the bottom to contact us directly.
          </p>

          <div className="help-categories">
            <Link href="/help/getting-started" className="help-category-card">
              <h2 className="help-category-title">Getting started</h2>
              <p className="help-category-desc">
                Accounts, signing in, password resets, and a quick tour of the site.
              </p>
            </Link>

            <Link href="/help/orders" className="help-category-card">
              <h2 className="help-category-title">Orders &amp; shipping</h2>
              <p className="help-category-desc">
                Placing orders, tracking, production time vs. shipping time, and what to do if
                something goes wrong.
              </p>
            </Link>

            <Link href="/help/returns" className="help-category-card">
              <h2 className="help-category-title">Returns &amp; refunds</h2>
              <p className="help-category-desc">
                What&apos;s eligible for return, how to request a refund, and why made-to-order
                products are different.
              </p>
            </Link>

            <Link href="/help/design-tool" className="help-category-card">
              <h2 className="help-category-title">The design tool</h2>
              <p className="help-category-desc">
                Designing your first product, writing AI prompts that work, and adjusting
                placement.
              </p>
            </Link>
          </div>

          <div className="help-contact-block">
            <h2>Still need help?</h2>
            <p>
              If you can&apos;t find what you&apos;re looking for, send us a message — we read
              every one.
            </p>
            <p>
              <Link href="/contact">Contact us</Link> · For legal, IP, or privacy questions,
              email <a href="mailto:legal@stepweave.com">legal@stepweave.com</a>.
            </p>
          </div>

          <div className="help-footer-note">
            <p>
              <strong>Looking for our policies?</strong>
            </p>
            <ul className="help-policies-list">
              <li>
                <Link href="/terms">Terms of Use</Link>
              </li>
              <li>
                <Link href="/privacy">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/cookies">Cookie Policy</Link>
              </li>
              <li>
                <Link href="/guidelines">Community Guidelines</Link>
              </li>
              <li>
                <Link href="/accessibility">Accessibility</Link>
              </li>
            </ul>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  )
}
