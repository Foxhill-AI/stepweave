'use client'

import '../styles/ProfileTabs.css'

export type ProfileTabType =
  | 'products'
  | 'likes-received'
  | 'followers'
  | 'following'
  | 'liked'
  | 'settings'
  | 'orders'

interface ProfileTabsProps {
  activeTab: ProfileTabType
  onTabChange: (tab: ProfileTabType) => void
}

const tabs: { id: ProfileTabType; label: string }[] = [
  { id: 'products', label: 'My Products' },
  { id: 'orders', label: 'Orders' },
  { id: 'likes-received', label: 'Likes Received' },
  { id: 'liked', label: 'Liked' },
  { id: 'followers', label: 'Followers' },
  { id: 'following', label: 'Following' },
  { id: 'settings', label: 'Settings' },
]

export default function ProfileTabs({ activeTab, onTabChange }: ProfileTabsProps) {
  return (
    <nav className="profile-tabs" role="tablist" aria-label="Profile sections">
      <div className="profile-tabs-container">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`profile-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
