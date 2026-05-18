# Daily Work Log — Plugin Runtime Isolation And OpenAI Workflow Command

**Date**: 2026-05-18  
**Author**: Codex  
**Status**: Completed with follow-ups  
**Project progress metadata**: Not changed

---

## 1. Summary

Today focused on project-scoped third-party runtime integration for Hermes Agent and OpenClaw, then formalized a Project Manager daily-report workflow for OpenAI/Codex agents.

The main architecture decision was to keep third-party app source, virtual environments, Node dependencies, runtime state, tokens, and generated binaries out of the Next.js `app/` tree and out of tracked Project Manager source. Project Manager now owns wrapper scripts, plugin metadata, user enablement, documentation, and verification. The external runtimes live under `.project-manager/`, which is intentionally git-ignored.

## 2. Completed Work

| Work item | Completion | Notes |
| :-- | :-- | :-- |
| Hermes Agent project-scoped install | 100% | Installer now auto-clones missing source into `.project-manager/vendor/hermes-agent`, builds a local venv, writes a wrapper, and records a manifest. |
| OpenClaw project-scoped install | 100% | Installer now auto-clones missing source into `.project-manager/vendor/openclaw`, builds OpenClaw, writes local state/config, and records a manifest. |
| Plugin catalog integration | 100% | OpenClaw is registered as a disabled-by-default CLI plugin; user can enable it from Plugins. |
| Adapter bridge integration | 100% | Enabled OpenClaw/Hermes CLI plugins are promoted into Project Manager RuntimeAdapters, so dispatch no longer expands plugin commands directly in UI. |
| Update/rollback workflow | 100% | Added OpenClaw and Hermes update/rollback scripts plus runbook instructions. |
| Next/Turbopack build isolation | 100% | Moved external runtimes out of `app/` and top-level source directories; build now passes. |
| OpenAI/Codex daily-report command | 100% | Added a repo-local workflow command and AGENTS routing rule for daily work logs. |

## 3. Deliverables

| Deliverable | Path |
| :-- | :-- |
| Hermes wrapper | `scripts/hermes-agent.sh` |
| Hermes installer | `scripts/install-hermes-agent.sh` |
| Hermes updater | `scripts/update-hermes-agent.sh` |
| Hermes rollback script | `scripts/rollback-hermes-agent.sh` |
| OpenClaw wrapper | `scripts/openclaw.sh` |
| OpenClaw installer | `scripts/install-openclaw.sh` |
| OpenClaw updater | `scripts/update-openclaw.sh` |
| OpenClaw rollback script | `scripts/rollback-openclaw.sh` |
| OpenClaw plugin catalog entry | `lib/storage/plugins.ts` |
| Plugin marketplace entry | `app/ui/views/PluginsView.tsx` |
| Plugin agent adapter bridge | `lib/adapters/registry.ts` |
| RuntimeAdapter dispatch path | `components/table/TaskDispatchModal.tsx`, `lib/adapters/local-ide-adapter.ts` |
| Plugin adapter regression tests | `__tests__/adapterRegistry.plugin.test.ts` |
| OpenClaw operations runbook | `docs/engineering/openclaw-plugin.md` |
| Hermes operations runbook update | `docs/engineering/hermes-agent-plugin.md` |
| Engineering index update | `docs/engineering/README.md` |
| Next build tracing guard | `next.config.mjs`, `lib/scanner/index.ts` |
| OpenAI/Codex daily-report workflow | `docs/project-process/commands/daily-report.md`, `AGENTS.md` |

## 4. Technical Issues And Root Causes

### 4.1 OpenClaw source inside `app/` polluted Next build

**Symptom:** `npm run build` failed because Next App Router treated OpenClaw's internal `route.ts` files as Project Manager routes.

**Root cause:** `app/plugins/openclaw` lived inside the Next App Router tree. Third-party app source can contain route files, Node workspaces, build outputs, and other framework-specific assets that are not part of Project Manager.

**Fix:** Move OpenClaw out of `app/` and ultimately into `.project-manager/vendor/openclaw`, with Project Manager accessing it only through wrapper scripts.

### 4.2 Hermes virtualenv symlink broke Turbopack file tracing

**Symptom:** After OpenClaw was moved, `npm run build` failed on Hermes `venv/bin/python3` symlink tracing.

**Root cause:** Hermes source and virtualenv were still inside a project-visible source tree. Turbopack traced server-side filesystem code from `lib/scanner/index.ts` and encountered virtualenv symlinks pointing outside its filesystem root.

**Fix:** Move Hermes source to `.project-manager/vendor/hermes-agent`, update installer and generated wrapper, and add scanner tracing hints for external project paths.

### 4.3 OpenClaw config used an invalid bind value

**Symptom:** `npm run openclaw:doctor` reported invalid `gateway.bind: local`.

**Root cause:** Current OpenClaw expects bind values such as `loopback`, not `local`.

**Fix:** Set Project Manager OpenClaw config to `gateway.mode=local`, `gateway.bind=loopback`, and `gateway.port=18790`.

### 4.4 Global OpenClaw instance already occupied the default port

**Symptom:** Doctor found an existing global OpenClaw gateway on `18789`.

