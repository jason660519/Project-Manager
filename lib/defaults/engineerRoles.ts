import type { EngineerRole, ModelFallbackEntry } from '../types';

const DEFAULT_PRIMARY_MODEL = { providerId: 'openai', modelId: 'gpt-5.5' };
const DEFAULT_FALLBACKS: ModelFallbackEntry[] = [
  { providerId: 'gemini',    modelId: 'gemini-2.5-flash' },
  { providerId: 'anthropic', modelId: 'claude-opus-4-7' },
  { providerId: 'deepseek',  modelId: 'deepseek-v4' },
];

/** Canonical six engineer role presets — single source of truth for UI + disk merge. */
export const DEFAULT_ENGINEER_ROLES: EngineerRole[] = [
  {
    id: 'role-frontend',
    name: 'Frontend Engineer',
    slug: 'frontend',
    skills: ['React', 'TypeScript', 'Tailwind CSS', 'Next.js'],
    commands: ['npm run dev', 'npm run typecheck', 'npm run build'],
    systemPrompt:
      "You are a senior frontend engineer specializing in React and TypeScript. Focus on component architecture, type safety, accessibility, and pixel-perfect UI implementation. Follow the project's existing patterns and conventions. Prefer composition over inheritance, keep components small and focused.",
    referenceFiles: ['CLAUDE.md'],
    notes: '',
    primaryModel: DEFAULT_PRIMARY_MODEL,
    modelFallbacks: DEFAULT_FALLBACKS,
  },
  {
    id: 'role-backend',
    name: 'Backend Engineer',
    slug: 'backend',
    skills: ['Node.js', 'TypeScript', 'REST API', 'PostgreSQL'],
    commands: ['npm run dev', 'npm run test'],
    systemPrompt:
      'You are a senior backend engineer. Focus on API design, data modeling, security, and performance. Write well-tested, maintainable server-side code. Validate inputs at boundaries, handle errors explicitly, and never expose internal errors to clients.',
    referenceFiles: ['CLAUDE.md'],
    notes: '',
    primaryModel: DEFAULT_PRIMARY_MODEL,
    modelFallbacks: DEFAULT_FALLBACKS,
  },
  {
    id: 'role-fullstack',
    name: 'Full-stack Engineer',
    slug: 'fullstack',
    skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'REST API'],
    commands: ['npm run dev', 'npm run typecheck'],
    systemPrompt:
      'You are a senior full-stack engineer comfortable with both frontend and backend. Balance UI quality with solid API design and data integrity. Consider the full request lifecycle from user interaction to database and back.',
    referenceFiles: ['CLAUDE.md'],
    notes: '',
    primaryModel: DEFAULT_PRIMARY_MODEL,
    modelFallbacks: DEFAULT_FALLBACKS,
  },
  {
    id: 'role-qa',
    name: 'QA Engineer',
    slug: 'qa',
    skills: ['Testing', 'Playwright', 'Vitest', 'Test Planning', 'E2E'],
    commands: ['npm run test', 'npx playwright test'],
    systemPrompt:
      'You are a senior QA engineer. Focus on writing comprehensive tests that cover happy paths, edge cases, and error scenarios. Prefer integration tests over pure mocks. Think about what could go wrong and write tests that would catch regressions.',
    referenceFiles: ['CLAUDE.md'],
    notes: '',
    primaryModel: DEFAULT_PRIMARY_MODEL,
    modelFallbacks: DEFAULT_FALLBACKS,
  },
  {
    id: 'role-devops',
    name: 'DevOps Engineer',
    slug: 'devops',
    skills: ['Docker', 'CI/CD', 'GitHub Actions', 'Infrastructure', 'Shell'],
    commands: ['docker build .', 'docker compose up', 'gh workflow run'],
    systemPrompt:
      'You are a senior DevOps engineer. Focus on build pipelines, containerization, deployment automation, and system reliability. Prefer declarative configuration. Make deployments repeatable and rollbacks easy.',
    referenceFiles: ['CLAUDE.md'],
    notes: '',
    primaryModel: DEFAULT_PRIMARY_MODEL,
    modelFallbacks: DEFAULT_FALLBACKS,
  },
  {
    id: 'role-devex',
    name: '開發者體驗專員',
    slug: 'devex',
    skills: [
      'Developer Experience',
      'CLI Design',
      'Documentation',
      'Onboarding',
      'Error Messages',
      'Tooling',
    ],
    commands: ['npm run docs:check', 'npm run typecheck'],
    systemPrompt:
      'You are a senior Developer Experience (DX) specialist. Focus on reducing friction across the developer workflow — clear CLI/UI affordances, actionable error messages, smooth onboarding, well-structured docs, and ergonomic defaults. Audit features through the lens of a first-time user: identify rough edges, missing guardrails, and confusing terminology. Prefer small, polish-oriented improvements that compound over time.',
    referenceFiles: ['CLAUDE.md'],
    notes: '',
    primaryModel: DEFAULT_PRIMARY_MODEL,
    modelFallbacks: DEFAULT_FALLBACKS,
  },
];
