'use client'

import { useState, useEffect } from 'react'
import { Check, Heart, Download, UserPlus, MessageSquare, Package, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { getNotificationsForUser, markNotificationRead, markAllNotificationsRead } from '@/lib/supabaseClient'
import '../styles/NotificationsPage.css'

interface Notification {
  id: string
  type: 'like' | 'download' | 'follow' | 'comment' | 'order'
  message: string
  timestamp: string
  read: boolean
  link?: string
}

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'like':
      return <Heart size={20} />
    case 'download':
      return <Download size={20} />
    case 'follow':
      return <UserPlus size={20} />
    case 'comment':
      return <MessageSquare size={20} />
    case 'order':
      return <Package size={20} />
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

export default function NotificationsPage() {
  const router = useRouter()
  const { userAccount } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    if (!userAccount?.id) {
      setNotifications([])
      return
    }
    let cancelled = false
    getNotificationsForUser(userAccount.id).then((rows) => {
      if (!cancelled) {
        setNotifications(
          rows.map((n) => ({
            id: String(n.id),
            type: n.type,
            message: n.message,
            timestamp: n.created_at,
            read: n.read,
            link: n.link ?? undefined,
          }))
        )
      }
    })
    return () => { cancelled = true }
  }, [userAccount?.id])

  useEffect(() => {
    const onUpdate = () => {
      if (userAccount?.id) getNotificationsForUser(userAccount.id).then((rows) => {
        setNotifications(
          rows.map((n) => ({
            id: String(n.id),
            type: n.type,
            message: n.message,
            timestamp: n.created_at,
            read: n.read,
            link: n.link ?? undefined,
          }))
        )
      })
    }
    window.addEventListener('notifications-updated', onUpdate)
    return () => window.removeEventListener('notifications-updated', onUpdate)
  }, [userAccount?.id])

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif))
    )
    if (userAccount?.id) markNotificationRead(userAccount.id, Number(id)).catch(() => {})
  }

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })))
    if (userAccount?.id) markAllNotificationsRead(userAccount.id).catch(() => {})
  }

  const unreadNotifications = notifications.filter((n) => !n.read)
  const unreadCount = unreadNotifications.length

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id)
    if (notification.link) router.push(notification.link)
  }

  return (
    <main className="notifications-page" role="main">
      <div className="notifications-page-container">
        <div className="notifications-page-header">
          <button
            className="notifications-back-button"
            onClick={() => router.back()}
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="notifications-page-title">Notifications</h1>
          {unreadCount > 0 && (
            <button
              className="notifications-mark-all-read-button"
              onClick={markAllAsRead}
              aria-label="Mark all as read"
            >
              <Check size={18} />
              Mark all as read
            </button>
          )}
        </div>

        <div className="notifications-page-content">
          {notifications.length > 0 ? (
            <div className="notifications-list-page">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item-page ${!notification.read ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon-page">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content-page">
                    <p className="notification-message-page">{notification.message}</p>
                    <span className="notification-time-page">{formatTimestamp(notification.timestamp)}</span>
                  </div>
                  {!notification.read && <div className="notification-dot-page" />}
                </div>
              ))}
            </div>
          ) : (
            <div className="notifications-empty-page">
              <p>No notifications</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
