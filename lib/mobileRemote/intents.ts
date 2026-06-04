export type MobileRemoteGate =
  | 'typecheck'
  | 'docs_check'
  | 'standards_check'
  | 'verify_baseline';

export type MobileRemoteIntent =
  | { type: 'help' }
  | { type: 'get_project_status'; projectId?: string; projectName?: string }
  | { type: 'get_feature_status'; featureId: string; projectId?: string }
  | { type: 'daily_report'; projectId?: string; rangeDays: number }
  | { type: 'run_feature'; featureId: string; projectId?: string; mode: 'dry_run' | 'live' }
  | { type: 'run_gate'; gate: MobileRemoteGate; projectId?: string }
  | { type: 'stop_run'; runId?: string; spawnToken?: number };

export type MobileRemoteParseStatus =
  | 'parsed'
  | 'needs_clarification'
  | 'blocked'
  | 'empty'
  | 'unsupported';

export interface MobileRemoteParseResult {
  status: MobileRemoteParseStatus;
  rawInput: string;
  normalizedInput: string;
  intent?: MobileRemoteIntent;
  reason?: string;
}

const FEATURE_ID_PATTERN = /\bF\d+\b/i;
const DANGEROUS_COMMAND_PATTERN =
  /\b(rm\s+-rf|sudo|chmod\s+777|chown|mkfs|dd\s+if=|curl\b.*\|\s*(sh|bash)|wget\b.*\|\s*(sh|bash)|delete\s+(my\s+)?project\s+folder|erase\s+(my\s+)?project)\b/i;

const GATE_ALIASES: Array<[MobileRemoteGate, RegExp]> = [
  ['verify_baseline', /\b(verify(:?baseline)?|verification|baseline)\b/i],
  ['typecheck', /\b(typecheck|type\s+check|tsc)\b/i],
  ['docs_check', /\b(docs?:?check|docs?\s+check|documentation\s+check)\b/i],
  ['standards_check', /\b(standards?:?check|standards?\s+check)\b/i],
];

function normalizeInput(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

function extractFeatureId(input: string): string | null {
  const match = FEATURE_ID_PATTERN.exec(input);
  return match ? match[0].toUpperCase() : null;
}

function resolveGate(input: string): MobileRemoteGate | null {
  for (const [gate, pattern] of GATE_ALIASES) {
    if (pattern.test(input)) return gate;
  }
  return null;
}

function isRunRequest(input: string): boolean {
  return /\b(run|start|dispatch|execute)\b/i.test(input);
}

function isStopRequest(input: string): boolean {
  return /\b(stop|cancel|kill)\b/i.test(input) && /\b(run|task|agent|process|current)\b/i.test(input);
}

function isReportRequest(input: string): boolean {
  return /\b(report|summary|daily|today|yesterday|week)\b/i.test(input);
}

function reportRangeDays(input: string): number {
  if (/\b(today|daily)\b/i.test(input)) return 1;
  if (/\b(yesterday)\b/i.test(input)) return 2;
  return 7;
}

function isStatusRequest(input: string): boolean {
  return /\b(status|progress|how\s+is|how's|what\s+changed|state)\b/i.test(input);
}

function projectNameFromStatus(input: string): string | undefined {
  const match = /\b(?:status|progress)\s+(?:for|of)\s+(.+)$/i.exec(input);
  return match?.[1]?.trim() || undefined;
}

export function parseMobileRemoteIntent(rawInput: string): MobileRemoteParseResult {
  const normalizedInput = normalizeInput(rawInput);
  if (!normalizedInput) {
    return {
      status: 'empty',
      rawInput,
      normalizedInput,
      reason: 'No transcript or command text was provided.',
    };
  }

  if (DANGEROUS_COMMAND_PATTERN.test(normalizedInput)) {
    return {
      status: 'blocked',
      rawInput,
      normalizedInput,
      reason: 'Mobile remote control does not accept destructive shell-like commands.',
    };
  }

  if (/^\/?help$/i.test(normalizedInput) || /\b(help|commands?)\b/i.test(normalizedInput)) {
    return {
      status: 'parsed',
      rawInput,
      normalizedInput,
      intent: { type: 'help' },
    };
  }

  if (isStopRequest(normalizedInput)) {
    return {
      status: 'parsed',
      rawInput,
      normalizedInput,
      intent: { type: 'stop_run' },
    };
  }

  const featureId = extractFeatureId(normalizedInput);
  const gate = resolveGate(normalizedInput);

  if (isRunRequest(normalizedInput)) {
    if (gate) {
      return {
        status: 'parsed',
        rawInput,
        normalizedInput,
        intent: { type: 'run_gate', gate },
      };
    }
    if (featureId) {
      return {
        status: 'parsed',
        rawInput,
        normalizedInput,
        intent: { type: 'run_feature', featureId, mode: 'dry_run' },
      };
    }
    return {
      status: 'needs_clarification',
      rawInput,
      normalizedInput,
      reason: 'Run requests need a feature id or a known gate name.',
    };
  }

  if (featureId && isStatusRequest(normalizedInput)) {
    return {
      status: 'parsed',
      rawInput,
      normalizedInput,
      intent: { type: 'get_feature_status', featureId },
    };
  }

  if (isReportRequest(normalizedInput)) {
    return {
      status: 'parsed',
      rawInput,
      normalizedInput,
      intent: { type: 'daily_report', rangeDays: reportRangeDays(normalizedInput) },
    };
  }

  if (isStatusRequest(normalizedInput)) {
    return {
      status: 'parsed',
      rawInput,
      normalizedInput,
      intent: {
        type: 'get_project_status',
        projectName: projectNameFromStatus(normalizedInput),
      },
    };
  }

  if (featureId) {
    return {
      status: 'needs_clarification',
      rawInput,
      normalizedInput,
      reason: `Feature ${featureId} was mentioned, but the requested action is unclear.`,
    };
  }

  return {
    status: 'unsupported',
    rawInput,
    normalizedInput,
    reason: 'Command is not in the mobile remote control intent allowlist.',
  };
}
