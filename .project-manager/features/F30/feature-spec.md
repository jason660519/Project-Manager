# F30: AI Assistant Capability Upgrade

## Purpose
Upgrade the Project Manager AI Assistant to match (and where practical, exceed) OpenClaw-level capabilities. This transforms the chat assistant from a simple query-router into a context-aware, tool-capable, memory-backed assistant that understands the full project state.

## Scope
- Enhanced system prompt with Chinese personality (小龍蝦 style) and rich project context
- Tool execution framework (search, file read/write)  
- Slash commands v2 with extended local command set
- Cross-session memory via localStorage
- Streaming UX polish with syntax highlighting

## User Stories

### US-01: Enhanced System Prompt
**As a** project manager  
**I want** the AI assistant to know my full project context  
**So that** it gives relevant, accurate answers without me repeating context

### US-02: Slash Commands v2
**As a** power user  
**I want** rich local commands for `/feature`, `/runs`, `/config`, `/memory`, etc.  
**So that** I can quickly inspect project state without leaving the chat

### US-03: Tool Execution
**As a** developer  
**I want** the assistant to search files and read code on demand  
**So that** I can get code-level answers without switching context

### US-04: Cross-Session Memory
**As a** user  
**I want** the assistant to remember preferences and past interactions  
**So that** the experience feels continuous across sessions

### US-05: Streaming UX Polish
**As a** user  
**I want** code blocks with syntax highlighting and smooth streaming  
**So that** reading code in chat is pleasant and productive

## Technical Requirements

### System Prompt v2
- Chinese personality (小龍蝦 tone: casual but competent, 繁體中文)
- Full project context: name, root, IDE
- Feature list with phase/status/progress summary
- Available adapters/agents
- Selected feature details
- Recent run history
- Dashboard project list
- Token budget: ~6000 chars max

### Tool System
- `/api/chat/tools/search` — grep-like file search
- `/api/chat/tools/file` — file content reader
- Client-side wrapper functions in `chatAgent.ts`

### Slash Commands v2
| Command | Handler | Action |
|---------|---------|--------|
| `/help` | Local | Enhanced markdown help table |
| `/status` | Local | Rich summary with feature stats |
| `/feature <id>` | Local | Feature details |
| `/runs` | Local | Active + recent runs |
| `/config` | Local | Project configuration |
| `/memory` | Local | Stored memory dump |
| `/go <view>` | Local | Navigate to view |
| `/dispatch <id>` | Local | Dispatch hint |
| Natural language | Local | "搜尋 X", "search for X", "打開 dashboard" |

### Memory System
- Storage: `localStorage` key `"pm-assistant-memory"`
- Functions: `saveMemory()`, `loadMemory()`
- Auto-save: last search query, last interaction timestamp

## Implementation Plan

### Phase 1: System Prompt (P0)
Rewrite `buildSystemPrompt()` to generate comprehensive context

### Phase 2: Slash Commands v2 (P0)
Implement all local command handlers

### Phase 3: Tool Execution (P1)
Implement `executeSearch()` and `executeReadFile()`

### Phase 4: Memory System (P1)
Implement `saveMemory()` with localStorage persistence

### Phase 5: UX Polish (P2)
- Syntax highlighting via `react-syntax-highlighter`
- Update test suite for new formats

## Acceptance Criteria
1. All 5 user stories pass TDD test suite
2. System prompt includes full Chinese-language context
3. All slash commands respond locally without API calls
4. Tool calls correctly hit `/api/chat/tools/*` endpoints
5. Memory persists across page reloads
6. `npm run typecheck` passes
7. `npm test -- --run` passes all 22 tests
