import type { ProjectManagerConfig, Feature, FeaturePaths } from '../types';
import type { SectionCandidate } from './sectionInventory';
import type { ProjectContext } from './shared';

export type ScanValidationSeverity = 'warning' | 'error';

export interface ScanValidationIssue {
  code:
    | 'missing_located_section'
    | 'invalid_located_section'
    | 'missing_evidence_path'
    | 'path_not_found'
    | 'weak_name'
    | 'duplicate_section_overload';
  severity: ScanValidationSeverity;
  message: string;
  path?: string;
}

export interface FeatureScanValidation {
  featureId: string;
  confidence: number;
  needsReview: boolean;
  evidencePaths: string[];
  issues: ScanValidationIssue[];
}

export interface ScanValidationReport {
  featureCount: number;
  highConfidenceCount: number;
  reviewCount: number;
  errorCount: number;
  warningCount: number;
  features: FeatureScanValidation[];
}

export interface ScanValidationContext {
  sectionCandidates?: SectionCandidate[];
  inventoryPaths?: string[];
}

const PATH_FIELDS: Array<keyof FeaturePaths> = [
  'implementation',
  'spec',
  'tdd',
  'test',
  'unitIntegrationTest',
  'e2eAcceptanceTestScriptFolder',
  'featureFolder',
];

function normalizePath(path: string): string {
  return path
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/\/+$/, '');
}

function normalizeComparable(value: string): string {
  return normalizePath(value).toLowerCase();
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function isGeneratedDashboardPath(path: string): boolean {
  return path.startsWith('.project-manager/features/') || path.startsWith('.project-manager/dev-logs/');
}

function pathExists(path: string, inventorySet: Set<string>): boolean {
  const normalized = normalizeComparable(path);
  if (!normalized) return false;
  if (inventorySet.has(normalized)) return true;
  return [...inventorySet].some((candidate) => candidate.startsWith(`${normalized}/`));
}

function candidateMatches(
  locatedSection: string | undefined,
  candidates: SectionCandidate[] | undefined,
): boolean {
  const value = locatedSection?.trim();
  if (!value) return false;
  if (!candidates?.length) return true;
  const normalized = normalizeComparable(value);
  return candidates.some((candidate) => {
    const labels = [candidate.label, candidate.id, candidate.path, ...candidate.evidencePaths];
    return labels.some((label) => normalizeComparable(label) === normalized);
  });
}

function featurePathValues(feature: Feature): string[] {
  const raw: string[] = [];
  for (const key of PATH_FIELDS) {
    const value = feature.paths?.[key];
    if (typeof value === 'string' && value.trim()) raw.push(value.trim());
  }
  if (typeof feature.readmePath === 'string' && feature.readmePath.trim()) {
    raw.push(feature.readmePath.trim());
  }
  const metadataEvidence = feature.metadata?.evidencePaths;
  if (Array.isArray(metadataEvidence)) {
    for (const value of metadataEvidence) {
      if (typeof value === 'string' && value.trim()) raw.push(value.trim());
    }
  }
  return [...new Set(raw.map(normalizePath).filter(Boolean))];
}

function isWeakFeatureName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized.length < 4 || ['dashboard', 'api', 'ui', 'frontend', 'backend'].includes(normalized);
}

