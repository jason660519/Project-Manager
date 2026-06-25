# F57 Test Scenarios - Agent Environment Scanner Foundations

## User Scenarios

| ID | Scenario | Expected outcome |
| --- | --- | --- |
| US-01 | PM opens future Agent Runtime inventory on a machine with Codex, Claude, and Gemini configured. | Inventory shows those tools as ready or partial with clear path evidence. |
| US-02 | PM opens inventory on a fresh machine with no agent tools configured. | Inventory shows known tools as missing without crashing. |
| US-03 | Engineer has a CLI installed but has never initialized its config directory. | Inventory shows partial and explains the missing config root. |
| US-04 | Engineer has old config files but the CLI binary is not available. | Inventory shows partial and explains the missing command. |
| US-05 | Security reviewer inspects scanner output with auth files present. | Output reports secret-bearing files as present but does not include contents. |
| US-06 | Future UI builds a table from scanner rows. | Rows have stable deterministic IDs and sorted order. |

## Given / When / Then Matrix

### US-01 Normal Inventory

**Given** a filesystem snapshot containing known config roots and commands  
**When** the scanner runs  
**Then** it emits one row per known tool  
**And** rows include capability flags for runtime, MCP, skills, sessions, and cost.

### US-02 Empty Machine

**Given** an empty filesystem snapshot and no commands  
**When** the scanner runs  
**Then** every supported known tool is `missing`  
**And** the call returns successfully.

### US-03 CLI Without Config

**Given** command `codex` exists  
**And** `/Users/example/.codex` is missing  
**When** the scanner runs  
**Then** Codex is `partial`  
**And** warning code is `config_root_missing`.

### US-04 Config Without CLI

**Given** `/Users/example/.gemini` exists  
**And** command `gemini` is missing  
**When** the scanner runs  
**Then** Gemini is `partial`  
**And** warning code is `command_missing`.

### US-05 Secret Boundary

**Given** `/Users/example/.codex/auth.json` exists  
**When** scanner output is serialized  
**Then** it contains `auth.json` path metadata  
**And** it does not contain `sk-`, `ghp_`, `refresh_token`, or `access_token` values.

### US-06 Stable Table Input

**Given** the same snapshot is scanned twice  
**When** future UI consumes the rows  
**Then** row IDs and order are stable enough for table preference persistence.

## Manual Verification Deferred

Manual UI checks are deferred until a future Agent Runtime Inventory view exists.
F57 verification is command-line only.
