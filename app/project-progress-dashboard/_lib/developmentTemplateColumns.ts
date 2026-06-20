import type { ProgressColumn } from '../../../lib/types';
import { createDevelopmentColumns, type ColumnDef } from './columns';

/** Maps Desktop App Development template field ids to legacy development table column ids. */
const TEMPLATE_FIELD_TO_COLUMN_ID: Record<string, string> = {
  uuid: 'col-id',
  projectName: 'col-project',
  featureId: 'col-feature-id',
  points: 'col-points',
  category: 'col-category',
  name: 'col-name',
  progress: 'col-progress',
  status: 'col-status',
  checklist: 'col-checklist',
  upstreamDependencies: 'col-upstream-deps',
  downstreamDependencies: 'col-downstream-deps',
  locatedSection: 'col-section',
  specPath: 'col-spec',
  tddPath: 'col-tdd',
  unitIntegrationTestPath: 'col-unit-integ',
  e2eAcceptanceTestScriptFolder: 'col-e2e-folder',
  tddProgress: 'col-tdd-progress',
  tddReportPath: 'col-tdd-report',
  debugRetroPath: 'col-debug-retro',
  testScenariosPath: 'col-test-scenarios',
  devLogFolder: 'col-dev-log',
  readmePath: 'col-notes',
};

const ACTIONS_COLUMN_ID = 'col-actions';

/**
 * Applies Project Templates Setting column order/visibility to the editable
 * Development Progress table while keeping rich cell editors (paths, dispatch, etc.).
 */
export function developmentColumnsFromTemplatePrefs(
  templateColumns: ProgressColumn[],
  projectNameLabel?: string,
): ColumnDef[] {
  const defaults = createDevelopmentColumns(projectNameLabel);
  const byId = new Map(defaults.map((column) => [column.id, column]));
  const actionsColumn = byId.get(ACTIONS_COLUMN_ID);

  const ordered = [...templateColumns]
    .filter((column) => column.visible !== false)
    .sort((a, b) => a.order - b.order);

  const seen = new Set<string>();
  const result: ColumnDef[] = [];

  for (const field of ordered) {
    const columnId = TEMPLATE_FIELD_TO_COLUMN_ID[field.id];
    if (!columnId || seen.has(columnId)) continue;
    const column = byId.get(columnId);
    if (!column) continue;
    seen.add(columnId);
    result.push(column);
  }

  if (actionsColumn && !seen.has(ACTIONS_COLUMN_ID)) {
    result.push(actionsColumn);
  }

  return result.length > 1 ? result : defaults;
}
