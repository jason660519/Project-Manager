# Hermes Agent Plugin Runbook

> Status: Active
> Last updated: 2026-05-18
> Scope: Project-scoped Hermes Agent installation and plugin toggle behavior

## English Version

## 1. Purpose

Project Manager vendors Hermes Agent source under `.project-manager/vendor/hermes-agent/`, but runtime state must stay inside this repository scope. Do not use the machine-wide default `~/.hermes` for Project Manager automation.

The project-scoped install uses:

| Item | Path |
| --- | --- |
| Hermes source checkout | `.project-manager/vendor/hermes-agent/` |
| Python virtual environment | `.project-manager/vendor/hermes-agent/venv/` |
| Project Hermes home | `.project-manager/hermes/` |
| Stable CLI wrapper | `.project-manager/bin/hermes` |

`.project-manager/` is local runtime state and is ignored by git.

## 2. Install

Run:

```bash
npm run hermes:install
```

The installer creates the virtual environment, installs Hermes from the local checkout, creates a project-local `HERMES_HOME`, and writes a wrapper at `.project-manager/bin/hermes`.

Useful commands:

```bash
npm run hermes -- --version
npm run hermes:doctor
npm run hermes:dashboard
```

`npm run hermes:dashboard` starts the Hermes dashboard on `127.0.0.1:9119` without opening a browser. Project Manager's Documentation view reads the OpenAPI spec from this same local port.

## 3. Plugin Behavior

Hermes Agent is registered as a CLI plugin with:

```text
command: /Volumes/KLEVV-4T-1/Project-Manager/.project-manager/bin/hermes
args:    chat -q {prompt}
```

It is installed into the plugin catalog but disabled by default. Users can open `Plugins -> Installed` and toggle Hermes Agent on or off. When enabled, Project Manager exposes it as an agent adapter for dispatch flows without changing `.project-manager.json`.

## 4. Isolation Rules

- Always run Hermes through `scripts/hermes-agent.sh`, `.project-manager/bin/hermes`, or the npm scripts above.
- Keep `HERMES_HOME` pointed at `.project-manager/hermes`.
- Do not run the upstream `setup-hermes.sh` for Project Manager integration because it writes machine-global shell aliases and uses `~/.hermes`.
- Keep API keys and provider setup inside the project Hermes home unless a separate ADR explicitly changes the boundary.

## 中文版本

## 1. 目的

Project Manager 已把 Hermes Agent source 放在 `.project-manager/vendor/hermes-agent/`，但 Hermes 的記憶、sessions、skills、logs、gateway 狀態必須留在本 repo scope。不要讓 Project Manager 的 Hermes automation 寫入全機共用的 `~/.hermes`。

## 2. 安裝與啟動

```bash
npm run hermes:install
npm run hermes:doctor
npm run hermes:dashboard
```

安裝後，Hermes CLI wrapper 會在 `.project-manager/bin/hermes`，runtime home 會在 `.project-manager/hermes/`。這個資料夾是本機狀態，已由 `.gitignore` 排除。

## 3. Plugin 開關

Hermes Agent 會出現在 `Plugins -> Installed`，預設是關閉。使用者打開 toggle 後，Project Manager 會把它視為可派遣的 agent adapter，command 走本 repo 的 `.project-manager/bin/hermes`，不需要修改每個受管理專案的 `.project-manager.json`。

## 4. 隔離規則

- 只透過 `scripts/hermes-agent.sh`、`.project-manager/bin/hermes` 或 npm scripts 啟動。
- `HERMES_HOME` 必須指向 `.project-manager/hermes`。
- 不用 Hermes upstream 的 `setup-hermes.sh` 做 Project Manager 整合，因為它會建立全域 alias 並使用 `~/.hermes`。
