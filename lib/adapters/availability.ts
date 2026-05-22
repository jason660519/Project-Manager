const commandAvailabilityCache = new Map<string, boolean>();
const commandPreflightCache = new Map<string, CommandAvailability>();

export type CommandAvailabilityStatus = 'available' | 'missing' | 'unknown';

export interface CommandAvailability {
  status: CommandAvailabilityStatus;
  canVerify: boolean;
}

export function clearCommandExistsCache(): void {
  commandAvailabilityCache.clear();
  commandPreflightCache.clear();
}

export async function checkCommandExists(command: string): Promise<boolean> {
  const availability = await checkCommandAvailability(command);
  return availability.status !== 'missing';
}

export async function checkCommandAvailability(command: string): Promise<CommandAvailability> {
  const normalized = command.trim();
  if (!normalized) return { status: 'missing', canVerify: true };

  const cached = commandPreflightCache.get(normalized);
  if (cached !== undefined) return cached;

  // Check if we are in Tauri runtime (frontend)
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const exists = await invoke<boolean>('check_command_exists', { command: normalized });
      const availability: CommandAvailability = {
        status: exists ? 'available' : 'missing',
        canVerify: true,
      };
      commandPreflightCache.set(normalized, availability);
      commandAvailabilityCache.set(normalized, exists);
      return availability;
    } catch (err) {
      console.error('Tauri check_command_exists failed, falling back:', err);
    }
  }

  const unknown: CommandAvailability = { status: 'unknown', canVerify: false };
  commandPreflightCache.set(normalized, unknown);
  commandAvailabilityCache.set(normalized, true);
  return unknown;
}
