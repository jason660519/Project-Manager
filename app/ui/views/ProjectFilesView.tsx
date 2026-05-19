'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  File,
  FileCode2,
  FileJson,
  FileText,
  Filter,
  Folder,
  FolderOpen,
  HelpCircle,
  Minus,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import { FileNode } from '../../../lib/bridge';
import { Feature, FeaturePaths, FeatureStatus, ProjectEntry } from '../../../lib/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const FEATURE_COLORS = [
  { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' },
  { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30' },
  { bg: 'bg-pink-500/20', text: 'text-pink-300', border: 'border-pink-500/30' },
  { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30' },
  { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30' },
  { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/30' },
];

const PATH_TYPE_LABELS: Record<string, { label: string; style: string }> = {
  spec: { label: 'SPEC', style: 'text-amber-300 border-amber-400/30' },
  tdd: { label: 'TDD', style: 'text-blue-300 border-blue-400/30' },
  tddProgressReport: { label: 'TDD-RPT', style: 'text-blue-200 border-blue-300/30' },
  tddProgressReportHtml: { label: 'TDD-HTML', style: 'text-cyan-300 border-cyan-400/30' },
  unitIntegrationTest: { label: 'UNIT', style: 'text-violet-300 border-violet-400/30' },
  e2eAcceptanceTestScriptFolder: { label: 'E2E', style: 'text-purple-300 border-purple-400/30' },
  developmentLogSummaryFolder: { label: 'LOG', style: 'text-stone-300 border-stone-400/30' },
  devLogSummaryHtml: { label: 'LOG-HTML', style: 'text-teal-300 border-teal-400/30' },
  test: { label: 'TEST', style: 'text-purple-300 border-purple-400/30' },
  implementation: { label: 'IMPL', style: 'text-emerald-300 border-emerald-400/30' },
};

const STATUS_STYLES: Record<FeatureStatus, { dot: string; text: string }> = {
  done: { dot: 'bg-emerald-400', text: 'text-emerald-300' },
  in_progress: { dot: 'bg-amber-400', text: 'text-amber-300' },
  todo: { dot: 'bg-stone-400', text: 'text-stone-400' },
  on_hold: { dot: 'bg-red-400', text: 'text-red-300' },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeaturePathInfo {
  featureId: string;
  featureName: string;
  featureStatus: FeatureStatus;
  pathType: string;
  colorIdx: number;
  absPath: string;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function hashToIndex(str: string, len: number): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return ((h % len) + len) % len;
}

function normalizePath(p: string): string {
  return p.replace(/\/+$/, '').replace(/^\/+/, '');
}

/** Build a map from absolute path → array of FeaturePathInfo */
function buildFeaturePathMap(
  features: Feature[],
  projectRoot: string,
): Map<string, FeaturePathInfo[]> {
  const map = new Map<string, FeaturePathInfo[]>();
  const root = normalizePath(projectRoot);

  for (const f of features) {
    const colorIdx = hashToIndex(f.id, FEATURE_COLORS.length);
    const entries = Object.entries(f.paths) as [keyof FeaturePaths, string | undefined][];

    for (const [pathType, relPath] of entries) {
      if (!relPath) continue;
      const absPath = `${root}/${normalizePath(relPath)}`;
      const info: FeaturePathInfo = {
        featureId: f.id,
        featureName: f.name,
        featureStatus: f.status,
        pathType: pathType as string,
        colorIdx,
        absPath,
      };
      const existing = map.get(absPath) ?? [];
      existing.push(info);
      map.set(absPath, existing);
    }
  }
  return map;
}

/** Check if a path is an ancestor of any feature path */
function isAncestorOfFeaturePath(
  nodePath: string,
  featureMap: Map<string, FeaturePathInfo[]>,
): boolean {
  const np = normalizePath(nodePath);
  for (const key of featureMap.keys()) {
    if (key.startsWith(np + '/')) return true;
  }
  return false;
}

/** Build a virtual file tree from feature paths (browser mode fallback) */
function buildVirtualTree(features: Feature[], projectRoot: string): FileNode[] {
  const root = normalizePath(projectRoot);
  const nodeMap = new Map<string, FileNode>();

  const ensureDir = (absPath: string): FileNode => {
    if (nodeMap.has(absPath)) return nodeMap.get(absPath)!;
    const name = absPath.split('/').pop() ?? absPath;
    const node: FileNode = { name, path: absPath, isDir: true, children: [] };
    nodeMap.set(absPath, node);
    return node;
  };

  const allPaths: string[] = [];
  for (const f of features) {
    for (const relPath of Object.values(f.paths)) {
      if (!relPath) continue;
      allPaths.push(`${root}/${normalizePath(relPath)}`);
    }
  }

  for (const absPath of allPaths) {
    const rel = absPath.slice(root.length + 1);
    const parts = rel.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const parent = current;
      current = `${parent}/${parts[i]}`;
      const isLast = i === parts.length - 1;
      const isDir = isLast ? !parts[i].includes('.') : true;

      if (!nodeMap.has(current)) {
        const node: FileNode = { name: parts[i], path: current, isDir, children: [] };
        nodeMap.set(current, node);
      }

      if (i > 0 || parts.length > 1) {
        const parentNode = ensureDir(parent);
        const childNode = nodeMap.get(current)!;
        if (!parentNode.children.some((c) => c.path === childNode.path)) {
          parentNode.children.push(childNode);
        }
      }
    }
  }

  // Collect top-level nodes (children of root)
  const topLevel: FileNode[] = [];
  for (const [path, node] of nodeMap) {
    const rel = path.slice(root.length + 1);
    if (rel && !rel.includes('/')) topLevel.push(node);
  }

  const sortNodes = (nodes: FileNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(topLevel);
  return topLevel;
}

/** Get icon for file based on extension */
function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['ts', 'tsx', 'js', 'jsx', 'rs', 'py', 'go', 'rb', 'java', 'swift', 'vue'].includes(ext))
    return <FileCode2 size={12} className="shrink-0 text-sky-400/70" />;
  if (['html', 'htm'].includes(ext))
    return <FileCode2 size={12} className="shrink-0 text-orange-400/70" />;
  if (['json', 'yaml', 'yml', 'toml'].includes(ext))
    return <FileJson size={12} className="shrink-0 text-yellow-400/70" />;
  if (['md', 'mdx', 'txt', 'rst'].includes(ext))
    return <FileText size={12} className="shrink-0 text-stone-400/70" />;
  return <File size={12} className="shrink-0 text-stone-500" />;
}

// ── Sub-Components ────────────────────────────────────────────────────────────

function FeatureBadge({ info }: { info: FeaturePathInfo }) {
  const color = FEATURE_COLORS[info.colorIdx];
  const ptStyle = PATH_TYPE_LABELS[info.pathType];
  const tooltip = `${info.featureName} [${info.featureId}]\n${ptStyle?.label ?? info.pathType}: ${info.absPath}`;
  return (
    <span className="inline-flex items-center gap-1" title={tooltip}>
      <span
        className={`inline-flex items-center gap-1 rounded-sm border px-1 py-px text-[9px] font-medium leading-none ${color.bg} ${color.text} ${color.border}`}
      >
        {info.featureId}
      </span>
      {ptStyle && (
        <span
          className={`rounded-sm border px-1 py-px text-[8px] font-medium leading-none ${ptStyle.style}`}
        >
          {ptStyle.label}
        </span>
      )}
    </span>
  );
}

function CoverageSection({ features, projectRoot }: { features: Feature[]; projectRoot: string }) {
  if (features.length === 0) return null;

  const root = normalizePath(projectRoot);
  const pathTypeKeys: (keyof FeaturePaths)[] = [
    'spec',
    'tdd',
    'tddProgressReport',
    'unitIntegrationTest',
    'e2eAcceptanceTestScriptFolder',
    'developmentLogSummaryFolder',
  ];

  return (
    <section className="border border-stone-200/15 bg-[rgb(var(--pm-panel))]/72">
      <div className="flex items-center gap-2 border-b border-stone-200/12 px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-200">
          Feature → File Coverage
        </h3>
        <span className="ml-auto text-[10px] text-stone-500">
          {features.length} feature{features.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="divide-y divide-stone-200/8">
        {features.map((f) => {
          const colorIdx = hashToIndex(f.id, FEATURE_COLORS.length);
          const color = FEATURE_COLORS[colorIdx];
          const statusStyle = STATUS_STYLES[f.status];
          const defined = pathTypeKeys.filter((k) => f.paths[k]);
          const total = pathTypeKeys.length;

          return (
            <div key={f.id} className="flex items-center gap-3 px-4 py-2">
              <span
                className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-bold leading-none ${color.bg} ${color.text} ${color.border}`}
              >
                {f.id}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-stone-200">{f.name}</span>

              {/* Path type indicators */}
              <div className="flex items-center gap-1">
                {pathTypeKeys.map((k) => {
                  const has = !!f.paths[k];
                  const ptLabel = PATH_TYPE_LABELS[k]?.label ?? k;
                  return (
                    <span
                      key={k}
                      title={`${ptLabel}: ${has ? `${root}/${f.paths[k]}` : 'not defined'}`}
                      className={`flex items-center gap-0.5 rounded-sm px-1 py-px text-[8px] font-medium leading-none ${
                        has
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-stone-500/10 text-stone-600'
                      }`}
                    >
                      {has ? <CheckCircle2 size={7} /> : <Minus size={7} />}
                      {ptLabel}
                    </span>
                  );
                })}
              </div>

              {/* Status */}
              <span className="flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
                <span className={`text-[9px] uppercase tracking-wider ${statusStyle.text}`}>
                  {f.status.replace('_', ' ')}
                </span>
              </span>

              {/* Coverage ratio */}
              <span className="w-8 text-right font-mono text-[10px] text-stone-500">
                {defined.length}/{total}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  featureMap: Map<string, FeaturePathInfo[]>;
  filterFeatureId: string | null;
  searchQuery: string;
}

function TreeNodeRow({ node, depth, featureMap, filterFeatureId, searchQuery }: TreeNodeProps) {
  const [open, setOpen] = useState(depth < 1);
  const nodePath = normalizePath(node.path);
  const directFeatures = featureMap.get(nodePath) ?? [];
  const hasDescendantFeature = node.isDir && isAncestorOfFeaturePath(nodePath, featureMap);
  const isRelevant = directFeatures.length > 0 || hasDescendantFeature;

  // Filter logic
  if (filterFeatureId) {
    const matchesDirect = directFeatures.some((f) => f.featureId === filterFeatureId);
    const matchesDescendant =
      node.isDir &&
      [...featureMap.entries()].some(
        ([k, v]) => k.startsWith(nodePath + '/') && v.some((f) => f.featureId === filterFeatureId),
      );
    if (!matchesDirect && !matchesDescendant) return null;
  }

  // Search logic
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const nameMatch = node.name.toLowerCase().includes(q);
    const featureMatch = directFeatures.some(
      (f) => f.featureId.toLowerCase().includes(q) || f.featureName.toLowerCase().includes(q),
    );
    const hasMatchingChild =
      node.isDir &&
      node.children.some(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (featureMap.get(normalizePath(c.path)) ?? []).some(
            (f) => f.featureId.toLowerCase().includes(q) || f.featureName.toLowerCase().includes(q),
          ),
      );
    if (!nameMatch && !featureMatch && !hasMatchingChild && !node.isDir) return null;
  }

  // Auto-expand if filter/search is active and this dir is relevant
  const shouldAutoExpand =
    (filterFeatureId || searchQuery) && node.isDir && (isRelevant || true);

  const isOpen = shouldAutoExpand ? true : open;

  if (!node.isDir) {
    return (
      <div
        title={node.path}
        className={`group flex items-center gap-1.5 py-[3px] pr-2 transition-colors hover:bg-white/[0.03] ${
          directFeatures.length > 0 ? '' : 'opacity-70'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <FileIcon name={node.name} />
        <span className="min-w-0 flex-1 truncate text-[12px] text-stone-300 group-hover:text-stone-100">
          {node.name}
        </span>
        {directFeatures.map((info, i) => (
          <FeatureBadge key={`${info.featureId}-${info.pathType}-${i}`} info={info} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        title={node.path}
        onClick={() => setOpen((v) => !v)}
        className={`group flex w-full items-center gap-1.5 py-[3px] pr-2 text-left transition-colors hover:bg-white/[0.03] ${
          isRelevant ? 'text-stone-200' : 'text-stone-400'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {isOpen ? (
          <ChevronDown size={12} className="shrink-0 text-stone-500" />
        ) : (
          <ChevronRight size={12} className="shrink-0 text-stone-500" />
        )}
        {isOpen ? (
          <FolderOpen size={12} className="shrink-0 text-amber-300/70" />
        ) : (
          <Folder size={12} className="shrink-0 text-amber-300/50" />
        )}
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{node.name}</span>
        {directFeatures.map((info, i) => (
          <FeatureBadge key={`${info.featureId}-${info.pathType}-${i}`} info={info} />
        ))}
        {!isOpen && node.children.length > 0 && !directFeatures.length && (
          <span className="text-[10px] text-stone-600">({node.children.length})</span>
        )}
      </button>
      {isOpen && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              featureMap={featureMap}
              filterFeatureId={filterFeatureId}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Per-project panel ─────────────────────────────────────────────────────────

function ProjectPanel({ project }: { project: ProjectEntry }) {
  const [realNodes, setRealNodes] = useState<FileNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isTauri, setIsTauri] = useState(false);
  const [filterFeatureId, setFilterFeatureId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const isGitHub = project.configPath.startsWith('https://github.com/');
  const root = project.config.project.root;
  const features = project.config.features;

  useEffect(() => {
    setIsTauri(typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
  }, []);

  const load = useCallback(async () => {
    if (isGitHub) return;
    setLoading(true);
    setError('');
    try {
      const { listProjectFiles } = await import('../../../lib/bridge');
      const result = await listProjectFiles(root, 4);
      setRealNodes(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [isGitHub, root]);

  useEffect(() => {
    if (isTauri) load();
  }, [isTauri, load]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!isTauri || isGitHub) return;
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [isTauri, isGitHub, load]);

  const featureMap = useMemo(() => buildFeaturePathMap(features, root), [features, root]);

  // In browser mode, build virtual tree from feature paths
  const virtualNodes = useMemo(() => {
    if (isTauri) return null;
    return buildVirtualTree(features, root);
  }, [isTauri, features, root]);

  const treeNodes = isTauri ? realNodes : virtualNodes;
  const isBrowserMode = !isTauri && !isGitHub;

  return (
    <div className="space-y-4">
      {/* Coverage Cards */}
      <CoverageSection features={features} projectRoot={root} />

      {/* File Tree Panel */}
      <section className="border border-stone-200/15 bg-[rgb(var(--pm-panel))]/72">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-200/12 px-4 py-2.5">
          <FolderOpen size={14} className="shrink-0 text-amber-200/70" />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-stone-100">
              {project.config.project.name}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-stone-400">{root}</p>
          </div>

          {/* Feature Filter */}
          <div className="relative">
            <Filter size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-500" />
            <select
              value={filterFeatureId ?? ''}
              onChange={(e) => setFilterFeatureId(e.target.value || null)}
              className="appearance-none border border-stone-200/15 bg-[rgb(var(--pm-input))] py-1 pl-6 pr-6 text-[10px] text-stone-300 outline-none focus:ring-1 focus:ring-emerald-300/35"
            >
              <option value="">All Features</option>
              {features.map((f) => (
                <option key={f.id} value={f.id}>
                  [{f.id}] {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search…"
              className="w-32 border border-stone-200/15 bg-[rgb(var(--pm-input))] py-1 pl-6 pr-2 text-[10px] text-stone-300 outline-none placeholder:text-stone-600 focus:ring-1 focus:ring-emerald-300/35"
            />
          </div>

          {/* Refresh (Tauri only) */}
          {!isGitHub && isTauri && (
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1 border border-stone-200/15 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-stone-400 hover:border-stone-200/30 hover:text-stone-200 disabled:opacity-40"
            >
              <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          )}
        </div>

        {/* Mode indicator */}
        {isBrowserMode && (
          <div className="border-b border-stone-200/8 bg-amber-500/[0.06] px-4 py-1.5">
            <p className="flex items-center gap-1.5 text-[10px] text-amber-200/70">
              <HelpCircle size={10} />
              Browser mode — showing files defined in feature paths. Run the desktop app for full
              file tree.
            </p>
          </div>
        )}

        {isGitHub && (
          <div className="border-b border-stone-200/8 bg-stone-500/[0.06] px-4 py-1.5">
            <p className="flex items-center gap-1.5 text-[10px] text-stone-400">
              <HelpCircle size={10} />
              GitHub-sourced project — showing files from feature path definitions.
            </p>
          </div>
        )}

        {/* Tree Body */}
        <div className="p-1">
          {isTauri && loading && (
            <p className="px-3 py-4 text-[11px] text-stone-500">Loading…</p>
          )}
          {isTauri && error && <p className="px-3 py-4 text-[11px] text-red-400">{error}</p>}
          {treeNodes && treeNodes.length === 0 && (
            <p className="px-3 py-4 text-[11px] text-stone-500">
              {features.length === 0
                ? 'No features defined — add features with file paths to see the tree.'
                : 'No matching files found.'}
            </p>
          )}
          {treeNodes && treeNodes.length > 0 && (
            <div className="max-h-[520px] overflow-y-auto py-1">
              {treeNodes.map((node) => (
                <TreeNodeRow
                  key={node.path}
                  node={node}
                  depth={0}
                  featureMap={featureMap}
                  filterFeatureId={filterFeatureId}
                  searchQuery={searchQuery}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

interface ProjectFilesViewProps {
  projects: ProjectEntry[];
  selectedDashboardProjectIds: string[];
}

export function ProjectFilesView({ projects, selectedDashboardProjectIds }: ProjectFilesViewProps) {
  const selected = projects.filter((p) => selectedDashboardProjectIds.includes(p.id));
  const displayed = selected.length > 0 ? selected : projects.slice(0, 1);

  // Aggregate stats
  const totalFeatures = displayed.reduce((sum, p) => sum + p.config.features.length, 0);
  const totalPaths = displayed.reduce(
    (sum, p) =>
      sum +
      p.config.features.reduce(
        (s, f) => s + Object.values(f.paths).filter(Boolean).length,
        0,
      ),
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">
          Project Files
        </h1>
        <p className="mt-1 text-xs text-stone-400">
          Feature-aware file navigator.{' '}
          <span className="text-stone-500">
            {totalFeatures} feature{totalFeatures !== 1 ? 's' : ''} · {totalPaths} mapped path
            {totalPaths !== 1 ? 's' : ''} · {displayed.length} project
            {displayed.length !== 1 ? 's' : ''}
          </span>
        </p>
      </div>

      {displayed.map((project) => (
        <ProjectPanel key={project.id} project={project} />
      ))}
    </div>
  );
}
