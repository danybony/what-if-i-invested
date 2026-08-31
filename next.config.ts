import type { NextConfig } from 'next'

/**
 * The site is a fully static export: no server, no API routes. Market data is
 * fetched at build time by scripts/fetch-market-data.mjs and served from
 * public/data/, which is what lets GitHub Pages host the whole thing.
 *
 * A GitHub Pages *project* site lives under /<repo>/, so the workflow sets
 * NEXT_PUBLIC_BASE_PATH=/what-if-i-invested. Leave it unset for local dev or a
 * custom domain, where the site sits at the root.
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
