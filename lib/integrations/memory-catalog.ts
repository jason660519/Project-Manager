/** Known project memory / context artifacts (relative to project root). */

export interface MemoryArtifactDef {
  id: string;
  name: string;
  relPath: string;
  company: string;
  category2: string;
  description: string;
}

export const MEMORY_ARTIFACT_DEFS: MemoryArtifactDef[] = [
  {
    id: 'claude-md',
    name: 'CLAUDE.md',
    relPath: 'CLAUDE.md',
    company: 'Anthropic',
    category2: 'Agent instructions',
    description: 'Primary Claude Code project instructions.',
  },
  {
    id: 'agents-md',
    name: 'AGENTS.md',
    relPath: 'AGENTS.md',
    company: 'Project',
    category2: 'Agent roster',
    description: 'Company / agent workflow standards pointer.',
  },
  {
    id: 'design-md',
    name: 'DESIGN.md',
    relPath: 'DESIGN.md',
    company: 'Project',
    category2: 'Design system',
    description: 'UI and layout conventions for this app.',
  },
  {
    id: 'gemini-md',
    name: 'GEMINI.md',
    relPath: 'GEMINI.md',
    company: 'Google',
    category2: 'Agent instructions',
    description: 'Gemini / Codex-oriented project context.',
  },
  {
    id: 'readme-md',
    name: 'README.md',
    relPath: 'README.md',
    company: 'Project',
    category2: 'Overview',
    description: 'Project overview and quick start.',
  },
  {
    id: 'claude-dir-md',
    name: '.claude/CLAUDE.md',
    relPath: '.claude/CLAUDE.md',
    company: 'Anthropic',
    category2: 'Scoped instructions',
    description: 'Claude Code scoped instructions under .claude/.',
  },
];
