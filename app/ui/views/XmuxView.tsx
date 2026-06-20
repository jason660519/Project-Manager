'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { Bell, Bot, Folder, MessageSquareText, ShieldCheck } from 'lucide-react';
import { ChatPanel } from '../../../components/chat/ChatPanel';
import { isBrowserLaunchAllowed } from '../../../lib/bridge';
import {
  BrowserAccessGateProvider,
  type BrowserAccessGateValue,
} from '../../../components/browser/BrowserAccessGate';
import {
  BottomSheetTabs,
  type SheetTabItem,
} from '../../../components/sheets/BottomSheetTabs';
import {
  destroyAllBrowserSessions,
  migrateStaleIframeSessions,
  purgeOrphanNativeWebviews,
  resumeNativeBrowserPainting,
  suspendNativeBrowserPainting,
} from '../../../components/browser/BrowserRegistry';
import { LayoutRenderer } from '../../../components/terminal/LayoutRenderer';
import {
  createBlock,
  createInitialLayout,
  findBlock,
  removeBlock,
  splitLeaf,
  updateBlock,
  updateSplitRatio,
  type Block,
  type LayoutNode,
  type SplitDirection,
} from '../../../components/terminal/blockLayout';
import { destroyBlockItems } from '../../../components/terminal/destroyBlockItems';
import { deriveProjectWorkspacePath } from '../../../lib/xmux/workspacePaths';
import {
  loadPersistedXmuxLayout,
  savePersistedXmuxLayout,
} from '../../../lib/xmux/layoutPersistence';
import {
  runNativePtyBenchmark,
  type NativePtyBenchmarkResult,
} from '../../../lib/xmux/nativePtyBenchmark';
import type { EngineerRole, ProjectEntry } from '../../../lib/types';
import type { ChatContext } from '../../../lib/chat/types';
import { waitForTauriRuntime } from '../../../lib/runtime/tauri-ready';

declare global {
  interface Window {
    __xmuxRunNativePtyBenchmark?: (options?: {
      bytes?: number;
      timeoutMs?: number;
    }) => Promise<NativePtyBenchmarkResult>;
  }
}

interface WorkspaceRow {
  id: string;
  name: string;
  branch: string;
  cwd: string;
  cwdIssue?: string;
  notification?: string;
  homepageUrl: string;
}

const DEFAULT_HOMEPAGE = 'http://localhost:43187/project-progress-dashboard';
const XMUX_LAYOUT_PERSIST_DEBOUNCE_MS = 200;

function deriveHomepage(project: ProjectEntry): string {
  const github = project.config.project.githubUrl;
  if (github && /^https?:\/\//i.test(github)) return github;
  return DEFAULT_HOMEPAGE;
}

interface XmuxViewProps {
  projects?: ProjectEntry[];
  selectedDashboardProjectIds?: string[];
  selectedProjectId?: string;
}

type DragCursor = 'col-resize' | 'row-resize' | null;

function buildFallbackWorkspaces(pmRoot: string, standardsRoot: string): WorkspaceRow[] {
  const root = pmRoot.replace(/\/+$/, '');
  const standards = standardsRoot.replace(/\/+$/, '');
  const rows: WorkspaceRow[] = [
    {
      id: 'project-manager',
      name: 'Project Management',
      branch: 'local*',
      cwd: root,
      notification: 'xmux review requested',
      homepageUrl: DEFAULT_HOMEPAGE,
    },
    {
      id: 'realestate-management-apps',
      name: 'Realestate_Management_Apps',
      branch: 'main*',
      cwd: root ? `${root}/internal-resources/workspaces/realestate-management-apps` : '',
      notification: 'Codex waiting for input',
      homepageUrl: DEFAULT_HOMEPAGE,
    },
    {
      id: 'real-estate-management',
      name: 'Real Estate Management',
      branch: 'main*',
      cwd: root ? `${root}/internal-resources/workspaces/real-estate-management` : '',
      homepageUrl: DEFAULT_HOMEPAGE,
    },
    {
      id: 'saydo',
      name: 'SayDo',
      branch: 'main*',
      cwd: root ? `${root}/internal-resources/workspaces/saydo` : '',
      homepageUrl: DEFAULT_HOMEPAGE,
    },
  ];

  if (standards) {
    rows.push({
      id: 'company-ai-app-standards',
      name: 'Company-AI-App-Standards',
      branch: 'main*',
      cwd: standards,
      homepageUrl: DEFAULT_HOMEPAGE,
    });
  }

  return rows;
}

function deriveWorkspaceRows(
  projects: ProjectEntry[] | undefined,
  selectedDashboardProjectIds: string[] | undefined,
  selectedProjectId: string | undefined,
  fallback: WorkspaceRow[],
): WorkspaceRow[] {
  if (!projects || projects.length === 0) {
    return fallback;
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
    const workspacePath = deriveProjectWorkspacePath(project);
    const cwd = workspacePath.ok ? workspacePath.cwd : '';
    const pathIssue =
      workspacePath.ok ? workspacePath.warning : workspacePath.error;
    return {
      id: project.id,
      name: project.config.project.name || project.id,
      branch: project.config.project.githubUrl ? 'github' : 'local*',
      cwd,
      cwdIssue: pathIssue,
      notification: pathIssue ?? (hasUnread ? 'Feature in progress' : undefined),
      homepageUrl: deriveHomepage(project),
    };
  });
}


