import { describe, expect, it } from 'vitest';

import type { EngineerRole } from '../lib/types';
import {
  formatAgentTeamPrefix,
  resolveSkillsForRole,
  type SkillCatalogEntry,
} from '../lib/dispatch/assembleAgentTeamPrompt';

function catalogEntry(overrides: Partial<SkillCatalogEntry> & Pick<SkillCatalogEntry, 'absPath' | 'relToProject'>): SkillCatalogEntry {
  return {
    relPath: 'workflow/ship/SKILL.md',
    category: 'workflow',
    slug: 'ship',
    name: 'ship',
    tags: [],
    ...overrides,
  };
}

const baseRole: EngineerRole = {
  id: 'role-qa',
  name: 'QA Engineer',
  slug: 'qa',
  skills: ['Testing', 'Playwright'],
  commands: [],
  systemPrompt: 'You are QA.',
  referenceFiles: ['CLAUDE.md'],
};

describe('resolveSkillsForRole', () => {
  const catalog: SkillCatalogEntry[] = [
    catalogEntry({
      absPath: '/proj/.agents/skills/workflow/ship/SKILL.md',
      relToProject: '.agents/skills/workflow/ship/SKILL.md',
      name: 'ship',
      tags: ['release'],
    }),
    catalogEntry({
      absPath: '/proj/.claude/skills/investigate/SKILL.md',
      relToProject: '.claude/skills/investigate/SKILL.md',
      relPath: 'investigate/SKILL.md',
      category: 'investigate',
      slug: 'investigate',
      name: 'investigate',
      tags: ['debug'],
    }),
  ];

  it('resolves explicit skillRefs paths', () => {
    const role: EngineerRole = {
      ...baseRole,
      skillRefs: ['.claude/skills/investigate/SKILL.md'],
      skills: [],
    };
    const resolved = resolveSkillsForRole(role, catalog);
    expect(resolved.map((r) => r.relToProject)).toEqual(['.claude/skills/investigate/SKILL.md']);
  });

  it('fuzzy-matches role.skills labels against catalog names and tags', () => {
    const role: EngineerRole = {
      ...baseRole,
      skillRefs: undefined,
      skills: ['investigate', 'release'],
    };
    const resolved = resolveSkillsForRole(role, catalog);
    expect(resolved.map((r) => r.name).sort()).toEqual(['investigate', 'ship']);
  });
});

describe('formatAgentTeamPrefix', () => {
  it('orders protocol, role, skills, and reference files', () => {
    const text = formatAgentTeamPrefix(
      baseRole,
      {
        protocol: 'Broadcast blockers.',
        skills: [{ relPath: '.agents/skills/workflow/ship/SKILL.md', title: 'ship', body: 'Run verify baseline.' }],
      },
      { engineerLabel: 'AI Engineer', refsPrefix: 'Reference files:', harnessRole: 'worker' },
    ).join('\n');

    const protocolIdx = text.indexOf('[Agent Team Protocol]');
    const roleIdx = text.indexOf('[AI Engineer: QA Engineer (worker)]');
    const skillIdx = text.indexOf('[Skill: ship]');
    const refsIdx = text.indexOf('Reference files:');
    expect(protocolIdx).toBeGreaterThanOrEqual(0);
    expect(roleIdx).toBeGreaterThan(protocolIdx);
    expect(skillIdx).toBeGreaterThan(roleIdx);
    expect(refsIdx).toBeGreaterThan(skillIdx);
  });
});
