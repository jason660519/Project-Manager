import sampleConfig1 from '../../config/samples/project-manager.sample.json';
import sampleConfig2 from '../../config/samples/project-manager-self.sample.json';
import type { ProjectManagerConfig } from '../types';
import { ensureEngineerRoles } from './mergeEngineerRoles';

/**
 * Bundled exploration samples keyed by project root. Used when a real
 * dashboard config exists but was initialized with an empty `features`
 * array — desktop hydration must not leave the dashboard blank while the
 * web dev shell still shows the bundled sample rows.
 *
 * Keyed by project root (the parent of the `.project-manager/` folder) so
 * both layouts (new `<root>/.project-manager/config.json` and legacy
 * `<root>/.project-manager.json`) resolve to the same sample.
 */
const BUNDLED_OWNER_PROPERTY = ensureEngineerRoles(sampleConfig1 as ProjectManagerConfig);
const BUNDLED_SELF = ensureEngineerRoles(sampleConfig2 as ProjectManagerConfig);

function projectRootFromConfigPath(configPath: string): string {
  return configPath
    .replace(/\/\.project-manager\/config\.json$/, '')
    .replace(/\/\.project-manager\.json$/, '');
}

function looksLikeProjectManagerRepoRoot(root: string): boolean {
  return (
    /(^|[\\/])Project-Manager$/.test(root) ||
    root.includes('/Project-Manager/') ||
    root.includes('\\Project-Manager\\')
  );
}

function resolveBundledSample(configPath: string): ProjectManagerConfig | null {
  const root = projectRootFromConfigPath(configPath);
  if (root.includes('owner-property-management-ai-spa')) {
    return BUNDLED_OWNER_PROPERTY;
  }
  if (looksLikeProjectManagerRepoRoot(root)) {
    return BUNDLED_SELF;
  }
  return null;
}

/** Fill an empty feature list from a bundled sample when the config path matches. */
export function enrichConfigFromBundledSample(
  config: ProjectManagerConfig,
  configPath: string,
): ProjectManagerConfig {
  if (config.features.length > 0) return config;
  const sample = resolveBundledSample(configPath);
  if (!sample?.features?.length) return config;
  return {
    ...config,
    features: sample.features.map((f) => ({ ...f })),
  };
}
