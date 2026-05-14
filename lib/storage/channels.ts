import type { ChannelCatalog, ChannelConfig, CommandMapping, CommandAction } from '../types/channels';
import { KEY_SHARED_CHANNELS } from './keys';

function readJSON<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or disabled */
  }
}

const DEFAULT_COMMAND_MAPPINGS: CommandMapping[] = [
  { id: 'help',   trigger: '/help',   action: 'help',         description: 'List available commands',          enabled: true  },
  { id: 'status', trigger: '/status', action: 'get_status',   description: 'Get all feature statuses',         enabled: true  },
  { id: 'report', trigger: '/report', action: 'daily_report', description: 'Send today\'s progress report',    enabled: true  },
  { id: 'run',    trigger: '/run',    action: 'run_feature',  description: 'Trigger a feature agent run',      enabled: false },
];

const DEFAULT_CATALOG: ChannelCatalog = {
  channels: [],
  commandMappings: DEFAULT_COMMAND_MAPPINGS,
};

export function loadChannelCatalog(): ChannelCatalog {
  const raw = readJSON<ChannelCatalog>(KEY_SHARED_CHANNELS);
  if (!raw) return DEFAULT_CATALOG;
  return {
    channels: Array.isArray(raw.channels) ? raw.channels : [],
    commandMappings: Array.isArray(raw.commandMappings)
      ? raw.commandMappings
      : DEFAULT_COMMAND_MAPPINGS,
  };
}

export function saveChannelCatalog(catalog: ChannelCatalog): void {
  writeJSON(KEY_SHARED_CHANNELS, catalog);
}

// Sensitive credentials are stored outside the catalog JSON to keep secrets
// out of the main blob. Key pattern: projectManager.personal.channel.<channelId>.<field>

export function getChannelSecret(channelId: string, field: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(`projectManager.personal.channel.${channelId}.${field}`) ?? '';
  } catch {
    return '';
  }
}

export function setChannelSecret(channelId: string, field: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `projectManager.personal.channel.${channelId}.${field}`;
    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

export function deleteChannelSecrets(channelId: string, fields: string[]): void {
  if (typeof window === 'undefined') return;
  for (const field of fields) {
    try {
      window.localStorage.removeItem(`projectManager.personal.channel.${channelId}.${field}`);
    } catch {
      /* ignore */
    }
  }
}

export function loadChannelSecrets(
  channel: ChannelConfig,
  secretFields: string[],
): Record<string, string> {
  return Object.fromEntries(
    secretFields.map((f) => [f, getChannelSecret(channel.id, f)]),
  );
}

export { DEFAULT_COMMAND_MAPPINGS };
export type { CommandAction };
