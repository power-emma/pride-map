#!/usr/bin/env bash
set -euo pipefail

# run-servers.sh
# Starts the Node server and the React (Vite) dev server in the background,
# writes logs and pids to ./logs, and reports which ports they are listening on
# and whether they launched successfully.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"

SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/client/pridemap"

# Allow overriding server port via environment
SERVER_PORT="${SERVER_PORT:-3001}"

# Allow running only the install step for testing: ./run-servers.sh --install-only
INSTALL_ONLY=false
if [[ "${1:-}" == "--install-only" ]]; then
  INSTALL_ONLY=true
fi

run_npm_install_if_needed() {
  local dir="$1"
  local label="$2"
  local install_log="$LOG_DIR/${label}-install.log"

  if [[ ! -d "$dir/node_modules" ]]; then
    if ! command -v npm >/dev/null 2>&1; then
      echo "npm is not installed or not on PATH; cannot install dependencies for $label"
      return 1
    fi
    echo "Installing npm dependencies for $label (this may take a minute)..."
    (cd "$dir" && npm install --silent) > "$install_log" 2>&1 || {
      echo "npm install failed for $label — see $install_log"
      return 1
    }
    echo "Installed $label dependencies; log: $install_log"
  else
    echo "Dependencies for $label appear present (node_modules exists)."
  fi
}

echo "Checking and installing dependencies if needed..."
run_npm_install_if_needed "$SERVER_DIR" server || true
run_npm_install_if_needed "$CLIENT_DIR" client || true

if [[ "$INSTALL_ONLY" == true ]]; then
  echo "--install-only flag provided; exiting after installs."
  exit 0
fi

start_node_server() {
  echo "Starting Node server (port $SERVER_PORT)..."
  ( cd "$SERVER_DIR" && PORT="$SERVER_PORT" node server.js ) > "$LOG_DIR/server.log" 2>&1 &
  SERVER_PID=$!
  echo "$SERVER_PID" > "$LOG_DIR/server.pid"
}

start_client_server() {
  echo "Starting React (Vite) dev server..."
  # Use --silent so npm itself prints less; Vite output will still appear in the log
  ( cd "$CLIENT_DIR" && npm run dev --silent ) > "$LOG_DIR/client.log" 2>&1 &
  CLIENT_PID=$!
  echo "$CLIENT_PID" > "$LOG_DIR/client.pid"
}

start_servers() {
  start_node_server
  start_client_server
  echo "Launched processes: server PID=$SERVER_PID, client PID=$CLIENT_PID"
  echo "Waiting a few seconds for servers to bind ports..."
  sleep 4
}

stop_server_process() {
  local pidfile="$1"
  if [[ -f "$pidfile" ]]; then
    local pid
    pid=$(cat "$pidfile" 2>/dev/null || true)
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "Stopping PID $pid..."
      kill "$pid" || true
      sleep 1
      if kill -0 "$pid" 2>/dev/null; then
        echo "PID $pid did not exit; killing..."
        kill -9 "$pid" || true
      fi
    fi
    rm -f "$pidfile" || true
  fi
}

stop_servers() {
  stop_server_process "$LOG_DIR/server.pid"
  stop_server_process "$LOG_DIR/client.pid"
}

start_servers

get_port_for_pid() {
  local pid="$1"
  local logfile="$2"

  # Try ss first
  if command -v ss >/dev/null 2>&1; then
    local line
    line=$(ss -ltnp 2>/dev/null | grep -E "pid=$pid(,|)" | head -n1 || true)
    if [[ -n "$line" ]]; then
      local addr
      addr=$(awk '{print $4}' <<<"$line")
      # extract port (handles IPv4 and IPv6 addresses)
      local port
      port=$(sed -E 's/.*:([0-9]+)$/\1/' <<<"$addr")
      if [[ -n "$port" ]]; then
        echo "$port"
        return 0
      fi
    fi
  fi

  # Fallback to lsof if available
  if command -v lsof >/dev/null 2>&1; then
    local p
    p=$(lsof -Pan -p "$pid" -iTCP -sTCP:LISTEN -n -P 2>/dev/null | awk 'NR>1{print $9}' | sed -E 's/.*:([0-9]+)$/\1/' | head -n1 || true)
    if [[ -n "$p" ]]; then
      echo "$p"
      return 0
    fi
  fi

  # Last-ditch: try parsing logfile for common patterns (vite/node output)
  if [[ -f "$logfile" ]]; then
    local p
    p=$(grep -Eo 'http://[^ ]+:[0-9]+' "$logfile" | sed -E 's/.*:([0-9]+)$/\1/' | head -n1 || true)
    if [[ -n "$p" ]]; then
      echo "$p"
      return 0
    fi
    p=$(grep -Eo ':[0-9]{2,5}' "$logfile" | sed 's/://g' | head -n1 || true)
    if [[ -n "$p" ]]; then
      echo "$p"
      return 0
    fi
  fi

  return 1
}

