/**
 * Single source of truth for the localStorage keys DevPilot writes to.
 *
 * Naming convention:
 *   - `devpilot.shared.*`   — should one day sync across machines (project list, …)
 *   - `devpilot.personal.*` — per-user UI preference, never synced
 *
 * Legacy flat keys are kept as constants only to drive the one-time migration
 * inside `LocalStorageProjectsRepository`.  No new code should reference them.
 */

export const KEY_SHARED_PROJECTS = 'devpilot.shared.projects';
export const KEY_PERSONAL_SELECTED_PROJECT_ID = 'devpilot.personal.selectedProjectId';
export const KEY_PERSONAL_DASHBOARD_PROJECT_IDS = 'devpilot.personal.dashboardProjectIds';

export const KEY_SHARED_PLUGINS = 'devpilot.shared.plugins';
export const KEY_SHARED_CHANNELS = 'devpilot.shared.channels';

export const LEGACY_KEY_PROJECTS = 'devpilot-projects';
export const LEGACY_KEY_SELECTED_PROJECT_ID = 'devpilot-selected-project-id';
export const LEGACY_KEY_DASHBOARD_PROJECT_IDS = 'devpilot-dashboard-selected-project-ids';