export function validateFeatureScan(
  feature: Feature,
  context: ScanValidationContext,
): FeatureScanValidation {
  const issues: ScanValidationIssue[] = [];
  const inventorySet = new Set((context.inventoryPaths ?? []).map(normalizeComparable));
  const pathValues = featurePathValues(feature);
  const evidencePaths = pathValues.filter((path) =>
    isGeneratedDashboardPath(path) || inventorySet.size === 0 || pathExists(path, inventorySet),
  );

  const hasValidSection = candidateMatches(feature.locatedSection, context.sectionCandidates);
  if (!feature.locatedSection?.trim()) {
    issues.push({
      code: 'missing_located_section',
      severity: 'warning',
      message: 'No locatedSection was assigned.',
    });
  } else if (!hasValidSection) {
    issues.push({
      code: 'invalid_located_section',
      severity: 'error',
      message: `locatedSection "${feature.locatedSection}" is not a detected section candidate.`,
    });
  }

  if (pathValues.length === 0) {
    issues.push({
      code: 'missing_evidence_path',
      severity: 'warning',
      message: 'No implementation, docs, test, or evidence path was provided.',
    });
  }

  if (inventorySet.size > 0) {
    for (const path of pathValues) {
      if (isGeneratedDashboardPath(path)) continue;
      if (!pathExists(path, inventorySet)) {
        issues.push({
          code: 'path_not_found',
          severity: 'error',
          message: `Path "${path}" was not found in the project inventory.`,
          path,
        });
      }
    }
  }

  if (isWeakFeatureName(feature.name)) {
    issues.push({
      code: 'weak_name',
      severity: 'warning',
      message: `Feature name "${feature.name}" is too generic for reliable tracking.`,
    });
  }

  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.length - errorCount;
  const hasImplementationEvidence =
    typeof feature.paths?.implementation === 'string' &&
    evidencePaths.includes(normalizePath(feature.paths.implementation));
  const explicitAiConfidence =
    typeof feature.metadata?.initializationConfidence === 'number'
      ? feature.metadata.initializationConfidence
      : undefined;

  let confidence = explicitAiConfidence ?? 0.45;
  if (hasValidSection) confidence += 0.2;
  if (hasImplementationEvidence) confidence += 0.2;
  else if (evidencePaths.length > 0) confidence += 0.12;
  if (feature.category?.trim()) confidence += 0.05;
  confidence -= errorCount * 0.25;
  confidence -= warningCount * 0.08;
  confidence = clamp(confidence);

  return {
    featureId: feature.id,
    confidence,
    needsReview: confidence < 0.75 || errorCount > 0,
    evidencePaths,
    issues,
  };
}

export function validateProjectScan(
  config: ProjectManagerConfig,
  context: ScanValidationContext,
): ScanValidationReport {
  const features = config.features.map((feature) => validateFeatureScan(feature, context));
  const errorCount = features.reduce(
    (sum, item) => sum + item.issues.filter((issue) => issue.severity === 'error').length,
    0,
  );
  const warningCount = features.reduce(
    (sum, item) => sum + item.issues.filter((issue) => issue.severity === 'warning').length,
    0,
  );
  return {
    featureCount: features.length,
    highConfidenceCount: features.filter((item) => !item.needsReview).length,
    reviewCount: features.filter((item) => item.needsReview).length,
    errorCount,
    warningCount,
    features,
  };
}

export function attachScanValidationMetadata(
  config: ProjectManagerConfig,
  context: ScanValidationContext,
): { config: ProjectManagerConfig; report: ScanValidationReport } {
  const report = validateProjectScan(config, context);
  const byId = new Map(report.features.map((feature) => [feature.featureId, feature]));
  return {
    report,
    config: {
      ...config,
      features: config.features.map((feature) => {
        const validation = byId.get(feature.id);
        if (!validation) return feature;
        return {
          ...feature,
          metadata: {
            ...(feature.metadata ?? {}),
            initializationValidation: validation,
          },
        };
      }),
    },
  };
}

export function summarizeScanValidation(report: ScanValidationReport): string {
  if (report.featureCount === 0) return 'Validation found no features to review';
  return `Validated ${report.featureCount} feature${report.featureCount === 1 ? '' : 's'}: ${
    report.highConfidenceCount
  } high confidence, ${report.reviewCount} need review, ${report.errorCount} error${
    report.errorCount === 1 ? '' : 's'
  }, ${report.warningCount} warning${report.warningCount === 1 ? '' : 's'}`;
}

export function contextForValidation(context: ProjectContext): ScanValidationContext {
  return {
    sectionCandidates: context.sectionCandidates,
    inventoryPaths: context.inventoryPaths,
  };
}
