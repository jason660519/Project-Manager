import { existsSync, readFileSync } from 'fs';
import { join as joinPath } from 'path';
import type { TerminalOperationalBoundaries } from './types';
import { createDefaultTerminalBoundaries } from './terminalBoundaries';

function isSafeAssistantId(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function terminalBoundariesSidecarPath(projectRoot: string, assistantId: string): string {
  if (!isSafeAssistantId(assistantId)) {
    throw new Error('Invalid assistantId');
  }
  return joinPath(projectRoot, '.project-manager', 'assistants', assistantId, 'terminal-boundaries.json');
}

export function loadTerminalBoundariesSidecarSync(
  projectRoot: string,
  assistantId: string,
): TerminalOperationalBoundaries | null {
  if (!projectRoot?.trim() || !assistantId?.trim() || !isSafeAssistantId(assistantId.trim())) return null;
  try {
    const path = terminalBoundariesSidecarPath(projectRoot, assistantId);
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as TerminalOperationalBoundaries;
    if (!parsed?.whitelist || !parsed?.blacklist || !parsed?.policyMode) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function resolveTerminalBoundaries(
  projectRoot?: string,
  assistantId?: string,
  override?: TerminalOperationalBoundaries,
): TerminalOperationalBoundaries {
  if (override) return override;
  if (projectRoot && assistantId) {
    const sidecar = loadTerminalBoundariesSidecarSync(projectRoot, assistantId);
    if (sidecar) return sidecar;
  }
  return createDefaultTerminalBoundaries();
}
