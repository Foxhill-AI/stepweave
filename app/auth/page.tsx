import { redirect } from 'next/navigation'

/**
 * /auth has no UI; redirect to home with ?openAuth=1 so the Navbar opens the login modal.
 * Server-side redirect ensures GET /auth (and RSC prefetch /auth?_rsc=...) return 307, not 404.
 */
export default function AuthPage() {
  redirect('/?openAuth=1')
}
