import type { IntegrationRow } from '../types';

export type ConnectedInstanceKind =
  | 'local-app'
  | 'local-sidecar'
  | 'intranet-host'
  | 'intranet-service'
  | 'cloud-instance';

export type ConnectedInstanceAccessType = 'filesystem' | 'http' | 'ssh' | 'websocket' | 'api' | 'vpn';

export interface ConnectedInstanceDefinition {
  id: string;
  name: string;
  instanceKind: ConnectedInstanceKind;
  category1: string;
  category2: string;
  company: string;
  scope: IntegrationRow['scope'];
  accessType: ConnectedInstanceAccessType;
  address: string;
  port?: string;
  statusLabel: string;
  capabilities: string[];
  services: string[];
  owner: string;
  risk: string;
  discoverySource: string;
  notes: string;
}

export interface ConnectedInstanceScannedDevice {
  id: string;
  ipAddress: string;
  macAddress?: string;
  hostname?: string;
  vendor?: string;
  interfaceName?: string;
  source: 'arp' | 'nmap' | 'mdns';
  confidence: 'low' | 'medium' | 'high';
  lastSeenAt: string;
}

export interface ConnectedInstanceScannedContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: string[];
  source: 'docker';
  lastSeenAt: string;
}

export interface ConnectedInstanceScannedService {
  id: string;
  name: string;
  serviceType: string;
  domain?: string;
  source: 'bonjour' | 'mdns';
  confidence: 'low' | 'medium' | 'high';
  lastSeenAt: string;
}

export interface ConnectedInstanceScanSnapshot {
  scannedAt: string;
  devices: ConnectedInstanceScannedDevice[];
  containers: ConnectedInstanceScannedContainer[];
  services: ConnectedInstanceScannedService[];
  warnings: string[];
}

export const CONNECTED_INSTANCE_DEFINITIONS: readonly ConnectedInstanceDefinition[] = [
  {
    id: 'project-manager-local',
    name: 'Project Manager Local Runtime',
    instanceKind: 'local-app',
    category1: 'Local Runtime',
    category2: 'Desktop App',
    company: 'Project Manager',
    scope: 'project',
    accessType: 'filesystem',
    address: '/Volumes/KLEVV-4T-1/Project-Manager',
    statusLabel: 'Configured',
    capabilities: ['Next.js', 'Tauri', 'agent dispatch', 'project files'],
    services: ['Project Manager'],
    owner: 'user',
    risk: 'local project scope',
    discoverySource: 'project config',
    notes: 'Canonical local checkout and execution context for this Project Manager instance.',
  },
  {
    id: 'hermes-local-dashboard',
    name: 'Hermes Agent Dashboard',
    instanceKind: 'local-sidecar',
    category1: 'Local Sidecar',
    category2: 'Agent Runtime',
    company: 'Hermes',
    scope: 'project',
    accessType: 'http',
    address: 'http://127.0.0.1:9119',
    port: '9119',
    statusLabel: 'Configured',
    capabilities: ['agent runtime', 'dashboard', 'project-scoped state'],
    services: ['Hermes Agent'],
    owner: 'user',
    risk: 'loopback only',
    discoverySource: 'launcher defaults',
    notes: 'Project-scoped Hermes dashboard endpoint opened by the Project Manager launcher.',
  },
  {
    id: 'openclaw-local-dashboard',
    name: 'OpenClaw Dashboard',
    instanceKind: 'local-sidecar',
    category1: 'Local Sidecar',
    category2: 'Gateway',
    company: 'OpenClaw',
    scope: 'project',
    accessType: 'http',
    address: 'http://127.0.0.1:18790/',
    port: '18790',
    statusLabel: 'Configured',
    capabilities: ['gateway', 'instances reference', 'agent bridge'],
    services: ['OpenClaw'],
    owner: 'user',
    risk: 'loopback only',
    discoverySource: 'launcher defaults',
    notes: 'Project Manager reserves port 18790 for its repo-local OpenClaw gateway.',
  },
  {
    id: 'living-room-server',
    name: 'Living Room Server',
    instanceKind: 'intranet-host',
    category1: 'Intranet Compute',
    category2: 'Host',
    company: 'User Hardware',
    scope: 'intranet',
    accessType: 'ssh',
    address: 'rick@192.168.1.6',
    statusLabel: 'Known',
    capabilities: ['CPU/GPU host', 'Docker services', 'local models', 'media generation'],
    services: ['Ollama', 'Open WebUI', 'ComfyUI'],
    owner: 'user',
    risk: 'private LAN address',
    discoverySource: 'launcher defaults',
    notes: 'User-owned intranet server that exposes model and image-generation services.',
  },
  {
    id: 'living-room-ollama',
    name: 'Ollama API',
    instanceKind: 'intranet-service',
    category1: 'Intranet Service',
    category2: 'Model API',
    company: 'Ollama',
    scope: 'intranet',
    accessType: 'api',
    address: 'http://192.168.1.6:11434/',
    port: '11434',
    statusLabel: 'Configured',
    capabilities: ['local LLM inference', 'model hosting'],
    services: ['Ollama'],
    owner: 'user',
    risk: 'private LAN API endpoint',
    discoverySource: 'launcher defaults',
    notes: 'Ollama API endpoint on the living room server; health is not live-probed in this MVP.',
  },
  {
    id: 'living-room-open-webui',
    name: 'Open WebUI',
    instanceKind: 'intranet-service',
    category1: 'Intranet Service',
    category2: 'Model UI',
    company: 'Open WebUI',
    scope: 'intranet',
    accessType: 'http',
    address: 'http://192.168.1.6:38457/',
    port: '38457',
    statusLabel: 'Configured',
    capabilities: ['model chat UI', 'Ollama frontend'],
    services: ['Open WebUI', 'Ollama'],
    owner: 'user',
    risk: 'private LAN web endpoint',
    discoverySource: 'launcher defaults',
    notes: 'Browser UI for local model usage on the intranet server.',
  },
  {
    id: 'living-room-comfyui',
    name: 'ComfyUI',
    instanceKind: 'intranet-service',
    category1: 'Intranet Service',
    category2: 'Image Generation',
    company: 'ComfyUI',
    scope: 'intranet',
    accessType: 'http',
    address: 'http://192.168.1.6:30000/',
    port: '30000',
    statusLabel: 'Configured',
    capabilities: ['image generation', 'GPU workflows'],
    services: ['ComfyUI'],
    owner: 'user',
    risk: 'private LAN web endpoint',
    discoverySource: 'launcher defaults',
    notes: 'Image-generation workflow UI on the living room server.',
  },
];

