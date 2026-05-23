'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ExternalLink,
  File,
  FileCode2,
  FileJson,
  FileText,
  Filter,
  Folder,
  FolderKanban,
  HelpCircle,
  RefreshCw,
  Search,
  Table2,
} from 'lucide-react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { clsx } from 'clsx';
import { FileNode } from '../../../lib/bridge';
import { Feature, FeaturePaths, FeatureStatus, ProjectEntry } from '../../../lib/types';

const PATH_TYPE_LABELS: Record<string, string> = {
  featureFolder: 'Feature Folder',
  spec: 'feature-spec.md',
  tdd: 'tdd-spec.md',
  tddProgressReport: 'tdd-report.md',
  tddProgressReportHtml: 'tdd-report.html',
  unitIntegrationTest: 'Unit/Integration',
  e2eAcceptanceTestScriptFolder: 'E2E',
  developmentLogSummaryFolder: 'dev-log.md',
  devLogSummaryHtml: 'dev-log.html',
  test: 'Test',
  implementation: 'Implementation',
};

const STATUS_LABELS: Record<FeatureStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
  on_hold: 'Blocked',
};

const FEATURE_STATUS_STYLES: Record<FeatureStatus, string> = {
  done: 'bg-emerald-500/15 text-emerald-400',
  in_progress: 'bg-sky-500/15 text-sky-400',
  todo: 'bg-stone-500/15 text-stone-400',
  on_hold: 'bg-red-500/15 text-red-400',
};

type FileRowKind = 'folder' | 'file';
type FileRowMappingStatus = 'mapped' | 'contains' | 'unmapped';
type FileRowSource = 'filesystem' | 'feature-paths';

interface FeaturePathInfo {
  featureId: string;
  featureName: string;
  featureStatus: FeatureStatus;
  pathType: string;
  absPath: string;
}

interface ProjectFileRow {
  rowKey: string;
  name: string;
  relativePath: string;
  absPath: string;
  kind: FileRowKind;
  extension: string;
  depth: number;
  source: FileRowSource;
  featureRefs: FeaturePathInfo[];
  descendantFeatureRefs: FeaturePathInfo[];
  featureCount: number;
  artifactLabels: string[];
  mappingStatus: FileRowMappingStatus;
}

interface ProjectFilesViewProps {
  projects: ProjectEntry[];
  selectedDashboardProjectIds: string[];
  selectedProjectId?: string;
}

const columnHelper = createColumnHelper<ProjectFileRow>();

function normalizePath(path: string): string {
  return path.replace(/\/+$/, '').replace(/^\/+/, '');
}

function normalizeRoot(root: string): string {
  return root.replace(/\/+$/, '');
}

