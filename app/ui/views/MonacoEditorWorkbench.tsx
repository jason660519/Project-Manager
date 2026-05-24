'use client';

import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import {
  Code2,
  FileCode2,
  FileText,
  FolderKanban,
  Search,
  X,
} from 'lucide-react';
import { CodeEditor, type CodeEditorFile } from '../../../components/CodeEditor';
import { WorkstationFrame } from '../../../components/layout/WorkstationFrame';
import { BottomSheetTabs, type SheetTabItem } from '../../../components/sheets/BottomSheetTabs';
import type { Feature, FeaturePaths, FeatureStatus, ProjectEntry } from '../../../lib/types';

const PATH_TYPE_LABELS: Partial<Record<keyof FeaturePaths | 'readmePath', string>> = {
  readmePath: 'README.md',
  spec: 'feature-spec.md',
  tdd: 'tdd-spec.md',
  tddProgressReport: 'tdd-report.md',
  unitIntegrationTest: 'Unit/Integration Test',
  e2eAcceptanceTestScriptFolder: 'E2E Test',
  developmentLogSummaryFolder: 'dev-log.md',
  test: 'Test',
  implementation: 'Implementation',
};

const STATUS_LABELS: Record<FeatureStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
  on_hold: 'Blocked',
};

const STATUS_STYLES: Record<FeatureStatus, string> = {
  done: 'bg-emerald-500/15 text-emerald-300',
  in_progress: 'bg-sky-500/15 text-sky-300',
  todo: 'bg-stone-500/15 text-stone-300',
  on_hold: 'bg-red-500/15 text-red-300',
};

const EXT_LANG_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  json: 'json',
  jsonc: 'jsonc',
  md: 'markdown',
  mdx: 'markdown',
  css: 'css',
  scss: 'scss',
  html: 'html',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  rs: 'rust',
  py: 'python',
  sh: 'shell',
  zsh: 'shell',
  sql: 'sql',
};

export interface MonacoWorkbenchFile {
  key: string;
  absPath: string;
  relativePath: string;
  label: string;
  language: string;
  featureId: string;
  featureName: string;
  featureStatus: FeatureStatus;
  pathType: keyof FeaturePaths | 'readmePath';
}

export interface MonacoEditorWorkbenchProps {
  projects: ProjectEntry[];
  selectedDashboardProjectIds: string[];
  selectedProjectId?: string;
}

export function normalizeWorkbenchPath(path: string): string {
  return path.replace(/\/+$/, '').replace(/^\/+/, '');
}

function normalizeRoot(root: string): string {
  return root.replace(/\/+$/, '');
}

function basename(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path;
}

function hasFileExtension(path: string): boolean {
  return /\.[A-Za-z0-9]+$/.test(basename(path));
}

function pathForFeatureEntry(
  pathType: keyof FeaturePaths | 'readmePath',
  rawPath: string | undefined,
): string | null {
  if (!rawPath?.trim()) return null;
  const normalized = normalizeWorkbenchPath(rawPath);
  if (pathType === 'featureFolder') return null;
  if (pathType === 'developmentLogSummaryFolder') {
    return hasFileExtension(normalized) ? normalized : `${normalized}/dev-log.md`;
  }
  if (pathType === 'e2eAcceptanceTestScriptFolder') return null;
  if (pathType === 'devLogSummaryHtml' || pathType === 'tddProgressReportHtml') return null;
  return hasFileExtension(normalized) ? normalized : null;
}

export function detectMonacoWorkbenchLanguage(filePath: string): string {
  const fileName = basename(filePath).toLowerCase();
  if (fileName === 'dockerfile') return 'dockerfile';
  const ext = fileName.includes('.') ? fileName.split('.').pop() ?? '' : '';
  return EXT_LANG_MAP[ext] ?? 'plaintext';
}

function labelForPath(pathType: keyof FeaturePaths | 'readmePath', relativePath: string): string {
  const fixed = PATH_TYPE_LABELS[pathType];
  if (fixed) return fixed;
  return basename(relativePath);
}

