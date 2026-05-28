/**
 * Agent Team prompt assembly: protocol.md + role + matched SKILL.md files.
 * ADR-003: assembly stays in TypeScript; Rust only receives the final prompt string.
 */

import { readFile, skillList, writeFile } from '../bridge';
import {
  AGENT_TEAM_PROTOCOL_REL,
  DEFAULT_AGENT_TEAM_PROTOCOL_MD,
  PROJECT_SKILL_SEARCH_DIRS,
} from '../defaults/agentTeamProtocol';
import { parseCategorySlug, parseFrontmatter } from '../skills/utils';
import type { EngineerRole, HarnessTaskRole } from '../types';
import type { SkillFileInfo } from '../bridge';

export interface SkillCatalogEntry {
  absPath: string;
  relPath: string;
  relToProject: string;
  category: string;
  slug: string;
  name: string;
  tags: string[];
}

export interface LoadedSkillSection {
  relPath: string;
  title: string;
  body: string;
}

export interface AgentTeamPromptLayers {
  protocol?: string;
  skills: LoadedSkillSection[];
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '');
}

function joinProjectPath(projectRoot: string, relPath: string): string {
  const root = projectRoot.replace(/\/+$/, '');
  const rel = relPath.replace(/^\/+/, '');
  return `${root}/${rel}`;
}

/** Create protocol.md when missing (idempotent). */
export async function ensureAgentTeamProtocol(projectRoot: string): Promise<void> {
  if (!projectRoot.trim()) return;
  const absPath = joinProjectPath(projectRoot, AGENT_TEAM_PROTOCOL_REL);
  try {
    await readFile(absPath);
  } catch {
    try {
      await writeFile(absPath, DEFAULT_AGENT_TEAM_PROTOCOL_MD);
    } catch {
      /* read-only tree or browser preview — dispatch still works without protocol */
    }
  }
}

