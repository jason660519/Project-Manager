'use client';

import { useState } from 'react';
import { Plus, Trash2, Users2 } from 'lucide-react';
import type { AnyAdapterConfig, EngineerRole } from '../../../lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(): string {
  return typeof crypto !== 'undefined'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

const SLUG_COLORS: Record<string, string> = {
  frontend:  'border-cyan-300/35 text-cyan-300/80',
  backend:   'border-emerald-300/35 text-emerald-300/80',
  fullstack: 'border-violet-300/35 text-violet-300/80',
  qa:        'border-amber-300/35 text-amber-300/80',
  devops:    'border-orange-300/35 text-orange-300/80',
};

function slugColor(slug: string): string {
  return SLUG_COLORS[slug] ?? 'border-stone-300/35 text-stone-300/80';
}

const DEFAULT_ROLES: EngineerRole[] = [
  {
    id: 'role-frontend',
    name: 'Frontend Engineer',
    slug: 'frontend',
    skills: ['React', 'TypeScript', 'Tailwind CSS', 'Next.js'],
    commands: ['npm run dev', 'npm run typecheck', 'npm run build'],
    systemPrompt:
      'You are a senior frontend engineer specializing in React and TypeScript. Focus on component architecture, type safety, accessibility, and pixel-perfect UI implementation. Follow the project\'s existing patterns and conventions. Prefer composition over inheritance, keep components small and focused.',
    referenceFiles: ['CLAUDE.md'],
    notes: '',
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
  },
];

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  slug: string;
  skills: string;
  commands: string;
  systemPrompt: string;
  referenceFiles: string;
  defaultAgentId: string;
  notes: string;
}

function roleToForm(role: EngineerRole): FormState {
  return {
    name: role.name,
    slug: role.slug,
    skills: role.skills.join('\n'),
    commands: role.commands.join('\n'),
    systemPrompt: role.systemPrompt,
    referenceFiles: role.referenceFiles.join('\n'),
    defaultAgentId: role.defaultAgentId ?? '',
    notes: role.notes ?? '',
  };
}