export function buildMonacoWorkbenchFiles(project: ProjectEntry): MonacoWorkbenchFile[] {
  const root = normalizeRoot(project.config.project.root);
  const files = new Map<string, MonacoWorkbenchFile>();

  for (const feature of project.config.features) {
    const entries: Array<[keyof FeaturePaths | 'readmePath', string | undefined]> = [
      ['readmePath', feature.readmePath],
      ...(Object.entries(feature.paths ?? {}) as Array<[keyof FeaturePaths, string | undefined]>),
    ];

    for (const [pathType, rawPath] of entries) {
      const relativePath = pathForFeatureEntry(pathType, rawPath);
      if (!relativePath) continue;
      const absPath = `${root}/${relativePath}`;
      if (files.has(absPath)) continue;
      files.set(absPath, {
        key: `${feature.id}:${pathType}:${absPath}`,
        absPath,
        relativePath,
        label: labelForPath(pathType, relativePath),
        language: detectMonacoWorkbenchLanguage(relativePath),
        featureId: feature.id,
        featureName: feature.name,
        featureStatus: feature.status,
        pathType,
      });
    }
  }

  return Array.from(files.values()).sort((a, b) => {
    if (a.featureId !== b.featureId) return a.featureId.localeCompare(b.featureId);
    return a.relativePath.localeCompare(b.relativePath);
  });
}

function displayedProjectsFor(
  projects: ProjectEntry[],
  selectedDashboardProjectIds: string[],
  selectedProjectId?: string,
): ProjectEntry[] {
  const selected = projects.filter((project) => selectedDashboardProjectIds.includes(project.id));
  if (selected.length > 0) return selected;
  const fallback = projects.find((project) => project.id === selectedProjectId) ?? projects[0];
  return fallback ? [fallback] : [];
}

function editorFileFrom(row: MonacoWorkbenchFile): CodeEditorFile {
  return {
    path: row.absPath,
    label: `${row.featureId} ${row.label}`,
    language: row.language,
  };
}

function featureOptionLabel(feature: Feature): string {
  return `${feature.id} · ${feature.name}`;
}

