import { describe, expect, it } from 'vitest';
import {
  attachScanValidationMetadata,
  validateFeatureScan,
  validateProjectScan,
} from '../lib/scanner/scanValidation';
import type { Feature, ProjectManagerConfig } from '../lib/types';

function feature(overrides: Partial<Feature> = {}): Feature {
  return {
    id: overrides.id ?? 'F01',
    name: overrides.name ?? 'Property Edit',
    category: overrides.category ?? 'Frontend/UI',
    status: overrides.status ?? 'todo',
    progress: overrides.progress ?? 0,
    paths: overrides.paths ?? {},
    ...overrides,
  };
}

function config(features: Feature[]): ProjectManagerConfig {
  return {
    schemaVersion: 7,
    id: 'cfg',
    project: { name: 'Demo', root: '/tmp/demo', defaultIDE: 'Cursor' },
    features,
    adapters: { ides: [], agents: [] },
  };
}

const context = {
  sectionCandidates: [
    {
      id: 'route:superadmin/properties',
      label: '/superadmin/properties',
      kind: 'route' as const,
      path: 'app/superadmin/properties/page.tsx',
      evidencePaths: ['app/superadmin/properties/page.tsx'],
    },
    {
      id: 'module:components/property',
      label: 'components/property',
      kind: 'module' as const,
      path: 'components/property',
      evidencePaths: ['components/property/PropertyMediaSection.tsx'],
    },
  ],
  inventoryPaths: [
    'app',
    'app/superadmin',
    'app/superadmin/properties',
    'app/superadmin/properties/page.tsx',
    'components',
    'components/property',
    'components/property/PropertyMediaSection.tsx',
    '__tests__/property.test.tsx',
  ],
};

describe('scan validation', () => {
  it('marks grounded features as high confidence', () => {
    const result = validateFeatureScan(
      feature({
        locatedSection: '/superadmin/properties',
        paths: { implementation: 'app/superadmin/properties/page.tsx' },
      }),
      context,
    );

    expect(result.needsReview).toBe(false);
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.issues).toHaveLength(0);
  });

  it('flags hallucinated sections and paths for review', () => {
    const result = validateFeatureScan(
      feature({
        locatedSection: 'made-up-section',
        paths: { implementation: 'app/not-real/page.tsx' },
      }),
      context,
    );

    expect(result.needsReview).toBe(true);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['invalid_located_section', 'path_not_found']),
    );
  });

  it('attaches validation metadata to features', () => {
    const { config: enriched, report } = attachScanValidationMetadata(
      config([
        feature({
          id: 'F01',
          locatedSection: '/superadmin/properties',
          paths: { implementation: 'app/superadmin/properties/page.tsx' },
        }),
        feature({
          id: 'F02',
          locatedSection: 'wrong',
          paths: { implementation: 'missing.tsx' },
        }),
      ]),
      context,
    );

    expect(report.featureCount).toBe(2);
    expect(report.reviewCount).toBe(1);
    expect(enriched.features[0].metadata?.initializationValidation).toMatchObject({
      needsReview: false,
    });
    expect(enriched.features[1].metadata?.initializationValidation).toMatchObject({
      needsReview: true,
    });
  });

  it('summarizes project-level validation counts', () => {
    const report = validateProjectScan(
      config([
        feature({
          locatedSection: '/superadmin/properties',
          paths: { implementation: 'app/superadmin/properties/page.tsx' },
        }),
        feature({
          name: 'API',
          paths: {},
        }),
      ]),
      context,
    );

    expect(report.highConfidenceCount).toBe(1);
    expect(report.reviewCount).toBe(1);
    expect(report.warningCount).toBeGreaterThan(0);
  });
});

