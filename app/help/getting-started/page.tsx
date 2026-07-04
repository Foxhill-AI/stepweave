import Link from 'next/link'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import '../../homepage.css'
import '../help.css'

export const metadata: Metadata = {
  title: 'Getting started | Help Center | Step Weave',
  description:
    'How to create an account, sign in with Google or Facebook, reset your password, and find your way around Step Weave.',
}

export default function GettingStartedPage() {
  return (
    <div className="homepage">
      <Navbar />
      <Subnavbar />
      <main className="homepage-main" role="main">
        <article className="help-page">
          <Link href="/help" className="help-back">
            ← Back to Help Center
          </Link>
          <h1 className="help-page-title">Getting started</h1>
          <p className="help-page-intro">
            New to Step Weave? Start here. These are the answers to the questions we hear most
            often from people on day one.
          </p>

          <hr />

          <nav aria-label="Table of contents">
            <h2 className="help-toc-heading">In this guide</h2>
            <ol className="help-toc">
              <li>
                <a href="#what-is-step-weave">What is Step Weave?</a>
              </li>
              <li>
                <a href="#creating-an-account">Creating an account</a>
              </li>
              <li>
                <a href="#signing-in-with-google-or-facebook">Signing in with Google or Facebook</a>
              </li>
              <li>
                <a href="#resetting-your-password">Resetting your password</a>
              </li>
              <li>
                <a href="#a-quick-tour">A quick tour of the site</a>
              </li>
            </ol>
          </nav>

          <hr />

          <section id="what-is-step-weave" className="help-section">
            <h2>What is Step Weave?</h2>
            <p>
              Step Weave is a marketplace and design tool for custom, made-to-order products.
              Browse what other creators have made, or open the design tool to make something of
              your own — using AI to generate patterns and place them onto real product templates.
            </p>
            <p>
              Every product on Step Weave is manufactured after you order it, by our print-on-demand
              partners. Nothing sits in a warehouse, and nothing gets thrown away.
            </p>
            <p>
              The longer version of who we are lives on our <Link href="/about">About page</Link>.
            </p>
          </section>

          <hr />

          <section id="creating-an-account" className="help-section">
            <h2>Creating an account</h2>
            <p>You don&apos;t need an account to browse — but you do need one to:</p>
            <ul>
              <li>Save designs you&apos;ve made in the design tool</li>
              <li>Place an order</li>
              <li>List products for sale as a creator</li>
              <li>Leave reviews or follow other creators</li>
            </ul>
            <p>To create an account:</p>
            <ol>
              <li>Click <strong>Log in</strong> at the top right of any page.</li>
              <li>Switch to the <strong>Sign up</strong> tab.</li>
              <li>
                Enter your email, choose a username, and pick a password — or sign up with Google
                or Facebook to skip the password step.
              </li>
              <li>
                If you signed up with email, check your inbox for a verification link. You&apos;ll
                need to click it before you can place an order.
              </li>
            </ol>
            <div className="help-callout">
              <p>
                <strong>Didn&apos;t get the verification email?</strong> Check your spam folder
                first. If it&apos;s not there, sign in with the same email and password — Step
                Weave will give you a button to resend it.
              </p>
            </div>
          </section>

          <hr />

          <section id="signing-in-with-google-or-facebook" className="help-section">
            <h2>Signing in with Google or Facebook</h2>
            <p>
              Click <strong>Log in</strong>, then choose <strong>Continue with Google</strong> or{' '}
              <strong>Continue with Facebook</strong>. You&apos;ll be sent to that provider to
              authorize Step Weave, then bounced back here automatically.
            </p>
            <p>
              We don&apos;t see your Google or Facebook password — only the email address and basic
              profile info you choose to share. You can revoke that access at any time from your
              Google or Facebook account settings.
            </p>
            <p>
              If you originally signed up with email and want to switch to Google or Facebook
              sign-in, use the same email address — your account will be linked automatically.
            </p>
          </section>

          <hr />

          <section id="resetting-your-password" className="help-section">
            <h2>Resetting your password</h2>
            <ol>
              <li>Click <strong>Log in</strong>.</li>
              <li>Click <strong>Forgot password?</strong> below the password field.</li>
              <li>Enter the email on your account and click <strong>Send reset link</strong>.</li>
              <li>
                Open the email we send and click the link. You&apos;ll be taken to a page where you
                can set a new password.
              </li>
            </ol>
            <p>
              Reset links expire after a short time for security. If yours doesn&apos;t work, just
              request a new one.
            </p>
            <div className="help-callout">
              <p>
                If you signed up with Google or Facebook, you don&apos;t have a Step Weave password
                — sign in with that provider instead, or contact{' '}
                <a href="mailto:stepweave_admin@foxhillai.com">stepweave_admin@foxhillai.com</a> if you&apos;ve lost
                access to it.
              </p>
            </div>
          </section>

          <hr />

          <section id="a-quick-tour" className="help-section">
            <h2>A quick tour of the site</h2>
            <h3>Marketplace</h3>
            <p>
              Browse custom products from creators around the world. Filter by category, save
              items to your favorites, and add to cart when you find something you love.
            </p>

            <h3>Design tool</h3>
            <p>
              Make your own custom product. Pick a base item (like a pair of shoes), describe the
              pattern you want with words, and the design tool generates options you can adjust.
              See <Link href="/help/design-tool">The design tool</Link> for a full walkthrough.
            </p>

            <h3>Profile</h3>
            <p>
              Your home base. From your profile you can manage your account settings, view past
              orders, see saved designs, and (if you&apos;re a creator) manage the products
              you&apos;ve listed for sale.
            </p>

            <h3>Cart and checkout</h3>
            <p>
              Items you add to cart are saved while you keep browsing. Checkout is handled by
              Stripe — Step Weave never sees your card number. After checkout, you&apos;ll get an
              order confirmation email.
            </p>
          </section>

          <p className="help-footer-note">
            Still stuck? <Link href="/contact">Contact us</Link> and we&apos;ll help.
          </p>
        </article>
      </main>
      <Footer />
    </div>
  )
}
