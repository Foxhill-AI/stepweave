'use client'

import { useState, useEffect } from 'react'
import { User, Mail, Lock, CreditCard, Bell, Pencil, RefreshCw } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { updateUserProfile } from '@/lib/supabaseClient'
import '../styles/SettingsTab.css'

type SubscriptionStatus = {
  subscription_tier: 'free' | 'starter' | 'pro'
  pending_tier: 'starter' | 'free' | null
  current_period_end_at: string | null
  status: 'active' | 'past_due' | 'canceled'
  cancel_at_period_end: boolean
}

interface SettingsTabProps {
  userData?: {
    username?: string
    email?: string
    avatar?: string
    bio?: string
  }
  /** Open this sub-tab on mount (e.g. from /profile?tab=settings&sub=subscription) */
  initialSubTab?: 'profile' | 'account' | 'payments' | 'subscription' | 'privacy'
}

const PRO_FEATURES_LOST_DOWNGRADE = [
  'Unlimited design credits',
  '85% profit share',
  'Unlimited active products',
  'Advanced analytics',
  'Priority support',
  'Early access to new tools',
]

const CREATOR_FEATURES_LOST_CANCEL = [
  'Design Tool access',
  'Publishing products',
  'Creator revenue share',
  'Design credits',
  'Creator dashboard',
]

