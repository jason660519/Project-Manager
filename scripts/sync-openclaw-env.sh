#!/usr/bin/env bash
# Sync Project Manager .env API keys into the project-scoped OpenClaw state,
# bootstrap portable auth profiles, and ensure a chat-capable default model.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ENV="${PM_PROJECT_ENV:-$ROOT_DIR/.env}"
OPENCLAW_RUNTIME="${PM_OPENCLAW_RUNTIME:-$ROOT_DIR/.project-manager/openclaw}"
OPENCLAW_STATE_DIR="${PM_OPENCLAW_STATE_DIR:-$OPENCLAW_RUNTIME/state}"
OPENCLAW_ENV_FILE="$OPENCLAW_STATE_DIR/.env"
OPENCLAW_CONFIG_PATH="${PM_OPENCLAW_CONFIG_PATH:-$OPENCLAW_STATE_DIR/openclaw.json}"
AGENT_DIR="$OPENCLAW_STATE_DIR/agents/main/agent"
AUTH_PROFILES_PATH="$AGENT_DIR/auth-profiles.json"

# Provider env vars OpenClaw models.json and skills commonly reference.
SYNC_ENV_KEYS=(
  ANTHROPIC_API_KEY
  CLAUDE_CODE_OAUTH_TOKEN
  OPENAI_API_KEY
  DEEPSEEK_API_KEY
  GEMINI_API_KEY
  GROK_API_KEY
  KIMI_API_KEY
  OPENROUTER_API_KEY
  QWEN_API_KEY
  OPNECODE_API_KEY
  OPENCODE_API_KEY
  OPENCODE_ZEN_API_KEY
  TOGETHER_AI_API_KEY
  ZHIPU_API_KEY
  PERPLEXITY_API_KEY
  HUGGINGFACE_API_TOKEN
  GITHUB_TOKEN
  GITHUB_PERSONAL_ACCESS_TOKEN
  GH_TOKEN
  CURSOR_API_KEY
  KILO_API_KEY
  OLLAMA_CLOUD_API_KEY
  OLLAMA_LOCAL_API_KEY
  FIRECRAWL_API_KEY
)

read_env_value() {
  local file="$1"
  local key="$2"
  awk -F= -v key="$key" '
    $0 !~ /^[[:space:]]*#/ && $1 == key {
      value = substr($0, index($0, "=") + 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      gsub(/^"|"$/, "", value)
      gsub(/^'\''|'\''$/, "", value)
      print value
      exit
    }
  ' "$file"
}

upsert_env_line() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp
  tmp="$(mktemp)"
  if [ -f "$file" ]; then
    awk -v key="$key" -v value="$value" '
      BEGIN { replaced = 0 }
      $0 ~ ("^" key "=") {
        print key "=" value
        replaced = 1
        next
      }
      { print }
      END {
        if (!replaced) {
          print key "=" value
        }
      }
    ' "$file" >"$tmp"
  else
    printf '%s=%s\n' "$key" "$value" >"$tmp"
  fi
  mv "$tmp" "$file"
}

mkdir -p "$OPENCLAW_STATE_DIR" "$AGENT_DIR"
chmod 700 "$OPENCLAW_STATE_DIR"

if [ ! -f "$OPENCLAW_ENV_FILE" ]; then
  token="$(openssl rand -hex 32 2>/dev/null || node -e 'console.log(require("crypto").randomUUID().replaceAll("-", ""))')"
  cat >"$OPENCLAW_ENV_FILE" <<EOF
OPENCLAW_GATEWAY_PORT=18790
OPENCLAW_GATEWAY_BIND=loopback
OPENCLAW_GATEWAY_TOKEN=$token
OPENCLAW_NO_AUTO_UPDATE=1
EOF
  chmod 600 "$OPENCLAW_ENV_FILE"
fi