export function MonacoEditorWorkbench({
  projects,
  selectedDashboardProjectIds,
  selectedProjectId,
}: MonacoEditorWorkbenchProps) {
  const displayedProjects = useMemo(
    () => displayedProjectsFor(projects, selectedDashboardProjectIds, selectedProjectId),
    [projects, selectedDashboardProjectIds, selectedProjectId],
  );
  const [activeProjectId, setActiveProjectId] = useState(displayedProjects[0]?.id ?? '');
  const [featureFilter, setFeatureFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [openFiles, setOpenFiles] = useState<CodeEditorFile[]>([]);

  useEffect(() => {
    if (displayedProjects.length === 0) {
      setActiveProjectId('');
      setOpenFiles([]);
      return;
    }
    if (!displayedProjects.some((project) => project.id === activeProjectId)) {
      setActiveProjectId(displayedProjects[0].id);
      setFeatureFilter('all');
      setOpenFiles([]);
    }
  }, [activeProjectId, displayedProjects]);

  const activeProject =
    displayedProjects.find((project) => project.id === activeProjectId) ?? displayedProjects[0];
  const files = useMemo(
    () => (activeProject ? buildMonacoWorkbenchFiles(activeProject) : []),
    [activeProject],
  );

  const visibleFiles = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    return files.filter((file) => {
      const featureMatches = featureFilter === 'all' || file.featureId === featureFilter;
      const queryMatches =
        !lowerQuery ||
        file.relativePath.toLowerCase().includes(lowerQuery) ||
        file.featureName.toLowerCase().includes(lowerQuery) ||
        file.featureId.toLowerCase().includes(lowerQuery);
      return featureMatches && queryMatches;
    });
  }, [featureFilter, files, query]);

  const activeFilePath = openFiles[0]?.path ?? '';
  const totalFeatures = displayedProjects.reduce((sum, project) => sum + project.config.features.length, 0);
  const totalFiles = displayedProjects.reduce(
    (sum, project) => sum + buildMonacoWorkbenchFiles(project).length,
    0,
  );

  const sheetTabs: SheetTabItem<string>[] = displayedProjects.map((project) => ({
    key: project.id,
    label: project.config.project.name,
    icon: <FolderKanban size={14} />,
    badge: project.config.features.length,
  }));

  const openFile = (file: MonacoWorkbenchFile) => {
    const nextFile = editorFileFrom(file);
    setOpenFiles((current) => [
      nextFile,
      ...current.filter((item) => item.path !== nextFile.path),
    ]);
  };

  return (
    <WorkstationFrame
      header={
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Code2 size={17} className="text-sky-200/90" />
              <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">
                Monaco Editor
              </h1>
            </div>
            <p className="mt-1 text-xs text-stone-400">
              Project-scoped frontend plugin · {displayedProjects.length} project
              {displayedProjects.length !== 1 ? 's' : ''} · {totalFeatures} features · {totalFiles} editable files
            </p>
          </div>
        </div>
      }
      panelClassName="border border-stone-200/15 bg-[rgb(var(--pm-panel))]/72"
      scrollChildren={false}
      bottomTabs={
        displayedProjects.length > 0 ? (
          <BottomSheetTabs
            tabs={sheetTabs}
            activeKey={activeProject?.id ?? ''}
            onSelect={(projectId) => {
              setActiveProjectId(projectId);
              setFeatureFilter('all');
              setQuery('');
              setOpenFiles([]);
            }}
          />
        ) : undefined
      }
    >
      {displayedProjects.length === 0 ? (
        <div className="flex h-full items-center justify-center px-4 py-10 text-center text-xs text-stone-500">
          No projects loaded.
        </div>
      ) : (
        <div className="grid h-full min-h-0 grid-cols-[minmax(260px,360px)_minmax(0,1fr)] overflow-hidden max-lg:grid-cols-1">
          <aside className="flex min-h-0 flex-col border-r border-stone-200/15 bg-black/10 max-lg:h-[36vh] max-lg:border-b max-lg:border-r-0">
            <div className="space-y-2 border-b border-stone-200/15 p-3">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search files or features"
                  className="h-9 w-full border border-stone-200/15 bg-[rgb(var(--pm-input))] pl-9 pr-3 text-sm text-stone-100 outline-none placeholder:text-stone-500 focus:ring-1 focus:ring-sky-300/35"
                />
              </div>
              <select
                aria-label="Feature filter"
                value={featureFilter}
                onChange={(event) => setFeatureFilter(event.target.value)}
                className="h-9 w-full border border-stone-200/15 bg-[rgb(var(--pm-input))] px-3 text-sm text-stone-100 outline-none focus:ring-1 focus:ring-sky-300/35"
              >
                <option value="all">All features</option>
                {activeProject?.config.features.map((feature) => (
                  <option key={feature.id} value={feature.id}>
                    {featureOptionLabel(feature)}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {visibleFiles.length === 0 ? (
                <div className="px-4 py-8 text-sm text-stone-500">
                  No editable mapped files in this scope.
                </div>
              ) : (
                <div role="list" aria-label="Monaco workbench files" className="divide-y divide-stone-200/10">
                  {visibleFiles.map((file) => {
                    const active = file.absPath === activeFilePath;
                    return (
                      <button
                        key={file.key}
                        type="button"
                        onClick={() => openFile(file)}
                        className={clsx(
                          'flex w-full items-start gap-3 px-3 py-3 text-left transition-colors',
                          active ? 'bg-sky-500/12' : 'hover:bg-white/[0.04]',
                        )}
                      >
                        <span className={clsx('mt-0.5 text-stone-400', active && 'text-sky-200')}>
                          {file.language === 'markdown' ? <FileText size={15} /> : <FileCode2 size={15} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-stone-100">{file.relativePath}</span>
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="rounded bg-stone-200/10 px-1.5 py-0.5 text-[10px] font-semibold text-stone-300">
                              {file.featureId}
                            </span>
                            <span className={clsx('rounded px-1.5 py-0.5 text-[10px] font-semibold', STATUS_STYLES[file.featureStatus])}>
                              {STATUS_LABELS[file.featureStatus]}
                            </span>
                            <span className="truncate text-[11px] text-stone-500">{file.label}</span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col bg-[#0d1117]">
            {openFiles.length === 0 ? (
              <div className="flex h-full items-center justify-center px-8 text-center">
                <div className="max-w-sm">
                  <Code2 size={36} className="mx-auto text-sky-200/70" />
                  <h2 className="mt-4 text-base font-semibold text-stone-100">Select a file to start editing.</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-500">
                    Feature specs, TDD specs, dev logs, implementation files, and tests open here as Monaco tabs.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex items-center gap-2 border-b border-stone-200/10 bg-black/15 px-3 py-2 text-xs text-stone-400">
                  <span>{openFiles.length} open</span>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => setOpenFiles([])}
                    className="flex items-center gap-1 rounded px-2 py-1 text-stone-400 hover:bg-white/5 hover:text-stone-100"
                  >
                    <X size={12} />
                    Close all
                  </button>
                </div>
                <div className="min-h-0 flex-1">
                  <CodeEditor
                    key={openFiles.map((file) => file.path).join('|')}
                    files={openFiles}
                    preferredEditor="code"
                    onTabClose={(path) => {
                      setOpenFiles((current) => current.filter((file) => file.path !== path));
                    }}
                  />
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </WorkstationFrame>
  );
}
