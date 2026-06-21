'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ProgressColumn, ProgressFieldType } from '../../../../lib/types';
import {
  addTemplateField,
  clearStoredTemplateFieldColumns,
  defaultTemplateFieldColumns,
  isBuiltInTemplateId,
  moveTemplateField,
  persistTemplateFieldColumns,
  readStoredTemplateFieldColumns,
  removeTemplateField,
  TEMPLATE_FIELD_PREFS_CHANGED_EVENT,
  TEMPLATE_FIELD_PREFS_STORAGE_KEY,
  updateTemplateField,
} from '../../../../lib/progress-sheets/templateFieldPreferences';

export function useTemplateFieldPreferences(templateId: string) {
  const [columns, setColumns] = useState<ProgressColumn[]>(() => (
    isBuiltInTemplateId(templateId)
      ? defaultTemplateFieldColumns(templateId)
      : []
  ));

  useEffect(() => {
    if (!isBuiltInTemplateId(templateId)) {
      setColumns([]);
      return;
    }

    const sync = () => setColumns(readStoredTemplateFieldColumns(templateId));
    sync();

    const onChange = () => sync();
    window.addEventListener(TEMPLATE_FIELD_PREFS_CHANGED_EVENT, onChange);
    window.addEventListener('storage', (event) => {
      if (event.key === TEMPLATE_FIELD_PREFS_STORAGE_KEY) sync();
    });
    return () => {
      window.removeEventListener(TEMPLATE_FIELD_PREFS_CHANGED_EVENT, onChange);
    };
  }, [templateId]);

  const patchColumns = useCallback((updater: (current: ProgressColumn[]) => ProgressColumn[]) => {
    setColumns((current) => {
      const next = updater(current);
      persistTemplateFieldColumns(templateId, next);
      return readStoredTemplateFieldColumns(templateId);
    });
  }, [templateId]);

  const reset = useCallback(() => {
    clearStoredTemplateFieldColumns(templateId);
    setColumns(defaultTemplateFieldColumns(templateId));
  }, [templateId]);

  const addField = useCallback((label: string, fieldType: ProgressFieldType) => {
    patchColumns((current) => addTemplateField(templateId, current, label, fieldType));
  }, [patchColumns, templateId]);

  const updateField = useCallback((
    fieldId: string,
    patch: Partial<Pick<ProgressColumn, 'label' | 'fieldType' | 'visible' | 'required'>>,
  ) => {
    patchColumns((current) => updateTemplateField(templateId, current, fieldId, patch));
  }, [patchColumns, templateId]);

  const removeField = useCallback((fieldId: string) => {
    patchColumns((current) => removeTemplateField(templateId, current, fieldId));
  }, [patchColumns, templateId]);

  const moveField = useCallback((fieldId: string, direction: 'up' | 'down') => {
    patchColumns((current) => moveTemplateField(templateId, current, fieldId, direction));
  }, [patchColumns, templateId]);

  return {
    columns,
    reset,
    addField,
    updateField,
    removeField,
    moveField,
  };
}
