import { readFile, skillList } from '../bridge';
import { MEMORY_ARTIFACT_DEFS } from './memory-catalog';
import { mapMemoryRow, type MemoryScanResult } from './mappers/memory';
import { mapSlashCommandRow, type SlashCommandFile } from './mappers/commands';
import type { IntegrationRow } from './types';
import { parseFrontmatter } from '../skills/utils';

async function probeMemoryFile(absPath: string): Promise<MemoryScanResult> {
  try {
    await readFile(absPath);
    return { absPath, exists: true, modified: '' };
  } catch {
    return { absPath, exists: false, modified: '' };
  }
}

export async function loadMemoryRows(projectRoot: string): Promise<IntegrationRow[]> {
  if (!projectRoot) {
    return MEMORY_ARTIFACT_DEFS.map((def) => mapMemoryRow(def, '', undefined));
  }
  const root = projectRoot.replace(/\/+$/, '');
  const rows: IntegrationRow[] = [];
  for (const def of MEMORY_ARTIFACT_DEFS) {
    const absPath = `${root}/${def.relPath}`;
    const scan = await probeMemoryFile(absPath);
    rows.push(mapMemoryRow(def, root, scan));
  }
  return rows;
}

function triggerFromCommandPath(relPath: string): string {
  const base = relPath.replace(/\\/g, '/').split('/').pop() ?? relPath;
  const stem = base.replace(/\.md$/i, '');
  return stem.startsWith('/') ? stem : `/${stem}`;
}

export async function loadSlashCommandRows(projectRoot: string): Promise<IntegrationRow[]> {
  if (!projectRoot) return [];
  const root = projectRoot.replace(/\/+$/, '');
  const commandsDir = `${root}/.claude/commands`;
  try {
    const files = await skillList(commandsDir);
    const parsed: SlashCommandFile[] = await Promise.all(
      files.map(async (f) => {
        let description = '';
        let name = f.relPath.replace(/\.md$/i, '');
        try {
          const raw = await readFile(f.absPath);
          const fm = parseFrontmatter(raw);
          description = fm.description;
          if (fm.name) name = fm.name;
        } catch {
          /* use defaults */
        }
        return {
          absPath: f.absPath,
          relPath: f.relPath,
          trigger: triggerFromCommandPath(f.relPath),
          name,
          description,
          modified: f.modified,
          size: f.size,
        };
      }),
    );
    parsed.sort((a, b) => a.trigger.localeCompare(b.trigger));
    return parsed.map((file) => mapSlashCommandRow(file, commandsDir));
  } catch {
    return [];
  }
}
