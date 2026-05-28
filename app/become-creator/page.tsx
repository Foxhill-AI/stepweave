'use client'

import { useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import { useAuth } from '@/components/AuthProvider'
import { Check, Palette } from 'lucide-react'
import '@/styles/pricing.css'
import '@/styles/become-creator.css'

const CREATOR_TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'month',
    credits: 20,
    share: 15,
    description: 'Start designing and selling with no upfront cost.',
    features: [
      'Design Tool access',
      'Sell on the marketplace',
      'Basic analytics',
    ],
    cta: null, // already on free
    recommended: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '$9',
    period: 'month',
    credits: 50,
    share: 50,
    description: 'More credits and a bigger cut of every sale.',
    features: [
      'Everything in Free',
      'Priority support',
    ],
    cta: 'Subscribe',
    recommended: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$29',
    period: 'month',
    credits: 300,
    share: 90,
    description: 'For serious creators who want maximum earnings.',
    features: [
      'Everything in Starter',
      'Early access to new tools',
    ],
    cta: 'Subscribe',
    recommended: true,
  },
]

export default function BecomeCreatorPage() {
  const { user, userAccount, loading } = useAuth()
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubscribe = async (tier: string) => {
    if (!user) return
    setError(null)
    setSubmitting(tier)
    // Preserve return path so user lands back where they came from after upgrade.
    const returnParam = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('return') ?? ''
      : ''
    const returnPath = returnParam.startsWith('/') && !returnParam.includes('://') ? returnParam : ''
    try {
      const res = await fetch('/api/checkout-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, returnPath: returnPath || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not start subscription')
        setSubmitting(null)
        return
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
      setError('Invalid response from server')
    } catch {
      setError('Network error. Please try again.')
    }
    setSubmitting(null)
  }

  return (
    <div className="pricing-page-wrapper">
      <Navbar />
      <Subnavbar />
      <main className="become-creator-main" role="main">
        <div className="become-creator-container">
          <header className="become-creator-header">
            <div className="become-creator-header-icon">
              <Palette size={40} aria-hidden />
            </div>
            <h1 className="become-creator-title">Become a Creator</h1>
            <p className="become-creator-subtitle">
              Design custom shoes, list them on the marketplace, and earn a share of every sale.
            </p>
          </header>

          {!loading && !user && (
            <div className="become-creator-auth-prompt">
              <p>Sign in to subscribe and start creating.</p>
              <Link href="/" className="become-creator-auth-link">
                Sign in or create an account
              </Link>
            </div>
          )}

          {user && userAccount && (
            <>
              {error && (
                <p className="become-creator-error" role="alert">{error}</p>
              )}
              <div className="become-creator-cards">
                {CREATOR_TIERS.map((plan) => {
                  const isCurrent = (userAccount.subscription_tier ?? 'free') === plan.id
                  return (
                    <div
                      key={plan.id}
                      className={`become-creator-card${plan.recommended ? ' become-creator-card-recommended' : ''}${isCurrent ? ' become-creator-card-current' : ''}`}
                    >
                      {plan.recommended && !isCurrent && (
                        <div className="become-creator-badge">BEST VALUE</div>
                      )}
                      {isCurrent && (
                        <div className="become-creator-badge become-creator-badge-current">YOUR PLAN</div>
                      )}

                      <h2 className="become-creator-card-name">{plan.name}</h2>
                      <div className="become-creator-card-price">
                        <span className="become-creator-price-amount">{plan.price}</span>
                        <span className="become-creator-price-period">/{plan.period}</span>
                      </div>
                      <p className="become-creator-card-description">{plan.description}</p>

                      <div className="become-creator-stats">
                        <div className="become-creator-stat">
                          <span className="become-creator-stat-value">{plan.credits}</span>
                          <span className="become-creator-stat-label">design credits/mo</span>
                        </div>
                        <div className="become-creator-stat-divider" aria-hidden />
                        <div className="become-creator-stat">
                          <span className="become-creator-stat-value">{plan.share}%</span>
                          <span className="become-creator-stat-label">creator share</span>
                        </div>
                      </div>

                      <ul className="become-creator-features">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="become-creator-feature">
                            <Check size={15} className="become-creator-feature-icon" aria-hidden />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      {plan.cta && (
                        <button
                          type="button"
                          className={`become-creator-cta${plan.recommended ? ' become-creator-cta-recommended' : ''}`}
                          onClick={() => handleSubscribe(plan.id)}
                          disabled={submitting !== null || isCurrent}
                        >
                          {submitting === plan.id ? 'Redirecting…' : isCurrent ? 'Current plan' : plan.cta}
                        </button>
                      )}
                      {!plan.cta && !isCurrent && (
                        <p className="become-creator-free-note">You&apos;re already on this plan.</p>
                      )}
                      {!plan.cta && isCurrent && (
                        <Link href="/profile?tab=products" className="become-creator-cta become-creator-cta-ghost">
                          Go to your products
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {!loading && user && !userAccount && (
            <p className="become-creator-error">Could not load account. Please refresh the page.</p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
