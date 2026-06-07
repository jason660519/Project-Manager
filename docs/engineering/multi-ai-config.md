# Multi-AI Configuration

> Status: Active
> Last updated: 2026-06-07
> Audience: Anyone adding / editing AI-agent instruction files in this repo
> Enforced by: `npm run agents:check` (wired into `npm run verify:baseline`)

---

## English Version

## 1. Why this document exists

This repo is worked on by multiple AI agents — Claude Code, Codex / OpenAI, Gemini,
Cursor, and any future addition. Each brand reads a different instruction file by
convention. Maintaining the same facts in four places guarantees drift.

This document defines the **Single-Source-of-Truth + Thin Shell** model used here.

## 2. The Tier-1 / Tier-2 / Tier-3 model

Three layers, each with a clear scope. Lower-tier rules cannot override higher-tier
Iron Rules.

| Tier | File | Scope | In git? | Edit frequency |
|---|---|---|---|---|
| **1 — Global** | `~/.claude/CLAUDE.md` | Every project the user works on | No | Quarterly |
| **2 — Project** | `AGENTS.md` (SSOT) + `CLAUDE.md` / `GEMINI.md` / `.cursor/rules/*.mdc` (shells) | This repo | Yes | Weekly |
| **3 — Local** | `.claude/local.md` | This repo, this user, this machine | No (gitignored) | Daily |

Conflict resolution: **Tier 2 is ground truth.** Tier 1 and Tier 3 may supplement
gaps but cannot override Iron Rules in `AGENTS.md`.

## 3. Single Source of Truth: `AGENTS.md`

`AGENTS.md` holds **every fact that is true for every AI agent in this repo**:

- Stack and directory map
- ADR-locked decisions
- Iron Rules
- Verification gate (`npm run verify:baseline`)
- Common commands
- Pointers into `docs/architecture/` and `docs/engineering/`

`AGENTS.md` does **not** hold:

- Brand-specific mechanisms (Claude skills, Cursor `alwaysApply`, Gemini Context7 prompts)
- Personal preferences (those belong in Tier 1)
- Machine-specific paths (those belong in Tier 3)

## 4. Thin shells

Every brand-specific file is a **thin shell** — it points at `AGENTS.md` and adds
only what is unique to that brand:

| Shell | Brand-specific content |
|---|---|
| [`CLAUDE.md`](../../CLAUDE.md) | Claude skills routing, `/loop`, `/code-review ultra`, Tier-3 pointer |
| [`GEMINI.md`](../../GEMINI.md) | Context7 mandate, Gemini Workspace boundaries |
| [`.cursor/rules/_agents-pointer.mdc`](../../.cursor/rules/_agents-pointer.mdc) | Cursor `alwaysApply` pointer |
| [`.cursor/rules/verify-before-complete.mdc`](../../.cursor/rules/verify-before-complete.mdc) | Cursor embedded-browser caveat |

Shells must:

1. **Reference `AGENTS.md` by name** — `npm run agents:check` greps for this.
2. **Not redefine SSOT headings** (`## Stack`, `## Iron Rules`, `## Directory Map`,
   `## Common Commands`) — those are SSOT-only.

## 5. Tier-3 personal layer

`.claude/local.md` (gitignored) holds anything that is true only on **this user's
machine, this project**:

- Per-user paths (dev-secrets location, alternate scripts)
- Personal workflow preferences
- In-progress conventions not yet agreed with the team
- TODOs that are just for me