export async function readAgentTeamProtocol(projectRoot: string): Promise<string | undefined> {
  if (!projectRoot.trim()) return undefined;
  try {
    const raw = await readFile(joinProjectPath(projectRoot, AGENT_TEAM_PROTOCOL_REL));
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

function catalogEntryFromFile(
  projectRoot: string,
  skillsDirRel: string,
  file: SkillFileInfo,
): SkillCatalogEntry {
  const { category, slug } = parseCategorySlug(file.relPath);
  return {
    absPath: file.absPath,
    relPath: file.relPath,
    relToProject: `${skillsDirRel}/${file.relPath}`.replace(/\/+/g, '/'),
    category,
    slug,
    name: slug,
    tags: [],
  };
}

export async function listProjectSkillCatalog(projectRoot: string): Promise<SkillCatalogEntry[]> {
  if (!projectRoot.trim()) return [];
  const root = projectRoot.replace(/\/+$/, '');
  const entries: SkillCatalogEntry[] = [];

  for (const dirRel of PROJECT_SKILL_SEARCH_DIRS) {
    const skillsDir = `${root}/${dirRel}`;
    let files: SkillFileInfo[];
    try {
      files = await skillList(skillsDir);
    } catch {
      continue;
    }
    for (const file of files) {
      const base = catalogEntryFromFile(projectRoot, dirRel, file);
      try {
        const raw = await readFile(file.absPath);
        const fm = parseFrontmatter(raw);
        entries.push({
          ...base,
          name: fm.name || base.slug,
          tags: fm.tags,
        });
      } catch {
        entries.push(base);
      }
    }
  }

  return entries;
}

function entryTokens(entry: SkillCatalogEntry): string[] {
  const tokens = new Set<string>();
  for (const value of [entry.name, entry.slug, entry.category, ...entry.tags]) {
    const t = normalizeToken(value);
    if (t) tokens.add(t);
  }
  const pathSlug = entry.relToProject.split('/').filter(Boolean);
  for (const segment of pathSlug) {
    const t = normalizeToken(segment.replace(/\.md$/i, ''));
    if (t && t !== 'skill') tokens.add(t);
  }
  return [...tokens];
}

/** Resolve explicit skillRefs + fuzzy match against role.skills labels. */
export function resolveSkillsForRole(
  role: EngineerRole,
  catalog: SkillCatalogEntry[],
): SkillCatalogEntry[] {
  const chosen = new Map<string, SkillCatalogEntry>();
  const add = (entry: SkillCatalogEntry) => chosen.set(entry.absPath, entry);

  const refs = role.skillRefs ?? [];
  for (const ref of refs) {
    const normRef = ref.replace(/\\/g, '/').replace(/^\/+/, '');
    const hit =
      catalog.find((c) => c.relToProject === normRef) ||
      catalog.find((c) => c.relToProject.endsWith(`/${normRef}`)) ||
      catalog.find((c) => c.absPath.endsWith(normRef));
    if (hit) add(hit);
  }

  const roleTokens = role.skills.map(normalizeToken).filter(Boolean);
  if (roleTokens.length > 0) {
    for (const entry of catalog) {
      if (chosen.has(entry.absPath)) continue;
      const entryToks = entryTokens(entry);
      const matched = roleTokens.some((rt) =>
        entryToks.some((et) => et === rt || et.includes(rt) || rt.includes(et)),
      );
      if (matched) add(entry);
    }
  }

  return [...chosen.values()].sort((a, b) => a.relToProject.localeCompare(b.relToProject));
}

export async function loadSkillSections(
  entries: SkillCatalogEntry[],
): Promise<LoadedSkillSection[]> {
  const sections: LoadedSkillSection[] = [];
  for (const entry of entries) {
    try {
      const raw = await readFile(entry.absPath);
      const fm = parseFrontmatter(raw);
      const body = (fm.body || raw).trim();
      if (!body) continue;
      sections.push({
        relPath: entry.relToProject,
        title: fm.name || entry.name || entry.slug,
        body,
      });
    } catch {
      /* skip unreadable skill */
    }
  }
  return sections;
}

export async function loadAgentTeamLayers(
  projectRoot: string,
  role: EngineerRole | undefined,
): Promise<AgentTeamPromptLayers> {
  await ensureAgentTeamProtocol(projectRoot);
  const protocol = await readAgentTeamProtocol(projectRoot);
  if (!role) {
    return { protocol, skills: [] };
  }
  const catalog = await listProjectSkillCatalog(projectRoot);
  const resolved = resolveSkillsForRole(role, catalog);
  const skills = await loadSkillSections(resolved);
  return { protocol, skills };
}

export interface FormatAgentTeamPrefixOptions {
  engineerLabel: string;
  refsPrefix: string;
  harnessRole?: HarnessTaskRole;
}

/** Ordered blocks: protocol → role → skills → refs → scope (scope passed in separately). */
export function formatAgentTeamPrefix(
  role: EngineerRole,
  layers: AgentTeamPromptLayers,
  opts: FormatAgentTeamPrefixOptions,
): string[] {
  const parts: string[] = [];

  if (layers.protocol) {
    parts.push(`[Agent Team Protocol]\n${layers.protocol}`);
  }

  if (role.systemPrompt.trim()) {
    const roleHeader =
      opts.harnessRole != null
        ? `${opts.engineerLabel}: ${role.name} (${opts.harnessRole})`
        : `${opts.engineerLabel}: ${role.name}`;
    parts.push(`[${roleHeader}]\n${role.systemPrompt.trim()}`);
  }

  for (const skill of layers.skills) {
    parts.push(
      `[Skill: ${skill.title}]\nSource: ${skill.relPath}\n\n${skill.body}`,
    );
  }

  if (role.referenceFiles.length > 0) {
    parts.push(
      `${opts.refsPrefix}\n${role.referenceFiles.map((f) => `- ${f}`).join('\n')}`,
    );
  }

  return parts;
}

export async function prependAgentTeamContext(
  projectRoot: string,
  role: EngineerRole | undefined,
  basePrompt: string,
  opts: FormatAgentTeamPrefixOptions & {
    workingScopeBlock?: string;
  },
): Promise<string> {
  if (!role) return basePrompt;

  const layers = await loadAgentTeamLayers(projectRoot, role);
  const parts = formatAgentTeamPrefix(role, layers, opts);

  if (opts.workingScopeBlock) {
    parts.push(opts.workingScopeBlock);
  }

  if (parts.length === 0) return basePrompt;
  return `${parts.join('\n\n')}\n\n---\n\n${basePrompt}`;
}
