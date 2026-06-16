import type { TelegramPollStatus } from '../../bridge';
import type { ChannelConfig, ChannelPlatform, CommandMapping } from '../../types/channels';
import type { IntegrationRow, IntegrationStatus } from '../types';
import type { ProjectWorkflowExecutorRegistry } from '../../project-workflows';

const PLATFORM_LABELS: Record<ChannelPlatform, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  line: 'LINE',
  wechat: 'WeChat Work',
};

function pollStatusLabel(status?: TelegramPollStatus): { status: IntegrationStatus; statusLabel: string; badges: string[] } {
  const badges: string[] = [];
  if (!status) {
    return { status: 'idle', statusLabel: 'Not polling', badges };
  }
  if (status.status.phase === 'polling') {
    return { status: 'running', statusLabel: 'Polling', badges: ['Active'] };
  }
  if (status.status.phase === 'errored') {
    return { status: 'warning', statusLabel: 'Error', badges };
  }
  return { status: 'stopped', statusLabel: 'Stopped', badges };
}

export function mapChannelRow(
  channel: ChannelConfig,
  pollStatuses: Map<string, TelegramPollStatus>,
  hasBotToken: boolean,
): IntegrationRow {
  const poll = channel.platform === 'telegram' ? pollStatuses.get(channel.id) : undefined;
  const { status, statusLabel, badges } = pollStatusLabel(poll);
  const mergedBadges = [...badges];
  if (hasBotToken) mergedBadges.push('Token set');
  if (channel.webhookMode === 'polling') mergedBadges.push('Polling mode');
  else mergedBadges.push('Webhook mode');

  return {
    rowKey: `channels:${channel.id}`,
    sheet: 'channels',
    sourceKind: 'channel',
    sourceId: channel.id,
    enabled: channel.enabled,
    category1: 'Channels',
    category2: PLATFORM_LABELS[channel.platform],
    githubUrl: '',
    company: PLATFORM_LABELS[channel.platform],
    name: channel.label,
    version: '',
    license: '',
    scope: 'network',
    port: '',
    installPath: channel.credentials.relayUrl ?? '',
    installMethod: channel.webhookMode === 'polling' ? 'poll' : 'webhook',
    status: channel.enabled ? (hasBotToken ? status : 'warning') : 'stopped',
    statusLabel: channel.enabled ? statusLabel : 'Disabled',
    lastUpdated: '',
    notes: '',
    lv: null,
    badges: mergedBadges,
    payload: { channel },
  };
}

export function mapCommandMappingRow(mapping: CommandMapping): IntegrationRow {
  const badges: string[] = [mapping.action];
  if (mapping.executor?.capabilityId) badges.push(mapping.executor.capabilityId);
  return {
    rowKey: `channels:cmd:${mapping.id}`,
    sheet: 'channels',
    sourceKind: 'command-mapping',
    sourceId: mapping.id,
    enabled: mapping.enabled,
    category1: 'Channels',
    category2: 'Command Mapping',
    githubUrl: '',
    company: 'Project Manager',
    name: mapping.trigger,
    version: '',
    license: '',
    scope: 'project',
    port: '',
    installPath: '',
    installMethod: 'local_file',
    status: mapping.enabled ? 'connected' : 'stopped',
    statusLabel: mapping.enabled ? 'Active' : 'Off',
    lastUpdated: '',
    notes: mapping.description,
    lv: null,
    badges,
    payload: { mapping },
  };
}

export function buildExecutorRegistryFromCommandMappings(
  mappings: CommandMapping[],
): ProjectWorkflowExecutorRegistry {
  return mappings.reduce<ProjectWorkflowExecutorRegistry>((registry, mapping) => {
    const executor = mapping.executor;
    const command = executor?.command;
    const commandName = command?.command.trim() ?? '';
    const capabilityId = executor?.capabilityId.trim() ?? '';
    if (!mapping.enabled || !executor || !command || !commandName || !capabilityId) {
      return registry;
    }

    registry[capabilityId] = {
      state: 'resolved',
      executionState: executor.executionState === 'live_command_allowed' ? 'live_command_allowed' : 'dry_run_only',
      integrationSheet: 'commands',
      sourceKind: 'command-mapping',
      sourceId: mapping.id,
      label: executor.label?.trim() || mapping.description.trim() || mapping.trigger,
      commandPreview: executor.commandPreview?.trim() || [commandName, ...command.args].join(' '),
      command: {
        command: commandName,
        args: command.args,
      },
      safetyNotice: executor.safetyNotice?.trim()
        || 'Dry-run executor candidate only; Project Manager has not executed this command.',
    };
    return registry;
  }, {});
}
