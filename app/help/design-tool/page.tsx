import Link from 'next/link'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Subnavbar from '@/components/Subnavbar'
import Footer from '@/components/Footer'
import '../../homepage.css'
import '../help.css'

export const metadata: Metadata = {
  title: 'The design tool | Help Center | Step Weave',
  description:
    'How to design your first custom product on Step Weave: choosing a base product, writing AI prompts, adjusting placement, and saving drafts.',
}

export default function DesignToolHelpPage() {
  return (
    <div className="homepage">
      <Navbar />
      <Subnavbar />
      <main className="homepage-main" role="main">
        <article className="help-page">
          <Link href="/help" className="help-back">
            ← Back to Help Center
          </Link>
          <h1 className="help-page-title">The design tool</h1>
          <p className="help-page-intro">
            The design tool lets you create custom products by describing the pattern you want in
            words. The AI generates options, you place the design on the product, and you can
            preview it before anything is printed.
          </p>

          <hr />

          <nav aria-label="Table of contents">
            <h2 className="help-toc-heading">In this guide</h2>
            <ol className="help-toc">
              <li>
                <a href="#first-product">Designing your first custom product</a>
              </li>
              <li>
                <a href="#base-product">Choosing a base product and variant</a>
              </li>
              <li>
                <a href="#writing-prompts">Writing AI prompts that work</a>
              </li>
              <li>
                <a href="#prompt-rejected">Why my prompt was rejected</a>
              </li>
              <li>
                <a href="#placement">Adjusting design placement</a>
              </li>
              <li>
                <a href="#previews">Previewing the final product</a>
              </li>
              <li>
                <a href="#drafts">Saving drafts vs. publishing</a>
              </li>
              <li>
                <a href="#manual-mode">Manual mode</a>
              </li>
              <li>
                <a href="#ai-ownership">Who owns AI-generated designs?</a>
              </li>
            </ol>
          </nav>

          <hr />

          <section id="first-product" className="help-section">
            <h2>Designing your first custom product</h2>
            <ol>
              <li>
                Open the <Link href="/design-tool">design tool</Link>. You&apos;ll need to be
                signed in to save your work.
              </li>
              <li>Pick a base product — the actual physical thing your design will go on.</li>
              <li>
                Choose a variant (size, color, or other options). Variants determine which print
                areas are available.
              </li>
              <li>
                In <strong>AI mode</strong>, type a description of the pattern you want — see{' '}
                <a href="#writing-prompts">Writing AI prompts that work</a>.
              </li>
              <li>
                When the AI returns a pattern, adjust how it sits on each print area — see{' '}
                <a href="#placement">Adjusting design placement</a>.
              </li>
              <li>Refresh the preview to see what the finished product will look like.</li>
              <li>Save the draft. From a saved draft you can list the product for sale.</li>
            </ol>
          </section>

          <hr />

          <section id="base-product" className="help-section">
            <h2>Choosing a base product and variant</h2>
            <p>
              The <strong>base product</strong> is the physical item — for example, a specific
              style of shoe. The <strong>variant</strong> is a particular version of that product:
              a color, a size, or a combination of both.
            </p>
            <p>
              Variants matter because they decide which <strong>print areas</strong> are available
              on the product. A high-top shoe will have different print areas than a low-top in
              the same line. If you switch variants partway through designing, the design tool
              will re-fit your pattern to the new product&apos;s print areas — but you may need to
              re-adjust placement.
            </p>
            <div className="help-callout">
              <p>
                <strong>Pick the variant first.</strong> Switching the base product later means
                redoing your placement work. Get the product and variant settled before you spend
                a lot of time on the pattern.
              </p>
            </div>
          </section>

          <hr />

          <section id="writing-prompts" className="help-section">
            <h2>Writing AI prompts that work</h2>
            <p>
              The AI works best when you tell it what to make, not what to avoid. Some tips:
            </p>
            <ul>
              <li>
                <strong>Describe the subject, then the style.</strong> &quot;Mountain peaks at
                sunrise, watercolor style&quot; works better than &quot;watercolor, with maybe
                some mountains.&quot;
              </li>
              <li>
                <strong>Be specific about color and mood.</strong> &quot;Muted earth tones,
                soft&quot; gives the AI more to work with than &quot;nice colors.&quot;
              </li>
              <li>
                <strong>Think about repetition.</strong> Designs that print onto a shoe or other
                product usually look best as patterns that tile or repeat naturally — call that
                out in the prompt if it&apos;s what you want.
              </li>
              <li>
                <strong>Iterate.</strong> The first generation rarely lands. Tweak your prompt and
                regenerate.
              </li>
            </ul>
          </section>

          <hr />

          <section id="prompt-rejected" className="help-section">
            <h2>Why my prompt was rejected</h2>
            <p>
              Every prompt is checked by an automated content moderation step before it&apos;s
              sent to the image generator. Prompts that look like they&apos;re asking for content
              that violates our <Link href="/guidelines">Community Guidelines</Link> — sexual
              content, graphic violence, hate, content involving minors in unsafe contexts, or
              attempts to reproduce copyrighted characters or brands — are blocked.
            </p>
            <p>
              The moderation isn&apos;t perfect. If a prompt was blocked that you believe is
              fine, try rephrasing it more concretely (describing what you do want, in plain
              language) or contact us at{' '}
              <a href="mailto:legal@stepweave.com">legal@stepweave.com</a> with the prompt and
              the error.
            </p>
            <div className="help-callout">
              <p>
                <strong>Don&apos;t try to bypass moderation.</strong> Repeated attempts to evade
                the filter — or generating prohibited content despite warnings — are violations
                of our guidelines and can result in account action.
              </p>
            </div>
          </section>

          <hr />

          <section id="placement" className="help-section">
            <h2>Adjusting design placement</h2>
            <p>
              Once you have a pattern, the <strong>placement editor</strong> shows where the
              design will sit on each print area of the product. Use it to:
            </p>
            <ul>
              <li>Scale the pattern up or down within the print area</li>
              <li>Shift it horizontally or vertically</li>
              <li>See a live preview of how the placement will look on the finished product</li>
            </ul>
            <p>
              Each print area is independent — adjusting the design on one part of a shoe
              doesn&apos;t change how it sits on another. Take a moment with each area; the
              defaults are reasonable but rarely perfect.
            </p>
          </section>

          <hr />

          <section id="previews" className="help-section">
            <h2>Previewing the final product</h2>
            <p>
              The design tool generates mockup previews showing your design rendered onto the
              product. These come from our fulfillment partner&apos;s mockup generator and update
              as you change the pattern or its placement.
            </p>
            <p>
              Mockups are <strong>illustrations, not photographs</strong>. The actual manufactured
              product will be very close to the preview but not identical — see{' '}
              <Link href="/help/returns#mockup-vs-reality">Mockup images vs. the final product</Link>{' '}
              for details on the small differences to expect.
            </p>
          </section>

          <hr />

          <section id="drafts" className="help-section">
            <h2>Saving drafts vs. publishing</h2>
            <p>
              A <strong>draft</strong> is a design you&apos;re still working on. It&apos;s saved
              to your account and only visible to you. You can come back to a draft any time and
              keep editing.
            </p>
            <p>
              A <strong>published product</strong> is a draft you&apos;ve listed for sale on the
              marketplace. Once published, other users can see and buy it. You can unlist or
              edit a published product, but if it has active orders, those orders will continue
              with the version that was live when they were placed.
            </p>
          </section>

          <hr />

          <section id="manual-mode" className="help-section">
            <h2>Manual mode</h2>
            <p>
              The design tool currently offers AI mode as the primary way to create patterns.
              Manual mode — uploading and arranging your own image files — is a placeholder right
              now and isn&apos;t fully wired up.
            </p>
            <p>
              We&apos;ll update this article when manual upload is ready. In the meantime, AI
              mode is the supported path for creating designs.
            </p>
          </section>

          <hr />

          <section id="ai-ownership" className="help-section">
            <h2>Who owns AI-generated designs?</h2>
            <p>
              You own the rights to the designs you create on Step Weave, subject to a license
              that lets us display, manufacture, and ship them — see Section 6 of our{' '}
              <Link href="/terms">Terms of Use</Link> for the full details.
            </p>
            <p>
              That said, AI tools can produce output that resembles existing copyrighted work,
              characters, or brands. Even if the AI generated it, you&apos;re responsible for what
              you publish. Don&apos;t prompt the AI to copy a known character or brand and then
              try to sell the result — that&apos;s an IP violation regardless of how the image
              was made. See <Link href="/guidelines">Community Guidelines</Link> §7.
            </p>
            <p>
              If your design was substantially generated with AI, disclose that in the listing.
              Buyers deserve to know what they&apos;re purchasing.
            </p>
          </section>

          <p className="help-footer-note">
            New to the site? Start with <Link href="/help/getting-started">Getting started</Link>.
            Still stuck? <Link href="/contact">Contact us</Link>.
          </p>
        </article>
      </main>
      <Footer />
    </div>
  )
}
