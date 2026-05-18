#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HERMES_SRC="$ROOT_DIR/.project-manager/vendor/hermes-agent"
HERMES_REPO_URL="${PM_HERMES_REPO_URL:-https://github.com/NousResearch/hermes-agent.git}"
HERMES_REF="${PM_HERMES_REF:-}"
HERMES_AUTO_UPDATE="${PM_HERMES_AUTO_UPDATE:-0}"
HERMES_HOME_DIR="${PM_HERMES_HOME:-$ROOT_DIR/.project-manager/hermes}"
HERMES_VENV="${PM_HERMES_VENV:-$HERMES_SRC/venv}"
BIN_DIR="$ROOT_DIR/.project-manager/bin"
WRAPPER="$BIN_DIR/hermes"
MANIFEST="$HERMES_HOME_DIR/manifest.json"

ensure_hermes_source() {
  if [ -f "$HERMES_SRC/pyproject.toml" ]; then
    return
  fi

  if [ -e "$HERMES_SRC" ] && [ "$(find "$HERMES_SRC" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l | tr -d ' ')" != "0" ]; then
    echo "Hermes Agent source path exists but is not a valid checkout: $HERMES_SRC" >&2
    exit 1
  fi

  if ! command -v git >/dev/null 2>&1; then
    echo "git is required to clone Hermes Agent source." >&2
    exit 1
  fi

  mkdir -p "$(dirname "$HERMES_SRC")"
  git clone "$HERMES_REPO_URL" "$HERMES_SRC"
}

ensure_hermes_source

if [ ! -f "$HERMES_SRC/pyproject.toml" ]; then
  echo "Hermes Agent source not found at: $HERMES_SRC" >&2
  exit 1
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required. Install uv first, then rerun npm run hermes:install." >&2
  exit 1
fi

mkdir -p "$HERMES_HOME_DIR"/{home,logs,memories,sessions,skills,skins,plans,workspace,cron}
mkdir -p "$BIN_DIR"
chmod 700 "$HERMES_HOME_DIR"

export UV_NO_CONFIG=1
export HERMES_HOME="$HERMES_HOME_DIR"

if [ -n "$HERMES_REF" ]; then
  git -C "$HERMES_SRC" fetch --tags origin
  git -C "$HERMES_SRC" checkout "$HERMES_REF"
elif [ "$HERMES_AUTO_UPDATE" = "1" ]; then
  git -C "$HERMES_SRC" fetch --tags origin
  git -C "$HERMES_SRC" checkout origin/main
fi

if [ ! -d "$HERMES_VENV" ]; then
  uv venv "$HERMES_VENV" --python 3.11
fi

(
  cd "$HERMES_SRC"
  if [ -f uv.lock ]; then
    UV_PROJECT_ENVIRONMENT="$HERMES_VENV" uv sync --extra all --locked \
      || uv pip install --python "$HERMES_VENV/bin/python" -e ".[all]"
  else
    uv pip install --python "$HERMES_VENV/bin/python" -e ".[all]"
  fi
)

cat > "$WRAPPER" <<EOF
#!/usr/bin/env bash
set -euo pipefail
export HERMES_HOME="${HERMES_HOME_DIR}"
export HERMES_OPTIONAL_SKILLS="${HERMES_SRC}/optional-skills"
exec "${HERMES_VENV}/bin/hermes" "\$@"
EOF
chmod +x "$WRAPPER"

if [ ! -f "$HERMES_HOME_DIR/.env" ] && [ -f "$HERMES_SRC/.env.example" ]; then
  cp "$HERMES_SRC/.env.example" "$HERMES_HOME_DIR/.env"
fi
if [ -f "$HERMES_HOME_DIR/.env" ]; then
  chmod 600 "$HERMES_HOME_DIR/.env"
fi

current_ref="$(git -C "$HERMES_SRC" rev-parse HEAD 2>/dev/null || printf unknown)"
current_desc="$(git -C "$HERMES_SRC" describe --tags --always --dirty 2>/dev/null || printf unknown)"
node -e '
const fs = require("fs");
const manifest = {
  pluginId: "hermes-agent",
  sourcePath: process.argv[1],
  runtimePath: process.argv[2],
  venvPath: process.argv[3],
  currentRef: process.argv[4],
  currentDescription: process.argv[5],
  previousRef: null,
  installedAt: new Date().toISOString(),
  enabledByDefault: false
};
fs.writeFileSync(process.argv[6], JSON.stringify(manifest, null, 2) + "\n");
' "$HERMES_SRC" "$HERMES_HOME_DIR" "$HERMES_VENV" "$current_ref" "$current_desc" "$MANIFEST"
chmod 600 "$MANIFEST"

echo "Hermes Agent installed in Project Manager scope."
echo "Hermes source: $HERMES_SRC"
echo "Hermes home:   $HERMES_HOME_DIR"
echo "Hermes CLI:    $WRAPPER"
echo ""
echo "Next commands:"
echo "  npm run hermes:doctor"
echo "  npm run hermes:dashboard"
