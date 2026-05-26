import type { MemoryArtifactDef } from '../memory-catalog';
import type { IntegrationRow, IntegrationStatus } from '../types';

export interface MemoryScanResult {
  absPath: string;
  exists: boolean;
  modified: string;
  sizeBytes?: number;
}

export function mapMemoryRow(
  def: MemoryArtifactDef,
  projectRoot: string,
  scan?: MemoryScanResult,
): IntegrationRow {
  const absPath = projectRoot ? `${projectRoot.replace(/\/+$/, '')}/${def.relPath}` : def.relPath;
  const exists = scan?.exists ?? false;
  const status: IntegrationStatus = exists ? 'installed' : 'unavailable';
  const badges: string[] = exists ? ['On disk'] : ['Missing'];

  return {
    rowKey: `memory:${def.id}`,
    sheet: 'memory',
    sourceKind: 'memory',
    sourceId: def.id,
    enabled: exists,
    category1: 'Memory',
    category2: def.category2,
    githubUrl: '',
    company: def.company,
    name: def.name,
    version: '',
    license: '',
    scope: 'project',
    port: '',
    installPath: absPath,
    installMethod: 'local_file',
    status,
    statusLabel: exists ? 'Present' : 'Not found',
    lastUpdated: scan?.modified?.slice(0, 10) ?? '',
    notes: def.description,
    lv: null,
    badges,
    payload: { def, absPath, exists, sizeBytes: scan?.sizeBytes },
  };
}
