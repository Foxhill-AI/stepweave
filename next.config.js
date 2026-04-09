/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // @napi-rs/canvas uses platform-specific native binaries (.node).
    // Without this, Next.js tries to bundle it and picks the darwin binary;
    // on Vercel (Linux) that crashes silently → canvas unavailable → tofu text.
    // Marking as external lets Vercel install @napi-rs/canvas-linux-x64-gnu at deploy time.
    serverComponentsExternalPackages: ['@napi-rs/canvas'],

    // Copy Noto TTF fonts into every API route's serverless bundle so
    // GlobalFonts.registerFromPath finds them at process.cwd()/lib/printful/fonts/*.ttf
    outputFileTracingIncludes: {
      // Explicit route path (App Router dynamic segment)
      '/api/design-drafts/[id]/preview-mockups': ['./lib/printful/fonts/**/*'],
      // Broad fallback to cover any future API route that imports compositeImages
      '/api/**': ['./lib/printful/fonts/**/*'],
    },
  },
}

module.exports = nextConfig
