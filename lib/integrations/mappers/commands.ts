import type { IntegrationRow, IntegrationStatus } from '../types';

export interface SlashCommandFile {
  absPath: string;
  relPath: string;
  trigger: string;
  name: string;
  description: string;
  modified: string;
  size: number;
}

export function mapSlashCommandRow(file: SlashCommandFile, commandsDir: string): IntegrationRow {
  const exists = true;
  const status: IntegrationStatus = 'installed';

  return {
    rowKey: `commands:${file.absPath}`,
    sheet: 'commands',
    sourceKind: 'slash-command',
    sourceId: file.absPath,
    enabled: true,
    category1: 'Commands',
    category2: 'Slash command',
    githubUrl: '',
    company: 'Anthropic',
    name: file.trigger,
    version: '',
    license: '',
    scope: 'project',
    port: '',
    installPath: file.absPath,
    installMethod: 'local_file',
    status,
    statusLabel: 'Installed',
    lastUpdated: file.modified?.slice(0, 10) ?? '',
    notes: file.description || file.name,
    lv: null,
    badges: [`${(file.size / 1024).toFixed(1)} KB`],
    payload: { file, commandsDir },
  };
}
