import { defineConfig } from 'vitepress';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Markdown lives outside the docs-site/ folder (at ../docs/guides). When
// Rollup tries to resolve `vue` from there it walks up the tree and never
// reaches docs-site/node_modules. We force the resolution explicitly so a
// single Vue install (here in docs-site/) wins.
const __dirname = dirname(fileURLToPath(import.meta.url));
const vuePkgRoot = resolve(__dirname, '../node_modules/vue');

// VitePress site for Project Manager.
//
// `srcDir` points at the existing `docs/guides/` tree so we don't duplicate
// content. The site is deployed to GitHub Pages at
// https://jason660519.github.io/Project-Manager/ — the `base` MUST match the
// repo name path (`/Project-Manager/`) or every internal link will 404.
//
// Sources outside docs/guides/ (docs/product/, docs/architecture/,
// docs/engineering/) are NEVER pulled in — those are internal-only per
// CLAUDE.md's bilingual / classification governance.

export default defineConfig({
  title: 'Project Manager',
  description:
    'Context-aware engineering dashboard for cross-project orchestration, dispatching work to local IDEs and AI agents through a Tauri desktop shell.',
  base: '/Project-Manager/',
  srcDir: '../docs/guides',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,

  themeConfig: {
    nav: [
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Features', link: '/features/xmux' },
      { text: 'GitHub', link: 'https://github.com/jason660519/Project-Manager' },
    ],

    sidebar: [
      {
        text: 'Overview',
        items: [{ text: 'Getting Started', link: '/getting-started' }],
      },
      {
        text: 'Features',
        items: [
          { text: 'xmux Workspace', link: '/features/xmux' },
          { text: 'Dispatch', link: '/features/dispatch' },
          { text: 'Documentation Hub', link: '/features/documentation' },
          { text: 'Workstation Layout', link: '/features/workstation' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/jason660519/Project-Manager' },
    ],

    editLink: {
      pattern:
        'https://github.com/jason660519/Project-Manager/edit/main/docs/guides/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'MIT Licensed',
      copyright: '© Project Manager contributors',
    },

    search: {
      provider: 'local',
    },
  },

  vite: {
    resolve: {
      alias: {
        vue: vuePkgRoot,
        'vue/server-renderer': resolve(vuePkgRoot, 'server-renderer'),
      },
    },
    // VitePress's generated SSR chunks use CJS-style default imports on
    // pure-ESM packages (entities, estree-walker, …). Strict ESM on Node 22+
    // rejects those defaults. Inlining everything in the SSR bundle removes
    // the externalised imports entirely so the strictness never trips.
    ssr: {
      noExternal: true,
    },
  },
});
