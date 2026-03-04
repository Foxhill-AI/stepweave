'use client'

import { useState } from 'react'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import { createContactSubmission } from '@/lib/supabaseClient'
import '../homepage.css'
import './contact.css'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMessage('')
    const { ok, error } = await createContactSubmission({ name, email, subject, message })
    if (ok) {
      setStatus('success')
      setName('')
      setEmail('')
      setSubject('')
      setMessage('')
    } else {
      setStatus('error')
      setErrorMessage(error ?? 'Something went wrong. Please try again.')
    }
  }

  return (
    <div className="homepage">
      <Navbar />
      <Subnavbar />
      <main className="homepage-main" role="main">
        <div className="container" style={{ maxWidth: '560px', margin: '0 auto', padding: 'var(--spacing-2xl) var(--spacing-md)' }}>
          <h1 className="contact-page-title">Contact Us</h1>
          <p className="contact-page-intro">
            Send us a message and we’ll get back to you as soon as we can.
          </p>

          {status === 'success' ? (
            <div className="contact-success" role="status">
              <p><strong>Message sent.</strong> Thanks for reaching out. We’ll reply to the email you provided.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="contact-form" noValidate>
              <label htmlFor="contact-name" className="contact-label">Name (optional)</label>
              <input
                id="contact-name"
                type="text"
                className="contact-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                disabled={status === 'loading'}
              />

              <label htmlFor="contact-email" className="contact-label">Email <span className="contact-required">*</span></label>
              <input
                id="contact-email"
                type="email"
                className="contact-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={status === 'loading'}
              />

              <label htmlFor="contact-subject" className="contact-label">Subject (optional)</label>
              <input
                id="contact-subject"
                type="text"
                className="contact-input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What is this about?"
                disabled={status === 'loading'}
              />

              <label htmlFor="contact-message" className="contact-label">Message <span className="contact-required">*</span></label>
              <textarea
                id="contact-message"
                className="contact-textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Your message..."
                rows={5}
                required
                disabled={status === 'loading'}
              />

              {status === 'error' && errorMessage && (
                <p className="contact-error" role="alert">{errorMessage}</p>
              )}

              <button type="submit" className="contact-submit" disabled={status === 'loading'}>
                {status === 'loading' ? 'Sending…' : 'Send message'}
              </button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
