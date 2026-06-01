import type {
  TerminalCommandRule,
  TerminalOperationalBoundaries,
  TerminalCommandListKind,
} from './types';

const NOW = '2026-05-26T00:00:00.000Z';

export const DEFAULT_TERMINAL_WHITELIST: TerminalCommandRule[] = [
  {
    id: 'wl-pwd',
    pattern: 'pwd',
    description: 'Print working directory for project-root verification.',
    category: 'inspection',
    listKind: 'whitelist',
  },
  {
    id: 'wl-git-status',
    pattern: 'git status --short',
    description: 'Read-only repository status snapshot.',
    category: 'version-control',
    listKind: 'whitelist',
  },
  {
    id: 'wl-git-branch',
    pattern: 'git branch --show-current',
    description: 'Resolve active branch without mutating refs.',
    category: 'version-control',
    listKind: 'whitelist',
  },
  {
    id: 'wl-npm-run',
    pattern: 'npm run <script>',
    description: 'Run package scripts defined in package.json (typecheck, test, build).',
    category: 'build',
    listKind: 'whitelist',
  },
  {
    id: 'wl-cargo-check',
    pattern: 'cargo check',
    description: 'Compile-check Rust workspace without producing release artifacts.',
    category: 'build',
    listKind: 'whitelist',
  },
  {
    id: 'wl-rg',
    pattern: 'rg <pattern>',
    description: 'Search codebase with ripgrep; read-only file access.',
    category: 'inspection',
    listKind: 'whitelist',
  },
  {
    id: 'wl-cmux-version',
    pattern: 'cmux --version',
    description: 'Read cmux version for xmux interoperability checks.',
    category: 'inspection',
    listKind: 'whitelist',
  },
  {
    id: 'wl-cmux-workspaces',
    pattern: 'cmux list-workspaces',
    description: 'List cmux workspaces without mutating layout.',
    category: 'inspection',
    listKind: 'whitelist',
  },
];

export const DEFAULT_TERMINAL_BLACKLIST: TerminalCommandRule[] = [
  {
    id: 'bl-rm-rf',
    pattern: 'rm -rf *',
    description: 'Recursive forced deletion of files or directories.',
    category: 'destructive',
    listKind: 'blacklist',
  },
  {
    id: 'bl-sudo',
    pattern: 'sudo *',
    description: 'Privilege escalation or root-context execution.',
    category: 'privilege',
    listKind: 'blacklist',
  },
  {
    id: 'bl-chmod',
    pattern: 'chmod *',
    description: 'Permission mutation on files, directories, or executables.',
    category: 'privilege',
    listKind: 'blacklist',
  },
  {
    id: 'bl-curl-pipe',
    pattern: 'curl * | *',
    description: 'Remote script fetch piped into shell interpreter.',
    category: 'exfiltration',
    listKind: 'blacklist',
  },
  {
    id: 'bl-env-dump',
    pattern: 'env | *',
    description: 'Environment variable dump that may expose secrets.',
    category: 'exfiltration',
    listKind: 'blacklist',
  },
  {
    id: 'bl-ssh-key',
    pattern: 'cat ~/.ssh/*',
    description: 'Read private key material from user home directory.',
    category: 'credential-theft',
    listKind: 'blacklist',
  },
  {
    id: 'bl-git-destructive',
    pattern: 'git push --force',
    description: 'Force-push that can rewrite shared branch history.',
    category: 'destructive',
    listKind: 'blacklist',
  },
  {
    id: 'bl-git-reset-hard',
    pattern: 'git reset --hard',
    description: 'Discard uncommitted work and move HEAD destructively.',
    category: 'destructive',
    listKind: 'blacklist',
  },
];

export interface TerminalEvaluationResult {
  decision: 'allowed' | 'blocked' | 'unknown';
  reason?: string;
  matchedRuleId?: string;
  blockedSegment?: string;
}

export interface TerminalExecSpec {
  command: string;
  args: string[];
}

const EXACT_EXEC: Record<string, TerminalExecSpec> = {
  pwd: { command: 'pwd', args: [] },
  'git status --short': { command: 'git', args: ['status', '--short'] },
  'git branch --show-current': { command: 'git', args: ['branch', '--show-current'] },
  'cargo check': { command: 'cargo', args: ['check'] },
  'cmux --version': { command: 'cmux', args: ['--version'] },
  'cmux list-workspaces': { command: 'cmux', args: ['list-workspaces'] },
};

export function createDefaultTerminalBoundaries(): TerminalOperationalBoundaries {
  return {
    policyMode: 'default-deny',
    whitelist: DEFAULT_TERMINAL_WHITELIST,
    blacklist: DEFAULT_TERMINAL_BLACKLIST,
    updatedAt: NOW,
  };
}

export function normalizeTerminalCommand(command: string): string {
  return command.trim().replace(/\s+/g, ' ');
}

