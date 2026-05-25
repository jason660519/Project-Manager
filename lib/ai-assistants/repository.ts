'use client';

import { createDefaultConsoleState } from './defaults';
import type {
  AIAssistantConfig,
  AIAssistantsConsoleState,
  AssistantAuditEvent,
  AssistantInstanceConfig,
  AssistantPermissionRule,
  AssistantProfileSource,
  AssistantSkillConfig,
} from './types';

const STORAGE_KEY = 'projectManager:ai-assistants-console:v1';

export function loadAIAssistantsConsoleState(): AIAssistantsConsoleState {
  if (typeof window === 'undefined') return createDefaultConsoleState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultConsoleState();
    const parsed = JSON.parse(raw) as AIAssistantsConsoleState;
    if (!parsed.assistants?.length) return createDefaultConsoleState();
    return parsed;
  } catch {
    return createDefaultConsoleState();
  }
}

export function saveAIAssistantsConsoleState(state: AIAssistantsConsoleState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function appendAuditEvent(
  assistant: AIAssistantConfig,
  event: Omit<AssistantAuditEvent, 'id' | 'timestamp'>,
): AIAssistantConfig {
  return {
    ...assistant,
    auditEvents: [
      {
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        ...event,
      },
      ...assistant.auditEvents,
    ].slice(0, 100),
    updatedAt: new Date().toISOString(),
  };
}

export function updateAssistant(
  state: AIAssistantsConsoleState,
  assistantId: string,
  updater: (assistant: AIAssistantConfig) => AIAssistantConfig,
): AIAssistantsConsoleState {
  return {
    ...state,
    assistants: state.assistants.map((assistant) =>
      assistant.id === assistantId ? updater(assistant) : assistant,
    ),
  };
}

export function updateAssistantInstance(
  assistant: AIAssistantConfig,
  instance: AssistantInstanceConfig,
): AIAssistantConfig {
  return appendAuditEvent(
    {
      ...assistant,
      status: instance.connectionStatus,
      instance,
      updatedAt: new Date().toISOString(),
    },
    {
      actor: 'user',
      action: 'Updated assistant instance configuration',
      target: instance.id,
      risk: instance.gatewayTokenStatus === 'configured' ? 'medium' : 'low',
      outcome: 'recorded',
    },
  );
}

export function updateProfileSource(
  assistant: AIAssistantConfig,
  source: AssistantProfileSource,
): AIAssistantConfig {
  return appendAuditEvent(
    {
      ...assistant,
      profileSources: assistant.profileSources.map((item) =>
        item.kind === source.kind ? source : item,
      ),
      updatedAt: new Date().toISOString(),
    },
    {
      actor: 'user',
      action: `Updated profile source ${source.label}`,
      target: source.path,
      risk: source.readOnly ? 'high' : 'medium',
      outcome: source.readOnly ? 'blocked' : 'requires-review',
    },
  );
}

export function updateSkill(
  assistant: AIAssistantConfig,
  skill: AssistantSkillConfig,
): AIAssistantConfig {
  return appendAuditEvent(
    {
      ...assistant,
      skills: assistant.skills.map((item) => (item.id === skill.id ? skill : item)),
      updatedAt: new Date().toISOString(),
    },
    {
      actor: 'user',
      action: `${skill.enabled ? 'Enabled' : 'Disabled'} skill ${skill.name}`,
      target: skill.id,
      risk: skill.risk,
      outcome: skill.risk === 'high' && skill.enabled ? 'requires-review' : 'recorded',
    },
  );
}

export function updatePermission(
  assistant: AIAssistantConfig,
  permission: AssistantPermissionRule,
): AIAssistantConfig {
  return appendAuditEvent(
    {
      ...assistant,
      permissions: assistant.permissions.map((item) =>
        item.id === permission.id ? permission : item,
      ),
      updatedAt: new Date().toISOString(),
    },
    {
      actor: 'user',
      action: `Set permission ${permission.scope} to ${permission.state}`,
      target: permission.id,
      risk: permission.risk,
      outcome: permission.risk === 'high' ? 'requires-review' : 'recorded',
    },
  );
}
