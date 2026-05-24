export type SectionCandidateKind = 'route' | 'module' | 'docs' | 'test';

export interface SectionCandidate {
  id: string;
  label: string;
  kind: SectionCandidateKind;
  path: string;
  evidencePaths: string[];
}

export interface SectionInventoryNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: SectionInventoryNode[];
}

const MAX_SECTION_CANDIDATES = 80;
const MAX_EVIDENCE_PATHS = 4;

const SOURCE_EXTENSIONS = new Set([
  'astro',
  'css',
  'go',
  'java',
  'js',
  'jsx',
  'php',
  'py',
  'rb',
  'rs',
  'svelte',
  'ts',
  'tsx',
  'vue',
]);

const MODULE_ROOTS = [
  'app',
  'src/app',
  'pages',
  'src/pages',
  'components',
  'src/components',
  'features',
  'src/features',
  'modules',
  'src/modules',
  'lib',
  'src/lib',
];

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

function normalizeLabel(label: string): string {
  return label.replace(/\\/g, '/').replace(/\/+$/, '').trim();
}

function relativePath(root: string, path: string): string {
  const normalizedRoot = normalizePath(root);
  const normalizedPath = normalizePath(path);
  if (normalizedPath === normalizedRoot) return '';
  if (normalizedPath.startsWith(`${normalizedRoot}/`)) {
    return normalizedPath.slice(normalizedRoot.length + 1);
  }
  return normalizedPath;
}

function extension(path: string): string {
  const match = path.match(/\.([^.\/]+)$/);
  return match?.[1]?.toLowerCase() ?? '';
}

function isSourceFile(path: string): boolean {
  return SOURCE_EXTENSIONS.has(extension(path));
}

function isTestPath(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    lower.includes('__tests__/') ||
    lower.includes('/tests/') ||
    lower.includes('/test/') ||
    /\.(test|spec)\.[^.]+$/.test(lower)
  );
}

function routeLabelForFile(path: string): string | undefined {
  const normalized = normalizePath(path);
  const appMatch = normalized.match(/^(?:src\/)?app\/(.+)\/(?:page|layout|route)\.[jt]sx?$/);
  if (appMatch) {
    const route = appMatch[1]
      .split('/')
      .filter((part) => !part.startsWith('(') && !part.startsWith('@'))
      .join('/');
    return route ? `/${route}` : '/';
  }

  const pageMatch = normalized.match(/^(?:src\/)?pages\/(.+)\.[jt]sx?$/);
  if (!pageMatch) return undefined;
  const route = pageMatch[1]
    .replace(/\/index$/, '')
    .replace(/^index$/, '')
    .replace(/\[\.{3}(.+)\]/g, '[...$1]');
  return route ? `/${route}` : '/';
}

function moduleRootForPath(path: string): string | undefined {
  const normalized = normalizePath(path);
  return MODULE_ROOTS
    .filter((root) => normalized === root || normalized.startsWith(`${root}/`))
    .sort((a, b) => b.length - a.length)[0];
}

function shouldIncludeModuleDir(path: string): boolean {
  const root = moduleRootForPath(path);
  if (!root) return false;
  const remainder = normalizePath(path).slice(root.length).replace(/^\/+/, '');
  if (!remainder) return false;
  const depth = remainder.split('/').filter(Boolean).length;
  if (root.includes('app') || root.includes('pages')) return depth <= 5;
  return depth <= 4;
}

function normalizeId(kind: SectionCandidateKind, label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9/.[\]-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-/]+|[-/]+$/g, '');
  return `${kind}:${slug || 'root'}`;
}

function collectEvidence(node: SectionInventoryNode, root: string, out: string[] = []): string[] {
  if (out.length >= MAX_EVIDENCE_PATHS) return out;
  if (!node.isDir) {
    const rel = relativePath(root, node.path);
    if (rel && (isSourceFile(rel) || rel.endsWith('.md'))) out.push(rel);
    return out;
  }
  for (const child of node.children ?? []) {
    collectEvidence(child, root, out);
    if (out.length >= MAX_EVIDENCE_PATHS) break;
  }
  return out;
}

function walkNodes(
  nodes: SectionInventoryNode[],
  root: string,
  visit: (node: SectionInventoryNode, relPath: string) => void,
): void {
  for (const node of nodes) {
    const rel = relativePath(root, node.path);
    visit(node, rel);
    if (node.isDir && node.children?.length) walkNodes(node.children, root, visit);
  }
}

function addCandidate(
  map: Map<string, SectionCandidate>,
  candidate: Omit<SectionCandidate, 'id'>,
): void {
  const label = normalizeLabel(candidate.label);
  if (!label) return;
  const key = `${candidate.kind}:${label}`;
  if (map.has(key)) return;
  map.set(key, {
    ...candidate,
    id: normalizeId(candidate.kind, label),
    label,
    path: normalizePath(candidate.path),
    evidencePaths: candidate.evidencePaths.map(normalizePath).filter(Boolean),
  });
}

function candidateRank(candidate: SectionCandidate): number {
  const kindRank = { route: 0, module: 1, docs: 2, test: 3 }[candidate.kind];
  const depth = candidate.path.split('/').length;
  return kindRank * 100 + depth;
}

export function buildSectionCandidatesFromNodes(
  nodes: SectionInventoryNode[],
  root: string,
): SectionCandidate[] {
  const normalizedRoot = root.replace(/\/+$/, '');
  const candidates = new Map<string, SectionCandidate>();

  walkNodes(nodes, normalizedRoot, (node, relPath) => {
    const rel = normalizePath(relPath);
    if (!rel) return;

    if (!node.isDir) {
      const routeLabel = routeLabelForFile(rel);
      if (routeLabel) {
        addCandidate(candidates, {
          kind: 'route',
          label: routeLabel,
          path: rel,
          evidencePaths: [rel],
        });
      }
      if (isTestPath(rel)) {
        const label = rel.replace(/^(__tests__|tests|test)\//, 'tests/');
        addCandidate(candidates, {
          kind: 'test',
          label,
          path: rel,
          evidencePaths: [rel],
        });
      }
      return;
    }

    const evidencePaths = collectEvidence(node, normalizedRoot);
    if (evidencePaths.length === 0) return;

    if (shouldIncludeModuleDir(rel)) {
      addCandidate(candidates, {
        kind: 'module',
        label: rel,
        path: rel,
        evidencePaths,
      });
    }

    if (rel === 'docs' || rel.startsWith('docs/')) {
      addCandidate(candidates, {
        kind: 'docs',
        label: rel,
        path: rel,
        evidencePaths,
      });
    }
  });

  return [...candidates.values()]
    .sort((a, b) => {
      const rankDelta = candidateRank(a) - candidateRank(b);
      if (rankDelta !== 0) return rankDelta;
      return a.label.localeCompare(b.label);
    })
    .slice(0, MAX_SECTION_CANDIDATES);
}

export function formatSectionCandidatesForPrompt(candidates: SectionCandidate[]): string {
  if (candidates.length === 0) {
    return '(none detected; leave locatedSection empty when no reliable section exists)';
  }
  return candidates
    .map((candidate) => {
      const evidence = candidate.evidencePaths.length > 0
        ? ` evidence=${candidate.evidencePaths.join(', ')}`
        : '';
      return `- ${candidate.label} [${candidate.kind}] path=${candidate.path}${evidence}`;
    })
    .join('\n');
}
