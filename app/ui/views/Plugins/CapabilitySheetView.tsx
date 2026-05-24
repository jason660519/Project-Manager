'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, EyeOff, Loader2, RotateCw, XCircle } from 'lucide-react';
import type { CapabilityCandidate, CandidateState } from '../../../../lib/types';
import type { CapabilitySheet } from '../../../../lib/integrations/types';
import {
  applyCandidateEvent,
  loadCapabilityCatalog,
  type CapabilityCatalog,
} from '../../../../lib/storage/capabilities';
import { runVlaTest } from '../../../../lib/capabilities/test-runners/vla';
import { finalizeMicTest, recordMicSample } from '../../../../lib/capabilities/test-runners/tools';

// ── Static labels & styling ─────────────────────────────────────────────────

const SHEET_TITLES: Record<CapabilitySheet, string> = {
  vla:   'VLA Models — Vision (Eyes)',
  tts:   'TTS Models — Voice output (Mouth)',
  stt:   'STT Models — Voice input (Mouth)',
  hands: 'Hands — Synthetic input backends',
  tools: 'Tools — Devices & services',
};

const SHEET_SUBTITLE: Record<CapabilitySheet, string> = {
  vla:
    'Each model must pass an empirical vision test before it can be assigned to an engineer\'s Eyes capability.',
  tts:
    'TTS test runner ships in Phase 2a. Candidates are listed for forward reference.',
  stt:
    'STT test runner ships in Phase 2b. STT depends on Tools/microphone being passed first.',
  hands:
    'Hands test runner ships in Phase 3 (OS-level synthetic input via enigo).',
  tools:
    'Microphone test runner is functional. Future rows (clipboard, notifier, etc.) drop into this sheet.',
};

const STATE_CLASSES: Record<CandidateState, string> = {
  not_tested:      'border-stone-500/30 text-stone-400',
  testing:         'border-amber-300/40 text-amber-200',
  passed:          'border-emerald-400/40 text-emerald-200',
  passed_disabled: 'border-stone-500/30 text-stone-400 opacity-70',
  failed:          'border-red-400/40 text-red-200',
};

const STATE_LABELS: Record<CandidateState, string> = {
  not_tested:      'Not tested',
  testing:         'Testing…',
  passed:          'Passed',
  passed_disabled: 'Disabled',
  failed:          'Failed',
};

