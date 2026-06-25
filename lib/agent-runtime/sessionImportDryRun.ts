import type {
  AgentRuntimeSessionImportPreview,
  AgentRuntimeSessionImportPreviewState,
} from './sessionImportPreview';

export type AgentRuntimeSessionImportDryRunStatus = AgentRuntimeSessionImportPreviewState;

export interface AgentRuntimeSessionImportDryRunPlanItem {
  rootPath: string;
  importMode: 'metadata_only';
  artifactCandidateCount?: number;
}

export interface AgentRuntimeSessionImportDryRun {
  toolId: string;
  label: string;
  status: AgentRuntimeSessionImportDryRunStatus;
  summary: string;
  planItems: AgentRuntimeSessionImportDryRunPlanItem[];
  artifactCandidateCount: number | null;
  blockedReasons: string[];
}

function aggregateKnownArtifactCount(planItems: AgentRuntimeSessionImportDryRunPlanItem[]): number | null {
  const countedItems = planItems.filter((item) => typeof item.artifactCandidateCount === 'number');
  if (countedItems.length === 0) return null;
  return countedItems.reduce((sum, item) => sum + (item.artifactCandidateCount ?? 0), 0);
}

function readySummary(planItems: AgentRuntimeSessionImportDryRunPlanItem[], artifactCandidateCount: number | null): string {
  if (artifactCandidateCount !== null) {
    return `Session import dry run: ${planItems.length} root(s) would be scanned as metadata only with ${artifactCandidateCount} artifact candidate(s).`;
  }
  return `Session import dry run: ${planItems.length} root(s) would be scanned as metadata only.`;
}

function nonReadySummary(status: AgentRuntimeSessionImportDryRunStatus, blockedReasons: string[]): string {
  const reason = blockedReasons.length > 0 ? ` ${blockedReasons.join(' ')}` : '';
  return `Session import dry run: ${status}.${reason}`;
}

export function buildAgentRuntimeSessionImportDryRun(
  preview: AgentRuntimeSessionImportPreview,
): AgentRuntimeSessionImportDryRun {
  const planItems: AgentRuntimeSessionImportDryRunPlanItem[] =
    preview.state === 'ready'
      ? preview.rootCandidates
          .filter((root) => root.exists)
          .map((root) => ({
            rootPath: root.path,
            importMode: 'metadata_only' as const,
            ...(typeof root.childCount === 'number' ? { artifactCandidateCount: root.childCount } : {}),
          }))
      : [];
  const artifactCandidateCount = aggregateKnownArtifactCount(planItems);

  return {
    toolId: preview.toolId,
    label: preview.label,
    status: preview.state,
    summary:
      preview.state === 'ready'
        ? readySummary(planItems, artifactCandidateCount)
        : nonReadySummary(preview.state, preview.blockedReasons),
    planItems,
    artifactCandidateCount,
    blockedReasons: [...preview.blockedReasons],
  };
}
