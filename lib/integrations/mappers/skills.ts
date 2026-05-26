import type { IntegrationRow, IntegrationStatus } from '../types';

export interface SkillRowInput {
  absPath: string;
  relPath: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  tags: string[];
  version: string;
  modified: string;
}

export function mapSkillRow(skill: SkillRowInput, skillsDir: string): IntegrationRow {
  const status: IntegrationStatus = 'installed';
  const badges: string[] = [];
  if (skill.tags.length > 0) badges.push(`${skill.tags.length} tags`);

  return {
    rowKey: `skills:${skill.absPath}`,
    sheet: 'skills',
    sourceKind: 'skill',
    sourceId: skill.absPath,
    enabled: true,
    category1: 'Skills',
    category2: skill.category,
    githubUrl: '',
    company: 'Project',
    name: skill.name || skill.slug,
    version: skill.version,
    license: '',
    scope: 'project',
    port: '',
    installPath: skill.absPath,
    installMethod: 'git_clone',
    status,
    statusLabel: 'Installed',
    lastUpdated: skill.modified?.slice(0, 10) ?? '',
    notes: skill.description,
    lv: null,
    badges,
    payload: { skill, skillsDir },
  };
}

export function mapSkillFileInfo(
  file: { absPath: string; relPath: string; modified: string; size: number },
  skillsDir: string,
): IntegrationRow {
  return {
    rowKey: `skills:${file.absPath}`,
    sheet: 'skills',
    sourceKind: 'skill',
    sourceId: file.absPath,
    enabled: true,
    category1: 'Skills',
    category2: file.relPath.split('/')[0] ?? 'uncategorized',
    githubUrl: '',
    company: 'Project',
    name: file.relPath,
    version: '',
    license: '',
    scope: 'project',
    port: '',
    installPath: file.absPath,
    installMethod: 'local_file',
    status: 'installed',
    statusLabel: 'File',
    lastUpdated: file.modified?.slice(0, 10) ?? '',
    notes: `${(file.size / 1024).toFixed(1)} KB`,
    lv: null,
    badges: [],
    payload: { file, skillsDir },
  };
}
