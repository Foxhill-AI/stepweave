/**
 * Absolute origin for Stripe Connect return/refresh URLs (Account Links).
 * Prefer NEXT_PUBLIC_SITE_URL in production so redirects match your canonical domain.
 */
export function stripeConnectBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  if (fromEnv) return fromEnv
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return vercel.startsWith('http') ? vercel.replace(/\/$/, '') : `https://${vercel.replace(/\/$/, '')}`
  return 'http://localhost:3000'
}
