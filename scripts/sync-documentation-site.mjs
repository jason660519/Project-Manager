#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');
const docsRoot = path.join(repoRoot, 'docs');
const generatedRoot = path.join(repoRoot, 'lib/generated');
const internalOutputPath = path.join(generatedRoot, 'documentation-site-internal.ts');
const publicOutputPath = path.join(generatedRoot, 'documentation-site-public.ts');
const compatibilityOutputPath = path.join(generatedRoot, 'documentation-site.ts');
const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');
const watchMode = args.has('--watch');

const generatorVersion = '2.0.0';

const classificationPolicies = [
  {
    id: 'CLS-PUBLIC-GUIDES',
    prefixes: ['guides'],
    classification: 'public',
    audience: ['users', 'customers'],
    confidence: 0.95,
    reason: 'User-facing guides and tutorials are intended for public distribution when no sensitive content is detected.',
  },
  {
    id: 'CLS-INTERNAL-PRODUCT',
    prefixes: ['product'],
    classification: 'internal',
    audience: ['team', 'product'],
    confidence: 0.96,
    reason: 'Product strategy documents (PRDs, competitive analysis, target audience) are internal planning records.',
  },
  {
    id: 'CLS-PUBLIC-DESIGN',
    prefixes: ['design'],
    classification: 'public',
    audience: ['users', 'product', 'designers'],
    confidence: 0.9,
    reason: 'Design guidance can be public when it describes product-facing UX language rather than internal operations.',
  },
  {
    id: 'CLS-PUBLIC-DEPLOYMENT',
    prefixes: ['deployment'],
    classification: 'public',
    audience: ['operators', 'technical-users'],
    confidence: 0.9,
    reason: 'Deployment overview content can be public when it does not include credentials or private infrastructure detail.',
  },
  {
    id: 'CLS-PUBLIC-INTEGRATIONS',
    prefixes: ['integrations'],
    classification: 'public',
    audience: ['technical-users', 'partners'],
    confidence: 0.88,
    reason: 'Integration contracts can be public when they describe supported behavior and omit secrets or private runtime state.',
  },
  {
    id: 'CLS-INTERNAL-ARCHITECTURE',
    prefixes: ['architecture'],
    classification: 'internal',
    audience: ['engineers', 'technical-reviewers'],
    confidence: 0.92,
    reason: 'Architecture decisions usually contain internal tradeoffs and implementation constraints.',
  },
  {
    id: 'CLS-INTERNAL-ENGINEERING',
    prefixes: ['engineering'],
    classification: 'internal',
    audience: ['engineers', 'operators'],
    confidence: 0.95,
    reason: 'Engineering runbooks and implementation contracts are internal by default.',
  },
  {
    id: 'CLS-INTERNAL-PROCESS',
    prefixes: ['project-process', 'archive', 'dev-logs', 'features'],
    classification: 'internal',
    audience: ['team', 'operators'],
    confidence: 0.96,
    reason: 'Project process, logs, archive, and feature-tracking docs are internal operating records.',
  },
];

const restrictedPatterns = [
  { pattern: /(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,})/, warning: 'Contains a token-like secret value' },
  { pattern: /-----BEGIN (RSA |OPENSSH |EC |DSA |PRIVATE )?PRIVATE KEY-----/, warning: 'Contains private key material' },
  { pattern: /\b(password|token|secret|api[_ -]?key)\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{12,}/i, warning: 'Contains credential assignment text' },
  { pattern: /\b(customer|client|tenant)\s+(data|record|address|phone|email|contract)\b/i, warning: 'Mentions customer-sensitive records' },
];

