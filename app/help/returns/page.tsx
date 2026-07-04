import Link from 'next/link'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import '../../homepage.css'
import '../help.css'

export const metadata: Metadata = {
  title: 'Returns & refunds | Help Center | Step Weave',
  description:
    'Step Weave return and refund policy for custom, made-to-order products. What is and isn’t eligible, and how to request a refund.',
}

export default function ReturnsHelpPage() {
  return (
    <div className="homepage">
      <Navbar />
      <Subnavbar />
      <main className="homepage-main" role="main">
        <article className="help-page">
          <Link href="/help" className="help-back">
            ← Back to Help Center
          </Link>
          <h1 className="help-page-title">Returns &amp; refunds</h1>
          <p className="help-page-intro">
            Step Weave products are made to order, which means our return policy is different from
            a typical retailer. Here&apos;s what you need to know — in plain language. The full,
            legally binding version lives in Section 9 of our{' '}
            <Link href="/terms">Terms of Use</Link>.
          </p>

          <hr />

          <nav aria-label="Table of contents">
            <h2 className="help-toc-heading">In this guide</h2>
            <ol className="help-toc">
              <li>
                <a href="#made-to-order">What &quot;made to order&quot; means for returns</a>
              </li>
              <li>
                <a href="#whats-final-sale">What&apos;s final sale</a>
              </li>
              <li>
                <a href="#whats-eligible">What is eligible for a refund or replacement</a>
              </li>
              <li>
                <a href="#how-to-request">How to request a refund</a>
              </li>
              <li>
                <a href="#mockup-vs-reality">Mockup images vs. the final product</a>
              </li>
              <li>
                <a href="#sizing">Sizing and fit</a>
              </li>
              <li>
                <a href="#consumer-rights">Local consumer rights</a>
              </li>
            </ol>
          </nav>

          <hr />

          <section id="made-to-order" className="help-section">
            <h2>What &quot;made to order&quot; means for returns</h2>
            <p>
              Every Step Weave product is manufactured after you order it. Nothing sits in a
              warehouse waiting to be sold to someone else. That&apos;s great for the planet — but
              it does mean we can&apos;t accept returns the way a regular retailer would, because
              we&apos;d have nowhere to resell the item.
            </p>
            <p>
              In short: change-of-mind returns aren&apos;t available, but if there&apos;s a real
              problem with what we made for you, we will fix it.
            </p>
          </section>

          <hr />

          <section id="whats-final-sale" className="help-section">
            <h2>What&apos;s final sale</h2>
            <p>The following situations are generally final sale and not eligible for return:</p>
            <ul>
              <li>You ordered the wrong size</li>
              <li>The color on your screen looks different from the printed product</li>
              <li>You changed your mind after ordering</li>
              <li>You placed a duplicate order by accident</li>
              <li>Normal print-on-demand variation within industry tolerances</li>
            </ul>
            <p>
              Once production has begun, cancellation may not be possible — see{' '}
              <Link href="/help/orders#cancelling-an-order">Cancelling an order</Link> for the
              window where cancellation still works.
            </p>
          </section>

          <hr />

          <section id="whats-eligible" className="help-section">
            <h2>What is eligible for a refund or replacement</h2>
            <p>If any of the following happens, contact us and we&apos;ll make it right:</p>
            <ul>
              <li>
                <strong>Material defect.</strong> The print, stitching, or material has a real
                manufacturing defect — not normal print-on-demand variation.
              </li>
              <li>
                <strong>Wrong item.</strong> You received a different item or SKU than what you
                ordered.
              </li>
              <li>
                <strong>Lost in shipping.</strong> The carrier or fulfillment partner has declared
                the package lost, or tracking has stalled with no movement for more than 14 days
                past the expected delivery date.
              </li>
            </ul>
            <p>
              The resolution is usually a replacement, rework, or Stripe refund or credit —
              whichever is fairest given the situation and what our fulfillment partner can offer.
            </p>
          </section>

          <hr />

          <section id="how-to-request" className="help-section">
            <h2>How to request a refund</h2>
            <ol>
              <li>
                Email <a href="mailto:stepweave_admin@foxhillai.com">stepweave_admin@foxhillai.com</a> as soon as you
                notice the issue.
              </li>
              <li>
                Include your <strong>order ID</strong> (it&apos;s on your confirmation email and in{' '}
                <strong>Profile → Orders</strong>).
              </li>
              <li>
                Attach <strong>clear photos</strong> of the problem. For damage, photograph the
                item and the shipping label. For a wrong-item issue, photograph what you received
                next to the original listing or order summary.
              </li>
              <li>Briefly describe what&apos;s wrong and what outcome you&apos;d like.</li>
            </ol>
            <p>
              We aim to reply within a few business days. Refunds, when issued, are processed
              through Stripe and typically appear on your statement within 5–10 business days
              depending on your bank.
            </p>
            <div className="help-callout">
              <p>
                <strong>Don&apos;t file a chargeback before contacting us.</strong> Filing a
                fraudulent chargeback after a legitimate delivery is treated as a violation of
                our <Link href="/guidelines">Community Guidelines</Link> and can result in account
                action.
              </p>
            </div>
          </section>

          <hr />

          <section id="mockup-vs-reality" className="help-section">
            <h2>Mockup images vs. the final product</h2>
            <p>
              The product previews you see in the design tool and on listings are{' '}
              <strong>illustrations, not photographs</strong>. They show roughly where a design
              will sit and roughly what it will look like — but the real, manufactured product
              will vary slightly:
            </p>
            <ul>
              <li>Color and ink saturation can differ between screen and fabric or material.</li>
              <li>Print placement may shift by a small margin as part of normal production.</li>
              <li>Trim, stitching, and material textures vary between production runs.</li>
            </ul>
            <p>
              These small differences are part of how print-on-demand works and are not eligible
              for return. A real manufacturing defect — like a smudged print, broken stitching, or
              a clear misprint — is.
            </p>
          </section>

          <hr />

          <section id="sizing" className="help-section">
            <h2>Sizing and fit</h2>
            <p>
              Size charts are shown on each product listing. Read them before you order — sizes
              can vary between products and between manufacturers, even when the label number is
              the same.
            </p>
            <p>
              Ordering the wrong size is final sale. We can&apos;t exchange a made-to-order
              product for a different size after it has been manufactured. If you&apos;re between
              sizes, the listing usually has guidance on whether to size up or down.
            </p>
          </section>

          <hr />

          <section id="consumer-rights" className="help-section">
            <h2>Local consumer rights</h2>
            <p>
              If you live somewhere that gives you statutory consumer rights — for example, the
              EU, UK, or certain US states — those rights override anything in this article that
              would limit them. Our policies don&apos;t take away rights you have under local law.
            </p>
            <p>
              For details, see Section 9 of our <Link href="/terms">Terms of Use</Link>, or
              contact <a href="mailto:stepweave_admin@foxhillai.com">stepweave_admin@foxhillai.com</a> with your
              specific situation.
            </p>
          </section>

          <p className="help-footer-note">
            Need to find your order? See{' '}
            <Link href="/help/orders">Orders &amp; shipping</Link>. Still stuck?{' '}
            <Link href="/contact">Contact us</Link>.
          </p>
        </article>
      </main>
      <Footer />
    </div>
  )
}
