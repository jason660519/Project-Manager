import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { TerminalBlockSuggestion } from './types';
import { terminalBlockSuggestionsSidecarPath } from './terminalBlockSuggestions';

export function loadTerminalBlockSuggestionsSync(
  projectRoot: string,
  assistantId: string,
): TerminalBlockSuggestion[] {
  if (!projectRoot?.trim() || !assistantId?.trim()) return [];
  try {
    const path = terminalBlockSuggestionsSidecarPath(projectRoot, assistantId);
    if (!existsSync(path)) return [];
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as TerminalBlockSuggestion[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTerminalBlockSuggestionsSync(
  projectRoot: string,
  assistantId: string,
  suggestions: TerminalBlockSuggestion[],
): void {
  const trimmedRoot = projectRoot.trim();
  const trimmedId = assistantId.trim();
  if (!trimmedRoot || !trimmedId) return;
  const dir = join(trimmedRoot, '.project-manager', 'assistants', trimmedId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    terminalBlockSuggestionsSidecarPath(trimmedRoot, trimmedId),
    JSON.stringify(suggestions, null, 2),
  );
}

export function appendTerminalBlockSuggestionSync(
  projectRoot: string,
  assistantId: string,
  suggestion: TerminalBlockSuggestion,
): TerminalBlockSuggestion[] {
  const existing = loadTerminalBlockSuggestionsSync(projectRoot, assistantId);
  const duplicate = existing.some(
    (item) =>
      item.status === 'pending' &&
      item.normalizedCommand === suggestion.normalizedCommand &&
      item.reason === suggestion.reason,
  );
  if (duplicate) return existing;
  const next = [suggestion, ...existing].slice(0, 50);
  saveTerminalBlockSuggestionsSync(projectRoot, assistantId, next);
  return next;
}
