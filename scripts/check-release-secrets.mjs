#!/usr/bin/env node

const raw = process.env.PM_DEV_PLAINTEXT_SECRETS ?? '';
const normalized = raw.trim().toLowerCase();
const devSecretsEnabled = ['1', 'true', 'yes'].includes(normalized);

if (devSecretsEnabled) {
  console.error(
    [
      'Refusing to build Project Manager release with PM_DEV_PLAINTEXT_SECRETS enabled.',
      '',
      'Release builds must use the OS Keychain secret backend.',
      'Unset PM_DEV_PLAINTEXT_SECRETS or set PM_DEV_PLAINTEXT_SECRETS=0, then run npm run tauri:build again.',
    ].join('\n'),
  );
  process.exit(1);
}

console.log('Release secret backend guard passed: packaged builds will use OS Keychain.');
