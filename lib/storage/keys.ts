/**
 * Single source of truth for the localStorage keys Project Manager writes to.
 *
 * Naming convention:
 *   - `projectManager.shared.*`   — should one day sync across machines (project list, …)
 *   - `projectManager.personal.*` — per-user UI preference, never synced
 *
 * Legacy flat keys are kept as constants only to drive the one-time migration
 * inside `LocalStorageProjectsRepository`.  No new code should reference them.
 */

export const KEY_SHARED_PROJECTS = 'projectManager.shared.projects';
export const KEY_PERSONAL_SELECTED_PROJECT_ID = 'projectManager.personal.selectedProjectId';
export const KEY_PERSONAL_DASHBOARD_PROJECT_IDS = 'projectManager.personal.dashboardProjectIds';
/**
 * Flag that records whether bundled sample projects have already been seeded
 * (or whether existing storage has been migrated past the legacy
 * force-merge-on-every-boot behaviour). Once true, the user fully owns
 * their project list — deleted samples never come back.
 */
export const KEY_PERSONAL_SEEDED = 'projectManager.personal.seeded';

export const KEY_SHARED_PLUGINS = 'projectManager.shared.plugins';
export const KEY_SHARED_CHANNELS = 'projectManager.shared.channels';
export const KEY_SHARED_CAPABILITIES = 'projectManager.shared.capabilities';
export const KEY_SHARED_SKILLS_DIR = 'projectManager.shared.skillsDir';
export const KEY_PERSONAL_SYSTEM_CLI_EXPOSURE = 'projectManager.personal.systemCliExposure';
export const KEY_PERSONAL_AI_CLI_PRESET_ALLOWLIST = 'projectManager.personal.aiCliPresetAllowlist';
export const KEY_PERSONAL_MOBILE_REMOTE_AUDIT = 'projectManager.personal.mobileRemoteAudit';
export const KEY_PERSONAL_MOBILE_REMOTE_APPROVALS = 'projectManager.personal.mobileRemoteApprovals';

export const LEGACY_KEY_PROJECTS = 'devpilot-projects';
export const LEGACY_KEY_SELECTED_PROJECT_ID = 'devpilot-selected-project-id';
export const LEGACY_KEY_DASHBOARD_PROJECT_IDS = 'devpilot-dashboard-selected-project-ids';
