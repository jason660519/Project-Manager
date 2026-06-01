import type { TerminalOperationalBoundaries } from './types';

export function terminalBoundariesSidecarPath(projectRoot: string, assistantId: string): string {
  const root = projectRoot.replace(/\/+$/, '');
  return `${root}/.project-manager/assistants/${assistantId}/terminal-boundaries.json`;
}

export async function saveTerminalBoundariesSidecar(
  projectRoot: string,
  assistantId: string,
  boundaries: TerminalOperationalBoundaries,
): Promise<void> {
  const trimmedRoot = projectRoot.trim();
  const trimmedId = assistantId.trim();
  if (!trimmedRoot || !trimmedId) {
    throw new Error('saveTerminalBoundariesSidecar: projectRoot and assistantId are required');
  }

  const payload = JSON.stringify(
    { ...boundaries, updatedAt: new Date().toISOString() },
    null,
    2,
  );

  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    const { writeFile } = await import('../bridge');
    await writeFile(terminalBoundariesSidecarPath(trimmedRoot, trimmedId), payload);
    return;
  }

  const res = await fetch('/api/assistants/terminal-boundaries', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectRoot: trimmedRoot, assistantId: trimmedId, boundaries: JSON.parse(payload) }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to save terminal boundaries (${res.status})`);
  }
}

export async function loadTerminalBoundariesSidecar(
  projectRoot: string,
  assistantId: string,
): Promise<TerminalOperationalBoundaries | null> {
  const trimmedRoot = projectRoot.trim();
  const trimmedId = assistantId.trim();
  if (!trimmedRoot || !trimmedId) return null;

  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const { readFile } = await import('../bridge');
      const raw = await readFile(terminalBoundariesSidecarPath(trimmedRoot, trimmedId));
      return JSON.parse(raw) as TerminalOperationalBoundaries;
    } catch {
      return null;
    }
  }

  const url = new URL('/api/assistants/terminal-boundaries', typeof window !== 'undefined' ? window.location.origin : 'http://localhost:43187');
  url.searchParams.set('projectRoot', trimmedRoot);
  url.searchParams.set('assistantId', trimmedId);
  const res = await fetch(url.toString());
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to load terminal boundaries (${res.status})`);
  }
  const body = (await res.json()) as { boundaries?: TerminalOperationalBoundaries };
  return body.boundaries ?? null;
}
