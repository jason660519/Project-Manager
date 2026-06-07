import type { LucideIcon } from 'lucide-react';
import { FileCheck2, Languages } from 'lucide-react';

export type StandardsGateId = 'i18n' | 'docs';

export type GateRunPhase = 'idle' | 'running' | 'pass' | 'fail' | 'skipped' | 'blocked';

export interface GateRunAllProgress {
  active: boolean;
  currentLabel?: string;
  index: number;
  total: number;
}

export type StandardsGateTone = 'emerald' | 'cyan' | 'amber';

export interface StandardsGateDefinition {
  id: StandardsGateId;
  label: string;
  catalogStatus: string;
  statusTone: StandardsGateTone;
  /** npm script name; null when the gate is display-only (advisory). */
  npmScript: string | null;
  displayCommand: string;
  scope: string;
  detail: string;
  tags: string[];
  blocking: boolean;
  iconKey: 'languages' | 'clipboard' | 'fileCheck' | 'triangle';
}

export interface GateSpawnInvocation {
  command: string;
  args: string[];
}

const GATE_ICON_MAP: Record<StandardsGateDefinition['iconKey'], LucideIcon> = {
  languages: Languages,
  fileCheck: FileCheck2,
  clipboard: FileCheck2,
  triangle: FileCheck2,
};

export const STANDARDS_GATES_REGISTRY: readonly StandardsGateDefinition[] = [
  {
    id: 'i18n',
    label: 'UI i18n hardcoded-copy gate',
    catalogStatus: 'Active',
    statusTone: 'emerald',
    npmScript: 'i18n:check',
    displayCommand: 'npm run i18n:check',
    scope: 'Project Manager local',
    detail:
      'Scans Keys Arena UI files for hardcoded CJK copy so visible strings stay in lib/i18n translations.',
    tags: ['Arena scope', 'visible copy', 'blocking'],
    blocking: true,
    iconKey: 'languages',
  },
  {
    id: 'docs',
    label: 'Documentation governance',
    catalogStatus: 'Active',
    statusTone: 'cyan',
    npmScript: 'docs:check',
    displayCommand: 'npm run docs:check',
    scope: 'Repo documentation',
    detail:
      'Keeps public/internal docs, naming, bilingual layout, and source-of-truth placement aligned with PM rules.',
    tags: ['docs layout', 'naming', 'public guide'],
    blocking: true,
    iconKey: 'fileCheck',
  },
] as const;

export function gateFeatureId(gateId: StandardsGateId): string {
  return `gate:${gateId}`;
}

export function getStandardsGate(id: string): StandardsGateDefinition {
  const gate = STANDARDS_GATES_REGISTRY.find((g) => g.id === id);
  if (!gate) {
    throw new Error(`Unknown standards gate id: ${id}`);
  }
  return gate;
}

export function getBlockingGatesInOrder(): StandardsGateDefinition[] {
  return STANDARDS_GATES_REGISTRY.filter((g) => g.blocking);
}

export function getGateInvocation(gateId: StandardsGateId): GateSpawnInvocation {
  const gate = getStandardsGate(gateId);
  if (!gate.npmScript) {
    throw new Error(`Gate "${gateId}" has no npm script invocation`);
  }
  return { command: 'npm', args: ['run', gate.npmScript] };
}

export function formatGateNpmCommand(gate: StandardsGateDefinition): string {
  if (!gate.npmScript) return gate.displayCommand;
  return `npm run ${gate.npmScript}`;
}

export function resolveGateIcon(iconKey: StandardsGateDefinition['iconKey']): LucideIcon {
  return GATE_ICON_MAP[iconKey];
}

export function isRunnableGate(gate: StandardsGateDefinition): boolean {
  return gate.npmScript !== null;
}
