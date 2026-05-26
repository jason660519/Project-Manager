import type { IntegrationRow, IntegrationSheet } from './types';
import type { ScanOutcome } from './scan-diff';

export const INTEGRATION_INVENTORY_SHEETS = [
  'system_installed_apps',
  'coding-tools',
  'mcp',
  'skills',
  'channels',
  'memory',
  'commands',
  'connected-instances',
] as const satisfies readonly IntegrationSheet[];

export type IntegrationInventorySheet = typeof INTEGRATION_INVENTORY_SHEETS[number];

export type IntegrationSheetTestMode = 'selected-rows' | 'sheet';

export const INTEGRATION_SHEET_ACTION_LABELS: Record<IntegrationInventorySheet, string> = {
  system_installed_apps: 'System Installed Apps',
  'coding-tools': 'Coding Tools',
  mcp: 'MCP',
  skills: 'Skills',
  channels: 'Channels',
  memory: 'Memory',
  commands: 'Commands',
  'connected-instances': 'Connected Instances',
};

export interface IntegrationSheetAction<SharedScanContext = unknown> {
  sheetId: IntegrationInventorySheet;
  label: string;
  scan: (sharedCtx?: SharedScanContext) => Promise<ScanOutcome>;
  test: (rows: IntegrationRow[]) => Promise<ScanOutcome>;
  testMode: IntegrationSheetTestMode;
}

type IntegrationSheetRunnerConfig<SharedScanContext> = {
  [Sheet in IntegrationInventorySheet]: {
    scan: (sharedCtx?: SharedScanContext) => Promise<ScanOutcome>;
    test: (rows: IntegrationRow[]) => Promise<ScanOutcome>;
    testMode?: IntegrationSheetTestMode;
  };
};

export type IntegrationSheetActionRegistry<SharedScanContext = unknown> = {
  [Sheet in IntegrationInventorySheet]: IntegrationSheetAction<SharedScanContext>;
};

export function isIntegrationInventorySheet(sheet: IntegrationSheet): sheet is IntegrationInventorySheet {
  return (INTEGRATION_INVENTORY_SHEETS as readonly IntegrationSheet[]).includes(sheet);
}

export function createIntegrationSheetActionRegistry<SharedScanContext>(
  config: IntegrationSheetRunnerConfig<SharedScanContext>,
): IntegrationSheetActionRegistry<SharedScanContext> {
  return Object.fromEntries(
    INTEGRATION_INVENTORY_SHEETS.map((sheetId) => [
      sheetId,
      {
        sheetId,
        label: INTEGRATION_SHEET_ACTION_LABELS[sheetId],
        scan: config[sheetId].scan,
        test: config[sheetId].test,
        testMode: config[sheetId].testMode ?? 'sheet',
      },
    ]),
  ) as IntegrationSheetActionRegistry<SharedScanContext>;
}

export function createSheetTestOutcome(params: {
  sheetId: IntegrationInventorySheet;
  count: number;
  durationMs: number;
  skipped?: string;
  error?: string;
}): ScanOutcome {
  return {
    sheetId: params.sheetId,
    label: INTEGRATION_SHEET_ACTION_LABELS[params.sheetId],
    count: params.count,
    added: [],
    removed: [],
    updated: [],
    skipped: params.skipped,
    error: params.error,
    durationMs: params.durationMs,
  };
}
