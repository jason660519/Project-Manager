'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  ChevronDown,
  ChevronRight,
  File as FileIcon,
  Folder as FolderIcon,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';
import { listDirectoryEntries, type DirEntry } from '../../lib/bridge';
import { isTauriRuntime, waitForTauriRuntime } from '../../lib/runtime/tauri-ready';

type NodeState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; entries: DirEntry[] }
  | { status: 'error'; message: string };

interface FolderContentProps {
  itemId: string;
  rootPath: string;
  /** When false, skip IPC loads (tab is mounted but hidden). */
  isActive?: boolean;
  onOpenFile?: (filePath: string) => void;
}

export function FolderContent({
  itemId,
  rootPath,
  isActive = true,
  onOpenFile,
}: FolderContentProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([rootPath]));
  const [nodeStates, setNodeStates] = useState<Map<string, NodeState>>(new Map());
  const loadGenerationRef = useRef(0);
  // Latest props in refs so the imperative loader doesn't capture stale values.
  const rootPathRef = useRef(rootPath);
  rootPathRef.current = rootPath;

  const loadDir = useCallback(
    async (path: string) => {
      if (!isTauriRuntime()) {
        const ready = await waitForTauriRuntime();
        if (!ready) {
          setNodeStates((prev) => {
            const next = new Map(prev);
            next.set(path, {
              status: 'error',
              message:
                'Folder tree requires the desktop app (./start_project_manager.sh or npm run tauri:dev).',
            });
            return next;
          });
          return;
        }
      }
      const generation = ++loadGenerationRef.current;
      setNodeStates((prev) => {
        const next = new Map(prev);
        next.set(path, { status: 'loading' });
        return next;
      });
      try {
        const entries = await listDirectoryEntries(path);
        if (generation !== loadGenerationRef.current) return;
        setNodeStates((prev) => {
          const next = new Map(prev);
          next.set(path, { status: 'loaded', entries });
          return next;
        });
      } catch (err) {
        if (generation !== loadGenerationRef.current) return;
        const message = err instanceof Error ? err.message : String(err);
        setNodeStates((prev) => {
          const next = new Map(prev);
          next.set(path, { status: 'error', message });
          return next;
        });
      }
    },
    [],
  );

  // Load root when this tab is visible and path changes.
  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    setExpanded(new Set([rootPath]));
    void (async () => {
      const ready = await waitForTauriRuntime();
      if (cancelled) return;
      if (!ready) {
        setNodeStates((prev) => {
          const next = new Map(prev);
          next.set(rootPath, {
            status: 'error',
            message:
              'Folder tree requires the desktop app (./start_project_manager.sh or npm run tauri:dev).',
          });
          return next;
        });
        return;
      }
      await loadDir(rootPath);
    })();
    return () => {
      cancelled = true;
    };
  }, [rootPath, loadDir, isActive]);

  const toggleExpand = useCallback(
    (path: string, isDir: boolean) => {
      if (!isDir) {
        onOpenFile?.(path);
        return;
      }
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
          if (!nodeStates.has(path)) {
            void loadDir(path);
          }
        }
        return next;
      });
    },
    [nodeStates, loadDir, onOpenFile],
  );

  const refresh = useCallback(() => {
    loadGenerationRef.current += 1;
    setNodeStates(new Map());
    void loadDir(rootPathRef.current);
    setExpanded(new Set([rootPathRef.current]));
  }, [loadDir]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#1e1e1e] text-stone-200">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-stone-800 px-2 text-[11px] text-stone-400">
        <FolderOpen size={13} className="shrink-0 text-amber-300" />
        <span className="min-w-0 flex-1 truncate font-mono text-stone-300" title={rootPath}>
          {rootPath}
        </span>
        <button
          type="button"
          onClick={refresh}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm hover:bg-white/10 hover:text-stone-100"
          aria-label="Refresh folder tree"
          title="Refresh"
        >
          <RefreshCw size={11} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto py-1 text-[12px]">
        <DirNode
          path={rootPath}
          name={rootPath.replace(/\/+$/, '').split('/').pop() || rootPath}
          depth={0}
          isDir
          isSymlink={false}
          expanded={expanded}
          nodeStates={nodeStates}
          onToggle={toggleExpand}
          itemKey={itemId}
        />
      </div>
    </div>
  );
}

