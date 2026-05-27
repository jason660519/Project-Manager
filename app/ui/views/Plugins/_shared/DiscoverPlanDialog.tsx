'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { ConnectedInstanceScanSnapshot } from '../../../../../lib/bridge';
import type { DiscoveryRunSummary } from '../../../../../lib/integrations/discovery/summarize';
import { DiscoveryRunSummaryView } from './DiscoveryRunSummaryView';
import {
  BUILTIN_DISCOVERY_PRESETS,
  type DiscoveryPlan,
  type BuiltinDiscoveryProbeId,
  DISCOVERY_PROBE_REGISTRY,
  probesForScope,
  validateDiscoveryPlan,
  applyProbeToggle,
  applyLanMode,
} from '../../../../../lib/integrations/discovery';
import type { DiscoveryScope, LanDiscoveryMode } from '../../../../../lib/integrations/discovery/types';
import { ensureNmapInstalled } from '../../../../../lib/bridge';

export type DiscoverDialogPhase = 'configure' | 'running' | 'results';

export interface DiscoverPlanDialogProps {
  open: boolean;
  initialPlan: DiscoveryPlan;
  /** Header X / Cancel — dialog only; scan results may still show in the hub panel. */
  onClose: () => void;
  /** Done after reviewing results — dialog closes and hub should not duplicate the summary panel. */
  onDone?: () => void;
  onRun: (plan: DiscoveryPlan) => Promise<{
    snapshot: ConnectedInstanceScanSnapshot;
    summary: DiscoveryRunSummary;
  }>;
}

function clonePlan(plan: DiscoveryPlan): DiscoveryPlan {
  return structuredClone(plan);
}

