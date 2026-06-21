'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ProgressTemplateDefinition } from '../../../../lib/progress-sheets/catalog';
import {
  createCustomProgressTemplate,
  CUSTOM_PROGRESS_TEMPLATES_CHANGED_EVENT,
  listProgressTemplates,
  removeStoredCustomProgressTemplate,
  updateStoredCustomProgressTemplate,
  upsertCustomProgressTemplate,
} from '../../../../lib/progress-sheets/catalog';

function readTemplates(): ProgressTemplateDefinition[] {
  return listProgressTemplates();
}

export function useProgressTemplatesCatalog() {
  const [templates, setTemplates] = useState<ProgressTemplateDefinition[]>(() => readTemplates());

  useEffect(() => {
    const sync = () => setTemplates(readTemplates());
    sync();
    window.addEventListener(CUSTOM_PROGRESS_TEMPLATES_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CUSTOM_PROGRESS_TEMPLATES_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const addSheet = useCallback((baseTemplateId: string, label: string): ProgressTemplateDefinition => {
    const catalog = readTemplates();
    const baseTemplate = catalog.find((template) => template.id === baseTemplateId);
    if (!baseTemplate) {
      throw new Error(`Unknown base progress template: ${baseTemplateId}`);
    }
    const created = createCustomProgressTemplate(baseTemplate, label, catalog);
    upsertCustomProgressTemplate(created);
    return created;
  }, []);

  const updateTemplate = useCallback((
    templateId: string,
    updater: (template: ProgressTemplateDefinition) => ProgressTemplateDefinition,
  ) => {
    updateStoredCustomProgressTemplate(templateId, updater);
  }, []);

  const deleteTemplate = useCallback((templateId: string) => {
    removeStoredCustomProgressTemplate(templateId);
  }, []);

  return {
    templates,
    addSheet,
    updateTemplate,
    deleteTemplate,
  };
}
