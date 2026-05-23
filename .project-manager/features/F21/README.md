# F21 - Initialize Located Section Inference

## Summary

Feature F21 extends Project Manager initialization so `locatedSection` is populated consistently when projects are initialized or re-initialized from the Project Progress Dashboard.

The goal is to avoid empty location metadata after AI scan or scaffold recovery. Users should see a meaningful section hint even when the model omits it.

## Scope

- Add `locatedSection` guidance to AI scan prompt output contract.
- Add deterministic fallback inference in TypeScript.
- Wire inference into initialization write paths.
- Add unit tests that cover common user initialization scenarios and edge cases.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- Dev log: `dev-log.md`
- Notes: `notes.md`

## Current State

- Status: done
- Progress: 100%
- Phase: development

