const commandAvailabilityCache = new Map<string, boolean>();

export function clearCommandExistsCache(): void {
  commandAvailabilityCache.clear();
}

export async function checkCommandExists(command: string): Promise<boolean> {
  const normalized = command.trim();
  if (!normalized) return false;

  const cached = commandAvailabilityCache.get(normalized);
  if (cached !== undefined) return cached;

  // Check if we are in Tauri runtime (frontend)
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const exists = await invoke<boolean>('check_command_exists', { command: normalized });
      commandAvailabilityCache.set(normalized, exists);
      return exists;
    } catch (err) {
      console.error('Tauri check_command_exists failed, falling back:', err);
    }
  }

  try {
    const { execFile } = await import('child_process');
    const exists = await new Promise<boolean>((resolve) => {
      execFile('/bin/sh', ['-lc', 'command -v -- "$1" >/dev/null 2>&1', 'sh', normalized], (error) => {
        resolve(!error);
      });
    });
    commandAvailabilityCache.set(normalized, exists);
    return exists;
  } catch {
    commandAvailabilityCache.set(normalized, true);
    return true;
  }
}
