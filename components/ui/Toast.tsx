'use client'

import { useState, useEffect, useRef } from 'react'
import { ShoppingBag } from 'lucide-react'
import '../../styles/Toast.css'

const TOAST_DURATION_MS = 2500
const TOAST_EXIT_MS = 200
const TOAST_EVENT = 'show-cart-toast'

export function showCartToast() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TOAST_EVENT))
  }
}

type ToastPhase = 'hidden' | 'visible' | 'exiting'

export default function Toast() {
  const [phase, setPhase] = useState<ToastPhase>('hidden')
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const scheduleHide = () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = setTimeout(() => {
        setPhase('exiting')
        if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current)
        exitTimeoutRef.current = setTimeout(() => setPhase('hidden'), TOAST_EXIT_MS)
      }, TOAST_DURATION_MS)
    }

    const handler = () => {
      setPhase('visible')
      scheduleHide()
    }

    window.addEventListener(TOAST_EVENT, handler)
    return () => {
      window.removeEventListener(TOAST_EVENT, handler)
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current)
    }
  }, [])

  if (phase === 'hidden') return null

  return (
    <div
      className={`toast${phase === 'visible' ? ' toast-enter' : ''}${phase === 'exiting' ? ' toast-exit' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="toast-icon" aria-hidden="true">
        <ShoppingBag size={20} strokeWidth={2} />
      </span>
      <span className="toast-message">Added to cart</span>
    </div>
  )
}
