import type { ActiveRun, Feature, FeatureDependencyKind, FeatureDependencyRef } from '../../../lib/types';

export type DependencyIssueKind = 'self' | 'missing' | 'cycle';
export type DependencyReadinessState = 'ready' | 'warning' | 'blocked';

export interface FeatureDependencyIdentity {
  key: string;
  projectId?: string;
  featureId: string;
  displayId: string;
  feature: Feature;
}

export interface ResolvedFeatureDependency {
  ref: FeatureDependencyRef;
  ownerKey: string;
  targetKey: string;
  kind: FeatureDependencyKind;
  feature?: Feature;
  missing: boolean;
  self: boolean;
}

export interface FeatureDependencyIssue {
  kind: DependencyIssueKind;
  featureKey: string;
  ref?: FeatureDependencyRef;
  cycle?: string[];
}

export interface FeatureDependencyGraph {
  identities: Map<string, FeatureDependencyIdentity>;
  byDisplayId: Map<string, FeatureDependencyIdentity[]>;
  upstreamByKey: Map<string, ResolvedFeatureDependency[]>;
  downstreamByKey: Map<string, ResolvedFeatureDependency[]>;
  issuesByKey: Map<string, FeatureDependencyIssue[]>;
}

export interface DependencyDispatchReadiness {
  state: DependencyReadinessState;
  blockers: string[];
  warnings: string[];
}

function splitNamespacedId(id: string): { projectId?: string; featureId: string } {
  const sep = id.indexOf('::');
  if (sep <= 0) return { featureId: id };
  return { projectId: id.slice(0, sep), featureId: id.slice(sep + 2) };
}

export function getFeatureDependencyIdentity(feature: Feature): FeatureDependencyIdentity {
  const split = splitNamespacedId(feature.id);
  const projectId =
    (feature.metadata?.sourceProjectId as string | undefined)
    ?? split.projectId;
  const featureId =
    (feature.metadata?.sourceFeatureId as string | undefined)
    ?? split.featureId;
  const key = dependencyKey({ projectId, featureId });
  return {
    key,
    projectId,
    featureId,
    displayId: projectId ? `${projectId}::${featureId}` : featureId,
    feature,
  };
}

export function dependencyKey(ref: { projectId?: string; featureId: string }): string {
  return `${ref.projectId ?? ''}::${ref.featureId}`;
}

export function normalizeDependencyRef(ref: FeatureDependencyRef): FeatureDependencyRef {
  return {
    projectId: ref.projectId?.trim() || undefined,
    featureId: ref.featureId.trim(),
    kind: ref.kind === 'soft' ? 'soft' : 'hard',
    reason: ref.reason?.trim() || undefined,
  };
}

