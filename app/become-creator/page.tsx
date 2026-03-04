'use client'

import { useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import { useAuth } from '@/components/AuthProvider'
import { Check, Palette, Zap } from 'lucide-react'
import '@/styles/pricing.css'
import '@/styles/become-creator.css'

const CREATOR_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$9',
    period: 'month',
    designCredits: '20 design credits/month',
    profitShare: '80% creator share',
    description: 'Ideal for getting started. Publish designs and grow your audience.',
    features: [
      '20 design credits per month',
      '80% profit share on sales',
      'Product creation & Design Tool access',
      'Up to 50 active products',
      'Basic analytics',
      'Community support',
    ],
    cta: 'Subscribe',
    recommended: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$29',
    period: 'month',
    designCredits: 'Unlimited design credits',
    profitShare: '85% creator share',
    description: 'For professional creators. Scale with unlimited credits and higher share.',
    features: [
      'Unlimited design credits',
      '85% profit share on sales',
      'Everything in Starter',
      'Unlimited active products',
      'Advanced analytics',
      'Priority support',
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
    try {
      const res = await fetch('/api/checkout-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
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
              Subscribe to a creator plan to publish products, use the Design Tool, and earn from your designs.
            </p>
            <ul className="become-creator-benefits">
              <li><strong>Design credits</strong> — Create and publish products each month</li>
              <li><strong>Profit share</strong> — Earn a percentage of every sale</li>
              <li><strong>Design Tool</strong> — Full access to create and edit products</li>
              <li><strong>Creator dashboard</strong> — Manage products and view performance</li>
            </ul>
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
              {userAccount.subscription_tier && userAccount.subscription_tier !== 'free' && (
                <p className="become-creator-current" role="status">
                  Your plan: <strong>{String(userAccount.subscription_tier).charAt(0).toUpperCase() + String(userAccount.subscription_tier).slice(1)}</strong>
                  {' · '}
                  <Link href="/profile?tab=products">Go to your products</Link>
                </p>
              )}
              {error && (
                <p className="become-creator-error" role="alert">
                  {error}
                </p>
              )}
              <div className="become-creator-cards">
                {CREATOR_TIERS.map((plan) => {
                  const isCurrent = userAccount.subscription_tier === plan.id
                  return (
                    <div
                      key={plan.id}
                      className={`become-creator-card ${plan.recommended ? 'become-creator-card-recommended' : ''} ${isCurrent ? 'become-creator-card-current' : ''}`}
                    >
                      {plan.recommended && (
                        <div className="become-creator-badge">RECOMMENDED</div>
                      )}
                      {isCurrent && (
                        <div className="become-creator-badge become-creator-badge-current">CURRENT PLAN</div>
                      )}
                      <div className="become-creator-card-header">
                        <h2 className="become-creator-card-name">{plan.name}</h2>
                        <div className="become-creator-card-price">
                          <span className="become-creator-price-amount">{plan.price}</span>
                          <span className="become-creator-price-period">/{plan.period}</span>
                        </div>
                        <p className="become-creator-card-credits">{plan.designCredits}</p>
                        <p className="become-creator-card-share">{plan.profitShare}</p>
                      </div>
                      <p className="become-creator-card-description">{plan.description}</p>
                      <ul className="become-creator-features">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="become-creator-feature">
                            <Check size={16} className="become-creator-feature-icon" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className={`become-creator-cta ${plan.recommended ? 'become-creator-cta-recommended' : ''}`}
                        onClick={() => handleSubscribe(plan.id)}
                        disabled={submitting !== null || isCurrent}
                        aria-label={`Subscribe to ${plan.name}`}
                      >
                        {submitting === plan.id ? 'Redirecting…' : isCurrent ? 'Current plan' : plan.cta}
                      </button>
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
