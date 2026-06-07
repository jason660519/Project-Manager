#!/usr/bin/env bash
set -euo pipefail

tauri-pilot ping
tauri-pilot windows
tauri-pilot snapshot -i

