'use client'

import { User, Calendar } from 'lucide-react'
import '../styles/ProfileHeader.css'

interface ProfileHeaderProps {
  avatar?: string
  username: string
  bio?: string
  joinedDate?: string
}

export default function ProfileHeader({
  avatar,
  username,
  bio,
  joinedDate,
}: ProfileHeaderProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Joined recently'
    try {
      const date = new Date(dateString)
      return `Joined ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
    } catch {
      return 'Joined recently'
    }
  }

  return (
    <header className="profile-header">
      <div className="profile-header-container">
        <div className="profile-header-main">
          <div className="profile-avatar-section">
            {avatar ? (
              <img
                src={avatar}
                alt={username}
                className="profile-header-avatar"
              />
            ) : (
              <div className="profile-header-avatar-placeholder">
                <User size={40} />
              </div>
            )}
          </div>

          <div className="profile-header-info">
            <h1 className="profile-header-username">{username}</h1>
            {bio && <p className="profile-header-bio">{bio}</p>}
            {joinedDate && (
              <div className="profile-header-joined">
                <Calendar size={16} />
                <span>{formatDate(joinedDate)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
