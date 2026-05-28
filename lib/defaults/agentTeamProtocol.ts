/**
 * Default Agent Team protocol template (collaboration rules).
 * Written to `.project-manager/agent-team/protocol.md` on project scaffold.
 */

export const AGENT_TEAM_DIR = '.project-manager/agent-team';

export const AGENT_TEAM_PROTOCOL_REL = `${AGENT_TEAM_DIR}/protocol.md`;

/** Project-scoped SKILL.md roots searched for role skill resolution. */
export const PROJECT_SKILL_SEARCH_DIRS = ['.agents/skills', '.claude/skills'] as const;

export const DEFAULT_AGENT_TEAM_PROTOCOL_MD = `# Agent Team Protocol

Collaboration rules for multi-agent dispatches in this project.

## Communication modes

| Mode | When to use | Examples |
|------|-------------|----------|
| **Broadcast** | State the whole team must see | Phase done, blocked, scope change, verification failed, handoff summary |
| **Private (DM)** | One specialist subtask | Code exploration, spike, reading logs — summarize back to the main thread when done |

## Rules

1. **Planner** broadcasts the plan and acceptance criteria before implementation starts.
2. **Worker** keeps private exploration local; broadcast only decisions, file paths touched, and risks.
3. **Evaluator** always broadcasts pass/fail with evidence (commands run, test output, screenshots).
4. Do not repeat full file contents in broadcast — link paths and quote only the minimum lines.
5. When stuck for two iterations without progress, broadcast a concrete blocker question and stop.

## Handoffs

- Subagent results must end with: **Done / Blocked**, what changed, and what the next role should do.
- Never claim success without running the verification steps defined in the feature spec or role prompt.

## 廣播 vs 私聊（摘要）

- **廣播**：階段完成、驗證失敗、範圍變更、需要全隊對齊的決策。
- **私聊**：探索程式碼、試錯、子任務；完成後用簡短摘要廣播回主線。
`;
