import { describe, expect, it } from 'vitest';
import {
  buildScanReviewPrompt,
  mergeScanReviewResponse,
  parseScanReviewResponse,
} from '../lib/scanner/scanReview';
import { validateProjectScan } from '../lib/scanner/scanValidation';
import type { Feature, ProjectManagerConfig } from '../lib/types';

function feature(overrides: Partial<Feature> = {}): Feature {
  return {
    id: overrides.id ?? 'F01',
    name: overrides.name ?? 'Dashboard',
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
      id: 'route:properties',
      label: '/properties',
      kind: 'route' as const,
      path: 'app/properties/page.tsx',
      evidencePaths: ['app/properties/page.tsx'],
    },
  ],
  inventoryPaths: ['app', 'app/properties', 'app/properties/page.tsx'],
};

describe('scan review', () => {
  it('builds a prompt containing only low-confidence features and section candidates', () => {
    const cfg = config([
      feature({ id: 'F01', name: 'API', paths: {} }),
      feature({
        id: 'F02',
        name: 'Property List',
        locatedSection: '/properties',
        paths: { implementation: 'app/properties/page.tsx' },
      }),
    ]);
    const report = validateProjectScan(cfg, context);

    const prompt = buildScanReviewPrompt(cfg, report, {
      source: '/tmp/demo',
      projectName: 'Demo',
      directoryTree: 'app/',
      sectionCandidates: context.sectionCandidates,
      inventoryPaths: context.inventoryPaths,
      keyFiles: {},
      detectedIDEs: [],
      detectedAgents: [],
    });

    expect(prompt).toContain('LOW-CONFIDENCE FEATURES');
    expect(prompt).toContain('"id": "F01"');
    expect(prompt).not.toContain('"id": "F02"');
    expect(prompt).toContain('/properties [route]');
  });

  it('parses fenced review JSON', () => {
    const parsed = parseScanReviewResponse(`\`\`\`json
{"revisions":[{"id":"F01","locatedSection":"/properties"}],"rejected":[{"id":"F02","reason":"insufficient evidence"}]}
\`\`\``);

    expect(parsed.revisions[0]).toMatchObject({ id: 'F01', locatedSection: '/properties' });
    expect(parsed.rejected?.[0]).toMatchObject({ id: 'F02' });
  });

  it('accepts revisions that improve validation and rejects non-improving revisions', () => {
    const cfg = config([
      feature({ id: 'F01', name: 'Dashboard', paths: {} }),
      feature({ id: 'F02', name: 'API', paths: {} }),
    ]);
    const report = validateProjectScan(cfg, context);

    const merged = mergeScanReviewResponse(
      cfg,
      report,
      {
        revisions: [
          {
            id: 'F01',
            name: 'Property List',
            locatedSection: '/properties',
            paths: { implementation: 'app/properties/page.tsx' },
            metadata: { evidencePaths: ['app/properties/page.tsx'], reviewConfidence: 0.9 },
          },
          { id: 'F02', name: 'API' },
        ],
      },
      context,
    );

    expect(merged.acceptedCount).toBe(1);
    expect(merged.rejectedCount).toBe(1);
    expect(merged.config.features[0].locatedSection).toBe('/properties');
    expect(merged.config.features[0].metadata?.initializationReview).toMatchObject({
      accepted: true,
    });
    expect(merged.report.reviewCount).toBe(1);
  });
});

