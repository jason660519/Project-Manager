import type { ChannelCatalog } from '../types/channels';
import type { Feature, FeatureStatus, ProjectEntry } from '../types';
import { getChannelSecret } from '../storage/channels';
import { getProjectsRepository } from '../storage';
import { type TelegramMessagePayload, spawnAgent, telegramSendMessage } from '../bridge';

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
  const targetId = args[0].toLowerCase();
  const projects = await getProjectsRepository().listProjects();

  let match: { project: ProjectEntry; feature: Feature } | null = null;
  for (const p of projects) {
    const f = p.config.features.find((x) => x.id.toLowerCase() === targetId);
    if (f) {
      match = { project: p, feature: f };
      break;
    }
  }
  if (!match) return `Feature "${args[0]}" not found in any project.`;

  const agents = match.project.config.adapters.agents;
  if (agents.length === 0) {
    return `${match.project.config.project.name} has no agents configured. Add one in Plugins → Marketplace.`;
  }
  const agent = agents[0];
  const root = match.project.config.project.root;
  const prompt =
    `[Telegram /run] 請繼續開發 [${match.feature.id}] ${match.feature.name}。\n` +
    `目前進度：${match.feature.progress}%\n` +
    `實作路徑：${match.feature.paths.implementation ?? '未指定'}` +
    (match.feature.notes ? `\n備註：${match.feature.notes}` : '');

  const finalArgs = agent.argsTemplate.map((a) =>
    a
      .replaceAll('{prompt}', prompt)
      .replaceAll('{featureId}', match!.feature.id)
      .replaceAll('{root}', root),
  );

  try {
    const { pid } = await spawnAgent({
      command: agent.command,
      args: finalArgs,
      workingDir: root,
    });
    return `✅ Dispatched [${match.feature.id}] ${match.feature.name} to ${agent.name} (PID ${pid}).\nCheck Logs view in the desktop app for live output.`;
  } catch (e) {
    return `Failed to dispatch: ${e}`;
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

  const enabled = catalog.commandMappings.filter((m) => m.enabled);
  const parts = msg.text.trim().split(/\s+/);
  const firstToken = (parts[0] ?? '').toLowerCase();
  const cmdArgs = parts.slice(1);
  const matched = enabled.find((m) => m.trigger.toLowerCase() === firstToken);

  let reply: string;
  if (!matched) {
    reply = `Unknown command "${firstToken}". Try /help to see what's available.`;
  } else {
    try {
      switch (matched.action) {
        case 'help':
          reply =
            'Project Manager commands:\n' +
            enabled.map((m) => `${m.trigger} — ${m.description}`).join('\n');
          break;
        case 'get_status':
          reply = await handleStatusCommand(cmdArgs);
          break;
        case 'daily_report':
          reply = await handleReportCommand();
          break;
        case 'run_feature':
          reply = await handleRunCommand(cmdArgs);
          break;
        default:
          reply = `Action "${matched.action}" not implemented yet.`;
      }
    } catch (e) {
      reply = `Command failed: ${e}`;
    }
  }

  try {
    await telegramSendMessage(botToken, msg.chatId, reply);
  } catch {
    /* swallow — surface in UI later */
  }
}
