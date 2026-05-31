'use client';

import { useEffect, useState } from 'react';
import {
  xmuxWebviewCreate,
  xmuxWebviewDestroy,
  xmuxWebviewEval,
  xmuxWebviewSelectElement,
} from '../../../../lib/bridge';
import {
  appendXmuxSnippetToInput,
  formatXmuxSelectedElementSnippet,
  isXmuxSelectedElementPayload,
} from '../../../../lib/xmux/selectedElementSnippet';

type ScenarioStatus = 'passed' | 'failed' | 'skipped';

interface ScenarioResult {
  id: 'F34-S05' | 'F34-S06' | 'F34-S16';
  status: ScenarioStatus;
  message: string;
  evidence?: Record<string, unknown>;
}

interface E2EReport {
  suite: 'F34 Tauri Native Select Element';
  status: ScenarioStatus;
  runtime: 'tauri' | 'browser';
  startedAt: string;
  completedAt: string;
  scenarios: ScenarioResult[];
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function withTimeout<T>(label: string, promise: Promise<T>, ms = 12_000): Promise<T> {
  let timeoutId = 0;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function reportPathFromUrl(): string {
  if (typeof window === 'undefined') return '';
  return new URL(window.location.href).searchParams.get('report') ?? '';
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function parseSelectedPayload(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw) as unknown;
  assert(isXmuxSelectedElementPayload(parsed), 'Select Element returned no usable DOM payload.');
  return parsed;
}

async function captureElement(label: string, selector: string): Promise<Record<string, unknown>> {
  return parseSelectedPayload(await withTimeout(`Select ${selector}`, xmuxWebviewSelectElement(label), 20_000));
}

export function F34SelectElementTauriE2EClient() {
  const [report, setReport] = useState<E2EReport | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [reportPath, setReportPath] = useState('');

  useEffect(() => {
    let cancelled = false;
    const resolvedReportPath = reportPathFromUrl();
    setReportPath(resolvedReportPath);
    const startedAt = new Date().toISOString();
    const label = `xmux-e2e-f34-select-${Date.now()}`;
    const fixtureUrl = new URL('/e2e/fixtures/f34-select-element', window.location.href).toString();
    let assistantInput = '';

    const log = (message: string) => {
      setLogLines((current) => [...current, message]);
    };

    const finish = async (nextReport: E2EReport) => {
      if (cancelled) return;
      setReport(nextReport);
      if (resolvedReportPath) {
        const response = await fetch('/api/e2e-report', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reportPath: resolvedReportPath, report: nextReport }),
        });
        if (!response.ok) {
          throw new Error(`Failed to write E2E report: ${response.status}`);
        }
      }
    };

    const run = async () => {
      const runtime = isTauriRuntime() ? 'tauri' : 'browser';
      const scenarios: ScenarioResult[] = [];

      if (runtime !== 'tauri') {
        await finish({
          suite: 'F34 Tauri Native Select Element',
          status: 'skipped',
          runtime,
          startedAt,
          completedAt: new Date().toISOString(),
          scenarios: [
            {
              id: 'F34-S16',
              status: 'skipped',
              message: 'This E2E suite must run inside the Tauri desktop runtime.',
            },
          ],
        });
        return;
      }

      try {
        log('Creating native xmux webview fixture.');
        await withTimeout('Create native xmux fixture webview', xmuxWebviewCreate(label, fixtureUrl, 48, 120, 720, 420));
        await delay(900);
        await withTimeout(
          'Prime native Select Element fixture targets',
          xmuxWebviewEval(
            label,
            `
window.__pmXmuxE2ESelectElement = true;
window.__pmXmuxE2ESelectElementSelectors = ['#first-target', '#second-target'];
for (const selector of window.__pmXmuxE2ESelectElementSelectors) {
  if (!document.querySelector(selector)) throw new Error('Missing target ' + selector);
}
`,
          ),
        );

        log('F34-S05: selecting first element and inserting DOM context into assistant input.');
        const firstPayload = await captureElement(label, '#first-target');
        const firstSnippet = formatXmuxSelectedElementSnippet(firstPayload);
        assistantInput = appendXmuxSnippetToInput(assistantInput, firstSnippet);
        assert(assistantInput.includes('[xmux element:'), 'Assistant input is missing the selected-element header.');
        assert(assistantInput.includes('first-target'), 'Assistant input is missing first target selector/context.');
        assert(assistantInput.includes('"domTree"'), 'Assistant input is missing domTree context.');
        scenarios.push({
          id: 'F34-S05',
          status: 'passed',
          message: 'Native Select Element returned DOM context and the assistant input received the snippet.',
          evidence: {
            selector: firstPayload.selector,
            elementTag: firstPayload.elementTag,
            assistantInputLength: assistantInput.length,
          },
        });

        log('F34-S06: selecting a second element without stale native callback state.');
        const secondPayload = await captureElement(label, '#second-target');
        const secondSnippet = formatXmuxSelectedElementSnippet(secondPayload);
        assistantInput = appendXmuxSnippetToInput(assistantInput, secondSnippet);
        assert(assistantInput.includes('second-target'), 'Assistant input is missing second target context.');
        assert(firstPayload.selector !== secondPayload.selector, 'Repeated selection returned the same selector.');
        scenarios.push({
          id: 'F34-S06',
          status: 'passed',
          message: 'A second consecutive native selection returned a fresh payload.',
          evidence: {
            firstSelector: firstPayload.selector,
            secondSelector: secondPayload.selector,
            assistantInputLength: assistantInput.length,
          },
        });

        log('F34-S16: confirming this suite exercised the Tauri native webview command path.');
        scenarios.push({
          id: 'F34-S16',
          status: 'passed',
          message: 'Suite ran with __TAURI_INTERNALS__ and xmux native webview commands.',
          evidence: {
            runtime,
            label,
            fixtureUrl,
          },
        });

        await finish({
          suite: 'F34 Tauri Native Select Element',
          status: 'passed',
          runtime,
          startedAt,
          completedAt: new Date().toISOString(),
          scenarios,
        });
      } catch (error) {
        scenarios.push({
          id: 'F34-S16',
          status: 'failed',
          message: error instanceof Error ? error.message : String(error),
        });
        await finish({
          suite: 'F34 Tauri Native Select Element',
          status: 'failed',
          runtime,
          startedAt,
          completedAt: new Date().toISOString(),
          scenarios,
        });
      } finally {
        try {
          await xmuxWebviewDestroy(label);
        } catch {
          // The report is more important than teardown noise here.
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      void xmuxWebviewDestroy(label).catch(() => {});
    };
  }, []);

  return (
    <main style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', padding: 24 }}>
      <h1>F34 Tauri Native Select Element E2E</h1>
      <p data-testid="runtime">Runtime: {isTauriRuntime() ? 'tauri' : 'browser'}</p>
      <p data-testid="report-path">Report: {reportPath || 'not requested'}</p>
      <pre data-testid="e2e-log">{logLines.join('\n')}</pre>
      <pre data-testid="e2e-report">{report ? JSON.stringify(report, null, 2) : 'running'}</pre>
    </main>
  );
}
