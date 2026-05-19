'use client';

import { useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import {
  ChevronRight,
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  openPath,
  readFile,
  skillList,
  skillSave,
  skillUninstall,
} from '../../../lib/bridge';
import {
  buildSkillContent,
  parseCategorySlug,
  parseFrontmatter,
  slugify,
  type SkillForm as SkillFormType,
} from '../../../lib/skills/utils';

// ── Local types ───────────────────────────────────────────────────────────────

interface ParsedSkill {
  absPath: string;
  relPath: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  tags: string[];
  version: string;
  body: string;
  rawContent: string;
  modified: string;
}

// Use the shared SkillForm from utils (same shape, re-exported here for JSX use)
type SkillForm = SkillFormType;

interface SkillsViewProps {
  projectRoot: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  'workflow',
  'code-review',
  'testing',
  'deployment',
  'debugging',
  'planning',
  'architecture',
];

const BLANK_FORM: SkillForm = {
  name: '',
  category: 'workflow',
  customCategory: '',
  description: '',
  tagsRaw: '',
  version: '1.0.0',
  body: '## Overview\n\nDescribe what this skill does and when to use it.\n\n## Instructions\n\n1. Step one\n2. Step two\n',
};

const CATEGORY_COLORS: Record<string, string> = {
  workflow:     'text-amber-400/90  border-amber-400/30  bg-amber-400/10',
  'code-review':'text-sky-400/90    border-sky-400/30    bg-sky-400/10',
  testing:      'text-emerald-400/90 border-emerald-400/30 bg-emerald-400/10',
  deployment:   'text-violet-400/90 border-violet-400/30 bg-violet-400/10',
  debugging:    'text-rose-400/90   border-rose-400/30   bg-rose-400/10',
  planning:     'text-cyan-400/90   border-cyan-400/30   bg-cyan-400/10',
  architecture: 'text-orange-400/90 border-orange-400/30 bg-orange-400/10',
};

function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? 'text-stone-400/90 border-stone-400/30 bg-stone-400/10';
}

// ── Markdown renderer ──────────────────────────────────────────────────────────

