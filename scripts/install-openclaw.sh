#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENCLAW_SRC="${PM_OPENCLAW_SRC:-$ROOT_DIR/.project-manager/vendor/openclaw}"
OPENCLAW_RUNTIME="${PM_OPENCLAW_RUNTIME:-$ROOT_DIR/.project-manager/openclaw}"
OPENCLAW_STATE_DIR="${PM_OPENCLAW_STATE_DIR:-$OPENCLAW_RUNTIME/state}"
OPENCLAW_WORKSPACE_DIR="${PM_OPENCLAW_WORKSPACE_DIR:-$OPENCLAW_RUNTIME/workspace}"
OPENCLAW_CONFIG_PATH="${PM_OPENCLAW_CONFIG_PATH:-$OPENCLAW_STATE_DIR/openclaw.json}"
OPENCLAW_ENV_FILE="$OPENCLAW_STATE_DIR/.env"
BIN_DIR="$ROOT_DIR/.project-manager/bin"
WRAPPER="$BIN_DIR/openclaw"
MANIFEST="$OPENCLAW_RUNTIME/manifest.json"

if [ ! -f "$OPENCLAW_SRC/package.json" ]; then
  echo "OpenClaw source not found at: $OPENCLAW_SRC" >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required for OpenClaw source installs." >&2
  exit 1
fi

mkdir -p "$OPENCLAW_STATE_DIR" "$OPENCLAW_WORKSPACE_DIR" "$OPENCLAW_RUNTIME/home" "$BIN_DIR"

if [ ! -f "$OPENCLAW_ENV_FILE" ]; then
  token="$(openssl rand -hex 32 2>/dev/null || node -e 'console.log(crypto.randomUUID().replaceAll("-", ""))')"
  cat > "$OPENCLAW_ENV_FILE" <<EOF
OPENCLAW_GATEWAY_PORT=18790
OPENCLAW_GATEWAY_BIND=loopback
OPENCLAW_GATEWAY_TOKEN=$token
OPENCLAW_NO_AUTO_UPDATE=1
EOF
fi

if [ ! -f "$OPENCLAW_CONFIG_PATH" ]; then
  cat > "$OPENCLAW_CONFIG_PATH" <<'EOF'
{
  "gateway": {
    "mode": "local",
    "port": 18790,
    "bind": "loopback",
    "controlUi": {
      "allowedOrigins": [
        "http://127.0.0.1:18790",
        "http://localhost:18790"
      ]
    },
    "auth": {
      "mode": "token"
    }
  },
  "agents": {
    "defaults": {
      "workspace": ".project-manager/openclaw/workspace"
    }
  },
  "update": {
    "auto": {
      "enabled": false
    },
    "checkOnStart": false
  }
}
EOF
fi

cat > "$WRAPPER" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec "$ROOT_DIR/scripts/openclaw.sh" "\$@"
EOF
chmod +x "$WRAPPER"

(
  cd "$OPENCLAW_SRC"
  pnpm install --frozen-lockfile
  pnpm build
  pnpm ui:build
)

current_ref="$(git -C "$OPENCLAW_SRC" rev-parse HEAD 2>/dev/null || printf unknown)"
current_desc="$(git -C "$OPENCLAW_SRC" describe --tags --always --dirty 2>/dev/null || printf unknown)"
node -e '
const fs = require("fs");
const manifest = {
  pluginId: "openclaw",
  sourcePath: process.argv[1],
  runtimePath: process.argv[2],
  stateDir: process.argv[3],
  workspaceDir: process.argv[4],
  configPath: process.argv[5],
  currentRef: process.argv[6],
  currentDescription: process.argv[7],
  previousRef: null,
  installedAt: new Date().toISOString(),
  enabledByDefault: false
};
fs.mkdirSync(process.argv[2], { recursive: true });
fs.writeFileSync(process.argv[8], JSON.stringify(manifest, null, 2) + "\n");
' "$OPENCLAW_SRC" "$OPENCLAW_RUNTIME" "$OPENCLAW_STATE_DIR" "$OPENCLAW_WORKSPACE_DIR" "$OPENCLAW_CONFIG_PATH" "$current_ref" "$current_desc" "$MANIFEST"

echo "OpenClaw installed in Project Manager scope."
echo "OpenClaw source:    $OPENCLAW_SRC"
echo "OpenClaw state:     $OPENCLAW_STATE_DIR"
echo "OpenClaw workspace: $OPENCLAW_WORKSPACE_DIR"
echo "OpenClaw CLI:       $WRAPPER"
echo ""
echo "Next commands:"
echo "  npm run openclaw -- --version"
echo "  npm run openclaw:doctor"
echo "  npm run openclaw:dashboard"
