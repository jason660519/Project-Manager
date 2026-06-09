import { describe, expect, it } from 'vitest';
import type { IntegrationRow } from '../lib/integrations/types';

/** Mirrors Integrations Hub sheet rules for which rows accept Enabled toggles. */
function canToggleIntegrationRowEnabled(
  sheet: 'plugins' | 'channels' | 'commands',
  row: Pick<IntegrationRow, 'sourceKind'>,
): boolean {
  if (sheet === 'plugins') return row.sourceKind === 'plugin-installed';
  if (sheet === 'channels') return row.sourceKind === 'channel';
  return row.sourceKind === 'command-mapping' || row.sourceKind === 'system-cli';
}

describe('Integrations Hub Enabled column contract', () => {
  it('only installed plugins are toggleable on plugin system sheets', () => {
    expect(
      canToggleIntegrationRowEnabled('plugins', { sourceKind: 'plugin-installed' }),
    ).toBe(true);
    expect(
      canToggleIntegrationRowEnabled('plugins', { sourceKind: 'plugin-marketplace' }),
    ).toBe(false);
  });

  it('channels and command mappings follow sourceKind gates', () => {
    expect(canToggleIntegrationRowEnabled('channels', { sourceKind: 'channel' })).toBe(true);
    expect(canToggleIntegrationRowEnabled('channels', { sourceKind: 'command-mapping' })).toBe(
      false,
    );
    expect(
      canToggleIntegrationRowEnabled('commands', { sourceKind: 'command-mapping' }),
    ).toBe(true);
    expect(canToggleIntegrationRowEnabled('commands', { sourceKind: 'slash-command' })).toBe(
      false,
    );
  });
});
