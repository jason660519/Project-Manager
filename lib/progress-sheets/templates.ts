import type {
  ProgressColumn,
  ProgressDiscipline,
  ProgressOption,
} from '../types';
import { ensureProgressUuidFirstColumn } from './supabaseUuidField';

export interface BuiltInProgressTemplate {
  id: string;
  label: string;
  sheetTitle: string;
  discipline: ProgressDiscipline;
  version: number;
  fields: ProgressColumn[];
  statusOptions: ProgressOption[];
  phaseOptions?: ProgressOption[];
}

const DEFAULT_STATUS_OPTIONS: ProgressOption[] = [
  { id: 'not-started', label: 'Not Started', color: 'neutral' },
  { id: 'in-progress', label: 'In Progress', color: 'blue' },
  { id: 'blocked', label: 'Blocked', color: 'red' },
  { id: 'in-review', label: 'In Review', color: 'amber' },
  { id: 'complete', label: 'Complete', color: 'green' },
];

/** Matches the legacy Development Progress dashboard status palette. */
const SOFTWARE_DEVELOPMENT_STATUS_OPTIONS: ProgressOption[] = [
  { id: 'todo', label: 'To Do', color: 'neutral' },
  { id: 'in_progress', label: 'In Progress', color: 'blue' },
  { id: 'done', label: 'Done', color: 'green' },
  { id: 'on_hold', label: 'On Hold', color: 'red' },
];

function column(
  id: string,
  label: string,
  fieldType: ProgressColumn['fieldType'],
  order: number,
  extras: Omit<ProgressColumn, 'id' | 'label' | 'fieldType' | 'order'> = {},
): ProgressColumn {
  return {
    id,
    label,
    fieldType,
    order,
    visible: extras.visible ?? true,
    ...extras,
  };
}

