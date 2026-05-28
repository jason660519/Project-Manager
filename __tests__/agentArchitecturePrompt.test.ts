import { describe, expect, it } from 'vitest';

import { AGENT_ARCHITECTURE_PROMPT_BLOCK, engineerSystemPrompt } from '../lib/defaults/agentArchitecturePrompt';
import { DEFAULT_ENGINEER_ROLES } from '../lib/defaults/engineerRoles';

describe('agentArchitecturePrompt', () => {
  it('lists all eight modules in the shared block', () => {
    const modules = ['LOOP', 'HOOKS', 'STATE M.', 'EVALUATOR', 'STOP POLICY', 'SUBAGENT', 'CONTEXT', 'TOOLS / MCP'];
    for (const mod of modules) {
      expect(AGENT_ARCHITECTURE_PROMPT_BLOCK).toContain(mod);
    }
  });

  it('appends the block to engineerSystemPrompt', () => {
    const out = engineerSystemPrompt('Role focus line.');
    expect(out.startsWith('Role focus line.')).toBe(true);
    expect(out).toContain(AGENT_ARCHITECTURE_PROMPT_BLOCK);
  });

  it('embeds architecture in every default role', () => {
    expect(DEFAULT_ENGINEER_ROLES.length).toBeGreaterThan(0);
    for (const role of DEFAULT_ENGINEER_ROLES) {
      expect(role.systemPrompt).toContain('## Agent operating contract (8 modules)');
      expect(role.systemPrompt).toContain('Self-awareness');
    }
  });
});
