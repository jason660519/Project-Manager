import { describe, expect, it } from 'vitest';
import { deriveSystemAppsScanPhase } from '../app/ui/views/Plugins/SystemInstalledAppsSheet';
import { buildSystemInstalledAppsRows } from '../lib/integrations/mappers/system-installed-apps';
import { mapMarketplaceRow } from '../lib/integrations/mappers/plugins';
import { MARKETPLACE } from '../lib/integrations/marketplace-catalog';
import { RECOMMENDED_INSTALL_APPS } from '../lib/integrations/recommended-apps';
import type { IntegrationRow } from '../lib/integrations/types';

function marketplaceRows(): IntegrationRow[] {
  return MARKETPLACE.filter((mp) => mp.kind === 'cli' || mp.kind === 'editor').map((mp) =>
    mapMarketplaceRow(
      {
        id: mp.id,
        name: mp.name,
        description: mp.description,
        category: mp.category,
        kind: mp.kind,
        installed: false,
      },
      undefined,
    ),
  );
}

describe('recommended install apps', () => {
  it('lists four curated productivity apps with external https links', () => {
    expect(RECOMMENDED_INSTALL_APPS).toHaveLength(4);
    for (const app of RECOMMENDED_INSTALL_APPS) {
      expect(app.websiteUrl.startsWith('https://')).toBe(true);
      expect(app.category).toBe('Productivity');
    }
    expect(RECOMMENDED_INSTALL_APPS.map((a) => a.name)).toEqual([
      'HighLevel',
      'Adobe Express',
      'Adobe Acrobat',
      'Adobe Photoshop',
    ]);
  });
});

describe('deriveSystemAppsScanPhase', () => {
  it('returns scanning while a scan is in flight', () => {
    expect(
      deriveSystemAppsScanPhase({ scanning: true, snapshot: null, errorMessage: null }),
    ).toBe('scanning');
  });

  it('classifies permission errors', () => {
    expect(
      deriveSystemAppsScanPhase({
        scanning: false,
        snapshot: null,
        errorMessage: 'Permission denied reading /Applications',
      }),
    ).toBe('permission');
  });

  it('returns success when a snapshot exists', () => {
    expect(
      deriveSystemAppsScanPhase({
        scanning: false,
        snapshot: { apps: [], scannedPaths: ['/Applications'], warnings: [] },
        errorMessage: null,
      }),
    ).toBe('success');
  });
});

describe('buildSystemInstalledAppsRows', () => {
  it('marks marketplace CLIs and IDEs as installed or not installed from PATH and macOS scan', () => {
    const rows = buildSystemInstalledAppsRows(
      marketplaceRows(),
      {
        systemCommandStatus: { antigravity: true },
        resolvedInstallPaths: {},
      },
      [],
    );
    const antigravity = rows.find((row) => row.sourceId === 'antigravity');
    expect(antigravity?.status).toBe('installed');
    expect(antigravity?.statusLabel).toBe('Installed');
    expect(antigravity?.sheet).toBe('system_installed_apps');

    const github = rows.find((row) => row.sourceId === 'github');
    expect(github?.status).toBe('not_installed');
    expect(github?.statusLabel).toBe('Not Installed');
  });

  it('includes curated recommendations as not installed when absent from scan', () => {
    const rows = buildSystemInstalledAppsRows(marketplaceRows(), { systemCommandStatus: {} }, []);
    const adobe = rows.find((row) => row.name === 'Adobe Photoshop');
    expect(adobe?.status).toBe('not_installed');
    expect(adobe?.company).toBe('Adobe');
  });

  it('adds unmatched macOS apps such as cmux', () => {
    const rows = buildSystemInstalledAppsRows(
      marketplaceRows(),
      { systemCommandStatus: {} },
      [
        {
          id: 'cmux',
          name: 'cmux',
          path: '/Applications/cmux.app',
          description: null,
        },
      ],
    );
    const cmux = rows.find((row) => row.name === 'cmux');
    expect(cmux?.status).toBe('installed');
    expect(cmux?.installPath).toBe('/Applications/cmux.app');
    expect(cmux?.category1).toBe('macOS application');
  });
});