function StateBadge({ state }: { state: CandidateState }) {
  const Icon =
    state === 'testing'
      ? Loader2
      : state === 'passed'
        ? CheckCircle2
        : state === 'passed_disabled'
          ? EyeOff
          : state === 'failed'
            ? XCircle
            : Circle;
  return (
    <span
      className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] uppercase tracking-wide ${STATE_CLASSES[state]}`}
    >
      <Icon className={state === 'testing' ? 'animate-spin' : ''} size={12} />
      {STATE_LABELS[state]}
    </span>
  );
}

// ── Microphone confirm modal ────────────────────────────────────────────────

function MicConfirmModal({
  audioUrl,
  onConfirm,
}: {
  audioUrl: string;
  onConfirm: (audible: boolean) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[480px] max-w-[90vw] border border-stone-200/20 bg-[rgb(var(--pm-panel))] p-6 shadow-xl">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-100">
          Confirm microphone test
        </h3>
        <p className="mb-4 text-xs text-stone-400">
          Play the recording back. Did you hear your own voice clearly?
        </p>
        <audio src={audioUrl} controls className="mb-4 w-full" />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onConfirm(false)}
            className="border border-red-400/30 px-3 py-1.5 text-xs text-red-300"
          >
            Not audible
          </button>
          <button
            type="button"
            onClick={() => onConfirm(true)}
            className="border border-emerald-400/40 bg-emerald-950/30 px-3 py-1.5 text-xs text-emerald-200"
          >
            Audible — pass
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main view ───────────────────────────────────────────────────────────────

interface CapabilitySheetViewProps {
  sheet: CapabilitySheet;
}

export function CapabilitySheetView({ sheet }: CapabilitySheetViewProps) {
  const [catalog, setCatalog] = useState<CapabilityCatalog>({ schemaVersion: 1, candidates: [] });
  const [confirmFor, setConfirmFor] = useState<{
    id: string;
    audioUrl: string;
    cleanup: () => void;
    durationMs: number;
  } | null>(null);

  useEffect(() => {
    setCatalog(loadCapabilityCatalog());
  }, [sheet]);

  const rows = catalog.candidates.filter((c) => c.sheet === sheet);

  const runTest = async (candidate: CapabilityCandidate) => {
    // Transition to `testing` first so the badge updates immediately.
    let next = applyCandidateEvent(catalog, candidate.id, { type: 'start_test' });
    setCatalog(next);

    if (sheet === 'vla') {
      const result = await runVlaTest(candidate);
      next = applyCandidateEvent(next, candidate.id, {
        type: result.ok ? 'pass_and_enable' : 'fail',
        result,
      });
      setCatalog(next);
      return;
    }

    if (sheet === 'tools') {
      try {
        const prep = await recordMicSample(5000);
        setConfirmFor({ id: candidate.id, ...prep });
      } catch (e) {
        next = applyCandidateEvent(next, candidate.id, {
          type: 'fail',
          result: {
            ok: false,
            durationMs: 0,
            message: e instanceof Error ? e.message : String(e),
          },
        });
        setCatalog(next);
      }
      return;
    }

    // TTS / STT / Hands — test runner pending later phase.
    next = applyCandidateEvent(next, candidate.id, {
      type: 'fail',
      result: {
        ok: false,
        durationMs: 0,
        message: `${sheet.toUpperCase()} test runner not implemented yet — lands in a later phase.`,
      },
    });
    setCatalog(next);
  };

  const finishMicTest = (audible: boolean) => {
    if (!confirmFor) return;
    confirmFor.cleanup();
    const next = applyCandidateEvent(catalog, confirmFor.id, {
      type: audible ? 'pass_and_enable' : 'fail',
      result: finalizeMicTest(audible, confirmFor.durationMs),
    });
    setCatalog(next);
    setConfirmFor(null);
  };

  const toggleEnabled = (candidate: CapabilityCandidate) => {
    if (candidate.state !== 'passed' && candidate.state !== 'passed_disabled') return;
    const next = applyCandidateEvent(catalog, candidate.id, {
      type: candidate.state === 'passed' ? 'toggle_off' : 'toggle_on',
    });
    setCatalog(next);
  };

  return (
    <div className="h-full overflow-auto p-4">
      <header className="mb-4">
        <h2 className="text-base font-semibold uppercase tracking-[0.16em] text-stone-50">
          {SHEET_TITLES[sheet]}
        </h2>
        <p className="mt-1 text-xs text-stone-400">{SHEET_SUBTITLE[sheet]}</p>
      </header>

      {rows.length === 0 ? (
        <div className="border border-stone-200/15 bg-[rgb(var(--pm-panel))]/30 px-4 py-6 text-center text-xs text-stone-500">
          No candidates seeded for this sheet yet.
        </div>
      ) : (
        <table className="w-full border border-stone-200/15 text-sm">
          <thead className="bg-[rgb(var(--pm-panel))]/45 text-[10px] uppercase tracking-[0.14em] text-stone-500">
            <tr>
              <th className="px-3 py-2 text-left">Candidate</th>
              <th className="px-3 py-2 text-left">State</th>
              <th className="px-3 py-2 text-left">Last result</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-stone-200/10 align-top">
                <td className="px-3 py-2 text-stone-100">
                  <div className="font-medium">{c.label}</div>
                  <div className="text-[10px] text-stone-500">{c.id}</div>
                </td>
                <td className="px-3 py-2"><StateBadge state={c.state} /></td>
                <td className="px-3 py-2 text-xs text-stone-400">
                  {c.lastTestResult?.message ?? '—'}
                </td>
                <td className="space-x-2 px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => void runTest(c)}
                    disabled={c.state === 'testing'}
                    className="inline-flex items-center gap-1 border border-emerald-400/30 bg-emerald-950/20 px-2 py-1 text-xs text-emerald-300 disabled:opacity-50"
                  >
                    <RotateCw size={11} />
                    {c.state === 'not_tested' || c.state === 'failed' ? 'Run test' : 'Retest'}
                  </button>
                  {(c.state === 'passed' || c.state === 'passed_disabled') && (
                    <button
                      type="button"
                      onClick={() => toggleEnabled(c)}
                      className="border border-stone-300/30 px-2 py-1 text-xs text-stone-300"
                    >
                      {c.state === 'passed' ? 'Disable' : 'Enable'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {confirmFor && (
        <MicConfirmModal audioUrl={confirmFor.audioUrl} onConfirm={finishMicTest} />
      )}
    </div>
  );
}
