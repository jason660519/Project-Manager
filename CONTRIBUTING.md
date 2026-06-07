# Contributing to Project Manager

This guide exists to save both sides time. Read it before opening an issue or a PR.

本指南是為了替雙方節省時間。開 issue 或 PR 前請先讀過。

---

## The One Rule · 唯一鐵律

**You must understand your code.** If you cannot explain what your changes do and how they interact with the rest of the system, your PR will be closed.

**你必須理解自己的程式碼。** 如果你無法說明你的改動做了什麼、以及它如何與系統其餘部分互動，你的 PR 會被關閉。

Using AI to write code is fine. Submitting AI-generated slop without understanding it is not.

用 AI 寫程式碼沒問題。把沒讀懂的 AI 生成垃圾丟過來，不行。

If you use an agent, run it from the repository root so it automatically picks up [`AGENTS.md`](AGENTS.md), [`CLAUDE.md`](CLAUDE.md), and [`GEMINI.md`](GEMINI.md). Your agent must follow the rules in those files — including the **completion gate** (`npm run verify:baseline`) and **bridge / schema / ADR discipline**.

如果你用 agent，請從專案根目錄執行，讓它自動讀取 [`AGENTS.md`](AGENTS.md)、[`CLAUDE.md`](CLAUDE.md)、[`GEMINI.md`](GEMINI.md)。你的 agent 必須遵守這些檔案裡的規則 — 包含**完成關卡**（`npm run verify:baseline`）以及 **bridge / schema / ADR 紀律**。

---

## Quality Bar For Issues · Issue 品質門檻

Keep issues short, concrete, and worth reading.

Issue 請寫得簡短、具體、值得一讀。

- **Keep it concise. If it does not fit on one screen, it is too long.** · 簡潔。塞不進一個畫面就是太長了。
- Write in your own voice. · 用你自己的話寫。
- State the bug or request clearly. · 把 bug 或需求講清楚。
- Explain why it matters. · 說明為什麼重要。
- Include a reproduction and the relevant logs / dev-overlay errors for bugs. · bug 請附上重現步驟與相關 log / dev-overlay 錯誤。
- If you want to implement the change yourself, say so. · 想自己動手實作的話，講一聲。

Low-signal issues, unclear reports, duplicates, and anything that ignores this guide may be closed without discussion.

訊號量低、講不清楚、重複、或無視本指南的 issue，可能不經討論直接關閉。

---

## Before Submitting a PR · 送出 PR 前

Run the full verification baseline — this is the single source of truth for "is it green":

執行完整驗證 baseline — 這是判斷「綠了沒」的唯一依據：

```bash
npm run verify:baseline   # typecheck + standards + docs + hygiene + test + cargo + build
```

It must pass. For UI changes, also smoke-test manually in **Chrome / Safari / Tauri** and confirm the Next.js dev **Issues** badge is **0** on every route you touched.

它必須通過。UI 改動還要在 **Chrome / Safari / Tauri** 手動 smoke test，並確認你動過的每條路由 Next.js dev **Issues** 徽章為 **0**。

Then check your diff against the project's non-negotiables:

接著對照專案的不可妥協項檢查你的 diff：

- **Bridge discipline** — every Tauri command needs a typed wrapper in [`lib/bridge/index.ts`](lib/bridge/index.ts) **and** a capability entry in [`src-tauri/capabilities/default.json`](src-tauri/capabilities/default.json). Never `invoke()` from a component. · 每個 Tauri command 都要在 `lib/bridge/index.ts` 有 typed wrapper **且** 在 capabilities 有對應項目；元件裡不准直接 `invoke()`。
- **Schema versioning (ADR-002)** — any breaking change to `.project-manager/config.json` bumps `schemaVersion`. · 任何對 config.json 的破壞性變更都要 bump `schemaVersion`。
- **Prompt in TS (ADR-003), key in Rust (ADR-004)** — assemble prompts in TypeScript; the Anthropic key never reaches the renderer (proxy through `call_anthropic`). · prompt 在 TS 組裝；Anthropic key 永不進 renderer。
- **Bilingual docs** — `docs/*.md` are English first, then Chinese. Run `npm run docs:check` after editing docs. · 文件英文在前、中文在後；改完跑 `npm run docs:check`。
- **Zero silent failures** — bare `catch (e) {}` or `.unwrap()` on user-facing paths is a defect. · 使用者路徑上的空 `catch` 或 `.unwrap()` 視為缺陷。

