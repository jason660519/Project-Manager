#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

const currentBranch = git(['branch', '--show-current']);
const localBranches = git(['branch', '--format=%(refname:short) %(upstream:track)'])
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [name, ...trackParts] = line.split(' ');
    return { name, track: trackParts.join(' ') };
  });

let remoteHeads = [];
try {
  remoteHeads = git(['ls-remote', '--heads', 'origin'])
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('refs/heads/')[1])
    .filter(Boolean);
} catch (err) {
  console.warn(`Could not inspect origin heads: ${err instanceof Error ? err.message : String(err)}`);
}

const failures = [];
const warnings = [];

if (currentBranch !== 'main' && !currentBranch.startsWith('codex/')) {
  warnings.push(`current branch is ${currentBranch}; expected main or codex/* for active Project Manager work`);
}

const goneBranches = localBranches.filter((branch) => branch.track.includes('gone'));
for (const branch of goneBranches) {
  warnings.push(`local branch ${branch.name} tracks a removed remote branch`);
}

const deprecatedNamePattern = /coding-editor|monaco|legacy|old-dashboard|old-sheets/i;
for (const branch of localBranches) {
  if (deprecatedNamePattern.test(branch.name)) {
    failures.push(`deprecated local branch name found: ${branch.name}`);
  }
}
for (const branch of remoteHeads) {
  if (deprecatedNamePattern.test(branch)) {
    failures.push(`deprecated remote branch name found on origin: ${branch}`);
  }
}

const allowedRemoteHeads = new Set(['main']);
for (const branch of remoteHeads) {
  if (!allowedRemoteHeads.has(branch) && !branch.startsWith('codex/')) {
    warnings.push(`origin has non-standard branch ${branch}; confirm it is still active`);
  }
}

console.log(`Current branch: ${currentBranch || '(detached)'}`);
console.log(`Origin heads: ${remoteHeads.length ? remoteHeads.join(', ') : '(not available)'}`);

if (warnings.length > 0) {
  console.warn('Branch hygiene warnings:');
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (failures.length > 0) {
  console.error('Branch hygiene failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Branch hygiene check passed.');
