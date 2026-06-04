import type { ChannelCatalog } from '../types/channels';
import type { Feature, FeatureStatus } from '../types';
import { getChannelSecret } from '../storage/channels';
import { getProjectsRepository } from '../storage';
import { type TelegramMessagePayload, telegramSendMessage } from '../bridge';
import { parseMobileRemoteIntent } from '../mobileRemote/intents';
import {
  formatFeatureRunRequestReply,
  prepareFeatureRunRequest,
} from '../mobileRemote/runRequests';
import {
  appendMobileRemoteAuditEvent,
  policyDecisionFromParse,
  resultStateFromPolicy,
} from '../mobileRemote/audit';
import { appendMobileRemoteApproval } from '../mobileRemote/approvalQueue';

function countByStatus(features: Feature[]): Record<FeatureStatus, number> {
  const counts: Record<FeatureStatus, number> = {
    todo: 0,
    in_progress: 0,
    done: 0,
    on_hold: 0,
  };
  for (const f of features) counts[f.status]++;
  return counts;
}

async function handleStatusCommand(args: string[]): Promise<string> {
  const projects = await getProjectsRepository().listProjects();
  if (projects.length === 0) {
    return 'No projects configured. Add one in the Dashboard Projects sheet first.';
  }

  if (args.length === 0) {
    const lines: string[] = ['Projects:'];
    for (const p of projects) {
      const counts = countByStatus(p.config.features);
      lines.push(
        `• ${p.config.project.name} — ${counts.in_progress} in_progress · ${counts.done} done · ${counts.todo} todo`,
      );
    }
    lines.push('', 'Send /status <project name> for a feature breakdown.');
    return lines.join('\n');
  }

  const query = args.join(' ').toLowerCase();
  const proj =
    projects.find((p) => p.config.project.name.toLowerCase() === query) ??
    projects.find((p) => p.id.toLowerCase() === query) ??
    projects.find((p) => p.config.project.name.toLowerCase().includes(query));
  if (!proj) return `Project "${args.join(' ')}" not found.`;

  const counts = countByStatus(proj.config.features);
  const inProgress = proj.config.features
    .filter((f) => f.status === 'in_progress')
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 8);

  const lines: string[] = [
    `${proj.config.project.name}:`,
    `${counts.in_progress} in_progress · ${counts.done} done · ${counts.todo} todo · ${counts.on_hold} on_hold`,
  ];
  if (inProgress.length > 0) {
    lines.push('', 'In progress:');
    for (const f of inProgress) {
      lines.push(`• [${f.id}] ${f.name} — ${f.progress}%`);
    }
  }
  return lines.join('\n');
}

async function handleReportCommand(): Promise<string> {
  const projects = await getProjectsRepository().listProjects();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

  type Entry = { project: string; feature: Feature };
  const recent: Entry[] = [];
  for (const p of projects) {
    for (const f of p.config.features) {
      if (!f.updatedAt) continue;
      if (new Date(f.updatedAt).getTime() >= cutoff) {
        recent.push({ project: p.config.project.name, feature: f });
      }
    }
  }
  if (recent.length === 0) {
    return 'No feature updates in the last 7 days.';
  }

  recent.sort(
    (a, b) =>
      new Date(b.feature.updatedAt ?? 0).getTime() -
      new Date(a.feature.updatedAt ?? 0).getTime(),
  );

  const lines: string[] = ['Last 7 days:'];
  let currentProject = '';
  for (const r of recent.slice(0, 20)) {
    if (r.project !== currentProject) {
      currentProject = r.project;
      lines.push('', `${currentProject}:`);
    }
    const date = (r.feature.updatedAt ?? '').slice(0, 10);
    lines.push(
      `• ${date} [${r.feature.id}] ${r.feature.name} — ${r.feature.status} ${r.feature.progress}%`,
    );
  }
  if (recent.length > 20) {
    lines.push('', `… +${recent.length - 20} more`);
  }
  return lines.join('\n');
}

async function handleRunCommand(args: string[]): Promise<string> {
  if (args.length === 0) {
    return 'Usage: /run <featureId>\nExample: /run F18';
  }
  const parsed = parseMobileRemoteIntent(`/run ${args.join(' ')}`);
  if (parsed.status === 'blocked') {
    return `Blocked: ${parsed.reason}`;
  }
  if (parsed.status !== 'parsed' || parsed.intent?.type !== 'run_feature') {
    return parsed.reason ?? 'Run requests need a feature id.';
  }

  const projects = await getProjectsRepository().listProjects();
  return formatFeatureRunRequestReply(
    prepareFeatureRunRequest(parsed.intent.featureId, projects),
  );
}

export async function resolveTelegramCommandReply(
  messageText: string,
  catalog: ChannelCatalog,
): Promise<string> {
  const enabled = catalog.commandMappings.filter((m) => m.enabled);
  const parts = messageText.trim().split(/\s+/);
  const firstToken = (parts[0] ?? '').toLowerCase();
  const cmdArgs = parts.slice(1);
  const matched = enabled.find((m) => m.trigger.toLowerCase() === firstToken);

  if (!matched) {
    return `Unknown command "${firstToken}". Try /help to see what's available.`;
  }

  try {
    switch (matched.action) {
      case 'help':
        return (
          'Project Manager commands:\n' +
          enabled.map((m) => `${m.trigger} — ${m.description}`).join('\n')
        );
      case 'get_status':
        return handleStatusCommand(cmdArgs);
      case 'daily_report':
        return handleReportCommand();
      case 'run_feature':
        return handleRunCommand(cmdArgs);
      default:
        return `Action "${matched.action}" not implemented yet.`;
    }
  } catch (e) {
    return `Command failed: ${e}`;
  }
}

/**
 * Resolve an inbound message against the catalog's command mappings and post
 * a reply through the Telegram bridge. Silent no-op when the bot token can't
 * be read or `telegramSendMessage` rejects (e.g. running outside Tauri).
 */
export async function routeTelegramCommand(
  msg: TelegramMessagePayload,
  catalog: ChannelCatalog,
): Promise<void> {
  const channel = catalog.channels.find((c) => c.id === msg.channelId);
  if (!channel) return;
  const botToken = getChannelSecret(channel.id, 'botToken');
  if (!botToken) return;

  const reply = await resolveTelegramCommandReply(msg.text, catalog);
  const parsed = parseMobileRemoteIntent(msg.text);
  const policyDecision = policyDecisionFromParse({
    parseStatus: parsed.status,
    intent: parsed.intent,
  });
  appendMobileRemoteAuditEvent({
    deviceId: `telegram:${msg.channelId}:${msg.chatId}`,
    channel: 'telegram',
    rawInputKind: 'text',
    rawInput: msg.text,
    parseStatus: parsed.status,
    intent: parsed.intent,
    policyDecision,
    resultState: resultStateFromPolicy(policyDecision),
    responsePreview: reply.slice(0, 500),
    errorMessage: parsed.reason,
  });
  if (
    policyDecision === 'guarded' &&
    (parsed.intent?.type === 'run_feature' || parsed.intent?.type === 'run_gate')
  ) {
    appendMobileRemoteApproval({
      source: 'telegram',
      deviceId: `telegram:${msg.channelId}:${msg.chatId}`,
      rawInput: msg.text,
      intent: parsed.intent,
      responsePreview: reply.slice(0, 1000),
    });
  }

  try {
    await telegramSendMessage(botToken, msg.chatId, reply);
  } catch {
    /* swallow — surface in UI later */
  }
}