server_port_found="$(get_port_for_pid "$SERVER_PID" "$LOG_DIR/server.log" || true)"
client_port_found="$(get_port_for_pid "$CLIENT_PID" "$LOG_DIR/client.log" || true)"

is_running() { ps -p "$1" >/dev/null 2>&1; }

if is_running "$SERVER_PID"; then
  server_status="running"
else
  server_status="not running"
fi

if is_running "$CLIENT_PID"; then
  client_status="running"
else
  client_status="not running"
fi

echo
echo "Node server (PID $SERVER_PID): $server_status${server_port_found:+, port $server_port_found}"
echo "React dev server (PID $CLIENT_PID): $client_status${client_port_found:+, port $client_port_found}"

if [[ "$server_status" != "running" ]]; then
  echo
  echo "---- server log (last 50 lines) ----"
  tail -n 50 "$LOG_DIR/server.log" || true
fi

if [[ "$client_status" != "running" ]]; then
  echo
  echo "---- client log (last 50 lines) ----"
  tail -n 50 "$LOG_DIR/client.log" || true
fi

echo
echo "Logs: $LOG_DIR"
echo "To stop the servers: kill $SERVER_PID $CLIENT_PID || true"
 
# Interactive control loop
echo
echo "Control options:"
echo "  r  -> restart both servers"
echo "  s  -> status"
echo "  l  -> show last 50 lines of logs"
echo "  q  -> quit script but leave servers running"
echo "  k  -> quit script and stop servers"
echo "  h  -> help (show this)"

while true; do
  printf "\ncommand (h for help): "
  if ! read -r cmd; then
    # EOF (e.g. Ctrl-D) — exit while leaving servers running
    echo
    echo "EOF received; leaving servers running and exiting."
    exit 0
  fi
  case "$cmd" in
    r)
      echo "Restarting both servers..."
      stop_servers
      # ensure any lingering processes are gone
      sleep 1
      # make sure dependencies still exist
      run_npm_install_if_needed "$SERVER_DIR" server || true
      run_npm_install_if_needed "$CLIENT_DIR" client || true
      start_servers
      ;;
    s)
      # refresh status
      if [[ -f "$LOG_DIR/server.pid" ]]; then
        SERVER_PID=$(cat "$LOG_DIR/server.pid" 2>/dev/null || true)
      fi
      if [[ -f "$LOG_DIR/client.pid" ]]; then
        CLIENT_PID=$(cat "$LOG_DIR/client.pid" 2>/dev/null || true)
      fi
      if is_running "$SERVER_PID"; then
        server_status="running"
      else
        server_status="not running"
      fi
      if is_running "$CLIENT_PID"; then
        client_status="running"
      else
        client_status="not running"
      fi
      server_port_found="$(get_port_for_pid "$SERVER_PID" "$LOG_DIR/server.log" || true)"
      client_port_found="$(get_port_for_pid "$CLIENT_PID" "$LOG_DIR/client.log" || true)"
      echo "Node server (PID $SERVER_PID): $server_status${server_port_found:+, port $server_port_found}"
      echo "React dev server (PID $CLIENT_PID): $client_status${client_port_found:+, port $client_port_found}"
      ;;
    l)
      echo "---- server log (last 200 lines) ----"
      tail -n 200 "$LOG_DIR/server.log" || true
      echo
      echo "---- client log (last 200 lines) ----"
      tail -n 200 "$LOG_DIR/client.log" || true
      ;;
    q)
      echo "Exiting script and leaving servers running. PIDs: $(cat "$LOG_DIR/server.pid" 2>/dev/null || echo 'n/a'), $(cat "$LOG_DIR/client.pid" 2>/dev/null || echo 'n/a')"
      exit 0
      ;;
    k)
      echo "Stopping servers and exiting..."
      stop_servers
      echo "Servers stopped. Exiting."
      exit 0
      ;;
    h|help)
      echo "Commands: r restart, s status, l logs, q quit(leave running), k quit+kill, h help"
      ;;
    "")
      ;;
    *)
      echo "Unknown command: $cmd (h for help)"
      ;;
  esac
done
