'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ProgressColumn, ProgressFieldType } from '../../../../lib/types';
import {
  addTemplateField,
  clearStoredTemplateFieldColumns,
  defaultTemplateFieldColumns,
  moveTemplateField,
  persistTemplateFieldColumns,
  readStoredTemplateFieldColumns,
  removeTemplateField,
  TEMPLATE_FIELD_PREFS_CHANGED_EVENT,
  TEMPLATE_FIELD_PREFS_STORAGE_KEY,
  updateTemplateField,
} from '../../../../lib/progress-sheets/templateFieldPreferences';
import {
  CUSTOM_PROGRESS_TEMPLATES_STORAGE_KEY,
  CUSTOM_PROGRESS_TEMPLATES_CHANGED_EVENT,
  isBuiltInTemplateId,
  listProgressTemplates,
  resetCustomProgressTemplateToSystemDefault,
  resetCustomProgressTemplateToUserDefault,
  saveCustomProgressTemplateUserDefault,
  updateStoredCustomProgressTemplate,
} from '../../../../lib/progress-sheets/catalog';

function readColumns(templateId: string): ProgressColumn[] {
  if (isBuiltInTemplateId(templateId)) {
    return readStoredTemplateFieldColumns(templateId);
  }
  return listProgressTemplates().find((template) => template.id === templateId)?.fields ?? [];
}

export function useTemplateFieldPreferences(templateId: string) {
  const [columns, setColumns] = useState<ProgressColumn[]>(() => readColumns(templateId));

  useEffect(() => {
    const sync = () => setColumns(readColumns(templateId));
    sync();

    const onChange = () => sync();
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === null
        || event.key === TEMPLATE_FIELD_PREFS_STORAGE_KEY
        || event.key === CUSTOM_PROGRESS_TEMPLATES_STORAGE_KEY
      ) {
        sync();
      }
    };
    window.addEventListener(TEMPLATE_FIELD_PREFS_CHANGED_EVENT, onChange);
    window.addEventListener(CUSTOM_PROGRESS_TEMPLATES_CHANGED_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(TEMPLATE_FIELD_PREFS_CHANGED_EVENT, onChange);
      window.removeEventListener(CUSTOM_PROGRESS_TEMPLATES_CHANGED_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, [templateId]);

  const patchColumns = useCallback((updater: (current: ProgressColumn[]) => ProgressColumn[]) => {
    setColumns((current) => {
      const next = updater(current);
      if (isBuiltInTemplateId(templateId)) {
        persistTemplateFieldColumns(templateId, next);
        return readStoredTemplateFieldColumns(templateId);
      }
      updateStoredCustomProgressTemplate(templateId, (template) => ({
        ...template,
        fields: next,
        version: template.version + 1,
      }));
      return readColumns(templateId);
    });
  }, [templateId]);

  const reset = useCallback(() => {
    if (!isBuiltInTemplateId(templateId)) {
      return;
    }
    clearStoredTemplateFieldColumns(templateId);
    setColumns(defaultTemplateFieldColumns(templateId));
  }, [templateId]);

  const saveUserDefault = useCallback(() => {
    if (isBuiltInTemplateId(templateId)) return;
    saveCustomProgressTemplateUserDefault(templateId);
    setColumns(readColumns(templateId));
  }, [templateId]);

  const resetUserDefault = useCallback(() => {
    if (isBuiltInTemplateId(templateId)) return;
    resetCustomProgressTemplateToUserDefault(templateId);
    setColumns(readColumns(templateId));
  }, [templateId]);

  const resetSystemDefault = useCallback(() => {
    if (isBuiltInTemplateId(templateId)) {
      clearStoredTemplateFieldColumns(templateId);
      setColumns(defaultTemplateFieldColumns(templateId));
      return;
    }
    resetCustomProgressTemplateToSystemDefault(templateId);
    setColumns(readColumns(templateId));
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
    saveUserDefault,
    resetUserDefault,
    resetSystemDefault,
    addField,
    updateField,
    removeField,
    moveField,
  };
}
