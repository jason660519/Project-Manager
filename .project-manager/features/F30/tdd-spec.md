# F30 TDD Specification

## Suite A: Enhanced System Prompt & Context (5 tests)
1. System prompt includes Chinese personality and project name
2. System prompt includes feature count summary
3. System prompt includes recent runs when available
4. System prompt respects ~6000 char budget
5. System prompt includes adapter listing

## Suite B: Slash Commands v2 (10 tests)

### B-1: /help
1. Returns markdown table with command listing
2. Includes all subscribed commands (/help, /status, /feature, /runs, /search, /file, /config, /memory, /go, /dispatch)

### B-2: /status  
3. Returns Chinese-format summary with feature counts by status
4. Returns Chinese-format summary with feature counts by phase
5. Shows adapter list and dashboard projects

### B-3: /feature <id>
6. Returns feature details with status, progress, paths, notes
7. Returns error for non-existent feature

### B-4: /runs
8. Shows active runs
9. Shows recent run history

### B-5: /config
10. Shows project configuration with adapter list

### B-6: /memory
11. Shows stored memory contents
12. Shows "no memory stored" when empty

### B-7: /go <view>
13. Navigates to valid view
14. Returns error for invalid view

### B-8: /dispatch <id>
15. Returns dispatch hint
16. Returns error when feature not found

### B-9: Natural Language
17. "搜尋 X" triggers search tool
18. "search for X" triggers search tool
19. "打開 dashboard" navigates to dashboard
20. "帶我去 logs" navigates to logs

## Suite C: Tool Call UI (4 tests)
1. executeSearch calls /api/chat/tools/search with correct params
2. executeSearch handles errors gracefully
3. executeReadFile calls /api/chat/tools/file with correct params  
4. executeReadFile handles file-not-found gracefully

## Suite D: Context Injection (3 tests)
1. ChatContext accepts features array
2. ChatContext accepts dashboardProjects array
3. System prompt includes dashboard project names
