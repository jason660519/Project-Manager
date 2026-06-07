# External SSD Path Internalization Report

> Status: Completed
> Date: 2026-06-04
> Scope: Project Manager repository references to the former external SSD root

## Summary

Project Manager no longer contains references to the former external SSD root.
All executable references, sample roots, fallback workspace paths, generated
documentation links, and test fixtures were moved to project-local or
Project-Manager-owned paths.

## Scan Inventory

Initial scan found references in these files:

| Area | Files |
| --- | --- |
| Root docs | `README.md`, `README.zh-Hant.md`, `DESIGN.md` |
| Sample config | `config/samples/project-manager.sample.json`, `config/samples/project-manager-self.sample.json`, `.project-manager/config.json` |
| Runtime source | `app/ui/MainClient.tsx`, `app/ui/views/XmuxView.tsx`, `lib/storage/bundledSamples.ts` |
| Generated/docs | `docs/engineering/ui-components-report.md`, `lib/generated/documentation-site-internal.ts`, `docs/project-process/2026-05-29-llm-arena-reference-flow.md`, `docs/project-process/2026-05-29-vlm-image-to-image-evaluation-report.md` |
| Feature artifacts | `.project-manager/features/F22/dev-log.md`, `.project-manager/features/F24/feature-spec.md`, `.project-manager/features/F39/dev-log.md`, `.project-manager/features/F39/feature-spec.md`, `.project-manager/features/F39/tdd-spec.md`, `.project-manager/features/F43/dev-log.md` |
| Tests | `__tests__/dispatch.kill-confirm.test.tsx`, `__tests__/ProjectsView.add-project.test.tsx`, `__tests__/MainClient.sync.test.tsx`, `__tests__/projectEntryNormalization.test.ts`, `__tests__/FolderContent.test.tsx`, `__tests__/dispatch.component.render.test.tsx`, `__tests__/resolveConfigPath.test.ts`, `__tests__/mergeProjectFromDisk.test.ts`, `__tests__/xmux.workspacePaths.test.ts`, `__tests__/integrations.connectedInstances.test.ts`, `__tests__/dispatch.error-states.test.tsx` |

## Resource Movement

| Former dependency | Internalized target | Notes |
| --- | --- | --- |
| Company standards files on removable storage | `internal-resources/company-ai-app-standards/` | Copied the workflow, UI design system, file naming, and table governance markdown files with `cp -p` to preserve file metadata where supported. |
| Owner Property Management Project Manager config | `internal-resources/projects/owner-property-management-ai-spa/.project-manager/config.json` | Copied with `cp -p`; internal root values were rewritten to this project-local snapshot. |
| Fallback xmux external workspace roots | `internal-resources/workspaces/` | Created local placeholder roots so fallback rows never point at removable storage. |

## Deliberate Non-Copy

The referenced Owner Property Management project directory is about 30 GB and
contains secrets, credentials, dependency folders, generated files, logs, and
worktrees. Project Manager does not need that whole checkout for bundled sample
hydration. Copying only the dashboard config avoids importing unrelated private
or generated material into this repository.

## Replacement Policy

- Project Manager's own root now uses `<project-manager-root>`.
- Bundled Owner Property sample roots now use
  `<project-manager-root>/internal-resources/projects/owner-property-management-ai-spa`.
- Fallback xmux workspaces now use `<project-manager-root>/internal-resources/workspaces/*`.
- Historical references were rewritten to describe external SSD absolute paths
  generically rather than preserving the old literal path.

## Verification

Run these commands after any future change to this migration:

```bash
rg -n --hidden --fixed-strings '<former external SSD root>' \
  --glob '!node_modules/**' \
  --glob '!.next/**' \
  --glob '!out/**' \
  --glob '!target/**' \
  --glob '!src-tauri/target/**' \
  --glob '!.git/**'
npm run docs:site:sync
npm run docs:site:check
npm run typecheck
npm run verify:baseline
```
