/**
 * Server-side Tool Executor
 * Executes tool calls from the AI assistant within the project context.
 * All tool execution is sandboxed to the project root.
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';
import type { ToolCall, ToolResult } from './tools';

// ── Configuration ───────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 100 * 1024; // 100 KB
const MAX_COMMAND_OUTPUT = 8000; // chars
const COMMAND_TIMEOUT = 30000; // 30s
const ALLOWED_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.css',
  '.html', '.yml', '.yaml', '.toml', '.env', '.gitignore', '.csv', '.log',
  '.xml', '.svg', '.graphql', '.prisma', '.sql',
];

// Commands that are always blocked for safety
const BLOCKED_COMMANDS = [
  /rm\s+-rf/, /sudo/, />\s*\/dev\//, /mkfs/, /dd\s+if=/,
  /:\(\)\s*\{/, /chmod\s+777/, /curl.*\|\s*(ba)?sh/,
];

// ── Project Context ─────────────────────────────────────────────────────────

export interface ToolContext {
  projectRoot: string;
  features?: Array<{
    id: string; name: string; status: string; progress: number;
    category?: string; phase?: string; points?: number;
    notes?: string;
    paths?: Record<string, string>;
  }>;
  config?: {
    projectName?: string;
    defaultIDE?: string;
    agentCount?: number;
    featureCount?: number;
    adapterNames?: string[];
  };
  activeRuns?: Array<{
    pid: number; featureId: string; featureName: string;
    phase: string; command: string; startedAt: number;
  }>;
  recentRuns?: Array<{
    featureName: string; exitCode: number; success: boolean;
  }>;
}

// ── Tool Execution ──────────────────────────────────────────────────────────

function ok(call: ToolCall, content: string): ToolResult {
  return { tool_call_id: call.id, content };
}

function err(call: ToolCall, content: string): ToolResult {
  return { tool_call_id: call.id, content, error: true };
}

async function executeReadFile(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
  const { path } = call.arguments as { path?: string };
  if (!path || typeof path !== 'string') return err(call, 'Missing required parameter: path');

  const fullPath = resolve(ctx.projectRoot, path);
  if (!fullPath.startsWith(resolve(ctx.projectRoot))) {
    return err(call, 'Path traversal denied');
  }
  if (!existsSync(fullPath)) return err(call, `File not found: ${path}`);
  
  const stat = statSync(fullPath);
  if (stat.isDirectory()) return err(call, `Path is a directory: ${path}`);
  if (stat.size > MAX_FILE_SIZE) return err(call, `File too large (${(stat.size / 1024).toFixed(1)} KB)`);

  const ext = '.' + path.split('.').pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext) && ext !== '.') {
    return ok(call, `[Binary file: ${path} (${(stat.size / 1024).toFixed(1)} KB)]`);
  }

  const content = readFileSync(fullPath, 'utf-8');
  const langMap: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'tsx', '.js': 'javascript', '.jsx': 'jsx',
    '.json': 'json', '.md': 'markdown', '.css': 'css', '.html': 'html',
    '.yml': 'yaml', '.yaml': 'yaml', '.sql': 'sql', '.graphql': 'graphql',
  };
  const lang = langMap[ext] || '';
  return ok(call, `\`\`\`${lang}\n${content.slice(0, 50000)}\n\`\`\``);
}

async function executeSearchCode(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
  const { query } = call.arguments as { query?: string };
  if (!query || typeof query !== 'string') return err(call, 'Missing required parameter: query');

  const sanitized = query.replace(/['";&|`$]/g, '').slice(0, 200);
  if (sanitized.length < 2) return err(call, 'Query too short');

  try {
    let output: string;
    try {
      output = execSync(
        `rg --no-heading -n -i --max-count 20 "${sanitized}" "${ctx.projectRoot}/app" "${ctx.projectRoot}/lib" "${ctx.projectRoot}/components" 2>/dev/null`,
        { encoding: 'utf-8', timeout: 10000, maxBuffer: 1024 * 1024 }
      );
    } catch {
      try {
        output = execSync(
          `grep -rn -i --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" "${sanitized}" "${ctx.projectRoot}" 2>/dev/null | head -25`,
          { encoding: 'utf-8', timeout: 10000, maxBuffer: 1024 * 1024 }
        );
      } catch {
        return ok(call, 'No results found.');
      }
    }

    if (!output.trim()) return ok(call, 'No results found.');
    const lines = output.trim().split('\n');
    const formatted = lines.map(l => `- \`${l.replace(ctx.projectRoot, '').replace(/^\//, '')}\``).join('\n');
    return ok(call, `Found ${lines.length} results:\n${formatted}`);
  } catch (e) {
    return err(call, `Search failed: ${(e as Error).message}`);
  }
}

async function executeListFeatures(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
  const args = call.arguments as { phase?: string; status?: string };
  let features = ctx.features ?? [];

  if (args.phase) features = features.filter(f => (f.phase ?? 'development') === args.phase);
  if (args.status) features = features.filter(f => f.status === args.status);

  if (features.length === 0) return ok(call, 'No features match the criteria.');

  const lines = ['| ID | Name | Status | Progress | Phase | Points |',
    '|----|------|--------|----------|-------|--------|'];
  features.slice(0, 30).forEach(f => {
    const icon = f.status === 'done' ? '✅' : f.status === 'in_progress' ? '🔄' : f.status === 'on_hold' ? '⏸️' : '📋';
    lines.push(`| ${f.id} | ${f.name} | ${icon} ${f.status} | ${f.progress}% | ${f.phase ?? 'development'} | ${f.points ?? 1} |`);
  });

  return ok(call, `${features.length} features:\n\n${lines.join('\n')}`);
}

async function executeGetFeature(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
  const { feature_id } = call.arguments as { feature_id?: string };
  if (!feature_id) return err(call, 'Missing required parameter: feature_id');

  const feature = (ctx.features ?? []).find(
    f => f.id.toUpperCase() === feature_id.toUpperCase() ||
         f.name.toLowerCase().includes(feature_id.toLowerCase())
  );
  if (!feature) return err(call, `Feature not found: ${feature_id}`);

  const lines = [
    `## ${feature.id}: ${feature.name}`,
    '',
    `- **Status:** ${feature.status}`,
    `- **Progress:** ${feature.progress}%`,
    `- **Category:** ${feature.category ?? 'N/A'}`,
    `- **Phase:** ${feature.phase ?? 'development'}`,
    `- **Points:** ${feature.points ?? 1}`,
  ];
  if (feature.notes) lines.push('', `**Notes:** ${feature.notes}`);
  if (feature.paths) {
    lines.push('', '**Paths:**');
    Object.entries(feature.paths).forEach(([k, v]) => {
      if (v) lines.push(`- ${k}: \`${v}\``);
    });
  }
  return ok(call, lines.join('\n'));
}

async function executeGetRuns(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
  const { limit } = (call.arguments as { limit?: number }) ?? {};
  const max = Math.min(limit ?? 10, 30);

  const lines: string[] = [];

  if (ctx.activeRuns && ctx.activeRuns.length > 0) {
    lines.push('## Active Runs');
    ctx.activeRuns.forEach(r => {
      const dur = Math.round((Date.now() - r.startedAt) / 1000);
      lines.push(`- 🔄 **${r.featureName}** — PID ${r.pid}, ${dur}s`);
    });
    lines.push('');
  }

  if (ctx.recentRuns && ctx.recentRuns.length > 0) {
    lines.push('## Recent Runs');
    ctx.recentRuns.slice(0, max).forEach(r => {
      const icon = r.success ? '✅' : '❌';
      lines.push(`- ${icon} **${r.featureName}** — exit ${r.exitCode}`);
    });
  }

  if (lines.length === 0) return ok(call, 'No active or recent runs.');
  return ok(call, lines.join('\n'));
}

async function executeGetConfig(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
  const c = ctx.config;
  if (!c) return ok(call, 'No project configuration available.');

  const lines = [
    '## Project Configuration',
    '',
    `- **Project:** ${c.projectName ?? 'N/A'}`,
    `- **Default IDE:** ${c.defaultIDE ?? 'N/A'}`,
    `- **Features:** ${c.featureCount ?? 0}`,
    `- **Agents:** ${c.agentCount ?? 0}`,
  ];
  if (c.adapterNames && c.adapterNames.length > 0) {
    lines.push('', '**Adapters:**');
    c.adapterNames.forEach(n => lines.push(`- ${n}`));
  }
  return ok(call, lines.join('\n'));
}

async function executeRunCommand(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
  const { command, workdir } = call.arguments as { command?: string; workdir?: string };
  if (!command || typeof command !== 'string') return err(call, 'Missing required parameter: command');

  // Safety checks
  for (const pattern of BLOCKED_COMMANDS) {
    if (pattern.test(command)) return err(call, `Blocked dangerous command pattern: ${pattern}`);
  }

  // Limit command length
  const cmd = command.slice(0, 1000);
  const cwd = workdir ? resolve(ctx.projectRoot, workdir) : ctx.projectRoot;

  if (!cwd.startsWith(resolve(ctx.projectRoot))) return err(call, 'Path traversal denied');

  try {
    const output = execSync(cmd, {
      encoding: 'utf-8',
      cwd,
      timeout: COMMAND_TIMEOUT,
      maxBuffer: 1024 * 1024,
    });
    const truncated = output.length > MAX_COMMAND_OUTPUT
      ? output.slice(0, MAX_COMMAND_OUTPUT) + '\n... (output truncated)'
      : output;
    return ok(call, truncated || '(command completed with no output)');
  } catch (e: any) {
    const stderr = e.stderr || e.message || String(e);
    return err(call, `Command failed:\n${stderr.slice(0, MAX_COMMAND_OUTPUT)}`);
  }
}

// ── Main Executor ───────────────────────────────────────────────────────────

/**
 * Execute a single tool call within the project context.
 * Returns a ToolResult that can be fed back to the LLM.
 */
