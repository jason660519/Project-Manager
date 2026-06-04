import { describe, expect, it } from 'vitest';
import type { ActiveRun, Feature } from '../lib/types';
import {
  buildFeatureDependencyGraph,
  dependencyInputValue,
  dispatchReadinessForFeature,
  getFeatureDependencyIdentity,
  parseDependencyInput,
} from '../app/project-progress-dashboard/_lib/dependencies';

function feature(id: string, patch: Partial<Feature> = {}): Feature {
  return {
    id,
    name: `Feature ${id}`,
    category: 'Project Dashboard',
    status: 'todo',
    progress: 0,
    phase: 'development',
    paths: {},
    ...patch,
  };
}

describe('Project progress dependency graph', () => {
  it('derives downstream dependencies from persisted upstream refs', () => {
    const upstream = feature('F35', { status: 'done' });
    const downstream = feature('F49', {
      upstreamDependencies: [{ featureId: 'F35', kind: 'hard' }],
    });

    const graph = buildFeatureDependencyGraph([upstream, downstream]);
    const upstreamKey = getFeatureDependencyIdentity(upstream).key;
    const downstreamRefs = graph.downstreamByKey.get(upstreamKey) ?? [];

    expect(downstreamRefs).toHaveLength(1);
    expect(downstreamRefs[0].ownerKey).toBe(getFeatureDependencyIdentity(downstream).key);
  });

  it('blocks dispatch when a hard upstream dependency is not done', () => {
    const upstream = feature('F35', { status: 'in_progress' });
    const target = feature('F49', {
      upstreamDependencies: [{ featureId: 'F35', kind: 'hard' }],
    });
    const graph = buildFeatureDependencyGraph([upstream, target]);

    const readiness = dispatchReadinessForFeature(target, graph);

    expect(readiness.state).toBe('blocked');
    expect(readiness.blockers.join(' ')).toContain('Hard dependency F35 is not done');
  });

  it('warns but does not block when only soft dependencies are incomplete', () => {
    const upstream = feature('F35', { status: 'in_progress' });
    const target = feature('F49', {
      upstreamDependencies: [{ featureId: 'F35', kind: 'soft' }],
    });
    const graph = buildFeatureDependencyGraph([upstream, target]);

    const readiness = dispatchReadinessForFeature(target, graph);

    expect(readiness.state).toBe('warning');
    expect(readiness.blockers).toEqual([]);
    expect(readiness.warnings.join(' ')).toContain('Soft dependency F35 is not done');
  });

  it('blocks self dependencies', () => {
    const target = feature('F49', {
      upstreamDependencies: [{ featureId: 'F49', kind: 'hard' }],
    });
    const graph = buildFeatureDependencyGraph([target]);

    const readiness = dispatchReadinessForFeature(target, graph);

    expect(readiness.state).toBe('blocked');
    expect(readiness.blockers.join(' ')).toContain('depends on itself');
  });

  it('blocks missing dependency refs', () => {
    const target = feature('F49', {
      upstreamDependencies: [{ featureId: 'F99', kind: 'hard' }],
    });
    const graph = buildFeatureDependencyGraph([target]);

    const readiness = dispatchReadinessForFeature(target, graph);

    expect(readiness.state).toBe('blocked');
    expect(readiness.blockers.join(' ')).toContain('missing dependency F99');
  });

  it('blocks dependency cycles', () => {
    const a = feature('F48', {
      upstreamDependencies: [{ featureId: 'F49' }],
    });
    const b = feature('F49', {
      upstreamDependencies: [{ featureId: 'F48' }],
    });
    const graph = buildFeatureDependencyGraph([a, b]);

    expect(dispatchReadinessForFeature(a, graph).state).toBe('blocked');
    expect(dispatchReadinessForFeature(b, graph).state).toBe('blocked');
  });

  it('resolves namespaced dependencies by source project id', () => {
    const ownerA = feature('project-a::F01', {
      metadata: { sourceProjectId: 'project-a', sourceFeatureId: 'F01' },
      status: 'done',
    });
    const ownerB = feature('project-b::F01', {
      metadata: { sourceProjectId: 'project-b', sourceFeatureId: 'F01' },
      status: 'in_progress',
    });
    const target = feature('project-b::F49', {
      metadata: { sourceProjectId: 'project-b', sourceFeatureId: 'F49' },
      upstreamDependencies: [{ featureId: 'F01' }],
    });
    const graph = buildFeatureDependencyGraph([ownerA, ownerB, target]);

    const readiness = dispatchReadinessForFeature(target, graph);

    expect(readiness.state).toBe('blocked');
    expect(readiness.blockers.join(' ')).toContain('project-b::F01');
  });

  it('blocks duplicate active runs', () => {
    const target = feature('F49');
    const graph = buildFeatureDependencyGraph([target]);
    const activeRuns: ActiveRun[] = [{
      pid: 10,
      featureId: 'F49',
      featureName: 'Feature F49',
      command: 'codex',
      args: [],
      startedAt: Date.now(),
      logs: [],
      phase: 'running',
    }];

    const readiness = dispatchReadinessForFeature(target, graph, activeRuns);

    expect(readiness.state).toBe('blocked');
    expect(readiness.blockers.join(' ')).toContain('already has an active run');
  });

  it('parses compact dependency input into structured refs', () => {
    const refs = parseDependencyInput('F35, F42?, project-a::F01:soft, F35');

    expect(refs).toEqual([
      { featureId: 'F35', kind: 'hard' },
      { featureId: 'F42', kind: 'soft' },
      { projectId: 'project-a', featureId: 'F01', kind: 'soft' },
    ]);
    expect(dependencyInputValue(refs)).toBe('F35, F42?, project-a::F01?');
  });
});
