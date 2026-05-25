/**
 * Tool System — Available tools the AI Assistant can call autonomously.
 * Tools are defined as JSON Schema for provider-native function calling.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  tool_call_id: string;
  content: string;
  error?: boolean;
}

// ── Tool Registry ──────────────────────────────────────────────────────────

/** All tools available to the AI assistant */
export const AVAILABLE_TOOLS: ToolDefinition[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file from the project. Use this to inspect source code, configuration, or documentation files.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path to the file from the project root, e.g. "app/chat/ChatPageClient.tsx" or "lib/chat/chatAgent.ts"',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_code',
    description: 'Search the codebase for a query string or pattern. Returns matching file paths and line contents. Use ripgrep for fast searching.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query. Can be a function name, string literal, import path, or regex pattern.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_features',
    description: 'List all features in the current project with their status, progress, and phase.',
    parameters: {
      type: 'object',
      properties: {
        phase: {
          type: 'string',
          enum: ['development', 'e2e_testing', 'deployment', 'operations'],
          description: 'Optional: filter features by lifecycle phase',
        },
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'done', 'on_hold'],
          description: 'Optional: filter features by status',
        },
      },
    },
  },
  {
    name: 'get_feature',
    description: 'Get detailed information about a specific feature including its spec, TDD, implementation paths, notes, and status.',
    parameters: {
      type: 'object',
      properties: {
        feature_id: {
          type: 'string',
          description: 'Feature ID, e.g. "F01", "F14", "F30"',
        },
      },
      required: ['feature_id'],
    },
  },
  {
    name: 'get_runs',
    description: 'Get active and recent agent run history including exit codes, duration, and output summaries.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of runs to return (default: 10)',
        },
      },
    },
  },
  {
    name: 'get_config',
    description: 'Get the current project configuration including adapters, agents, IDE settings, and project metadata.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'run_command',
    description: 'Execute a shell command in the project directory. Use for npm scripts, git operations, build commands, tests, etc. Output is truncated at 8000 characters.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Shell command to execute, e.g. "npm test -- --run", "git status", "ls -la", "wc -l app/**/*.tsx"',
        },
        workdir: {
          type: 'string',
          description: 'Optional working directory relative to project root. Defaults to project root.',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'read_memory',
    description: 'Read previously stored assistant memory entries. Use this to recall user preferences, past decisions, and context.',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Optional: specific memory key to retrieve. Omit to get all memories.',
        },
      },
    },
  },
  {
    name: 'write_memory',
    description: 'Save important information to the assistant\'s memory for future reference. Use this to remember user preferences, decisions, or important context.',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Memory key/name, e.g. "user_preference_theme", "last_search_query"',
        },
        value: {
          type: 'string',
          description: 'Memory value/content to store',
        },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'web_search',
    description: 'Search the web for current information. Use for looking up documentation, error messages, best practices, or any information not available in the project files.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
      },
      required: ['query'],
    },
  },
];
