'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { X, Check, Heart, Download, UserPlus, MessageSquare, Package } from 'lucide-react'
import { markNotificationRead, markAllNotificationsRead } from '@/lib/supabaseClient'
import '../styles/NotificationsDropdown.css'

export interface Notification {
  id: string
  type: 'like' | 'download' | 'follow' | 'comment' | 'order'
  message: string
  timestamp: string
  read: boolean
  link?: string
}

interface NotificationsDropdownProps {
  isOpen: boolean
  onClose: () => void
  /** Real notifications from API; when provided, mock is not used. */
  notifications?: Notification[]
  unreadCount?: number
  userAccountId?: number
  onMarkRead?: () => void
  onMarkAllRead?: () => void
}

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'like':
      return <Heart size={18} />
    case 'download':
      return <Download size={18} />
    case 'follow':
      return <UserPlus size={18} />
    case 'comment':
      return <MessageSquare size={18} />
    case 'order':
      return <Package size={18} />
    default:
      return null
  }
}

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function NotificationsDropdown({
  isOpen,
  onClose,
  notifications: propsNotifications,
  unreadCount,
  userAccountId,
  onMarkRead,
  onMarkAllRead,
}: NotificationsDropdownProps) {
  const list = propsNotifications ?? []
  const [localNotifications, setLocalNotifications] = useState<Notification[]>(list)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLocalNotifications(list)
  }, [list])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  const markAsRead = (id: string) => {
    setLocalNotifications((prev) =>
      prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif))
    )
    if (userAccountId != null) {
      markNotificationRead(userAccountId, Number(id)).then(() => onMarkRead?.())
    }
  }

  const markAllAsRead = () => {
    setLocalNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })))
    if (userAccountId != null) {
      markAllNotificationsRead(userAccountId).then(() => onMarkAllRead?.())
    }
  }

  const unreadNotifications = localNotifications.filter((n) => !n.read)
  const displayUnreadCount = unreadCount !== undefined ? unreadCount : unreadNotifications.length

  if (!isOpen) return null

  return (
    <div className="notifications-dropdown" ref={dropdownRef}>
      <div className="notifications-header">
        <h3 className="notifications-title">Notifications</h3>
        {displayUnreadCount > 0 && (
          <button
            className="notifications-mark-all-read"
            onClick={markAllAsRead}
            aria-label="Mark all as read"
          >
            <Check size={16} />
            Mark all as read
          </button>
        )}
        <button
          className="notifications-close"
          onClick={onClose}
          aria-label="Close notifications"
        >
          <X size={18} />
        </button>
      </div>

      <div className="notifications-list">
        {localNotifications.length > 0 ? (
          localNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`notification-item ${!notification.read ? 'unread' : ''}`}
              onClick={() => {
                markAsRead(notification.id)
                if (notification.link) {
                  window.location.href = notification.link
                }
              }}
            >
              <div className="notification-icon">
                {getNotificationIcon(notification.type)}
              </div>
              <div className="notification-content">
                <p className="notification-message">{notification.message}</p>
                <span className="notification-time">{formatTimestamp(notification.timestamp)}</span>
              </div>
              {!notification.read && <div className="notification-dot" />}
            </div>
          ))
        ) : (
          <div className="notifications-empty">
            <p>No notifications</p>
          </div>
        )}
      </div>

      {localNotifications.length > 0 && (
        <div className="notifications-footer">
          <Link href="/notifications" className="notifications-view-all" onClick={onClose}>
            View All
          </Link>
        </div>
      )}
    </div>
  )
}
