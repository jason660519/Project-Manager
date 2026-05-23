import type { Feature } from '../types';

const LEADING_PATH_NOISE = new Set([
  'src',
  'app',
  'components',
  'lib',
  'tests',
  '__tests__',
  'docs',
  'packages',
  '.project-manager',
]);

function cleanSegment(segment: string): string {
  return segment
    .replace(/\.[^.]+$/, '')
    .replace(/[._\s]+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .replace(/^-+|-+$/g, '');
}

function inferSectionFromPath(rawPath: string | undefined): string | undefined {
  const input = rawPath?.trim();
  if (!input) return undefined;

  const normalized = input.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/+$/, '');
  if (!normalized) return undefined;

  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) return undefined;

  const last = parts[parts.length - 1];
  const looksLikeFile = /\.[A-Za-z0-9]+$/.test(last);
  const directoryParts = looksLikeFile ? parts.slice(0, -1) : [...parts];

  while (directoryParts.length > 0 && LEADING_PATH_NOISE.has(directoryParts[0])) {
    directoryParts.shift();
  }

  const chosen = directoryParts.length > 0
    ? directoryParts.slice(0, 2).map(cleanSegment).filter(Boolean)
    : [cleanSegment(last)];

  const hint = chosen.join('/');
  return hint || undefined;
}

/**
 * Infer a stable section hint for dashboard rows.
 *
 * Priority:
 * 1) Existing locatedSection
 * 2) Implementation/spec/test related paths
 * 3) Feature category
 * 4) Feature name
 */
export function inferLocatedSection(feature: Feature): string | undefined {
  if (feature.locatedSection?.trim()) return feature.locatedSection.trim();

  const p = feature.paths ?? {};
  const pathCandidates = [
    p.implementation,
    p.spec,
    p.tdd,
    p.unitIntegrationTest,
    p.test,
    p.e2eAcceptanceTestScriptFolder,
    p.featureFolder,
  ];

  for (const path of pathCandidates) {
    const inferred = inferSectionFromPath(path);
    if (inferred) return inferred;
  }

  if (feature.category?.trim()) return feature.category.trim();
  if (feature.name?.trim()) return feature.name.trim();
  return undefined;
}

export function normalizeFeatureLocatedSection(feature: Feature): Feature {
  const locatedSection = inferLocatedSection(feature);
  if (!locatedSection) return feature;
  if (feature.locatedSection === locatedSection) return feature;
  return { ...feature, locatedSection };
}

export function normalizeFeaturesLocatedSection(features: Feature[]): Feature[] {
  return features.map(normalizeFeatureLocatedSection);
}

