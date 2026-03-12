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
            <Link href="/" className="navbar-logo" aria-label="Step Weave home">
              <svg
                className="logo-icon"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 1024 1024"
                fill="none"
                fillRule="evenodd"
                clipRule="evenodd"
                aria-hidden
              >
                <path
                  fill="currentColor"
                  d="M547.000000,553.023926 C491.173431,553.010254 435.845154,553.238464 380.521149,552.856384 C360.244293,552.716370 339.824493,552.725220 319.859009,548.298340 C291.782471,542.073059 276.562592,519.828247 280.340942,491.384949 C283.920380,464.439087 291.420898,438.328339 297.064484,411.822662 C299.767334,399.128448 303.016418,386.531311 305.182648,373.748627 C306.674011,364.948120 313.084442,362.955322 320.226868,364.006165 C327.891052,365.133789 334.325409,369.153687 339.832397,374.332733 C346.275970,380.392609 352.012512,387.215424 356.372620,394.928040 C365.375153,410.852631 379.689026,415.098328 396.619720,414.042603 C410.868958,413.154083 424.000000,408.614594 436.276215,401.529877 C447.312775,395.160645 449.962585,389.407410 448.345184,376.708130 C446.683685,363.662415 450.169067,351.930634 457.931549,341.475433 C462.819519,334.891876 466.072906,334.253510 472.438538,339.311554 C487.434753,351.227417 502.070374,363.596558 517.040955,375.545410 C537.502808,391.877136 558.822571,406.982025 581.430481,420.263336 C615.167664,440.082520 650.132935,456.982941 688.232483,466.771271 C704.362061,470.915222 720.580688,474.624390 736.933899,477.769287 C748.588745,480.010651 751.452515,483.496033 751.275024,495.405670 C750.993652,514.281189 742.163025,527.800964 725.041626,535.578308 C709.548889,542.615845 692.834290,545.056885 676.161072,547.256714 C633.449829,552.892029 590.470520,552.949097 547.000000,553.023926 M481.872681,450.369720 C476.881622,446.478729 471.837555,442.653137 466.922668,438.668182 C464.585266,436.773010 462.609741,436.788757 460.288757,438.689606 C457.458588,441.007416 454.573761,443.323853 451.450287,445.205444 C443.280121,450.127258 433.349152,446.962372 429.606110,438.580933 C427.864044,434.680084 427.638397,431.130554 431.256378,428.248566 C435.227814,425.084900 437.379272,428.703522 439.522430,430.944183 C442.837433,434.409943 446.011292,434.482147 449.569519,431.544037 C452.779999,428.893066 456.164886,426.438507 459.235107,423.636780 C462.207092,420.924744 464.721558,420.783691 467.940399,423.401520 C483.316345,435.906403 498.884857,448.174652 514.250549,460.691925 C519.303162,464.807861 519.302979,467.145294 514.300659,471.599335 C499.380951,484.883698 483.631165,497.244476 469.812195,511.750000 C468.080200,513.568054 466.291412,513.797058 464.043579,512.367310 C459.404968,509.416748 458.889923,507.039490 462.854919,502.894135 C473.342804,491.929169 485.026215,482.231384 496.121338,471.908539 C498.168854,470.003571 499.872498,468.213165 496.945129,465.869598 C494.656036,464.037018 493.246368,459.955048 488.915161,463.636261 C470.614868,479.190308 452.847565,495.281433 437.310059,513.656677 C431.881866,520.076294 426.791840,526.809692 423.050354,536.011230 C435.604248,534.316406 448.782898,540.448608 457.395325,527.067261 C457.914307,526.260864 458.839233,525.694031 459.631409,525.089294 C462.111786,523.195618 464.512115,522.992249 466.600830,525.659668 C468.649933,528.276550 470.594086,530.975708 472.648773,533.588074 C474.203888,535.565125 482.021149,536.945435 484.276947,535.389404 C487.064148,533.466797 486.070282,530.636047 485.141968,528.182739 C482.227692,520.480774 482.257446,519.648010 488.452698,513.999329 C501.007782,502.551910 513.681396,491.234558 526.266541,479.819977 C531.158569,475.382965 535.943787,470.828186 540.494751,466.590393 C540.128601,464.462555 539.020081,463.648132 538.023438,462.796753 C527.765869,454.033936 517.568481,445.198059 507.195068,436.574158 C498.872772,429.655518 490.295868,423.043976 481.904755,416.206787 C478.849518,413.717377 476.774780,410.918549 479.922729,406.886505 C482.884094,403.093475 485.293060,402.487854 489.778259,405.260895 C492.604828,407.008545 495.232788,409.078094 497.943939,411.011566 C499.617767,412.205322 501.341644,413.278778 503.463989,412.188507 C509.567261,409.053131 514.844116,404.888214 520.065186,399.180969 C512.252747,393.190979 504.913452,387.522278 497.519043,381.926392 C495.870697,380.678925 494.360291,381.645874 492.984100,382.690704 C489.004456,385.712189 485.031952,388.743073 481.054413,391.767395 C459.857269,407.884460 437.819763,422.315674 411.349121,428.541321 C392.485077,432.977997 374.638977,431.457031 358.173859,420.679993 C350.757202,415.825500 345.947815,408.557312 341.527588,401.060822 C337.508057,394.244049 332.600311,388.182098 326.194275,383.480316 C321.750549,380.218781 320.381317,380.712494 319.241058,386.016174 C317.073151,396.099762 315.250305,406.260101 312.933289,416.307678 C312.079651,420.009491 313.403381,420.955841 316.674500,421.462921 C324.814270,422.724792 332.376221,425.693970 339.609680,429.633575 C372.368896,447.475464 404.512238,466.437073 437.706238,483.495270 C441.895386,485.648041 444.938599,485.552582 448.459167,482.515289 C459.302521,473.160461 470.310822,463.996979 481.231995,454.731964 C482.422089,453.722321 484.326111,452.778046 481.872681,450.369720 M538.488403,413.516357 C535.974854,411.497620 534.040100,406.884094 530.093506,409.569519 C524.518188,413.363129 519.592468,418.111603 513.799683,422.943451 C518.068176,427.099121 521.953857,430.907135 525.866516,434.687195 C543.834595,452.046173 561.846619,469.359863 579.758728,486.776398 C584.533020,491.418579 584.196777,493.613312 578.676453,497.360779 C573.853699,500.634613 568.883240,503.704041 564.191833,507.154480 C559.518494,510.591675 554.578918,513.886475 551.950256,519.382629 C548.170349,527.286133 553.364380,535.837891 561.891907,535.838806 C600.508240,535.843018 639.164734,536.809753 677.518188,530.762146 C691.658875,528.532349 705.888367,526.559204 719.058655,520.568176 C727.702393,516.636230 733.502136,510.053558 735.308960,500.424255 C736.064514,496.397919 735.119873,493.773529 730.468750,493.006073 C722.925537,491.761414 715.436829,490.165863 707.952820,488.587219 C682.655334,483.251129 657.985718,475.771179 633.855835,466.524902 C630.308777,465.165680 627.315125,465.261353 623.908142,467.045654 C615.323914,471.541382 607.413879,477.091217 599.338928,482.369232 C596.687744,484.102081 595.041687,484.087189 592.995056,481.776459 C588.469177,476.666534 583.780701,471.701111 579.201355,466.638062 C571.933044,458.602020 564.245667,450.992950 556.245422,443.686401 C554.175049,441.795563 552.736267,439.454956 555.045776,436.712158 C557.252197,434.091736 559.838257,433.139465 562.901123,435.360168 C565.596069,437.314117 568.262207,439.307861 570.942810,441.281647 C575.438477,444.591858 576.473389,444.311646 579.107178,438.674042 C572.007629,434.203003 564.773315,429.810394 557.728271,425.132782 C554.764343,423.164886 552.911804,423.204620 550.784851,426.323212 C549.190063,428.661530 547.148804,431.565430 543.471069,429.733856 C539.611023,427.811523 537.005188,425.091858 538.176086,420.197235 C538.633301,418.286011 538.548706,416.245148 538.488403,413.516357 M302.168610,519.285461 C309.251007,529.672424 320.100281,532.177734 331.605560,533.747864 C351.675446,536.486694 371.844757,535.327454 391.969727,535.947632 C399.085022,536.166931 403.675781,534.249084 407.286499,527.868958 C413.264557,517.305908 421.386505,508.189301 429.128235,499.083038 C428.135864,497.197296 426.594269,496.800110 425.319641,496.096680 C400.822205,482.576904 376.362213,468.987732 351.773132,455.636444 C341.538452,450.079285 331.569092,443.930756 320.570160,439.900391 C311.683136,436.643860 307.787109,438.744324 305.674347,447.827148 C302.922913,459.655701 300.076569,471.470154 297.708466,483.377686 C295.297302,495.501862 294.871582,507.562592 302.168610,519.285461 M530.025024,493.543396 C525.542847,497.508759 520.985718,501.393250 516.598267,505.460846 C511.603271,510.091614 506.545593,514.660645 502.097534,519.859619 C498.018768,524.626953 501.279816,529.019653 502.701508,533.404297 C503.829865,536.884216 507.157806,535.603882 509.626465,535.660156 C516.274658,535.811768 522.932922,535.577271 529.578308,535.782349 C533.861389,535.914490 535.207825,534.423096 534.304504,530.133972 C532.541992,521.765198 533.760620,514.009888 539.596924,507.237793 C543.657104,502.526611 548.645691,498.942078 553.315796,494.961212 C558.976746,490.135681 559.070496,489.001404 554.255127,483.266693 C553.721008,482.630585 553.093872,482.068787 552.591919,481.409973 C550.270020,478.362244 547.827026,478.401733 545.017517,480.837158 C540.246765,484.972412 535.372070,488.987762 530.025024,493.543396 M470.073334,379.526123 C474.085327,376.405212 478.380157,373.606689 482.018036,369.331848 C477.724884,364.541595 473.061890,360.644531 467.590759,357.020996 C462.489380,365.482239 464.349548,373.787537 464.421082,381.949463 C467.088074,382.252716 468.129272,380.748322 470.073334,379.526123 M591.172302,449.571930 C590.039185,450.923645 588.196716,451.732697 587.866333,454.039642 C589.908386,456.432953 592.063171,458.928070 594.181885,461.453491 C595.372192,462.872192 596.671387,463.646301 598.464539,462.492035 C602.036682,460.192688 605.609680,457.894775 609.802795,455.197052 C604.734070,452.512054 600.384277,450.233704 596.061096,447.906006 C594.169067,446.887268 592.934631,447.973633 591.172302,449.571930 z"
                />
              </svg>
              <span className="logo-text">Step Weave</span>
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
          <Link href="/design-tool" className="navbar-button-design-tool">
            <Palette size={18} aria-hidden />
            <span>Design Tool</span>
          </Link>
          {isLoggedIn ? (
            <>
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
          <Link
            href="/design-tool"
            className={`navbar-mobile-link navbar-mobile-button ${isActive('/design-tool') ? 'navbar-mobile-link-active' : ''}`}
            onClick={toggleMobileMenu}
          >
            Design Tool
          </Link>
          {isLoggedIn ? (
            <>
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
