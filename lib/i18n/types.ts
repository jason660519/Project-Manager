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
    skills: string;
    sessions: string;
    logs: string;
    keys: string;
    shortcuts: string;
    settings: string;
    docs: string;
    chat: string;
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
  runs: {
    active: string;
    history: string;
    noRuns: string;
    noRunsHint: string;
    waitingOutput: string;
    kill: string;
    killConfirmTitle: string;
    /** Uses {pid} and {feature} placeholders */
    killConfirmBody: string;
    killConfirm: string;
    killCancel: string;
    viewLog: string;
    hideLog: string;
    exit: string;
    /** Uses {count} placeholder */
    runsSummary: string;
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
  chat: {
    title: string;
    placeholder: string;
    welcome: string;
    send: string;
    loading: string;
    error: string;
    history: string;
    newChat: string;
    new: string;
    noConversations: string;
    welcomeTitle: string;
    enterToSend: string;
    deleteSession: string;
    openFullChat: string;
  };
  dispatch: {
    title: string;
    phaseLabel: string;
    engineerLabel: string;
    workflowLabel: string;
    modelProviderLabel: string;
    modelIdLabel: string;
    modelPromptTitle: string;
    runtimeLabel: string;
    templatesLabel: string;
    promptLabel: string;
    openFileLabel: string;
    noRole: string;
    noWorkflow: string;
    loadingSpec: string;
    systemPromptPrefix: string;
    refsPrefix: string;
    /** Uses {count} and {flag} placeholders */
    mcpInjected: string;
    advancedTitle: string;
    autoRetryLabel: string;
    stopConditionLabel: string;
    maxIterationsLabel: string;
    closeBtn: string;
    backgroundBtn: string;
    openTerminalBtn: string;
    openIDEBtn: string;
    openAppBtn: string;
    dispatchBtn: string;
    runInPMBtn: string;
    targetGroupIde: string;
    targetGroupCli: string;
    targetGroupApp: string;
    appTargetHint: string;
    liveOutput: string;
    executionLog: string;
    waitingOutput: string;
    templateFromScratch: string;
    templateFeatureSpec: string;
    templateTddSpec: string;
    templateUnitTest: string;
    templateIntegrationTest: string;
    templateE2eTest: string;
    templateDevLogs: string;
    templateContinueCicd: string;
    templateDebug: string;
    templateCodeReview: string;
    promptUnspecified: string;
    promptFeatureSpecPath: string;
    promptTddSpecPath: string;
    promptUnitTestPath: string;
    promptIntegrationTestPath: string;
    promptE2eTestPath: string;
    promptDevLogsPath: string;
    promptImplPath: string;
    promptTestPath: string;
    promptNotes: string;
    promptStatus: string;
    promptSpecHeader: string;
    /** Uses {name} and {date} placeholders */
    assignedToWarning: string;
    assignedToContinue: string;
    /** Kill confirmation */
    killConfirmTitle: string;
    /** Uses {pid} and {feature} placeholders */
    killConfirmBody: string;
    killConfirm: string;
    killCancel: string;
    /** Command not found */
    adapterNotFound: string;
    mcpLoading: string;
    mcpEmpty: string;
    commandPreparing: string;
    dispatchNoAdapter: string;
    batchEmptyTitle: string;
    batchEmptyHint: string;
    /** Uses {id} and {fallback} placeholders */
    adapterWarningHint: string;
  };
}
