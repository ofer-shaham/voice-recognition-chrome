#!/usr/bin/env bash
# manage.sh — Application lifecycle management
#
# Default mode: Docker Compose (orchestrates client + server via docker-compose.yml)
# Use --native to run without Docker (requires node/npm on PATH).
#
# Usage:
#   ./manage.sh [--native] {start|stop|restart|status|build}
#   ./manage.sh [--native] logs [client|server|openrouter|all]
#
# Docker Compose services:
#   client      React dev server  → http://localhost:5000
#   server      OpenRouter proxy  → http://localhost:3001
#   openrouter  Alias for 'server'
#
# Examples:
#   ./manage.sh start                   # docker compose up (build if needed)
#   ./manage.sh stop                    # docker compose down
#   ./manage.sh restart                 # rebuild + restart both services
#   ./manage.sh status                  # show container states
#   ./manage.sh build                   # rebuild images
#   ./manage.sh logs                    # follow all logs
#   ./manage.sh logs server             # follow server / OpenRouter logs
#   ./manage.sh logs client             # follow React client logs
#   ./manage.sh --native start          # start server + client natively
#   ./manage.sh --native logs server    # tail logs/server.log

set -uo pipefail

# ── defaults ──────────────────────────────────────────────────────────────────
USE_NATIVE=false
COMMAND=""
LOG_SERVICE="all"

# ── colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
head_()  { echo -e "${CYAN}── $* ──${NC}"; }

# ── argument parsing ──────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --native) USE_NATIVE=true ;;
    start|stop|restart|status|build) COMMAND="$arg" ;;
    logs) COMMAND="logs" ;;
    client|server|openrouter|all)
      if [[ "$COMMAND" == "logs" ]]; then
        LOG_SERVICE="$arg"
      else
        error "Unknown argument: $arg"
        exit 1
      fi
      ;;
    -h|--help)
      grep '^#' "$0" | head -30 | sed 's/^# \?//'
      exit 0
      ;;
    *)
      error "Unknown argument: $arg"
      echo "Usage: $0 [--native] {start|stop|restart|status|build|logs [service]}" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$COMMAND" ]]; then
  echo "Usage: $0 [--native] {start|stop|restart|status|build|logs [service]}"
  exit 1
fi

# ── Docker Compose helpers ────────────────────────────────────────────────────
compose_cmd() {
  # Prefer 'docker compose' (v2); fall back to 'docker-compose' (v1)
  if docker compose version &>/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose &>/dev/null; then
    docker-compose "$@"
  else
    error "Neither 'docker compose' nor 'docker-compose' found."
    exit 1
  fi
}

docker_check() {
  if ! command -v docker &>/dev/null; then
    error "Docker is not installed or not in PATH."
    exit 1
  fi
  if ! docker info &>/dev/null 2>&1; then
    error "Docker daemon is not running. Start Docker Desktop (or the daemon) and retry."
    exit 1
  fi
}

# Map 'openrouter' alias → 'server'
resolve_service() {
  local svc="$1"
  [[ "$svc" == "openrouter" ]] && echo "server" || echo "$svc"
}

compose_start() {
  docker_check
  info "Building images and starting services…"
  compose_cmd up -d --build
  echo ""
  compose_cmd ps
  echo ""
  info "Client  → http://localhost:5000"
  info "Server  → http://localhost:3001"
  info "Logs    → ./manage.sh logs [client|server]"
}

compose_stop() {
  docker_check
  info "Stopping and removing containers…"
  compose_cmd down
  info "Done."
}

compose_restart() {
  docker_check
  info "Rebuilding and restarting all services…"
  compose_cmd down
  compose_cmd up -d --build
  echo ""
  compose_cmd ps
}

compose_status() {
  docker_check
  head_ "Container status"
  compose_cmd ps
}

compose_build() {
  docker_check
  info "Building images…"
  compose_cmd build
  info "Build complete."
}

compose_logs() {
  docker_check
  local svc
  svc=$(resolve_service "$LOG_SERVICE")

  if [[ "$svc" == "all" ]]; then
    head_ "Following logs for all services (Ctrl-C to stop)"
    compose_cmd logs -f --tail=50
  else
    head_ "Following logs for '$svc' (Ctrl-C to stop)"
    compose_cmd logs -f --tail=50 "$svc"
  fi
}

# ── Native mode helpers ───────────────────────────────────────────────────────
SERVER_PID=".server.pid"
CLIENT_PID=".client.pid"
LOG_DIR="logs"

mkdir -p "$LOG_DIR"