if [ -f "$PROJECT_ENV" ]; then
  synced=0
  for key in "${SYNC_ENV_KEYS[@]}"; do
    value="$(read_env_value "$PROJECT_ENV" "$key" || true)"
    if [ -n "${value:-}" ]; then
      upsert_env_line "$OPENCLAW_ENV_FILE" "$key" "$value"
      synced=$((synced + 1))
    fi
  done
  echo "OpenClaw env sync: merged $synced API key(s) from $PROJECT_ENV"
else
  echo "OpenClaw env sync: project .env not found at $PROJECT_ENV (skipped key merge)" >&2
fi
chmod 600 "$OPENCLAW_ENV_FILE"

node -e '
const fs = require("fs");
const path = require("path");

const authPath = process.argv[1];
const envPath = process.argv[2];

function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) continue;
    const idx = line.indexOf("=");
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value) out[key] = value;
  }
  return out;
}

const env = readEnv(envPath);
const providers = [];

if (env.ANTHROPIC_API_KEY) providers.push(["anthropic", "ANTHROPIC_API_KEY"]);
if (env.OPENAI_API_KEY) providers.push(["openai", "OPENAI_API_KEY"]);
if (env.DEEPSEEK_API_KEY) providers.push(["deepseek", "DEEPSEEK_API_KEY"]);
if (env.KIMI_API_KEY) {
  providers.push(["kimi", "KIMI_API_KEY"]);
  providers.push(["moonshot", "KIMI_API_KEY"]);
}
if (env.OPENROUTER_API_KEY) providers.push(["openrouter", "OPENROUTER_API_KEY"]);
if (env.QWEN_API_KEY) providers.push(["qwen", "QWEN_API_KEY"]);
if (env.GEMINI_API_KEY) providers.push(["google", "GEMINI_API_KEY"]);
if (env.GROK_API_KEY) providers.push(["xai", "GROK_API_KEY"]);
if (env.TOGETHER_AI_API_KEY) providers.push(["together", "TOGETHER_AI_API_KEY"]);
if (env.PERPLEXITY_API_KEY) providers.push(["perplexity", "PERPLEXITY_API_KEY"]);
if (env.HUGGINGFACE_API_TOKEN) providers.push(["huggingface", "HUGGINGFACE_API_TOKEN"]);
if (env.OPENCODE_API_KEY || env.OPENCODE_ZEN_API_KEY || env.OPNECODE_API_KEY) {
  providers.push(["opencode", env.OPENCODE_API_KEY ? "OPENCODE_API_KEY" : env.OPENCODE_ZEN_API_KEY ? "OPENCODE_ZEN_API_KEY" : "OPNECODE_API_KEY"]);
}

const profiles = {};
for (const [provider, envId] of providers) {
  const profileId = `${provider}:default`;
  profiles[profileId] = {
    type: "api_key",
    provider,
    keyRef: { source: "env", provider: "default", id: envId },
    copyToAgents: true,
  };
}

let store = { version: 1, profiles: {} };
if (fs.existsSync(authPath)) {
  try {
    store = JSON.parse(fs.readFileSync(authPath, "utf8"));
    if (!store || typeof store !== "object") store = { version: 1, profiles: {} };
    if (!store.profiles || typeof store.profiles !== "object") store.profiles = {};
  } catch {
    store = { version: 1, profiles: {} };
  }
}

for (const [id, profile] of Object.entries(profiles)) {
  const existing = store.profiles[id];
  if (!existing || existing.type === "api_key") {
    store.profiles[id] = profile;
  }
}

fs.mkdirSync(path.dirname(authPath), { recursive: true });
fs.writeFileSync(authPath, JSON.stringify(store, null, 2) + "\n", { mode: 0o600 });
console.log(`OpenClaw auth profiles: ensured ${Object.keys(profiles).length} portable profile(s) at ${authPath}`);
' "$AUTH_PROFILES_PATH" "$OPENCLAW_ENV_FILE"

