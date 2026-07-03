'use client'

import { useState } from 'react'
import { Facebook, Twitter, Instagram, Linkedin, Mail, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { subscribeNewsletter } from '@/lib/supabaseClient'
import { isBlogEnabled } from '@/lib/blogConfig'
import { openCookieSettings } from '@/lib/cookieConsent'
import '../styles/Footer.css'

export default function Footer() {
  const [email, setEmail] = useState('')
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [newsletterMessage, setNewsletterMessage] = useState('')
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    about: false,
    help: false,
    connect: false,
    newsletter: false,
  })

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setNewsletterStatus('loading')
    setNewsletterMessage('')
    const { ok, error, alreadySubscribed } = await subscribeNewsletter(email)
    if (ok) {
      setNewsletterStatus('success')
      setNewsletterMessage(
        alreadySubscribed
          ? 'Este correo ya está registrado.'
          : '¡Gracias! Tu registro fue exitoso. Revisa tu bandeja para confirmar.'
      )
      if (!alreadySubscribed) setEmail('')
    } else {
      setNewsletterStatus('error')
      setNewsletterMessage(error ?? 'Algo salió mal. Inténtalo de nuevo.')
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
            aria-label="Back to the top"
          >
            <span>Back to the top</span>
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
                  <Link href="/contact" className="footer-link">
                    Contact Us
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
            </div>

            <div className="footer-section footer-section-desktop">
              <h3 className="footer-section-title">Newsletter</h3>
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
                    <Link href="/contact" className="footer-link">
                      Contact Us
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
              )}
            </div>

            <div className="footer-section footer-section-mobile">
              <button
                className="footer-section-header-mobile"
                onClick={() => toggleSection('newsletter')}
                aria-expanded={expandedSections.newsletter}
              >
                <h3 className="footer-section-title">Newsletter</h3>
                {expandedSections.newsletter ? (
                  <ChevronUp size={18} aria-hidden="true" />
                ) : (
                  <ChevronDown size={18} aria-hidden="true" />
                )}
              </button>
              {expandedSections.newsletter && (
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
                Cookie Policy
              </Link>
              <span className="footer-legal-divider">•</span>
              <button
                type="button"
                className="footer-legal-link"
                onClick={openCookieSettings}
              >
                Cookie Settings
              </button>
              <span className="footer-legal-divider">•</span>
              <Link href="/accessibility" className="footer-legal-link">
                Accessibility
              </Link>
              <span className="footer-legal-divider">•</span>
              <Link href="/guidelines" className="footer-legal-link">
                Community Guidelines
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
