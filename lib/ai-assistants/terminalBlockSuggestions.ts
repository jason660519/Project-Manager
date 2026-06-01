import type { TerminalBlockSuggestion } from './types';

export function terminalBlockSuggestionsSidecarPath(projectRoot: string, assistantId: string): string {
  const root = projectRoot.replace(/\/+$/, '');
  return `${root}/.project-manager/assistants/${assistantId}/terminal-block-suggestions.json`;
}

export function createTerminalBlockSuggestion(input: {
  command: string;
  reason?: string;
  matchedRuleId?: string;
  blockedSegment?: string;
  source?: TerminalBlockSuggestion['source'];
}): TerminalBlockSuggestion {
  const normalized = input.command.trim().replace(/\s+/g, ' ');
  return {
    id: `tbs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    command: input.command,
    normalizedCommand: normalized,
    reason: input.reason ?? 'default_deny',
    matchedRuleId: input.matchedRuleId,
    blockedSegment: input.blockedSegment,
    status: 'pending',
    createdAt: new Date().toISOString(),
    source: input.source ?? 'tool_executor',
  };
}

export function updateTerminalBlockSuggestionStatus(
  suggestions: TerminalBlockSuggestion[],
  suggestionId: string,
  status: TerminalBlockSuggestion['status'],
): TerminalBlockSuggestion[] {
  return suggestions.map((item) =>
    item.id === suggestionId ? { ...item, status, reviewedAt: new Date().toISOString() } : item,
  );
}

export async function loadTerminalBlockSuggestions(
  projectRoot: string,
  assistantId: string,
): Promise<TerminalBlockSuggestion[]> {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const { readFile } = await import('../bridge');
      const raw = await readFile(terminalBlockSuggestionsSidecarPath(projectRoot, assistantId));
      const parsed = JSON.parse(raw) as TerminalBlockSuggestion[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  const url = new URL('/api/assistants/terminal-block-suggestions', window.location.origin);
  url.searchParams.set('projectRoot', projectRoot);
  url.searchParams.set('assistantId', assistantId);
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const body = (await res.json()) as { suggestions?: TerminalBlockSuggestion[] };
  return body.suggestions ?? [];
}

export async function saveTerminalBlockSuggestions(
  projectRoot: string,
  assistantId: string,
  suggestions: TerminalBlockSuggestion[],
): Promise<void> {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    const { writeFile } = await import('../bridge');
    await writeFile(
      terminalBlockSuggestionsSidecarPath(projectRoot, assistantId),
      JSON.stringify(suggestions, null, 2),
    );
    return;
  }

  const res = await fetch('/api/assistants/terminal-block-suggestions', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectRoot, assistantId, suggestions }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to save block suggestions (${res.status})`);
  }
}
