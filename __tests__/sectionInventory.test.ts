import { describe, expect, it } from 'vitest';
import {
  buildSectionCandidatesFromNodes,
  formatSectionCandidatesForPrompt,
  type SectionInventoryNode,
} from '../lib/scanner/sectionInventory';

const root = '/tmp/property-manager';

function file(path: string): SectionInventoryNode {
  const parts = path.split('/');
  return {
    name: parts[parts.length - 1]!,
    path: `${root}/${path}`,
    isDir: false,
    children: [],
  };
}

function dir(path: string, children: SectionInventoryNode[]): SectionInventoryNode {
  const parts = path.split('/');
  return {
    name: parts[parts.length - 1]!,
    path: `${root}/${path}`,
    isDir: true,
    children,
  };
}

describe('section inventory', () => {
  it('extracts route and module candidates from a project tree', () => {
    const nodes = [
      dir('app', [
        dir('app/superadmin', [
          dir('app/superadmin/properties', [
            file('app/superadmin/properties/page.tsx'),
            dir('app/superadmin/properties/[id]', [
              dir('app/superadmin/properties/[id]/edit', [
                file('app/superadmin/properties/[id]/edit/page.tsx'),
              ]),
            ]),
          ]),
        ]),
      ]),
      dir('components', [
        dir('components/property', [file('components/property/PropertyMediaSection.tsx')]),
      ]),
    ];

    const candidates = buildSectionCandidatesFromNodes(nodes, root);
    expect(candidates.map((candidate) => candidate.label)).toEqual(
      expect.arrayContaining([
        '/superadmin/properties',
        '/superadmin/properties/[id]/edit',
        'app/superadmin/properties',
        'components/property',
      ]),
    );
  });

  it('formats candidate labels for prompt constraints', () => {
    const promptBlock = formatSectionCandidatesForPrompt([
      {
        id: 'route:superadmin/properties',
        label: '/superadmin/properties',
        kind: 'route',
        path: 'app/superadmin/properties/page.tsx',
        evidencePaths: ['app/superadmin/properties/page.tsx'],
      },
    ]);

    expect(promptBlock).toContain('/superadmin/properties [route]');
    expect(promptBlock).toContain('evidence=app/superadmin/properties/page.tsx');
  });
});