const reviewPatterns = [
  { pattern: /\b(api[_ -]?key|secret|token|credential|password)\b/i, warning: 'Mentions secrets, tokens, or credentials' },
  { pattern: /\b\.env\b/i, warning: 'Mentions environment files' },
  { pattern: /\blocalhost:\d+\b/i, warning: 'Mentions local service ports' },
  { pattern: /\bkeychain\b/i, warning: 'Mentions local key storage' },
  { pattern: /\bspawn|execute|command allowlist|approval policy\b/i, warning: 'Mentions execution or command policy' },
  { pattern: /\broadmap|pricing|investor|competitive strategy\b/i, warning: 'Mentions roadmap, pricing, investor, or strategy material' },
];

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function slugify(value) {
  return value
    .replace(/\.md$/i, '')
    .replace(/^README$/i, 'readme')
    .replace(/[^A-Za-z0-9/_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function titleize(value) {
  return value
    .replace(/\.md$/i, '')
    .replace(/^adr-(\d+)/i, 'ADR-$1')
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => {
      if (/^adr$/i.test(part)) return 'ADR';
      if (/^\d+$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

function readMarkdownFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      readMarkdownFiles(fullPath, out);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(fullPath);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function parseScalar(value) {
  const trimmed = value.trim().replace(/^["']|["']$/g, '');
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function parseFrontmatter(raw) {
  if (!raw.startsWith('---\n')) {
    return { data: {}, body: raw, hasFrontmatter: false };
  }
  const end = raw.indexOf('\n---', 4);
  if (end === -1) {
    return { data: {}, body: raw, hasFrontmatter: false };
  }
  const block = raw.slice(4, end).trim();
  const body = raw.slice(end + 4).replace(/^\n/, '');
  const data = {};
  for (const line of block.split('\n')) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
    if (!match) continue;
    const [, key, value] = match;
    data[key] = parseScalar(value);
  }
  return { data, body, hasFrontmatter: true };
}

function parseList(value, fallback) {
  if (!value) return fallback;
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractTitle(body, fallback) {
  const h1 = body.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].replace(/`/g, '').trim();
  return titleize(fallback);
}

function extractSummary(body) {
  const withoutMetadata = body
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return (
        trimmed &&
        !trimmed.startsWith('#') &&
        !trimmed.startsWith('>') &&
        !trimmed.startsWith('|') &&
        !trimmed.startsWith('---') &&
        !trimmed.startsWith('```')
      );
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!withoutMetadata) return 'Documentation page generated from the repo docs folder.';
  return withoutMetadata.length > 190 ? `${withoutMetadata.slice(0, 187).trim()}...` : withoutMetadata;
}

function detectMatches(content, patterns) {
  return patterns.filter(({ pattern }) => pattern.test(content)).map(({ warning }) => warning);
}

function getFolderPolicy(folderSlug) {
  const top = folderSlug.split('/')[0] || '';
  return (
    classificationPolicies.find((policy) => policy.prefixes.includes(top)) ?? {
      id: 'CLS-UNKNOWN-FOLDER',
      classification: 'internal',
      audience: ['team'],
      confidence: 0.55,
      reason: 'Folder is not covered by the classification standard, so it defaults to internal and needs review.',
    }
  );
}

function normalizeClassification(value) {
  const normalized = String(value ?? '').toLowerCase();
  return ['public', 'internal', 'restricted'].includes(normalized) ? normalized : null;
}

function normalizeReviewStatus(value, fallback) {
  const normalized = String(value ?? '').toLowerCase();
  return ['draft', 'ai-classified', 'review-required', 'approved'].includes(normalized) ? normalized : fallback;
}

function classifyDocument({ data, body, folderSlug, hasFrontmatter }) {
  const folderPolicy = getFolderPolicy(folderSlug);
  const restrictedWarnings = detectMatches(body, restrictedPatterns);
  const reviewWarnings = detectMatches(body, reviewPatterns);
  const explicitClassification = normalizeClassification(data.classification);
  const classificationSource = explicitClassification ? 'frontmatter' : 'policy';
  let classification = explicitClassification ?? folderPolicy.classification;
  let matchedPolicyRule = explicitClassification ? 'CLS-FRONTMATTER-OVERRIDE' : folderPolicy.id;
  let classificationReason =
    String(data.classificationReason ?? '') ||
    (explicitClassification ? 'Classification was explicitly set in document frontmatter.' : folderPolicy.reason);
  let classificationConfidence = Number(data.classificationConfidence ?? folderPolicy.confidence);

  if (restrictedWarnings.length > 0 && classification !== 'restricted') {
    classification = 'restricted';
    matchedPolicyRule = 'CLS-RESTRICTED-CONTENT';
    classificationReason = 'Restricted content indicators override lower classifications.';
    classificationConfidence = 0.99;
  }

  const unknownFolder = folderPolicy.id === 'CLS-UNKNOWN-FOLDER';
  const warnings = [...new Set([...restrictedWarnings, ...reviewWarnings])];
  if (!hasFrontmatter && unknownFolder) {
    warnings.push('No classification frontmatter and folder is not covered by the classification standard');
  }
  if (unknownFolder) warnings.push('Folder is not covered by the classification standard');
  if (classification === 'public' && warnings.length > 0) {
    warnings.unshift('Public candidate needs review before external publishing');
  }

  const publishFromFrontmatter = data.publish === true;
  const requestedPublish = publishFromFrontmatter || (!explicitClassification && classification === 'public');
  const reviewStatus = normalizeReviewStatus(
    data.reviewStatus,
    classification === 'public' && warnings.length === 0 ? 'approved' : 'ai-classified',
  );
  const needsReview =
    unknownFolder ||
    warnings.length > 0 ||
    classificationConfidence < 0.9 ||
    reviewStatus === 'review-required' ||
    (classification === 'public' && reviewStatus !== 'approved');
  const effectiveReviewStatus = needsReview && reviewStatus === 'approved' ? 'review-required' : reviewStatus;
  const publish = classification === 'public' && requestedPublish && effectiveReviewStatus === 'approved' && !needsReview;

  return {
    classification,
    classificationSource,
    classificationConfidence,
    classificationReason,
    matchedPolicyRule,
    publish,
    reviewStatus: effectiveReviewStatus,
    needsReview,
    warnings,
    audience: parseList(data.audience, folderPolicy.audience),
  };
}

function inferTags(folderSlug, fileName, content) {
  const tags = new Set();
  const top = folderSlug.split('/')[0];
  if (top) tags.add(top);
  if (/^ADR-/i.test(fileName)) tags.add('adr');
  if (/runbook|operation|verification|security|storage|runtime/i.test(fileName)) tags.add('runbook');
  if (/prd|scenario|audience|competitive/i.test(fileName)) tags.add('product');
  if (/table/i.test(content)) tags.add('table');
  return [...tags];
}

function docSlugFor(relativePath) {
  const parsed = path.posix.parse(relativePath);
  const folder = parsed.dir;
  const fileSlug = slugify(parsed.name);
  if (fileSlug === 'readme') {
    return folder ? `${folder}/readme` : 'readme';
  }
  return folder ? `${folder}/${fileSlug}` : fileSlug;
}

function folderTitle(folderSlug) {
  if (!folderSlug) return 'Documentation';
  return titleize(folderSlug.split('/').at(-1) ?? folderSlug);
}

function countClassifications(docs) {
  const counts = { public: 0, internal: 0, restricted: 0 };
  for (const doc of docs) counts[doc.classification] += 1;
  return counts;
}

function makeFolder(slug, folderSlugs, docs) {
  const directDocs = docs.filter((doc) => doc.folderSlug === slug);
  const directFolders = [...folderSlugs]
    .filter((candidate) => {
      if (candidate === slug || candidate === '') return false;
      const parent = candidate.split('/').slice(0, -1).join('/');
      return parent === slug;
    })
    .sort((a, b) => a.localeCompare(b));
  const descendantDocs = docs.filter((doc) => slug === '' || doc.folderSlug === slug || doc.folderSlug.startsWith(`${slug}/`));
  const readme = directDocs.find((doc) => doc.slug.endsWith('/readme') || doc.slug === 'readme');
  const parentSlug = slug ? slug.split('/').slice(0, -1).join('/') : null;
  const classificationCounts = countClassifications(descendantDocs);
  const warnings = [...new Set(descendantDocs.flatMap((doc) => doc.warnings))];

  return {
    id: slug || 'root',
    slug,
    route: slug ? `/documentation/${slug}` : '/documentation',
    sourcePath: slug ? `docs/${slug}` : 'docs',
    label: slug ? folderTitle(slug) : 'All Docs',
    title: readme?.title ?? folderTitle(slug),
    summary: readme?.summary ?? `${descendantDocs.length} documentation file${descendantDocs.length === 1 ? '' : 's'} indexed from ${slug ? `docs/${slug}` : 'docs'}.`,
    parentSlug: parentSlug === '' ? '' : parentSlug,
    folderSlugs: directFolders,
    docIds: directDocs.map((doc) => doc.id),
    classificationCounts,
    publishableCount: descendantDocs.filter((doc) => doc.publish).length,
    reviewRequiredCount: descendantDocs.filter((doc) => doc.needsReview).length,
    visibilityCounts: classificationCounts,
    warnings,
  };
}

function buildBaseDocs() {
  if (!existsSync(docsRoot)) {
    throw new Error(`docs directory not found: ${docsRoot}`);
  }

  return readMarkdownFiles(docsRoot).map((fullPath) => {
    const raw = readFileSync(fullPath, 'utf8');
    const { data, body, hasFrontmatter } = parseFrontmatter(raw);
    const relativePath = toPosix(path.relative(docsRoot, fullPath));
    const folderPath = path.posix.dirname(relativePath) === '.' ? '' : path.posix.dirname(relativePath);
    const folderSlug = slugify(folderPath);
    const sourcePath = `docs/${relativePath}`;
    const slug = docSlugFor(relativePath);
    const title = data.title ? String(data.title) : extractTitle(body, path.basename(relativePath));
    const contentHash = createHash('sha256').update(raw).digest('hex').slice(0, 16);
    const stats = statSync(fullPath);
    const words = body.split(/\s+/).filter(Boolean).length;
    const classification = classifyDocument({ data, body, folderSlug, hasFrontmatter });
    const restrictedContent = classification.classification === 'restricted';

    return {
      id: slug,
      slug,
      route: `/documentation/${slug}`,
      sourcePath,
      folderSlug,
      folderPath: folderPath ? `docs/${folderPath}` : 'docs',
      title,
      summary: data.summary ? String(data.summary) : extractSummary(body),
      content: restrictedContent ? '' : body,
      contentHash,
      readingMinutes: Math.max(1, Math.ceil(words / 220)),
      classification: classification.classification,
      classificationSource: classification.classificationSource,
      classificationConfidence: classification.classificationConfidence,
      classificationReason: classification.classificationReason,
      matchedPolicyRule: classification.matchedPolicyRule,
      publish: classification.publish,
      reviewStatus: classification.reviewStatus,
      needsReview: classification.needsReview,
      visibility: classification.classification,
      audience: classification.audience,
      tags: inferTags(folderSlug, path.basename(relativePath), body),
      warnings: classification.warnings,
      updatedAt: stats.mtime.toISOString(),
    };
  });
}

function buildManifest({ audience, sourceDocs }) {
  const docs = audience === 'public' ? sourceDocs.filter((doc) => doc.publish) : sourceDocs;
  const folderSlugs = new Set(['']);
  for (const doc of docs) {
    const parts = doc.folderSlug ? doc.folderSlug.split('/') : [];
    for (let i = 1; i <= parts.length; i += 1) {
      folderSlugs.add(parts.slice(0, i).join('/'));
    }
  }

  const folders = [...folderSlugs]
    .sort((a, b) => a.localeCompare(b))
    .map((slug) => makeFolder(slug, folderSlugs, docs));

  const latestDocMtime = sourceDocs.reduce((latest, doc) => {
    const time = new Date(doc.updatedAt).getTime();
    return Math.max(latest, time);
  }, 0);
  const counts = countClassifications(sourceDocs);

  const sync = {
    generatedAt: new Date(latestDocMtime || Date.now()).toISOString(),
    generatorVersion,
    mode: 'heuristic',
    sourceRoot: 'docs',
    manifestAudience: audience,
    totalDocuments: docs.length,
    totalFolders: folders.length,
    publicDocuments: counts.public,
    internalDocuments: counts.internal,
    restrictedDocuments: counts.restricted,
    publishableDocuments: sourceDocs.filter((doc) => doc.publish).length,
    reviewRequiredDocuments: sourceDocs.filter((doc) => doc.needsReview).length,
    warningCount: sourceDocs.reduce((total, doc) => total + doc.warnings.length, 0),
  };

  const routes = [
    '',
    ...folders.filter((folder) => folder.slug).map((folder) => folder.slug),
    ...docs.map((doc) => doc.slug),
  ].filter((value, index, arr) => arr.indexOf(value) === index);

  return { sync, folders, docs, routes };
}

function renderManifestFile(manifest, exportName) {
  return `/* eslint-disable */\n// Generated by scripts/sync-documentation-site.mjs. Do not edit by hand.\nimport type { DocumentationSiteManifest } from '../documentation/types';\n\nexport const ${exportName} = ${JSON.stringify(manifest, null, 2)} satisfies DocumentationSiteManifest;\n`;
}

function renderCompatibilityFile() {
  return `/* eslint-disable */\n// Compatibility export. Prefer documentation-site-internal or documentation-site-public explicitly.\nexport { DOCUMENTATION_SITE_INTERNAL_MANIFEST as DOCUMENTATION_SITE_MANIFEST } from './documentation-site-internal';\n`;
}

function writeOne(filePath, content) {
  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf8') : null;
  if (checkOnly) {
    return existing === content;
  }
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  return true;
}

function writeManifest() {
  const sourceDocs = buildBaseDocs();
  const internalManifest = buildManifest({ audience: 'internal', sourceDocs });
  const publicManifest = buildManifest({ audience: 'public', sourceDocs });
  const files = [
    {
      path: internalOutputPath,
      content: renderManifestFile(internalManifest, 'DOCUMENTATION_SITE_INTERNAL_MANIFEST'),
    },
    {
      path: publicOutputPath,
      content: renderManifestFile(publicManifest, 'DOCUMENTATION_SITE_PUBLIC_MANIFEST'),
    },
    {
      path: compatibilityOutputPath,
      content: renderCompatibilityFile(),
    },
  ];

  if (checkOnly) {
    const stale = files.filter((file) => !writeOne(file.path, file.content));
    if (stale.length > 0) {
      console.error('[docs:site] Generated documentation manifests are stale. Run npm run docs:site:sync.');
      for (const file of stale) console.error(`  - ${path.relative(repoRoot, file.path)}`);
      process.exitCode = 1;
      return;
    }
    console.log(
      `[docs:site] Manifests are current (${internalManifest.sync.totalDocuments} internal-preview docs, ${publicManifest.sync.totalDocuments} public docs).`,
    );
    return;
  }

  for (const file of files) writeOne(file.path, file.content);
  console.log(
    `[docs:site] Synced ${internalManifest.sync.totalDocuments} internal-preview docs and ${publicManifest.sync.totalDocuments} public docs -> ${path.relative(repoRoot, generatedRoot)}`,
  );
}

writeManifest();

if (watchMode) {
  console.log('[docs:site] Watching docs/ for changes...');
  const interval = setInterval(() => {
    try {
      writeManifest();
    } catch (error) {
      console.error(`[docs:site] ${error instanceof Error ? error.message : String(error)}`);
    }
  }, 3000);
  process.on('SIGINT', () => {
    clearInterval(interval);
    process.exit(0);
  });
}
