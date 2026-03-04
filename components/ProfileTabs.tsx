'use client'

import '../styles/ProfileTabs.css'

type TabType = 'products' | 'orders' | 'liked' | 'settings'

interface ProfileTabsProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
}

const tabs: { id: TabType; label: string }[] = [
  { id: 'products', label: 'My Products' },
  { id: 'orders', label: 'Orders' },
  { id: 'liked', label: 'Liked' },
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