interface DirNodeProps {
  path: string;
  name: string;
  depth: number;
  isDir: boolean;
  isSymlink: boolean;
  expanded: Set<string>;
  nodeStates: Map<string, NodeState>;
  onToggle: (path: string, isDir: boolean) => void;
  itemKey: string;
}

function DirNode({
  path,
  name,
  depth,
  isDir,
  isSymlink,
  expanded,
  nodeStates,
  onToggle,
}: DirNodeProps) {
  const isExpanded = isDir && expanded.has(path);
  const state = nodeStates.get(path);
  const handleKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle(path, isDir);
    }
  };
  const indent = depth * 12 + 6;

  return (
    <>
      <div
        role="treeitem"
        aria-expanded={isDir ? isExpanded : undefined}
        tabIndex={0}
        onClick={() => onToggle(path, isDir)}
        onKeyDown={handleKey}
        className="flex cursor-pointer select-none items-center gap-1 px-1 py-0.5 hover:bg-white/8 focus:bg-white/10 focus:outline-none"
        style={{ paddingLeft: indent }}
        title={path}
      >
        {isDir ? (
          isExpanded ? (
            <ChevronDown size={11} className="shrink-0 text-stone-500" />
          ) : (
            <ChevronRight size={11} className="shrink-0 text-stone-500" />
          )
        ) : (
          <span className="inline-block w-[11px] shrink-0" />
        )}
        {isDir ? (
          <FolderIcon size={12} className="shrink-0 text-amber-300" />
        ) : (
          <FileIcon size={12} className="shrink-0 text-stone-400" />
        )}
        <span className={`truncate ${isSymlink ? 'italic text-sky-300' : ''}`}>{name}</span>
      </div>
      {isDir && isExpanded ? (
        <DirChildren
          parentPath={path}
          state={state}
          depth={depth + 1}
          expanded={expanded}
          nodeStates={nodeStates}
          onToggle={onToggle}
        />
      ) : null}
    </>
  );
}

interface DirChildrenProps {
  parentPath: string;
  state: NodeState | undefined;
  depth: number;
  expanded: Set<string>;
  nodeStates: Map<string, NodeState>;
  onToggle: (path: string, isDir: boolean) => void;
}

function DirChildren({
  parentPath,
  state,
  depth,
  expanded,
  nodeStates,
  onToggle,
}: DirChildrenProps) {
  const indent = depth * 12 + 6;
  if (!state || state.status === 'idle' || state.status === 'loading') {
    return (
      <div
        className="px-1 py-0.5 text-[11px] italic text-stone-500"
        style={{ paddingLeft: indent }}
      >
        loading…
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div
        className="px-1 py-0.5 text-[11px] text-red-300"
        style={{ paddingLeft: indent }}
        title={state.message}
      >
        ⚠ {state.message}
      </div>
    );
  }
  if (state.entries.length === 0) {
    return (
      <div
        className="px-1 py-0.5 text-[11px] italic text-stone-500"
        style={{ paddingLeft: indent }}
      >
        (empty)
      </div>
    );
  }
  return (
    <>
      {state.entries.map((entry) => (
        <DirNode
          key={entry.path}
          path={entry.path}
          name={entry.name}
          depth={depth}
          isDir={entry.isDir}
          isSymlink={entry.isSymlink}
          expanded={expanded}
          nodeStates={nodeStates}
          onToggle={onToggle}
          itemKey={parentPath}
        />
      ))}
    </>
  );
}
