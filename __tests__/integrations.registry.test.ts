import { describe, expect, it } from 'vitest';
import { registryFor } from '../lib/integrations/registry';

describe('integration registry runtime metadata', () => {
  it('uses the Project Manager OpenClaw gateway port', () => {
    const openclaw = registryFor('openclaw');

    expect(openclaw.port).toBe('18790');
    expect(openclaw.runtime?.dashboardUrl).toBe('http://127.0.0.1:18790/');
    expect(openclaw.runtime?.statePath).toBe('.project-manager/openclaw/state');
  });

  it('describes project-scoped Hermes lifecycle commands', () => {
    const hermes = registryFor('hermes-agent');

    expect(hermes.port).toBe('9119');
    expect(hermes.runtime?.dashboardUrl).toBe('http://127.0.0.1:9119');
    expect(hermes.runtime?.commands?.map((command) => command.id)).toEqual(
      expect.arrayContaining(['start-dashboard', 'doctor', 'install', 'update', 'rollback']),
    );
  });

  it('describes IDE Bridge as a project-scoped frontend bridge plugin', () => {
    const ideBridge = registryFor('ide-bridge');

    expect(ideBridge.company).toBe('Project Manager');
    expect(ideBridge.category1).toBe('Frontend Plugin');
    expect(ideBridge.category2).toBe('Native IDE Bridge');
    expect(ideBridge.scope).toBe('project');
    expect(ideBridge.installPathHint).toBe('app/ui/views/IdeBridgeView.tsx');
  });
});
