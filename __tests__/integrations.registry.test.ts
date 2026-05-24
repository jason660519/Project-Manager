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

  it('describes Monaco as a project-scoped frontend editor plugin', () => {
    const monaco = registryFor('monaco-editor');

    expect(monaco.company).toBe('Microsoft');
    expect(monaco.category1).toBe('Frontend Plugin');
    expect(monaco.scope).toBe('project');
    expect(monaco.githubUrl).toBe('https://github.com/microsoft/monaco-editor');
    expect(monaco.installPathHint).toBe('app/ui/views/MonacoEditorWorkbench.tsx');
  });
});
