#!/usr/bin/env bash
# watchdog.sh
# Monitors the Node server process and restarts it if it dies.
# Does NOT make HTTP requests — checks the process directly so it works
# even when the server is mid-crash and cannot serve responses.
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
  log "server started/restarted, new PID=$new_pid"
}

# Returns 0 (true) if the server process appears to be alive.
# Checks the PID file first; falls back to checking if anything is bound
# to SERVER_PORT. No HTTP request is made — this is intentionally
# independent of the server's ability to respond.
server_is_alive() {
  # Primary: recorded PID still exists
  if [[ -f "$LOG_DIR/server.pid" ]]; then
    local pid
    pid=$(cat "$LOG_DIR/server.pid" 2>/dev/null || true)
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi

  # Secondary: something is bound to our port (handles the case where
  # the server was started outside of this script without a PID file)
  if command -v ss >/dev/null 2>&1; then
    ss -tlnp 2>/dev/null | grep -q ":${SERVER_PORT}\b" && return 0
  elif command -v fuser >/dev/null 2>&1; then
    fuser "${SERVER_PORT}/tcp" >/dev/null 2>&1 && return 0
  elif command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"${SERVER_PORT}" -sTCP:LISTEN >/dev/null 2>&1 && return 0
  fi

  return 1
}

log "started — checking server process every ${WATCHDOG_INTERVAL}s (port ${SERVER_PORT})"

while true; do
  sleep "$WATCHDOG_INTERVAL"

  if ! server_is_alive; then
    log "server process is gone, restarting..."

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

    # Clean up any stale PID
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
