import Link from 'next/link'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import '../homepage.css'
import './privacy.css'

export const metadata: Metadata = {
  title: 'Privacy Policy | Step Weave',
  description:
    'How Step Weave (Foxhill AI LLC) collects, uses, shares, and protects personal information — cookies, retention, security, GDPR, CCPA, and contact.',
}

export default function PrivacyPage() {
  return (
    <div className="homepage">
      <Navbar />
      <Subnavbar />
      <main className="homepage-main" role="main">
        <article className="privacy-page">
          <h1 className="privacy-page-title">Privacy Policy</h1>
          <p className="privacy-page-meta">
            <strong>Last updated:</strong> May 2026
          </p>

          <p className="privacy-page-intro">
            <strong>Step Weave</strong> is operated by <strong>Foxhill AI LLC</strong>, located at 9878 W. Belleview Ave,
            Suite 2393, Denver, CO 80123. This Privacy Policy explains what personal information we collect, how we use
            it, who we share it with, and what rights you have over your data.
          </p>
          <p className="privacy-page-intro">
            By using Step Weave, you agree to the practices described in this policy. This policy applies to our website at{' '}
            <a href="https://www.stepweave.com">https://www.stepweave.com</a> and all related services.
          </p>

          <blockquote className="privacy-note">
            <p>
              <strong>Note:</strong> Have a qualified attorney review this before publishing, particularly if you sell to
              customers in the EU, UK, or California.
            </p>
          </blockquote>

          <hr />

          <nav aria-label="Table of contents">
            <h2 className="privacy-toc-heading">Table of Contents</h2>
            <ol className="privacy-toc">
              <li>
                <a href="#1-information-we-collect">Information We Collect</a>
              </li>
              <li>
                <a href="#2-how-we-use-your-information">How We Use Your Information</a>
              </li>
              <li>
                <a href="#3-how-we-share-your-information">How We Share Your Information</a>
              </li>
              <li>
                <a href="#4-cookies-and-tracking-technologies">Cookies and Tracking Technologies</a>
              </li>
              <li>
                <a href="#5-data-retention">Data Retention</a>
              </li>
              <li>
                <a href="#6-data-security">Data Security</a>
              </li>
              <li>
                <a href="#7-international-data-transfers">International Data Transfers</a>
              </li>
              <li>
                <a href="#8-childrens-privacy">Children&apos;s Privacy</a>
              </li>
              <li>
                <a href="#9-your-privacy-rights">Your Privacy Rights</a>
              </li>
              <li>
                <a href="#10-california-residents-ccpa">California Residents (CCPA)</a>
              </li>
              <li>
                <a href="#11-eu-and-uk-residents-gdpr--uk-gdpr">EU and UK Residents (GDPR / UK GDPR)</a>
              </li>
              <li>
                <a href="#12-third-party-links">Third-Party Links</a>
              </li>
              <li>
                <a href="#13-changes-to-this-policy">Changes to This Policy</a>
              </li>
              <li>
                <a href="#14-contact-us">Contact Us</a>
              </li>
            </ol>
          </nav>

          <hr />

          <section id="1-information-we-collect" className="privacy-section" aria-labelledby="privacy-h-collect">
            <h2 id="privacy-h-collect">1. Information We Collect</h2>
            <p>We collect information in three ways: directly from you, automatically when you use the site, and from third-party partners.</p>

            <h3 id="privacy-h-collect-direct">Information You Provide Directly</h3>
            <ul>
              <li>
                <strong>Account information</strong> — name, email address, username, and password when you register
              </li>
              <li>
                <strong>Profile information</strong> — profile photo, bio, or social links you choose to add
              </li>
              <li>
                <strong>Design and content uploads</strong> — artwork, images, and other files you upload to create or
                customize products
              </li>
              <li>
                <strong>Order information</strong> — shipping address, product selections, and order notes when you make
                a purchase
              </li>
              <li>
                <strong>Payment information</strong> — billing details entered at checkout (note: full card numbers are
                handled directly by Stripe and are never stored on our servers)
              </li>
              <li>
                <strong>Communications</strong> — messages you send to our support team or other users through the
                platform
              </li>
              <li>
                <strong>Social features</strong> — designs you share publicly, comments, likes, and other community
                interactions
              </li>
            </ul>

            <h3 id="privacy-h-collect-auto">Information Collected Automatically</h3>
            <p>When you visit or use Step Weave, we automatically collect:</p>
            <ul>
              <li>
                <strong>Device and browser information</strong> — device type, operating system, browser type and
                version
              </li>
              <li>
                <strong>Usage data</strong> — pages visited, features used, time spent on the site, clicks, and navigation
                paths
              </li>
              <li>
                <strong>IP address</strong> — used to estimate your general location (city/region level) and for security
                purposes
              </li>
              <li>
                <strong>Cookies and similar technologies</strong> — see{' '}
                <a href="#4-cookies-and-tracking-technologies">Section 4</a> for details
              </li>
              <li>
                <strong>Log data</strong> — server logs including access times, error logs, and referring URLs
              </li>
            </ul>

            <h3 id="privacy-h-collect-third">Information from Third Parties</h3>
            <ul>
              <li>
                <strong>Sign-in providers</strong> — if you log in via Google or Meta, we receive your name, email
                address, and profile photo from that provider, subject to your settings with them
              </li>
              <li>
                <strong>Payment processors</strong> — Stripe provides us with transaction confirmations, payout
                statuses, and fraud signals; we do not receive your full card number
              </li>
              <li>
                <strong>Fulfillment partners</strong> — print-on-demand partners such as Printful may share order status
                and shipping tracking information with us
              </li>
              <li>
                <strong>AI and design tool partners</strong> — partners such as OpenAI and Fal may process design prompts
                or images you submit through our design tools
              </li>
            </ul>
          </section>

          <hr />

          <section id="2-how-we-use-your-information" className="privacy-section" aria-labelledby="privacy-h-use">
            <h2 id="privacy-h-use">2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>
                <strong>Operate the platform</strong> — create and manage your account, process orders, deliver products,
                and provide customer support
              </li>
              <li>
                <strong>Process payments</strong> — facilitate secure transactions through Stripe and manage seller payouts
              </li>
              <li>
                <strong>Fulfill orders</strong> — transmit print files and shipping details to our manufacturing and
                fulfillment partners
              </li>
              <li>
                <strong>Provide design tools</strong> — power AI-assisted design features, image generation, and file
                storage
              </li>
              <li>
                <strong>Enable community features</strong> — display your public designs, enable social sharing, and
                support community interactions
              </li>
              <li>
                <strong>Communicate with you</strong> — send order confirmations, shipping updates, support responses, and
                important account notices
              </li>
              <li>
                <strong>Send marketing communications</strong> — with your consent, send newsletters, promotions, or
                product updates (you can opt out at any time)
              </li>
              <li>
                <strong>Improve our services</strong> — analyze usage patterns, troubleshoot issues, and develop new
                features
              </li>
              <li>
                <strong>Ensure security</strong> — detect and prevent fraud, abuse, and unauthorized access
              </li>
              <li>
                <strong>Comply with legal obligations</strong> — meet applicable tax, accounting, and regulatory
                requirements
              </li>
            </ul>
            <p>We do not sell your personal information to third parties for their own marketing purposes.</p>
          </section>

          <hr />

          <section id="3-how-we-share-your-information" className="privacy-section" aria-labelledby="privacy-h-share">
            <h2 id="privacy-h-share">3. How We Share Your Information</h2>
            <p>We share your information only in the following circumstances:</p>

            <h3 id="privacy-h-share-providers">Service Providers and Partners</h3>
            <p>We share information with companies that help us operate Step Weave, including:</p>
            <ul>
              <li>
                <strong>Stripe</strong> — payment processing, seller payouts, and fraud prevention
              </li>
              <li>
                <strong>Printful and other POD partners</strong> — order fulfillment and manufacturing; they receive your
                shipping address and print files for paid orders
              </li>
              <li>
                <strong>Supabase</strong> — file and data storage
              </li>
              <li>
                <strong>OpenAI / Fal</strong> — AI-powered design and image generation features
              </li>
              <li>
                <strong>Google / Meta</strong> — if you use social sign-in
              </li>
              <li>
                <strong>Email and analytics providers</strong> — to send transactional and marketing emails and analyze site
                usage
              </li>
            </ul>
            <p>
              These partners are contractually required to use your information only to provide services to us and to
              protect it appropriately.
            </p>

            <h3 id="privacy-h-share-public">Public Content</h3>
            <p>
              Designs, listings, and profile information you choose to make <strong>public</strong> on Step Weave are
              visible to other users and may be indexed by search engines. Think carefully about what you share publicly.
            </p>

            <h3 id="privacy-h-share-business">Business Transfers</h3>
            <p>
              If Foxhill AI LLC is involved in a merger, acquisition, or sale of assets, your information may be
              transferred as part of that transaction. We will notify you via email or a prominent notice on the site
              before your information is transferred and becomes subject to a different privacy policy.
            </p>

            <h3 id="privacy-h-share-legal">Legal Requirements</h3>
            <p>We may disclose your information if we believe in good faith that doing so is necessary to:</p>
            <ul>
              <li>Comply with a legal obligation, court order, or government request</li>
              <li>Protect the rights, property, or safety of Step Weave, our users, or the public</li>
              <li>Detect, prevent, or address fraud, security, or technical issues</li>
            </ul>

            <h3 id="privacy-h-share-consent">With Your Consent</h3>
            <p>We may share your information for other purposes with your explicit consent.</p>
          </section>

          <hr />

          <section id="4-cookies-and-tracking-technologies" className="privacy-section" aria-labelledby="privacy-h-cookies">
            <h2 id="privacy-h-cookies">4. Cookies and Tracking Technologies</h2>
            <p>
              We use cookies and similar technologies (such as pixels and local storage) to operate and improve Step
              Weave.
            </p>

            <h3 id="privacy-h-cookie-types">Types of Cookies We Use</h3>
            <ul>
              <li>
                <strong>Essential cookies</strong> — required for the site to function, such as keeping you logged in
                and remembering items in your cart. These cannot be disabled.
              </li>
              <li>
                <strong>Analytics cookies</strong> — help us understand how visitors use the site so we can improve it
                (e.g., Google Analytics)
              </li>
              <li>
                <strong>Preference cookies</strong> — remember your settings and preferences across visits
              </li>
              <li>
                <strong>Marketing cookies</strong> — used to deliver relevant advertising and track the effectiveness of
                campaigns (only with your consent)
              </li>
            </ul>

            <h3 id="privacy-h-cookie-choices">Your Cookie Choices</h3>
            <p>
              You can manage cookie preferences through our cookie consent banner when you first visit the site, or at any
              time through your browser settings. Disabling certain cookies may affect site functionality.
            </p>
            <p>
              For more details, see our <Link href="/cookies">Cookie Policy</Link>.
            </p>
          </section>

          <hr />

          <section id="5-data-retention" className="privacy-section" aria-labelledby="privacy-h-retention">
            <h2 id="privacy-h-retention">5. Data Retention</h2>
            <p>We retain your personal information for as long as necessary to:</p>
            <ul>
              <li>Maintain your account and provide our services</li>
              <li>
                Fulfill legal, tax, and accounting obligations (typically 7 years for financial records under U.S. law)
              </li>
              <li>Resolve disputes and enforce our agreements</li>
              <li>Comply with any applicable legal hold or regulatory requirement</li>
            </ul>
            <p>
              When you delete your account, we will delete or anonymize your personal information within a reasonable
              period, except for information we are required to retain by law or for legitimate business purposes such as
              completed order records.
            </p>
            <p>
              Design files and content you have deleted will be removed from active systems, though they may persist in
              backups for a limited period.
            </p>
          </section>

          <hr />

          <section id="6-data-security" className="privacy-section" aria-labelledby="privacy-h-security">
            <h2 id="privacy-h-security">6. Data Security</h2>
            <p>We take reasonable technical and organizational measures to protect your personal information, including:</p>
            <ul>
              <li>Encryption of data in transit (TLS/HTTPS)</li>
              <li>Secure file storage through Supabase</li>
              <li>Access controls limiting who within our organization can access personal data</li>
              <li>Use of PCI-compliant payment processing through Stripe (we never store full card numbers)</li>
            </ul>
            <p>
              No system is completely secure. While we work hard to protect your information, we cannot guarantee absolute
              security. If you believe your account has been compromised, contact us immediately at{' '}
              <a href="mailto:legal@stepweave.com">legal@stepweave.com</a>.
            </p>
            <p>
              In the event of a data breach that affects your rights or freedoms, we will notify affected users and
              relevant authorities as required by applicable law.
            </p>
          </section>

          <hr />

          <section id="7-international-data-transfers" className="privacy-section" aria-labelledby="privacy-h-transfers">
            <h2 id="privacy-h-transfers">7. International Data Transfers</h2>
            <p>
              Step Weave is operated from the United States. If you are located outside the U.S., your information will
              be transferred to and processed in the United States, where data protection laws may differ from those in
              your country.
            </p>
            <p>
              Where required by law (for example, for EU/UK users), we rely on appropriate transfer mechanisms such as
              Standard Contractual Clauses to ensure your data is protected when transferred internationally.
            </p>
            <p>
              Your order may also be fulfilled by manufacturing partners located in other countries, including mainland
              China or other regions used by our fulfillment partners. Only the information necessary to fulfill your order
              (shipping address and print files) is shared with those partners.
            </p>
          </section>

          <hr />

          <section id="8-childrens-privacy" className="privacy-section" aria-labelledby="privacy-h-children">
            <h2 id="privacy-h-children">8. Children&apos;s Privacy</h2>
            <p>
              Step Weave is not directed at children under the age of 13. We do not knowingly collect personal information
              from children under 13. If we become aware that we have collected personal information from a child under 13
              without parental consent, we will take steps to delete that information promptly.
            </p>
            <p>
              If you believe a child under 13 has provided us with personal information, please contact us at{' '}
              <a href="mailto:legal@stepweave.com">legal@stepweave.com</a>.
            </p>
          </section>

          <hr />

          <section id="9-your-privacy-rights" className="privacy-section" aria-labelledby="privacy-h-rights">
            <h2 id="privacy-h-rights">9. Your Privacy Rights</h2>
            <p>Regardless of where you live, you have the following rights with respect to your personal information:</p>
            <ul>
              <li>
                <strong>Access</strong> — request a copy of the personal information we hold about you
              </li>
              <li>
                <strong>Correction</strong> — ask us to correct inaccurate or incomplete information
              </li>
              <li>
                <strong>Deletion</strong> — request that we delete your personal information, subject to legal retention
                requirements
              </li>
              <li>
                <strong>Opt out of marketing</strong> — unsubscribe from marketing emails at any time using the
                unsubscribe link in any email, or by contacting us
              </li>
              <li>
                <strong>Data portability</strong> — request your data in a portable, machine-readable format where
                technically feasible
              </li>
            </ul>
            <p>
              To exercise any of these rights, email us at <a href="mailto:legal@stepweave.com">legal@stepweave.com</a>.
              We will respond within 30 days. We may need to verify your identity before processing your request.
            </p>
          </section>

          <hr />

          <section id="10-california-residents-ccpa" className="privacy-section" aria-labelledby="privacy-h-ccpa">
            <h2 id="privacy-h-ccpa">10. California Residents (CCPA)</h2>
            <p>
              If you are a California resident, you have additional rights under the{' '}
              <strong>California Consumer Privacy Act (CCPA)</strong> and the{' '}
              <strong>California Privacy Rights Act (CPRA)</strong>:
            </p>
            <ul>
              <li>
                <strong>Right to Know</strong> — request disclosure of the categories and specific pieces of personal
                information we have collected about you, and how it is used and shared
              </li>
              <li>
                <strong>Right to Delete</strong> — request deletion of your personal information, subject to certain
                exceptions
              </li>
              <li>
                <strong>Right to Correct</strong> — request correction of inaccurate personal information
              </li>
              <li>
                <strong>Right to Opt Out of Sale or Sharing</strong> — we do not sell or share your personal information
                for cross-context behavioral advertising
              </li>
              <li>
                <strong>Right to Non-Discrimination</strong> — we will not discriminate against you for exercising your
                CCPA rights
              </li>
            </ul>
            <p>
              <strong>Categories of personal information collected</strong> (as defined by the CCPA):
            </p>
            <div className="privacy-table-wrap">
              <table className="privacy-table">
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    <th scope="col">Examples</th>
                    <th scope="col">Collected</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Identifiers</td>
                    <td>Name, email, IP address</td>
                    <td>Yes</td>
                  </tr>
                  <tr>
                    <td>Commercial information</td>
                    <td>Purchase history, products viewed</td>
                    <td>Yes</td>
                  </tr>
                  <tr>
                    <td>Internet / electronic activity</td>
                    <td>Browsing behavior on our site</td>
                    <td>Yes</td>
                  </tr>
                  <tr>
                    <td>Geolocation data</td>
                    <td>City/region from IP address</td>
                    <td>Yes</td>
                  </tr>
                  <tr>
                    <td>Visual / audio content</td>
                    <td>Design uploads, profile photos</td>
                    <td>Yes</td>
                  </tr>
                  <tr>
                    <td>Inferences</td>
                    <td>Preferences based on activity</td>
                    <td>Yes</td>
                  </tr>
                  <tr>
                    <td>Financial information</td>
                    <td>Payment details (processed by Stripe)</td>
                    <td>Limited</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              To submit a CCPA request, email <a href="mailto:legal@stepweave.com">legal@stepweave.com</a> or use the
              contact information in <a href="#14-contact-us">Section 14</a>. You may also authorize an agent to make a
              request on your behalf.
            </p>
          </section>

          <hr />

          <section id="11-eu-and-uk-residents-gdpr--uk-gdpr" className="privacy-section" aria-labelledby="privacy-h-gdpr">
            <h2 id="privacy-h-gdpr">11. EU and UK Residents (GDPR / UK GDPR)</h2>
            <p>
              If you are located in the European Union or United Kingdom, the <strong>General Data Protection Regulation
              (GDPR)</strong> or <strong>UK GDPR</strong> applies to your personal data.
            </p>

            <h3 id="privacy-h-gdpr-bases">Legal Bases for Processing</h3>
            <p>We process your personal data on the following legal bases:</p>
            <ul>
              <li>
                <strong>Contract performance</strong> — to fulfill your orders, manage your account, and provide our
                services
              </li>
              <li>
                <strong>Legitimate interests</strong> — to improve our platform, prevent fraud, and communicate relevant
                updates, where these interests are not overridden by your rights
              </li>
              <li>
                <strong>Legal obligation</strong> — to comply with applicable laws and regulations
              </li>
              <li>
                <strong>Consent</strong> — for marketing communications and non-essential cookies, where required
              </li>
            </ul>

            <h3 id="privacy-h-gdpr-rights">Your GDPR Rights</h3>
            <p>In addition to the rights in Section 9, you have the right to:</p>
            <ul>
              <li>
                <strong>Restrict processing</strong> — ask us to limit how we use your data in certain circumstances
              </li>
              <li>
                <strong>Object to processing</strong> — object to processing based on legitimate interests or for direct
                marketing
              </li>
              <li>
                <strong>Withdraw consent</strong> — where processing is based on consent, withdraw it at any time without
                affecting the lawfulness of prior processing
              </li>
              <li>
                <strong>Lodge a complaint</strong> — with your local data protection authority (for EU residents, your
                national supervisory authority; for UK residents, the Information Commissioner&apos;s Office)
              </li>
            </ul>

            <h3 id="privacy-h-gdpr-controller">Data Controller</h3>
            <p>The data controller for your personal information is:</p>
            <div className="privacy-contact-block">
              <p>
                <strong>Foxhill AI LLC</strong>
              </p>
              <p>9878 W. Belleview Ave, Suite 2393, Denver, CO 80123</p>
              <p>
                <a href="mailto:legal@stepweave.com">legal@stepweave.com</a>
              </p>
            </div>

            <blockquote className="privacy-note">
              <p>
                <strong>Note for counsel:</strong> If you are actively marketing to EU/UK customers, consider whether you
                need to appoint an EU or UK representative under Article 27 of the GDPR / UK GDPR.
              </p>
            </blockquote>
          </section>

          <hr />

          <section id="12-third-party-links" className="privacy-section" aria-labelledby="privacy-h-links">
            <h2 id="privacy-h-links">12. Third-Party Links</h2>
            <p>
              Step Weave may contain links to third-party websites or services, including Stripe, social media platforms,
              and fulfillment partners. We are not responsible for the privacy practices of those third parties. We
              encourage you to review their privacy policies before providing them with any personal information.
            </p>
          </section>

          <hr />

          <section id="13-changes-to-this-policy" className="privacy-section" aria-labelledby="privacy-h-changes">
            <h2 id="privacy-h-changes">13. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal
              requirements. When we make material changes, we will update the <strong>Last updated</strong> date at the
              top of this page and notify you by email or through a prominent notice on the site.
            </p>
            <p>
              We encourage you to review this policy periodically. Your continued use of Step Weave after changes are
              posted constitutes your acceptance of the updated policy.
            </p>
          </section>

          <hr />

          <section id="14-contact-us" className="privacy-section" aria-labelledby="privacy-h-contact">
            <h2 id="privacy-h-contact">14. Contact Us</h2>
            <p>If you have questions, concerns, or requests related to this Privacy Policy, please contact us:</p>
            <div className="privacy-contact-block">
              <p>
                <strong>Step Weave</strong> · Foxhill AI LLC
              </p>
              <p>
                <strong>Email:</strong> <a href="mailto:legal@stepweave.com">legal@stepweave.com</a>
              </p>
              <p>
                <strong>Mail:</strong> 9878 W. Belleview Ave, Suite 2393, Denver, CO 80123
              </p>
            </div>
            <p>
              We aim to respond to all privacy inquiries within <strong>5 business days</strong>.
            </p>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  )
}
