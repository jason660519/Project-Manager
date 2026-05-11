/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for Tauri WebView — no SSR, no API routes in production
  output: 'export',
  // Disable Next.js image optimization (not compatible with static export)
  images: { unoptimized: true },
  // Disable x-powered-by header
  poweredByHeader: false,
};

export default nextConfig;
