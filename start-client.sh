#!/usr/bin/env bash
set -euo pipefail

# Resolve node from Replit's runtime-path helper, falling back to PATH.
_HELPER="/nix/store/h8lc486l7m2j4qxrgc0cf3ild1n9xjlr-replit-runtime-path/bin/available-pid2-node-paths"
if [[ -x "$_HELPER" ]]; then
  NODE="$(bash "$_HELPER" 2>/dev/null | head -1)"
fi
NODE="${NODE:-$(command -v node 2>/dev/null || echo "node")}"
NODE_BIN_DIR="$(dirname "$NODE")"
export PATH="${NODE_BIN_DIR}:${PATH}"

exec env DANGEROUSLY_DISABLE_HOST_CHECK=true \
  "$NODE_BIN_DIR/node" node_modules/.bin/vite --port 5000 --host 0.0.0.0
