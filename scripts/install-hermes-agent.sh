#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HERMES_SRC="$ROOT_DIR/.project-manager/vendor/hermes-agent"
HERMES_HOME_DIR="${PM_HERMES_HOME:-$ROOT_DIR/.project-manager/hermes}"
HERMES_VENV="${PM_HERMES_VENV:-$HERMES_SRC/venv}"
BIN_DIR="$ROOT_DIR/.project-manager/bin"
WRAPPER="$BIN_DIR/hermes"

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

export UV_NO_CONFIG=1
export HERMES_HOME="$HERMES_HOME_DIR"

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

echo "Hermes Agent installed in Project Manager scope."
echo "Hermes source: $HERMES_SRC"
echo "Hermes home:   $HERMES_HOME_DIR"
echo "Hermes CLI:    $WRAPPER"
echo ""
echo "Next commands:"
echo "  npm run hermes:doctor"
echo "  npm run hermes:dashboard"