port_is_free() {
  node -e "
    const net = require('net');
    const s = net.createServer();
    s.listen($1, '0.0.0.0', () => { s.close(); process.exit(0); });
    s.on('error', () => process.exit(1));
  " 2>/dev/null
}

native_is_running() {
  local pidfile="$1"
  [[ -f "$pidfile" ]] && kill -0 "$(cat "$pidfile")" 2>/dev/null
}

native_start_service() {
  local name="$1" pidfile="$2" logfile="$3" port="$4"
  shift 4
  local cmd=("$@")

  if native_is_running "$pidfile"; then
    warn "$name already running (PID $(cat "$pidfile"))."
    return 0
  fi

  if ! port_is_free "$port"; then
    error "Port $port is already in use — cannot start $name."
    return 1
  fi

  info "Starting $name on port $port (logs → $logfile)…"
  nohup "${cmd[@]}" >"$logfile" 2>&1 &
  local pid=$!
  echo "$pid" > "$pidfile"

  # Wait up to 10 s for the process to stabilise
  local i=0
  while (( i < 10 )); do
    sleep 1; (( i++ ))
    if ! kill -0 "$pid" 2>/dev/null; then
      error "$name exited. Last lines of $logfile:"
      tail -20 "$logfile" >&2
      rm -f "$pidfile"
      return 1
    fi
    ! port_is_free "$port" && break
  done
  info "$name started (PID $pid)."
}

native_stop_service() {
  local name="$1" pidfile="$2"
  if native_is_running "$pidfile"; then
    local pid; pid=$(cat "$pidfile")
    info "Stopping $name (PID $pid)…"
    kill "$pid" 2>/dev/null || true
    local i=0
    while kill -0 "$pid" 2>/dev/null && (( i < 10 )); do sleep 1; (( i++ )); done
    kill -9 "$pid" 2>/dev/null || true
    rm -f "$pidfile"
    info "$name stopped."
  else
    warn "$name is not running."
    [[ -f "$pidfile" ]] && rm -f "$pidfile"
  fi
}

native_start() {
  # Start server first, then client
  native_start_service \
    "server" "$SERVER_PID" "$LOG_DIR/server.log" 3001 \
    node server/index.js \
  || exit 1

  native_start_service \
    "client" "$CLIENT_PID" "$LOG_DIR/client.log" 5000 \
    npm start \
  || exit 1

  echo ""
  info "Client  → http://localhost:5000"
  info "Server  → http://localhost:3001"
  info "Logs    → ./manage.sh --native logs [client|server]"
}

native_stop() {
  native_stop_service "client" "$CLIENT_PID"
  native_stop_service "server" "$SERVER_PID"
}

native_status() {
  head_ "Native service status"
  for pair in "server:$SERVER_PID:3001" "client:$CLIENT_PID:5000"; do
    local name="${pair%%:*}" rest="${pair#*:}"
    local pidfile="${rest%%:*}" port="${rest##*:}"
    if native_is_running "$pidfile"; then
      info "$name  Running (PID $(cat "$pidfile")) → http://localhost:$port"
    else
      warn "$name  Stopped"
      [[ -f "$pidfile" ]] && rm -f "$pidfile"
    fi
  done
}

native_logs() {
  local svc
  svc=$(resolve_service "$LOG_SERVICE")

  case "$svc" in
    server)
      head_ "Server / OpenRouter logs (Ctrl-C to stop)"
      tail -f "$LOG_DIR/server.log" 2>/dev/null || { error "$LOG_DIR/server.log not found. Is the server running?"; exit 1; }
      ;;
    client)
      head_ "Client logs (Ctrl-C to stop)"
      tail -f "$LOG_DIR/client.log" 2>/dev/null || { error "$LOG_DIR/client.log not found. Is the client running?"; exit 1; }
      ;;
    all)
      head_ "All logs — server | client (Ctrl-C to stop)"
      tail -f "$LOG_DIR/server.log" "$LOG_DIR/client.log" 2>/dev/null \
        || { error "Log files not found in $LOG_DIR/. Are services running?"; exit 1; }
      ;;
  esac
}

# ── dispatch ──────────────────────────────────────────────────────────────────
if $USE_NATIVE; then
  case "$COMMAND" in
    start)   native_start ;;
    stop)    native_stop ;;
    restart) native_stop; native_start ;;
    status)  native_status || true ;;
    build)   warn "'build' is only relevant in Docker mode." ;;
    logs)    native_logs ;;
  esac
else
  case "$COMMAND" in
    start)   compose_start ;;
    stop)    compose_stop ;;
    restart) compose_restart ;;
    status)  compose_status || true ;;
    build)   compose_build ;;
    logs)    compose_logs ;;
  esac
fi
