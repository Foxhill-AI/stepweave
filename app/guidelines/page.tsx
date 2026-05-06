import Link from 'next/link'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import '../homepage.css'
import './guidelines.css'

export const metadata: Metadata = {
  title: 'Community Guidelines | Step Weave',
  description:
    'Family-friendly standards, creator and buyer conduct, intellectual property, AI-generated designs, and how we enforce community rules on Step Weave.',
}

export default function GuidelinesPage() {
  return (
    <div className="homepage">
      <Navbar />
      <Subnavbar />
      <main className="homepage-main" role="main">
        <article className="guidelines-page">
          <h1 className="guidelines-page-title">Community Guidelines</h1>
          <p className="guidelines-page-meta">
            <strong>Last updated:</strong> May 2026
          </p>

          <p className="guidelines-page-intro">
            Step Weave is a creative community built on respect, originality, and a shared love of design.
            Whether you are here to create custom shoes, share your designs with the world, or discover something
            unique to wear — these guidelines exist to make sure Step Weave is a welcoming place for creators and
            buyers of all backgrounds and ages.
          </p>
          <p className="guidelines-page-intro">
            When in doubt, ask yourself: <em>&quot;Would I be comfortable sharing this with my family?&quot;</em> If
            the answer is no, it does not belong on Step Weave.
          </p>

          <hr />

          <nav aria-label="Table of contents">
            <h2 className="guidelines-page-title" style={{ fontSize: '1.25rem', marginBottom: 'var(--spacing-md)' }}>
              Contents
            </h2>
            <ol className="guidelines-toc">
              <li>
                <a href="#1-family-friendly-standard">Family-Friendly Standard</a>
              </li>
              <li>
                <a href="#2-content-standards">Content Standards</a>
              </li>
              <li>
                <a href="#3-creator-and-designer-conduct">Creator and Designer Conduct</a>
              </li>
              <li>
                <a href="#4-buyer-conduct">Buyer Conduct</a>
              </li>
              <li>
                <a href="#5-intellectual-property">Intellectual Property</a>
              </li>
              <li>
                <a href="#6-community-behavior">Community Behavior</a>
              </li>
              <li>
                <a href="#7-ai-generated-designs">AI-Generated Designs</a>
              </li>
              <li>
                <a href="#8-physical-products-and-listings">Physical Products and Listings</a>
              </li>
              <li>
                <a href="#9-enforcement">Enforcement</a>
              </li>
              <li>
                <a href="#10-reporting-a-violation">Reporting a Violation</a>
              </li>
            </ol>
          </nav>

          <hr />

          <section id="1-family-friendly-standard" className="guidelines-section" aria-labelledby="heading-family-friendly">
            <h2 id="heading-family-friendly">1. Family-Friendly Standard</h2>
            <p>
              Step Weave is designed to be a platform that families can use together. All content — designs, product
              listings, comments, profile bios, and usernames — must be appropriate for a general audience that includes
              children and teenagers.
            </p>
            <p>
              We are guided by values of creativity, respect, and community. Content that conflicts with those values —
              even if technically legal — may be removed at our discretion.
            </p>
          </section>

          <hr />

          <section id="2-content-standards" className="guidelines-section" aria-labelledby="heading-content-standards">
            <h2 id="heading-content-standards">2. Content Standards</h2>
            <p>All content on Step Weave must meet these standards:</p>
            <p className="guidelines-item">
              <span aria-hidden>✅</span> <strong>Appropriate for all ages</strong>
              <br />
              Content is suitable for a general audience that includes children and teenagers — free from sexually
              explicit material, nudity, or anything inappropriate for minors.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>✅</span> <strong>Respectful of all people</strong>
              <br />
              Content treats every person with dignity, regardless of race, ethnicity, religion, gender, nationality,
              disability, or sexual orientation.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>✅</span> <strong>Peaceful and uplifting</strong>
              <br />
              Content is free from graphic violence, gore, or anything that glorifies harm to people or animals.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>✅</span> <strong>Lawful and original</strong>
              <br />
              Content complies with all applicable laws — no counterfeit goods, infringing designs, or anything that
              facilitates illegal activity.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>✅</span> <strong>Honest and authentic</strong>
              <br />
              Content is truthful and genuine — not designed to deceive, spread false information, or impersonate real
              people or organizations.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>✅</span> <strong>Safe for every device</strong>
              <br />
              All uploaded files are clean and free from viruses, malware, spyware, or any code that could harm a
              user&apos;s device or our platform.
            </p>
          </section>

          <hr />

          <section
            id="3-creator-and-designer-conduct"
            className="guidelines-section"
            aria-labelledby="heading-creator-conduct"
          >
            <h2 id="heading-creator-conduct">3. Creator and Designer Conduct</h2>
            <p>
              As a designer on Step Weave, you are building a relationship of trust with your buyers and with this
              community. We ask that you uphold the following standards:
            </p>
            <p className="guidelines-item">
              <span aria-hidden>✅</span> <strong>Be honest about your listings</strong>
              <br />
              Accurately describe what buyers will receive. Product sizes, colors, print areas, and estimated shipping
              times should reflect realistic outcomes. Do not use misleading titles, descriptions, or preview images.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>✅</span> <strong>Only sell what you own</strong>
              <br />
              You must have the legal right to sell every design you list. Do not sell work created by others without
              proper licensing or permission. This includes artwork, fonts, logos, photographs, and AI-generated
              images.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>✅</span> <strong>Price fairly</strong>
              <br />
              Do not engage in price manipulation, artificial inflation, or deceptive discount tactics.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>✅</span> <strong>Respond to legitimate disputes</strong>
              <br />
              If a buyer contacts you with a genuine concern, respond in good faith. Ignoring buyers or acting in bad
              faith may result in account action.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>✅</span> <strong>Disclose AI-generated content</strong>
              <br />
              If your design was substantially generated using AI tools, say so in the product description. Buyers
              deserve to know what they are purchasing.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>✅</span> <strong>Respect the print-on-demand process</strong>
              <br />
              Understand that products are manufactured after purchase. Mockup images are for illustration — minor
              variation in color, ink, and trim is normal. Do not create listings that set unrealistic expectations.
            </p>
          </section>

          <hr />

          <section id="4-buyer-conduct" className="guidelines-section" aria-labelledby="heading-buyer-conduct">
            <h2 id="heading-buyer-conduct">4. Buyer Conduct</h2>
            <p className="guidelines-item">
              <span aria-hidden>✅</span> <strong>Respect what you are purchasing</strong>
              <br />
              When you buy a Step Weave product, you are purchasing a physical item manufactured to your order.
              Custom-made products follow the return and refund policies described in our{' '}
              <Link href="/terms">Terms of Service</Link>.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>✅</span> <strong>No chargeback abuse</strong>
              <br />
              Filing fraudulent payment disputes after receiving a product that was correctly fulfilled is prohibited and
              will result in a permanent ban.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>✅</span> <strong>Leave honest feedback</strong>
              <br />
              Reviews and comments should reflect your genuine experience. Do not post fake reviews or use feedback as a
              tool for harassment.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>✅</span> <strong>Upload lawful content</strong>
              <br />
              If Step Weave allows you to upload custom artwork to personalize a product, that artwork must comply with
              these guidelines and all applicable laws. Do not upload content that infringes someone else&apos;s
              intellectual property or is otherwise prohibited under these guidelines.
            </p>
          </section>

          <hr />

          <section id="5-intellectual-property" className="guidelines-section" aria-labelledby="heading-ip">
            <h2 id="heading-ip">5. Intellectual Property</h2>
            <p>
              We take intellectual property seriously. You may not upload, list, or sell content that infringes the
              copyright, trademark, or other intellectual property rights of any third party. This includes:
            </p>
            <p className="guidelines-item">
              <span aria-hidden>🚫</span> Using trademarked logos, brand names, characters, or other protected IP in
              your designs without authorization
            </p>
            <p className="guidelines-item">
              <span aria-hidden>🚫</span> Selling designs based on copyrighted artwork, photos, or graphics you do not
              own or have licensed
            </p>
            <p className="guidelines-item">
              <span aria-hidden>🚫</span> Passing off another creator&apos;s work — human or AI-assisted — as your own
              original creation
            </p>
            <p className="guidelines-item">
              <span aria-hidden>🚫</span> Creating designs that are likely to be confused with an established brand or
              product (counterfeiting)
            </p>
            <p>
              If you believe your intellectual property has been infringed on Step Weave, please contact us at{' '}
              <a href="mailto:legal@stepweave.com">legal@stepweave.com</a> with details of the alleged infringement,
              including links or product/order IDs and your contact information. We will investigate and respond promptly.
              Filing false or bad-faith reports may have consequences.
            </p>
          </section>

          <hr />

          <section id="6-community-behavior" className="guidelines-section" aria-labelledby="heading-community">
            <h2 id="heading-community">6. Community Behavior</h2>
            <p>
              Step Weave includes social features that let you share designs, follow other creators, and engage with the
              community. Communities thrive when people treat each other with dignity. The following behaviors are not
              tolerated:
            </p>
            <p className="guidelines-item">
              <span aria-hidden>🚫</span> <strong>Harassment and bullying</strong>
              <br />
              Targeting, threatening, or intimidating other users in comments, messages, or anywhere on the platform.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>🚫</span> <strong>Spam</strong>
              <br />
              Posting repetitive, off-topic, or promotional content in comments or other community spaces.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>🚫</span> <strong>Impersonation</strong>
              <br />
              Pretending to be another user, creator, brand, or public figure.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>🚫</span> <strong>Coordinated inauthentic behavior</strong>
              <br />
              Artificially inflating likes, follows, views, or sales through bots, purchased engagement, or coordinated
              manipulation.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>🚫</span> <strong>Doxxing</strong>
              <br />
              Sharing another person&apos;s private or personal information without their consent.
            </p>
          </section>

          <hr />

          <section id="7-ai-generated-designs" className="guidelines-section" aria-labelledby="heading-ai">
            <h2 id="heading-ai">7. AI-Generated Designs</h2>
            <p>
              Step Weave provides AI-powered design tools to help creators bring their ideas to life. We embrace AI as
              a creative tool while holding creators accountable for what they publish and sell.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>✅</span> <strong>Review before publishing</strong>
              <br />
              AI can produce errors, unintended content, or designs that inadvertently resemble existing IP. Always
              review AI-generated output carefully before listing a product for sale.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>✅</span> <strong>Disclose AI assistance</strong>
              <br />
              If a design was substantially produced by AI tools, disclose this in your product listing so buyers can
              make informed decisions.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>🚫</span> <strong>Do not use AI to bypass these guidelines</strong>
              <br />
              Using AI to generate content that would otherwise violate our standards is still a violation, regardless of
              how it was created.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>🚫</span> <strong>Do not infringe via AI generation</strong>
              <br />
              Prompting an AI tool to reproduce or closely imitate a copyrighted design, character, or brand does not
              give you the right to sell the result. Ensure you hold the rights before listing.
            </p>
          </section>

          <hr />

          <section
            id="8-physical-products-and-listings"
            className="guidelines-section"
            aria-labelledby="heading-physical"
          >
            <h2 id="heading-physical">8. Physical Products and Listings</h2>
            <p>
              Because Step Weave sells custom physical products — primarily shoes — there are additional standards that
              apply to listings:
            </p>
            <p className="guidelines-item">
              <span aria-hidden>✅</span> <strong>Accurate product representation</strong>
              <br />
              Listing images, descriptions, and size guides must accurately represent the product. Mockup images are not
              perfect previews — color, print placement, and material may vary slightly in production.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>✅</span> <strong>No prohibited items</strong>
              <br />
              Do not list products that are illegal to sell in the jurisdictions where you operate, or that would be
              prohibited by our fulfillment partners.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>✅</span> <strong>No misleading origin claims</strong>
              <br />
              Do not make false claims about where a product is manufactured, its materials, or its quality.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>✅</span> <strong>Respect fulfillment limitations</strong>
              <br />
              Step Weave products are manufactured through print-on-demand partners. Do not make promises about
              production speed, customization options, or delivery timelines that exceed what our platform actually
              supports.
            </p>
          </section>

          <hr />

          <section id="9-enforcement" className="guidelines-section" aria-labelledby="heading-enforcement">
            <h2 id="heading-enforcement">9. Enforcement</h2>
            <p>We review reported content and investigate violations promptly. The action we take depends on the severity and frequency of the violation:</p>
            <p className="guidelines-item">
              <span aria-hidden>⚠️</span> <strong>Warning</strong>
              <br />
              For first-time or minor violations. Content is removed and the account receives a formal notice.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>⏸</span> <strong>Suspension</strong>
              <br />
              For repeat violations or more serious offenses. The account is temporarily suspended while we review. Seller
              payouts may be held during this period.
            </p>
            <p className="guidelines-item">
              <span aria-hidden>🚫</span> <strong>Permanent Ban</strong>
              <br />
              For severe violations — illegal content, fraud, chargeback abuse, counterfeit goods, or repeated offenses
              after suspension. The account is permanently removed from the platform.
            </p>
            <p>
              We reserve the right to remove any content and take action on any account at our discretion, including for
              content that conflicts with our values even if not explicitly listed above.
            </p>
            <p>
              Appeals can be submitted to <a href="mailto:legal@stepweave.com">legal@stepweave.com</a>. Please include
              your account information and a description of why you believe the action was taken in error. We aim to
              respond to appeals within 5 business days.
            </p>
          </section>

          <hr />

          <section id="10-reporting-a-violation" className="guidelines-section" aria-labelledby="heading-reporting">
            <h2 id="heading-reporting">10. Reporting a Violation</h2>
            <p>
              If you see content or behavior that violates these guidelines, please let us know. Our community depends
              on members looking out for one another.
            </p>
            <p className="guidelines-report-block">
              <strong>
                To report a violation, email us at{' '}
                <a href="mailto:legal@stepweave.com">legal@stepweave.com</a>
              </strong>
            </p>
            <p>Please include:</p>
            <ul className="guidelines-list">
              <li>The URL of the content or the username of the account in question</li>
              <li>A brief description of the violation</li>
              <li>Any screenshots or supporting evidence</li>
            </ul>
            <p>
              We review all reports and aim to respond within <strong>2 business days</strong>. Reports are kept
              confidential — the person you report will not be notified of your identity.
            </p>
          </section>

          <p className="guidelines-footer-note">
            These guidelines work together with our{' '}
            <Link href="/terms">Terms of Service</Link>, <Link href="/privacy">Privacy Policy</Link>, and{' '}
            <Link href="/cookies">Cookie Policy</Link>. For questions, contact us at{' '}
            <a href="mailto:legal@stepweave.com">legal@stepweave.com</a>.
          </p>
        </article>
      </main>
      <Footer />
    </div>
  )
}
