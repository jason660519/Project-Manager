#!/usr/bin/env bash
# Quick PATH check for Integrations Hub discovery probes.
set -euo pipefail

check() {
  local name="$1"
  shift
  if command -v "$1" >/dev/null 2>&1; then
    echo "OK   $name ($1)"
  else
    echo "MISS $name ($1) — required for some discovery probes"
  fi
}

check "ARP" arp
check "Bonjour (macOS)" dns-sd
check "Docker" docker
check "nmap (active LAN)" nmap
