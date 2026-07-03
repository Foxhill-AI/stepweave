import Link from 'next/link'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import '../homepage.css'
import './about.css'

export const metadata: Metadata = {
  title: 'About Us | Step Weave',
  description:
    'Step Weave is a family-run print-on-demand marketplace and AI design tool, built in Denver and Houston by Foxhill AI LLC.',
}

export default function AboutPage() {
  return (
    <div className="homepage">
      <Navbar />
      <Subnavbar />
      <main className="homepage-main" role="main">
        <article className="about-page">
          <h1 className="about-page-title">About Step Weave</h1>
          <p className="about-page-lede">
            Step Weave is a print-on-demand marketplace with an AI design tool — a place where
            anyone can create something they love to wear, and creators can sell what they make
            without ever touching inventory.
          </p>

          <hr />

          <section className="about-section" aria-labelledby="about-story">
            <h2 id="about-story">Our story</h2>
            <p>
              Step Weave is operated by <strong>Foxhill AI LLC</strong>, a small family company
              based in <strong>Denver, Colorado</strong> and <strong>Houston, Texas</strong>. We
              started Step Weave because we kept running into the same problem: the people with
              the best ideas for custom products almost never had the design software, the
              technical skill, or the upfront capital to make them. So we built a place where the
              hard parts — the design tooling, the manufacturing, the payments, the shipping —
              fade into the background, and the creative part stays in your hands.
            </p>
            <p>
              We are not a venture-backed marketplace trying to be everything. We are a small team
              building one thing well, one decision at a time.
            </p>
          </section>

          <hr />

          <section className="about-section" aria-labelledby="about-what-we-make">
            <h2 id="about-what-we-make">What we make</h2>
            <p>Step Weave is built around three things that work together:</p>

            <h3 className="about-subhead">A marketplace</h3>
            <p>
              A curated catalog of original, custom-made products from independent creators. Every
              item is manufactured to order — nothing sits in a warehouse, nothing gets thrown
              away. <Link href="/marketplace">Browse the marketplace</Link>.
            </p>

            <h3 className="about-subhead">An AI design tool</h3>
            <p>
              Describe what you want, and our design tool helps you get there — generating
              patterns, placing them on real product templates, and previewing the result before
              anything is printed. No Photoshop, no design degree, no learning curve.{' '}
              <Link href="/design-tool">Try the design tool</Link>.
            </p>

            <h3 className="about-subhead">Creator profiles</h3>
            <p>
              Anyone can open a profile, list their designs, and get paid when they sell — without
              minimum order quantities, inventory risk, or fulfillment headaches.
            </p>
          </section>

          <hr />

          <section className="about-section" aria-labelledby="about-how">
            <h2 id="about-how">How it works under the hood</h2>
            <p>
              We are upfront about how the platform is put together, because we think you should
              know who is touching your designs and your data:
            </p>
            <ul className="about-list">
              <li>
                <strong>Manufacturing and shipping</strong> are handled by{' '}
                <a href="https://www.printful.com" target="_blank" rel="noopener noreferrer">
                  Printful
                </a>
                , a print-on-demand fulfillment partner. Orders are produced after you buy and
                shipped directly to you.
              </li>
              <li>
                <strong>AI image generation</strong> is powered by industry-standard models for
                pattern creation, with content moderation in front of every prompt to keep things
                family-friendly.
              </li>
              <li>
                <strong>Payments</strong> are processed by{' '}
                <a href="https://stripe.com" target="_blank" rel="noopener noreferrer">
                  Stripe
                </a>
                . Step Weave never sees or stores your card number.
              </li>
              <li>
                <strong>Accounts and data</strong> are stored on Supabase with row-level security
                — your designs and orders belong to you, and only you can see them.
              </li>
            </ul>
            <p>
              If you want the full detail on what we collect and how it&apos;s used, our{' '}
              <Link href="/privacy">Privacy Policy</Link> and{' '}
              <Link href="/cookies">Cookie Policy</Link> spell it out.
            </p>
          </section>

          <hr />

          <section className="about-section" aria-labelledby="about-values">
            <h2 id="about-values">What we believe</h2>
            <p>
              Step Weave is run the way a family company should be: people first, products
              second. The principles we hold ourselves to are the same ones we ask of our
              community — see our <Link href="/guidelines">Community Guidelines</Link> for the
              full list.
            </p>
          </section>

          <hr />

          <section className="about-section" aria-labelledby="about-where">
            <h2 id="about-where">Where to find us</h2>
            <p>
              Step Weave is operated by Foxhill AI LLC. Our mailing address is 9878 W. Belleview
              Ave, Suite 2393, Denver, CO 80123. Our team works between Denver and Houston.
            </p>
            <p>
              For general questions, head to our <Link href="/contact">contact page</Link> or
              email <a href="mailto:hello@stepweave.com">hello@stepweave.com</a>. For legal,
              privacy, and IP matters, write to{' '}
              <a href="mailto:legal@stepweave.com">legal@stepweave.com</a>.
            </p>
          </section>

          <hr />

          <section className="about-section about-cta" aria-labelledby="about-cta-heading">
            <h2 id="about-cta-heading">Make something</h2>
            <p>
              The best way to understand Step Weave is to use it. Browse what other creators have
              made, or open the design tool and start with an idea of your own.
            </p>
            <div className="about-cta-row">
              <Link href="/marketplace" className="about-cta-button about-cta-button-primary">
                Browse the marketplace
              </Link>
              <Link href="/design-tool" className="about-cta-button about-cta-button-secondary">
                Try the design tool
              </Link>
            </div>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  )
}