function AssistantDock({
  activeWorkspaceId,
  width,
  onWidthChange,
  onClose,
  beginResizeDrag,
}: {
  activeWorkspaceId: string;
  width: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
  beginResizeDrag: (
    onMove: (event: MouseEvent) => void,
    cursor: 'col-resize' | 'row-resize',
  ) => void;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const assistantContext: ChatContext = {
    currentView: 'xmux',
    adapters: [],
    activeRunCount: 0,
    dashboardProjects: activeWorkspaceId ? [activeWorkspaceId] : [],
  };
  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

  const startAssistantResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const min = 260;
    const max = Math.min(620, Math.max(320, window.innerWidth * 0.45));
    beginResizeDrag((moveEvent) => {
      const next = clamp(moveEvent.clientX - rect.left, min, max);
      onWidthChange(next);
    }, 'col-resize');
  };

  return (
    <aside
      ref={panelRef}
      className="relative flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-r border-stone-700/80 bg-editor-sidebar text-stone-200 lg:w-auto"
      style={{ width: `${width}px`, maxWidth: '100%' }}
    >
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-stone-700/70 px-3">
        <Bot size={13} className="shrink-0 text-amber-200/80" />
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-300">
          AI Assistants
        </span>
        <span className="rounded border border-stone-200/15 px-1.5 py-0.5 font-mono text-[10px] text-stone-500">
          +/-
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-stone-500 transition-colors hover:bg-white/5 hover:text-stone-200"
          aria-label="Close AI Assistants panel"
          title="Close AI Assistants panel"
        >
          ×
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-2">
        <ChatPanel
          context={assistantContext}
          defaultExpanded
          docked
          toggleOpen={(open) => {
            if (!open) onClose();
          }}
        />
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        className="absolute bottom-0 right-0 top-0 w-1.5 cursor-col-resize bg-stone-900/70 transition-colors hover:bg-sky-400/60"
        onMouseDown={startAssistantResize}
        title="Resize AI Assistants panel"
        aria-label="Resize AI Assistants panel"
      />
    </aside>
  );
}

function AssistantOpenRail({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-10 w-full shrink-0 items-center justify-center border-b border-stone-700/80 bg-editor-sidebar text-stone-400 transition-colors hover:bg-white/5 hover:text-amber-100 lg:h-auto lg:w-10 lg:border-b-0 lg:border-r"
      aria-label="Open AI Assistants panel"
      title="Open AI Assistants panel"
    >
      <MessageSquareText size={15} />
    </button>
  );
}

