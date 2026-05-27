#!/usr/bin/env bash
# Install nmap for Integrations Hub network discovery (active intranet scans).
# nmap is a system CLI — it cannot be bundled as an npm dependency.
set -euo pipefail

if command -v nmap >/dev/null 2>&1; then
  echo "nmap already installed: $(nmap --version 2>/dev/null | head -1)"
  exit 0
fi

OS="$(uname -s)"
case "$OS" in
  Darwin)
    if ! command -v brew >/dev/null 2>&1; then
      echo "Homebrew is required on macOS. Install from https://brew.sh then run:" >&2
      echo "  npm run discovery:install-nmap" >&2
      exit 1
    fi
    echo "Installing nmap via Homebrew…"
    brew install nmap
    ;;
  Linux)
    if command -v apt-get >/dev/null 2>&1; then
      echo "Installing nmap via apt-get (may prompt for sudo)…"
      sudo apt-get update -qq
      sudo apt-get install -y nmap
    elif command -v dnf >/dev/null 2>&1; then
      echo "Installing nmap via dnf (may prompt for sudo)…"
      sudo dnf install -y nmap
    else
      echo "Install nmap with your distribution package manager, then verify with: nmap --version" >&2
      exit 1
    fi
    ;;
  MINGW*|MSYS*|CYGWIN*)
    echo "On Windows, install nmap from https://nmap.org/download.html or:" >&2
    echo "  winget install Insecure.Nmap" >&2
    exit 1
    ;;
  *)
    echo "Unsupported OS for automatic install. See https://nmap.org/download.html" >&2
    exit 1
    ;;
esac

if ! command -v nmap >/dev/null 2>&1; then
  echo "nmap install finished but binary not found on PATH." >&2
  exit 1
fi

echo "nmap ready: $(nmap --version 2>/dev/null | head -1)"
