// Maps each in-app view to its public documentation page on the VitePress
// site hosted on GitHub Pages. `null` means "no docs page yet" — the
// in-app help button is rendered disabled.
//
// Add or update slugs whenever you publish a new guide under docs/guides/.
// The slug is the VitePress route relative to DOCS_BASE_URL.

import type { ViewId } from './types';

// Public GitHub Pages URL for the VitePress docs site.
// Override with NEXT_PUBLIC_DOCS_BASE_URL to swap in a custom domain.
export const DOCS_BASE_URL: string =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_DOCS_BASE_URL) ||
  'https://jason660519.github.io/Project-Manager/';

export const VIEW_DOCS_SLUG: Record<ViewId, string | null> = {
  dashboard: 'features/dashboard',
  features: 'features/feature-management',
  'integrations-hub': 'features/integrations-hub',
  xmux: 'features/xmux',
  settings: 'features/settings',
  engineers: 'features/engineers',
  channels: 'features/channels',
  sessions: 'features/sessions',
  'cron-jobs': 'features/cron-jobs',
  logs: 'features/logs',
  keys: 'features/keys',
  'ai-sdks': 'features/ai-sdks',
  documentation: 'features/documentation',
  'company-standards': 'features/company-standards',
  chat: 'features/chat',
  // No standalone view / docs page yet; ? button renders disabled.
  'keyboard-shortcuts': null,
};

/**
 * Resolve the absolute docs URL for a given view, or null if no docs exist.
 * Trailing slash on base + leading slash stripped from slug, normalised so
 * `features/xmux` becomes `https://.../Project-Manager/features/xmux`.
 */
export function docsUrlForView(view: ViewId): string | null {
  const slug = VIEW_DOCS_SLUG[view];
  if (!slug) return null;
  const base = DOCS_BASE_URL.endsWith('/') ? DOCS_BASE_URL : `${DOCS_BASE_URL}/`;
  const normalisedSlug = slug.startsWith('/') ? slug.slice(1) : slug;
  return `${base}${normalisedSlug}`;
}