function NotificationPanel({ onClose, workspaceName }: { onClose: () => void; workspaceName: string }) {
  return (
    <aside className="flex min-h-0 w-full flex-col border-l border-stone-700/80 bg-editor-sidebar-r text-stone-300 lg:w-[320px]">
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

function WorkspaceHeader({
  workspace,
  notificationOpen,
  hasPendingAlerts,
  onToggleNotifications,
  ownerRoles,
  activeOwnerId,
  onSelectOwner,
  browserGate,
}: {
  workspace: WorkspaceRow | undefined;
  notificationOpen: boolean;
  hasPendingAlerts: boolean;
  onToggleNotifications: () => void;
  ownerRoles: EngineerRole[];
  activeOwnerId: string;
  onSelectOwner: (roleId: string) => void;
  browserGate: BrowserAccessGateValue;
}) {
  return (
    <header className="flex min-h-11 min-w-0 items-center gap-3 border-b border-stone-800 bg-editor-bar px-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Folder size={13} className="shrink-0 text-sky-300" />
        <div className="min-w-0">
          <h1 className="truncate text-[13px] font-semibold text-stone-100">
            {workspace?.name ?? 'Workspace'} Workspace
          </h1>
          {workspace ? (
            <p className="truncate font-mono text-[10px] text-stone-500">
              {workspace.branch} {workspace.cwd || workspace.cwdIssue || 'workspace path unavailable'}
            </p>
          ) : null}
        </div>
      </div>
      {ownerRoles.length > 0 ? (
        <label
          className="flex shrink-0 items-center gap-1.5 text-[10px] text-stone-500"
          title="Engineer whose browser-access policy (ADR-017) governs this workspace's browser panes. Unassigned = you browse freely."
        >
          <ShieldCheck
            size={12}
            className={
              browserGate.governed
                ? browserGate.allowed
                  ? 'text-emerald-300'
                  : 'text-red-300'
                : 'text-stone-500'
            }
          />
          <span className="uppercase tracking-[0.12em]">Browser owner</span>
          <select
            value={activeOwnerId}
            onChange={(event) => onSelectOwner(event.target.value)}
            className="border border-stone-700 bg-editor-addr px-1.5 py-0.5 text-[11px] text-stone-200 outline-none focus:border-sky-400/50"
            aria-label="Browser access owner"
          >
            <option value="">Unassigned (you)</option>
            {ownerRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button
        type="button"
        onClick={onToggleNotifications}
        className={[
          'relative flex h-7 w-7 items-center justify-center rounded-sm transition-colors hover:bg-white/8 hover:text-stone-100',
          notificationOpen ? 'bg-blue-400/15 text-blue-200 ring-1 ring-blue-300/30' : 'text-stone-400',
          hasPendingAlerts && !notificationOpen ? 'animate-pulse text-blue-300' : '',
        ].join(' ')}
        aria-label="Notification panel"
        aria-pressed={notificationOpen}
        title="Notification panel (Cmd+I)"
      >
        <Bell size={13} />
        {hasPendingAlerts ? (
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-300" />
        ) : null}
      </button>
    </header>
  );
}

function WorkspaceSheetTabs({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCloseWorkspace,
}: {
  workspaces: WorkspaceRow[];
  activeWorkspaceId: string;
  onSelectWorkspace: (workspaceId: string) => void;
  onCloseWorkspace: (workspaceId: string) => void;
}) {
  const tabs: SheetTabItem<string>[] = workspaces.map((workspace) => ({
    key: workspace.id,
    label: workspace.name,
    icon: <Folder size={13} />,
    iconClassName: workspace.cwdIssue ? 'text-red-300' : 'text-sky-300',
    badge: workspace.notification ? (
      <span
        className="block h-1.5 w-1.5 rounded-full bg-blue-300"
        aria-label={`${workspace.name} has unread notification`}
      />
    ) : undefined,
    ariaLabel: `${workspace.name} workspace sheet`,
    closeAriaLabel: `Close ${workspace.name} workspace sheet`,
    title: `${workspace.branch} ${workspace.cwd || workspace.cwdIssue || ''}`.trim(),
  }));

  return (
    <BottomSheetTabs
      tabs={tabs}
      activeKey={activeWorkspaceId}
      onSelect={onSelectWorkspace}
      onClose={onCloseWorkspace}
      className="min-h-10"
    />
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.isContentEditable
  );
}

function InteropConsole({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCloseWorkspace,
  onReopenWorkspaces,
  projects,
}: {
  workspaces: WorkspaceRow[];
  activeWorkspaceId: string;
  onSelectWorkspace: (workspaceId: string) => void;
  onCloseWorkspace: (workspaceId: string) => void;
  onReopenWorkspaces: () => void;
  projects?: ProjectEntry[];
}) {
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [assistantWidth, setAssistantWidth] = useState(340);
  const [dragCursor, setDragCursor] = useState<DragCursor>(null);
  const [layouts, setLayouts] = useState<Record<string, LayoutNode>>({});
  // ADR-017: per-workspace engineer "browser owner". Empty = ungoverned (you).
  const [browserOwnerByWorkspace, setBrowserOwnerByWorkspace] = useState<Record<string, string>>({});
  const pendingLayoutsRef = useRef<Record<string, LayoutNode>>({});
  const latestLayoutsRef = useRef<Record<string, LayoutNode>>({});
  const layoutPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nativeResizeSuspendedRef = useRef(false);

  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];
  const hasPendingAlerts = workspaces.some((workspace) => Boolean(workspace.notification));

  // Engineer roles for the active workspace's project (if any) drive the
  // browser-access owner selector + the fail-closed gate passed to the panes.
  const ownerRoles = useMemo(() => {
    const project = projects?.find((entry) => entry.id === activeWorkspaceId);
    return project?.config.engineerRoles ?? [];
  }, [projects, activeWorkspaceId]);
  const activeOwnerId = browserOwnerByWorkspace[activeWorkspaceId] ?? '';
  const activeOwner = ownerRoles.find((role) => role.id === activeOwnerId);
  const browserGate: BrowserAccessGateValue = activeOwner
    ? {
        governed: true,
        allowed: isBrowserLaunchAllowed(activeOwner.browserAccess),
        ownerLabel: activeOwner.name,
      }
    : { governed: false, allowed: true };
  const selectBrowserOwner = useCallback(
    (roleId: string) => {
      setBrowserOwnerByWorkspace((prev) => ({ ...prev, [activeWorkspaceId]: roleId }));
    },
    [activeWorkspaceId],
  );
  const workspacesById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace])),
    [workspaces],
  );
  const createWorkspaceLayout = useCallback((workspace: WorkspaceRow) => {
    return (
      loadPersistedXmuxLayout(workspace.id) ??
      createInitialLayout(workspace.homepageUrl, workspace.cwd, workspace.cwdIssue)
    );
  }, []);

  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    purgeOrphanNativeWebviews();
    void waitForTauriRuntime().then((ready) => {
      if (ready) migrateStaleIframeSessions();
    });
    return () => {
      if (nativeResizeSuspendedRef.current) {
        nativeResizeSuspendedRef.current = false;
        resumeNativeBrowserPainting();
      }
      destroyAllBrowserSessions();
    };
  }, []);

  const activeLayout = useMemo(() => {
    if (!activeWorkspace) return undefined;
    const stored = layouts[activeWorkspace.id];
    if (stored) return stored;
    const pending = pendingLayoutsRef.current[activeWorkspace.id];
    if (pending) return pending;
    const created = createWorkspaceLayout(activeWorkspace);
    pendingLayoutsRef.current[activeWorkspace.id] = created;
    return created;
  }, [activeWorkspace, createWorkspaceLayout, layouts]);

  useEffect(() => {
    if (!activeWorkspace) return;
    const persisted = loadPersistedXmuxLayout(activeWorkspace.id);
    if (!persisted) return;
    pendingLayoutsRef.current[activeWorkspace.id] = persisted;
    setLayouts((current) => ({
      ...current,
      [activeWorkspace.id]: persisted,
    }));
  }, [activeWorkspace?.id]);

  // Persist the first-paint layout so pane ids stay stable after hydration.
  useEffect(() => {
    if (!activeWorkspace) return;
    setLayouts((current) => {
      if (current[activeWorkspace.id]) return current;
      const pending = pendingLayoutsRef.current[activeWorkspace.id];
      if (pending) {
        return { ...current, [activeWorkspace.id]: pending };
      }
      const created = createWorkspaceLayout(activeWorkspace);
      pendingLayoutsRef.current[activeWorkspace.id] = created;
      return { ...current, [activeWorkspace.id]: created };
    });
  }, [activeWorkspace, createWorkspaceLayout]);

  const persistLayouts = useCallback((layoutsToPersist: Record<string, LayoutNode>) => {
    for (const [workspaceId, layout] of Object.entries(layoutsToPersist)) {
      savePersistedXmuxLayout(workspaceId, layout);
    }
  }, []);

  useEffect(() => {
    latestLayoutsRef.current = layouts;
    if (layoutPersistTimerRef.current) {
      clearTimeout(layoutPersistTimerRef.current);
    }
    if (Object.keys(layouts).length === 0) return;
    layoutPersistTimerRef.current = setTimeout(() => {
      layoutPersistTimerRef.current = null;
      persistLayouts(latestLayoutsRef.current);
    }, XMUX_LAYOUT_PERSIST_DEBOUNCE_MS);
    return () => {
      if (layoutPersistTimerRef.current) {
        clearTimeout(layoutPersistTimerRef.current);
        layoutPersistTimerRef.current = null;
      }
    };
  }, [layouts, persistLayouts]);

  useEffect(() => {
    return () => {
      if (layoutPersistTimerRef.current) {
        clearTimeout(layoutPersistTimerRef.current);
        layoutPersistTimerRef.current = null;
      }
      persistLayouts(latestLayoutsRef.current);
    };
  }, [persistLayouts]);

  const mutateLayout = useCallback(
    (
      workspaceId: string,
      updater: (layout: LayoutNode) => LayoutNode | null,
    ) => {
      setLayouts((current) => {
        const layout = current[workspaceId];
        if (!layout) return current;
        const next = updater(layout);
        if (next === layout) return current;
        if (next === null) {
          const workspace = workspacesById.get(workspaceId);
          const fallback = workspace
            ? createInitialLayout(workspace.homepageUrl, workspace.cwd, workspace.cwdIssue)
            : createInitialLayout(DEFAULT_HOMEPAGE);
          return { ...current, [workspaceId]: fallback };
        }
        return { ...current, [workspaceId]: next };
      });
    },
    [workspacesById],
  );

  const handleSplit = useCallback(
    (blockId: string, direction: SplitDirection) => {
      if (!activeWorkspace) return;
      mutateLayout(activeWorkspace.id, (layout) =>
        splitLeaf(layout, blockId, direction, createBlock()),
      );
    },
    [activeWorkspace, mutateLayout],
  );

  const handleCloseBlock = useCallback(
    (blockId: string) => {
      if (!activeWorkspace) return;
      const closingBlock = activeLayout ? findBlock(activeLayout, blockId) : null;
      if (closingBlock) {
        destroyBlockItems(closingBlock);
      }
      mutateLayout(activeWorkspace.id, (layout) => removeBlock(layout, blockId));
    },
    [activeLayout, activeWorkspace, mutateLayout],
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

  const resizeAssistant = useCallback(
    (nextWidth: number) => {
      setAssistantWidth(clamp(nextWidth, 260, 620));
    },
    [],
  );

  const beginDrag = useCallback(
    (onMove: (event: MouseEvent) => void, cursor: 'col-resize' | 'row-resize') => {
      let frameId: number | null = null;
      let latest: MouseEvent | null = null;
      let ended = false;
      const flush = () => {
        frameId = null;
        if (latest) onMove(latest);
      };
      const onMouseMove = (event: MouseEvent) => {
        if (ended) return;
        latest = event;
        if (frameId === null) frameId = requestAnimationFrame(flush);
      };
      const onMouseUp = () => {
        if (ended) return;
        ended = true;
        if (frameId !== null) {
          cancelAnimationFrame(frameId);
          frameId = null;
        }
        if (latest) onMove(latest);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('mouseup', onMouseUp, true);
        window.removeEventListener('blur', onMouseUp);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        document.body.style.userSelect = '';
        setDragCursor(null);
        if (nativeResizeSuspendedRef.current) {
          nativeResizeSuspendedRef.current = false;
          resumeNativeBrowserPainting();
        }
      };
      const onVisibilityChange = () => {
        if (document.visibilityState === 'hidden') onMouseUp();
      };
      document.body.style.userSelect = 'none';
      setDragCursor(cursor);
      if (!nativeResizeSuspendedRef.current) {
        nativeResizeSuspendedRef.current = true;
        suspendNativeBrowserPainting('workspace resize');
      }
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      window.addEventListener('mouseup', onMouseUp, true);
      window.addEventListener('blur', onMouseUp);
      document.addEventListener('visibilitychange', onVisibilityChange);
    },
    [],
  );

  useEffect(() => {
    if (!assistantOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        setAssistantWidth((current) => clamp(current + 32, 260, 620));
      } else if (event.key === '-') {
        event.preventDefault();
        setAssistantWidth((current) => clamp(current - 32, 260, 620));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [assistantOpen]);

  useEffect(() => {
    const handleSelectedElement = () => {
      setAssistantOpen(true);
    };
    window.addEventListener('pm:xmux-selected-element', handleSelectedElement);
    return () => window.removeEventListener('pm:xmux-selected-element', handleSelectedElement);
  }, []);

  useEffect(() => {
    window.__xmuxRunNativePtyBenchmark = (options) =>
      runNativePtyBenchmark({
        cwd: activeWorkspace?.cwd || '/tmp',
        bytes: options?.bytes ?? 64 * 1024,
        timeoutMs: options?.timeoutMs ?? 5000,
      });
    return () => {
      delete window.__xmuxRunNativePtyBenchmark;
    };
  }, [activeWorkspace?.cwd]);

  return (
    <BrowserAccessGateProvider value={browserGate}>
    <section
      ref={rootRef}
      className="flex h-full min-h-0 w-full flex-col overflow-hidden border border-stone-700/80 bg-editor-panel shadow-2xl"
    >
      <div className="flex min-h-0 flex-1 overflow-hidden flex-col lg:flex-row">
        {assistantOpen ? (
          <AssistantDock
            activeWorkspaceId={activeWorkspaceId}
            width={assistantWidth}
            onWidthChange={resizeAssistant}
            onClose={() => setAssistantOpen(false)}
            beginResizeDrag={beginDrag}
          />
        ) : (
          <AssistantOpenRail onOpen={() => setAssistantOpen(true)} />
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <WorkspaceHeader
            workspace={activeWorkspace}
            notificationOpen={notificationOpen}
            hasPendingAlerts={hasPendingAlerts}
            onToggleNotifications={() => setNotificationOpen((value) => !value)}
            ownerRoles={ownerRoles}
            activeOwnerId={activeOwnerId}
            onSelectOwner={selectBrowserOwner}
            browserGate={browserGate}
          />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {activeWorkspace && activeLayout ? (
              <LayoutRenderer
                node={activeLayout}
                workspaceId={activeWorkspace.id}
                cwd={activeWorkspace.cwd}
                cwdIssue={activeWorkspace.cwdIssue}
                homepageUrl={activeWorkspace.homepageUrl}
                onUpdateBlock={handleUpdateBlock}
                onCloseBlock={handleCloseBlock}
                onSplit={handleSplit}
                onUpdateRatio={handleUpdateRatio}
              />
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-[13px] text-stone-400">
                <div>
                  <p>所有 workspace sheet 都已關閉。</p>
                  <button
                    type="button"
                    onClick={onReopenWorkspaces}
                    className="mt-3 rounded border border-stone-200/15 px-3 py-1.5 text-[12px] text-stone-200 transition-colors hover:border-emerald-300/40 hover:text-emerald-100"
                  >
                    重新開啟 workspace sheets
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        {notificationOpen ? (
          <NotificationPanel
            onClose={() => setNotificationOpen(false)}
            workspaceName={activeWorkspace?.name ?? 'Workspace'}
          />
        ) : null}
      </div>
      {workspaces.length > 0 ? (
        <WorkspaceSheetTabs
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSelectWorkspace={onSelectWorkspace}
          onCloseWorkspace={onCloseWorkspace}
        />
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
    </BrowserAccessGateProvider>
  );
}

export function XmuxView({
  projects,
  selectedDashboardProjectIds,
  selectedProjectId,
}: XmuxViewProps = {}) {
  const [fallbackWorkspaces, setFallbackWorkspaces] = useState<WorkspaceRow[]>(() =>
    buildFallbackWorkspaces('', ''),
  );
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { getProjectManagerRoot } = await import('../../../lib/bridge');
        const root = await getProjectManagerRoot();
        const standards = root
          ? `${root.replace(/\/+$/, '')}/internal-resources/company-ai-app-standards`
          : '';
        if (!cancelled) setFallbackWorkspaces(buildFallbackWorkspaces(root, standards));
      } catch {
        if (!cancelled) setFallbackWorkspaces(buildFallbackWorkspaces('', ''));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dashboardScopedIds = useMemo(() => {
    if (!projects || projects.length === 0) return [];
    const validIds = new Set(projects.map((project) => project.id));
    return (selectedDashboardProjectIds ?? []).filter((id) => validIds.has(id));
  }, [projects, selectedDashboardProjectIds]);
  const workspaces = useMemo(
    () => deriveWorkspaceRows(projects, dashboardScopedIds, selectedProjectId, fallbackWorkspaces),
    [projects, dashboardScopedIds, fallbackWorkspaces, selectedProjectId],
  );
  const [closedWorkspaceIds, setClosedWorkspaceIds] = useState<Set<string>>(() => new Set());
  const visibleWorkspaces = useMemo(
    () => workspaces.filter((workspace) => !closedWorkspaceIds.has(workspace.id)),
    [closedWorkspaceIds, workspaces],
  );
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(visibleWorkspaces[0]?.id ?? '');
  const [mounted, setMounted] = useState(false);
  const lastSyncedProjectIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (
      selectedProjectId &&
      selectedProjectId !== lastSyncedProjectIdRef.current &&
      visibleWorkspaces.some((workspace) => workspace.id === selectedProjectId)
    ) {
      setActiveWorkspaceId(selectedProjectId);
    }
    lastSyncedProjectIdRef.current = selectedProjectId;
  }, [selectedProjectId, visibleWorkspaces]);

  useEffect(() => {
    if (!visibleWorkspaces.some((workspace) => workspace.id === activeWorkspaceId)) {
      setActiveWorkspaceId(visibleWorkspaces[0]?.id ?? '');
    }
  }, [activeWorkspaceId, visibleWorkspaces]);

  const closeWorkspace = useCallback((workspaceId: string) => {
    setClosedWorkspaceIds((current) => {
      const next = new Set(current);
      next.add(workspaceId);
      return next;
    });
  }, []);

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      {workspaces.length === 0 ? (
        <div className="flex h-full min-h-[280px] items-center justify-center rounded border border-stone-700/80 bg-editor-panel text-stone-400">
          目前沒有可顯示的 workspace，請先在 Project Dashboard 勾選專案。
        </div>
      ) : !mounted ? (
        <div className="flex h-full min-h-[280px] items-center justify-center rounded border border-stone-700/80 bg-editor-panel text-stone-400">
          載入 xmux workspace...
        </div>
      ) : (
        <InteropConsole
          workspaces={visibleWorkspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSelectWorkspace={setActiveWorkspaceId}
          onCloseWorkspace={closeWorkspace}
          onReopenWorkspaces={() => setClosedWorkspaceIds(new Set())}
          projects={projects}
        />
      )}
    </section>
  );
}
