/** Human-readable secret-storage label for Settings / Keys UI. */
export function formatSecretsStorageLabel(backend: string, tauri: boolean): string {
  if (!tauri) return 'localStorage';
  if (backend.startsWith('dev-file')) {
    return 'Dev file (~/.project-manager/dev-secrets.json)';
  }
  return 'macOS Keychain';
}

export function secretsStorageUsesDevFile(backend: string): boolean {
  return backend.startsWith('dev-file');
}
