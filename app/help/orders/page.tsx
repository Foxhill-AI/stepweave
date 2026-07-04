import Link from 'next/link'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import '../../homepage.css'
import '../help.css'

export const metadata: Metadata = {
  title: 'Orders & shipping | Help Center | Step Weave',
  description:
    'How to place an order, track it, understand production vs. shipping time, and what to do if something is wrong.',
}

export default function OrdersHelpPage() {
  return (
    <div className="homepage">
      <Navbar />
      <Subnavbar />
      <main className="homepage-main" role="main">
        <article className="help-page">
          <Link href="/help" className="help-back">
            ← Back to Help Center
          </Link>
          <h1 className="help-page-title">Orders &amp; shipping</h1>
          <p className="help-page-intro">
            Step Weave products are made to order. That changes how shipping works compared to
            stocked retail. These articles walk through what to expect.
          </p>

          <hr />

          <nav aria-label="Table of contents">
            <h2 className="help-toc-heading">In this guide</h2>
            <ol className="help-toc">
              <li>
                <a href="#how-to-place-an-order">How to place an order</a>
              </li>
              <li>
                <a href="#tracking-your-order">Tracking your order</a>
              </li>
              <li>
                <a href="#production-vs-shipping">Production time vs. shipping time</a>
              </li>
              <li>
                <a href="#order-statuses">What each order status means</a>
              </li>
              <li>
                <a href="#international-shipping">International shipping and customs</a>
              </li>
              <li>
                <a href="#order-not-received">I haven&apos;t received my order</a>
              </li>
              <li>
                <a href="#wrong-or-damaged">My order arrived damaged or wrong</a>
              </li>
              <li>
                <a href="#cancelling-an-order">Cancelling an order</a>
              </li>
            </ol>
          </nav>

          <hr />

          <section id="how-to-place-an-order" className="help-section">
            <h2>How to place an order</h2>
            <ol>
              <li>Find a product you like in the marketplace, or create one in the design tool.</li>
              <li>Choose your size and any other options the listing offers.</li>
              <li>Click <strong>Add to cart</strong>.</li>
              <li>
                Open the cart, review your items, and click <strong>Checkout</strong>. You&apos;ll
                be sent to a secure Stripe-hosted payment page.
              </li>
              <li>
                Enter your shipping and payment details. Step Weave never sees your card number —
                only Stripe processes that information.
              </li>
              <li>
                After checkout, you&apos;ll see an order confirmation page and receive a
                confirmation email.
              </li>
            </ol>
            <div className="help-callout">
              <p>
                <strong>Double-check your shipping address before paying.</strong> Once production
                begins, we usually can&apos;t change where the order ships.
              </p>
            </div>
          </section>

          <hr />

          <section id="tracking-your-order" className="help-section">
            <h2>Tracking your order</h2>
            <p>
              Sign in and open your <strong>Profile → Orders</strong> tab to see every order
              you&apos;ve placed and its current status. When your order ships, the tracking
              number is shown there and is also sent by email.
            </p>
            <p>
              Tracking is provided by the carrier our fulfillment partner chooses for your
              destination. It can take a day or two for the carrier to start scanning a package
              after the tracking number is generated — that&apos;s normal.
            </p>
          </section>

          <hr />

          <section id="production-vs-shipping" className="help-section">
            <h2>Production time vs. shipping time</h2>
            <p>
              The total time from ordering to delivery has two parts:
            </p>
            <ul>
              <li>
                <strong>Production time</strong> — how long it takes to manufacture your item
                after you order. Because every product is made to order, this is not zero.
              </li>
              <li>
                <strong>Shipping time</strong> — how long the carrier takes to deliver after
                production finishes.
              </li>
            </ul>
            <p>
              Both are estimates from our fulfillment partners. Estimated delivery windows shown
              at checkout combine the two. Weather, customs, and carrier delays can extend either
              part.
            </p>
            <div className="help-callout">
              <p>
                <strong>If you&apos;re ordering for a deadline,</strong> add a few days of buffer
                — production-plus-shipping estimates are not guarantees.
              </p>
            </div>
          </section>

          <hr />

          <section id="order-statuses" className="help-section">
            <h2>What each order status means</h2>
            <h3>Pending</h3>
            <p>
              We&apos;ve received your payment and the order is being prepared to send to our
              fulfillment partner.
            </p>

            <h3>In production</h3>
            <p>
              Your item is being manufactured. Cancellation generally isn&apos;t possible once an
              order reaches this stage.
            </p>

            <h3>Shipped</h3>
            <p>
              The order has left the production facility. A tracking number is now available in
              your <strong>Orders</strong> tab.
            </p>

            <h3>Delivered</h3>
            <p>
              The carrier has marked the order as delivered. If you can&apos;t find it, see{' '}
              <a href="#order-not-received">I haven&apos;t received my order</a> below.
            </p>

            <h3>On hold</h3>
            <p>
              Production is paused — usually because of an issue with the design file or the
              shipping address. Check your email for a message from us.
            </p>

            <h3>Cancelled</h3>
            <p>
              The order was cancelled before production began. If you were charged, the refund is
              processed automatically by Stripe and typically appears within 5–10 business days,
              depending on your bank.
            </p>
          </section>

          <hr />

          <section id="international-shipping" className="help-section">
            <h2>International shipping and customs</h2>
            <p>
              We ship internationally through our fulfillment partners. If your order ships across
              a border, you are responsible for:
            </p>
            <ul>
              <li>Any import duties, taxes, customs fees, or brokerage charges</li>
              <li>Making sure the order complies with your country&apos;s import laws</li>
              <li>Providing accurate customs declarations</li>
            </ul>
            <p>
              Customs can add days or, occasionally, weeks to delivery. We don&apos;t control
              customs agencies and aren&apos;t responsible for their delays. Packages refused at
              the border or seized by customs are generally the buyer&apos;s responsibility.
            </p>
            <p>
              For the full policy, see Section 9 of our <Link href="/terms">Terms of Use</Link>.
            </p>
          </section>

          <hr />

          <section id="order-not-received" className="help-section">
            <h2>I haven&apos;t received my order</h2>
            <p>First, a quick checklist:</p>
            <ol>
              <li>
                Open <strong>Profile → Orders</strong> and check the status. If it says{' '}
                <em>In production</em>, it hasn&apos;t shipped yet.
              </li>
              <li>
                If it&apos;s shipped, click the tracking number and look at the carrier&apos;s most
                recent scan. Sometimes packages sit at a sorting facility for a few days.
              </li>
              <li>
                Compare the delivery estimate with today&apos;s date. International orders in
                particular can run a week or more past the original estimate without indicating a
                real problem.
              </li>
              <li>
                Check with your neighbors, building manager, or local post office — carriers
                sometimes mark a package &quot;delivered&quot; before it reaches the door.
              </li>
            </ol>
            <p>
              If tracking has stalled with no movement and it&apos;s been more than 14 days past
              the expected delivery date — or if the carrier has declared the shipment lost —
              email <a href="mailto:stepweave_admin@foxhillai.com">stepweave_admin@foxhillai.com</a> with your order
              ID and we&apos;ll work with the fulfillment partner on a replacement, rework, or
              refund.
            </p>
          </section>

          <hr />

          <section id="wrong-or-damaged" className="help-section">
            <h2>My order arrived damaged or wrong</h2>
            <p>
              If your item has a real manufacturing defect (not normal print-on-demand variation)
              or you received the wrong item or SKU, email{' '}
              <a href="mailto:stepweave_admin@foxhillai.com">stepweave_admin@foxhillai.com</a> as soon as possible
              with:
            </p>
            <ul>
              <li>Your order ID</li>
              <li>Clear photos of the issue, including the shipping label if relevant</li>
              <li>A short description of what&apos;s wrong</li>
            </ul>
            <p>
              We&apos;ll work with the fulfillment partner on a fair resolution — usually a
              replacement, rework, or Stripe refund or credit.
            </p>
            <div className="help-callout">
              <p>
                <strong>What counts as &quot;normal&quot; variation?</strong> Slight differences
                in color, ink saturation, and trim placement are part of the print-on-demand
                process. Mockup images are illustrations, not exact photos. See{' '}
                <Link href="/help/returns">Returns &amp; refunds</Link> for the full picture.
              </p>
            </div>
          </section>

          <hr />

          <section id="cancelling-an-order" className="help-section">
            <h2>Cancelling an order</h2>
            <p>
              You can cancel an order while it&apos;s still <em>Pending</em> — open{' '}
              <strong>Profile → Orders</strong> and use the cancel button on the order. Once an
              order moves to <em>In production</em>, cancellation generally isn&apos;t possible
              because the item is already being manufactured.
            </p>
            <p>
              If you need to change the shipping address before production begins, contact{' '}
              <a href="mailto:stepweave_admin@foxhillai.com">stepweave_admin@foxhillai.com</a> with your order ID and
              the corrected address as quickly as you can.
            </p>
          </section>

          <p className="help-footer-note">
            Looking for refund details? See{' '}
            <Link href="/help/returns">Returns &amp; refunds</Link>. Still stuck?{' '}
            <Link href="/contact">Contact us</Link>.
          </p>
        </article>
      </main>
      <Footer />
    </div>
  )
}
