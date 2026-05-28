/// <reference types="vitest/globals" />
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider, useI18n } from '../context';

function LangDisplay() {
  const { locale, setLocale, t } = useI18n();
  return (
    <>
      <span data-testid="locale">{locale}</span>
      <span data-testid="term">{t.common.search}</span>
      <button onClick={() => setLocale('zh-hant')}>Switch</button>
    </>
  );
}

beforeEach(() => {
  localStorage.clear();
});

test('defaults to en', () => {
  render(<I18nProvider><LangDisplay /></I18nProvider>);
  expect(screen.getByTestId('locale').textContent).toBe('en');
  expect(screen.getByTestId('term').textContent).toBe('Search');
});

test('setLocale switches translations', () => {
  render(<I18nProvider><LangDisplay /></I18nProvider>);
  fireEvent.click(screen.getByText('Switch'));
  expect(screen.getByTestId('locale').textContent).toBe('zh-hant');
  expect(screen.getByTestId('term').textContent).toBe('搜尋');
});

test('persists selected locale to localStorage', () => {
  render(<I18nProvider><LangDisplay /></I18nProvider>);
  fireEvent.click(screen.getByText('Switch'));
  expect(localStorage.getItem('pm-lang')).toBe('zh-hant');
});

test('sets document.documentElement.lang on locale change', () => {
  render(<I18nProvider><LangDisplay /></I18nProvider>);
  fireEvent.click(screen.getByText('Switch'));
  expect(document.documentElement.getAttribute('lang')).toBe('zh-hant');
});

test('sets document.documentElement.dir for the active locale', () => {
  render(<I18nProvider><LangDisplay /></I18nProvider>);
  expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  fireEvent.click(screen.getByText('Switch'));
  expect(document.documentElement.getAttribute('dir')).toBe('ltr');
});
