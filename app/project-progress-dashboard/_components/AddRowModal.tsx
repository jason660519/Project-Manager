'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../../../lib/i18n';
import type { DeployStatus, FeaturePhase, FeatureStatus, TestStatus } from '../../../lib/types';
import type { CustomProjectProgressRow } from '../types';
import { DEFAULT_E2E_CATEGORY } from '../_lib/e2eCategories';
import { E2eCategoryField } from './E2eCategoryField';

interface AddRowModalProps {
  open: boolean;
  onClose: () => void;
  phase: FeaturePhase;
  /** Default project name when adding a custom row. */
  defaultProjectName: string;
  /** All dashboard-visible project names (enables a picker when length > 1). */
  projectNames?: string[];
  existingIds: Set<string>;
  onAdd: (row: CustomProjectProgressRow) => void;
}

const PHASE_KEY: Record<FeaturePhase, 'development' | 'e2eTesting' | 'deployment' | 'operations'> = {
  development: 'development',
  e2e_testing: 'e2eTesting',
  deployment:  'deployment',
  operations:  'operations',
};

export function AddRowModal({
  open, onClose, phase, defaultProjectName, projectNames = [], existingIds, onAdd,
}: AddRowModalProps) {
  const { t } = useI18n();
  const phaseLabel = t.phases[PHASE_KEY[phase]];
  const projectOptions = projectNames.length > 0 ? projectNames : [defaultProjectName];
  const [projectName, setProjectName] = useState(defaultProjectName);
  const [rowId, setRowId] = useState('');
  const [points, setPoints] = useState<number>(1);
  const [name, setName] = useState('');
  const [category, setCategory] = useState(
    () => (phase === 'e2e_testing' ? DEFAULT_E2E_CATEGORY : 'Custom'),
  );
  const [percentage, setPercentage] = useState<number>(0);
  const [locatedPage, setLocatedPage] = useState('');
  const [status, setStatus] = useState<FeatureStatus>('todo');
  // Phase-specific fields. Empty string = "leave undefined" — keeps the JSON
  // tidy when the user doesn't have a value to enter yet.
  const [testCoverage, setTestCoverage] = useState<string>('');
  const [testStatus, setTestStatus] = useState<TestStatus | ''>('');
  const [deployStatus, setDeployStatus] = useState<DeployStatus | ''>('');
  const [deployEnv, setDeployEnv] = useState('');
  const [deployDate, setDeployDate] = useState('');
  const [uptimePercent, setUptimePercent] = useState<string>('');
  const [errorRate, setErrorRate] = useState<string>('');
  const [avgResponseTime, setAvgResponseTime] = useState<string>('');
  const [lastIncident, setLastIncident] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setProjectName(defaultProjectName);
  }, [open, defaultProjectName]);

  if (!open) return null;

  // Promote a numeric string to a clamped number, or undefined if empty / NaN.
  const num = (s: string, min = -Infinity, max = Infinity) => {
    if (s.trim() === '') return undefined;
    const n = Number(s);
    if (!Number.isFinite(n)) return undefined;
    return Math.max(min, Math.min(max, n));
  };

  const submit = () => {
    setError(null);
    const id = rowId.trim();
    if (!id) { setError('Row ID is required'); return; }
    if (existingIds.has(id)) { setError(`Row ID "${id}" already exists`); return; }
    if (!name.trim()) { setError('Name is required'); return; }
    const row: CustomProjectProgressRow = {
      rowId: id,
      projectName: projectName.trim() || defaultProjectName,
      name: name.trim(),
      category: phase === 'e2e_testing' ? category : (category.trim() || 'Custom'),
      percentage: Math.max(0, Math.min(100, percentage)),
      points: phase === 'development' ? Math.max(1, points || 1) : undefined,
      locatedPage: locatedPage.trim() || undefined,
      status,
      phase,
      testCoverage: num(testCoverage, 0, 100),
      testStatus: testStatus || undefined,
      deployStatus: deployStatus || undefined,
      deployEnv: deployEnv.trim() || undefined,
      deployDate: deployDate.trim() || undefined,
      uptimePercent: num(uptimePercent, 0, 100),
      errorRate: num(errorRate, 0),
      avgResponseTime: num(avgResponseTime, 0),
      lastIncident: lastIncident.trim() || undefined,
    };
    onAdd(row);
    setProjectName(defaultProjectName);
    setRowId('');
    setPoints(1);
    setName('');
    setCategory(phase === 'e2e_testing' ? DEFAULT_E2E_CATEGORY : 'Custom');
    setPercentage(0);
    setLocatedPage('');
    setStatus('todo');
    setTestCoverage('');
    setTestStatus('');
    setDeployStatus('');
    setDeployEnv('');
    setDeployDate('');
    setUptimePercent('');
    setErrorRate('');
    setAvgResponseTime('');
    setLastIncident('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded border border-stone-200/20 bg-[#061512] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-stone-100">
            Add row · {phaseLabel}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-100"><X size={16} /></button>
        </div>
        <div className="space-y-2 text-xs text-stone-200">
          <Field label={`${t.dashboard.projectName} *`}>
            {projectOptions.length > 1 ? (
              <select
                aria-label={t.dashboard.projectName}
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="input"
              >
                {projectOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            ) : (
              <input value={projectName} readOnly className="input text-stone-400" />
            )}
          </Field>
          <Field label="Row ID *">
            <input value={rowId} onChange={(e) => setRowId(e.target.value)}
              placeholder="e.g. C-001"
              className="input" />
          </Field>
          {phase === 'development' && (
            <Field label="SP">
              <input
                type="number"
                min={1}
                aria-label="SP"
                value={points}
                onChange={(e) => setPoints(Math.max(1, Number(e.target.value) || 1))}
                className="input"
              />
            </Field>
          )}
          <Field label="Name *">
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </Field>
          <Field label={phase === 'e2e_testing' ? 'E2E Category' : 'Category'}>
            {phase === 'e2e_testing' ? (
              <E2eCategoryField value={category} onChange={setCategory} />
            ) : (
              <input value={category} onChange={(e) => setCategory(e.target.value)} className="input" />
            )}
          </Field>
          <Field label="Located Page">
            <input value={locatedPage} onChange={(e) => setLocatedPage(e.target.value)} className="input" placeholder="optional" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value as FeatureStatus)} className="input">
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
                <option value="on_hold">On Hold</option>
              </select>
            </Field>
            <Field label="Progress %">
              <input type="number" min={0} max={100} value={percentage}
                onChange={(e) => setPercentage(Number(e.target.value))}
                className="input" />
            </Field>
          </div>

          {phase === 'e2e_testing' && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Test Coverage %">
                <input type="number" min={0} max={100} value={testCoverage}
                  onChange={(e) => setTestCoverage(e.target.value)} className="input" placeholder="0-100" />
              </Field>
              <Field label="Test Status">
                <select value={testStatus} onChange={(e) => setTestStatus(e.target.value as TestStatus | '')} className="input">
                  <option value="">—</option>
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </Field>
            </div>
          )}

          {phase === 'deployment' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Deploy Status">
                  <select value={deployStatus} onChange={(e) => setDeployStatus(e.target.value as DeployStatus | '')} className="input">
                    <option value="">—</option>
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="not_deployed">Not Deployed</option>
                  </select>
                </Field>
                <Field label="Environment">
                  <input value={deployEnv} onChange={(e) => setDeployEnv(e.target.value)} className="input" placeholder="e.g. prod-asia" />
                </Field>
              </div>
              <Field label="Deploy Date">
                <input type="date" value={deployDate} onChange={(e) => setDeployDate(e.target.value)} className="input" />
              </Field>
            </>
          )}

          {phase === 'operations' && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Uptime %">
                  <input type="number" min={0} max={100} step="0.1" value={uptimePercent}
                    onChange={(e) => setUptimePercent(e.target.value)} className="input" />
                </Field>
                <Field label="Error %">
                  <input type="number" min={0} step="0.01" value={errorRate}
                    onChange={(e) => setErrorRate(e.target.value)} className="input" />
                </Field>
                <Field label="Response (ms)">
                  <input type="number" min={0} value={avgResponseTime}
                    onChange={(e) => setAvgResponseTime(e.target.value)} className="input" />
                </Field>
              </div>
              <Field label="Last Incident">
                <input value={lastIncident} onChange={(e) => setLastIncident(e.target.value)} className="input" placeholder="optional note / id" />
              </Field>
            </>
          )}

          {error && <p className="text-[11px] text-red-300">{error}</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border border-stone-200/15 px-3 py-1.5 text-xs text-stone-300">Cancel</button>
          <button onClick={submit} className="rounded bg-emerald-500/30 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/40">
            Add
          </button>
        </div>
      </div>
      <style jsx>{`
        :global(.input) {
          height: 1.75rem;
          width: 100%;
          border-radius: 0.25rem;
          border: 1px solid rgba(231, 229, 228, 0.15);
          background: rgba(6, 21, 18, 0.95);
          padding: 0 0.5rem;
          color: rgb(245, 245, 244);
          font-size: 0.75rem;
        }
        :global(.input:focus) {
          outline: none;
          border-color: rgba(110, 231, 183, 0.4);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-stone-400">{label}</span>
      {children}
    </label>
  );
}
