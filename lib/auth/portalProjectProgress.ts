import type { CloudFeatureStatus } from '../supabase/cloudSchema';
import { listPortalFeatures, type PortalFeature } from './portalFeatures';
import { listPortalProjects, type PortalProject } from './portalProjects';

export type PortalProjectOverallStatus =
  | 'empty'
  | 'planned'
  | 'in_progress'
  | 'blocked'
  | 'review'
  | 'done'
  | 'mixed';

export interface PortalProjectProgressSummary {
  projectId: string;
  projectName: string;
  createdAt: string;
  featureCount: number;
  plannedCount: number;
  inProgressCount: number;
  blockedCount: number;
  reviewCount: number;
  doneCount: number;
  archivedCount: number;
  averageProgressPercent: number | null;
  lastFeatureUpdatedAt: string | null;
  overallStatus: PortalProjectOverallStatus;
}

export interface PortalProjectProgressListResult {
  summaries: PortalProjectProgressSummary[];
  error: string | null;
}

function countFeaturesByStatus(features: PortalFeature[], status: CloudFeatureStatus): number {
  return features.filter((feature) => feature.status === status).length;
}

function computeAverageProgress(features: PortalFeature[]): number | null {
  const values = features.flatMap((feature) =>
    feature.progressPercent === null ? [] : [feature.progressPercent],
  );

  if (values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 10) / 10;
}

function computeLastFeatureUpdatedAt(features: PortalFeature[]): string | null {
  if (features.length === 0) {
    return null;
  }

  return features.reduce(
    (latest, feature) => (latest > feature.updatedAt ? latest : feature.updatedAt),
    features[0].updatedAt,
  );
}

export function derivePortalProjectOverallStatus(
  features: PortalFeature[],
): PortalProjectOverallStatus {
  if (features.length === 0) {
    return 'empty';
  }

  const blockedCount = countFeaturesByStatus(features, 'blocked');
  if (blockedCount > 0) {
    return 'blocked';
  }

  const inProgressCount = countFeaturesByStatus(features, 'in_progress');
  if (inProgressCount > 0) {
    return 'in_progress';
  }

  const reviewCount = countFeaturesByStatus(features, 'review');
  if (reviewCount > 0) {
    return 'review';
  }

  const doneCount = countFeaturesByStatus(features, 'done');
  const archivedCount = countFeaturesByStatus(features, 'archived');
  if (doneCount + archivedCount === features.length) {
    return 'done';
  }

  const plannedCount = countFeaturesByStatus(features, 'planned');
  if (plannedCount === features.length) {
    return 'planned';
  }

  return 'mixed';
}

export function summarizePortalProjectProgress(
  projects: PortalProject[],
  features: PortalFeature[],
): PortalProjectProgressSummary[] {
  const featuresByProject = new Map<string, PortalFeature[]>();

  for (const feature of features) {
    const bucket = featuresByProject.get(feature.projectId) ?? [];
    bucket.push(feature);
    featuresByProject.set(feature.projectId, bucket);
  }

  return projects.map((project) => {
    const projectFeatures = featuresByProject.get(project.id) ?? [];

    return {
      projectId: project.id,
      projectName: project.name,
      createdAt: project.createdAt,
      featureCount: projectFeatures.length,
      plannedCount: countFeaturesByStatus(projectFeatures, 'planned'),
      inProgressCount: countFeaturesByStatus(projectFeatures, 'in_progress'),
      blockedCount: countFeaturesByStatus(projectFeatures, 'blocked'),
      reviewCount: countFeaturesByStatus(projectFeatures, 'review'),
      doneCount: countFeaturesByStatus(projectFeatures, 'done'),
      archivedCount: countFeaturesByStatus(projectFeatures, 'archived'),
      averageProgressPercent: computeAverageProgress(projectFeatures),
      lastFeatureUpdatedAt: computeLastFeatureUpdatedAt(projectFeatures),
      overallStatus: derivePortalProjectOverallStatus(projectFeatures),
    };
  });
}

export async function listPortalProjectProgress(
  workspaceId?: string | null,
): Promise<PortalProjectProgressListResult> {
  const [projectResult, featureResult] = await Promise.all([
    listPortalProjects(undefined, workspaceId),
    listPortalFeatures(undefined, workspaceId),
  ]);

  if (projectResult.error) {
    return {
      summaries: [],
      error: projectResult.error,
    };
  }

  if (featureResult.error) {
    return {
      summaries: [],
      error: featureResult.error,
    };
  }

  return {
    summaries: summarizePortalProjectProgress(projectResult.projects, featureResult.features),
    error: null,
  };
}

export function formatProjectOverallStatusLabel(status: PortalProjectOverallStatus): string {
  switch (status) {
    case 'empty':
      return 'No features yet';
    case 'planned':
      return 'Planned';
    case 'in_progress':
      return 'In progress';
    case 'blocked':
      return 'Blocked';
    case 'review':
      return 'In review';
    case 'done':
      return 'Complete';
    case 'mixed':
      return 'Mixed progress';
    default:
      return status;
  }
}

export function formatProjectProgressSummaryLine(summary: PortalProjectProgressSummary): string {
  if (summary.featureCount === 0) {
    return 'No cloud features indexed for this project yet.';
  }

  const parts = [`${summary.featureCount} feature${summary.featureCount === 1 ? '' : 's'}`];

  if (summary.blockedCount > 0) {
    parts.push(`${summary.blockedCount} blocked`);
  }

  if (summary.inProgressCount > 0) {
    parts.push(`${summary.inProgressCount} active`);
  }

  if (summary.averageProgressPercent !== null) {
    parts.push(`${summary.averageProgressPercent.toFixed(0)}% avg`);
  }

  return parts.join(' · ');
}
