'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileText,
  Folder,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MermaidBlock from '../../../components/MermaidBlock';
import type {
  DocumentationClassification,
  DocumentationDoc,
  DocumentationFolder,
  DocumentationSiteManifest,
} from '../../../lib/documentation/types';

interface DocumentationViewProps {
  manifest: DocumentationSiteManifest;
  initialSlug?: string[];
  standalone?: boolean;
}

type ClassificationFilter = DocumentationClassification | 'all';

const classificationStyles: Record<DocumentationClassification, string> = {
  public: 'border-emerald-500/30 bg-emerald-950/40 text-emerald-200',
  internal: 'border-amber-500/30 bg-amber-950/35 text-amber-200',
  restricted: 'border-red-500/30 bg-red-950/40 text-red-200',
};

const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const lang = /language-(\w+)/.exec(className ?? '')?.[1];
    const isBlock = !props.node?.position || props.node.position.start.line !== props.node.position.end.line;
    if (lang === 'mermaid' && isBlock) {
      return <MermaidBlock code={String(children).trim()} />;
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  a({ href, children }) {
    return (
      <a href={href} target={href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
        {children}
      </a>
    );
  },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function normalizeInitialSlug(slug: string[]) {
  return slug.join('/').replace(/^\/|\/$/g, '');
}

function classificationLabel(value: DocumentationClassification) {
  if (value === 'public') return 'Public';
  if (value === 'internal') return 'Internal';
  return 'Restricted';
}

function ClassificationBadge({ value }: { value: DocumentationClassification }) {
  return (
    <span className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-medium ${classificationStyles[value]}`}>
      {classificationLabel(value)}
    </span>
  );
}

function FolderNavItem({
  folder,
  activeSlug,
  onSelect,
}: {
  folder: DocumentationFolder;
  activeSlug: string;
  onSelect: (folder: DocumentationFolder) => void;
}) {
  const depth = folder.slug ? folder.slug.split('/').length - 1 : 0;
  const active = folder.slug === activeSlug;
  return (
    <a
      href={folder.route}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onSelect(folder);
        window.history.pushState(null, '', folder.route);
      }}
      className={[
        'flex min-h-8 items-center gap-2 border-l px-3 py-2 text-[11px] transition-colors',
        active
          ? 'border-emerald-300/70 bg-emerald-950/35 text-stone-100'
          : 'border-transparent text-stone-400 hover:border-stone-200/20 hover:bg-white/5 hover:text-stone-200',
      ].join(' ')}
      style={{ paddingLeft: `${12 + depth * 14}px` }}
    >
      <Folder size={12} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{folder.label}</span>
      <span className="font-mono text-[10px] text-stone-600">
        {folder.classificationCounts.public + folder.classificationCounts.internal + folder.classificationCounts.restricted}
      </span>
    </a>
  );
}

function DocumentListItem({
  doc,
  active,
  onSelect,
}: {
  doc: DocumentationDoc;
  active: boolean;
  onSelect: (doc: DocumentationDoc) => void;
}) {
  return (
    <a
      href={doc.route}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onSelect(doc);
        window.history.pushState(null, '', doc.route);
      }}
      className={[
        'block border-b border-stone-200/8 px-4 py-3 transition-colors last:border-0',
        active ? 'bg-white/7' : 'hover:bg-white/4',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <FileText size={13} className="mt-0.5 shrink-0 text-stone-500" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[13px] font-semibold text-stone-100">{doc.title}</h3>
            <ClassificationBadge value={doc.classification} />
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-stone-400">{doc.summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-stone-600">
            <span className="font-mono">{doc.sourcePath}</span>
            <span>{doc.readingMinutes} min read</span>
            {doc.warnings.length > 0 && (
              <span className="text-amber-300/80">{doc.warnings.length} review flag{doc.warnings.length === 1 ? '' : 's'}</span>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}

function SyncPreview({ manifest }: { manifest: DocumentationSiteManifest }) {
  const { sync } = manifest;
  return (
    <aside className="hidden w-[300px] shrink-0 border-l border-stone-200/10 xl:block">
      <div className="border-b border-stone-200/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <RefreshCw size={13} className="text-stone-500" />
          <h2 className="text-[12px] font-semibold text-stone-100">Sync Preview</h2>
        </div>
        <p className="mt-1 text-[11px] leading-5 text-stone-500">
          Static manifest generated from <span className="font-mono">docs/</span>. Re-run sync after folder or file changes.
        </p>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="border border-stone-200/10 bg-white/5 p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-stone-500">Docs</p>
            <p className="mt-1 text-lg font-semibold text-stone-100">{sync.totalDocuments}</p>
          </div>
          <div className="border border-stone-200/10 bg-white/5 p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-stone-500">Folders</p>
            <p className="mt-1 text-lg font-semibold text-stone-100">{sync.totalFolders}</p>
          </div>
        </div>

        <div className="space-y-2 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-stone-500">Public candidates</span>
            <span className="text-emerald-200">{sync.publicDocuments}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-500">Internal docs</span>
            <span className="text-amber-200">{sync.internalDocuments}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-500">Review flags</span>
            <span className={sync.warningCount > 0 ? 'text-amber-200' : 'text-emerald-200'}>
              {sync.warningCount}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-500">Mode</span>
            <span className="font-mono text-stone-300">{sync.mode}</span>
          </div>
        </div>

        <div className="border border-stone-200/10 bg-black/20 p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={12} className="text-emerald-300" />
            <span className="text-[11px] font-medium text-stone-200">Generated</span>
          </div>
          <p className="mt-1 text-[11px] text-stone-500">{formatDate(sync.generatedAt)}</p>
          <p className="mt-3 font-mono text-[10px] leading-5 text-stone-500">
            npm run docs:site:sync
            <br />
            npm run docs:site:watch
          </p>
        </div>

        <div className="border border-amber-500/20 bg-amber-950/20 p-3">
          <div className="flex items-start gap-2">
            <ShieldAlert size={13} className="mt-0.5 shrink-0 text-amber-300" />
            <p className="text-[11px] leading-5 text-amber-100/80">
              Public publishing uses the public manifest only. Internal and restricted content is excluded from the public route bundle.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function DocumentationView({ manifest, initialSlug = [], standalone = false }: DocumentationViewProps) {
  const initialPath = normalizeInitialSlug(initialSlug);
  const initialDoc = manifest.docs.find((doc) => doc.slug === initialPath);
  const initialFolder =
    manifest.folders.find((folder) => folder.slug === initialPath) ??
    manifest.folders.find((folder) => folder.slug === initialDoc?.folderSlug) ??
    manifest.folders[0];

  const [activeFolderSlug, setActiveFolderSlug] = useState(initialFolder?.slug ?? '');
  const [activeDocId, setActiveDocId] = useState(initialDoc?.id ?? '');
  const [query, setQuery] = useState('');
  const [classification, setClassification] = useState<ClassificationFilter>('all');

  useEffect(() => {
    const applyLocation = () => {
      const slug = window.location.pathname.replace(/^\/documentation\/?/, '').replace(/\/$/, '');
      const routeDoc = manifest.docs.find((doc) => doc.slug === slug);
      const routeFolder =
        manifest.folders.find((folder) => folder.slug === slug) ??
        manifest.folders.find((folder) => folder.slug === routeDoc?.folderSlug);
      if (routeFolder) setActiveFolderSlug(routeFolder.slug);
      setActiveDocId(routeDoc?.id ?? '');
    };

    window.addEventListener('popstate', applyLocation);
    return () => window.removeEventListener('popstate', applyLocation);
  }, [manifest]);

  const activeFolder = manifest.folders.find((folder) => folder.slug === activeFolderSlug) ?? manifest.folders[0];
  const activeDoc = manifest.docs.find((doc) => doc.id === activeDocId);

  const visibleDocs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return manifest.docs.filter((doc) => {
      const inFolder =
        activeFolder.slug === '' ||
        doc.folderSlug === activeFolder.slug ||
        doc.folderSlug.startsWith(`${activeFolder.slug}/`);
      const matchesClassification = classification === 'all' || doc.classification === classification;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        `${doc.title} ${doc.summary} ${doc.sourcePath} ${doc.tags.join(' ')}`.toLowerCase().includes(normalizedQuery);
      return inFolder && matchesClassification && matchesQuery;
    });
  }, [activeFolder.slug, query, classification, manifest]);

  const folderDocs = visibleDocs.filter((doc) => doc.folderSlug === activeFolder.slug);
  const selectedDoc = activeDoc && visibleDocs.some((doc) => doc.id === activeDoc.id) ? activeDoc : folderDocs[0] ?? visibleDocs[0];

  const selectFolder = (folder: DocumentationFolder) => {
    setActiveFolderSlug(folder.slug);
    setActiveDocId('');
  };

  const containerClass = standalone
    ? 'min-h-screen text-stone-100'
    : 'flex h-full min-h-0 flex-col overflow-hidden text-stone-100';
  const frameClass = standalone ? 'flex min-h-screen flex-col overflow-hidden' : 'flex h-full min-h-0 flex-col overflow-hidden';

  return (
    <div className={containerClass} style={standalone ? { background: 'var(--pm-bg)' } : undefined}>
      <div className={frameClass}>
        <header className="shrink-0 border-b border-stone-200/10 bg-black/10 px-5 py-4">
          {standalone && (
            <a
              href="/"
              className="mb-3 inline-flex items-center gap-1.5 text-[11px] text-stone-500 transition-colors hover:text-stone-300"
            >
              <ArrowLeft size={12} />
              Back to App
            </a>
          )}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BookOpen size={15} className="text-amber-100/80" />
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">
                  Project Manager Documentation
                </p>
              </div>
              <h1 className="mt-2 text-xl font-semibold text-stone-50">Docs Site Preview</h1>
              <p className="mt-1 max-w-3xl text-[12px] leading-5 text-stone-400">
                Generated from repo Markdown under <span className="font-mono text-stone-300">docs/</span>, with folder pages, document routes, classification labels, and review flags for future public publishing.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="border border-stone-200/10 bg-white/5 px-2 py-1 text-stone-400">
                {manifest.sync.totalDocuments} docs
              </span>
              <span className="border border-stone-200/10 bg-white/5 px-2 py-1 text-stone-400">
                {manifest.sync.totalFolders} folders
              </span>
              <span className="border border-stone-200/10 bg-white/5 px-2 py-1 text-stone-400">
                {manifest.sync.manifestAudience}
              </span>
              <span className="border border-stone-200/10 bg-white/5 px-2 py-1 text-stone-400">
                {formatDate(manifest.sync.generatedAt)}
              </span>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-stone-200/10 bg-black/10 py-3 md:block">
            <div className="px-3 pb-3">
              <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                Folders
              </p>
              {manifest.folders.map((folder) => (
                <FolderNavItem
                  key={folder.id}
                  folder={folder}
                  activeSlug={activeFolder.slug}
                  onSelect={selectFolder}
                />
              ))}
            </div>
          </aside>

          <main className="flex min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
            <section className="flex max-h-[42vh] w-full shrink-0 flex-col border-b border-stone-200/10 md:max-h-none md:w-[390px] md:max-w-[42vw] md:border-b-0 md:border-r">
              <div className="shrink-0 border-b border-stone-200/10 p-4">
                <h2 className="text-[14px] font-semibold text-stone-100">{activeFolder.title}</h2>
                <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-stone-500">{activeFolder.summary}</p>

                <div className="mt-3 flex items-center gap-2 border border-stone-200/10 bg-black/20 px-2 py-1.5">
                  <Search size={12} className="text-stone-600" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search docs"
                    className="min-w-0 flex-1 bg-transparent text-[12px] text-stone-200 outline-none placeholder:text-stone-600"
                  />
                </div>

                <div className="mt-3 grid grid-cols-4 gap-1">
                  {(['all', 'public', 'internal', 'restricted'] as ClassificationFilter[]).map((item) => (
                    <button
                      type="button"
                      key={item}
                      onClick={() => setClassification(item)}
                      className={[
                        'border px-2 py-1 text-[10px] capitalize transition-colors',
                        classification === item
                          ? 'border-stone-100/50 bg-white/10 text-stone-100'
                          : 'border-stone-200/10 text-stone-500 hover:border-stone-200/25 hover:text-stone-300',
                      ].join(' ')}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {visibleDocs.length === 0 ? (
                  <div className="p-5 text-[12px] text-stone-500">No documentation matches the current filter.</div>
                ) : (
                  visibleDocs.map((doc) => (
                    <DocumentListItem
                      key={doc.id}
                      doc={doc}
                      active={selectedDoc?.id === doc.id}
                      onSelect={(selected) => {
                        setActiveDocId(selected.id);
                        setActiveFolderSlug(selected.folderSlug);
                      }}
                    />
                  ))
                )}
              </div>
            </section>

            <article className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
              {selectedDoc ? (
                <>
                  <div className="mb-5 border-b border-stone-200/10 pb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <ClassificationBadge value={selectedDoc.classification} />
                      {selectedDoc.tags.map((tag) => (
                        <span key={tag} className="border border-stone-200/10 bg-white/5 px-2 py-0.5 text-[10px] text-stone-400">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold text-stone-50">{selectedDoc.title}</h2>
                    <p className="mt-2 max-w-4xl text-[13px] leading-6 text-stone-400">{selectedDoc.summary}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-stone-600">
                      <span className="font-mono">{selectedDoc.sourcePath}</span>
                      <span className="flex items-center gap-1">
                        <Clock3 size={11} />
                        {selectedDoc.readingMinutes} min
                      </span>
                      <span>Updated {formatDate(selectedDoc.updatedAt)}</span>
                      <span>{Math.round(selectedDoc.classificationConfidence * 100)}% classification confidence</span>
                      <a href={selectedDoc.route} className="text-cyan-300/80 hover:text-cyan-200">
                        Permanent page
                      </a>
                    </div>
                  </div>

                  {selectedDoc.warnings.length > 0 && (
                    <div className="mb-5 border border-amber-500/20 bg-amber-950/20 p-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={13} className="text-amber-300" />
                        <p className="text-[12px] font-semibold text-amber-100">Review Before Public Publishing</p>
                      </div>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] leading-5 text-amber-100/80">
                        {selectedDoc.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="pm-prose max-w-5xl">
                    <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                      {selectedDoc.content}
                    </ReactMarkdown>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-[12px] text-stone-500">
                  Select a document to preview.
                </div>
              )}
            </article>

            <SyncPreview manifest={manifest} />
          </main>
        </div>
      </div>
    </div>
  );
}
