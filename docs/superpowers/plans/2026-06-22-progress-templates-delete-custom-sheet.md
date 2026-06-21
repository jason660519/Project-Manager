# Progress Templates Custom Sheet Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Progress Templates Setting custom-sheet delete flow so only user-created sheets can be deleted and every delete path requires in-app confirmation.

**Architecture:** Keep deletion owned by `ProgressTemplatesSettingView`; route toolbar delete and tab close through one `requestDeleteSheet(templateId)` callback. Keep storage enforcement in `lib/progress-sheets/catalog.ts` as the hard guard against built-in deletion.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Testing Library, existing `BottomSheetTabs` and `useInAppConfirm`.

## Global Constraints

- Use `WorkstationFrame` and `BottomSheetTabs`; bottom tabs stay in the bottom slot.
- Do not expose delete controls for built-in progress templates.
- Use an in-app confirmation dialog for destructive actions; do not use `window.confirm`.
- Run focused tests and `npm run typecheck` before reporting implementation status.

---

### Task 1: Confirmed Custom Sheet Deletion

**Files:**
- Modify: `__tests__/progressTemplatesSettingTab.test.tsx`
- Modify: `app/ui/views/ProgressTemplatesSettingView.tsx`
- Test: `__tests__/progressTemplatesSettingTab.test.tsx`

**Interfaces:**
- Consumes: `BottomSheetTabs` `onClose?: (key: Key) => void`
- Produces: `requestDeleteSheet(templateId: string): Promise<void>`

- [ ] **Step 1: Write failing tests**

Add tests that verify tab close opens confirmation, cancel preserves the custom sheet, confirm deletes it, and built-in sheets have no delete control.

- [ ] **Step 2: Run focused test to verify RED**

Run: `npm test -- __tests__/progressTemplatesSettingTab.test.tsx`
Expected: FAIL because inactive/custom tab close currently bypasses confirmation and built-in tabs expose close buttons.

- [ ] **Step 3: Implement minimal production change**

Move delete logic into a template-id based async callback, keep built-in guard, and pass close labels only for custom tabs. Ensure all close/delete controls call the same callback.

- [ ] **Step 4: Run focused test and typecheck**

Run: `npm test -- __tests__/progressTemplatesSettingTab.test.tsx`
Expected: PASS

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Report verification**

Summarize root cause, changed files, and any remaining full-baseline/manual-smoke gaps.