const mdComponents: Components = {
  code({ className, children, ...props }) {
    const lang = /language-(\w+)/.exec(className ?? '')?.[1];
    const isBlock =
      !props.node?.position ||
      props.node.position.start.line !== props.node.position.end.line;
    if (isBlock && lang) {
      return (
        <pre className="rounded border border-stone-200/10 bg-black/30 px-3 py-2 text-[11px] overflow-x-auto my-2">
          <code className={className}>{children}</code>
        </pre>
      );
    }
    return (
      <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[11px] text-amber-300/90" {...props}>
        {children}
      </code>
    );
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function SkillsView({ projectRoot }: SkillsViewProps) {
  const skillsDir = projectRoot ? `${projectRoot}/.agents/skills` : '';

  const [skills, setSkills] = useState<ParsedSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [detailSkill, setDetailSkill] = useState<ParsedSkill | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState<ParsedSkill | null>(null);
  const [form, setForm] = useState<SkillForm>(BLANK_FORM);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ParsedSkill | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null); // ← FIX: dedicated state
  const [deleting, setDeleting] = useState(false);

  // ── Load skills ────────────────────────────────────────────────────────────

  const loadSkills = useCallback(async () => {
    if (!skillsDir) return;
    setLoading(true);
    setError(null);
    try {
      const files = await skillList(skillsDir);
      const parsed: ParsedSkill[] = [];
      await Promise.all(
        files.map(async (f) => {
          try {
            const raw = await readFile(f.absPath);
            const { name, description, version, tags, body } = parseFrontmatter(raw);
            const { category, slug } = parseCategorySlug(f.relPath);
            parsed.push({
              absPath: f.absPath,
              relPath: f.relPath,
              name: name || slug,
              slug,
              category,
              description,
              tags,
              version,
              body,
              rawContent: raw,
              modified: f.modified,
            });
          } catch {
            const { category, slug } = parseCategorySlug(f.relPath);
            parsed.push({
              absPath: f.absPath,
              relPath: f.relPath,
              name: slug,
              slug,
              category,
              description: '',
              tags: [],
              version: '1.0.0',
              body: '',
              rawContent: '',
              modified: f.modified,
            });
          }
        }),
      );
      parsed.sort((a, b) =>
        a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
      );
      setSkills(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [skillsDir]);

  // Clear stale skills immediately when the project changes so the user cannot
  // interact with cards from a previous project while the new list is loading.
  useEffect(() => {
    setSkills([]);
    setDetailSkill(null);
    setDeleteTarget(null);
    setDeleteError(null);
    setSaveError(null);
  }, [skillsDir]);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  // ── Filtered view ─────────────────────────────────────────────────────────

  const filtered = skills.filter((s) => {
    if (selectedCategory && s.category !== selectedCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)) ||
        s.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const categories = Array.from(new Set(skills.map((s) => s.category))).sort();
  const countByCategory = Object.fromEntries(
    categories.map((cat) => [cat, skills.filter((s) => s.category === cat).length]),
  );

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function openCreate() {
    setEditingSkill(null);
    setForm(BLANK_FORM);
    setSaveError(null);
    setShowModal(true);
  }

  function openEdit(skill: ParsedSkill) {
    const isCustomCat = !DEFAULT_CATEGORIES.includes(skill.category);
    setEditingSkill(skill);
    setForm({
      name: skill.name,
      category: isCustomCat ? '__custom__' : skill.category,
      customCategory: isCustomCat ? skill.category : '',
      description: skill.description,
      tagsRaw: skill.tags.join(', '),
      version: skill.version,
      body: skill.body,
    });
    setSaveError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingSkill(null);
    setSaveError(null);
  }

  function openDeleteConfirm(skill: ParsedSkill) {
    setDeleteTarget(skill);
    setDeleteError(null); // ← FIX: clear previous error on open
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!skillsDir) return;
    const name = form.name.trim();
    if (!name) { setSaveError('Name is required.'); return; }

    const category =
      form.category === '__custom__' ? form.customCategory.trim() : form.category;
    if (!category) { setSaveError('Category is required.'); return; }

    setSaving(true);
    setSaveError(null);
    try {
      const slug = editingSkill?.slug ?? slugify(name);
      const absPath = `${skillsDir}/${category}/${slug}/SKILL.md`;
      const content = buildSkillContent({ ...form, category });
      await skillSave(absPath, skillsDir, content);

      if (editingSkill && editingSkill.absPath !== absPath) {
        try {
          await skillUninstall(editingSkill.absPath, skillsDir);
        } catch {
          /* best-effort cleanup */
        }
      }

      closeModal();
      await loadSkills();

      if (detailSkill && editingSkill && detailSkill.absPath === editingSkill.absPath) {
        setDetailSkill(null);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget || !skillsDir) return;
    setDeleting(true);
    setDeleteError(null); // ← FIX: clear before attempting
    try {
      await skillUninstall(deleteTarget.absPath, skillsDir);
      if (detailSkill?.absPath === deleteTarget.absPath) setDetailSkill(null);
      setDeleteTarget(null); // closes modal on success
      await loadSkills();
    } catch (e) {
      // ← FIX: write to deleteError, NOT saveError
      setDeleteError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!projectRoot) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[12px] text-stone-500">
          Select a project to manage its skills.
        </p>
      </div>
    );
  }

  return (
    <div className="flex -mx-5 -my-5" style={{ minHeight: 'calc(100vh - 6.5rem)' }}>
      {/* ── Category sidebar ────────────────────────────────────────────── */}
      <aside
        className="w-[168px] shrink-0 border-r border-stone-200/15 flex flex-col overflow-y-auto"
        style={{ background: 'var(--pm-sidebar)' }}
      >
        <div className="px-4 pt-4 pb-2">
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-stone-500/70">
            Categories
          </p>
        </div>

        <button
          onClick={() => setSelectedCategory(null)}
          className={[
            'mx-2 flex h-8 items-center justify-between px-2.5 text-[11px] font-medium tracking-[0.05em] transition-colors',
            selectedCategory === null
              ? 'border border-stone-100/60 text-stone-50'
              : 'border border-transparent text-stone-400/80 hover:border-stone-200/15 hover:bg-white/5 hover:text-stone-200',
          ].join(' ')}
          style={selectedCategory === null ? { background: 'var(--pm-active-bg)' } : undefined}
        >
          <span>All skills</span>
          <span className="text-[10px] text-stone-500">{skills.length}</span>
        </button>

        <div className="mt-1 flex flex-col gap-0.5 px-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={[
                'mx-2 flex h-8 items-center justify-between px-2.5 text-[11px] font-medium tracking-[0.05em] transition-colors',
                selectedCategory === cat
                  ? 'border border-stone-100/60 text-stone-50'
                  : 'border border-transparent text-stone-400/80 hover:border-stone-200/15 hover:bg-white/5 hover:text-stone-200',
              ].join(' ')}
              style={selectedCategory === cat ? { background: 'var(--pm-active-bg)' } : undefined}
            >
              <span className="truncate">{cat}</span>
              <span className="shrink-0 text-[10px] text-stone-500">{countByCategory[cat]}</span>
            </button>
          ))}
        </div>

        <div className="flex-1" />
        <div className="px-4 py-3">
          <p className="text-[9px] leading-snug text-stone-600/60">
            Categories are created automatically when you add a skill.
          </p>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-w-0 flex-col">

        {/* Top bar */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-stone-200/15 px-4">
          <Sparkles size={13} className="shrink-0 text-amber-400/70" />
          <span className="text-[11px] font-semibold text-stone-300/80 tracking-[0.08em] uppercase">
            Skills
          </span>
          <span className="text-[10px] text-stone-500/60">
            {selectedCategory ? `· ${selectedCategory}` : ''}
          </span>

          <div className="flex-1" />

          <div className="relative">
            <input
              type="text"
              placeholder="Search skills…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 w-52 rounded border border-stone-200/15 bg-white/5 px-2.5 pr-7 text-[11px] text-stone-300 placeholder-stone-600/60 outline-none focus:border-stone-200/30 focus:bg-white/8 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
              >
                <X size={11} />
              </button>
            )}
          </div>

          <button
            onClick={() => void loadSkills()}
            disabled={loading}
            title="Refresh"
            className="flex h-7 w-7 items-center justify-center rounded border border-stone-200/15 text-stone-400 hover:bg-white/8 hover:text-stone-200 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={openCreate}
            className="flex h-7 items-center gap-1.5 rounded border border-amber-400/30 bg-amber-400/10 px-2.5 text-[11px] font-medium text-amber-300/90 hover:bg-amber-400/20 transition-colors"
          >
            <Plus size={12} />
            New Skill
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-3 rounded border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </div>
        )}

        {/* Card grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && skills.length === 0 && (
            <p className="text-[12px] text-stone-500 animate-pulse">Loading skills…</p>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Sparkles size={24} className="text-stone-600" />
              <p className="text-[12px] text-stone-500">
                {search
                  ? `No skills match "${search}"`
                  : selectedCategory
                  ? `No skills in "${selectedCategory}" yet`
                  : 'No skills yet — create your first one!'}
              </p>
              {!search && (
                <button
                  onClick={openCreate}
                  className="mt-1 flex items-center gap-1.5 rounded border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[11px] text-amber-300/90 hover:bg-amber-400/20 transition-colors"
                >
                  <Plus size={11} /> New Skill
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((skill) => (
              <SkillCard
                key={skill.absPath}
                skill={skill}
                isActive={detailSkill?.absPath === skill.absPath}
                onClick={() =>
                  setDetailSkill((prev) =>
                    prev?.absPath === skill.absPath ? null : skill,
                  )
                }
                onEdit={() => openEdit(skill)}
                onDelete={() => openDeleteConfirm(skill)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Detail panel ────────────────────────────────────────────────── */}
      <DetailPanel
        skill={detailSkill}
        onClose={() => setDetailSkill(null)}
        onEdit={() => detailSkill && openEdit(detailSkill)}
        onDelete={() => detailSkill && openDeleteConfirm(detailSkill)}
      />

      {/* ── Create / Edit modal ──────────────────────────────────────────── */}
      {showModal && (
        <SkillModal
          form={form}
          isEditing={editingSkill !== null}
          saving={saving}
          error={saveError}
          onChange={setForm}
          onSave={() => void handleSave()}
          onClose={closeModal}
        />
      )}

      {/* ── Delete confirm modal ─────────────────────────────────────────── */}
      {deleteTarget && (
        <DeleteConfirmModal
          skill={deleteTarget}
          deleting={deleting}
          error={deleteError}
          onConfirm={() => void handleDelete()}
          onCancel={() => { setDeleteTarget(null); setDeleteError(null); }}
        />
      )}
    </div>
  );
}