pick_default_model() {
  set -a
  # shellcheck source=/dev/null
  . "$OPENCLAW_ENV_FILE"
  set +a

  # Prefer providers that are already declared in the project-scoped models.json.
  if [ -n "${OPENROUTER_API_KEY:-}" ]; then
    printf '%s' "openrouter/auto"
    return 0
  fi
  if [ -n "${QWEN_API_KEY:-}" ]; then
    printf '%s' "qwen/qwen3.5-plus"
    return 0
  fi
  if [ -n "${DEEPSEEK_API_KEY:-}" ]; then
    printf '%s' "deepseek/deepseek-chat"
    return 0
  fi
  if [ -n "${KIMI_API_KEY:-}" ]; then
    printf '%s' "kimi/kimi-for-coding"
    return 0
  fi
  if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    printf '%s' "anthropic/claude-sonnet-4-6"
    return 0
  fi
  if [ -n "${OPENAI_API_KEY:-}" ]; then
    printf '%s' "openai/gpt-4o"
    return 0
  fi
  return 1
}

if default_model="$(pick_default_model)"; then
  node -e '
const fs = require("fs");
const { execSync } = require("child_process");

const configPath = process.argv[1];
const envPath = process.argv[2];
const defaultModel = process.argv[3];
const rootDir = process.argv[4];

function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) continue;
    const idx = line.indexOf("=");
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value) out[key] = value;
  }
  return out;
}

const env = readEnv(envPath);
const fallbacks = [];
if (env.DEEPSEEK_API_KEY && defaultModel !== "deepseek/deepseek-chat") fallbacks.push("deepseek/deepseek-chat");
if (env.KIMI_API_KEY && defaultModel !== "kimi/kimi-for-coding") fallbacks.push("kimi/kimi-for-coding");
if (env.QWEN_API_KEY && defaultModel !== "qwen/qwen3.5-plus") fallbacks.push("qwen/qwen3.5-plus");
if (env.OPENAI_API_KEY && defaultModel !== "openai/gpt-4o") fallbacks.push("openai/gpt-4o");

let currentPrimary = "";
if (fs.existsSync(configPath)) {
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const model = cfg?.agents?.defaults?.model;
    if (typeof model === "string") currentPrimary = model;
    else if (model && typeof model.primary === "string") currentPrimary = model.primary;
  } catch {
    currentPrimary = "";
  }
}

const shouldPatch =
  !currentPrimary ||
  currentPrimary === "openai/gpt-5.5" ||
  currentPrimary.startsWith("openai-codex/");

if (!shouldPatch) {
  console.log(`OpenClaw default model: kept ${currentPrimary}`);
  process.exit(0);
}

const patch = {
  agents: {
    defaults: {
      model: {
        primary: defaultModel,
        ...(fallbacks.length > 0 ? { fallbacks } : {}),
      },
      models: null,
    },
  },
};

execSync("npm run -s openclaw -- config patch --stdin", {
  cwd: rootDir,
  input: JSON.stringify(patch),
  stdio: ["pipe", "pipe", "pipe"],
});
console.log(`OpenClaw default model: set primary=${defaultModel}${fallbacks.length ? ` fallbacks=${fallbacks.join(",")}` : ""}`);
' "$OPENCLAW_CONFIG_PATH" "$OPENCLAW_ENV_FILE" "$default_model" "$ROOT_DIR"
else
  echo "OpenClaw default model: no supported API key found in $OPENCLAW_ENV_FILE" >&2
fi

OPENCLAW_GATEWAY_PORT="${OPENCLAW_GATEWAY_PORT:-18790}"
if ! lsof -nP -iTCP:"$OPENCLAW_GATEWAY_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  log_file="$ROOT_DIR/.project-manager/dev-logs/openclaw-gateway.log"
  mkdir -p "$(dirname "$log_file")"
  echo "OpenClaw gateway: port $OPENCLAW_GATEWAY_PORT is down; starting in background…"
  (
    cd "$ROOT_DIR"
    nohup npm run openclaw:gateway >>"$log_file" 2>&1 &
  )
  for _ in $(seq 1 20); do
    if lsof -nP -iTCP:"$OPENCLAW_GATEWAY_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "OpenClaw gateway: listening on http://127.0.0.1:${OPENCLAW_GATEWAY_PORT}/"
      break
    fi
    sleep 1
  done
fi
