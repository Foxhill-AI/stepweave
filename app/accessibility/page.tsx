import Link from 'next/link'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import '../homepage.css'
import './accessibility.css'

export const metadata: Metadata = {
  title: 'Accessibility | Step Weave',
  description:
    'Step Weave is committed to making our marketplace and design tools accessible to everyone, including users with disabilities.',
}

export default function AccessibilityPage() {
  return (
    <div className="homepage">
      <Navbar />
      <Subnavbar />
      <main className="homepage-main" role="main">
        <article className="accessibility-page">
          <h1 className="accessibility-page-title">Accessibility Statement</h1>
          <p className="accessibility-page-meta">
            <strong>Last updated:</strong> May 2026
          </p>

          <p className="accessibility-page-intro">
            Step Weave is committed to making our marketplace and design tools usable by everyone,
            including people with disabilities. We believe that creative tools should be available
            to as wide an audience as possible, and we work to remove barriers wherever we can.
          </p>

          <hr />

          <section className="accessibility-section">
            <h2>Our standard</h2>
            <p>
              We aim to conform to the{' '}
              <a
                href="https://www.w3.org/TR/WCAG21/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Web Content Accessibility Guidelines (WCAG) 2.1 Level AA
              </a>
              . These guidelines explain how to make web content more accessible for people with a
              wide range of disabilities — including visual, auditory, cognitive, and motor
              impairments — and more usable for everyone.
            </p>
          </section>

          <hr />

          <section className="accessibility-section">
            <h2>What we&apos;ve done</h2>
            <p>The site is designed with the following in mind:</p>
            <ul>
              <li>Semantic HTML and ARIA landmarks so screen readers can navigate pages.</li>
              <li>Keyboard navigation for menus, forms, and buttons.</li>
              <li>Descriptive labels and alternative text for interactive elements.</li>
              <li>Color contrast that meets WCAG AA for text and essential UI.</li>
              <li>Forms with visible labels and clear error messages.</li>
            </ul>
          </section>

          <hr />

          <section className="accessibility-section">
            <h2>Known limitations</h2>
            <p>
              We&apos;re a small team and we won&apos;t pretend the site is perfect. Areas we know
              still need work:
            </p>
            <ul>
              <li>
                <strong>AI-generated design previews</strong> may not always have descriptive
                alternative text — we&apos;re working on automated descriptions for these.
              </li>
              <li>
                <strong>The visual design tool</strong> involves drag-and-drop placement that is
                difficult to use without sight. We have not yet built a fully accessible
                alternative for arranging designs on products.
              </li>
              <li>
                <strong>Third-party content</strong> (creator-uploaded images, Printful mockups,
                embedded payment forms) may not always meet our standard. We rely on creators to
                describe their listings and on our partners to maintain their own accessibility.
              </li>
            </ul>
            <p>
              If you run into something else that doesn&apos;t work for you, we want to hear about
              it.
            </p>
          </section>

          <hr />

          <section className="accessibility-section">
            <h2>Contact us</h2>
            <p>
              If you have trouble using any part of Step Weave, or if you&apos;d like to request
              content in an alternative format, email us at{' '}
              <a href="mailto:stepweave_admin@foxhillai.com">stepweave_admin@foxhillai.com</a>. Please tell us:
            </p>
            <ul>
              <li>The page or feature you were using (a URL is helpful)</li>
              <li>The assistive technology or browser you were using, if any</li>
              <li>What you expected to happen and what happened instead</li>
            </ul>
            <p>We aim to respond to accessibility inquiries within 5 business days.</p>
          </section>

          <p className="accessibility-footer-note">
            This statement applies to <a href="https://www.stepweave.com">www.stepweave.com</a>.
            For our broader policies, see our <Link href="/terms">Terms of Use</Link>,{' '}
            <Link href="/privacy">Privacy Policy</Link>, and{' '}
            <Link href="/guidelines">Community Guidelines</Link>.
          </p>
        </article>
      </main>
      <Footer />
    </div>
  )
}
