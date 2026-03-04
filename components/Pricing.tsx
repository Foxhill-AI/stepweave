'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import '../styles/pricing.css'

function PricingInner() {
  const searchParams = useSearchParams()
  const { user, userAccount, refreshUserAccount } = useAuth()
  const currentTier = userAccount?.subscription_tier ?? 'free'
  const [submitting, setSubmitting] = useState<string | null>(null)
  const syncedSessionIdRef = useRef<string | null>(null)
  const settingsSubscriptionUrl = '/profile?tab=settings&sub=subscription'

  useEffect(() => {
    if (user?.id) refreshUserAccount()
  }, [user?.id])

  useEffect(() => {
    const subscription = searchParams.get('subscription')
    const sessionId = searchParams.get('session_id')
    if (subscription !== 'success' || !sessionId || !user?.id || syncedSessionIdRef.current === sessionId) return
    syncedSessionIdRef.current = sessionId
    fetch('/api/subscription/sync-after-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (data?.ok) refreshUserAccount()
      })
      .catch(() => {})
  }, [searchParams, user?.id, refreshUserAccount])
  const [error, setError] = useState<string | null>(null)

  const handleSubscribe = async (tier: string) => {
    if (tier === 'free') return
    if (!user) {
      setError('Sign in to subscribe')
      return
    }
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

  const pricingPlans = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      period: 'forever',
      subtitle: 'Free forever',
      description: 'Perfect for exploring and learning. Get started with essential features at no cost.',
      features: [
        '5 GB storage',
        'Basic templates',
        'Community support',
        'Standard quality exports',
        'Up to 10 projects',
      ],
      cta: 'Get Started',
      ctaVariant: 'primary',
      recommended: false,
    },
    {
      id: 'starter',
      name: 'Starter',
      price: '$9',
      period: 'month',
      subtitle: 'Starts at $9/month',
      description: 'Ideal for individual creators and small projects. Unlock more features and resources.',
      features: [
        '50 GB storage',
        'Premium templates',
        'Priority support',
        'High quality exports',
        'Unlimited projects',
        'Advanced customization',
        'Early access to new features',
      ],
      cta: 'Start Free Trial',
      ctaVariant: 'primary',
      recommended: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$29',
      period: 'month',
      subtitle: 'Starts at $29/month',
      description: 'For professional creators and teams. Everything you need to scale your creative work.',
      features: [
        '500 GB storage',
        'All premium templates',
        '24/7 priority support',
        'Ultra high quality exports',
        'Unlimited projects',
        'Team collaboration',
        'Advanced analytics',
        'Custom branding',
        'API access',
        'White-label options',
      ],
      cta: 'Start Free Trial',
      ctaVariant: 'recommended',
      recommended: true,
    },
  ]

  return (
    <main className="pricing-main" role="main">
      <div className="pricing-container">
        {/* Header Section */}
        <div className="pricing-header">
          <h1 className="pricing-title">Pricing</h1>
          <p className="pricing-subtitle">
            Choose the plan that works best for you. All plans include our core features.
          </p>
          {user && (
            <>
              <p className="pricing-current-plan" role="status">
                Your current plan: <strong>{currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}</strong>
              </p>
              <p className="pricing-manage-plan">
                Manage or change plan in <Link href={settingsSubscriptionUrl} className="pricing-manage-link">Settings → Subscription</Link>.
              </p>
            </>
          )}
          {error && (
            <p className="pricing-error" role="alert">
              {error}
              {!user && (
                <> — <Link href="/?openAuth=1" className="pricing-error-link">Sign in</Link></>
              )}
            </p>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="pricing-cards">
          {pricingPlans.map((plan) => (
            <div
              key={plan.id}
              className={`pricing-card ${plan.recommended ? 'pricing-card-recommended' : ''} ${plan.id === currentTier ? 'pricing-card-current' : ''}`}
            >
              {plan.recommended && (
                <div className="pricing-badge">RECOMMENDED</div>
              )}
              {plan.id === currentTier && (
                <div className="pricing-badge pricing-badge-current">CURRENT PLAN</div>
              )}
              <div className="pricing-card-header">
                <h3 className="pricing-card-name">{plan.name}</h3>
                <div className="pricing-card-price">
                  <span className="pricing-price-amount">{plan.price}</span>
                  {plan.period !== 'forever' && (
                    <span className="pricing-price-period">/{plan.period}</span>
                  )}
                </div>
                <p className="pricing-card-subtitle">{plan.subtitle}</p>
              </div>

              <p className="pricing-card-description">{plan.description}</p>

              <ul className="pricing-features">
                {plan.features.map((feature, index) => (
                  <li key={index} className="pricing-feature">
                    <Check size={16} className="pricing-feature-icon" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.id === currentTier ? (
                <button className={`pricing-cta pricing-cta-${plan.ctaVariant}`} disabled aria-label="Current plan">
                  Current plan
                </button>
              ) : plan.id === 'free' ? (
                (currentTier === 'starter' || currentTier === 'pro') && user ? (
                  <Link href={settingsSubscriptionUrl} className={`pricing-cta pricing-cta-${plan.ctaVariant}`} aria-label="Switch to Free plan">
                    Switch to Free
                  </Link>
                ) : (
                  <Link href={user ? '/' : '/?openAuth=1'} className={`pricing-cta pricing-cta-${plan.ctaVariant}`} aria-label={`${plan.cta} for ${plan.name} plan`}>
                    {plan.cta}
                  </Link>
                )
              ) : !user ? (
                <Link href="/?openAuth=1" className={`pricing-cta pricing-cta-${plan.ctaVariant}`} aria-label={`Sign in to subscribe to ${plan.name}`}>
                  Sign in to subscribe
                </Link>
              ) : plan.id === 'starter' && currentTier === 'pro' ? (
                <Link href={settingsSubscriptionUrl} className={`pricing-cta pricing-cta-${plan.ctaVariant}`} aria-label="Downgrade to Starter plan">
                  Downgrade to Starter
                </Link>
              ) : plan.id === 'pro' && currentTier === 'starter' ? (
                <button
                  type="button"
                  className={`pricing-cta pricing-cta-${plan.ctaVariant}`}
                  aria-label="Upgrade to Pro"
                  onClick={() => handleSubscribe('pro')}
                  disabled={!!submitting}
                >
                  {submitting === 'pro' ? 'Redirecting…' : 'Upgrade to Pro'}
                </button>
              ) : (
                <button
                  type="button"
                  className={`pricing-cta pricing-cta-${plan.ctaVariant}`}
                  aria-label={`Subscribe to ${plan.name}`}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={!!submitting}
                >
                  {submitting === plan.id ? 'Redirecting…' : plan.cta}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

export default function Pricing() {
  return (
    <Suspense fallback={<main className="pricing-main" role="main"><div className="pricing-container" /></main>}>
      <PricingInner />
    </Suspense>
  )
}