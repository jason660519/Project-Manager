import type { InstallerPlanAction, PmSystemCommand } from './pm-system-installer';

export const PM_SYSTEM_COMMANDS: readonly PmSystemCommand[];
export const INSTALL_ACTIONS: readonly InstallerPlanAction[];
export const DRY_RUN_INSTALL_MESSAGE: string;
export function backupSteps(includeStorage: boolean): string[];
export const RESTORE_STEPS: readonly string[];
export const UPGRADE_STEPS: readonly string[];
