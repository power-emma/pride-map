#!/usr/bin/env bash
set -euo pipefail

# run-spoof.sh
# Starts BOTH the Node API server (in spoof/test mode) and the Vite client dev
# server. In spoof mode /pins/all returns a large batch of randomly generated
# pins on land worldwide instead of the real database rows, to stress the server
# and client through the normal fetch/cluster/render path.
#
# The Vite dev server proxies /api/* to the Node server on port 3001
# (see client/pridemap/vite.config.ts), so open the URL Vite prints and the map
# will fetch the spoofed pins automatically.
#
# Usage:
#   ./run-spoof.sh            # defaults to 100000 pins
#   ./run-spoof.sh 100000     # spoof 100k pins
#   ./run-spoof.sh 500        # spoof 500 pins
#
# Press Ctrl-C to stop both servers.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/client/pridemap"

COUNT="${1:-100000}"

if ! [[ "$COUNT" =~ ^[0-9]+$ ]] || [[ "$COUNT" -le 0 ]]; then
  echo "Error: pin count must be a positive integer (got '$COUNT')" >&2
  echo "Usage: $0 [count]   e.g. $0 100000" >&2
  exit 1
fi

# The Vite dev proxy targets localhost:3001, so the API must run there.
SERVER_PORT=3001

# Install dependencies if missing so a fresh checkout works.
if [[ ! -d "$SERVER_DIR/node_modules" ]]; then
  echo "Installing server dependencies..."
  (cd "$SERVER_DIR" && npm install)
fi
if [[ ! -d "$CLIENT_DIR/node_modules" ]]; then
  echo "Installing client dependencies..."
  (cd "$CLIENT_DIR" && npm install)
fi

SERVER_PID=""
CLIENT_PID=""

cleanup() {
  echo
  echo "Stopping servers..."
  [[ -n "$CLIENT_PID" ]] && kill "$CLIENT_PID" 2>/dev/null || true
  [[ -n "$SERVER_PID" ]] && kill "$SERVER_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting Node API in SPOOF mode: $COUNT pins on port $SERVER_PORT"
( cd "$SERVER_DIR" && PORT="$SERVER_PORT" PIN_SPOOF_COUNT="$COUNT" node server.js ) &
SERVER_PID=$!

echo "Starting Vite client dev server..."
( cd "$CLIENT_DIR" && npm run dev ) &
CLIENT_PID=$!

echo
echo "Both servers running:"
echo "  API    → http://localhost:${SERVER_PORT}/pins/all   ($COUNT spoofed pins)"
echo "  Client → see the Vite URL printed above (usually http://localhost:5173/)"
echo "Press Ctrl-C to stop both."

# Wait for either process to exit; cleanup trap stops the other.
wait -n "$SERVER_PID" "$CLIENT_PID"
