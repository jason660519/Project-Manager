# F12 — Skills Management Page

**Status**: done | **Progress**: 100%
**Category**: Execution / Engineer Tools
**Owner**: PM Team

## Summary

A full-featured Skills management page under the Execution section of the sidebar.
Engineers can browse, create, edit, and delete Skill documents (SKILL.md) that
guide AI agents during task execution.

The current implementation is complete for the v1 management workflow.

## Key Screens

- Left category tree + right card grid
- Slide-over detail panel (full SKILL.md markdown)
- Create / Edit modal with frontmatter fields
- Delete confirmation modal

## Implementation Files

| File | Role |
|---|---|
| `app/ui/views/SkillsView.tsx` | Main view (all sub-components) |
| `app/skills/page.tsx` | Next.js route |
| `app/ui/Sidebar.tsx` | Nav item (Sparkles icon) |
| `app/ui/MainClient.tsx` | Route → view mapping |
| `lib/bridge/index.ts` | `skillSave()` bridge function |
| `src-tauri/src/lib.rs` | `skill_save` Tauri command |
| `lib/types/index.ts` | `ViewId += 'skills'` |
| `lib/i18n/*.ts` | `skills` translation key (4 langs) |

## Storage Convention

Skills are stored as `{projectRoot}/.agents/skills/{category}/{slug}/SKILL.md`

Each file has YAML frontmatter:
```yaml
---
name: Skill Name
description: "One-line description"
version: 1.0.0
metadata:
  tags: [tag1, tag2]
  category: workflow
---
```
