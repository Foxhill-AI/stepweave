'use client'

import { useState } from 'react'
import { ArrowUp, Facebook, Twitter, Instagram, Linkedin, Mail, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { subscribeNewsletter } from '@/lib/supabaseClient'
import { isBlogEnabled } from '@/lib/blogConfig'
import '../styles/Footer.css'

export default function Footer() {
  const [email, setEmail] = useState('')
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [newsletterMessage, setNewsletterMessage] = useState('')
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    about: false,
    help: false,
    legal: false,
    connect: false,
  })

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setNewsletterStatus('loading')
    setNewsletterMessage('')
    const { ok, error } = await subscribeNewsletter(email)
    if (ok) {
      setNewsletterStatus('success')
      setNewsletterMessage('Thanks! Check your inbox to confirm.')
      setEmail('')
    } else {
      setNewsletterStatus('error')
      setNewsletterMessage(error ?? 'Something went wrong. Try again.')
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  return (
    <>
      {/* Back to Top Section */}
      <div className="footer-back-to-top">
        <div className="footer-back-to-top-container">
          <button
            onClick={scrollToTop}
            className="back-to-top-button"
            aria-label="Back to top"
          >
            <div className="back-to-top-logo">
              <span className="back-to-top-letter">S</span>
            </div>
            <ArrowUp size={18} aria-hidden="true" />
            <span>Back to Top</span>
          </button>
        </div>
      </div>

      <footer className="footer" role="contentinfo">
        <div className="footer-container">
          <div className="footer-top">
            {/* Desktop: Normal layout */}
            <div className="footer-section footer-section-desktop">
              <h3 className="footer-section-title">About StepWeave</h3>
              <ul className="footer-links">
                <li>
                  <Link href="/about" className="footer-link">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="/careers" className="footer-link">
                    Careers
                  </Link>
                </li>
                <li>
                  <Link href="/press" className="footer-link">
                    Press
                  </Link>
                </li>
                {isBlogEnabled() && (
                  <li>
                    <Link href="/blog" className="footer-link">
                      Blog
                    </Link>
                  </li>
                )}
              </ul>
            </div>

            <div className="footer-section footer-section-desktop">
              <h3 className="footer-section-title">Help & Support</h3>
              <ul className="footer-links">
                <li>
                  <Link href="/help" className="footer-link">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link href="/faq" className="footer-link">
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="footer-link">
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link href="/feedback" className="footer-link">
                    Send Feedback
                  </Link>
                </li>
              </ul>
            </div>

            <div className="footer-section footer-section-desktop">
              <h3 className="footer-section-title">Legal</h3>
              <ul className="footer-links">
                <li>
                  <Link href="/terms" className="footer-link">
                    Terms of Use
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="footer-link">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/cookies" className="footer-link">
                    Cookie Policy
                  </Link>
                </li>
                <li>
                  <Link href="/guidelines" className="footer-link">
                    Community Guidelines
                  </Link>
                </li>
              </ul>
            </div>

            <div className="footer-section footer-section-desktop">
              <h3 className="footer-section-title">Connect</h3>
              <div className="footer-social">
                <Link
                  href="https://facebook.com"
                  className="footer-social-link"
                  aria-label="Facebook"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Facebook size={20} aria-hidden="true" />
                </Link>
                <Link
                  href="https://twitter.com"
                  className="footer-social-link"
                  aria-label="Twitter"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Twitter size={20} aria-hidden="true" />
                </Link>
                <Link
                  href="https://instagram.com"
                  className="footer-social-link"
                  aria-label="Instagram"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Instagram size={20} aria-hidden="true" />
                </Link>
                <Link
                  href="https://linkedin.com"
                  className="footer-social-link"
                  aria-label="LinkedIn"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Linkedin size={20} aria-hidden="true" />
                </Link>
              </div>

              <div className="footer-newsletter">
                <p className="newsletter-label">Subscribe to our newsletter</p>
                <form onSubmit={handleNewsletterSubmit} className="newsletter-form">
                  <input
                    type="email"
                    placeholder="Your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="newsletter-input"
                    aria-label="Newsletter email"
                    required
                  />
                  <button type="submit" className="newsletter-button" aria-label="Subscribe to newsletter">
                    <Mail size={18} aria-hidden="true" />
                  </button>
                </form>
              </div>
            </div>

            {/* Mobile: Collapsible sections */}
            <div className="footer-section footer-section-mobile">
              <button
                className="footer-section-header-mobile"
                onClick={() => toggleSection('about')}
                aria-expanded={expandedSections.about}
              >
                <h3 className="footer-section-title">About StepWeave</h3>
                {expandedSections.about ? (
                  <ChevronUp size={18} aria-hidden="true" />
                ) : (
                  <ChevronDown size={18} aria-hidden="true" />
                )}
              </button>
              {expandedSections.about && (
                <ul className="footer-links">
                  <li>
                    <Link href="/about" className="footer-link">
                      About Us
                    </Link>
                  </li>
                  <li>
                    <Link href="/careers" className="footer-link">
                      Careers
                    </Link>
                  </li>
                  <li>
                    <Link href="/press" className="footer-link">
                      Press
                    </Link>
                  </li>
                  {isBlogEnabled() && (
                    <li>
                      <Link href="/blog" className="footer-link">
                        Blog
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </div>

            <div className="footer-section footer-section-mobile">
              <button
                className="footer-section-header-mobile"
                onClick={() => toggleSection('help')}
                aria-expanded={expandedSections.help}
              >
                <h3 className="footer-section-title">Help & Support</h3>
                {expandedSections.help ? (
                  <ChevronUp size={18} aria-hidden="true" />
                ) : (
                  <ChevronDown size={18} aria-hidden="true" />
                )}
              </button>
              {expandedSections.help && (
                <ul className="footer-links">
                  <li>
                    <Link href="/help" className="footer-link">
                      Help Center
                    </Link>
                  </li>
                  <li>
                    <Link href="/faq" className="footer-link">
                      FAQ
                    </Link>
                  </li>
                  <li>
                    <Link href="/contact" className="footer-link">
                      Contact Us
                    </Link>
                  </li>
                  <li>
                    <Link href="/feedback" className="footer-link">
                      Send Feedback
                    </Link>
                  </li>
                </ul>
              )}
            </div>

            <div className="footer-section footer-section-mobile">
              <button
                className="footer-section-header-mobile"
                onClick={() => toggleSection('legal')}
                aria-expanded={expandedSections.legal}
              >
                <h3 className="footer-section-title">Legal</h3>
                {expandedSections.legal ? (
                  <ChevronUp size={18} aria-hidden="true" />
                ) : (
                  <ChevronDown size={18} aria-hidden="true" />
                )}
              </button>
              {expandedSections.legal && (
                <ul className="footer-links">
                  <li>
                    <Link href="/terms" className="footer-link">
                      Terms of Use
                    </Link>
                  </li>
                  <li>
                    <Link href="/privacy" className="footer-link">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/cookies" className="footer-link">
                      Cookie Preferences
                    </Link>
                  </li>
                  <li>
                    <Link href="/accessibility" className="footer-link">
                      Accessibility
                    </Link>
                  </li>
                  <li>
                    <Link href="/guidelines" className="footer-link">
                      Community Guidelines
                    </Link>
                  </li>
                </ul>
              )}
            </div>

            <div className="footer-section footer-section-mobile">
              <button
                className="footer-section-header-mobile"
                onClick={() => toggleSection('connect')}
                aria-expanded={expandedSections.connect}
              >
                <h3 className="footer-section-title">Connect</h3>
                {expandedSections.connect ? (
                  <ChevronUp size={18} aria-hidden="true" />
                ) : (
                  <ChevronDown size={18} aria-hidden="true" />
                )}
              </button>
              {expandedSections.connect && (
                <>
                  <div className="footer-social">
                    <Link
                      href="https://facebook.com"
                      className="footer-social-link"
                      aria-label="Facebook"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Facebook size={20} aria-hidden="true" />
                    </Link>
                    <Link
                      href="https://twitter.com"
                      className="footer-social-link"
                      aria-label="Twitter"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Twitter size={20} aria-hidden="true" />
                    </Link>
                    <Link
                      href="https://instagram.com"
                      className="footer-social-link"
                      aria-label="Instagram"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Instagram size={20} aria-hidden="true" />
                    </Link>
                    <Link
                      href="https://linkedin.com"
                      className="footer-social-link"
                      aria-label="LinkedIn"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Linkedin size={20} aria-hidden="true" />
                    </Link>
                  </div>

                  <div className="footer-newsletter">
                    <p className="newsletter-label">Subscribe to our newsletter</p>
                    <form onSubmit={handleNewsletterSubmit} className="newsletter-form">
                      <input
                        type="email"
                        placeholder="Your email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setNewsletterStatus('idle') }}
                        className="newsletter-input"
                        aria-label="Newsletter email"
                        required
                        disabled={newsletterStatus === 'loading'}
                      />
                      <button type="submit" className="newsletter-button" aria-label="Subscribe to newsletter" disabled={newsletterStatus === 'loading'}>
                        <Mail size={18} aria-hidden="true" />
                      </button>
                    </form>
                    {newsletterMessage && (
                      <p className={`newsletter-message newsletter-message--${newsletterStatus}`} role="status">
                        {newsletterMessage}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="footer-bottom">
            <p className="footer-copyright">
              © {new Date().getFullYear()} StepWeave. All rights reserved.
            </p>
            <div className="footer-legal-links">
              <Link href="/terms" className="footer-legal-link">
                Terms of Use
              </Link>
              <span className="footer-legal-divider">•</span>
              <Link href="/privacy" className="footer-legal-link">
                Privacy Policy
              </Link>
              <span className="footer-legal-divider">•</span>
              <Link href="/cookies" className="footer-legal-link">
                Cookie Preferences
              </Link>
              <span className="footer-legal-divider">•</span>
              <Link href="/accessibility" className="footer-legal-link">
                Accessibility
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
