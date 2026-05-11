/**
 * Markdown spec parser — converts a .md file into Feature draft objects.
 *
 * Supported conventions:
 *  - `## Heading`           → one Feature per H2 section
 *  - `**Category:** value`  → sets the feature's category (inside an H2 block)
 *  - `**Status:** value`    → sets the feature's status  (inside an H2 block)
 *  - `- [ ] Task name`      → standalone todo Feature (outside any H2 block)
 *  - Body text under H2     → collected as `notes`
 *
 * Falls back to a single filename-derived Feature when no markers are found.
 */

import type { Feature, FeatureStatus } from '../types';

/** Module-level counter ensures unique IDs within a browser session. */
let _seq = 0;

function nextId(): string {
  _seq = (_seq + 1) % 9999;
  const ts = Date.now().toString(36).toUpperCase().slice(-3);
  const n = _seq.toString(36).toUpperCase().padStart(2, '0');
  return `IMP-${ts}${n}`;
}

/** Kebab-case slug for use in generated file paths. */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const STATUS_MAP: Record<string, FeatureStatus> = {
  'in progress': 'in_progress',
  in_progress: 'in_progress',
  done: 'done',
  completed: 'done',
  'on hold': 'on_hold',
  on_hold: 'on_hold',
  blocked: 'on_hold',
  todo: 'todo',
  'to do': 'todo',
  pending: 'todo',
};

interface FeatureDraft {
  name: string;
  category: string;
  status: FeatureStatus;
  notes: string[];
}

/**
 * Parse a Markdown string into Feature draft objects.
 *
 * @param text     - Raw markdown content
 * @param fileName - Original filename (used for fallback and path generation)
 * @returns        Array of Feature drafts ready for user review
 */
export function parseMarkdown(text: string, fileName: string): Feature[] {
  const features: Feature[] = [];
  const lines = text.split(/\r?\n/);
  const baseName = fileName.replace(/\.md$/i, '');

  let current: FeatureDraft | null = null;

  const flush = () => {
    if (!current) return;
    const slug = toSlug(current.name);
    features.push({
      id: nextId(),
      name: current.name,
      category: current.category,
      status: current.status,
      progress: current.status === 'done' ? 100 : 0,
      paths: { spec: `docs/features/${slug}.md` },
      notes: current.notes.join(' ').trim() || undefined,
    });
    current = null;
  };

  for (const raw of lines) {
    const line = raw.trim();

    // H2 heading → start a new Feature section
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) {
      flush();
      current = { name: h2[1].trim(), category: 'Imported', status: 'todo', notes: [] };
      continue;
    }

    // Outside an H2 block: unchecked list item → standalone todo Feature
    if (!current) {
      const todo = line.match(/^-\s+\[\s?\]\s+(.+)/);
      if (todo) {
        const name = todo[1].trim();
        features.push({
          id: nextId(),
          name,
          category: 'Imported',
          status: 'todo',
          progress: 0,
          paths: { spec: `docs/features/${toSlug(name)}.md` },
        });
      }
      continue;
    }

    // Inside an H2 block — parse inline metadata directives
    const catMatch = line.match(/\*\*Category:\*\*\s*(.+)/i);
    if (catMatch) {
      current.category = catMatch[1].trim();
      continue;
    }

    const statusMatch = line.match(/\*\*Status:\*\*\s*(.+)/i);
    if (statusMatch) {
      const raw2 = statusMatch[1].trim().toLowerCase();
      current.status = STATUS_MAP[raw2] ?? 'todo';
      continue;
    }

    // Collect non-empty, non-structural lines as notes
    if (line && !line.startsWith('#') && line !== '---') {
      current.notes.push(line);
    }
  }

  flush();

  // Fallback: if nothing was parsed, create one feature from the filename
  if (features.length === 0) {
    const displayName = baseName
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    features.push({
      id: nextId(),
      name: displayName,
      category: 'Imported',
      status: 'todo',
      progress: 0,
      paths: { spec: `docs/features/${toSlug(baseName)}.md` },
      notes: `Auto-imported from ${fileName}`,
    });
  }

  return features;
}
