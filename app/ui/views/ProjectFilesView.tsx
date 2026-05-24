'use client';

export {
  MonacoEditorWorkbench as ProjectFilesView,
  buildMonacoWorkbenchFiles,
  detectMonacoWorkbenchLanguage,
  normalizeWorkbenchPath,
} from './MonacoEditorWorkbench';

export type {
  MonacoEditorWorkbenchProps as ProjectFilesViewProps,
  MonacoWorkbenchFile,
} from './MonacoEditorWorkbench';
