/**
 * Pure utility functions for the Skills feature (F12).
 * No React, no Tauri bridge — all unit-testable.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SkillFrontmatter {
  name: string;
  description: string;
  version: string;
  tags: string[];
  body: string; // markdown after the closing ---
}

export interface SkillForm {
  name: string;
  category: string;
  customCategory: string;
  description: string;
  tagsRaw: string; // comma-separated input string
  version: string;
  body: string;
}

// ── parseFrontmatter ──────────────────────────────────────────────────────────

/**
 * Parse YAML frontmatter from a SKILL.md file.
 * Tolerates missing or malformed frontmatter gracefully.
 */
export function parseFrontmatter(raw: string): SkillFrontmatter {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { name: '', description: '', version: '1.0.0', tags: [], body: raw };
  }

  const yaml = match[1] ?? '';
  const body = (match[2] ?? '').trimStart();

  const getVal = (key: string): string => {
    const m = yaml.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
  };

  // Tags may appear as:
  //   tags: [tag1, tag2]          (top-level)
  //   metadata:\n  hermes:\n    tags: [tag1, tag2]  (nested)
  let tags: string[] = [];
  const tagsMatch = yaml.match(/tags:\s*\[([^\]]*)\]/);
  if (tagsMatch) {
    tags = tagsMatch[1]
      .split(',')
      .map((t) => t.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }

  return {
    name: getVal('name'),
    description: getVal('description'),
    version: getVal('version') || '1.0.0',
    tags,
    body,
  };
}

// ── parseCategorySlug ─────────────────────────────────────────────────────────

/**
 * Derive category and slug from a skill's relative path.
 *
 * | relPath                        | category       | slug       |
 * |--------------------------------|----------------|------------|
 * | workflow/tdd-dev/SKILL.md      | workflow       | tdd-dev    |
 * | workflow/tdd.md                | workflow       | tdd        |
 * | SKILL.md                       | uncategorized  | SKILL      |
 */
export function parseCategorySlug(relPath: string): { category: string; slug: string } {
  const parts = relPath.replace(/\\/g, '/').split('/');
  if (parts.length >= 3) return { category: parts[0], slug: parts[1] };
  if (parts.length === 2)
    return { category: parts[0], slug: parts[1].replace(/\.md$/i, '') };
  return { category: 'uncategorized', slug: parts[0].replace(/\.md$/i, '') };
}

// ── slugify ───────────────────────────────────────────────────────────────────

/**
 * Convert a human-readable skill name into a safe directory slug.
 * Falls back to `'skill'` if the result would be empty.
 */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'skill'
  );
}

// ── buildSkillContent ─────────────────────────────────────────────────────────

/**
 * Serialize a SkillForm into a SKILL.md string (frontmatter + body).
 */
export function buildSkillContent(form: SkillForm): string {
  const category =
    form.category === '__custom__' ? form.customCategory.trim() : form.category;
  const tags = form.tagsRaw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const tagsStr = tags.length ? `[${tags.join(', ')}]` : '[]';
  return (
    `---\n` +
    `name: ${form.name.trim()}\n` +
    `description: "${form.description.trim().replace(/"/g, '\\"')}"\n` +
    `version: ${form.version.trim() || '1.0.0'}\n` +
    `metadata:\n` +
    `  tags: ${tagsStr}\n` +
    `  category: ${category}\n` +
    `---\n\n` +
    `${form.body.trim()}\n`
  );
}
