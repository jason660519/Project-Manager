import type { ProjectEntry } from '../types';

export type MobileRemoteRunRequestResult =
  | {
      state: 'needs_confirmation';
      featureId: string;
      featureName: string;
      projectName: string;
      agentName: string;
      command: string;
      argsTemplate: string[];
      workingDir: string;
    }
  | {
      state: 'not_found' | 'missing_agent';
      message: string;
    };

export function prepareFeatureRunRequest(
  featureId: string,
  projects: ProjectEntry[],
): MobileRemoteRunRequestResult {
  const targetId = featureId.toLowerCase();

  let match: ProjectEntry | null = null;
  let feature = null;
  for (const project of projects) {
    const found = project.config.features.find((item) => item.id.toLowerCase() === targetId);
    if (found) {
      match = project;
      feature = found;
      break;
    }
  }

  if (!match || !feature) {
    return {
      state: 'not_found',
      message: `Feature "${featureId}" not found in any project.`,
    };
  }

  const agent = match.config.adapters.agents[0];
  if (!agent) {
    return {
      state: 'missing_agent',
      message: `${match.config.project.name} has no agents configured. Add one in Plugins -> Marketplace.`,
    };
  }

  return {
    state: 'needs_confirmation',
    featureId: feature.id,
    featureName: feature.name,
    projectName: match.config.project.name,
    agentName: agent.name,
    command: agent.command,
    argsTemplate: agent.argsTemplate,
    workingDir: match.config.project.root,
  };
}

export function formatFeatureRunRequestReply(result: MobileRemoteRunRequestResult): string {
  if (result.state !== 'needs_confirmation') return result.message;

  return [
    `Guarded run request prepared for [${result.featureId}] ${result.featureName}.`,
    `Project: ${result.projectName}`,
    `Agent: ${result.agentName}`,
    `Command: ${result.command}`,
    `Arguments template: ${result.argsTemplate.join(' ') || '(none)'}`,
    `Working directory: ${result.workingDir}`,
    '',
    'Mobile / channel requests do not start local agents directly yet.',
    'Open Project Manager Desktop to review and approve the run.',
  ].join('\n');
}
