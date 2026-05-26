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

  it('describes new built-in MCP servers', () => {
    const exa = registryFor('mcp-exa');
    const context7 = registryFor('mcp-context7');
    const grepApp = registryFor('mcp-grep-app');

    expect(exa.company).toBe('Exa Labs');
    expect(exa.category2).toBe('Web Search');
    expect(exa.scope).toBe('network');

    expect(context7.company).toBe('Upstash');
    expect(context7.category2).toBe('Documentation');
    expect(context7.scope).toBe('network');

    expect(grepApp.company).toBe('Grep.app');
    expect(grepApp.category2).toBe('Code Search');
    expect(grepApp.scope).toBe('network');
  });

});
