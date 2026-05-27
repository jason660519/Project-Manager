import type { ConnectedInstanceScanSnapshot } from '../mappers/connected-instances';
import {
  buildConnectedInstanceRows,
  buildScannedConnectedInstanceRows,
} from '../mappers/connected-instances';
import type { IntegrationRow } from '../types';

export interface DiscoveryInstanceLine {
  name: string;
  detail: string;
  scanMethod: string;
}

export interface DiscoveryRunSummary {
  scannedAt: string;
  durationMs: number;
  deviceCount: number;
  containerCount: number;
  serviceCount: number;
  warningCount: number;
  totalDiscovered: number;
  ok: boolean;
  /** Configured / seeded rows before this scan. */
  existingInstanceCount: number;
  existingInstances: DiscoveryInstanceLine[];
  /** Rows newly added to the inventory table from this snapshot. */
  newInstanceCount: number;
  newInstances: DiscoveryInstanceLine[];
  /** Probe hits that matched an existing instance (not added again). */
  skippedAsExistingCount: number;
  skippedAsExisting: DiscoveryInstanceLine[];
}

function toLine(row: IntegrationRow): DiscoveryInstanceLine {
  return {
    name: row.name,
    detail: row.installPath || row.port || '—',
    scanMethod: row.installMethod || '—',
  };
}

function deviceAlreadyKnown(
  ip: string,
  existingRows: IntegrationRow[],
): IntegrationRow | undefined {
  return existingRows.find(
    (row) =>
      row.installPath === ip ||
      row.installPath.includes(ip) ||
      stringPayload(row.payload.ipAddress) === ip,
  );
}

function stringPayload(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function skippedDeviceLines(
  snapshot: ConnectedInstanceScanSnapshot,
  existingRows: IntegrationRow[],
): DiscoveryInstanceLine[] {
  const lines: DiscoveryInstanceLine[] = [];
  for (const device of snapshot.devices) {
    const match = deviceAlreadyKnown(device.ipAddress, existingRows);
    if (!match) continue;
    lines.push({
      name: match.name,
      detail: device.hostname
        ? `${device.hostname} (${device.ipAddress})`
        : device.ipAddress,
      scanMethod: device.source,
    });
  }
  return lines;
}

export function summarizeDiscoverySnapshot(
  snapshot: ConnectedInstanceScanSnapshot,
  durationMs: number,
  seededRows?: IntegrationRow[],
): DiscoveryRunSummary {
  const existingRows = seededRows ?? buildConnectedInstanceRows(null);
  const existingInstances = existingRows.map(toLine);

  const newRows = buildScannedConnectedInstanceRows(snapshot, existingRows);
  const newInstances = newRows.map(toLine);
  const skippedAsExisting = skippedDeviceLines(snapshot, existingRows);

  const deviceCount = snapshot.devices.length;
  const containerCount = snapshot.containers.length;
  const serviceCount = snapshot.services.length;
  const warningCount = snapshot.warnings.length;
  const totalDiscovered = deviceCount + containerCount + serviceCount;

  return {
    scannedAt: snapshot.scannedAt,
    durationMs,
    deviceCount,
    containerCount,
    serviceCount,
    warningCount,
    totalDiscovered,
    ok: totalDiscovered > 0,
    existingInstanceCount: existingInstances.length,
    existingInstances,
    newInstanceCount: newInstances.length,
    newInstances,
    skippedAsExistingCount: skippedAsExisting.length,
    skippedAsExisting,
  };
}