function uniqueFeatureRefs(refs: FeaturePathInfo[]): FeaturePathInfo[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.featureId}:${ref.pathType}:${ref.absPath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildFeaturePathMap(
  features: Feature[],
  projectRoot: string,
): Map<string, FeaturePathInfo[]> {
  const map = new Map<string, FeaturePathInfo[]>();
  const root = normalizeRoot(projectRoot);

  for (const feature of features) {
    const entries = Object.entries(feature.paths) as [keyof FeaturePaths, string | undefined][];
    for (const [pathType, relPath] of entries) {
      if (!relPath?.trim()) continue;
      const absPath = `${root}/${normalizePath(relPath)}`;
      const refs = map.get(absPath) ?? [];
      refs.push({
        featureId: feature.id,
        featureName: feature.name,
        featureStatus: feature.status,
        pathType: String(pathType),
        absPath,
      });
      map.set(absPath, refs);
    }
  }

  return map;
}

function buildVirtualTree(features: Feature[], projectRoot: string): FileNode[] {
  const root = normalizeRoot(projectRoot);
  const nodeMap = new Map<string, FileNode>();

  const ensureNode = (absPath: string, isDir: boolean): FileNode => {
    const existing = nodeMap.get(absPath);
    if (existing) {
      existing.isDir = existing.isDir || isDir;
      return existing;
    }
    const name = absPath.split('/').pop() ?? absPath;
    const node: FileNode = { name, path: absPath, isDir, children: [] };
    nodeMap.set(absPath, node);
    return node;
  };

  const ensureParentLink = (parentPath: string, child: FileNode) => {
    const parent = ensureNode(parentPath, true);
    if (!parent.children.some((item) => item.path === child.path)) {
      parent.children.push(child);
    }
  };

  for (const feature of features) {
    for (const relPath of Object.values(feature.paths)) {
      if (!relPath?.trim()) continue;

      const parts = normalizePath(relPath).split('/').filter(Boolean);
      let current = root;
      parts.forEach((part, index) => {
        const parentPath = current;
        current = `${current}/${part}`;
        const isLast = index === parts.length - 1;
        const isDir = isLast ? !part.includes('.') : true;
        const node = ensureNode(current, isDir);
        ensureParentLink(parentPath, node);
      });
    }
  }

  const topLevel = nodeMap.get(root)?.children ?? [];
  sortNodes(topLevel);
  return topLevel;
}

function sortNodes(nodes: FileNode[]) {
  nodes.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  nodes.forEach((node) => sortNodes(node.children));
}

function relativePathFor(absPath: string, projectRoot: string): string {
  const root = normalizeRoot(projectRoot);
  const normalized = normalizeRoot(absPath);
  return normalized.startsWith(`${root}/`) ? normalized.slice(root.length + 1) : normalized;
}

function extensionFor(name: string): string {
  if (!name.includes('.')) return '';
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function collectDescendantRefs(
  absPath: string,
  featureMap: Map<string, FeaturePathInfo[]>,
): FeaturePathInfo[] {
  const normalized = normalizeRoot(absPath);
  const refs: FeaturePathInfo[] = [];
  for (const [path, pathRefs] of featureMap) {
    if (path.startsWith(`${normalized}/`)) refs.push(...pathRefs);
  }
  return uniqueFeatureRefs(refs);
}

function flattenNodes(
  nodes: FileNode[],
  projectRoot: string,
  featureMap: Map<string, FeaturePathInfo[]>,
  source: FileRowSource,
  depth = 0,
): ProjectFileRow[] {
  return nodes.flatMap((node) => {
    const absPath = normalizeRoot(node.path);
    const featureRefs = uniqueFeatureRefs(featureMap.get(absPath) ?? []);
    const descendantFeatureRefs = node.isDir ? collectDescendantRefs(absPath, featureMap) : [];
    const visibleRefs = featureRefs.length > 0 ? featureRefs : descendantFeatureRefs;
    const featureIds = new Set(visibleRefs.map((ref) => ref.featureId));
    const artifactLabels = Array.from(
      new Set(featureRefs.map((ref) => PATH_TYPE_LABELS[ref.pathType] ?? ref.pathType)),
    );

    const row: ProjectFileRow = {
      rowKey: absPath,
      name: node.name,
      relativePath: relativePathFor(absPath, projectRoot),
      absPath,
      kind: node.isDir ? 'folder' : 'file',
      extension: node.isDir ? '' : extensionFor(node.name),
      depth,
      source,
      featureRefs,
      descendantFeatureRefs,
      featureCount: featureIds.size,
      artifactLabels,
      mappingStatus:
        featureRefs.length > 0 ? 'mapped' : descendantFeatureRefs.length > 0 ? 'contains' : 'unmapped',
    };

    return [row, ...flattenNodes(node.children, projectRoot, featureMap, source, depth + 1)];
  });
}

function FileTypeIcon({ row }: { row: ProjectFileRow }) {
  if (row.kind === 'folder') {
    return <Folder size={13} className="shrink-0 text-amber-200/75" />;
  }

  if (['ts', 'tsx', 'js', 'jsx', 'rs', 'py', 'go', 'rb', 'java', 'swift', 'vue'].includes(row.extension)) {
    return <FileCode2 size={13} className="shrink-0 text-sky-300/75" />;
  }
  if (['json', 'yaml', 'yml', 'toml'].includes(row.extension)) {
    return <FileJson size={13} className="shrink-0 text-amber-200/75" />;
  }
  if (['md', 'mdx', 'txt', 'rst'].includes(row.extension)) {
    return <FileText size={13} className="shrink-0 text-stone-300/80" />;
  }
  return <File size={13} className="shrink-0 text-stone-500" />;
}

function FeatureRefCell({ row }: { row: ProjectFileRow }) {
  const refs = row.featureRefs.length > 0 ? row.featureRefs : row.descendantFeatureRefs;
  if (refs.length === 0) return <span className="text-xs text-stone-500">—</span>;

  const visible = refs.slice(0, 3);
  const remaining = refs.length - visible.length;

  return (
    <div className="flex min-w-[12rem] flex-wrap items-center gap-1">
      {visible.map((ref) => (
        <span
          key={`${ref.featureId}-${ref.pathType}-${ref.absPath}`}
          title={`${ref.featureName} · ${PATH_TYPE_LABELS[ref.pathType] ?? ref.pathType}`}
          className={clsx(
            'inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-medium',
            row.featureRefs.length > 0
              ? 'border-amber-200/20 bg-amber-100/10 text-amber-100/90'
              : 'border-stone-200/15 bg-stone-200/8 text-stone-300',
          )}
        >
          <span className="font-mono">{ref.featureId}</span>
          <span className="text-stone-500">·</span>
          <span className={FEATURE_STATUS_STYLES[ref.featureStatus]}>
            {STATUS_LABELS[ref.featureStatus]}
          </span>
        </span>
      ))}
      {remaining > 0 && <span className="text-[10px] text-stone-500">+{remaining}</span>}
    </div>
  );
}

function MappingBadge({ status }: { status: FileRowMappingStatus }) {
  const styles: Record<FileRowMappingStatus, string> = {
    mapped: 'border-emerald-200/25 bg-emerald-100/10 text-emerald-100',
    contains: 'border-amber-200/20 bg-amber-100/10 text-amber-100/90',
    unmapped: 'border-stone-300/20 bg-stone-500/15 text-stone-400',
  };
  const labels: Record<FileRowMappingStatus, string> = {
    mapped: 'Mapped',
    contains: 'Contains',
    unmapped: 'Unmapped',
  };

  return (
    <span className={clsx('inline-flex border px-2 py-0.5 text-[10px] font-semibold', styles[status])}>
      {labels[status]}
    </span>
  );
}

function ArtifactLabels({ labels }: { labels: string[] }) {
  if (labels.length === 0) return <span className="text-xs text-stone-500">—</span>;

  return (
    <div className="flex min-w-[8rem] flex-wrap gap-1">
      {labels.slice(0, 2).map((label) => (
        <span
          key={label}
          className="border border-stone-200/15 bg-white/[0.035] px-1.5 py-0.5 font-mono text-[10px] text-stone-300"
        >
          {label}
        </span>
      ))}
      {labels.length > 2 && <span className="text-[10px] text-stone-500">+{labels.length - 2}</span>}
    </div>
  );
}

function SortIcon({ direction }: { direction: false | 'asc' | 'desc' }) {
  if (direction === 'asc') return <ArrowUp size={11} />;
  if (direction === 'desc') return <ArrowDown size={11} />;
  return <ArrowUpDown size={11} className="opacity-50" />;
}

function buildColumns(canOpenPaths: boolean, onOpenPath: (path: string) => void) {
  return [
    columnHelper.accessor('kind', {
      id: 'col-kind',
      header: 'Type',
      cell: (info) => (
        <span className="inline-flex items-center gap-2 text-xs text-stone-300">
          <FileTypeIcon row={info.row.original} />
          {info.getValue() === 'folder' ? 'Folder' : 'File'}
        </span>
      ),
      sortingFn: 'alphanumeric',
    }),
    columnHelper.accessor('name', {
      id: 'col-name',
      header: 'Name',
      cell: (info) => (
        <div
          className="flex min-w-[14rem] items-center gap-2"
          style={{ paddingLeft: `${Math.min(info.row.original.depth, 6) * 14}px` }}
        >
          <FileTypeIcon row={info.row.original} />
          <span className="truncate font-medium text-stone-100" title={info.row.original.absPath}>
            {info.getValue()}
          </span>
        </div>
      ),
    }),
    columnHelper.accessor('relativePath', {
      id: 'col-path',
      header: 'Path',
      cell: (info) => (
        <span
          className="block max-w-[340px] truncate font-mono text-xs text-stone-300"
          title={info.row.original.absPath}
        >
          {info.getValue() || '—'}
        </span>
      ),
    }),
    columnHelper.accessor('mappingStatus', {
      id: 'col-status',
      header: 'Status',
      cell: (info) => <MappingBadge status={info.getValue()} />,
    }),
    columnHelper.accessor('featureCount', {
      id: 'col-features',
      header: 'Features',
      cell: (info) => <FeatureRefCell row={info.row.original} />,
    }),
    columnHelper.accessor((row) => row.artifactLabels.join(', '), {
      id: 'col-artifacts',
      header: 'Artifact',
      cell: (info) => <ArtifactLabels labels={info.row.original.artifactLabels} />,
    }),
    columnHelper.accessor('source', {
      id: 'col-source',
      header: 'Source',
      cell: (info) => (
        <span className="whitespace-nowrap text-xs text-stone-400">
          {info.getValue() === 'filesystem' ? 'Filesystem' : 'Feature paths'}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'col-actions',
      header: '',
      cell: (info) => (
        <button
          type="button"
          disabled={!canOpenPaths}
          onClick={(event) => {
            event.stopPropagation();
            onOpenPath(info.row.original.absPath);
          }}
          title={canOpenPaths ? `Open ${info.row.original.absPath}` : 'Open requires desktop app'}
          className="inline-flex h-7 items-center gap-1.5 border border-emerald-200/25 bg-emerald-100/10 px-2.5 text-xs font-medium text-emerald-100 hover:bg-emerald-100/18 disabled:cursor-not-allowed disabled:border-stone-200/10 disabled:bg-stone-500/10 disabled:text-stone-500"
        >
          <ExternalLink size={12} />
          Open
        </button>
      ),
      enableSorting: false,
    }),
  ];
}

function FilesTable({
  rows,
  loading,
  error,
  canOpenPaths,
  onOpenPath,
}: {
  rows: ProjectFileRow[];
  loading: boolean;
  error: string;
  canOpenPaths: boolean;
  onOpenPath: (path: string) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'col-path', desc: false }]);
  const columns = useMemo(() => buildColumns(canOpenPaths, onOpenPath), [canOpenPaths, onOpenPath]);
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="min-h-0 flex-1 overflow-auto border border-stone-200/15 bg-[rgb(var(--pm-rail))]/70">
      <table className="w-full min-w-[980px] border-collapse text-left">
        <thead className="sticky top-0 z-20 border-b border-stone-200/12 bg-[rgb(var(--pm-card))]">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                return (
                  <th
                    key={header.id}
                    className="border-r border-stone-200/10 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-300 last:border-r-0"
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1.5 text-left hover:text-stone-100"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <SortIcon direction={header.column.getIsSorted()} />
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td
                colSpan={table.getVisibleLeafColumns().length}
                className="px-4 py-8 text-center text-xs text-stone-500"
              >
                Loading files…
              </td>
            </tr>
          )}
          {!loading && error && (
            <tr>
              <td
                colSpan={table.getVisibleLeafColumns().length}
                className="px-4 py-8 text-center text-xs text-red-300"
              >
                {error}
              </td>
            </tr>
          )}
          {!loading && !error && table.getRowModel().rows.length === 0 && (
            <tr>
              <td
                colSpan={table.getVisibleLeafColumns().length}
                className="px-4 py-8 text-center text-xs text-stone-500"
              >
                No files match the current filters.
              </td>
            </tr>
          )}
          {!loading &&
            !error &&
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-stone-200/10 transition-colors hover:bg-white/[0.045]"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="border-r border-stone-200/8 px-3 py-2 text-sm text-stone-300 last:border-r-0">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectSheetTabs({
  projects,
  activeProjectId,
  onSelectProject,
}: {
  projects: ProjectEntry[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
}) {
  return (
    <div className="flex flex-none items-end overflow-x-auto border-t border-stone-200/15 bg-[rgb(var(--pm-rail))]/70">
      {projects.map((project) => {
        const active = project.id === activeProjectId;
        return (
          <button
            key={project.id}
            type="button"
            onClick={() => onSelectProject(project.id)}
            className={clsx(
              'relative flex items-center gap-2 whitespace-nowrap border-r border-stone-200/15 px-4 py-2.5 text-sm font-medium transition-colors last:border-r-0',
              active
                ? 'bg-emerald-600/85 text-white shadow-sm'
                : 'text-stone-300/85 hover:bg-white/5 hover:text-stone-100',
            )}
          >
            <FolderKanban size={14} className={active ? 'text-current' : 'text-amber-100'} />
            <span>{project.config.project.name}</span>
            <span
              className={clsx(
                'ml-1 px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                active ? 'bg-white/25 text-white' : 'bg-stone-200/15 text-stone-100',
              )}
            >
              {project.config.features.length}
            </span>
            {active && <span className="absolute left-0 right-0 top-0 h-0.5 bg-white/60" />}
          </button>
        );
      })}
      <div className="min-w-[20px] flex-1" />
    </div>
  );
}

function ProjectFileSheet({ project }: { project: ProjectEntry }) {
  const [realNodes, setRealNodes] = useState<FileNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isTauri, setIsTauri] = useState(false);
  const [filterFeatureId, setFilterFeatureId] = useState('');
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
    if (isTauri) void load();
  }, [isTauri, load]);

  useEffect(() => {
    if (!isTauri || isGitHub) return;
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [isTauri, isGitHub, load]);

  const featureMap = useMemo(() => buildFeaturePathMap(features, root), [features, root]);
  const virtualNodes = useMemo(() => buildVirtualTree(features, root), [features, root]);
  const baseNodes = isTauri && !isGitHub ? realNodes : virtualNodes;
  const source: FileRowSource = isTauri && !isGitHub ? 'filesystem' : 'feature-paths';

  const rows = useMemo(() => {
    if (!baseNodes) return [];
    const allRows = flattenNodes(baseNodes, root, featureMap, source);
    const query = searchQuery.trim().toLowerCase();

    return allRows.filter((row) => {
      if (filterFeatureId) {
        const refs = [...row.featureRefs, ...row.descendantFeatureRefs];
        if (!refs.some((ref) => ref.featureId === filterFeatureId)) return false;
      }
      if (!query) return true;
      return (
        row.name.toLowerCase().includes(query) ||
        row.relativePath.toLowerCase().includes(query) ||
        row.featureRefs.some(
          (ref) =>
            ref.featureId.toLowerCase().includes(query) ||
            ref.featureName.toLowerCase().includes(query),
        ) ||
        row.descendantFeatureRefs.some(
          (ref) =>
            ref.featureId.toLowerCase().includes(query) ||
            ref.featureName.toLowerCase().includes(query),
        )
      );
    });
  }, [baseNodes, featureMap, filterFeatureId, root, searchQuery, source]);

  const mappedPathCount = useMemo(
    () => features.reduce((sum, feature) => sum + Object.values(feature.paths).filter(Boolean).length, 0),
    [features],
  );

  const openPath = useCallback((path: string) => {
    if (!isTauri || isGitHub) return;
    import('../../../lib/bridge')
      .then(({ openPath: openProjectPath }) => openProjectPath(path))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [isGitHub, isTauri]);

  const modeMessage = isGitHub
    ? 'GitHub-sourced project · feature path sheet'
    : isTauri
      ? 'Desktop filesystem sheet'
      : 'Browser mode · feature path sheet';

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none flex-wrap items-center gap-3 border-b border-stone-200/12 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold uppercase tracking-[0.14em] text-stone-100">
            {project.config.project.name}
          </p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-stone-500">{root}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 border border-stone-200/15 bg-white/[0.035] px-2 py-1 text-[10px] text-stone-400">
          <HelpCircle size={10} />
          {modeMessage}
        </span>
        <span className="text-[10px] text-stone-500">
          {features.length} features · {mappedPathCount} mapped paths · {rows.length} rows
        </span>
      </div>

      <div className="flex flex-none flex-wrap items-center gap-2 border-b border-stone-200/10 px-4 py-2.5">
        <div className="relative">
          <Filter size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-500" />
          <select
            value={filterFeatureId}
            onChange={(event) => setFilterFeatureId(event.target.value)}
            className="h-8 min-w-[220px] appearance-none border border-stone-200/15 bg-[rgb(var(--pm-input))] py-1 pl-7 pr-7 text-xs text-stone-300 outline-none focus:ring-1 focus:ring-emerald-300/35"
          >
            <option value="">All features</option>
            {features.map((feature) => (
              <option key={feature.id} value={feature.id}>
                [{feature.id}] {feature.name}
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-500" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search files"
            className="h-8 w-56 border border-stone-200/15 bg-[rgb(var(--pm-input))] py-1 pl-7 pr-2 text-xs text-stone-300 outline-none placeholder:text-stone-600 focus:ring-1 focus:ring-emerald-300/35"
          />
        </div>

        {!isGitHub && isTauri && (
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="ml-auto inline-flex h-8 items-center gap-1.5 border border-stone-200/15 px-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400 hover:border-stone-200/30 hover:text-stone-200 disabled:opacity-40"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        )}
      </div>

      <FilesTable
        rows={rows}
        loading={loading && rows.length === 0}
        error={error}
        canOpenPaths={isTauri && !isGitHub}
        onOpenPath={openPath}
      />
    </section>
  );
}

export function ProjectFilesView({
  projects,
  selectedDashboardProjectIds,
  selectedProjectId,
}: ProjectFilesViewProps) {
  const displayedProjects = useMemo(() => {
    const selected = projects.filter((project) => selectedDashboardProjectIds.includes(project.id));
    if (selected.length > 0) return selected;

    const fallback = projects.find((project) => project.id === selectedProjectId) ?? projects[0];
    return fallback ? [fallback] : [];
  }, [projects, selectedDashboardProjectIds, selectedProjectId]);

  const [activeProjectId, setActiveProjectId] = useState(displayedProjects[0]?.id ?? '');

  useEffect(() => {
    if (displayedProjects.length === 0) {
      setActiveProjectId('');
      return;
    }
    if (!displayedProjects.some((project) => project.id === activeProjectId)) {
      setActiveProjectId(displayedProjects[0].id);
    }
  }, [activeProjectId, displayedProjects]);

  const activeProject =
    displayedProjects.find((project) => project.id === activeProjectId) ?? displayedProjects[0];
  const totalFeatures = displayedProjects.reduce((sum, project) => sum + project.config.features.length, 0);
  const totalPaths = displayedProjects.reduce(
    (sum, project) =>
      sum +
      project.config.features.reduce(
        (featureSum, feature) => featureSum + Object.values(feature.paths).filter(Boolean).length,
        0,
      ),
    0,
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[560px] flex-col overflow-hidden">
      <div className="flex flex-none flex-wrap items-start gap-3 pb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Table2 size={17} className="text-emerald-200/80" />
            <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">
              Project Files
            </h1>
          </div>
          <p className="mt-1 text-xs text-stone-400">
            Dashboard project scope · {displayedProjects.length} sheet
            {displayedProjects.length !== 1 ? 's' : ''} · {totalFeatures} features · {totalPaths} mapped paths
          </p>
        </div>
      </div>

      {displayedProjects.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center border border-stone-200/15 bg-[rgb(var(--pm-panel))]/72 px-4 py-10 text-center text-xs text-stone-500">
          No projects loaded.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-stone-200/15 bg-[rgb(var(--pm-panel))]/72">
          <ProjectSheetTabs
            projects={displayedProjects}
            activeProjectId={activeProject?.id ?? ''}
            onSelectProject={setActiveProjectId}
          />
          {activeProject && <ProjectFileSheet key={activeProject.id} project={activeProject} />}
        </div>
      )}
    </div>
  );
}
