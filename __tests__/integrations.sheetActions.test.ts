import { describe, expect, it } from 'vitest';
import {
  INTEGRATION_INVENTORY_SHEETS,
  INTEGRATION_SHEET_ACTION_LABELS,
  createIntegrationSheetActionRegistry,
  isIntegrationInventorySheet,
} from '../lib/integrations/sheet-actions';
import { LEGACY_PLUGINS_SHEET, SYSTEM_INSTALLED_APPS_SHEET } from '../lib/integrations/types';
import type { ScanOutcome } from '../lib/integrations/scan-diff';
import type { IntegrationInventorySheet } from '../lib/integrations/sheet-actions';

function outcome(sheetId: IntegrationInventorySheet): ScanOutcome {
  return {
    sheetId,
    label: INTEGRATION_SHEET_ACTION_LABELS[sheetId],
    count: 0,
    added: [],
    removed: [],
    updated: [],
    durationMs: 1,
  };
}

describe('integration hub sheet actions', () => {
  it('treats System Installed Apps as the first-class plugins inventory sheet', () => {
    expect(INTEGRATION_INVENTORY_SHEETS[0]).toBe(SYSTEM_INSTALLED_APPS_SHEET);
    expect(INTEGRATION_INVENTORY_SHEETS).not.toContain(LEGACY_PLUGINS_SHEET);
    expect(INTEGRATION_INVENTORY_SHEETS).toContain('workflow-execution-requests');
    expect(INTEGRATION_INVENTORY_SHEETS).toContain('workflow-execution-records');
    expect(isIntegrationInventorySheet(SYSTEM_INSTALLED_APPS_SHEET)).toBe(true);
    expect(isIntegrationInventorySheet(LEGACY_PLUGINS_SHEET)).toBe(false);
    expect(isIntegrationInventorySheet('workflow-execution-requests')).toBe(true);
    expect(isIntegrationInventorySheet('workflow-execution-records')).toBe(true);
  });

  it('requires every inventory sheet to expose independent scan and test methods', async () => {
    const calls: string[] = [];
    const config = Object.fromEntries(
      INTEGRATION_INVENTORY_SHEETS.map((sheetId) => [
        sheetId,
        {
          scan: async () => {
            calls.push(`${sheetId}:scan`);
            return outcome(sheetId);
          },
          test: async () => {
            calls.push(`${sheetId}:test`);
            return outcome(sheetId);
          },
        },
      ]),
    ) as Record<
      IntegrationInventorySheet,
      {
        scan: () => Promise<ScanOutcome>;
        test: () => Promise<ScanOutcome>;
      }
    >;
    const registry = createIntegrationSheetActionRegistry(config);

    for (const sheetId of INTEGRATION_INVENTORY_SHEETS) {
      expect(registry[sheetId].sheetId).toBe(sheetId);
      expect(typeof registry[sheetId].scan).toBe('function');
      expect(typeof registry[sheetId].test).toBe('function');
      await expect(registry[sheetId].scan()).resolves.toMatchObject({ sheetId });
      await expect(registry[sheetId].test([])).resolves.toMatchObject({ sheetId });
    }

    expect(calls).toContain(`${SYSTEM_INSTALLED_APPS_SHEET}:scan`);
    expect(calls).toContain(`${SYSTEM_INSTALLED_APPS_SHEET}:test`);
    expect(calls).not.toContain(`${LEGACY_PLUGINS_SHEET}:scan`);
  });
});