export default function SettingsTab({ userData, initialSubTab }: SettingsTabProps) {
  const { userAccount, refreshUserAccount } = useAuth()
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'account' | 'payments' | 'subscription' | 'privacy'>(initialSubTab ?? 'profile')
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    username: userData?.username || '',
    bio: userData?.bio || '',
    avatar: userData?.avatar || '',
  })
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null)
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)
  const [subscriptionActionLoading, setSubscriptionActionLoading] = useState(false)
  const [subscriptionMessage, setSubscriptionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [subscriptionModal, setSubscriptionModal] = useState<'downgrade' | 'cancel' | null>(null)

  const [connectLoading, setConnectLoading] = useState(false)
  const [connectMessage, setConnectMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchSubscriptionStatus = async () => {
    setSubscriptionLoading(true)
    setSubscriptionMessage(null)
    try {
      const res = await fetch('/api/subscription/status')
      if (res.ok) {
        const data = await res.json()
        setSubscriptionStatus(data)
      } else {
        setSubscriptionStatus(null)
      }
    } catch {
      setSubscriptionStatus(null)
    }
    setSubscriptionLoading(false)
  }

  useEffect(() => {
    if (activeSubTab === 'subscription') fetchSubscriptionStatus()
  }, [activeSubTab])

  useEffect(() => {
    if (typeof window === 'undefined' || activeSubTab !== 'payments') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('connect') === 'return' || params.get('connect') === 'refresh') {
      void (async () => {
        try {
          await fetch('/api/stripe/connect/status?sync=1', { credentials: 'include' })
        } catch {
          /* non-fatal */
        }
        await refreshUserAccount()
        params.delete('connect')
        const qs = params.toString()
        const path = window.location.pathname + (qs ? `?${qs}` : '')
        window.history.replaceState(null, '', path)
      })()
    }
  }, [activeSubTab, refreshUserAccount])

  const handleStartConnectOnboarding = async () => {
    setConnectLoading(true)
    setConnectMessage(null)
    try {
      const res = await fetch('/api/stripe/connect/start', { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && typeof data.url === 'string' && data.url) {
        window.location.href = data.url
        return
      }
      setConnectMessage({
        type: 'error',
        text: typeof data.error === 'string' ? data.error : 'Could not start payout setup.',
      })
    } catch {
      setConnectMessage({ type: 'error', text: 'Network error.' })
    }
    setConnectLoading(false)
  }

  const handleDowngrade = async () => {
    setSubscriptionActionLoading(true)
    setSubscriptionMessage(null)
    try {
      const res = await fetch('/api/subscription/downgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTier: 'starter' }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setSubscriptionModal(null)
        setSubscriptionMessage({ type: 'success', text: data.message || 'Downgrade scheduled.' })
        await fetchSubscriptionStatus()
        await refreshUserAccount()
      } else {
        setSubscriptionMessage({ type: 'error', text: data.error || 'Failed to schedule downgrade.' })
      }
    } catch {
      setSubscriptionMessage({ type: 'error', text: 'Network error.' })
    }
    setSubscriptionActionLoading(false)
  }

  const handleCancelSubscription = async () => {
    setSubscriptionActionLoading(true)
    setSubscriptionMessage(null)
    try {
      const res = await fetch('/api/subscription/cancel', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setSubscriptionModal(null)
        setSubscriptionMessage({ type: 'success', text: data.message || 'Cancellation scheduled.' })
        await fetchSubscriptionStatus()
        await refreshUserAccount()
      } else {
        setSubscriptionMessage({ type: 'error', text: data.error || 'Failed to schedule cancellation.' })
      }
    } catch {
      setSubscriptionMessage({ type: 'error', text: 'Network error.' })
    }
    setSubscriptionActionLoading(false)
  }

  const handleUpgradeToPro = async () => {
    setSubscriptionActionLoading(true)
    setSubscriptionMessage(null)
    try {
      const res = await fetch('/api/subscription/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTier: 'pro' }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      if (res.ok && data.ok) {
        setSubscriptionMessage({ type: 'success', text: data.message || 'You are now on Pro.' })
        await fetchSubscriptionStatus()
        await refreshUserAccount()
      } else {
        setSubscriptionMessage({ type: 'error', text: data.error || 'Failed to upgrade.' })
      }
    } catch {
      setSubscriptionMessage({ type: 'error', text: 'Network error.' })
    }
    setSubscriptionActionLoading(false)
  }

  const reactivateViaCheckout = async (tier: 'starter' | 'pro') => {
    try {
      const res = await fetch('/api/checkout-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      setSubscriptionMessage({ type: 'error', text: data.error || 'Could not start subscription.' })
    } catch {
      setSubscriptionMessage({ type: 'error', text: 'Network error.' })
    }
  }

  useEffect(() => {
    setFormData({
      username: userData?.username || '',
      bio: userData?.bio || '',
      avatar: userData?.avatar || '',
    })
  }, [userData?.username, userData?.bio, userData?.avatar])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setSaveMessage(null)
  }

  const startEditing = () => {
    setFormData({
      username: userData?.username || '',
      bio: userData?.bio || '',
      avatar: userData?.avatar || '',
    })
    setSaveMessage(null)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setFormData({
      username: userData?.username || '',
      bio: userData?.bio || '',
      avatar: userData?.avatar || '',
    })
    setSaveMessage(null)
    setIsEditing(false)
  }

  const handleSave = async () => {
    if (!userAccount?.id) {
      setSaveMessage({ type: 'error', text: 'You must be logged in to save.' })
      return
    }
    setSaving(true)
    setSaveMessage(null)
    const { error } = await updateUserProfile(userAccount.id, {
      username: formData.username.trim() || undefined,
      bio: formData.bio.trim() || null,
      avatar_url: formData.avatar.trim() || null,
    })
    setSaving(false)
    if (error) {
      setSaveMessage({ type: 'error', text: error.message || 'Failed to save.' })
      return
    }
    setSaveMessage({ type: 'success', text: 'Profile saved.' })
    await refreshUserAccount()
    setIsEditing(false)
  }

  return (
    <div className="settings-tab">
      <div className="settings-tabs">
        <button
          className={`settings-subtab ${activeSubTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('profile')}
        >
          <User size={18} />
          Profile
        </button>
        <button
          className={`settings-subtab ${activeSubTab === 'account' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('account')}
        >
          <Lock size={18} />
          Account
        </button>
        <button
          className={`settings-subtab ${activeSubTab === 'payments' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('payments')}
        >
          <CreditCard size={18} />
          Payments
        </button>
        <button
          className={`settings-subtab ${activeSubTab === 'subscription' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('subscription')}
        >
          <RefreshCw size={18} />
          Subscription
        </button>
        <button
          className={`settings-subtab ${activeSubTab === 'privacy' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('privacy')}
        >
          <Bell size={18} />
          Privacy
        </button>
      </div>

      <div className="settings-content">
        {activeSubTab === 'profile' && (
          <div className="settings-section">
            <div className="settings-section-header">
              <h3 className="settings-section-title">Profile Settings</h3>
              {!isEditing && (
                <button type="button" className="settings-edit-btn" onClick={startEditing} aria-label="Edit profile">
                  <Pencil size={18} aria-hidden />
                  Edit profile
                </button>
              )}
            </div>

            {!isEditing ? (
              <div className="settings-profile-view">
                <div className="settings-view-row">
                  <span className="settings-view-label">Username</span>
                  <span className="settings-view-value">{userData?.username || '—'}</span>
                </div>
                <div className="settings-view-row">
                  <span className="settings-view-label">Avatar</span>
                  <div className="settings-view-avatar">
                    {userData?.avatar ? (
                      <img src={userData.avatar} alt="" className="settings-avatar-preview" />
                    ) : (
                      <div className="settings-avatar-placeholder">
                        <User size={32} aria-hidden />
                      </div>
                    )}
                  </div>
                </div>
                <div className="settings-view-row">
                  <span className="settings-view-label">Bio</span>
                  <span className="settings-view-value settings-view-bio">{userData?.bio || 'No bio yet.'}</span>
                </div>
              </div>
            ) : (
              <div className="settings-form">
                <div className="settings-form-group">
                  <label htmlFor="username">Username</label>
                  <input
                    id="username"
                    type="text"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    className="settings-input"
                    placeholder="Enter username"
                  />
                </div>
                <div className="settings-form-group">
                  <label htmlFor="bio">Bio</label>
                  <textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    className="settings-textarea"
                    placeholder="Tell us about yourself"
                    rows={4}
                  />
                </div>
                <div className="settings-form-group">
                  <label htmlFor="avatar">Avatar URL</label>
                  <input
                    id="avatar"
                    type="url"
                    value={formData.avatar}
                    onChange={(e) => handleInputChange('avatar', e.target.value)}
                    className="settings-input"
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>
                {saveMessage && (
                  <p className={`settings-save-message ${saveMessage.type === 'error' ? 'settings-save-message-error' : 'settings-save-message-success'}`} role="alert">
                    {saveMessage.text}
                  </p>
                )}
                <div className="settings-form-actions">
                  <button
                    type="button"
                    className="settings-cancel-btn"
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="settings-save-btn"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'account' && (
          <div className="settings-section">
            <h3 className="settings-section-title">Account Settings</h3>
            <div className="settings-form">
              <div className="settings-form-group">
                <label>Email</label>
                <div className="settings-readonly">
                  <Mail size={18} />
                  <span>{userData?.email || 'user@example.com'}</span>
                  <span className="settings-readonly-note">Email is managed by authentication provider</span>
                </div>
              </div>
              <div className="settings-form-group">
                <button className="settings-action-btn">
                  Reset Password
                </button>
                <p className="settings-help-text">
                  You will receive an email with instructions to reset your password.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'payments' && (
          <div className="settings-section">
            <h3 className="settings-section-title">Payment Information</h3>
            <div className="settings-form">
              <div className="settings-info-box">
                <CreditCard size={24} />
                <div>
                  <h4>Payments handled by Stripe</h4>
                  <p>Your payment methods and billing information are securely managed by Stripe.</p>
                </div>
              </div>
              <button className="settings-action-btn" disabled>
                Manage Payment Methods (Coming Soon)
              </button>
            </div>

            <h3 className="settings-section-title" style={{ marginTop: '1.75rem' }}>
              Creator payouts
            </h3>
            <div className="settings-form">
              <p className="settings-help-text">
                Connect a Stripe Express account to receive your share of sales. Platform checkout still runs on the
                main account until payouts are fully enabled in a later release.
              </p>
              {userAccount &&
                (() => {
                  const charges = Boolean(userAccount.stripe_connect_charges_enabled)
                  const payouts = Boolean(userAccount.stripe_connect_payouts_enabled)
                  const details = Boolean(userAccount.stripe_connect_details_submitted)
                  const ready = charges && payouts
                  return (
                    <div className="settings-view-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
                      <span className="settings-view-label">Payout account</span>
                      <span className="settings-view-value">
                        {ready
                          ? 'Onboarding complete — charges and payouts enabled.'
                          : userAccount.stripe_connect_account_id
                            ? details
                              ? 'Account created; Stripe may still be reviewing requirements.'
                              : 'Onboarding not finished yet.'
                            : 'Not connected yet.'}
                      </span>
                      {!ready && (
                        <button
                          type="button"
                          className="settings-action-btn settings-action-btn-recommended"
                          onClick={handleStartConnectOnboarding}
                          disabled={connectLoading}
                          style={{ marginTop: '0.5rem' }}
                        >
                          {connectLoading ? 'Opening Stripe…' : userAccount.stripe_connect_account_id ? 'Continue setup' : 'Set up payouts'}
                        </button>
                      )}
                    </div>
                  )
                })()}
              {connectMessage && (
                <p
                  className={`settings-save-message ${connectMessage.type === 'error' ? 'settings-save-message-error' : 'settings-save-message-success'}`}
                  role="alert"
                >
                  {connectMessage.text}
                </p>
              )}
            </div>
          </div>
        )}

        {activeSubTab === 'subscription' && (
          <div className="settings-section">
            <h3 className="settings-section-title">Subscription</h3>
            {subscriptionLoading ? (
              <p className="settings-subscription-loading">Loading…</p>
            ) : subscriptionStatus ? (
              <div className="settings-subscription-content">
                <div className="settings-view-row">
                  <span className="settings-view-label">Current plan</span>
                  <span className="settings-view-value">
                    {subscriptionStatus.subscription_tier.charAt(0).toUpperCase() + subscriptionStatus.subscription_tier.slice(1)}
                  </span>
                </div>
                {subscriptionStatus.current_period_end_at && (
                  <div className="settings-view-row">
                    <span className="settings-view-label">Current period ends</span>
                    <span className="settings-view-value">
                      {new Date(subscriptionStatus.current_period_end_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
                    </span>
                  </div>
                )}
                {subscriptionStatus.cancel_at_period_end && subscriptionStatus.pending_tier && (
                  <div className="settings-subscription-pending" role="status">
                    <strong>Change scheduled:</strong> You will move to{' '}
                    {subscriptionStatus.pending_tier === 'free' ? 'Free (canceled)' : subscriptionStatus.pending_tier.charAt(0).toUpperCase() + subscriptionStatus.pending_tier.slice(1)}{' '}
                    at the end of your billing period.
                    {subscriptionStatus.current_period_end_at && (
                      <> You will retain your current features until {new Date(subscriptionStatus.current_period_end_at).toLocaleDateString(undefined, { dateStyle: 'long' })}.</>
                    )}
                  </div>
                )}
                {subscriptionMessage && (
                  <p className={`settings-save-message ${subscriptionMessage.type === 'error' ? 'settings-save-message-error' : 'settings-save-message-success'}`} role="alert">
                    {subscriptionMessage.text}
                  </p>
                )}

                {subscriptionStatus.status === 'active' && !subscriptionStatus.cancel_at_period_end && (
                  <div className="settings-subscription-actions">
                    {subscriptionStatus.subscription_tier === 'starter' && (
                      <div className="settings-subscription-upgrade-block">
                        <button
                          type="button"
                          className="settings-action-btn settings-action-btn-recommended"
                          onClick={handleUpgradeToPro}
                          disabled={!!subscriptionActionLoading}
                        >
                          {subscriptionActionLoading ? 'Upgrading…' : 'Upgrade to Pro'}
                        </button>
                        <p className="settings-help-text">
                          You'll be charged a prorated amount for the rest of this billing period.
                        </p>
                      </div>
                    )}
                    {subscriptionStatus.subscription_tier === 'pro' && (
                      <button
                        type="button"
                        className="settings-action-btn settings-action-btn-secondary"
                        onClick={() => setSubscriptionModal('downgrade')}
                        disabled={!!subscriptionActionLoading}
                      >
                        Downgrade to Starter
                      </button>
                    )}
                    {(subscriptionStatus.subscription_tier === 'pro' || subscriptionStatus.subscription_tier === 'starter') && (
                      <button
                        type="button"
                        className="settings-action-btn settings-action-btn-danger"
                        onClick={() => setSubscriptionModal('cancel')}
                        disabled={!!subscriptionActionLoading}
                      >
                        Cancel subscription
                      </button>
                    )}
                  </div>
                )}

                {(subscriptionStatus.status === 'canceled' || (subscriptionStatus.subscription_tier === 'free' && !subscriptionStatus.cancel_at_period_end)) && (
                  <div className="settings-subscription-actions">
                    <p className="settings-subscription-reactivate-text">Reactivate your creator subscription:</p>
                    <div className="settings-subscription-reactivate-btns">
                      <button
                        type="button"
                        className="settings-action-btn"
                        onClick={() => reactivateViaCheckout('starter')}
                      >
                        Subscribe to Starter
                      </button>
                      <button
                        type="button"
                        className="settings-action-btn settings-action-btn-recommended"
                        onClick={() => reactivateViaCheckout('pro')}
                      >
                        Subscribe to Pro
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="settings-subscription-none">You don’t have an active subscription. <a href="/become-creator" className="settings-link">Become a Creator</a> to subscribe.</p>
            )}

            {subscriptionModal === 'downgrade' && (
              <div className="settings-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="settings-modal-downgrade-title">
                <div className="settings-modal">
                  <h3 id="settings-modal-downgrade-title" className="settings-modal-title">Downgrade to Starter</h3>
                  <p><strong>Downgrade will take effect at the end of your billing period.</strong></p>
                  {subscriptionStatus?.current_period_end_at && (
                    <p>Your current period ends on <strong>{new Date(subscriptionStatus.current_period_end_at).toLocaleDateString(undefined, { dateStyle: 'long' })}</strong>. You will keep Pro features until then.</p>
                  )}
                  <p>Features you will lose:</p>
                  <ul className="settings-modal-features">
                    {PRO_FEATURES_LOST_DOWNGRADE.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                  <div className="settings-modal-actions">
                    <button type="button" className="settings-cancel-btn" onClick={() => setSubscriptionModal(null)} disabled={subscriptionActionLoading}>Cancel</button>
                    <button type="button" className="settings-save-btn" onClick={handleDowngrade} disabled={subscriptionActionLoading}>
                      {subscriptionActionLoading ? 'Scheduling…' : 'Confirm downgrade'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {subscriptionModal === 'cancel' && (
              <div className="settings-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="settings-modal-cancel-title">
                <div className="settings-modal">
                  <h3 id="settings-modal-cancel-title" className="settings-modal-title">Cancel subscription</h3>
                  <p><strong>Are you sure?</strong> You’ll lose access to:</p>
                  <ul className="settings-modal-features">
                    {CREATOR_FEATURES_LOST_CANCEL.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                  <p>Your products and revenue may be affected. You can reactivate anytime.</p>
                  {subscriptionStatus?.current_period_end_at && (
                    <p>Your subscription will remain active until <strong>{new Date(subscriptionStatus.current_period_end_at).toLocaleDateString(undefined, { dateStyle: 'long' })}</strong>.</p>
                  )}
                  <div className="settings-modal-actions">
                    <button type="button" className="settings-cancel-btn" onClick={() => setSubscriptionModal(null)} disabled={subscriptionActionLoading}>Keep subscription</button>
                    <button type="button" className="settings-action-btn settings-action-btn-danger" onClick={handleCancelSubscription} disabled={subscriptionActionLoading}>
                      {subscriptionActionLoading ? 'Scheduling…' : 'Confirm cancellation'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'privacy' && (
          <div className="settings-section">
            <h3 className="settings-section-title">Privacy & Preferences</h3>
            <div className="settings-form">
              <div className="settings-info-box">
                <Bell size={24} />
                <div>
                  <h4>Privacy settings coming soon</h4>
                  <p>Email notifications, profile visibility, and other privacy preferences will be available here.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
