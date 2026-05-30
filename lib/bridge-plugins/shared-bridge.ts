export interface BridgeCapability {
  id: string;
  app: string;
  direction: 'inbound' | 'outbound';
  transport: 'http' | 'file' | 'stdio';
  version: string;
}

const CAPABILITIES: BridgeCapability[] = [
  {
    id: 'openclaw.agent.dispatch',
    app: 'openclaw',
    direction: 'inbound',
    transport: 'http',
    version: '0.1.0',
  },
  {
    id: 'realestate.task.export',
    app: 'realestate',
    direction: 'inbound',
    transport: 'http',
    version: '0.1.0',
  },
];

let registeredCapabilities: BridgeCapability[] = [];

export function registerAllCapabilities(): readonly BridgeCapability[] {
  registeredCapabilities = [...CAPABILITIES];
  return registeredCapabilities;
}

export function listCapabilitiesByApp(app: string): readonly BridgeCapability[] {
  const normalizedApp = app.trim().toLowerCase();
  const source = registeredCapabilities.length > 0 ? registeredCapabilities : CAPABILITIES;
  return source.filter((capability) => capability.app === normalizedApp);
}

export interface OpenClawDispatchRequest {
  prompt: string;
  projectRoot?: string;
  metadata?: Record<string, unknown>;
}

export interface OpenClawDispatchResponse {
  ok: boolean;
  runId?: string;
  error?: string;
}

export class OpenClawBridge {
  constructor(private readonly baseUrl: string) {}

  async dispatchAgent(request: OpenClawDispatchRequest): Promise<OpenClawDispatchResponse> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/agent/dispatch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      return { ok: false, error: `OpenClaw gateway returned HTTP ${response.status}` };
    }

    return (await response.json()) as OpenClawDispatchResponse;
  }
}