export function DiscoverPlanDialog({
  open,
  initialPlan,
  onClose,
  onDone,
  onRun,
}: DiscoverPlanDialogProps) {
  const [phase, setPhase] = useState<DiscoverDialogPhase>('configure');
  const [plan, setPlan] = useState<DiscoveryPlan>(() => clonePlan(initialPlan));
  const [cidrText, setCidrText] = useState('');
  const [hostAddress, setHostAddress] = useState('');
  const [nmapInstallNote, setNmapInstallNote] = useState<string | null>(null);
  const [nmapInstalling, setNmapInstalling] = useState(false);
  const [runSummary, setRunSummary] = useState<DiscoveryRunSummary | null>(null);
  const [runWarnings, setRunWarnings] = useState<string[]>([]);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhase('configure');
    setRunSummary(null);
    setRunWarnings([]);
    setRunError(null);
    const next = clonePlan(initialPlan);
    setPlan(next);
    if (next.scope.kind === 'lan' && next.scope.cidrs?.length) {
      setCidrText(next.scope.cidrs.join(', '));
    } else {
      setCidrText('');
    }
    if (next.scope.kind === 'host') {
      setHostAddress(next.scope.address);
    } else {
      setHostAddress('');
    }
  }, [open, initialPlan]);

  const compatibleProbes = useMemo(() => probesForScope(plan.scope), [plan.scope]);

  const validation = useMemo(() => {
    const draft = clonePlan(plan);
    if (draft.scope.kind === 'lan' && draft.scope.mode === 'active') {
      draft.scope = {
        ...draft.scope,
        cidrs: cidrText
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean),
      };
    }
    if (draft.scope.kind === 'host') {
      draft.scope = { kind: 'host', address: hostAddress.trim() };
    }
    return validateDiscoveryPlan(draft);
  }, [plan, cidrText, hostAddress]);

  const setScopeKind = useCallback((kind: DiscoveryScope['kind']) => {
    setPlan((prev) => {
      if (kind === 'local') return { ...prev, scope: { kind: 'local' } };
      if (kind === 'host') return { ...prev, scope: { kind: 'host', address: hostAddress } };
      const mode: LanDiscoveryMode =
        prev.scope.kind === 'lan' && prev.scope.mode === 'active' ? 'active' : 'passive';
      return { ...prev, scope: { kind: 'lan', mode, cidrs: [] } };
    });
  }, [hostAddress]);

  const toggleProbe = useCallback((id: BuiltinDiscoveryProbeId) => {
    setPlan((prev) => {
      const enable = !prev.probes.includes(id);
      return applyProbeToggle(prev, id, enable);
    });
  }, []);

  const applyPreset = useCallback((presetId: string) => {
    const preset = BUILTIN_DISCOVERY_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const next = clonePlan(preset.plan);
    setPlan(next);
    if (next.scope.kind === 'lan' && next.scope.cidrs?.length) {
      setCidrText(next.scope.cidrs.join(', '));
    } else {
      setCidrText('');
    }
    if (next.scope.kind === 'host') {
      setHostAddress(next.scope.address);
    } else {
      setHostAddress('');
    }
  }, []);

  const buildDraftPlan = useCallback((): DiscoveryPlan => {
    const draft = clonePlan(plan);
    if (draft.scope.kind === 'lan' && draft.scope.mode === 'active') {
      draft.scope = {
        ...draft.scope,
        cidrs: cidrText
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean),
      };
    }
    if (draft.scope.kind === 'host') {
      draft.scope = { kind: 'host', address: hostAddress.trim() };
    }
    return draft;
  }, [plan, cidrText, hostAddress]);

  const handleRun = useCallback(() => {
    const draft = buildDraftPlan();
    const result = validateDiscoveryPlan(draft);
    if (!result.ok) return;
    setPhase('running');
    setRunError(null);
    void onRun(draft)
      .then(({ snapshot, summary }) => {
        setRunSummary(summary);
        setRunWarnings(snapshot.warnings);
        setPhase('results');
      })
      .catch((e) => {
        setRunError(e instanceof Error ? e.message : String(e));
        setRunWarnings([]);
        setPhase('results');
      });
  }, [buildDraftPlan, onRun]);

  if (!open) return null;

  const isConfiguring = phase === 'configure';
  const isRunning = phase === 'running';
  const isShowingResults = phase === 'results';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="discover-plan-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col border border-stone-200/20 bg-[rgb(var(--pm-panel))] shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200/15 px-4 py-3">
          <h2 id="discover-plan-title" className="text-sm font-semibold uppercase tracking-[0.14em] text-stone-50">
            Discovery plan
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            className="border border-stone-200/20 p-1 text-stone-400 hover:text-stone-100 disabled:opacity-40"
            aria-label="Close"
            title={isRunning ? 'Wait for scan to finish' : 'Close'}
          >
            <X size={14} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto px-4 py-4 text-xs text-stone-300">
          {isConfiguring && (
          <>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-stone-500">Preset</label>
            <select
              value={plan.presetId ?? ''}
              onChange={(e) => applyPreset(e.target.value)}
              className="w-full border border-stone-200/18 bg-[rgb(var(--pm-panel))] px-2 py-2 text-stone-100"
            >
              <option value="">Custom</option>
              {BUILTIN_DISCOVERY_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-stone-500">Scope</p>
            <div className="space-y-2">
              {(
                [
                  ['local', 'This Mac'],
                  ['lan', 'LAN'],
                  ['host', 'Single host'],
                ] as const
              ).map(([kind, label]) => (
                <label key={kind} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="discovery-scope"
                    checked={plan.scope.kind === kind}
                    onChange={() => setScopeKind(kind)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            {plan.scope.kind === 'lan' && (
              <div className="mt-2 space-y-2 border border-stone-200/10 bg-stone-950/30 p-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={plan.scope.mode === 'passive'}
                    onChange={() => setPlan((p) => applyLanMode(p, 'passive'))}
                  />
                  Passive (ARP cache + mDNS)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={plan.scope.mode === 'active'}
                    onChange={() => setPlan((p) => applyLanMode(p, 'active'))}
                  />
                  Active (requires private CIDR for nmap)
                </label>
                {plan.scope.mode === 'active' && (
                  <input
                    type="text"
                    value={cidrText}
                    onChange={(e) => setCidrText(e.target.value)}
                    placeholder="192.168.1.0/24, 10.0.0.0/24"
                    className="w-full border border-stone-200/18 bg-[rgb(var(--pm-panel))] px-2 py-2 font-mono text-stone-100"
                  />
                )}
              </div>
            )}
            {plan.scope.kind === 'host' && (
              <input
                type="text"
                value={hostAddress}
                onChange={(e) => setHostAddress(e.target.value)}
                placeholder="192.168.1.50"
                className="mt-2 w-full border border-stone-200/18 bg-[rgb(var(--pm-panel))] px-2 py-2 font-mono text-stone-100"
              />
            )}
          </div>

          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-stone-500">Probes</p>
            <div className="space-y-2">
              {DISCOVERY_PROBE_REGISTRY.map((probe) => {
                const disabled = !compatibleProbes.includes(probe.id);
                return (
                  <label
                    key={probe.id}
                    className={`flex gap-2 ${disabled ? 'opacity-40' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      checked={plan.probes.includes(probe.id)}
                      disabled={disabled}
                      onChange={() => toggleProbe(probe.id)}
                    />
                    <span>
                      <span className="font-medium text-stone-100">{probe.label}</span>
                      <span className="mt-0.5 block text-[10px] text-stone-500">{probe.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {plan.probes.includes('nmap') && plan.scope.kind === 'lan' && plan.scope.mode === 'active' && (
              <p className="mt-2 text-[10px] text-cyan-200/90">
                nmap enabled — enter your private LAN CIDR above (e.g. 192.168.1.0/24), then Run discovery.
              </p>
            )}
            {plan.probes.includes('nmap') && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border border-stone-200/15 bg-stone-950/40 p-2">
                <button
                  type="button"
                  disabled={nmapInstalling || isRunning}
                  onClick={() => {
                    setNmapInstalling(true);
                    setNmapInstallNote(null);
                    void ensureNmapInstalled()
                      .then((msg) => setNmapInstallNote(msg))
                      .catch((e) =>
                        setNmapInstallNote(
                          e instanceof Error
                            ? `${e.message} (terminal: npm run discovery:install-nmap)`
                            : String(e),
                        ),
                      )
                      .finally(() => setNmapInstalling(false));
                  }}
                  className="border border-amber-400/30 bg-amber-950/25 px-2 py-1 text-[10px] text-amber-100 disabled:opacity-50"
                >
                  {nmapInstalling ? 'Installing nmap…' : 'Install nmap (Homebrew)'}
                </button>
                <span className="text-[10px] text-stone-500">
                  Or run <span className="font-mono text-stone-400">npm run discovery:install-nmap</span>
                </span>
                {nmapInstallNote && (
                  <p className="w-full text-[10px] text-stone-400">{nmapInstallNote}</p>
                )}
              </div>
            )}
            <p className="mt-2 text-[10px] text-stone-500">
              Cloud providers (AWS, GCP, Azure) and custom scripts are planned for a later release.
            </p>
          </div>

          {!validation.ok && (
            <ul className="border border-amber-400/25 bg-amber-950/25 px-3 py-2 text-amber-100/90">
              {validation.errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          )}
          </>
          )}
        </div>

        {isConfiguring && (
          <div className="flex justify-end gap-2 border-t border-stone-200/15 px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="border border-stone-200/20 px-3 py-2 text-stone-300 hover:bg-stone-200/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRun}
              disabled={!validation.ok}
              className="border border-emerald-400/30 bg-emerald-950/30 px-3 py-2 text-emerald-200 disabled:opacity-50"
            >
              Run discovery
            </button>
          </div>
        )}

        {isRunning && (
          <div className="flex justify-end border-t border-stone-200/15 px-4 py-2">
            <span className="border border-emerald-400/30 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200 opacity-60">
              Running…
            </span>
          </div>
        )}

        {(isRunning || isShowingResults) && (
          <div className="max-h-[50vh] shrink-0 overflow-auto border-t border-emerald-400/20 bg-emerald-950/10">
            <DiscoveryRunSummaryView
              summary={runSummary}
              warnings={runWarnings}
              running={isRunning}
            />
            {runError && isShowingResults && (
              <p className="mx-4 mb-3 border border-red-400/30 bg-red-950/25 px-3 py-2 text-red-200">
                {runError}
              </p>
            )}
          </div>
        )}

        {isShowingResults && (
          <div className="flex justify-end gap-2 border-t border-stone-200/15 px-4 py-3">
            <button
              type="button"
              onClick={() => setPhase('configure')}
              className="border border-stone-200/20 px-3 py-2 text-stone-300 hover:bg-stone-200/5"
            >
              Adjust plan
            </button>
            <button
              type="button"
              onClick={onDone ?? onClose}
              className="border border-emerald-400/30 bg-emerald-950/30 px-3 py-2 text-emerald-200"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
