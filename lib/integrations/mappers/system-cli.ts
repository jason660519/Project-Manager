import type { GlobalCliInventoryEntry } from '../../bridge';
import type { IntegrationRow } from '../types';

export function mapSystemCliRow(
  entry: GlobalCliInventoryEntry,
  exposedToAi: boolean,
): IntegrationRow {
  return {
    rowKey: `system-cli:${entry.command}`,
    sheet: 'commands',
    sourceKind: 'system-cli',
    sourceId: entry.command,
    enabled: exposedToAi,
    category1: 'System CLI',
    category2: entry.source,
    githubUrl: '',
    company: entry.scope === 'user' ? 'User environment' : 'System environment',
    name: entry.command,
    version: '',
    license: '',
    scope: entry.scope,
    port: '',
    installPath: entry.path,
    installMethod: 'system_path',
    status: 'installed',
    statusLabel: exposedToAi ? 'Exposed to AI' : 'Hidden from AI',
    lastUpdated: '',
    notes: 'Detected on system PATH',
    lv: null,
    badges: exposedToAi ? ['AI enabled'] : ['AI blocked'],
    payload: { systemCli: entry, exposedToAi },
  };
}

