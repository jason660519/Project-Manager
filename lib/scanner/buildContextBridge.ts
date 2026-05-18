import type { FileNode } from '../bridge';
import { AGENT_MARKERS, IDE_MARKERS, KEY_FILES, type ProjectContext } from './shared';

const MAX_TREE_LINES = 300;
const MAX_FILE_BYTES = 4096;

function truncate(content: string, maxBytes = MAX_FILE_BYTES): string {
  return content.length > maxBytes ? `${content.slice(0, maxBytes)}\n... (truncated)` : content;
}

function joinRoot(root: string, segment: string): string {
  return `${root.replace(/\/+$/, '')}/${segment}`;
}

function baseName(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  const idx = trimmed.lastIndexOf('/');
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

/** Render a FileNode forest as a text tree (matches server-side buildTree style). */
export function renderFileTree(nodes: FileNode[], rootLabel: string): string {
  const lines: string[] = [`${rootLabel}/`];

  function walk(entries: FileNode[], prefix: string) {
    const sorted = [...entries].sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (let i = 0; i < sorted.length; i++) {
      if (lines.length >= MAX_TREE_LINES) return;
      const entry = sorted[i];
      if (
        entry.name.startsWith('.') &&
        entry.name !== '.project-manager.json' &&
        entry.name !== '.project-manager'
      )
        continue;
      const isLast = i === sorted.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const childPrefix = isLast ? '    ' : '│   ';
      if (entry.isDir) {
        lines.push(`${prefix}${connector}${entry.name}/`);
        if (entry.children?.length) walk(entry.children, prefix + childPrefix);
      } else {
        lines.push(`${prefix}${connector}${entry.name}`);
      }
    }
  }

  walk(nodes, '');
  if (lines.length >= MAX_TREE_LINES) {
    return `${lines.join('\n')}\n... (truncated)`;
  }
  return lines.join('\n');
}

/**
 * Build scan context using the Tauri filesystem bridge (desktop + dev shell).
 * Prompt assembly stays in TypeScript (ADR-003).
 */
export async function buildProjectContextBridge(root: string): Promise<ProjectContext> {
  const { listProjectFiles, readFile } = await import('../bridge');
  const normalizedRoot = root.replace(/\/+$/, '');

  let directoryTree = `${baseName(normalizedRoot)}/\n(unable to list directory)`;
  let rootEntries: FileNode[] = [];
  try {
    rootEntries = await listProjectFiles(normalizedRoot, 3);
    directoryTree = renderFileTree(rootEntries, baseName(normalizedRoot));
  } catch {
    /* keep fallback tree label */
  }

  const keyFiles: Record<string, string> = {};
  for (const file of KEY_FILES) {
    try {
      const content = await readFile(joinRoot(normalizedRoot, file));
      if (content.trim()) keyFiles[file] = truncate(content);
    } catch {
      /* missing file */
    }
  }

  if (!keyFiles['docs/']) {
    try {
      const docsNodes = await listProjectFiles(joinRoot(normalizedRoot, 'docs'), 1);
      if (docsNodes.length > 0) {
        keyFiles['docs/'] = docsNodes.map((n) => n.name).join('\n');
      }
    } catch {
      /* no docs dir */
    }
  }

  const rootNames = new Set(
    (rootEntries.length > 0 ? rootEntries : []).map((n) => n.name),
  );
  if (rootNames.size === 0) {
    try {
      const shallow = await listProjectFiles(normalizedRoot, 1);
      shallow.forEach((n) => rootNames.add(n.name));
    } catch {
      /* ignore */
    }
  }

  const detectedIDEs = Object.entries(IDE_MARKERS)
    .filter(([marker]) => rootNames.has(marker))
    .map(([, ide]) => ide);

  const detectedAgents = Object.entries(AGENT_MARKERS)
    .filter(([marker]) => rootNames.has(marker) || rootNames.has(marker.replace(/^\./, '')))
    .map(([, spec]) => spec.id);

  let projectName = baseName(normalizedRoot);
  if (keyFiles['package.json']) {
    try {
      const pkg = JSON.parse(keyFiles['package.json']) as { name?: string };
      if (pkg.name) projectName = pkg.name;
    } catch {
      /* ignore */
    }
  } else if (keyFiles['Cargo.toml']) {
    const nameMatch = keyFiles['Cargo.toml'].match(/^name\s*=\s*"(.+)"/m);
    if (nameMatch) projectName = nameMatch[1];
  }

  return {
    source: normalizedRoot,
    projectName,
    directoryTree,
    keyFiles,
    detectedIDEs,
    detectedAgents,
  };
}
