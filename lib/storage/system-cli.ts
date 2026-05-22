import {
  KEY_PERSONAL_AI_CLI_PRESET_ALLOWLIST,
  KEY_PERSONAL_SYSTEM_CLI_EXPOSURE,
} from './keys';

export type SystemCliExposureMap = Record<string, boolean>;

const DEFAULT_AI_CLI_PRESET_ALLOWLIST = [
  'claude',
  'codex',
  'gemini',
  'openclaw',
  'opencode',
  'aider',
  'mmdc',
  'gh',
  'pnpm',
  'yarn',
  'npm',
  'node',
  'python',
  'uv',
  'cargo',
  'go',
  'deno',
  'git',
  'rg',
];

function normalizedDefaultAllowlist(): string[] {
  return [...DEFAULT_AI_CLI_PRESET_ALLOWLIST].sort((a, b) => a.localeCompare(b));
}

function readExposureMap(): SystemCliExposureMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY_PERSONAL_SYSTEM_CLI_EXPOSURE);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: SystemCliExposureMap = {};
    for (const [command, enabled] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof command === 'string' && typeof enabled === 'boolean') {
        out[command] = enabled;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeExposureMap(map: SystemCliExposureMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY_PERSONAL_SYSTEM_CLI_EXPOSURE, JSON.stringify(map));
  } catch {
    // Ignore localStorage quota/privacy failures.
  }
}

export function loadSystemCliExposureMap(): SystemCliExposureMap {
  return readExposureMap();
}

export function setSystemCliExposed(command: string, exposed: boolean): void {
  const normalized = command.trim();
  if (!normalized) return;
  const current = readExposureMap();
  writeExposureMap({ ...current, [normalized]: exposed });
}

export function setSystemCliExposureMany(entries: SystemCliExposureMap): void {
  const sanitized: SystemCliExposureMap = {};
  for (const [command, exposed] of Object.entries(entries)) {
    const normalized = command.trim();
    if (!normalized) continue;
    sanitized[normalized] = exposed === true;
  }
  if (Object.keys(sanitized).length === 0) return;
  const current = readExposureMap();
  writeExposureMap({ ...current, ...sanitized });
}

export function listExposedSystemCliCommands(): string[] {
  const map = readExposureMap();
  return Object.entries(map)
    .filter(([, exposed]) => exposed)
    .map(([command]) => command)
    .sort((a, b) => a.localeCompare(b));
}

export function getAiCliPresetAllowlist(): string[] {
  if (typeof window === 'undefined') return [...DEFAULT_AI_CLI_PRESET_ALLOWLIST];
  try {
    const raw = window.localStorage.getItem(KEY_PERSONAL_AI_CLI_PRESET_ALLOWLIST);
    if (!raw) return normalizedDefaultAllowlist();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return normalizedDefaultAllowlist();
    const normalized = parsed
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter(Boolean);
    return normalized.length > 0 ? normalized : normalizedDefaultAllowlist();
  } catch {
    return normalizedDefaultAllowlist();
  }
}

export function setAiCliPresetAllowlist(commands: string[]): void {
  if (typeof window === 'undefined') return;
  const normalized = Array.from(
    new Set(commands.map((v) => v.trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  try {
    window.localStorage.setItem(
      KEY_PERSONAL_AI_CLI_PRESET_ALLOWLIST,
      JSON.stringify(normalized),
    );
  } catch {
    // Ignore localStorage quota/privacy failures.
  }
}

export function resetAiCliPresetAllowlist(): string[] {
  const defaults = normalizedDefaultAllowlist();
  setAiCliPresetAllowlist(defaults);
  return defaults;
}

export function exportAiCliPresetAllowlistJson(pretty = true): string {
  const allowlist = getAiCliPresetAllowlist();
  return JSON.stringify(allowlist, null, pretty ? 2 : 0);
}

export function importAiCliPresetAllowlistJson(raw: string): string[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Preset JSON must be an array of command strings.');
  }
  const commands = parsed
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean);
  if (commands.length === 0) {
    throw new Error('Preset JSON array is empty or contains no valid commands.');
  }
  setAiCliPresetAllowlist(commands);
  return getAiCliPresetAllowlist();
}

