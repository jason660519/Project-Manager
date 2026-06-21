export type BackendProfileMode =
  | 'local-files'
  | 'local-docker-supabase'
  | 'self-hosted-supabase'
  | 'supabase-cloud';

export interface BackendProfileInput {
  id?: string;
  label?: string;
  mode: BackendProfileMode;
  enabled?: boolean;
  url?: string;
  anonKeyRef?: string;
  anonKey?: string;
  serviceRoleKey?: string;
  jwtSecret?: string;
  databasePassword?: string;
}

export type NormalizedBackendProfile =
  | {
      id: string;
      label: string;
      mode: 'local-files';
      enabled: false;
    }
  | {
      id: string;
      label: string;
      mode: Exclude<BackendProfileMode, 'local-files'>;
      url: string;
      anonKeyRef: string;
    };

export type RendererSafeBackendProfile = NormalizedBackendProfile | {
  id: string;
  label: string;
  mode: Exclude<BackendProfileMode, 'local-files'>;
  url: string;
  anonKeyRef: string;
  anonKey?: string;
};

const DEFAULT_LABELS: Record<BackendProfileMode, string> = {
  'local-files': 'Local files',
  'local-docker-supabase': 'Local Docker Supabase',
  'self-hosted-supabase': 'Self-hosted Supabase',
  'supabase-cloud': 'Supabase Cloud',
};

const SECRET_KEYS = new Set(['serviceRoleKey', 'jwtSecret', 'databasePassword']);

export function normalizeBackendProfile(input: BackendProfileInput): NormalizedBackendProfile {
  if (input.mode === 'local-files') {
    return {
      id: input.id ?? 'local-files',
      label: input.label ?? DEFAULT_LABELS[input.mode],
      mode: 'local-files',
      enabled: false,
    };
  }

  const url = input.url?.trim().replace(/\/+$/, '');
  const anonKeyRef = input.anonKeyRef?.trim();
  if (!url || !anonKeyRef) {
    throw new Error(`${input.mode} backend profile requires url and anonKeyRef.`);
  }

  return {
    id: input.id ?? input.mode,
    label: input.label ?? DEFAULT_LABELS[input.mode],
    mode: input.mode,
    url,
    anonKeyRef,
  };
}

export function toRendererSafeBackendProfile(input: BackendProfileInput): RendererSafeBackendProfile {
  const normalized = normalizeBackendProfile(input);
  if (normalized.mode === 'local-files') {
    return normalized;
  }

  return {
    ...normalized,
    ...(input.anonKey ? { anonKey: input.anonKey } : {}),
  };
}

export function redactBackendProfileSecrets<T>(value: T): T {
  return redactValue(value, collectSecretValues(value)) as T;
}

function collectSecretValues(value: unknown): Set<string> {
  const secrets = new Set<string>();

  const visit = (current: unknown, key?: string): void => {
    if (typeof current === 'string') {
      if (key && SECRET_KEYS.has(key) && current.length > 0) {
        secrets.add(current);
      }
      return;
    }

    if (Array.isArray(current)) {
      current.forEach((item) => visit(item));
      return;
    }

    if (current && typeof current === 'object') {
      for (const [childKey, childValue] of Object.entries(current)) {
        visit(childValue, childKey);
      }
    }
  };

  visit(value);
  return secrets;
}

function redactValue(value: unknown, secrets: Set<string>, key?: string): unknown {
  if (typeof value === 'string') {
    if (key && SECRET_KEYS.has(key)) {
      return '[redacted]';
    }

    let redacted = value;
    for (const secret of secrets) {
      redacted = redacted.split(secret).join('[redacted]');
    }
    return redacted;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, secrets));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redactValue(childValue, secrets, childKey),
      ]),
    );
  }

  return value;
}
