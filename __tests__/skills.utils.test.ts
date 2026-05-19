/**
 * F12 — Suite A: Pure utility functions for the Skills feature.
 * Tests are written BEFORE the implementation is finalised (TDD Red → Green).
 */

import { describe, expect, it } from 'vitest';
import {
  buildSkillContent,
  parseCategorySlug,
  parseFrontmatter,
  slugify,
} from '../lib/skills/utils';

// ── parseFrontmatter ──────────────────────────────────────────────────────────

describe('parseFrontmatter', () => {
  it('A1 — parses a complete YAML block', () => {
    const raw = `---
name: TDD Workflow
description: "Test-driven development workflow"
version: 2.1.0
metadata:
  tags: [testing, tdd, workflow]
---

# TDD Workflow

Body content here.
`;
    const result = parseFrontmatter(raw);
    expect(result.name).toBe('TDD Workflow');
    expect(result.description).toBe('Test-driven development workflow');
    expect(result.version).toBe('2.1.0');
    expect(result.tags).toEqual(['testing', 'tdd', 'workflow']);
    expect(result.body).toContain('# TDD Workflow');
    expect(result.body).toContain('Body content here.');
  });

  it('A2 — returns empty meta when no frontmatter', () => {
    const raw = '# Just a plain markdown file\n\nNo frontmatter here.';
    const result = parseFrontmatter(raw);
    expect(result.name).toBe('');
    expect(result.description).toBe('');
    expect(result.version).toBe('1.0.0');
    expect(result.tags).toEqual([]);
    expect(result.body).toBe(raw); // whole content is body
  });

  it('A3 — parses tags nested under metadata.hermes.tags', () => {
    const raw = `---
name: hermes-skill
description: "A hermes skill"
version: 1.0.0
metadata:
  hermes:
    tags: [hermes, agent, coding]
---

Body.
`;
    const result = parseFrontmatter(raw);
    expect(result.tags).toEqual(['hermes', 'agent', 'coding']);
  });

  it('A4 — strips surrounding quotes from description', () => {
    const raw = `---
name: My Skill
description: "Quoted description"
version: 1.0.0
---

Body.
`;
    expect(parseFrontmatter(raw).description).toBe('Quoted description');
  });

  it('A4b — strips single-quotes from values', () => {
    const raw = `---
name: 'Single Quoted'
description: 'desc here'
version: 1.0.0
---

Body.
`;
    const result = parseFrontmatter(raw);
    expect(result.name).toBe('Single Quoted');
    expect(result.description).toBe('desc here');
  });

  it('A — falls back to version 1.0.0 when version missing', () => {
    const raw = `---
name: NoVersion
description: "no version"
---

Body.
`;
    expect(parseFrontmatter(raw).version).toBe('1.0.0');
  });

  it('A — returns empty tags array when no tags line', () => {
    const raw = `---
name: NoTags
description: "no tags"
version: 1.0.0
---

Body.
`;
    expect(parseFrontmatter(raw).tags).toEqual([]);
  });
});

// ── parseCategorySlug ─────────────────────────────────────────────────────────

describe('parseCategorySlug', () => {
  it('A5 — 3-part path: category/slug/SKILL.md', () => {
    const result = parseCategorySlug('workflow/tdd-feature-dev/SKILL.md');
    expect(result.category).toBe('workflow');
    expect(result.slug).toBe('tdd-feature-dev');
  });

  it('A6 — 2-part path: category/skill.md', () => {
    const result = parseCategorySlug('workflow/tdd.md');
    expect(result.category).toBe('workflow');
    expect(result.slug).toBe('tdd');
  });

  it('A7 — 1-part path: skill.md → uncategorized', () => {
    const result = parseCategorySlug('SKILL.md');
    expect(result.category).toBe('uncategorized');
    expect(result.slug).toBe('SKILL');
  });

  it('A — handles Windows backslashes', () => {
    const result = parseCategorySlug('workflow\\tdd-dev\\SKILL.md');
    expect(result.category).toBe('workflow');
    expect(result.slug).toBe('tdd-dev');
  });

  it('A — strips .md extension from 2-part path', () => {
    const { slug } = parseCategorySlug('code-review/checklist.md');
    expect(slug).toBe('checklist');
  });
});

// ── slugify ───────────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('A8 — converts spaces and uppercase to kebab-case', () => {
    expect(slugify('TDD Feature Dev')).toBe('tdd-feature-dev');
  });

  it('A9 — replaces special characters with hyphens', () => {
    expect(slugify('Review: Agent (Work)!')).toBe('review-agent-work');
  });

  it('A9b — trims leading/trailing hyphens', () => {
    expect(slugify('  hello  ')).toBe('hello');
  });

  it('A10 — returns "skill" for empty string', () => {
    expect(slugify('')).toBe('skill');
  });

  it('A — returns "skill" for all-special-chars input', () => {
    expect(slugify('!!!???')).toBe('skill');
  });

  it('A — preserves numbers', () => {
    expect(slugify('Plan v2 Feature')).toBe('plan-v2-feature');
  });
});

// ── buildSkillContent ─────────────────────────────────────────────────────────

describe('buildSkillContent', () => {
  const baseForm = {
    name: 'TDD Workflow',
    category: 'workflow',
    customCategory: '',
    description: 'Test-driven development',
    tagsRaw: 'testing, tdd',
    version: '1.0.0',
    body: '## Overview\n\nContent here.',
  };

  it('A11 — output has valid YAML frontmatter', () => {
    const content = buildSkillContent(baseForm);
    expect(content).toMatch(/^---\n/);
    expect(content).toContain('name: TDD Workflow');
    expect(content).toContain('description: "Test-driven development"');
    expect(content).toContain('version: 1.0.0');
  });

  it('A12 — tags serialized as bracket array', () => {
    const content = buildSkillContent(baseForm);
    expect(content).toContain('tags: [testing, tdd]');
  });

  it('A — empty tags produces empty array', () => {
    const content = buildSkillContent({ ...baseForm, tagsRaw: '' });
    expect(content).toContain('tags: []');
  });

  it('A — body appears after closing ---', () => {
    const content = buildSkillContent(baseForm);
    const parts = content.split('---\n');
    // parts[0] = '', parts[1] = yaml block, parts[2] = '\n' + body
    expect(parts.length).toBeGreaterThanOrEqual(3);
    expect(parts[parts.length - 1]).toContain('## Overview');
  });

  it('A — uses customCategory when category is __custom__', () => {
    const content = buildSkillContent({
      ...baseForm,
      category: '__custom__',
      customCategory: 'my-custom-cat',
    });
    expect(content).toContain('category: my-custom-cat');
  });

  it('A — escapes double-quotes in description', () => {
    const content = buildSkillContent({
      ...baseForm,
      description: 'Say "hello" world',
    });
    expect(content).toContain('description: "Say \\"hello\\" world"');
  });

  it('A — falls back to version 1.0.0 when version is empty', () => {
    const content = buildSkillContent({ ...baseForm, version: '' });
    expect(content).toContain('version: 1.0.0');
  });
});