export function parseDependencyInput(input: string): FeatureDependencyRef[] {
  const seen = new Set<string>();
  return input
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const soft = part.endsWith('?') || /:soft$/i.test(part);
      const cleaned = part.replace(/\?$/, '').replace(/:(hard|soft)$/i, '').trim();
      const projectSep = cleaned.indexOf('::');
      const ref = projectSep > 0
        ? { projectId: cleaned.slice(0, projectSep), featureId: cleaned.slice(projectSep + 2), kind: soft ? 'soft' as const : 'hard' as const }
        : { featureId: cleaned, kind: soft ? 'soft' as const : 'hard' as const };
      return normalizeDependencyRef(ref);
    })
    .filter((ref) => {
      if (!ref.featureId) return false;
      const key = dependencyKey(ref);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function resolveDependencyTarget(
  owner: FeatureDependencyIdentity,
  ref: FeatureDependencyRef,
  identities: Map<string, FeatureDependencyIdentity>,
  byDisplayId: Map<string, FeatureDependencyIdentity[]>,
): { key: string; identity?: FeatureDependencyIdentity } {
  const normalized = normalizeDependencyRef(ref);
  const sameProjectKey = dependencyKey({
    projectId: normalized.projectId ?? owner.projectId,
    featureId: normalized.featureId,
  });
  const direct = identities.get(sameProjectKey);
  if (direct) return { key: direct.key, identity: direct };

  if (!normalized.projectId) {
    const matches = byDisplayId.get(normalized.featureId) ?? [];
    if (matches.length === 1) return { key: matches[0].key, identity: matches[0] };
  }

  return { key: sameProjectKey };
}

function addIssue(map: Map<string, FeatureDependencyIssue[]>, issue: FeatureDependencyIssue) {
  const current = map.get(issue.featureKey) ?? [];
  map.set(issue.featureKey, [...current, issue]);
}

export function buildFeatureDependencyGraph(features: Feature[]): FeatureDependencyGraph {
  const identities = new Map<string, FeatureDependencyIdentity>();
  const byDisplayId = new Map<string, FeatureDependencyIdentity[]>();

  features.forEach((feature) => {
    const identity = getFeatureDependencyIdentity(feature);
    identities.set(identity.key, identity);
    byDisplayId.set(identity.featureId, [...(byDisplayId.get(identity.featureId) ?? []), identity]);
  });

  const upstreamByKey = new Map<string, ResolvedFeatureDependency[]>();
  const downstreamByKey = new Map<string, ResolvedFeatureDependency[]>();
  const issuesByKey = new Map<string, FeatureDependencyIssue[]>();

  identities.forEach((identity) => {
    const refs = identity.feature.upstreamDependencies ?? [];
    const resolved = refs.map((rawRef) => {
      const ref = normalizeDependencyRef(rawRef);
      const target = resolveDependencyTarget(identity, ref, identities, byDisplayId);
      const self = target.key === identity.key;
      const dependency: ResolvedFeatureDependency = {
        ref,
        ownerKey: identity.key,
        targetKey: target.key,
        kind: ref.kind ?? 'hard',
        feature: target.identity?.feature,
        missing: !target.identity,
        self,
      };
      if (self) addIssue(issuesByKey, { kind: 'self', featureKey: identity.key, ref });
      if (dependency.missing) addIssue(issuesByKey, { kind: 'missing', featureKey: identity.key, ref });
      return dependency;
    });
    upstreamByKey.set(identity.key, resolved);
    resolved.forEach((dependency) => {
      downstreamByKey.set(dependency.targetKey, [...(downstreamByKey.get(dependency.targetKey) ?? []), dependency]);
    });
  });

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const visit = (key: string) => {
    if (visiting.has(key)) {
      const start = stack.indexOf(key);
      const cycle = start >= 0 ? [...stack.slice(start), key] : [key];
      cycle.forEach((cycleKey) => addIssue(issuesByKey, { kind: 'cycle', featureKey: cycleKey, cycle }));
      return;
    }
    if (visited.has(key)) return;
    visiting.add(key);
    stack.push(key);
    for (const dep of upstreamByKey.get(key) ?? []) {
      if (!dep.missing && !dep.self) visit(dep.targetKey);
    }
    stack.pop();
    visiting.delete(key);
    visited.add(key);
  };

  identities.forEach((_, key) => visit(key));

  return { identities, byDisplayId, upstreamByKey, downstreamByKey, issuesByKey };
}

export function dependencyRefLabel(ref: FeatureDependencyRef): string {
  const normalized = normalizeDependencyRef(ref);
  const label = normalized.projectId ? `${normalized.projectId}::${normalized.featureId}` : normalized.featureId;
  return normalized.kind === 'soft' ? `${label}?` : label;
}

export function dependencyInputValue(refs: FeatureDependencyRef[] | undefined): string {
  return (refs ?? []).map(dependencyRefLabel).join(', ');
}

export function dispatchReadinessForFeature(
  feature: Feature,
  graph: FeatureDependencyGraph,
  activeRuns: ActiveRun[] = [],
): DependencyDispatchReadiness {
  const identity = getFeatureDependencyIdentity(feature);
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (activeRuns.some((run) => run.featureId === feature.id)) {
    blockers.push(`${identity.displayId} already has an active run`);
  }

  for (const issue of graph.issuesByKey.get(identity.key) ?? []) {
    if (issue.kind === 'self') blockers.push(`${identity.displayId} depends on itself`);
    if (issue.kind === 'missing') blockers.push(`${identity.displayId} references missing dependency ${issue.ref ? dependencyRefLabel(issue.ref) : ''}`.trim());
    if (issue.kind === 'cycle') blockers.push(`${identity.displayId} is part of a dependency cycle`);
  }

  for (const dependency of graph.upstreamByKey.get(identity.key) ?? []) {
    if (dependency.missing || dependency.self) continue;
    const depIdentity = dependency.feature ? getFeatureDependencyIdentity(dependency.feature) : undefined;
    const label = depIdentity?.displayId ?? dependencyRefLabel(dependency.ref);
    const done = dependency.feature?.status === 'done';
    if (dependency.kind === 'soft') {
      if (!done) warnings.push(`Soft dependency ${label} is not done`);
    } else if (!done) {
      blockers.push(`Hard dependency ${label} is not done`);
    }
  }

  return {
    state: blockers.length > 0 ? 'blocked' : warnings.length > 0 ? 'warning' : 'ready',
    blockers,
    warnings,
  };
}
