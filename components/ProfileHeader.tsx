'use client'

import { User, Calendar } from 'lucide-react'
import '../styles/ProfileHeader.css'

interface ProfileHeaderProps {
  avatar?: string
  username: string
  bio?: string
  joinedDate?: string
  followers?: number
  following?: number
  products?: number
  likes?: number
}

export default function ProfileHeader({
  avatar,
  username,
  bio,
  joinedDate,
  followers = 0,
  following = 0,
  products = 0,
  likes = 0,
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
            {bio && (
              <p className="profile-header-bio">{bio}</p>
            )}
            {joinedDate && (
              <div className="profile-header-joined">
                <Calendar size={16} />
                <span>{formatDate(joinedDate)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="profile-stats">
          <div className="profile-stat-card">
            <div className="profile-stat-value">{followers >= 1000 ? `${(followers / 1000).toFixed(1)}k` : followers}</div>
            <div className="profile-stat-label">Followers</div>
          </div>
          <div className="profile-stat-card">
            <div className="profile-stat-value">{following >= 1000 ? `${(following / 1000).toFixed(1)}k` : following}</div>
            <div className="profile-stat-label">Following</div>
          </div>
          <div className="profile-stat-card">
            <div className="profile-stat-value">{products >= 1000 ? `${(products / 1000).toFixed(1)}k` : products}</div>
            <div className="profile-stat-label">Products</div>
          </div>
          {likes !== undefined && (
            <div className="profile-stat-card">
              <div className="profile-stat-value">{likes >= 1000 ? `${(likes / 1000).toFixed(1)}k` : likes}</div>
              <div className="profile-stat-label">Likes Received</div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
