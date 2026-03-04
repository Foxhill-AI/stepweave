'use client'

import { Suspense, useState, useRef, useEffect } from 'react'
import {
  Menu,
  X,
  Bell,
  ShoppingCart,
  User,
  Palette,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import AuthModal from './AuthModal'
import NotificationsDropdown from './NotificationsDropdown'
import ProfileDropdown from './ProfileDropdown'
import { useAuth } from '@/components/AuthProvider'
import { getCartItemCount, getNotificationsForUser } from '@/lib/supabaseClient'
import { isBlogEnabled } from '@/lib/blogConfig'
import type { UserNotificationRow } from '@/lib/supabaseClient'
import '../styles/Navbar.css'

interface NavbarProps {
  isLoggedIn?: boolean
  userName?: string
  userAvatar?: string
}

function NavbarInner(_props?: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalView, setAuthModalView] = useState<'login' | 'signup'>('login')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const [notifications, setNotifications] = useState<UserNotificationRow[]>([])
  const notificationsButtonRef = useRef<HTMLButtonElement>(null)
  const profileWrapperRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, userAccount } = useAuth()
  const isLoggedIn = !!user
  const userName = userAccount?.username ?? ''
  const userAvatar = userAccount?.avatar_url ?? ''

  const isActive = (path: string) => pathname === path || (path !== '/' && pathname.startsWith(path + '/'))

  const refreshCartCount = () => {
    if (userAccount?.id) getCartItemCount(userAccount.id).then(setCartCount)
    else setCartCount(0)
  }

  useEffect(() => {
    if (!userAccount?.id) {
      setCartCount(0)
      return
    }
    let cancelled = false
    getCartItemCount(userAccount.id).then((n) => {
      if (!cancelled) setCartCount(n)
    })
    return () => { cancelled = true }
  }, [userAccount?.id])

  useEffect(() => {
    const onCartUpdated = () => refreshCartCount()
    window.addEventListener('cart-updated', onCartUpdated)
    return () => window.removeEventListener('cart-updated', onCartUpdated)
  }, [userAccount?.id])

  const refreshNotifications = () => {
    if (userAccount?.id) getNotificationsForUser(userAccount.id).then(setNotifications)
    else setNotifications([])
  }

  useEffect(() => {
    if (!userAccount?.id) {
      setNotifications([])
      return
    }
    let cancelled = false
    getNotificationsForUser(userAccount.id).then((list) => {
      if (!cancelled) setNotifications(list)
    })
    return () => { cancelled = true }
  }, [userAccount?.id])

  useEffect(() => {
    const onNotificationsUpdated = () => refreshNotifications()
    window.addEventListener('notifications-updated', onNotificationsUpdated)
    return () => window.removeEventListener('notifications-updated', onNotificationsUpdated)
  }, [userAccount?.id])

  const notificationUnreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileWrapperRef.current && !profileWrapperRef.current.contains(event.target as Node)) {
        setProfileOpen(false)
      }
    }
    if (profileOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [profileOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  const openAuthModal = (view: 'login' | 'signup' = 'login') => {
    setAuthModalView(view)
    setAuthModalOpen(true)
  }

  useEffect(() => {
    const openAuth = searchParams.get('openAuth')
    if (openAuth === '1') {
      openAuthModal('login')
      router.replace('/', { scroll: false })
    } else if (openAuth === 'signup') {
      openAuthModal('signup')
      router.replace('/', { scroll: false })
    }
  }, [searchParams])

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="navbar-container">
        <div className="navbar-left">
          <div className="navbar-brand">
            <Link href="/" className="navbar-logo">
              <div className="logo-icon">
                <span className="logo-letter">S</span>
              </div>
              <span className="logo-text">Template</span>
            </Link>
          </div>

         

          {/* Desktop Navigation */}
          <div className="navbar-links">
          {isBlogEnabled() && (
            <Link href="/blog" className={`navbar-link ${isActive('/blog') ? 'navbar-link-active' : ''}`}>
              Blog
            </Link>
          )}
          <Link href="/digital-store" className={`navbar-link ${isActive('/digital-store') ? 'navbar-link-active' : ''}`}>
            Digital Store
          </Link>
          <Link href="/marketplace" className={`navbar-link ${isActive('/marketplace') ? 'navbar-link-active' : ''}`}>
            Marketplace
          </Link>
          <Link href="/collection" className={`navbar-link ${isActive('/collection') ? 'navbar-link-active' : ''}`}>
            My Collection
          </Link>
          
          <Link href="/pricing" className={`navbar-link ${isActive('/pricing') ? 'navbar-link-active' : ''}`}>
            Pricing
          </Link>
          </div>
        </div>
        
        <div className="navbar-actions">
          {isLoggedIn ? (
            <>
              <Link href="/design-tool" className="navbar-button-design-tool">
                <Palette size={18} aria-hidden />
                <span>Design Tool</span>
              </Link>
              <div className="navbar-notifications-wrapper">
                {/* Desktop: Dropdown */}
                <button
                  ref={notificationsButtonRef}
                  className="navbar-icon-button navbar-notifications-button navbar-notifications-desktop"
                  aria-label="Notifications"
                  aria-expanded={notificationsOpen}
                  onClick={() => {
                    setNotificationsOpen(!notificationsOpen)
                    if (!notificationsOpen) refreshNotifications()
                  }}
                >
                  <Bell size={20} aria-hidden="true" />
                  {notificationUnreadCount > 0 && (
                    <span className="notifications-badge">{notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}</span>
                  )}
                </button>
                {notificationsOpen && (
                  <NotificationsDropdown
                    isOpen={notificationsOpen}
                    onClose={() => setNotificationsOpen(false)}
                    notifications={notifications.map((n) => ({
                      id: String(n.id),
                      type: n.type,
                      message: n.message,
                      timestamp: n.created_at,
                      read: n.read,
                      link: n.link ?? undefined,
                    }))}
                    unreadCount={notificationUnreadCount}
                    userAccountId={userAccount?.id}
                    onMarkRead={() => refreshNotifications()}
                    onMarkAllRead={() => refreshNotifications()}
                  />
                )}
                {/* Mobile: Link to notifications page */}
                <Link
                  href="/notifications"
                  className="navbar-icon-button navbar-notifications-button navbar-notifications-mobile"
                  aria-label="Notifications"
                >
                  <Bell size={20} aria-hidden="true" />
                  {notificationUnreadCount > 0 && (
                    <span className="notifications-badge">{notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}</span>
                  )}
                </Link>
              </div>

              <Link
                href="/cart"
                className={`navbar-icon-button ${isActive('/cart') ? 'navbar-icon-active' : ''}`}
                aria-label={cartCount > 0 ? `Shopping cart, ${cartCount} items` : 'Shopping cart'}
              >
                <ShoppingCart size={20} aria-hidden="true" />
                {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
              </Link>

              <div className="navbar-profile-wrapper" ref={profileWrapperRef}>
                <button
                  type="button"
                  className={`navbar-profile navbar-profile-trigger ${isActive('/profile') ? 'navbar-profile-active' : ''}`}
                  onClick={() => setProfileOpen(!profileOpen)}
                  aria-label="Profile menu"
                  aria-expanded={profileOpen}
                  aria-haspopup="true"
                >
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt=""
                      className="profile-avatar"
                    />
                  ) : (
                    <div className="profile-avatar-placeholder">
                      <User size={18} aria-hidden="true" />
                    </div>
                  )}
                </button>
                {profileOpen && (
                  <ProfileDropdown
                    isOpen={profileOpen}
                    onClose={() => setProfileOpen(false)}
                    userName={userName}
                    userAvatar={userAvatar || null}
                  />
                )}
              </div>
            </>
          ) : (
            <button
              onClick={() => openAuthModal('login')}
              className="navbar-button-secondary"
            >
              Log in
            </button>
          )}

         

          {/* Mobile menu button */}
          <button
            className="navbar-mobile-toggle"
            onClick={toggleMobileMenu}
            aria-label="Toggle mobile menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X size={24} aria-hidden="true" />
            ) : (
              <Menu size={24} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="navbar-mobile-menu">
          {isBlogEnabled() && (
            <Link
              href="/blog"
              className={`navbar-mobile-link ${isActive('/blog') ? 'navbar-mobile-link-active' : ''}`}
              onClick={toggleMobileMenu}
            >
              Blog
            </Link>
          )}
          <Link
            href="/digital-store"
            className={`navbar-mobile-link ${isActive('/digital-store') ? 'navbar-mobile-link-active' : ''}`}
            onClick={toggleMobileMenu}
          >
            Digital Store
          </Link>
          <Link
            href="/marketplace"
            className={`navbar-mobile-link ${isActive('/marketplace') ? 'navbar-mobile-link-active' : ''}`}
            onClick={toggleMobileMenu}
          >
            Marketplace
          </Link>
          <Link
            href="/collection"
            className={`navbar-mobile-link ${isActive('/collection') ? 'navbar-mobile-link-active' : ''}`}
            onClick={toggleMobileMenu}
          >
            My Collection
          </Link>
          <Link
            href="/pricing"
            className={`navbar-mobile-link ${isActive('/pricing') ? 'navbar-mobile-link-active' : ''}`}
            onClick={toggleMobileMenu}
          >
            Pricing
          </Link>
          {isLoggedIn ? (
            <>
              <Link
                href="/design-tool"
                className={`navbar-mobile-link navbar-mobile-button ${isActive('/design-tool') ? 'navbar-mobile-link-active' : ''}`}
                onClick={toggleMobileMenu}
              >
                Design Tool
              </Link>
              <Link
                href="/profile"
                className={`navbar-mobile-link ${isActive('/profile') ? 'navbar-mobile-link-active' : ''}`}
                onClick={toggleMobileMenu}
              >
                Profile
              </Link>
            </>
          ) : (
            <button
              className="navbar-mobile-link navbar-mobile-button"
              onClick={() => {
                toggleMobileMenu()
                openAuthModal('login')
              }}
            >
              Log in
            </button>
          )}
          
        </div>
      )}

      {/* Auth Modal (Login / Sign up) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialView={authModalView}
      />
    </nav>
  )
}

function NavbarFallback() {
  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="navbar-container">
        <div className="navbar-content" />
      </div>
    </nav>
  )
}

export default function Navbar(props?: NavbarProps) {
  return (
    <Suspense fallback={<NavbarFallback />}>
      <NavbarInner {...props} />
    </Suspense>
  )
}
