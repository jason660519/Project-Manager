const commandAvailabilityCache = new Map<string, boolean>();

export function clearCommandExistsCache(): void {
  commandAvailabilityCache.clear();
}

export async function checkCommandExists(command: string): Promise<boolean> {
  const normalized = command.trim();
  if (!normalized) return false;

  const cached = commandAvailabilityCache.get(normalized);
  if (cached !== undefined) return cached;

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