/** Split compound shell strings on ; && || | (no quote-aware parser). */
export function splitCompoundCommand(command: string): string[] {
  const normalized = normalizeTerminalCommand(command);
  if (!normalized) return [];
  return normalized
    .split(/\s*(?:;|&&|\|\||\|)\s*/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function matchesPattern(pattern: string, input: string): boolean {
  if (pattern.includes('<')) {
    const prefix = pattern.split('<')[0]?.trim();
    return prefix ? input.startsWith(prefix) : false;
  }
  if (pattern.endsWith(' *')) {
    return input.startsWith(pattern.slice(0, -2));
  }
  return input === pattern || input.startsWith(`${pattern} `);
}

function findMatchingRule(
  input: string,
  rules: TerminalCommandRule[],
): TerminalCommandRule | undefined {
  return rules.find((rule) => matchesPattern(rule.pattern, input));
}

function evaluateSegment(
  segment: string,
  boundaries: TerminalOperationalBoundaries,
  blacklistOnly: boolean,
): TerminalEvaluationResult {
  const normalized = normalizeTerminalCommand(segment);
  if (!normalized) {
    return { decision: 'unknown', reason: 'empty_command' };
  }

  const blackHit = findMatchingRule(normalized, boundaries.blacklist);
  if (blackHit) {
    return {
      decision: 'blocked',
      reason: 'blacklist',
      matchedRuleId: blackHit.id,
      blockedSegment: normalized,
    };
  }

  if (blacklistOnly) {
    return { decision: 'allowed', reason: 'blacklist_only_pass' };
  }

  const whiteHit = findMatchingRule(normalized, boundaries.whitelist);
  if (whiteHit) {
    return {
      decision: 'allowed',
      reason: 'whitelist',
      matchedRuleId: whiteHit.id,
    };
  }

  if (boundaries.policyMode === 'default-deny') {
    return {
      decision: 'blocked',
      reason: 'default_deny',
      blockedSegment: normalized,
    };
  }

  return { decision: 'unknown', reason: 'not_listed', blockedSegment: normalized };
}

export function evaluateTerminalCommandDetailed(
  command: string,
  boundaries: TerminalOperationalBoundaries,
  options?: { blacklistOnly?: boolean },
): TerminalEvaluationResult {
  const blacklistOnly = options?.blacklistOnly === true;
  const segments = splitCompoundCommand(command);
  if (segments.length === 0) {
    return { decision: 'unknown', reason: 'empty_command' };
  }

  for (const segment of segments) {
    const result = evaluateSegment(segment, boundaries, blacklistOnly);
    if (result.decision !== 'allowed') {
      return result;
    }
  }

  return { decision: 'allowed', reason: blacklistOnly ? 'blacklist_only_pass' : 'whitelist' };
}

export function evaluateTerminalCommand(
  command: string,
  boundaries: TerminalOperationalBoundaries,
  options?: { blacklistOnly?: boolean },
): 'allowed' | 'blocked' | 'unknown' {
  return evaluateTerminalCommandDetailed(command, boundaries, options).decision;
}

export function parseAllowedCommandForExec(normalized: string): TerminalExecSpec | null {
  const input = normalizeTerminalCommand(normalized);
  if (EXACT_EXEC[input]) return EXACT_EXEC[input];

  if (input.startsWith('npm run ')) {
    const script = input.slice('npm run '.length).trim();
    if (!script || /\s/.test(script)) return null;
    return { command: 'npm', args: ['run', script] };
  }

  if (input.startsWith('rg ')) {
    const pattern = input.slice(3).trim();
    if (!pattern) return null;
    return { command: 'rg', args: pattern.split(/\s+/) };
  }

  return null;
}

export function rulesFromPatterns(
  patterns: string[],
  listKind: TerminalCommandListKind,
  category = 'custom',
): TerminalCommandRule[] {
  return patterns
    .map((line) => line.trim())
    .filter(Boolean)
    .map((pattern, index) => ({
      id: `${listKind === 'whitelist' ? 'wl' : 'bl'}-custom-${index}-${pattern.slice(0, 12).replace(/\W/g, '')}`,
      pattern,
      description: `Custom ${listKind} rule.`,
      category,
      listKind,
    }));
}

export function mergeBoundaryRules(
  existing: TerminalCommandRule[],
  patterns: string[],
  listKind: TerminalCommandListKind,
): TerminalCommandRule[] {
  const byPattern = new Map(existing.map((rule) => [rule.pattern, rule]));
  return patterns
    .map((line) => line.trim())
    .filter(Boolean)
    .map((pattern, index) => {
      const prior = byPattern.get(pattern);
      if (prior) return prior;
      return {
        id: `${listKind === 'whitelist' ? 'wl' : 'bl'}-custom-${Date.now()}-${index}`,
        pattern,
        description: `Custom ${listKind} rule.`,
        category: 'custom',
        listKind,
      };
    });
}