export function mapConnectedInstanceRow(def: ConnectedInstanceDefinition): IntegrationRow {
  return {
    rowKey: `connected-instances:${def.id}`,
    sheet: 'connected-instances',
    sourceKind: 'connected-instance',
    sourceId: def.id,
    enabled: true,
    category1: def.category1,
    category2: def.category2,
    githubUrl: '',
    company: def.company,
    name: def.name,
    version: '',
    license: '',
    scope: def.scope,
    port: def.port ?? '',
    installPath: def.address,
    installMethod: 'remote_url',
    status: 'idle',
    statusLabel: def.statusLabel,
    lastUpdated: '2026-05-24',
    notes: def.notes,
    lv: null,
    badges: [def.accessType, def.risk, ...def.services].slice(0, 5),
    payload: {
      instanceKind: def.instanceKind,
      owner: def.owner,
      accessType: def.accessType,
      capabilities: def.capabilities,
      services: def.services,
      risk: def.risk,
      discoverySource: def.discoverySource,
      credentialBoundary: 'Credentials are not stored in connected instance rows.',
    },
  };
}

export function mapScannedDeviceRow(device: ConnectedInstanceScannedDevice): IntegrationRow {
  const address = device.hostname ? `${device.hostname} (${device.ipAddress})` : device.ipAddress;
  return {
    rowKey: `connected-instances:scan:device:${device.id}`,
    sheet: 'connected-instances',
    sourceKind: 'connected-instance',
    sourceId: `scan-device-${device.id}`,
    enabled: false,
    category1: 'Network Discovery',
    category2: 'Observed Host',
    githubUrl: '',
    company: device.vendor || 'Unknown Vendor',
    name: device.hostname || `LAN Device ${device.ipAddress}`,
    version: '',
    license: '',
    scope: 'intranet',
    port: '',
    installPath: address,
    installMethod: 'remote_url',
    status: 'warning',
    statusLabel: 'Observed',
    lastUpdated: device.lastSeenAt.slice(0, 10),
    notes: 'Auto-discovered LAN device. Review before promoting to a trusted connected instance.',
    lv: null,
    badges: [device.source, device.confidence, device.macAddress ? 'mac' : 'ip-only'].filter(Boolean),
    payload: {
      instanceKind: 'intranet-host',
      owner: 'unverified',
      accessType: 'api',
      capabilities: [],
      services: [],
      risk: 'auto-discovered private LAN device',
      discoverySource: device.source,
      approvalState: 'pending',
      confidence: device.confidence,
      ipAddress: device.ipAddress,
      macAddress: device.macAddress ?? '',
      hostname: device.hostname ?? '',
      vendor: device.vendor ?? '',
      interfaceName: device.interfaceName ?? '',
      lastSeenAt: device.lastSeenAt,
      credentialBoundary: 'Credentials are not stored in connected instance rows.',
    },
  };
}

