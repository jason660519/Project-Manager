import type { Feature, FeaturePaths, ProjectManagerConfig } from '../types';
import { formatSectionCandidatesForPrompt } from './sectionInventory';
import {
  attachScanValidationMetadata,
  validateFeatureScan,
  type FeatureScanValidation,
  type ScanValidationContext,
  type ScanValidationReport,
} from './scanValidation';
import type { ProjectContext } from './shared';

type FeatureRevision = Partial<
  Pick<Feature, 'name' | 'category' | 'locatedSection' | 'notes' | 'metadata'>
> & {
  id: string;
  paths?: Partial<FeaturePaths>;
};

export interface ScanReviewResponse {
  revisions: FeatureRevision[];
  rejected?: Array<{ id: string; reason: string }>;
}

export interface ScanReviewMergeResult {
  config: ProjectManagerConfig;
  report: ScanValidationReport;
  reviewedCount: number;
  acceptedCount: number;
  rejectedCount: number;
}

export interface ScanReviewSummary {
  attempted: boolean;
  provider?: string;
  modelId?: string;
  reviewedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  error?: string;
}

function stripFence(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return cleaned;
}

function issueSummary(validation: FeatureScanValidation): string {
  return validation.issues
    .map((issue) => `${issue.severity}:${issue.code}:${issue.message}`)
    .join(' | ');
}

function compactFeature(feature: Feature): Record<string, unknown> {
  return {
    id: feature.id,
    name: feature.name,
    category: feature.category,
    locatedSection: feature.locatedSection,
    paths: feature.paths,
    notes: feature.notes,
    metadata: {
      initializationConfidence: feature.metadata?.initializationConfidence,
      evidencePaths: feature.metadata?.evidencePaths,
    },
  };
}

export function buildScanReviewPrompt(
  config: ProjectManagerConfig,
  report: ScanValidationReport,
  context: ProjectContext,
): string {
  const byId = new Map(config.features.map((feature) => [feature.id, feature]));
  const reviewItems = report.features
    .filter((validation) => validation.needsReview)
    .map((validation) => ({
      validation,
      feature: byId.get(validation.featureId),
    }))
    .filter((item): item is { validation: FeatureScanValidation; feature: Feature } => Boolean(item.feature));

  const featuresBlock = reviewItems
    .map((item) => {
      return JSON.stringify(
        {
          feature: compactFeature(item.feature),
          validation: {
            confidence: item.validation.confidence,
            evidencePaths: item.validation.evidencePaths,
            issues: issueSummary(item.validation),
          },
        },
        null,
        2,
      );
    })
    .join('\n\n');

  return `You are reviewing a Project Manager initialization result.
Return ONLY valid JSON. Do not add markdown fences.

You will receive only low-confidence features. Revise a feature only when the available evidence supports a better value.
Do not invent files, routes, or sections. locatedSection must be an exact Section Candidate label.
Do not add new features. Do not remove features. Keep the same feature ids.
If a feature cannot be improved from evidence, put it in rejected with a reason.

## OUTPUT FORMAT
{
  "revisions": [
    {
      "id": "<existing feature id>",
      "name": "<optional improved name>",
      "category": "<optional improved category>",
      "locatedSection": "<optional exact Section Candidate label or empty string>",
      "paths": {
        "implementation": "<optional existing relative path>",
        "spec": "<optional existing relative path>",
        "test": "<optional existing relative path>"
      },
      "metadata": {
        "evidencePaths": ["<existing relative paths>"],
        "reviewConfidence": <number 0-1>
      },
      "notes": "<optional short note>"
    }
  ],
  "rejected": [
    { "id": "<existing feature id>", "reason": "<why evidence was insufficient>" }
  ]
}

## SECTION CANDIDATES
\`\`\`
${formatSectionCandidatesForPrompt(context.sectionCandidates ?? [])}
\`\`\`

## LOW-CONFIDENCE FEATURES
\`\`\`
${featuresBlock || '(none)'}
\`\`\`
`;
}

export function parseScanReviewResponse(raw: string): ScanReviewResponse {
  const parsed = JSON.parse(stripFence(raw)) as Partial<ScanReviewResponse>;
  return {
    revisions: Array.isArray(parsed.revisions)
      ? parsed.revisions.filter((revision): revision is FeatureRevision => typeof revision?.id === 'string')
      : [],
    rejected: Array.isArray(parsed.rejected)
      ? parsed.rejected.flatMap((item) =>
          typeof item?.id === 'string' && typeof item?.reason === 'string'
            ? [{ id: item.id, reason: item.reason }]
            : [],
        )
      : [],
  };
}

function mergeRevision(feature: Feature, revision: FeatureRevision): Feature {
  return {
    ...feature,
    ...(typeof revision.name === 'string' && revision.name.trim() ? { name: revision.name.trim() } : {}),
    ...(typeof revision.category === 'string' && revision.category.trim()
      ? { category: revision.category.trim() }
      : {}),
    ...(typeof revision.locatedSection === 'string'
      ? { locatedSection: revision.locatedSection.trim() || undefined }
      : {}),
    ...(typeof revision.notes === 'string' ? { notes: revision.notes.trim() || undefined } : {}),
    paths: {
      ...feature.paths,
      ...(revision.paths ?? {}),
    },
    metadata: {
      ...(feature.metadata ?? {}),
      ...(revision.metadata ?? {}),
    },
  };
}

function validationErrorCount(validation: FeatureScanValidation): number {
  return validation.issues.filter((issue) => issue.severity === 'error').length;
}

function shouldAcceptRevision(
  before: FeatureScanValidation,
  after: FeatureScanValidation,
): boolean {
  if (before.needsReview && !after.needsReview) return true;
  if (validationErrorCount(after) < validationErrorCount(before)) return true;
  return after.confidence >= before.confidence + 0.05;
}

export function mergeScanReviewResponse(
  config: ProjectManagerConfig,
  initialReport: ScanValidationReport,
  review: ScanReviewResponse,
  context: ScanValidationContext,
): ScanReviewMergeResult {
  const needsReviewIds = new Set(
    initialReport.features.filter((item) => item.needsReview).map((item) => item.featureId),
  );
  const beforeById = new Map(initialReport.features.map((item) => [item.featureId, item]));
  const revisionsById = new Map(review.revisions.map((revision) => [revision.id, revision]));
  let acceptedCount = 0;
  let rejectedCount = review.rejected?.length ?? 0;

  const features = config.features.map((feature) => {
    if (!needsReviewIds.has(feature.id)) return feature;
    const revision = revisionsById.get(feature.id);
    if (!revision) return feature;
    const candidate = mergeRevision(feature, revision);
    const before = beforeById.get(feature.id);
    const after = validateFeatureScan(candidate, context);
    if (!before || !shouldAcceptRevision(before, after)) {
      rejectedCount++;
      return feature;
    }
    acceptedCount++;
    return {
      ...candidate,
      metadata: {
        ...(candidate.metadata ?? {}),
        initializationReview: {
          accepted: true,
          confidenceBefore: before.confidence,
          confidenceAfter: after.confidence,
        },
      },
    };
  });

  const enriched = attachScanValidationMetadata({ ...config, features }, context);
  return {
    config: enriched.config,
    report: enriched.report,
    reviewedCount: needsReviewIds.size,
    acceptedCount,
    rejectedCount,
  };
}

