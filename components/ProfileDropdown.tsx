'use client'

import Link from 'next/link'
import {
  User,
  Users,
  CircleDollarSign,
  Bookmark,
  Heart,
  ShoppingCart,
  Settings,
  LogOut,
  Palette,
} from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import '../styles/ProfileDropdown.css'

interface ProfileDropdownProps {
  isOpen: boolean
  onClose: () => void
  userName: string
  userAvatar: string | null
}

export default function ProfileDropdown({
  isOpen,
  onClose,
  userName,
  userAvatar,
}: ProfileDropdownProps) {
  const { signOut } = useAuth()

  const handleSignOut = async () => {
    onClose()
    await signOut()
  }

  if (!isOpen) return null

  return (
    <div className="profile-dropdown" role="menu" aria-label="Profile settings">
      <p className="profile-dropdown-title">Profile settings</p>

      <div className="profile-dropdown-user">
        {userAvatar ? (
          <img
            src={userAvatar}
            alt=""
            className="profile-dropdown-avatar"
          />
        ) : (
          <div className="profile-dropdown-avatar-placeholder">
            <User size={20} aria-hidden="true" />
          </div>
        )}
        <span className="profile-dropdown-username">{userName || 'User'}</span>
      </div>

      <Link
        href="/profile"
        className="profile-dropdown-primary-btn"
        onClick={onClose}
      >
        View my models
      </Link>

      <nav className="profile-dropdown-nav">
        <Link href="/profile" className="profile-dropdown-item" onClick={onClose}>
          <User size={18} aria-hidden="true" />
          <span>View profile</span>
        </Link>
        <Link href="/profile" className="profile-dropdown-item" onClick={onClose}>
          <Users size={18} aria-hidden="true" />
          <span>Shared with me</span>
        </Link>
        <Link href="/pricing" className="profile-dropdown-item" onClick={onClose}>
          <CircleDollarSign size={18} aria-hidden="true" />
          <span>Memberships</span>
        </Link>
        <Link href="/become-creator" className="profile-dropdown-item" onClick={onClose}>
          <Palette size={18} aria-hidden="true" />
          <span>Become a Creator</span>
        </Link>
        <Link href="/collection" className="profile-dropdown-item" onClick={onClose}>
          <Bookmark size={18} aria-hidden="true" />
          <span>Collections</span>
        </Link>
        <Link href="/profile?tab=liked" className="profile-dropdown-item" onClick={onClose}>
          <Heart size={18} aria-hidden="true" />
          <span>Liked</span>
        </Link>
        <Link href="/profile?tab=orders" className="profile-dropdown-item" onClick={onClose}>
          <ShoppingCart size={18} aria-hidden="true" />
          <span>Order history</span>
        </Link>
        <Link href="/profile" className="profile-dropdown-item" onClick={onClose}>
          <Settings size={18} aria-hidden="true" />
          <span>Settings</span>
        </Link>
        <button
          type="button"
          className="profile-dropdown-item profile-dropdown-signout"
          onClick={handleSignOut}
          aria-label="Sign out"
        >
          <LogOut size={18} aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </nav>
    </div>
  )
}