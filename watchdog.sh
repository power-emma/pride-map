#!/usr/bin/env bash
# watchdog.sh
# Polls the Node API and restarts it if unresponsive.
#
# Usage (normally called by run-servers.sh, not directly):
#   ./watchdog.sh <server_port> <server_dir> <log_dir> <watchdog_interval>
#
# All four arguments are required.

set -euo pipefail

SERVER_PORT="${1:?watchdog.sh: missing arg 1 (server_port)}"
SERVER_DIR="${2:?watchdog.sh: missing arg 2 (server_dir)}"
LOG_DIR="${3:?watchdog.sh: missing arg 3 (log_dir)}"
WATCHDOG_INTERVAL="${4:-60}"

WATCHDOG_LOG="$LOG_DIR/watchdog.log"
RESTART_LOG="$LOG_DIR/restarts.log"

log() { echo "[watchdog] $(date) — $*" >> "$WATCHDOG_LOG"; }

start_node_server() {
  ( cd "$SERVER_DIR" && PORT="$SERVER_PORT" node server.js ) >> "$LOG_DIR/server.log" 2>&1 &
  local new_pid=$!
  echo "$new_pid" > "$LOG_DIR/server.pid"
  log "server restarted, new PID=$new_pid"
}

log "started — checking http://127.0.0.1:${SERVER_PORT}/ every ${WATCHDOG_INTERVAL}s"

while true; do
  sleep "$WATCHDOG_INTERVAL"

  response=$(curl -s --connect-timeout 5 --max-time 10 \
    "http://127.0.0.1:${SERVER_PORT}/" 2>/dev/null || true)

  if [[ -z "$response" ]]; then
    log "no response from server, restarting..."

    # Snapshot the server log at the moment of failure for post-mortem debugging
    {
      echo "================================================================"
      echo "RESTART at $(date)"
      echo "----------------------------------------------------------------"
      echo "Last 50 lines of server.log before restart:"
      echo "----------------------------------------------------------------"
      tail -n 50 "$LOG_DIR/server.log" 2>/dev/null || echo "(server.log not found)"
      echo "================================================================"
      echo
    } >> "$RESTART_LOG"

    log "server log snapshot written to $RESTART_LOG"

    # Kill the stale process if it still exists
    if [[ -f "$LOG_DIR/server.pid" ]]; then
      old_pid=$(cat "$LOG_DIR/server.pid" 2>/dev/null || true)
      if [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null; then
        kill "$old_pid" 2>/dev/null || true
        sleep 2
        kill -0 "$old_pid" 2>/dev/null && kill -9 "$old_pid" 2>/dev/null || true
      fi
    fi

    start_node_server
  else
    log "OK"
  fi
done
