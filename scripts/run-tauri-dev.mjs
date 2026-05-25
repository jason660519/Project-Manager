#!/usr/bin/env node

import { spawn } from 'node:child_process';

const useKeychain = process.argv.includes('--keychain');
const env = {
  ...process.env,
  PM_DEV_PLAINTEXT_SECRETS: useKeychain ? '0' : '1',
};

const command = process.platform === 'win32' ? 'tauri.cmd' : 'tauri';
const label = useKeychain
  ? 'macOS Keychain / OS credential store'
  : '~/.project-manager/dev-secrets.json';

console.log(`Starting tauri dev with secret backend: ${label}`);

const child = spawn(command, ['dev'], {
  env,
  stdio: 'inherit',
  shell: false,
});

child.on('error', (err) => {
  console.error(`Failed to start tauri dev: ${err.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`tauri dev exited via signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});