// ── SkillCard ──────────────────────────────────────────────────────────────────

function SkillCard({
  skill,
  isActive,
  onClick,
  onEdit,
  onDelete,
}: {
  skill: ParsedSkill;
  isActive: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const colorClass = categoryColor(skill.category);

  return (
    <div
      onClick={onClick}
      className={[
        'group relative flex cursor-pointer flex-col gap-2 rounded border p-3.5 transition-all',
        isActive
          ? 'border-amber-400/40 bg-amber-400/8'
          : 'border-stone-200/12 bg-white/3 hover:border-stone-200/20 hover:bg-white/5',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex-1 text-[12px] font-semibold leading-snug text-stone-100 min-w-0 truncate">
          {skill.name}
        </h3>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            title="Edit"
            className="flex h-5 w-5 items-center justify-center rounded text-stone-400 hover:bg-white/10 hover:text-stone-200 transition-colors"
          >
            <Pencil size={10} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete"
            className="flex h-5 w-5 items-center justify-center rounded text-stone-400 hover:bg-rose-400/15 hover:text-rose-400 transition-colors"
          >
            <Trash2 size={10} />
          </button>
        </div>
      </div>

      <span
        className={`inline-flex w-fit items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] ${colorClass}`}
      >
        {skill.category}
      </span>

      {skill.description && (
        <p className="line-clamp-2 text-[11px] leading-relaxed text-stone-400/80">
          {skill.description}
        </p>
      )}

      {skill.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {skill.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-0.5 rounded bg-stone-200/8 px-1.5 py-0.5 text-[9px] text-stone-400/70"
            >
              <Tag size={8} className="shrink-0" />
              {tag}
            </span>
          ))}
          {skill.tags.length > 4 && (
            <span className="text-[9px] text-stone-500/60">+{skill.tags.length - 4}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] text-stone-600/50">v{skill.version}</span>
        <ChevronRight
          size={10}
          className={`transition-colors ${isActive ? 'text-amber-400/70' : 'text-stone-600/40 group-hover:text-stone-400/60'}`}
        />
      </div>
    </div>
  );
}

// ── DetailPanel ────────────────────────────────────────────────────────────────

function DetailPanel({
  skill,
  onClose,
  onEdit,
  onDelete,
}: {
  skill: ParsedSkill | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      {skill && (
        <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      )}
      <div
        className={[
          'fixed inset-y-0 right-0 z-50 flex w-[520px] max-w-[90vw] flex-col border-l border-stone-200/15 shadow-2xl transition-transform duration-200',
          skill ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        style={{ background: 'var(--pm-sidebar)' }}
      >
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-stone-200/15 px-4">
          <div className="flex-1 min-w-0">
            <p className="truncate text-[12px] font-semibold text-stone-100">{skill?.name}</p>
            <p className="text-[9px] text-stone-500/70 font-mono truncate">{skill?.relPath}</p>
          </div>
          <button onClick={onEdit} title="Edit skill"
            className="flex h-7 items-center gap-1.5 rounded border border-stone-200/15 px-2 text-[10px] text-stone-400 hover:bg-white/8 hover:text-stone-200 transition-colors">
            <Pencil size={10} /> Edit
          </button>
          <button onClick={onDelete} title="Delete skill"
            className="flex h-7 w-7 items-center justify-center rounded border border-stone-200/15 text-stone-400 hover:bg-rose-400/15 hover:text-rose-400 transition-colors">
            <Trash2 size={11} />
          </button>
          <button onClick={() => skill && void openPath(skill.absPath).catch(() => {})} title="Open in editor"
            className="flex h-7 w-7 items-center justify-center rounded border border-stone-200/15 text-stone-400 hover:bg-white/8 hover:text-stone-200 transition-colors">
            <ExternalLink size={11} />
          </button>
          <button onClick={onClose} title="Close (Esc)"
            className="flex h-7 w-7 items-center justify-center rounded border border-stone-200/15 text-stone-400 hover:bg-white/8 hover:text-stone-200 transition-colors">
            <X size={12} />
          </button>
        </div>

        {skill && (
          <div className="flex items-center gap-2 border-b border-stone-200/10 px-4 py-2">
            <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] ${categoryColor(skill.category)}`}>
              {skill.category}
            </span>
            <span className="font-mono text-[10px] text-stone-500">v{skill.version}</span>
            {skill.tags.map((tag) => (
              <span key={tag} className="flex items-center gap-0.5 rounded bg-stone-200/8 px-1.5 py-0.5 text-[9px] text-stone-400/70">
                <Tag size={8} className="shrink-0" />{tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {skill?.description && (
            <p className="mb-4 text-[12px] text-stone-400/80 leading-relaxed italic border-l-2 border-amber-400/30 pl-3">
              {skill.description}
            </p>
          )}
          {skill?.body && (
            <div className="pm-prose">
              <ReactMarkdown components={mdComponents}>{skill.body}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── SkillModal ────────────────────────────────────────────────────────────────

function SkillModal({
  form,
  isEditing,
  saving,
  error,
  onChange,
  onSave,
  onClose,
}: {
  form: SkillForm;
  isEditing: boolean;
  saving: boolean;
  error: string | null;
  onChange: (f: SkillForm) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const allCategories = DEFAULT_CATEGORIES;
  const effectiveCategory =
    form.category === '__custom__' ? form.customCategory : form.category;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const set = (key: keyof SkillForm, val: string) =>
    onChange({ ...form, [key]: val });

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="fixed left-1/2 top-1/2 z-[60] w-[640px] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded border border-stone-200/15 shadow-2xl flex flex-col max-h-[90vh]"
        style={{ background: 'var(--pm-sidebar)' }}
      >
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-stone-200/15 px-4">
          <Sparkles size={13} className="shrink-0 text-amber-400/70" />
          <span className="flex-1 text-[12px] font-semibold text-stone-100">
            {isEditing ? 'Edit Skill' : 'New Skill'}
          </span>
          <button onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded border border-stone-200/15 text-stone-400 hover:bg-white/8 hover:text-stone-200 transition-colors">
            <X size={12} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block mb-1 text-[10px] font-medium tracking-[0.08em] uppercase text-stone-500">
                Name <span className="text-rose-400">*</span>
              </label>
              <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. TDD Feature Dev"
                className="w-full h-8 rounded border border-stone-200/15 bg-white/5 px-2.5 text-[12px] text-stone-200 placeholder-stone-600/60 outline-none focus:border-stone-200/30 transition-colors" />
            </div>
            <div className="w-24">
              <label className="block mb-1 text-[10px] font-medium tracking-[0.08em] uppercase text-stone-500">Version</label>
              <input type="text" value={form.version} onChange={(e) => set('version', e.target.value)}
                placeholder="1.0.0"
                className="w-full h-8 rounded border border-stone-200/15 bg-white/5 px-2.5 text-[12px] text-stone-200 placeholder-stone-600/60 outline-none focus:border-stone-200/30 transition-colors" />
            </div>
          </div>

          <div>
            <label className="block mb-1 text-[10px] font-medium tracking-[0.08em] uppercase text-stone-500">
              Category <span className="text-rose-400">*</span>
            </label>
            <div className="flex gap-2">
              <select value={form.category} onChange={(e) => set('category', e.target.value)}
                className="h-8 flex-1 rounded border border-stone-200/15 bg-stone-900 px-2.5 text-[12px] text-stone-200 outline-none focus:border-stone-200/30 transition-colors">
                {allCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="__custom__">Custom…</option>
              </select>
              {form.category === '__custom__' && (
                <input type="text" value={form.customCategory} onChange={(e) => set('customCategory', e.target.value)}
                  placeholder="my-category"
                  className="h-8 w-36 rounded border border-stone-200/15 bg-white/5 px-2.5 text-[12px] text-stone-200 placeholder-stone-600/60 outline-none focus:border-stone-200/30 transition-colors" />
              )}
            </div>
            {effectiveCategory && (
              <p className="mt-1 text-[9px] text-stone-500/60 font-mono">
                saves to: .agents/skills/{effectiveCategory}/{slugify(form.name || 'skill')}/SKILL.md
              </p>
            )}
          </div>

          <div>
            <label className="block mb-1 text-[10px] font-medium tracking-[0.08em] uppercase text-stone-500">Description</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
              placeholder="One-line summary of when to use this skill." rows={2}
              className="w-full resize-none rounded border border-stone-200/15 bg-white/5 px-2.5 py-2 text-[12px] text-stone-200 placeholder-stone-600/60 outline-none focus:border-stone-200/30 transition-colors" />
          </div>

          <div>
            <label className="block mb-1 text-[10px] font-medium tracking-[0.08em] uppercase text-stone-500">
              Tags <span className="text-stone-600/60">(comma-separated)</span>
            </label>
            <input type="text" value={form.tagsRaw} onChange={(e) => set('tagsRaw', e.target.value)}
              placeholder="e.g. testing, tdd, workflow"
              className="w-full h-8 rounded border border-stone-200/15 bg-white/5 px-2.5 text-[12px] text-stone-200 placeholder-stone-600/60 outline-none focus:border-stone-200/30 transition-colors" />
          </div>

          <div>
            <label className="block mb-1 text-[10px] font-medium tracking-[0.08em] uppercase text-stone-500">
              Content <span className="text-stone-600/60">(Markdown)</span>
            </label>
            <textarea value={form.body} onChange={(e) => set('body', e.target.value)}
              rows={14} spellCheck={false}
              className="w-full resize-y rounded border border-stone-200/15 bg-white/5 px-3 py-2.5 font-mono text-[11px] text-stone-300 placeholder-stone-600/60 outline-none focus:border-stone-200/30 transition-colors"
              placeholder="# Skill Name&#10;&#10;Describe the skill..." />
          </div>

          {error && (
            <p className="rounded border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-[11px] text-rose-300">
              {error}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-stone-200/15 px-4 py-3">
          <button onClick={onClose}
            className="h-7 rounded border border-stone-200/15 px-3 text-[11px] text-stone-400 hover:bg-white/5 hover:text-stone-200 transition-colors">
            Cancel
          </button>
          <button onClick={onSave} disabled={saving}
            className="flex h-7 items-center gap-1.5 rounded border border-amber-400/30 bg-amber-400/10 px-3 text-[11px] font-medium text-amber-300/90 hover:bg-amber-400/20 transition-colors disabled:opacity-50">
            {saving
              ? <><RefreshCw size={10} className="animate-spin" /> Saving…</>
              : isEditing ? 'Save changes' : 'Create skill'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── DeleteConfirmModal ────────────────────────────────────────────────────────

function DeleteConfirmModal({
  skill,
  deleting,
  error,         // ← FIX: new prop
  onConfirm,
  onCancel,
}: {
  skill: ParsedSkill;
  deleting: boolean;
  error: string | null;   // ← FIX: new prop type
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" onClick={onCancel} />
      <div
        data-testid="delete-confirm-modal"
        className="fixed left-1/2 top-1/2 z-[60] w-[380px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded border border-stone-200/15 shadow-2xl"
        style={{ background: 'var(--pm-sidebar)' }}
      >
        <div className="px-5 py-4 space-y-3">
          <p className="text-[13px] font-semibold text-stone-100">Delete skill</p>
          <p className="text-[12px] text-stone-400 leading-relaxed">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-stone-200">{skill.name}</span>?
            This cannot be undone.
          </p>
          <p className="font-mono text-[10px] text-stone-500/70 break-all">{skill.relPath}</p>

          {/* ← FIX: show deleteError here, inside this modal */}
          {error && (
            <p
              role="alert"
              className="rounded border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-[11px] text-rose-300"
            >
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={onCancel}
              className="h-7 rounded border border-stone-200/15 px-3 text-[11px] text-stone-400 hover:bg-white/5 hover:text-stone-200 transition-colors">
              Cancel
            </button>
            <button onClick={onConfirm} disabled={deleting}
              className="flex h-7 items-center gap-1.5 rounded border border-rose-400/40 bg-rose-400/10 px-3 text-[11px] font-medium text-rose-400 hover:bg-rose-400/20 transition-colors disabled:opacity-50">
              {deleting
                ? <><RefreshCw size={10} className="animate-spin" /> Deleting…</>
                : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
