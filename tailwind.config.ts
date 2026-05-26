import type { Config } from 'tailwindcss';
import {
  EDITOR_BG,
  EDITOR_PANEL,
  EDITOR_BAR,
  EDITOR_TAB,
  EDITOR_SIDEBAR,
  EDITOR_SIDEBAR_R,
  EDITOR_ADDR,
} from './lib/tokens/editor-colors';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        editor: {
          bg: EDITOR_BG,
          panel: EDITOR_PANEL,
          bar: EDITOR_BAR,
          tab: EDITOR_TAB,
          sidebar: EDITOR_SIDEBAR,
          'sidebar-r': EDITOR_SIDEBAR_R,
          addr: EDITOR_ADDR,
        },
      },
    },
  },
  plugins: [],
};

export default config;
