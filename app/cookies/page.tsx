import Link from 'next/link'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import '../homepage.css'
import './cookies.css'

export const metadata: Metadata = {
  title: 'Cookie Policy | Step Weave',
  description:
    'How Step Weave (Foxhill AI LLC) uses cookies and similar technologies, third-party cookies, retention, and how to manage preferences.',
}

export default function CookiesPage() {
  return (
    <div className="homepage">
      <Navbar />
      <Subnavbar />
      <main className="homepage-main" role="main">
        <article className="cookies-page">
          <h1 className="cookies-page-title">Cookie Policy</h1>
          <p className="cookies-page-meta">
            <strong>Last updated:</strong> July 2026
          </p>

          <p className="cookies-page-intro">
            <strong>Step Weave</strong> is operated by <strong>Foxhill AI LLC</strong>, located at 9878 W. Belleview Ave,
            Suite 2393, Denver, CO 80123. This Cookie Policy explains what cookies are, which ones we use on{' '}
            <a href="https://www.stepweave.com">https://www.stepweave.com</a>, why we use them, and how you can control
            them.
          </p>
          <p className="cookies-page-intro">
            This policy should be read alongside our <Link href="/privacy">Privacy Policy</Link> and{' '}
            <Link href="/terms">Terms of Service</Link>.
          </p>

          <hr />

          <nav aria-label="Table of contents">
            <h2 className="cookies-toc-heading">Table of Contents</h2>
            <ol className="cookies-toc">
              <li>
                <a href="#1-what-are-cookies">What Are Cookies?</a>
              </li>
              <li>
                <a href="#2-types-of-cookies-we-use">Types of Cookies We Use</a>
              </li>
              <li>
                <a href="#3-cookies-set-by-third-parties">Cookies Set by Third Parties</a>
              </li>
              <li>
                <a href="#4-how-long-cookies-last">How Long Cookies Last</a>
              </li>
              <li>
                <a href="#5-managing-your-cookie-preferences">Managing Your Cookie Preferences</a>
              </li>
              <li>
                <a href="#6-cookie-consent-banner">Cookie Consent Banner</a>
              </li>
              <li>
                <a href="#7-do-not-track">Do Not Track</a>
              </li>
              <li>
                <a href="#8-changes-to-this-policy">Changes to This Policy</a>
              </li>
              <li>
                <a href="#9-contact-us">Contact Us</a>
              </li>
            </ol>
          </nav>

          <hr />

          <section id="1-what-are-cookies" className="cookies-section" aria-labelledby="cookies-h-what">
            <h2 id="cookies-h-what">1. What Are Cookies?</h2>
            <p>
              Cookies are small text files that a website places on your device (computer, phone, or tablet) when you
              visit. They are widely used to make websites work properly, remember your preferences, and provide
              information to site owners about how their site is being used.
            </p>
            <p>
              <strong>Cookies are not the same as viruses or malware.</strong> They cannot execute programs or carry
              malicious code. A cookie can only be read by the website that set it.
            </p>
            <p>In addition to cookies, we may use similar technologies such as:</p>
            <ul>
              <li>
                <strong>Local storage</strong> — stores data in your browser that persists beyond a single session
              </li>
              <li>
                <strong>Session storage</strong> — stores data only for the duration of your browser session
              </li>
              <li>
                <strong>Pixels and web beacons</strong> — tiny invisible images embedded in pages or emails that signal
                when content has been viewed
              </li>
              <li>
                <strong>Device fingerprinting</strong> — a combination of device attributes used for security and fraud
                prevention purposes
              </li>
            </ul>
            <p>
              This policy covers all of these technologies collectively when we refer to &quot;cookies.&quot;
            </p>
          </section>

          <hr />

          <section id="2-types-of-cookies-we-use" className="cookies-section" aria-labelledby="cookies-h-types">
            <h2 id="cookies-h-types">2. Types of Cookies We Use</h2>
            <p>We organize cookies into four categories based on their purpose.</p>

            <h3 id="cookies-h-essential">Essential Cookies</h3>
            <p>
              These cookies are strictly necessary for Step Weave to function. Without them, core features like logging
              in, adding items to your cart, and completing a purchase would not work. Because they are essential, they
              cannot be disabled through our cookie settings.
            </p>
            <div className="cookies-table-wrap">
              <table className="cookies-table">
                <thead>
                  <tr>
                    <th scope="col">Cookie</th>
                    <th scope="col">Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Session cookie</td>
                    <td>Keeps you logged in during your visit</td>
                  </tr>
                  <tr>
                    <td>Authentication token</td>
                    <td>Verifies your identity securely across pages</td>
                  </tr>
                  <tr>
                    <td>Cart / order state</td>
                    <td>Remembers items in your cart between pages</td>
                  </tr>
                  <tr>
                    <td>CSRF protection token</td>
                    <td>Protects against cross-site request forgery attacks</td>
                  </tr>
                  <tr>
                    <td>Cookie consent preference</td>
                    <td>Remembers the choices you made in our cookie banner</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 id="cookies-h-analytics">Analytics and Performance Cookies</h3>
            <p>
              Step Weave does not currently use a third-party analytics service. Our cookie banner includes an
              Analytics category so you have granular control in place before any such tool is introduced. If we add
              one in the future (for example, to understand which pages are popular or how the site performs), we
              will name the specific provider here and describe what it collects.
            </p>

            <h3 id="cookies-h-functional">Functional / Preference Cookies</h3>
            <p>
              These cookies remember choices you make to provide a more personalized experience. They are not strictly
              necessary but improve your experience on the site.
            </p>
            <div className="cookies-table-wrap">
              <table className="cookies-table">
                <thead>
                  <tr>
                    <th scope="col">Cookie</th>
                    <th scope="col">Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Language / locale preference</td>
                    <td>Remembers your preferred language or region</td>
                  </tr>
                  <tr>
                    <td>Display preferences</td>
                    <td>Remembers view settings such as grid or list layout</td>
                  </tr>
                  <tr>
                    <td>Recently viewed designs</td>
                    <td>Shows you products you recently looked at</td>
                  </tr>
                  <tr>
                    <td>Sign-in provider preference</td>
                    <td>Remembers whether you last signed in with Google or email</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 id="cookies-h-marketing">Marketing and Advertising Cookies</h3>
            <p>
              Step Weave does not currently run advertising, remarketing, or ad-conversion cookies. Our cookie banner
              includes a Marketing category so you have granular control in place before any such tool is
              introduced. If we add advertising features in the future, we will only set these cookies with your
              consent and will name the specific providers here.
            </p>
          </section>

          <hr />

          <section id="3-cookies-set-by-third-parties" className="cookies-section" aria-labelledby="cookies-h-third">
            <h2 id="cookies-h-third">3. Cookies Set by Third Parties</h2>
            <p>
              Some cookies on Step Weave are set directly by third-party services we use. These parties have their own
              privacy and cookie policies, which we encourage you to review.
            </p>
            <div className="cookies-table-wrap">
              <table className="cookies-table">
                <thead>
                  <tr>
                    <th scope="col">Third Party</th>
                    <th scope="col">Why They Set Cookies</th>
                    <th scope="col">Their Privacy Policy</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>Stripe</strong>
                    </td>
                    <td>Secure payment processing and fraud prevention</td>
                    <td>
                      <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">
                        stripe.com/privacy
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Google</strong>
                    </td>
                    <td>Social sign-in (OAuth)</td>
                    <td>
                      <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                        policies.google.com/privacy
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Supabase</strong>
                    </td>
                    <td>Authentication and data storage</td>
                    <td>
                      <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">
                        supabase.com/privacy
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>OpenAI / Fal</strong>
                    </td>
                    <td>AI design tool processing</td>
                    <td>See their respective privacy policies</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>We do not control third-party cookies.</p>
          </section>

          <hr />

          <section id="4-how-long-cookies-last" className="cookies-section" aria-labelledby="cookies-h-duration">
            <h2 id="cookies-h-duration">4. How Long Cookies Last</h2>
            <p>Cookies fall into two duration categories:</p>
            <p>
              <strong>Session cookies</strong> expire when you close your browser. They are used for things like
              keeping you logged in during a visit or protecting form submissions.
            </p>
            <p>
              <strong>Persistent cookies</strong> remain on your device for a set period after your browser is closed,
              or until you delete them. The duration varies by cookie:
            </p>
            <div className="cookies-table-wrap">
              <table className="cookies-table">
                <thead>
                  <tr>
                    <th scope="col">Cookie Type</th>
                    <th scope="col">Typical Duration</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Authentication / login</td>
                    <td>30 days (or until you sign out)</td>
                  </tr>
                  <tr>
                    <td>Preference cookies</td>
                    <td>Up to 1 year</td>
                  </tr>
                  <tr>
                    <td>Cookie consent record</td>
                    <td>1 year</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              If we introduce analytics or marketing cookies in the future, we will add their typical durations here.
            </p>
            <p>
              You can delete cookies at any time through your browser settings. Note that deleting essential cookies may
              log you out or affect site functionality.
            </p>
          </section>

          <hr />

          <section
            id="5-managing-your-cookie-preferences"
            className="cookies-section"
            aria-labelledby="cookies-h-manage"
          >
            <h2 id="cookies-h-manage">5. Managing Your Cookie Preferences</h2>
            <p>You have several ways to control cookies:</p>

            <h3 id="cookies-h-banner-pref">Through Our Cookie Banner</h3>
            <p>
              When you first visit Step Weave, a cookie consent banner will appear giving you the option to accept all
              cookies, reject non-essential cookies, or customize your preferences by category. You can revisit and
              update your choices at any time by clicking the <strong>Cookie Settings</strong> link in the footer of our
              website.
            </p>

            <h3 id="cookies-h-browser">Through Your Browser</h3>
            <p>
              Most browsers allow you to view, block, and delete cookies through their settings. Here are links to
              instructions for the most common browsers:
            </p>
            <ul>
              <li>
                <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">
                  Google Chrome
                </a>
              </li>
              <li>
                <a
                  href="https://support.mozilla.org/en-US/kb/enable-and-disable-cookies-website-preferences"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Mozilla Firefox
                </a>
              </li>
              <li>
                <a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener noreferrer">
                  Apple Safari
                </a>
              </li>
              <li>
                <a
                  href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Microsoft Edge
                </a>
              </li>
            </ul>
            <p>
              Note that blocking all cookies through your browser — including essential ones — may prevent Step Weave
              from working correctly.
            </p>

            <h3 id="cookies-h-optout-tools">Through Third-Party Opt-Out Tools</h3>
            <p>
              Step Weave does not currently run third-party analytics or advertising services, so there are no
              vendor-specific opt-out tools to link to today. If we introduce such services in the future, we will
              list the relevant opt-out tools here (for example, industry resources such as the{' '}
              <a href="https://optout.networkadvertising.org" target="_blank" rel="noopener noreferrer">
                Network Advertising Initiative
              </a>{' '}
              or{' '}
              <a href="https://optout.aboutads.info" target="_blank" rel="noopener noreferrer">
                Digital Advertising Alliance
              </a>
              ).
            </p>
          </section>

          <hr />

          <section id="6-cookie-consent-banner" className="cookies-section" aria-labelledby="cookies-h-consent-ui">
            <h2 id="cookies-h-consent-ui">6. Cookie Consent Banner</h2>
            <p>
              For users in the <strong>EU, UK, and other regions</strong> where cookie consent is required by law (such
              as under the ePrivacy Directive or UK PECR), we display a cookie consent banner on your first visit. We
              will not set non-essential cookies until you have given your consent.
            </p>
            <p>
              Your consent preferences are stored so you are not asked repeatedly. You can change your preferences at any
              time using the <strong>Cookie Settings</strong> link in our site footer.
            </p>
            <p>
              If you are located in the <strong>United States</strong>, certain states (such as California under the CPRA)
              give you the right to opt out of cookies used for targeted advertising or the sale of personal information.
              You can exercise this right through our cookie banner or by contacting us directly.
            </p>
          </section>

          <hr />

          <section id="7-do-not-track" className="cookies-section" aria-labelledby="cookies-h-dnt">
            <h2 id="cookies-h-dnt">7. Do Not Track</h2>
            <p>
              Some browsers offer a <strong>Do Not Track (DNT)</strong> signal that you can enable to request that
              websites not track your browsing activity. Currently, there is no universally accepted standard for how
              websites should respond to DNT signals.
            </p>
            <p>
              At this time, Step Weave does not alter its data collection practices in response to DNT browser signals.
              However, you can use the cookie controls described in{' '}
              <a href="#5-managing-your-cookie-preferences">Section 5</a> to limit tracking.
            </p>
          </section>

          <hr />

          <section id="8-changes-to-this-policy" className="cookies-section" aria-labelledby="cookies-h-changes">
            <h2 id="cookies-h-changes">8. Changes to This Policy</h2>
            <p>
              We may update this Cookie Policy from time to time to reflect changes in the cookies we use, legal
              requirements, or how we operate our services. When we make changes, we will update the{' '}
              <strong>Last updated</strong> date at the top of this page.
            </p>
            <p>
              If the changes are material, we will notify you through our cookie consent banner or by email. We encourage
              you to review this policy periodically.
            </p>
          </section>

          <hr />

          <section id="9-contact-us" className="cookies-section" aria-labelledby="cookies-h-contact">
            <h2 id="cookies-h-contact">9. Contact Us</h2>
            <p>If you have questions about our use of cookies or this policy, please contact us:</p>
            <div className="cookies-contact-block">
              <p>
                <strong>Step Weave</strong> · Foxhill AI LLC
              </p>
              <p>
                <strong>Email:</strong> <a href="mailto:stepweave_admin@foxhillai.com">stepweave_admin@foxhillai.com</a>
              </p>
              <p>
                <strong>Mail:</strong> 9878 W. Belleview Ave, Suite 2393, Denver, CO 80123
              </p>
            </div>
            <p>
              We aim to respond to all inquiries within <strong>5 business days</strong>.
            </p>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  )
}
