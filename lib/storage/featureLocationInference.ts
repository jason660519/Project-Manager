import type { Feature } from '../types';
import type { SectionCandidate } from '../scanner/sectionInventory';

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

function normalizeComparable(value: string): string {
  return value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

function findCandidateByLabel(
  raw: string | undefined,
  candidates: SectionCandidate[] | undefined,
): SectionCandidate | undefined {
  const value = raw?.trim();
  if (!value || !candidates?.length) return undefined;
  const normalized = normalizeComparable(value);
  return candidates.find((candidate) => {
    const labels = [candidate.label, candidate.id, candidate.path, ...candidate.evidencePaths];
    return labels.some((label) => normalizeComparable(label) === normalized);
  });
}

function findCandidateForPath(
  rawPath: string | undefined,
  candidates: SectionCandidate[] | undefined,
): SectionCandidate | undefined {
  const path = normalizeComparable(rawPath ?? '');
  if (!path || !candidates?.length) return undefined;

  const exact = candidates.find((candidate) => {
    const paths = [candidate.path, ...candidate.evidencePaths].map(normalizeComparable);
    return paths.includes(path);
  });
  if (exact) return exact;

  return candidates
    .filter((candidate) => {
      const candidatePath = normalizeComparable(candidate.path);
      if (!candidatePath) return false;
      return path.startsWith(`${candidatePath}/`) || candidatePath.startsWith(`${path}/`);
    })
    .sort((a, b) => b.path.length - a.path.length)[0];
}

export interface LocatedSectionInferenceOptions {
  sectionCandidates?: SectionCandidate[];
  /**
   * Preserve a non-empty value even when it does not match detected candidates.
   * Use false for fresh AI scan output so hallucinated section names are dropped.
   */
  preserveExisting?: boolean;
}

/**
 * Infer a stable section hint for dashboard rows.
 *
 * Priority:
 * 1) Existing locatedSection when no candidate validation is requested, or when
 *    it matches a detected section candidate
 * 2) Detected section candidate from implementation/spec/test paths
 * 3) Path-derived fallback when no section candidates were available
 */
export function inferLocatedSection(
  feature: Feature,
  options: LocatedSectionInferenceOptions = {},
): string | undefined {
  const candidates = options.sectionCandidates;
  const preserveExisting = options.preserveExisting ?? true;

  if (feature.locatedSection?.trim()) {
    const matched = findCandidateByLabel(feature.locatedSection, candidates);
    if (matched) return matched.label;
    if (!candidates?.length || preserveExisting) return feature.locatedSection.trim();
  }

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
    const matched = findCandidateForPath(path, candidates);
    if (matched) return matched.label;
    if (candidates?.length) continue;
    const inferred = inferSectionFromPath(path);
    if (inferred) return inferred;
  }

  return undefined;
}

export function normalizeFeatureLocatedSection(
  feature: Feature,
  options: LocatedSectionInferenceOptions = {},
): Feature {
  const locatedSection = inferLocatedSection(feature, options);
  if (!locatedSection) {
    if (feature.locatedSection && options.sectionCandidates?.length && options.preserveExisting === false) {
      const next = { ...feature };
      delete next.locatedSection;
      return next;
    }
    return feature;
  }
  if (feature.locatedSection === locatedSection) return feature;
  return { ...feature, locatedSection };
}

export function normalizeFeaturesLocatedSection(
  features: Feature[],
  options: LocatedSectionInferenceOptions = {},
): Feature[] {
  return features.map((feature) => normalizeFeatureLocatedSection(feature, options));
}