function formToRole(id: string, form: FormState): EngineerRole {
  return {
    id,
    name: form.name || 'Unnamed Role',
    slug: form.slug || slugify(form.name) || 'role',
    skills: form.skills.split('\n').map((s) => s.trim()).filter(Boolean),
    commands: form.commands.split('\n').map((s) => s.trim()).filter(Boolean),
    systemPrompt: form.systemPrompt,
    referenceFiles: form.referenceFiles.split('\n').map((s) => s.trim()).filter(Boolean),
    defaultAgentId: form.defaultAgentId || undefined,
    notes: form.notes || undefined,
  };
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

const inputCls =
  'w-full border border-stone-200/20 bg-[#03100f] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35 placeholder:text-stone-600';

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2">
        <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">{label}</label>
        {hint && <span className="text-[10px] text-stone-600">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

interface DetailPanelProps {
  role: EngineerRole;
  agents: AnyAdapterConfig[];
  onSave: (updated: EngineerRole) => void;
  onDelete: () => void;
}

function DetailPanel({ role, agents, onSave, onDelete }: DetailPanelProps) {
  const [form, setForm] = useState<FormState>(() => roleToForm(role));
  const [dirty, setDirty] = useState(false);

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const val = e.target.value;
    setForm((prev) => {
      const next = { ...prev, [field]: val };
      if (field === 'name' && !dirty) {
        next.slug = slugify(val);
      }
      return next;
    });
    setDirty(true);
  };

  const handleSlugEdit = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, slug: e.target.value }));
    setDirty(true);
  };

  const handleSave = () => {
    onSave(formToRole(role.id, form));
    setDirty(false);
  };

  const handleReset = () => {
    setForm(roleToForm(role));
    setDirty(false);
  };

  const agentAdapters = agents.filter((a) => a.type === 'agent');

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${slugColor(form.slug)}`}>
          {form.slug || '—'}
        </span>
        <span className="text-sm font-medium text-stone-200">{form.name || 'New Role'}</span>
        {dirty && (
          <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-amber-300/70">
            unsaved
          </span>
        )}
      </div>

      {/* Basic */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Role Name">
          <input value={form.name} onChange={set('name')} placeholder="Frontend Engineer" className={inputCls} />
        </FormField>
        <FormField label="Slug" hint="(used in dispatch badge)">
          <input value={form.slug} onChange={handleSlugEdit} placeholder="frontend" className={`${inputCls} font-mono`} />
        </FormField>
      </div>

      {agentAdapters.length > 0 && (
        <FormField label="Default Agent" hint="(pre-selected in dispatch)">
          <select value={form.defaultAgentId} onChange={set('defaultAgentId')} className={inputCls}>
            <option value="">— None —</option>
            {agentAdapters.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </FormField>
      )}

      {/* Skills */}
      <FormField label="Skills" hint="(one per line)">
        <textarea
          rows={4}
          value={form.skills}
          onChange={set('skills')}
          placeholder={'React\nTypeScript\nTailwind CSS'}
          className={`${inputCls} font-mono text-xs`}
        />
      </FormField>

      {/* Commands */}
      <FormField label="Common Commands" hint="(one per line)">
        <textarea
          rows={3}
          value={form.commands}
          onChange={set('commands')}
          placeholder={'npm run dev\nnpm run typecheck'}
          className={`${inputCls} font-mono text-xs`}
        />
      </FormField>

      {/* System Prompt */}
      <FormField label="System Prompt" hint="(prepended to every AI dispatch)">
        <textarea
          rows={6}
          value={form.systemPrompt}
          onChange={set('systemPrompt')}
          placeholder="You are a senior frontend engineer specializing in..."
          className={`${inputCls} text-xs leading-5`}
        />
      </FormField>

      {/* Reference Files */}
      <FormField label="Reference Files" hint="(paths relative to project root, one per line)">
        <textarea
          rows={3}
          value={form.referenceFiles}
          onChange={set('referenceFiles')}
          placeholder={'CLAUDE.md\ndocs/Architecture.md'}
          className={`${inputCls} font-mono text-xs`}
        />
      </FormField>

      {/* Notes */}
      <FormField label="Notes">
        <textarea
          rows={2}
          value={form.notes}
          onChange={set('notes')}
          placeholder="Optional notes about this role..."
          className={`${inputCls} text-xs`}
        />
      </FormField>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-stone-200/12 pt-3">
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 border border-stone-200/18 px-3 py-1.5 text-xs text-stone-500 hover:border-red-500/30 hover:text-red-400"
        >
          <Trash2 size={12} />
          Delete Role
        </button>
        <div className="ml-auto flex gap-2">
          {dirty && (
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-100"
            >
              Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty}
            className="bg-stone-100 px-4 py-1.5 text-xs font-medium text-[#071d1a] hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

interface EngineersViewProps {
  roles: EngineerRole[];
  agents: AnyAdapterConfig[];
  onRolesChange: (roles: EngineerRole[]) => void;
}

export function EngineersView({ roles, agents, onRolesChange }: EngineersViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(roles[0]?.id ?? null);

  const selectedRole = roles.find((r) => r.id === selectedId) ?? null;

  const handleAdd = () => {
    const newRole: EngineerRole = {
      id: uid(),
      name: 'New Role',
      slug: 'new-role',
      skills: [],
      commands: [],
      systemPrompt: '',
      referenceFiles: ['CLAUDE.md'],
    };
    onRolesChange([...roles, newRole]);
    setSelectedId(newRole.id);
  };

  const handleInitDefaults = () => {
    onRolesChange(DEFAULT_ROLES);
    setSelectedId(DEFAULT_ROLES[0].id);
  };

  const handleSave = (updated: EngineerRole) => {
    onRolesChange(roles.map((r) => (r.id === updated.id ? updated : r)));
  };

  const handleDelete = (id: string) => {
    const next = roles.filter((r) => r.id !== id);
    onRolesChange(next);
    if (selectedId === id) {
      setSelectedId(next[0]?.id ?? null);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Page header */}
      <div className="mb-4">
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">
          AI Engineers
        </h1>
        <p className="mt-1 text-xs text-stone-400">
          Configure engineer role presets for this project. Roles are injected into AI dispatches
          as system context.
        </p>
      </div>

      {/* Master-detail layout — fixed viewport height so both panels scroll independently */}
      <div className="flex h-[calc(100vh-11rem)] gap-0 border border-stone-200/18 bg-[#071d1a]/72">
        {/* Left — role list */}
        <div className="flex w-60 shrink-0 flex-col border-r border-stone-200/15">
          <div className="flex items-center gap-2 border-b border-stone-200/12 px-3 py-2.5">
            <Users2 size={13} className="text-stone-400" />
            <span className="text-[11px] uppercase tracking-[0.14em] text-stone-400">Roles</span>
            <span className="ml-1 font-mono text-[10px] text-stone-600">{roles.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {roles.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <p className="text-xs text-stone-500">No roles yet.</p>
              </div>
            ) : (
              roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedId(role.id)}
                  className={[
                    'w-full border-b border-stone-200/8 px-3 py-2.5 text-left transition-colors',
                    role.id === selectedId
                      ? 'bg-emerald-950/60'
                      : 'hover:bg-white/5',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${slugColor(role.slug)}`}>
                      {role.slug}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-stone-200">{role.name}</p>
                  {role.skills.length > 0 && (
                    <p className="mt-0.5 truncate text-[10px] text-stone-500">
                      {role.skills.slice(0, 3).join(' · ')}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>

          {/* List footer */}
          <div className="border-t border-stone-200/12 p-3 space-y-2">
            <button
              onClick={handleAdd}
              className="flex w-full items-center gap-1.5 border border-dashed border-stone-200/18 px-3 py-1.5 text-xs text-stone-400 hover:border-emerald-300/30 hover:text-emerald-200"
            >
              <Plus size={11} />
              Add Role
            </button>
            {roles.length === 0 && (
              <button
                onClick={handleInitDefaults}
                className="flex w-full items-center justify-center gap-1.5 border border-stone-200/18 px-3 py-1.5 text-xs text-stone-300 hover:bg-white/5"
              >
                Initialize 5 Defaults
              </button>
            )}
          </div>
        </div>

        {/* Right — detail panel */}
        <div className="flex-1 overflow-y-auto">
          {selectedRole ? (
            <DetailPanel
              key={selectedRole.id}
              role={selectedRole}
              agents={agents}
              onSave={handleSave}
              onDelete={() => handleDelete(selectedRole.id)}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-stone-500">
                {roles.length === 0
                  ? 'Click "Add Role" or "Initialize 5 Defaults" to get started.'
                  : 'Select a role to edit.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