export function mapScannedContainerRow(container: ConnectedInstanceScannedContainer): IntegrationRow {
  const primaryPort = container.ports[0] ?? '';
  const isRunning = container.state.toLowerCase() === 'running';
  return {
    rowKey: `connected-instances:scan:container:${container.id}`,
    sheet: 'connected-instances',
    sourceKind: 'connected-instance',
    sourceId: `scan-container-${container.id}`,
    enabled: false,
    category1: 'Local Runtime',
    category2: 'Docker Container',
    githubUrl: '',
    company: 'Docker',
    name: container.name,
    version: container.image,
    license: '',
    scope: 'project',
    port: primaryPort,
    installPath: `docker://${container.id}`,
    installMethod: 'system_path',
    status: isRunning ? 'running' : 'stopped',
    statusLabel: container.status || container.state,
    lastUpdated: container.lastSeenAt.slice(0, 10),
    notes: 'Auto-discovered local Docker container. Published ports are observed from Docker metadata.',
    lv: null,
    badges: ['docker', container.state, ...container.ports].slice(0, 5),
    payload: {
      instanceKind: 'local-sidecar',
      owner: 'user',
      accessType: 'api',
      capabilities: [],
      services: [container.name],
      risk: 'local Docker runtime metadata',
      discoverySource: container.source,
      approvalState: 'observed',
      containerId: container.id,
      image: container.image,
      state: container.state,
      status: container.status,
      ports: container.ports,
      lastSeenAt: container.lastSeenAt,
      credentialBoundary: 'Docker credentials and socket paths are not stored in connected instance rows.',
    },
  };
}

export function mapScannedServiceRow(service: ConnectedInstanceScannedService): IntegrationRow {
  return {
    rowKey: `connected-instances:scan:service:${service.id}`,
    sheet: 'connected-instances',
    sourceKind: 'connected-instance',
    sourceId: `scan-service-${service.id}`,
    enabled: false,
    category1: 'Network Discovery',
    category2: 'Bonjour Service',
    githubUrl: '',
    company: 'Bonjour',
    name: service.name,
    version: '',
    license: '',
    scope: 'intranet',
    port: '',
    installPath: service.domain ? `${service.serviceType}.${service.domain}` : service.serviceType,
    installMethod: 'remote_url',
    status: 'warning',
    statusLabel: 'Observed',
    lastUpdated: service.lastSeenAt.slice(0, 10),
    notes: 'Auto-discovered Bonjour/mDNS service. Resolve and review before promotion.',
    lv: null,
    badges: [service.source, service.confidence, service.serviceType].slice(0, 5),
    payload: {
      instanceKind: 'intranet-service',
      owner: 'unverified',
      accessType: 'api',
      capabilities: [],
      services: [service.serviceType],
      risk: 'auto-discovered local network service',
      discoverySource: service.source,
      approvalState: 'pending',
      confidence: service.confidence,
      serviceType: service.serviceType,
      domain: service.domain ?? '',
      lastSeenAt: service.lastSeenAt,
      credentialBoundary: 'Credentials are not stored in connected instance rows.',
    },
  };
}

export function buildScannedConnectedInstanceRows(
  snapshot?: ConnectedInstanceScanSnapshot | null,
  existingRows: IntegrationRow[] = [],
): IntegrationRow[] {
  if (!snapshot) return [];
  const knownAddresses = new Set(
    existingRows.flatMap((row) => {
      const values = [row.installPath];
      const ip = stringPayload(row.payload.ipAddress);
      if (ip) values.push(ip);
      return values;
    }),
  );

  const rows: IntegrationRow[] = [];
  for (const device of snapshot.devices) {
    if (knownAddresses.has(device.ipAddress) || [...knownAddresses].some((addr) => addr.includes(device.ipAddress))) {
      continue;
    }
    rows.push(mapScannedDeviceRow(device));
  }
  rows.push(...snapshot.containers.map(mapScannedContainerRow));
  rows.push(...snapshot.services.map(mapScannedServiceRow));
  return rows;
}

export function buildConnectedInstanceRows(snapshot?: ConnectedInstanceScanSnapshot | null): IntegrationRow[] {
  const seeded = CONNECTED_INSTANCE_DEFINITIONS.map(mapConnectedInstanceRow);
  return [...seeded, ...buildScannedConnectedInstanceRows(snapshot, seeded)];
}

export function connectedInstanceSearchText(row: IntegrationRow): string {
  const values = [
    row.name,
    row.company,
    row.category1,
    row.category2,
    row.installPath,
    row.port,
    row.scope,
    row.statusLabel,
    row.notes,
    ...row.badges,
    ...asStringArray(row.payload.capabilities),
    ...asStringArray(row.payload.services),
    stringPayload(row.payload.owner),
    stringPayload(row.payload.accessType),
    stringPayload(row.payload.risk),
    stringPayload(row.payload.discoverySource),
  ];
  return values.filter(Boolean).join(' ').toLowerCase();
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function stringPayload(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