Do **not** hand-edit generated files ([`lib/generated/*`](lib/generated/), the documentation-site manifests) — they are produced by `npm run docs:site:sync`.

請**不要**手改生成檔（`lib/generated/*`、documentation-site manifests）— 它們由 `npm run docs:site:sync` 產生。

If you are changing a closed decision, read the relevant ADR under [`docs/architecture/`](docs/architecture/) first and surface the contradiction loudly in your PR description.

如果你要動已定案的決策，先讀 `docs/architecture/` 下對應的 ADR，並在 PR 描述裡明確點出衝突。

---

## Philosophy · 設計哲學

Project Manager's core is a thin shell over a canonical pipeline: ingest → AI-normalize → canonical JSON → dashboard → dispatch. Keep that pipeline minimal and honest. New runtimes belong in [`lib/adapters/`](lib/adapters/); new views follow the `WorkstationFrame` + `BottomSheetTabs` standard. PRs that bloat the core, bypass the bridge, or smuggle business logic into Rust will likely be rejected.

Project Manager 的核心是覆在標準管線（ingest → AI 正規化 → canonical JSON → dashboard → dispatch）上的一層薄殼。請讓這條管線保持精簡而誠實。新 runtime 放 `lib/adapters/`；新 view 遵循 `WorkstationFrame` + `BottomSheetTabs` 標準。會讓核心臃腫、繞過 bridge、或把商業邏輯偷渡進 Rust 的 PR，很可能被退回。

---

## Questions? · 有問題？

Open a [GitHub Discussion or Issue](https://github.com/jason660519/Project-Manager/issues) with the short version, a repro, and the relevant logs.

到 [GitHub Discussion 或 Issue](https://github.com/jason660519/Project-Manager/issues) 開一則，附上精簡描述、重現步驟與相關 log。

---

## FAQ · 常見問題

### Is AI-assisted contribution allowed? · 允許 AI 協助貢獻嗎？

Yes. Agents are first-class here — that is what `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` are for. The line is review: you, the human, must read, understand, and stand behind every line you submit. Polished AI output can still be wrong, misleading, or expensive to investigate. Human review remains the final gate.

可以。Agent 在這裡是一等公民 — 這正是 `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` 存在的理由。界線在於審查：身為人類的你，必須讀過、理解、並為你送出的每一行負責。再漂亮的 AI 產出也可能是錯的、誤導的、或查起來很貴。人類審查仍是最後一道關卡。

### Why is `verify:baseline` mandatory? · 為什麼一定要跑 `verify:baseline`？

Partial runs hide regressions. The baseline bundles typecheck, standards, docs governance, hygiene, tests, `cargo check`, and the static export build into one gate so "it works on my machine" means the same thing for everyone. A red baseline is not done — no exceptions.

部分執行會藏住 regression。Baseline 把 typecheck、standards、docs governance、hygiene、測試、`cargo check` 與靜態匯出 build 綁成單一關卡，讓「在我機器上會動」對所有人意義一致。Baseline 是紅的就不算完成 — 沒有例外。

### Why so much ceremony around the bridge and schema? · 為什麼 bridge 跟 schema 這麼多規矩？

Because they are the seams where this app breaks silently. An `invoke()` without a capability entry fails only in the packaged Tauri build; an unbumped `schemaVersion` corrupts real user config. The discipline exists so those failures surface in review, not in production.

因為那是這個 app 會「無聲壞掉」的接縫。少了 capability 的 `invoke()` 只會在打包後的 Tauri build 失敗；沒 bump 的 `schemaVersion` 會弄壞真實使用者的 config。這些紀律的存在，是要讓這類失敗在審查時浮現，而不是在 production。

### Is this hostile to contributors? · 這對貢獻者很不友善嗎？

No. It is a guardrail against burnout and silent breakage, not a wall. Short, concrete, reproducible issues are welcome. Thoughtful, understood, verified contributions are welcome. Automated slop and large volumes of low-effort reports are not.

不是。這是防止過勞與無聲故障的護欄，不是高牆。簡短、具體、可重現的 issue 受歡迎；經過思考、確實理解、已驗證的貢獻受歡迎。自動化垃圾與大量低品質回報，不歡迎。
