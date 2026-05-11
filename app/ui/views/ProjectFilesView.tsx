'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, File, Folder, FolderOpen, RefreshCw } from 'lucide-react';
import { FileNode } from '../../../lib/bridge';
import { ProjectEntry } from '../../../lib/types';

// ── File tree node ────────────────────────────────────────────────────────────

interface TreeNodeProps {
  node: FileNode;
  depth: number;
}

function TreeNode({ node, depth }: TreeNodeProps) {
  const [open, setOpen] = useState(depth < 1);

  if (!node.isDir) {
    return (
      <div
        className="flex items-center gap-1.5 py-0.5 text-[12px] text-stone-400 hover:text-stone-200"
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
      >
        <File size={12} className="shrink-0 text-stone-500" />
        <span className="truncate">{node.name}</span>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 py-0.5 text-left text-[12px] text-stone-300 hover:text-stone-100"
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
      >
        {open ? (
          <ChevronDown size={12} className="shrink-0 text-stone-500" />
        ) : (
          <ChevronRight size={12} className="shrink-0 text-stone-500" />
        )}
        {open ? (
          <FolderOpen size={12} className="shrink-0 text-amber-300/70" />
        ) : (
          <Folder size={12} className="shrink-0 text-amber-300/50" />
        )}
        <span className="truncate font-medium">{node.name}</span>
        {!open && node.children.length > 0 && (
          <span className="ml-1 text-[10px] text-stone-500">({node.children.length})</span>
        )}
      </button>
      {open && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Per-project panel ─────────────────────────────────────────────────────────

interface ProjectPanelProps {
  project: ProjectEntry;
}

function ProjectPanel({ project }: ProjectPanelProps) {
  const [nodes, setNodes] = useState<FileNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isGitHub = project.configPath.startsWith('https://github.com/');
  const root = project.config.project.root;

  const load = useCallback(async () => {
    if (isGitHub) return;
    setLoading(true);
    setError('');
    try {
      const { listProjectFiles } = await import('../../../lib/bridge');
      const result = await listProjectFiles(root, 4);
      setNodes(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [isGitHub, root]);

  useEffect(() => {
    load();
  }, [load]);

  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  return (
    <section className="border border-stone-200/15 bg-[#071d1a]/72">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-stone-200/12 px-4 py-3">
        <FolderOpen size={14} className="shrink-0 text-amber-200/70" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-stone-100">
            {project.config.project.name}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-stone-400">{root}</p>
        </div>
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

      {/* Body */}
      <div className="p-2">
        {isGitHub && (
          <p className="px-2 py-3 text-[11px] text-stone-500">
            GitHub-sourced project — local file tree not available.
          </p>
        )}
        {!isGitHub && !isTauri && (
          <p className="px-2 py-3 text-[11px] text-stone-500">
            File tree requires Tauri runtime. Run the desktop app to browse project files.
          </p>
        )}
        {!isGitHub && isTauri && loading && (
          <p className="px-2 py-3 text-[11px] text-stone-500">Loading…</p>
        )}
        {!isGitHub && isTauri && error && (
          <p className="px-2 py-3 text-[11px] text-red-400">{error}</p>
        )}
        {!isGitHub && isTauri && nodes && nodes.length === 0 && (
          <p className="px-2 py-3 text-[11px] text-stone-500">No files found.</p>
        )}
        {!isGitHub && isTauri && nodes && nodes.length > 0 && (
          <div className="max-h-[420px] overflow-y-auto py-1">
            {nodes.map((node) => (
              <TreeNode key={node.path} node={node} depth={0} />
            ))}
          </div>
        )}
      </div>
    </section>
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

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">
          Project Files
        </h1>
        <p className="mt-1 text-xs text-stone-400">
          Files under the root directories of your selected projects.
          {displayed.length === 1 && selected.length === 0 && (
            <span className="ml-1 text-stone-500">
              (No projects selected on dashboard — showing first project.)
            </span>
          )}
        </p>
      </div>

      {displayed.map((project) => (
        <ProjectPanel key={project.id} project={project} />
      ))}
    </div>
  );
}
