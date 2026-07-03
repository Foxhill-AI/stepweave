'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Modal from './ui/Modal'
import {
  acceptAll,
  rejectNonEssential,
  setConsent,
  hasResponded,
  getConsent,
  OPEN_COOKIE_SETTINGS_EVENT,
} from '@/lib/cookieConsent'
import '../styles/CookieConsentBanner.css'

export default function CookieConsentBanner() {
  const [mounted, setMounted] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [functional, setFunctional] = useState(false)
  const [marketing, setMarketing] = useState(false)

  useEffect(() => {
    setMounted(true)
    setBannerVisible(!hasResponded())

    const onOpen = () => {
      const current = getConsent()
      setAnalytics(current?.analytics ?? false)
      setFunctional(current?.functional ?? false)
      setMarketing(current?.marketing ?? false)
      setModalOpen(true)
    }
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, onOpen)
  }, [])

  if (!mounted) return null

  const handleAcceptAll = () => {
    acceptAll()
    setBannerVisible(false)
    setModalOpen(false)
  }

  const handleRejectAll = () => {
    rejectNonEssential()
    setBannerVisible(false)
    setModalOpen(false)
  }

  const handleCustomize = () => {
    const current = getConsent()
    setAnalytics(current?.analytics ?? false)
    setFunctional(current?.functional ?? false)
    setMarketing(current?.marketing ?? false)
    setModalOpen(true)
  }

  const handleSavePrefs = () => {
    setConsent({ analytics, functional, marketing })
    setBannerVisible(false)
    setModalOpen(false)
  }

  return (
    <>
      {bannerVisible && !modalOpen && (
        <div
          className="cookie-banner"
          role="dialog"
          aria-live="polite"
          aria-label="Cookie consent"
        >
          <div className="cookie-banner-inner">
            <div className="cookie-banner-text">
              <strong>We use cookies</strong>
              <p>
                Essential cookies make Step Weave work. With your consent, we also use analytics,
                functional, and marketing cookies to improve the site and personalize content. See
                our <Link href="/cookies">Cookie Policy</Link> for details.
              </p>
            </div>
            <div className="cookie-banner-actions">
              <button
                type="button"
                className="cookie-btn cookie-btn-secondary"
                onClick={handleCustomize}
              >
                Customize
              </button>
              <button
                type="button"
                className="cookie-btn cookie-btn-secondary"
                onClick={handleRejectAll}
              >
                Reject non-essential
              </button>
              <button
                type="button"
                className="cookie-btn cookie-btn-primary"
                onClick={handleAcceptAll}
              >
                Accept all
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Cookie Settings">
        <div className="cookie-settings">
          <p className="cookie-settings-intro">
            Choose which cookies you accept. Essential cookies are always active because the site
            cannot function without them. See our <Link href="/cookies">Cookie Policy</Link> for
            the full list.
          </p>

          <div className="cookie-category">
            <div className="cookie-category-row">
              <label className="cookie-category-label">
                <input type="checkbox" checked disabled aria-disabled="true" readOnly />
                <span>Essential</span>
              </label>
              <span className="cookie-category-locked">Always on</span>
            </div>
            <p className="cookie-category-desc">
              Required for login, cart, checkout, and security. Cannot be disabled.
            </p>
          </div>

          <div className="cookie-category">
            <label className="cookie-category-label">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
              />
              <span>Analytics &amp; Performance</span>
            </label>
            <p className="cookie-category-desc">
              Helps us understand how the site is used so we can improve it. Aggregated and
              anonymized.
            </p>
          </div>

          <div className="cookie-category">
            <label className="cookie-category-label">
              <input
                type="checkbox"
                checked={functional}
                onChange={(e) => setFunctional(e.target.checked)}
              />
              <span>Functional</span>
            </label>
            <p className="cookie-category-desc">
              Remembers preferences like language, layout, and recently viewed designs.
            </p>
          </div>

          <div className="cookie-category">
            <label className="cookie-category-label">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
              />
              <span>Marketing &amp; Advertising</span>
            </label>
            <p className="cookie-category-desc">
              Used to show relevant ads and measure campaign performance.
            </p>
          </div>

          <div className="cookie-settings-actions">
            <button
              type="button"
              className="cookie-btn cookie-btn-secondary"
              onClick={handleRejectAll}
            >
              Reject non-essential
            </button>
            <button
              type="button"
              className="cookie-btn cookie-btn-secondary"
              onClick={handleAcceptAll}
            >
              Accept all
            </button>
            <button
              type="button"
              className="cookie-btn cookie-btn-primary"
              onClick={handleSavePrefs}
            >
              Save preferences
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