const RAW_BUILT_IN_PROGRESS_TEMPLATES: BuiltInProgressTemplate[] = [
  {
    id: 'software-desktop-app',
    label: 'Desktop App Development',
    sheetTitle: 'Desktop App Development Progress',
    discipline: 'software',
    version: 3,
    fields: [
      column('projectName', 'Project Name', 'text', 0),
      column('featureId', 'Feature ID', 'text', 1, { required: true }),
      column('points', 'SP', 'number', 2),
      column('category', 'Category', 'tag', 3),
      column('name', 'Function / Feature', 'text', 4, { required: true }),
      column('progress', 'Progress', 'percent', 5),
      column('status', 'Status', 'select', 6, {
        required: true,
        options: SOFTWARE_DEVELOPMENT_STATUS_OPTIONS,
      }),
      column('checklist', 'Checklist', 'text', 7),
      column('upstreamDependencies', 'Upstream Dependencies', 'tag', 8),
      column('downstreamDependencies', 'Downstream Dependencies', 'tag', 9),
      column('locatedSection', 'Located Section', 'text', 10),
      column('specPath', 'Feature Spec', 'file', 11),
      column('tddPath', 'TDD Spec', 'file', 12),
      column('unitIntegrationTestPath', 'Unit/Integ Test', 'file', 13),
      column('e2eAcceptanceTestScriptFolder', 'E2E Folder', 'file', 14),
      column('tddProgress', 'TDD Progress', 'percent', 15),
      column('tddReportPath', 'TDD Report', 'file', 16),
      column('debugRetroPath', 'Debug Retro', 'file', 17),
      column('testScenariosPath', 'Test Scenarios', 'file', 18),
      column('devLogFolder', 'Dev Logs', 'file', 19),
      column('readmePath', 'README', 'file', 20),
    ],
    statusOptions: SOFTWARE_DEVELOPMENT_STATUS_OPTIONS,
  },
  {
    id: 'software-backend-api',
    label: 'Backend API Development',
    sheetTitle: 'Backend API Development Progress',
    discipline: 'software',
    version: 1,
    fields: [
      column('endpoint', 'Endpoint', 'text', 0, { required: true }),
      column('service', 'Service', 'text', 1),
      column('status', 'Status', 'select', 2, { required: true, options: DEFAULT_STATUS_OPTIONS }),
      column('owner', 'Owner', 'person', 3),
      column('contract', 'Contract', 'link', 4),
      column('migration', 'Migration', 'tag', 5),
      column('testCoverage', 'Test Coverage', 'percent', 6),
      column('deployEnv', 'Deploy Env', 'select', 7, {
        options: [
          { id: 'local', label: 'Local' },
          { id: 'staging', label: 'Staging' },
          { id: 'production', label: 'Production' },
        ],
      }),
    ],
    statusOptions: DEFAULT_STATUS_OPTIONS,
  },
  {
    id: 'hardware-rd',
    label: 'Hardware R&D',
    sheetTitle: 'Hardware R&D Progress',
    discipline: 'hardware-rd',
    version: 1,
    fields: [
      column('module', 'Module', 'text', 0, { required: true }),
      column('stage', 'EVT/DVT/PVT Stage', 'select', 1, {
        options: [
          { id: 'evt', label: 'EVT' },
          { id: 'dvt', label: 'DVT' },
          { id: 'pvt', label: 'PVT' },
          { id: 'mp', label: 'MP' },
        ],
      }),
      column('prototypeRev', 'Prototype Rev', 'text', 2),
      column('bomStatus', 'BOM Status', 'select', 3, {
        options: [
          { id: 'draft', label: 'Draft' },
          { id: 'costed', label: 'Costed' },
          { id: 'released', label: 'Released' },
        ],
      }),
      column('labTestStatus', 'Lab Test Status', 'select', 4, { options: DEFAULT_STATUS_OPTIONS }),
      column('risk', 'Risk', 'tag', 5),
      column('targetDate', 'Target Date', 'date', 6),
    ],
    statusOptions: DEFAULT_STATUS_OPTIONS,
  },
  {
    id: 'industrial-design',
    label: 'Industrial Design',
    sheetTitle: 'Industrial Design Progress',
    discipline: 'industrial-design',
    version: 1,
    fields: [
      column('concept', 'Concept', 'text', 0, { required: true }),
      column('designStage', 'Design Stage', 'select', 1, {
        options: [
          { id: 'research', label: 'Research' },
          { id: 'concept', label: 'Concept' },
          { id: 'refinement', label: 'Refinement' },
          { id: 'handoff', label: 'Handoff' },
        ],
      }),
      column('cmf', 'CMF', 'multiSelect', 2),
      column('prototype', 'Prototype', 'file', 3),
      column('reviewStatus', 'Review Status', 'select', 4, { options: DEFAULT_STATUS_OPTIONS }),
      column('vendor', 'Vendor', 'text', 5),
      column('decisionOwner', 'Decision Owner', 'person', 6),
    ],
    statusOptions: DEFAULT_STATUS_OPTIONS,
  },
  {
    id: 'project-operations',
    label: 'Project Operations',
    sheetTitle: 'Project Operations Progress',
    discipline: 'project-operations',
    version: 1,
    fields: [
      column('workstream', 'Workstream', 'text', 0, { required: true }),
      column('operationalStatus', 'Operational Status', 'select', 1, { options: DEFAULT_STATUS_OPTIONS }),
      column('owner', 'Owner', 'person', 2),
      column('dependency', 'Dependency', 'link', 3),
      column('slaRisk', 'SLA/Risk', 'tag', 4),
      column('nextCheckpoint', 'Next Checkpoint', 'date', 5),
    ],
    statusOptions: DEFAULT_STATUS_OPTIONS,
  },
  {
    id: 'marketing-campaign',
    label: 'Marketing Campaign',
    sheetTitle: 'Marketing Campaign Progress',
    discipline: 'marketing-campaign',
    version: 1,
    fields: [
      column('campaignAsset', 'Campaign Asset', 'text', 0, { required: true }),
      column('channel', 'Channel', 'multiSelect', 1),
      column('funnelStage', 'Funnel Stage', 'select', 2, {
        options: [
          { id: 'awareness', label: 'Awareness' },
          { id: 'consideration', label: 'Consideration' },
          { id: 'conversion', label: 'Conversion' },
          { id: 'retention', label: 'Retention' },
        ],
      }),
      column('approvalStatus', 'Approval Status', 'select', 3, { options: DEFAULT_STATUS_OPTIONS }),
      column('launchDate', 'Launch Date', 'date', 4),
      column('kpi', 'KPI', 'number', 5),
    ],
    statusOptions: DEFAULT_STATUS_OPTIONS,
  },
  {
    id: 'content-production',
    label: 'Content Production',
    sheetTitle: 'Content Production Progress',
    discipline: 'content-production',
    version: 1,
    fields: [
      column('contentItem', 'Content Item', 'text', 0, { required: true }),
      column('format', 'Format', 'select', 1, {
        options: [
          { id: 'article', label: 'Article' },
          { id: 'video', label: 'Video' },
          { id: 'social', label: 'Social' },
          { id: 'email', label: 'Email' },
        ],
      }),
      column('draftStatus', 'Draft Status', 'select', 2, { options: DEFAULT_STATUS_OPTIONS }),
      column('editor', 'Editor', 'person', 3),
      column('reviewRound', 'Review Round', 'number', 4),
      column('publishChannel', 'Publish Channel', 'multiSelect', 5),
    ],
    statusOptions: DEFAULT_STATUS_OPTIONS,
  },
  {
    id: 'qa-validation',
    label: 'QA Validation',
    sheetTitle: 'QA Validation Progress',
    discipline: 'qa-validation',
    version: 1,
    fields: [
      column('testArea', 'Test Area', 'text', 0, { required: true }),
      column('testType', 'Test Type', 'select', 1, {
        options: [
          { id: 'functional', label: 'Functional' },
          { id: 'regression', label: 'Regression' },
          { id: 'performance', label: 'Performance' },
          { id: 'acceptance', label: 'Acceptance' },
        ],
      }),
      column('environment', 'Environment', 'tag', 2),
      column('caseCount', 'Case Count', 'number', 3),
      column('passRate', 'Pass Rate', 'percent', 4),
      column('defectCount', 'Defect Count', 'number', 5),
      column('retestDate', 'Retest Date', 'date', 6),
    ],
    statusOptions: DEFAULT_STATUS_OPTIONS,
  },
  {
    id: 'construction-field',
    label: 'Construction Field',
    sheetTitle: 'Construction Field Progress',
    discipline: 'construction-field',
    version: 1,
    fields: [
      column('workPackage', 'Work Package', 'text', 0, { required: true }),
      column('trade', 'Trade', 'tag', 1),
      column('permit', 'Permit', 'select', 2, {
        options: [
          { id: 'not-required', label: 'Not Required' },
          { id: 'pending', label: 'Pending' },
          { id: 'approved', label: 'Approved' },
        ],
      }),
      column('inspection', 'Inspection', 'select', 3, { options: DEFAULT_STATUS_OPTIONS }),
      column('siteOwner', 'Site Owner', 'person', 4),
      column('safetyStatus', 'Safety Status', 'select', 5, { options: DEFAULT_STATUS_OPTIONS }),
    ],
    statusOptions: DEFAULT_STATUS_OPTIONS,
  },
  {
    id: 'procurement-vendor',
    label: 'Procurement / Vendor Management',
    sheetTitle: 'Procurement Progress',
    discipline: 'procurement-vendor',
    version: 1,
    fields: [
      column('package', 'Package', 'text', 0, { required: true }),
      column('vendor', 'Vendor', 'text', 1),
      column('rfqStatus', 'RFQ Status', 'select', 2, { options: DEFAULT_STATUS_OPTIONS }),
      column('quoteDue', 'Quote Due', 'date', 3),
      column('poStatus', 'PO Status', 'select', 4, {
        options: [
          { id: 'not-issued', label: 'Not Issued' },
          { id: 'issued', label: 'Issued' },
          { id: 'acknowledged', label: 'Acknowledged' },
          { id: 'closed', label: 'Closed' },
        ],
      }),
      column('leadTimeDays', 'Lead Time', 'number', 5),
      column('deliveryRisk', 'Delivery Risk', 'tag', 6),
    ],
    statusOptions: DEFAULT_STATUS_OPTIONS,
  },
];

export const BUILT_IN_PROGRESS_TEMPLATES: BuiltInProgressTemplate[] = RAW_BUILT_IN_PROGRESS_TEMPLATES.map(
  (template) => ({
    ...template,
    fields: ensureProgressUuidFirstColumn(template.fields),
  }),
);
