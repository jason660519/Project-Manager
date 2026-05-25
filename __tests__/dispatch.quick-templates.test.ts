import { describe, expect, it } from 'vitest';
import { buildTemplatePrompt } from '../components/table/RoleConfigPanel';
import { en } from '../lib/i18n';
import type { Feature } from '../lib/types';

const feature: Feature = {
  id: 'F13',
  name: 'Dispatch UX Improvements',
  category: 'Frontend/Dispatch',
  status: 'in_progress',
  progress: 50,
  phase: 'development',
  notes: 'Improve dispatch handoff clarity.',
  paths: {
    featureFolder: '.project-manager/features/F13',
    spec: '.project-manager/features/F13/feature-spec.md',
    tdd: '.project-manager/features/F13/tdd-spec.md',
    implementation: 'components/table/TaskDispatchModal.tsx',
    test: '__tests__/dispatch.component.render.test.tsx',
    unitIntegrationTest: '__tests__/dispatch.component.render.test.tsx',
    e2eAcceptanceTestScriptFolder: 'e2e/dispatch',
    developmentLogSummaryFolder: '.project-manager/features/F13',
  },
};

describe('dispatch quick template prompts', () => {
  it('builds role-aware worker prompts with clear references and verification expectations', () => {
    const prompt = buildTemplatePrompt(
      'feature-spec',
      'worker',
      feature,
      '/repo',
      'development',
      en.dispatch,
    );

    expect(prompt).toContain('# Task Dispatch: F13 - Dispatch UX Improvements');
    expect(prompt).toContain('- Role: Worker (W)');
    expect(prompt).toContain('- Project root: /repo');
    expect(prompt).toContain('Feature Spec: /repo/.project-manager/features/F13/feature-spec.md');
    expect(prompt).toContain('## Required Steps');
    expect(prompt).toContain('Read the feature spec first: /repo/.project-manager/features/F13/feature-spec.md');
    expect(prompt).toContain('Verification commands run, with pass/fail results.');
  });

  it('gives planner and evaluator different task boundaries', () => {
    const plannerPrompt = buildTemplatePrompt(
      'from-scratch',
      'planner',
      feature,
      '/repo',
      'development',
      en.dispatch,
    );
    const evaluatorPrompt = buildTemplatePrompt(
      'code-review',
      'evaluator',
      feature,
      '/repo',
      'development',
      en.dispatch,
    );

    expect(plannerPrompt).toContain('- Role: Planner (P)');
    expect(plannerPrompt).toContain('Do not make code changes unless the prompt explicitly asks for implementation.');
    expect(evaluatorPrompt).toContain('- Role: Evaluator (E)');
    expect(evaluatorPrompt).toContain('Findings are ordered by severity and are actionable.');
  });
});
