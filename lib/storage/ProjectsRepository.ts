import type { ProjectEntry } from '../types';

/**
 * Storage abstraction for DevPilot project list + per-user UI state.
 *
 * Today the only implementation is `LocalStorageProjectsRepository`. The
 * interface is async so a future Tauri-SQLite or cloud-backed implementation
 * (for cross-device sync) can be swapped in without touching call sites.
 *
 * Naming convention used by every implementation:
 *   - `devpilot.shared.*`   — data that should one day sync across machines
 *                              (project list, feature status, …)
 *   - `devpilot.personal.*` — per-user UI preference, never synced
 *                              (selected project, dashboard multi-selection)
 */
export interface ProjectsRepository {
  // ── Shared ────────────────────────────────────────────────────────────
  /** Load the full project list. Returns [] when none stored yet. */
  listProjects(): Promise<ProjectEntry[]>;
  /** Replace the entire project list. Callers manage merging. */
  saveProjects(projects: ProjectEntry[]): Promise<void>;

  // ── Personal UI state ─────────────────────────────────────────────────
  /** Currently focused project (single-select). */
  getSelectedProjectId(): Promise<string | null>;
  setSelectedProjectId(id: string): Promise<void>;

  /** Project IDs included in the dashboard (multi-select). */
  getDashboardProjectIds(): Promise<string[] | null>;
  setDashboardProjectIds(ids: string[]): Promise<void>;
}
