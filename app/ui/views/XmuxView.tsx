'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { Bell, Folder } from 'lucide-react';
import { LayoutRenderer } from '../../../components/terminal/LayoutRenderer';
import {
  createBlock,
  createInitialLayout,
  countBlocks,
  checkLayoutFits,
  findBlock,
  forEachBlock,
  removeBlock,
  splitLeaf,
  updateBlock,
  updateSplitRatio,
  type Block,
  type LayoutNode,
  type SplitDirection,
} from '../../../components/terminal/blockLayout';
import { destroyBlockItems } from '../../../components/terminal/destroyBlockItems';
import {
  migrateStaleIframeSessions,
  purgeOrphanNativeWebviews,
} from '../../../components/browser/BrowserRegistry';
import { waitForTauriRuntime } from '../../../lib/runtime/tauri-ready';
import type { ProjectEntry } from '../../../lib/types';

interface WorkspaceRow {
  id: string;
  name: string;
  branch: string;
  cwd: string;
  notification?: string;
  homepageUrl: string;
}

const DEFAULT_HOMEPAGE = 'http://localhost:43187/project-progress-dashboard';

function deriveHomepage(project: ProjectEntry): string {
  const github = project.config.project.githubUrl;
  if (github && /^https?:\/\//i.test(github)) return github;
  return DEFAULT_HOMEPAGE;
}

// Always return a directory path, never the config-file path itself.
// PTY spawn requires cwd to be a directory; passing a `.json` file path errors.
function deriveProjectCwd(project: ProjectEntry): string {
  const root = project.config.project.root;
  if (root) return root;
  const configPath = project.configPath;
  const marker = '/.project-manager/config.json';
  if (configPath.endsWith(marker)) {
    return configPath.slice(0, -marker.length);
  }
  const lastSlash = configPath.lastIndexOf('/');
  return lastSlash > 0 ? configPath.slice(0, lastSlash) : '/';
}

interface XmuxViewProps {
  projects?: ProjectEntry[];
  selectedDashboardProjectIds?: string[];
  selectedProjectId?: string;
}

type DragCursor = 'col-resize' | 'row-resize' | null;

const fallbackWorkspaces: WorkspaceRow[] = [
  {
    id: 'project-manager',
    name: 'Project Management',
    branch: 'dispatch-wip-20260525*',
    cwd: '/Volumes/KLEVV-4T-1/Project-Manager',
    notification: 'xmux review requested',
    homepageUrl: DEFAULT_HOMEPAGE,
  },
  {
    id: 'realestate-management-apps',
    name: 'Realestate_Management_Apps',
    branch: 'main*',
    cwd: '/Volumes/KLEVV-4T-1/Realestate_Management_Apps',
    notification: 'Codex waiting for input',
    homepageUrl: DEFAULT_HOMEPAGE,
  },
  {
    id: 'comfy-ui',
    name: 'ComfyUI',
    branch: 'main*',
    cwd: '/Volumes/KLEVV-4T-1/Real Estate Management',
    homepageUrl: DEFAULT_HOMEPAGE,
  },
  {
    id: 'saydo',
    name: 'SayDo',
    branch: 'main*',
    cwd: '/Volumes/KLEVV-4T-1/SayDo',
    homepageUrl: DEFAULT_HOMEPAGE,
  },
  {
    id: 'company-ai-app-standards',
    name: 'Company-AI-App-Standards',
    branch: 'main*',
    cwd: '/Volumes/KLEVV-4T-1/Company-AI-App-Standards',
    homepageUrl: DEFAULT_HOMEPAGE,
  },
];

function deriveWorkspaceRows(
  projects: ProjectEntry[] | undefined,
  selectedDashboardProjectIds: string[] | undefined,
  selectedProjectId: string | undefined,
): WorkspaceRow[] {
  if (!projects || projects.length === 0) {
    return fallbackWorkspaces;
  }

  const byId = new Map(projects.map((project) => [project.id, project]));
  const dashboardProjects = (selectedDashboardProjectIds ?? [])
    .map((id) => byId.get(id))
    .filter((project): project is ProjectEntry => Boolean(project));
  const source = dashboardProjects;

  if (source.length === 0) {
    return [];
  }

  return source.map((project) => {
    const hasUnread =
      project.id !== selectedProjectId &&
      project.config.features.some((feature) => feature.status === 'in_progress');
    return {
      id: project.id,
      name: project.config.project.name || project.id,
      branch: project.config.project.githubUrl ? 'github' : 'local*',
      cwd: deriveProjectCwd(project),
      notification: hasUnread ? 'Feature in progress' : undefined,
      homepageUrl: deriveHomepage(project),
    };
  });
}


function WorkspaceSidebar({
  notificationOpen,
  hasPendingAlerts,
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onToggleNotifications,
}: {
  notificationOpen: boolean;
  hasPendingAlerts: boolean;
  workspaces: WorkspaceRow[];
  activeWorkspaceId: string;
  onSelectWorkspace: (workspaceId: string) => void;
  onToggleNotifications: () => void;
}) {
  return (
    <aside className="flex min-h-0 w-full shrink-0 flex-col border-r border-stone-700/80 bg-[#1f2326] text-stone-200">
      <div className="flex h-9 items-center justify-between border-b border-stone-700/70 px-2">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-stone-400 uppercase">Workspaces</span>
        <button
          type="button"
          onClick={onToggleNotifications}
          className={[
            'relative flex h-6 w-6 items-center justify-center rounded-sm transition-colors hover:bg-white/8 hover:text-stone-100',
            notificationOpen ? 'bg-blue-400/15 text-blue-200 ring-1 ring-blue-300/30' : 'text-stone-400',
            hasPendingAlerts && !notificationOpen ? 'animate-pulse text-blue-300' : '',
          ].join(' ')}
          aria-label="Notification panel"
          aria-pressed={notificationOpen}
          title="Notification panel (Cmd+I)"
        >
          <Bell size={13} />
          {hasPendingAlerts ? (
            <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-blue-300" />
          ) : null}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {workspaces.map((workspace) => (
          <button
            type="button"
            key={workspace.id}
            onClick={() => onSelectWorkspace(workspace.id)}
            className={[
              'mb-1 block w-full rounded-md px-2.5 py-2 text-left transition-colors',
              workspace.id === activeWorkspaceId
                ? 'bg-blue-500 text-white shadow-[0_0_0_1px_rgba(147,197,253,0.7)]'
                : 'text-stone-300 hover:bg-white/6 hover:text-stone-100',
            ].join(' ')}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="block truncate text-[13px] font-semibold">{workspace.name}</span>
              {workspace.notification ? (
                <span
                  className={[
                    'ml-auto h-2 w-2 shrink-0 rounded-full',
                    notificationOpen ? 'bg-blue-200 shadow-[0_0_0_3px_rgba(96,165,250,0.3)]' : 'bg-blue-400',
                  ].join(' ')}
                  aria-label={`${workspace.name} has unread notification`}
                />
              ) : null}
            </span>
            <span
              className={`mt-1 block truncate font-mono text-[11px] ${
                workspace.id === activeWorkspaceId ? 'text-blue-100' : 'text-stone-400'
              }`}
            >
              {workspace.branch} {workspace.cwd}
            </span>
            {workspace.notification ? (
              <span
                className={`mt-1 block truncate text-[11px] ${
                  workspace.id === activeWorkspaceId ? 'text-blue-50' : 'text-stone-500'
                }`}
              >
                {workspace.notification}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </aside>
  );
}

function NotificationPanel({ onClose, workspaceName }: { onClose: () => void; workspaceName: string }) {
  return (
    <aside className="flex min-h-0 w-full flex-col border-l border-stone-700/80 bg-[#202326] text-stone-300 lg:w-[320px]">
      <div className="flex h-9 items-center justify-between border-b border-stone-700/70 px-3">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-stone-100">
          <Bell size={14} className="text-blue-300" />
          Notifications
        </div>
        <button type="button" onClick={onClose} className="text-[11px] text-stone-500 hover:text-stone-200">
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="border border-blue-300/30 bg-blue-400/10 p-3">
          <p className="text-[12px] font-semibold text-blue-100">Codex waiting for input</p>
          <p className="mt-1 text-[11px] leading-4 text-stone-400">{workspaceName} needs review on the active terminal pane.</p>
          <p className="mt-2 font-mono text-[10px] text-stone-500">Shortcut: Cmd+Shift+U</p>
        </div>
      </div>
    </aside>
  );
}

function WorkspaceHeader({ workspaceName }: { workspaceName: string }) {
  return (
    <header className="flex h-9 min-w-0 items-center border-b border-stone-800 bg-[#202020] px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Folder size={13} className="shrink-0 text-sky-300" />
        <h1 className="truncate text-[13px] font-semibold text-stone-100">{workspaceName} Workspace</h1>
      </div>
    </header>
  );
}

function InteropConsole({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
}: {
  workspaces: WorkspaceRow[];
  activeWorkspaceId: string;
  onSelectWorkspace: (workspaceId: string) => void;
}) {
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [dragCursor, setDragCursor] = useState<DragCursor>(null);
  const [layouts, setLayouts] = useState<Record<string, LayoutNode>>({});
  const pendingLayoutsRef = useRef<Record<string, LayoutNode>>({});
  const [splitNotice, setSplitNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [layoutViewport, setLayoutViewport] = useState({ width: 0, height: 0 });

  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];
  const hasPendingAlerts = workspaces.some((workspace) => Boolean(workspace.notification));
  const workspacesById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace])),
    [workspaces],
  );

  const rootRef = useRef<HTMLElement | null>(null);
  const layoutViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    purgeOrphanNativeWebviews();
    void waitForTauriRuntime().then((ready) => {
      if (ready) migrateStaleIframeSessions();
    });
  }, []);

  const activeLayout = useMemo(() => {
    if (!activeWorkspace) return undefined;
    const stored = layouts[activeWorkspace.id];
    if (stored) return stored;
    const pending = pendingLayoutsRef.current[activeWorkspace.id];
    if (pending) return pending;
    const created = createInitialLayout(activeWorkspace.homepageUrl);
    pendingLayoutsRef.current[activeWorkspace.id] = created;
    return created;
  }, [activeWorkspace, layouts]);

  // Persist the first-paint layout so pane ids stay stable after hydration.
  useEffect(() => {
    if (!activeWorkspace) return;
    setLayouts((current) => {
      if (current[activeWorkspace.id]) return current;
      const pending = pendingLayoutsRef.current[activeWorkspace.id];
      if (pending) {
        return { ...current, [activeWorkspace.id]: pending };
      }
      const created = createInitialLayout(activeWorkspace.homepageUrl);
      pendingLayoutsRef.current[activeWorkspace.id] = created;
      return { ...current, [activeWorkspace.id]: created };
    });
  }, [activeWorkspace]);

  useEffect(() => {
    const el = layoutViewportRef.current;
    if (!el) return;
    const update = () =>
      setLayoutViewport({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const showSplitBlocked = useCallback((message: string) => {
    setSplitNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setSplitNotice(null), 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const mutateLayout = useCallback(
    (
      workspaceId: string,
      updater: (layout: LayoutNode) => LayoutNode | null,
    ) => {
      setLayouts((current) => {
        const layout = current[workspaceId] ?? pendingLayoutsRef.current[workspaceId];
        if (!layout) return current;
        const next = updater(layout);
        if (next === layout) return current;
        if (next === null) {
          forEachBlock(layout, destroyBlockItems);
          const homepage =
            workspacesById.get(workspaceId)?.homepageUrl ?? DEFAULT_HOMEPAGE;
          const reset = createInitialLayout(homepage);
          pendingLayoutsRef.current[workspaceId] = reset;
          return { ...current, [workspaceId]: reset };
        }
        pendingLayoutsRef.current[workspaceId] = next;
        return { ...current, [workspaceId]: next };
      });
    },
    [workspacesById],
  );

  const handleSplit = useCallback(
    (blockId: string, direction: SplitDirection) => {
      if (!activeWorkspace) return;
      mutateLayout(activeWorkspace.id, (layout) =>
        {
          const { width, height } = layoutViewport;
          const hasViewport = width > 0 && height > 0;
          const minBlockWidth = width < 900 ? 240 : 300;
          const minBlockHeight = height < 600 ? 160 : 200;
          const maxBlocks = hasViewport
            ? Math.max(
                1,
                Math.floor(width / minBlockWidth) * Math.floor(height / minBlockHeight),
              )
            : Number.POSITIVE_INFINITY;
          const currentBlocks = countBlocks(layout);
          if (hasViewport && currentBlocks >= maxBlocks) {
            showSplitBlocked(
              `已達到此視窗可合理顯示的最大區塊數（${maxBlocks}）。請先關閉部分區塊或放大視窗後再分割。`,
            );
            return layout;
          }

          const next = splitLeaf(layout, blockId, direction, createBlock());
          if (next === layout) return layout;

          if (hasViewport) {
            const fit = checkLayoutFits(next, width, height, minBlockWidth, minBlockHeight);
            if (!fit.ok) {
              showSplitBlocked('此視窗尺寸下無法再分割，避免區塊過小或導致版面超出可視範圍。');
              return layout;
            }
          }
          return next;
        },
      );
    },
    [activeWorkspace, layoutViewport, mutateLayout, showSplitBlocked],
  );

  const handleCloseBlock = useCallback(
    (blockId: string) => {
      if (!activeWorkspace) return;
      const layout =
        layouts[activeWorkspace.id] ??
        pendingLayoutsRef.current[activeWorkspace.id];
      if (layout) {
        const block = findBlock(layout, blockId);
        if (block) destroyBlockItems(block);
      }
      mutateLayout(activeWorkspace.id, (layout) => removeBlock(layout, blockId));
    },
    [activeWorkspace, layouts, mutateLayout],
  );

  const handleUpdateBlock = useCallback(
    (blockId: string, updater: (block: Block) => Block) => {
      if (!activeWorkspace) return;
      mutateLayout(activeWorkspace.id, (layout) =>
        updateBlock(layout, blockId, updater),
      );
    },
    [activeWorkspace, mutateLayout],
  );

  const handleUpdateRatio = useCallback(
    (splitId: string, ratio: number) => {
      if (!activeWorkspace) return;
      mutateLayout(activeWorkspace.id, (layout) =>
        updateSplitRatio(layout, splitId, ratio),
      );
    },
    [activeWorkspace, mutateLayout],
  );

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

  const beginDrag = useCallback(
    (onMove: (event: MouseEvent) => void, cursor: 'col-resize' | 'row-resize') => {
      let frameId: number | null = null;
      let latest: MouseEvent | null = null;
      const flush = () => {
        frameId = null;
        if (latest) onMove(latest);
      };
      const onMouseMove = (event: MouseEvent) => {
        latest = event;
        if (frameId === null) frameId = requestAnimationFrame(flush);
      };
      const onMouseUp = () => {
        if (frameId !== null) {
          cancelAnimationFrame(frameId);
          frameId = null;
        }
        if (latest) onMove(latest);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.userSelect = '';
        setDragCursor(null);
      };
      document.body.style.userSelect = 'none';
      setDragCursor(cursor);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [],
  );

  const startSidebarResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const max = Math.min(520, Math.max(260, rect.width * 0.55));
    beginDrag((moveEvent) => {
      const next = clamp(moveEvent.clientX - rect.left, 220, max);
      setSidebarWidth(next);
    }, 'col-resize');
  };

  return (
    <section
      ref={rootRef}
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden border border-stone-700/80 bg-[#1b1b1b] shadow-2xl lg:flex-row"
    >
      <div className="shrink-0" style={{ width: `min(100%, ${sidebarWidth}px)` }}>
        <WorkspaceSidebar
          notificationOpen={notificationOpen}
          hasPendingAlerts={hasPendingAlerts}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSelectWorkspace={onSelectWorkspace}
          onToggleNotifications={() => setNotificationOpen((value) => !value)}
        />
      </div>
      <div
        className="hidden w-1.5 shrink-0 cursor-col-resize bg-stone-900 transition-colors hover:bg-sky-400/60 lg:block"
        onMouseDown={startSidebarResize}
        title="Resize sidebar"
        aria-label="Resize workspace sidebar"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceHeader workspaceName={activeWorkspace?.name ?? 'Workspace'} />
        <div
          ref={layoutViewportRef}
          data-xmux-viewport
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          {activeWorkspace && activeLayout ? (
            <LayoutRenderer
              node={activeLayout}
              workspaceId={activeWorkspace.id}
              cwd={activeWorkspace.cwd}
              homepageUrl={activeWorkspace.homepageUrl}
              onUpdateBlock={handleUpdateBlock}
              onCloseBlock={handleCloseBlock}
              onSplit={handleSplit}
              onUpdateRatio={handleUpdateRatio}
            />
          ) : null}
        </div>
      </div>
      {notificationOpen ? (
        <NotificationPanel
          onClose={() => setNotificationOpen(false)}
          workspaceName={activeWorkspace?.name ?? 'Workspace'}
        />
      ) : null}
      {splitNotice ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute bottom-3 right-3 z-40 max-w-[420px] border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
        >
          {splitNotice}
        </div>
      ) : null}
      {dragCursor ? (
        <div
          data-resize-overlay
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            cursor: dragCursor,
            zIndex: 50,
          }}
        />
      ) : null}
    </section>
  );
}

export function XmuxView({
  projects,
  selectedDashboardProjectIds,
  selectedProjectId,
}: XmuxViewProps = {}) {
  const dashboardScopedIds = useMemo(() => {
    if (!projects || projects.length === 0) return [];
    const validIds = new Set(projects.map((project) => project.id));
    return (selectedDashboardProjectIds ?? []).filter((id) => validIds.has(id));
  }, [projects, selectedDashboardProjectIds]);
  const workspaces = useMemo(
    () => deriveWorkspaceRows(projects, dashboardScopedIds, selectedProjectId),
    [projects, dashboardScopedIds, selectedProjectId],
  );
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(workspaces[0]?.id ?? '');
  const lastSyncedProjectIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (
      selectedProjectId &&
      selectedProjectId !== lastSyncedProjectIdRef.current &&
      workspaces.some((workspace) => workspace.id === selectedProjectId)
    ) {
      setActiveWorkspaceId(selectedProjectId);
    }
    lastSyncedProjectIdRef.current = selectedProjectId;
  }, [selectedProjectId, workspaces]);

  useEffect(() => {
    if (!workspaces.some((workspace) => workspace.id === activeWorkspaceId)) {
      setActiveWorkspaceId(workspaces[0]?.id ?? '');
    }
  }, [activeWorkspaceId, workspaces]);

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      {workspaces.length === 0 ? (
        <div className="flex h-full min-h-[280px] items-center justify-center rounded border border-stone-700/80 bg-[#1b1b1b] text-stone-400">
          目前沒有可顯示的 workspace，請先在 Project Dashboard 勾選專案。
        </div>
      ) : (
        <InteropConsole
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSelectWorkspace={setActiveWorkspaceId}
        />
      )}
    </section>
  );
}
