import type { LangId } from '../hooks/useLang';

export type Locale = LangId;

export interface Translations {
  navGroups: {
    workspace: string;
    execution: string;
    observe: string;
    system: string;
  };
  navItems: {
    projects: string;
    dashboard: string;
    files: string;
    engineers: string;
    plugins: string;
    channels: string;
    cronJobs: string;
    sessions: string;
    logs: string;
    keys: string;
    shortcuts: string;
    settings: string;
    docs: string;
  };
  system: {
    checkForUpdates: string;
    upToDate: string;
    checkFailed: string;
    /** "Update: v{version}" — component substitutes {version} */
    updateAvailable: string;
    guarded: string;
    /** "{count} run(s) active" — component substitutes {count} */
    runsActive: string;
  };
  common: {
    search: string;
    selectAll: string;
    deselectAll: string;
    deselectSelection: string;
    multiSelect: string;
    singleSelect: string;
    clear: string;
    loading: string;
    noProjectsConfigured: string;
  };
  phases: {
    development: string;
    e2eTesting: string;
    deployment: string;
    operations: string;
  };
  stats: {
    overallProgress: string;
    completed: string;
    inProgress: string;
    pending: string;
    avgCoverage: string;
    notDeployed: string;
    latestDeployDate: string;
    avgUptime: string;
    avgErrorRate: string;
    avgResponseMs: string;
    recentIncidents: string;
  };
  dashboard: {
    title: string;
    projectName: string;
  };
  features: {
    filterAll: string;
    filterBlocked: string;
    filterInProgress: string;
    filterTodo: string;
    filterDone: string;
    batchDispatch: string;
  };
  language: {
    label: string;
  };
}