export async function executeToolCall(
  call: ToolCall,
  context: ToolContext,
): Promise<ToolResult> {
  console.log(`[ToolExecutor] Executing: ${call.name}(${JSON.stringify(call.arguments)})`);

  switch (call.name) {
    case 'read_file':      return executeReadFile(call, context);
    case 'search_code':    return executeSearchCode(call, context);
    case 'list_features':  return executeListFeatures(call, context);
    case 'get_feature':    return executeGetFeature(call, context);
    case 'get_runs':       return executeGetRuns(call, context);
    case 'get_config':     return executeGetConfig(call, context);
    case 'run_command':    return executeRunCommand(call, context);
    case 'read_memory':
    case 'write_memory':
      // These are handled client-side since they need browser localStorage
      return ok(call, `Tool "${call.name}" must be executed client-side. Ask the user to run it.`);
    case 'web_search': {
      const { query } = call.arguments as { query?: string };
      if (!query || typeof query !== 'string') return err(call, 'Missing required parameter: query');
      try {
        // Try SearXNG public instances first, then fall back to DDG lite
        const instances = [
          `https://search.sapti.me/search?q=${encodeURIComponent(query)}&format=json&categories=general`,
          `https://search.bus-hit.me/search?q=${encodeURIComponent(query)}&format=json&categories=general`,
        ];
        let results: Array<{ title: string; snippet: string; url: string }> = [];

        for (const searchUrl of instances) {
          try {
            const resp = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) });
            if (!resp.ok) continue;
            const data = await resp.json();
            const items = data.results || [];
            results = items.slice(0, 5).map((r: { title?: string; content?: string; snippet?: string; url?: string }) => ({
              title: r.title || 'Untitled',
              snippet: (r.content || r.snippet || '').slice(0, 250),
              url: r.url || '',
            }));
            if (results.length > 0) break;
          } catch { continue; }
        }

        // Fallback: use OpenClaw web search via gateway if available
        if (results.length === 0 && process.env.OPENCLAW_GATEWAY_URL) {
          results = [{ title: 'Search not available', snippet: 'Configure a search API key or use the AI assistant with OpenClaw gateway.', url: '' }];
        }

        if (results.length === 0) return ok(call, `No web results found for "${query}". Web search requires an API key or supported search backend.`);
        const formatted = results.map((r, i) =>
          `${i + 1}. **${r.title}**\n   ${r.snippet ? r.snippet + '\n   ' : ''}${r.url}`
        ).join('\n\n');
        return ok(call, `Web search results for "${query}":\n\n${formatted}`);
      } catch (e) {
        return err(call, `Web search failed: ${(e as Error).message}`);
      }
    }
    default:
      return err(call, `Unknown tool: ${call.name}`);
  }
}

/**
 * Build Anthropic-format tool definitions from our tool registry.
 */
export function toAnthropicTools(tools: typeof import('./tools').AVAILABLE_TOOLS) {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

/**
 * Build OpenAI-format tool definitions.
 */
export function toOpenAITools(tools: typeof import('./tools').AVAILABLE_TOOLS) {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
