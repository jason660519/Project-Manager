const commandAvailabilityCache = new Map<string, boolean>();
const commandPreflightCache = new Map<string, CommandAvailability>();

export type CommandAvailabilityStatus = 'available' | 'missing' | 'blocked' | 'unknown';

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
  if (cached) return cached;

  // Check if we are in Tauri runtime (frontend)
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const baseName = normalized.split(/[\\/]/).pop() || normalized;
      const inventory = await invoke<Array<{ command: string }>>('list_global_cli_inventory');
      const isSystemCli = inventory.some((entry) => entry.command === baseName);
      if (isSystemCli) {
        let exposed = false;
        try {
          const raw = window.localStorage.getItem('projectManager.personal.systemCliExposure');
          if (raw) {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            exposed = parsed?.[baseName] === true;
          }
        } catch {
          exposed = false;
        }
        if (!exposed) {
          return { status: 'blocked', canVerify: true };
        }
      }

      const exists = await invoke<boolean>('check_command_exists', { command: normalized });
      const availability: CommandAvailability = {
        status: exists ? 'available' : 'missing',
        canVerify: true,
      };
      commandPreflightCache.set(normalized, availability);
      commandAvailabilityCache.set(normalized, exists);
      return availability;
    } catch (err) {
      console.error('Tauri check_command_exists failed:', err);

      // Tauri runtime can verify command availability, but this check failed
      // transiently. Do not cache this state so later calls can retry.
      return { status: 'unknown', canVerify: true };
    }
  }

  const unknown: CommandAvailability = { status: 'unknown', canVerify: false };
  commandPreflightCache.set(normalized, unknown);
  commandAvailabilityCache.set(normalized, true);
  return unknown;
}