Claude Code loads it automatically. Codex / Gemini / Cursor do not — that is by
design (Tier 3 is one user's notes, not team policy).

If something in Tier 3 turns out to be useful for the whole team, promote it to
`AGENTS.md` via a normal PR.

## 6. Adding a new AI agent

When onboarding a new brand (Cline, Aider, Windsurf, etc.):

1. Find the file the new brand reads (usually a project-root `.md` or `.<brand>/`).
2. Create a thin shell containing exactly:
   - A one-line reference to `AGENTS.md`
   - Brand-specific extras only
3. Add the shell to `SHELLS` in [`scripts/check-agents-drift.mjs`](../../scripts/check-agents-drift.mjs).
4. Run `npm run agents:check` — must pass.
5. Document the addition in this file's table (§4).

## 7. Drift check

`npm run agents:check` (also part of `npm run verify:baseline`) verifies:

- `AGENTS.md` exists and contains the canonical headings (`## 2. Stack`,
  `## 4. Iron Rules`, `## 6. Verification Gate`).
- Each shell references `AGENTS.md` by name.
- No shell redefines an SSOT-only heading.

Failure mode: any drift fails `verify:baseline`, blocking commit / PR.

## 8. Skill directories

Skills live in [`.agents/skills/`](../../.agents/skills/) as the canonical copy.
[`.claude/skills/`](../../.claude/skills/) contains:

- **Symlinks** back to `.agents/skills/` for skills shared with other agents.
- **Real directories** for Claude-only skills (`check-pr`, `pr-review-loop`).

Do not add the same skill in both directories as separate files — it will diverge.

---

## 中文版本

## 1. 為什麼需要這份文件

此 repo 由多個 AI agent 一起協作 —— Claude Code、Codex / OpenAI、Gemini、Cursor，
未來可能還會加入更多。每家慣例讀的指令檔不同；如果把同一份事實寫到四個檔案，
drift 是遲早的事。

本文件定義此 repo 採用的 **Single Source of Truth + Thin Shell** 模型。

## 2. Tier-1 / Tier-2 / Tier-3 三層模型

三層各有清楚邊界。下層不可推翻上層的 Iron Rules。

| 層級 | 檔案 | 作用域 | 進 git？ | 改動頻率 |
|---|---|---|---|---|
| **1 — 全域** | `~/.claude/CLAUDE.md` | 使用者所有專案 | 否 | 季度 |
| **2 — 專案** | `AGENTS.md`（SSOT）+ `CLAUDE.md` / `GEMINI.md` / `.cursor/rules/*.mdc`（薄殼） | 本 repo | 是 | 週 |
| **3 — 個人** | `.claude/local.md` | 本 repo、本使用者、本機 | 否（gitignored） | 日 |

衝突解析：**Tier 2 是 ground truth**。Tier 1 與 Tier 3 可以補 Tier 2 沒涵蓋到的，
但不能推翻 `AGENTS.md` 裡的 Iron Rules。

## 3. Single Source of Truth：`AGENTS.md`

`AGENTS.md` 收錄 **對 repo 內所有 AI agent 都成立的事實**：

- Stack 與目錄結構
- ADR-locked 決策
- Iron Rules
- 完工 gate（`npm run verify:baseline`）
- 常用命令
- 指向 `docs/architecture/` 與 `docs/engineering/` 的指針

`AGENTS.md` 不收錄：

- 品牌特有機制（Claude skills、Cursor `alwaysApply`、Gemini Context7 提示）
- 個人偏好（屬於 Tier 1）
- 本機路徑（屬於 Tier 3）

## 4. 薄殼

每個品牌設定檔都是 **薄殼**：指向 `AGENTS.md`、只放該品牌獨有的內容。

| 薄殼 | 品牌特有內容 |
|---|---|
| [`CLAUDE.md`](../../CLAUDE.md) | Claude skills routing、`/loop`、`/code-review ultra`、Tier-3 指針 |
| [`GEMINI.md`](../../GEMINI.md) | Context7 強制、Gemini Workspace 邊界 |
| [`.cursor/rules/_agents-pointer.mdc`](../../.cursor/rules/_agents-pointer.mdc) | Cursor `alwaysApply` 指針 |
| [`.cursor/rules/verify-before-complete.mdc`](../../.cursor/rules/verify-before-complete.mdc) | Cursor 內建 browser 注意事項 |

薄殼必須：

1. **以名稱引用 `AGENTS.md`** —— `npm run agents:check` 會 grep 此字串。
2. **不重複定義 SSOT 章節**（`## Stack`、`## Iron Rules`、`## Directory Map`、
   `## Common Commands`）—— 那些只能存在於 SSOT。

## 5. Tier-3 個人層

`.claude/local.md`（gitignored）只放 **此使用者、此專案、此機器** 成立的內容：

- 個人路徑（dev-secrets 位置、自己寫的腳本）
- 個人 workflow 偏好
- 還沒跟團隊取得共識的 convention 草案
- 只對自己有用的 TODO

Claude Code 會自動讀取此檔。Codex / Gemini / Cursor 不會 —— 這是設計，不是 bug
（Tier 3 是個人筆記，不是團隊政策）。

如果某項 Tier 3 內容對全團隊都有價值，就透過正常 PR 把它搬到 `AGENTS.md`。

## 6. 新增 AI agent 的流程

要接入新品牌（Cline、Aider、Windsurf 等）：

1. 找出該品牌慣例讀的檔案（通常在 repo 根目錄或 `.<brand>/`）。
2. 建立薄殼，內容只包含：
   - 一行引用 `AGENTS.md`
   - 該品牌獨有的補充
3. 將該薄殼加進 [`scripts/check-agents-drift.mjs`](../../scripts/check-agents-drift.mjs) 的 `SHELLS` 陣列。
4. 跑 `npm run agents:check` —— 必須通過。
5. 在本文件 §4 的表格中登記新薄殼。

## 7. Drift check

`npm run agents:check`（也是 `npm run verify:baseline` 的一環）會驗證：

- `AGENTS.md` 存在，且含有 canonical 章節（`## 2. Stack`、`## 4. Iron Rules`、
  `## 6. Verification Gate`）。
- 每個薄殼都引用了 `AGENTS.md`。
- 沒有薄殼重新定義 SSOT 專屬章節。

任何 drift 都會讓 `verify:baseline` 失敗，阻擋 commit / PR。

## 8. Skills 目錄

Skills canonical 副本在 [`.agents/skills/`](../../.agents/skills/)。
[`.claude/skills/`](../../.claude/skills/) 包含：

- **Symlinks** 指回 `.agents/skills/`（與其他 agent 共用的 skill）
- **實體目錄** 給 Claude-only skills（`check-pr`、`pr-review-loop`）

不要把同一個 skill 在兩邊各放一份實體檔 —— 一定會 diverge。
