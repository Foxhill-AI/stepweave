import Link from 'next/link'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import '../homepage.css'
import './terms.css'

export const metadata: Metadata = {
  title: 'Terms of Service | Step Weave',
  description:
    'Terms of Service for Step Weave: accounts, marketplace, payments, orders, AI design tools, and governing law (Foxhill AI LLC).',
}

export default function TermsPage() {
  return (
    <div className="homepage">
      <Navbar />
      <Subnavbar />
      <main className="homepage-main" role="main">
        <article className="terms-page">
          <h1 className="terms-page-title">Terms of Service</h1>
          <p className="terms-page-meta">
            <strong>Last updated:</strong> May 2026
          </p>

          <hr />

          <nav aria-label="Table of contents">
            <h2 className="terms-toc-heading">Table of Contents</h2>
            <ol className="terms-toc">
              <li>
                <a href="#1-accepting-these-terms">Accepting These Terms</a>
              </li>
              <li>
                <a href="#2-eligibility-and-accounts">Eligibility and Accounts</a>
              </li>
              <li>
                <a href="#3-designers-and-sellers">Designers and Sellers</a>
              </li>
              <li>
                <a href="#4-buyers">Buyers</a>
              </li>
              <li>
                <a href="#5-community-standards">Community Standards</a>
              </li>
              <li>
                <a href="#6-intellectual-property">Intellectual Property</a>
              </li>
              <li>
                <a href="#7-payments-and-fees">Payments and Fees</a>
              </li>
              <li>
                <a href="#8-design-tools-and-ai-features">Design Tools and AI Features</a>
              </li>
              <li>
                <a href="#9-orders-manufacturing-shipping-and-returns">
                  Orders, Manufacturing, Shipping, and Returns
                </a>
              </li>
              <li>
                <a href="#10-disclaimers-and-limitation-of-liability">Disclaimers and Limitation of Liability</a>
              </li>
              <li>
                <a href="#11-account-suspension-and-termination">Account Suspension and Termination</a>
              </li>
              <li>
                <a href="#12-disputes-and-governing-law">Disputes and Governing Law</a>
              </li>
              <li>
                <a href="#13-general-provisions">General Provisions</a>
              </li>
              <li>
                <a href="#14-contact-us">Contact Us</a>
              </li>
            </ol>
          </nav>

          <hr />

          <section id="1-accepting-these-terms" className="terms-section" aria-labelledby="terms-h-accepting">
            <h2 id="terms-h-accepting">1. Accepting These Terms</h2>
            <p>
              By accessing or using Step Weave — whether to browse, design, buy, or sell — you agree to these Terms of
              Service. If you are using Step Weave on behalf of a business or organization, you confirm that you have the
              authority to bind that entity to these Terms.
            </p>
            <p>
              We may update these Terms from time to time. When we do, we will update the <strong>Last updated</strong>{' '}
              date at the top of this page. For material changes, we will notify you by email or through a prominent
              notice on the site. Continued use of Step Weave after changes are posted constitutes your acceptance of the
              updated Terms.
            </p>
          </section>

          <hr />

          <section id="2-eligibility-and-accounts" className="terms-section" aria-labelledby="terms-h-eligibility">
            <h2 id="terms-h-eligibility">2. Eligibility and Accounts</h2>
            <p>
              <strong>Age.</strong> You must be at least 13 years old to use Step Weave, or older if required by law in
              your region. By creating an account, you confirm you meet the minimum age requirement.
            </p>
            <p>
              <strong>Account Information.</strong> You agree to provide accurate, current, and complete information when
              registering, whether through email/password or a supported sign-in provider such as Google or Meta.
            </p>
            <p>
              <strong>Account Security.</strong> You are responsible for keeping your login credentials confidential. If
              you believe your account has been compromised, notify us immediately at{' '}
              <a href="mailto:legal@stepweave.com">legal@stepweave.com</a>.
            </p>
            <p>
              <strong>Account Responsibility.</strong> You are responsible for all activity that occurs under your
              account. One person may hold one seller account unless we expressly authorize otherwise. We reserve the
              right to suspend or close accounts involved in fraud, abuse, repeated policy violations, illegal activity,
              or conduct that poses a risk to our payment or fulfillment partners.
            </p>
          </section>

          <hr />

          <section id="3-designers-and-sellers" className="terms-section" aria-labelledby="terms-h-sellers">
            <h2 id="terms-h-sellers">3. Designers and Sellers</h2>
            <p>If you list products for sale on Step Weave, you represent and agree that:</p>
            <ul>
              <li>
                <strong>You own or have rights to your content.</strong> Everything you upload or generate for sale —
                including artwork, logos, fonts, photos, AI-generated images, and any likenesses — must be yours to use.
                Printing and selling products using that content must not infringe any copyright, trademark, or right of
                publicity.
              </li>
              <li>
                <strong>Your listings are accurate.</strong> Sizes, colors, print areas, and estimated shipping times
                should reflect realistic print-on-demand outcomes. Mockup images are for illustration purposes — minor
                variations in color, ink, and trim are normal in production.
              </li>
              <li>
                <strong>No counterfeit goods.</strong> Do not sell products that imitate or are likely to be confused with
                another brand&apos;s products unless you have explicit authorization.
              </li>
              <li>
                <strong>Buyers receive physical products only.</strong> Unless you clearly and explicitly offer otherwise,
                buyers are purchasing the finished product — not editable design files or source assets.
              </li>
            </ul>
            <p>
              Step Weave operates primarily as a <strong>platform</strong>. Payments and seller payouts are processed
              through <strong>Stripe</strong>. Order fulfillment is handled through print-on-demand partners such as{' '}
              <strong>Printful</strong>. Your use of those services is also subject to their respective terms.
            </p>
          </section>

          <hr />

          <section id="4-buyers" className="terms-section" aria-labelledby="terms-h-buyers">
            <h2 id="terms-h-buyers">4. Buyers</h2>
            <p>
              Custom shoes and other products on Step Weave are typically <strong>made to order</strong> after you
              purchase. Please review{' '}
              <a href="#9-orders-manufacturing-shipping-and-returns">Section 9</a> carefully for details on refunds, final
              sale policies, shipping, and exceptions.
            </p>
            <p>As a buyer, you are responsible for:</p>
            <ul>
              <li>Providing a correct and complete shipping address at checkout</li>
              <li>Complying with your country&apos;s customs and import laws, including paying any applicable import duties or taxes</li>
              <li>
                Ensuring that any artwork you upload to customize a product does not violate any law or third-party
                rights
              </li>
            </ul>
            <p>
              Chargebacks and payment disputes must be used in good faith. Misuse of dispute processes may result in
              account suspension.
            </p>
            <p>
              Nothing in these Terms limits any rights you have under mandatory consumer protection laws in your
              jurisdiction.
            </p>
          </section>

          <hr />

          <section id="5-community-standards" className="terms-section" aria-labelledby="terms-h-community">
            <h2 id="terms-h-community">5. Community Standards</h2>
            <p>
              Step Weave is a creative community. To keep it safe and welcoming, you may <strong>not</strong> post, upload,
              sell, or share content that:
            </p>
            <ul>
              <li>Infringes any copyright, trademark, patent, or right of publicity</li>
              <li>Sexually exploits minors in any way</li>
              <li>Depicts or promotes non-consensual intimate imagery</li>
              <li>Incites hatred or serious violence against individuals or groups</li>
              <li>Facilitates illegal drug sales or other illegal transactions</li>
              <li>Spreads malware, phishing links, or scams</li>
              <li>
                Impersonates Step Weave, Stripe, any fulfillment partner, or any other person or entity in a misleading
                way
              </li>
            </ul>
            <p>
              We actively moderate content. Violations may result in content removal, account suspension, or permanent
              bans. Payment holds may also be applied when required by our payment partners.
            </p>
            <p>
              <strong>Intellectual Property Complaints.</strong> If you believe your intellectual property rights have
              been violated, email <a href="mailto:legal@stepweave.com">legal@stepweave.com</a> with a description of the
              issue, relevant links or order/product IDs, and your contact information. Filing false or bad-faith reports
              may have consequences.
            </p>
            <p>
              Our day-to-day community expectations are further described in our <Link href="/guidelines">Community Guidelines</Link>.
            </p>
          </section>

          <hr />

          <section id="6-intellectual-property" className="terms-section" aria-labelledby="terms-h-ip">
            <h2 id="terms-h-ip">6. Intellectual Property</h2>
            <p>
              <strong>Your Content.</strong> You retain ownership of designs and listing content you have the right to
              publish. By posting content on Step Weave, you grant Foxhill AI LLC a non-exclusive, worldwide license to:
            </p>
            <ul>
              <li>Host, display, and technically process your content as needed to operate the platform</li>
              <li>Deliver print-ready files to fulfillment partners for paid orders</li>
              <li>
                Use limited previews of your designs for featured placements or marketing, where permitted by the product
                or feature
              </li>
            </ul>
            <p>
              This license ends when you delete your content, except for content required to fulfill existing orders,
              comply with legal obligations, or maintain necessary business records.
            </p>
            <p>
              <strong>Step Weave Brand and Technology.</strong> The Step Weave name, logos, design tools, integrations,
              prompts, and user interface are owned by Foxhill AI LLC, except where open-source components are credited
              separately.
            </p>
            <p>
              <strong>Feedback.</strong> If you share unsolicited feedback or ideas about Step Weave, we may use them
              freely to improve our products unless prohibited by law.
            </p>
          </section>

          <hr />

          <section id="7-payments-and-fees" className="terms-section" aria-labelledby="terms-h-payments">
            <h2 id="terms-h-payments">7. Payments and Fees</h2>
            <p>
              <strong>Payment Processing.</strong> All payments and seller payouts are processed through{' '}
              <a href="https://stripe.com/legal" target="_blank" rel="noopener noreferrer">
                Stripe
              </a>
              . By using Step Weave as a seller, you also agree to Stripe&apos;s{' '}
              <a href="https://stripe.com/legal/ssa" target="_blank" rel="noopener noreferrer">
                Services Agreement
              </a>{' '}
              and, where applicable, their{' '}
              <a href="https://stripe.com/connect-account/legal" target="_blank" rel="noopener noreferrer">
                Connected Account Agreement
              </a>
              .
            </p>
            <p>
              <strong>Platform Fee.</strong> On marketplace sales, Step Weave deducts a platform fee from each
              qualifying transaction. The default platform fee is <strong>15%</strong> of the merchandise subtotal (1,500
              basis points), unless otherwise configured. Fees are subject to change with notice.
            </p>
            <p>
              <strong>Subscriptions.</strong> If subscription plans are offered, current pricing will be listed on our{' '}
              <Link href="/pricing">Pricing page</Link> and reflected in Stripe receipts.
            </p>
            <p>
              <strong>Payout Timing.</strong> Seller payout speed, Stripe processing fees, reserves, holds, and instant
              payout options are governed by Stripe and displayed within your Stripe dashboard.
            </p>
            <p>
              <strong>Taxes.</strong> Sellers are generally responsible for their own tax obligations. If Step Weave
              assumes merchant-of-record status for any jurisdiction, we will communicate that arrangement separately.
            </p>
            <p>
              <strong>Refunds.</strong> When a buyer refund is warranted under Section 9, we process it in accordance
              with Stripe&apos;s timelines and our print-on-demand partners&apos; policies.
            </p>
          </section>

          <hr />

          <section id="8-design-tools-and-ai-features" className="terms-section" aria-labelledby="terms-h-ai">
            <h2 id="terms-h-ai">8. Design Tools and AI Features</h2>
            <p>
              Step Weave provides design tools, AI-assisted features, image generation (powered in part by partners such as
              OpenAI and Fal), and file storage (via services such as Supabase). These tools are provided to assist your
              creative process — they are not a substitute for your own judgment and review.
            </p>
            <p>
              <strong>You are responsible for everything you publish and sell.</strong> Always preview your designs before
              making listings live. Do not attempt to use our tools to generate, upload, or sell content that violates
              these Terms or applicable law.
            </p>
          </section>

          <hr />

          <section
            id="9-orders-manufacturing-shipping-and-returns"
            className="terms-section"
            aria-labelledby="terms-h-orders"
          >
            <h2 id="terms-h-orders">9. Orders, Manufacturing, Shipping, and Returns</h2>

            <h3 id="orders-how">How Orders Work</h3>
            <p>
              After you complete a purchase, we transmit your order and print files to our print-on-demand partner(s) for
              fulfillment. Products are typically <strong>printed on demand</strong>, meaning each item is manufactured
              after your order is placed.
            </p>

            <h3 id="orders-manufacturing-location">Manufacturing Location</h3>
            <p>
              Step Weave shoes and other products may be manufactured <strong>outside the United States</strong>,
              including in countries such as mainland China or other regions used by our fulfillment partners. Production
              location may vary by product or partner.
            </p>

            <h3 id="orders-international">International Shipping and Customs</h3>
            <p>If your order ships internationally, you are responsible for:</p>
            <ul>
              <li>
                Any <strong>import duties, taxes, customs fees, or brokerage charges</strong> assessed by your destination
                country
              </li>
              <li>Ensuring that your order complies with your local import laws</li>
              <li>Providing accurate customs declarations</li>
            </ul>
            <p>
              Step Weave does not control customs agencies and cannot be held responsible for delays, seizures, or
              additional charges resulting from customs clearance. Packages refused at the border, seized due to illegal
              content, or affected by sanctions issues are generally the buyer&apos;s responsibility unless local law
              provides otherwise.
            </p>

            <h3 id="orders-delivery">Delivery Timelines</h3>
            <p>
              Estimated delivery windows are <strong>estimates only</strong>. Delays caused by weather, carrier issues,
              customs holdups, supplier disruptions, or other factors outside our control do not automatically entitle you
              to a refund, except where required by statute.
            </p>

            <h3 id="orders-final-sale">Final Sale Policy</h3>
            <p>The following situations are generally <strong>final sale</strong> and not eligible for cancellation or return:</p>
            <ul>
              <li>Ordering the wrong size</li>
              <li>Color differences between your screen and the printed product</li>
              <li>Change of mind after ordering</li>
              <li>Accidental duplicate orders</li>
              <li>Normal print-on-demand variation within industry tolerances</li>
            </ul>
            <p>Once production has begun, cancellation may not be possible.</p>
            <blockquote className="terms-note">
              <p>
                <strong>Note:</strong> Mandatory consumer protection laws in your jurisdiction (such as EU or UK consumer
                rights) may provide rights that override the above. Those rights are not affected by these Terms.
              </p>
            </blockquote>

            <h3 id="orders-exceptions">Exceptions — Contact Us</h3>
            <p>
              Email <a href="mailto:legal@stepweave.com">legal@stepweave.com</a> promptly with photos and your
              order/product ID if:
            </p>
            <ul>
              <li>
                <strong>(a)</strong> The print has a <strong>material defect</strong> — not normal POD variation
              </li>
              <li>
                <strong>(b)</strong> You received the <strong>wrong item or SKU</strong>
              </li>
              <li>
                <strong>(c)</strong> The carrier or fulfillment partner has declared the shipment <strong>lost</strong>,
                within 14 days after the expected delivery date or 14 days after tracking has stalled past the estimated
                arrival
              </li>
            </ul>
            <p>
              We will work with you on a fair resolution — replacement, rework, or a Stripe refund or credit — subject to
              our partners&apos; policies.
            </p>
            <p>
              Abusing refund or chargeback processes after legitimate deliveries may result in account suspension or
              payout freezes.
            </p>
          </section>

          <hr />

          <section id="10-disclaimers-and-limitation-of-liability" className="terms-section" aria-labelledby="terms-h-liab">
            <h2 id="terms-h-liab">10. Disclaimers and Limitation of Liability</h2>
            <p>
              Step Weave is provided <strong>&quot;as is&quot; and &quot;as available.&quot;</strong> We make no warranties
              — express or implied — about uninterrupted access, error-free operation, or results from using the platform.
              Product colors may vary from screen to print. AI and design tools may produce imperfect results.
            </p>
            <p>Your mandatory consumer rights under applicable law are not affected by this section.</p>
            <p>
              <strong>Liability Cap.</strong> To the extent permitted by law, Foxhill AI LLC&apos;s total liability to you
              arising from your use of Step Weave is limited to the <strong>greater of</strong>:
            </p>
            <ul>
              <li>
                The total <strong>platform fees</strong> Foxhill AI LLC actually retained (not pass-through payouts) in the{' '}
                <strong>12 months before your claim</strong>, or
              </li>
              <li>
                <strong>USD $100</strong>
              </li>
            </ul>
            <p>This cap does not apply to liabilities that cannot be limited by law.</p>
          </section>

          <hr />

          <section
            id="11-account-suspension-and-termination"
            className="terms-section"
            aria-labelledby="terms-h-termination"
          >
            <h2 id="terms-h-termination">11. Account Suspension and Termination</h2>
            <p>
              You may stop using Step Weave at any time. To request deletion of your personal data, see our{' '}
              <Link href="/privacy">Privacy Policy</Link>.
            </p>
            <p>
              We may suspend or terminate accounts that violate these Terms, with or without notice depending on the
              severity of the violation. Following termination, certain records may be retained for legal compliance,
              accounting obligations, Stripe requirements, or resolution of outstanding orders.
            </p>
          </section>

          <hr />

          <section id="12-disputes-and-governing-law" className="terms-section" aria-labelledby="terms-h-disputes">
            <h2 id="terms-h-disputes">12. Disputes and Governing Law</h2>
            <p>
              <strong>Contact Us First.</strong> If you have a dispute with Step Weave, please email{' '}
              <a href="mailto:legal@stepweave.com">legal@stepweave.com</a> before initiating formal proceedings. Most
              issues can be resolved quickly this way.
            </p>
            <p>
              <strong>Governing Law.</strong> These Terms are governed by the laws of the{' '}
              <strong>State of Colorado</strong>, without regard to its conflict-of-law principles.
            </p>
            <p>
              <strong>Venue.</strong> Any disputes not resolved informally shall be brought exclusively in the state or
              federal courts located in <strong>Denver, Colorado</strong>, and you consent to personal jurisdiction in
              those courts.
            </p>
            <p>
              <strong>Consumer Rights Abroad.</strong> Buyers in the EU, UK, or other jurisdictions with mandatory
              consumer protections may have the right to bring claims in their local courts. Nothing in this section is
              intended to waive rights that cannot legally be waived.
            </p>
            <blockquote className="terms-note">
              <p>
                <strong>Note for counsel:</strong> This section should be reviewed by a qualified attorney to address
                arbitration clauses, class-action waivers, jury waivers, and any mandatory consumer dispute resolution
                requirements applicable to the jurisdictions where you operate.
              </p>
            </blockquote>
          </section>

          <hr />

          <section id="13-general-provisions" className="terms-section" aria-labelledby="terms-h-general">
            <h2 id="terms-h-general">13. General Provisions</h2>
            <p>
              These Terms, together with our <Link href="/privacy">Privacy Policy</Link>,{' '}
              <Link href="/cookies">Cookie Policy</Link>, and <Link href="/guidelines">Community Guidelines</Link>,
              constitute the entire agreement between you and Foxhill AI LLC regarding your use of Step Weave. Payment
              processors such as Stripe have their own agreements that you accept directly with them.
            </p>
            <p>
              If any provision of these Terms is found to be unenforceable, the remaining provisions continue in full
              force. Failure to enforce any provision on one occasion does not waive our right to enforce it in the
              future.
            </p>
          </section>

          <hr />

          <section id="14-contact-us" className="terms-section" aria-labelledby="terms-h-contact">
            <h2 id="terms-h-contact">14. Contact Us</h2>
            <div className="terms-contact-block">
              <p>
                StepWeave.com is owned and maintained by Foxhill AI LLC
              </p>
              <p>
                <strong>Mailing Address:</strong> 9878 W. Belleview Ave, Suite 2393, Denver, CO 80123
              </p>
              <p>
                <strong>Support &amp; Trust &amp; Safety:</strong>{' '}
                <a href="mailto:stepweave_legal@foxhillai.com">stepweave_legal@foxhillai.com</a>
              </p>
              <p>
                <strong>IP / DMCA Notices:</strong>{' '}
                <a href="mailto:stepweave_legal@foxhillai.com">stepweave_legal@foxhillai.com</a>
              </p>
            </div>
            <p>We aim to respond within 2–3 business days.</p>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  )
}