**Root cause:** A machine-level LaunchAgent/global install was already running outside Project Manager.

**Fix:** Reserve `18790` for Project Manager's OpenClaw gateway to avoid port collision and state confusion.

### 4.5 OpenClaw reinstall after relocation stalled

**Symptom:** After moving OpenClaw into `.project-manager/vendor`, rerunning `npm run openclaw:install` entered a long pnpm/native-package retry and was manually stopped.

**Root cause:** pnpm attempted to fetch or rebuild optional native packages after the checkout moved. The process produced no further useful output for several minutes.

**Fix:** Stopped the stuck install processes, verified no install process remained, and confirmed existing OpenClaw artifacts and CLI still work. Follow-up is to rerun the installer later when a clean rebuild is needed.

## 5. Decisions

| Decision | Rationale |
| :-- | :-- |
| Third-party runtime source belongs under `.project-manager/vendor/` | It is project-scoped but not Project Manager source code. It must not be scanned by Next App Router or Turbopack as app code. |
| `.project-manager/` remains git-ignored | Prevents committed secrets, runtime state, virtualenvs, node_modules, generated binaries, and third-party checkout churn. |
| Project Manager commits wrappers and runbooks, not third-party app source | Keeps update/rollback behavior reproducible without vendoring external runtime trees into this repo. |
| Plugin dispatch goes through RuntimeAdapter | Matches the usual integration boundary: UI chooses an adapter and runtime intent; adapter code owns command/prompt expansion and safety checks. |
| OpenClaw is disabled by default in Plugins | Installation means available; user enablement is a separate product choice. |
| Plugin is product/governance layer; MCP is future capability layer | Plugin manages install/update/rollback/settings. MCP should be added only as a connector/capability surface, not as the lifecycle owner. |
| Codex daily-report workflow lives in repo docs, not as a fake slash command | Codex does not automatically expose Claude `.claude/commands/*.md`; durable behavior needs an explicit repo-local command contract and AGENTS routing rule. |

## 6. Verification

| Command | Result | Notes |
| :-- | :-- | :-- |
| `npm run hermes:install` | Passed | Regenerated Project Manager Hermes wrapper for `.project-manager/vendor/hermes-agent`. |
| `npm run hermes:doctor` | Passed with warnings | Warnings are about optional integrations, network checks, and a global `~/.local/bin/hermes` pointing elsewhere. Project wrapper is correct. |
| `npm run openclaw:install` | Passed before final relocation; interrupted after relocation | Initial install built OpenClaw and control UI. Post-relocation rerun stalled on pnpm/native retry and was stopped. |
| `npm run openclaw -- --version` | Passed | Reported `OpenClaw 2026.5.17 (bef3356)`. |
| `npm run openclaw:doctor` | Passed with warnings | Expected warnings include missing command owner, plugin registry initialization, global service mismatch, and gateway not running. |
| `bash -n scripts/install-openclaw.sh scripts/openclaw.sh scripts/update-openclaw.sh scripts/rollback-openclaw.sh scripts/install-hermes-agent.sh scripts/hermes-agent.sh scripts/update-hermes-agent.sh scripts/rollback-hermes-agent.sh` | Passed | Shell syntax checks passed. |
| `npm run test -- __tests__/adapterRegistry.plugin.test.ts` | Passed | Verifies enabled plugin agents enter the RuntimeAdapter registry, disabled plugin agents stay out, and IDE root fallback is preserved. |
| `npm run docs:check` | Passed | Docs governance checks passed. |
| `npm run typecheck` | Passed | Next route types and TypeScript passed. |
| `npm run build` | Passed | Next/Turbopack production build completed successfully. |
| `npm run standards:check` | Exit 0 with P2 | Existing standards warning: hard-coded color values found outside docs/build/icon folders. |

## 7. Risks And Follow-Ups

| Priority | Follow-up | Reason |
| :-- | :-- | :-- |
| P1 | Add UI buttons for OpenClaw/Hermes install/update/rollback/status | Scripts exist; UI workflow is not yet implemented. |
| P2 | Add a plugin capability manifest model | Needed to distinguish CLI, gateway, MCP, dashboard, updateable, and rollbackable plugins. |
| P2 | Decide whether Hermes/OpenClaw should expose MCP connectors | Plugin lifecycle is in place; MCP can be added later as an AI capability surface. |
| P2 | Resolve standards P2 hard-coded color warning | Current command exits 0 but reports token usage drift. |

## 8. Next Priority

| Priority | Task | Estimate | Dependency |
| :-- | :-- | :-- | :-- |
| P1 | Add plugin lifecycle UI actions for OpenClaw install/update/rollback/status | 2-4 hours | Existing scripts and plugin catalog entry |
| P1 | Add a plugin detail panel showing source path, runtime state, gateway port, and doctor status | 2-3 hours | Plugins view UX decision |
| P2 | Add MCP connector metadata to plugin schema | 3-5 hours | Capability manifest shape |
| P2 | Write ADR for project-scoped third-party runtime isolation | 1-2 hours | Current implementation and runbooks |

---

_Generated by Project Manager OpenAI/Codex daily-report workflow._
