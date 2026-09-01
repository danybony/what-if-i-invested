import type { NextConfig } from 'next'

/**
 * The site is a fully static export: no server, no API routes. Market data is
 * fetched at build time by scripts/fetch-market-data.mjs and served from
 * public/data/, which is what lets GitHub Pages host the whole thing.
 *
 * The deployed site has its own custom domain (public/CNAME), so it is served
 * from the root and needs no base path. NEXT_PUBLIC_BASE_PATH stays supported
 * for the subpath case — a fork without a domain, served from /<repo>/.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

const nextConfig: NextConfig = {
  output: 'export',
  // Emit advanced/index.html rather than advanced.html — the shape GitHub Pages
  // resolves most predictably.
  trailingSlash: true,
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  images: { unoptimized: true },
}

export default nextConfig
