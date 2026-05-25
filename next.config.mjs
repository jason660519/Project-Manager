/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 16 enforces a single dev server per project via .next/dev/lock. The
  // Claude preview pass uses NEXT_PREVIEW_DIST_DIR to point at an isolated
  // dist dir (.next-preview) so it does not collide with the user's primary
  // dev session on the default .next/. See .claude/launch.json.
  distDir: process.env.NEXT_PREVIEW_DIST_DIR || '.next',
  // Static export for Tauri WebView — no SSR, no API routes in production
  output: 'export',
  // Disable Next.js image optimization (not compatible with static export)
  images: { unoptimized: true },
  // Disable x-powered-by header
  poweredByHeader: false,
  // Project-scoped external tools live outside the Next app. Exclude them from
  // route file tracing so Turbopack does not chase vendored virtualenvs or
  // runtime state while building app/API endpoints.
  outputFileTracingExcludes: {
    '/*': ['./vendor/**/*', './.project-manager/**/*', './app/plugins/**/*'],
  },
  // Allow `next dev` to be reached from the dev machine's LAN IP (Next 16
  // blocks RSC payloads / HMR from non-localhost origins by default, which
  // breaks hydration when you open the dev server from another device on the
  // network — checkboxes "click" but onChange never fires and the badge
  // never appears).  Wildcard private-network ranges cover any device on
  // typical home/office LANs.
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '192.168.*.*',
    '10.*.*.*',
    '172.16.*.*',
    '*.local',
    '*.lan',
  ],
};

export default nextConfig;
