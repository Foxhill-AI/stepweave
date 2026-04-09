/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure bundled Noto TTFs are copied into serverless traces (Vercel) for composite text rendering.
  experimental: {
    outputFileTracingIncludes: {
      '/api/**/*': ['./lib/printful/fonts/**/*'],
    },
  },
}

module.exports = nextConfig
