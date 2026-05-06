#!/usr/bin/env bash
# manage.sh — Application lifecycle management
#
# Usage:
#   ./manage.sh [--docker] {start|stop|restart|status}
#
# Options:
#   --docker   Run via Docker instead of npm start (builds image if needed)
#
# Examples:
#   ./manage.sh start               # start natively with npm
#   ./manage.sh --docker start      # build image & run in Docker
#   ./manage.sh status              # check native process + port
#   ./manage.sh --docker restart    # rebuild & restart container

set -uo pipefail

APP_NAME="speech-translation-app"
PID_FILE=".app.pid"
LOG_FILE="app.log"
PORT=5000
DOCKER_IMAGE="$APP_NAME"
DOCKER_CONTAINER="$APP_NAME"

USE_DOCKER=false
COMMAND=""

# ── Argument parsing ──────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --docker) USE_DOCKER=true ;;
    start|stop|restart|status) COMMAND="$arg" ;;
    -h|--help)
      grep '^#' "$0" | head -20 | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--docker] {start|stop|restart|status}" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$COMMAND" ]]; then
  echo "Usage: $0 [--docker] {start|stop|restart|status}"
  exit 1
fi

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ── Port helpers ──────────────────────────────────────────────────────────────
# Uses `node` (always available) to test binding and /proc/net/tcp for owner.

port_is_free() {
  node -e "
    const net = require('net');
    const s = net.createServer();
    s.listen(${PORT}, '0.0.0.0', () => { s.close(); process.exit(0); });
    s.on('error', () => process.exit(1));
  " 2>/dev/null
}

describe_port() {
  # Resolve port → inode via /proc/net/tcp, then inode → PID via /proc/*/fd
  local hex_port
  printf -v hex_port '%04X' "${PORT}"

  local inode
  inode=$(awk -v p=":${hex_port}" \
    'NR>1 && $2~p && $4=="0A" {print $10; exit}' \
    /proc/net/tcp /proc/net/tcp6 2>/dev/null || true)

  if [[ -z "$inode" ]]; then
    echo "unknown process (port ${PORT})"
    return
  fi

  local pid=""
  for dir in /proc/[0-9]*/fd; do
    if ls -la "$dir" 2>/dev/null | grep -q "socket:\[${inode}\]"; then
      pid=$(echo "$dir" | cut -d/ -f3)
      break
    fi
  done

  if [[ -n "$pid" ]]; then
    local cmd
    cmd=$(cat "/proc/${pid}/comm" 2>/dev/null || echo "unknown")
    echo "PID ${pid} (${cmd})"
  else
    echo "unknown process (socket inode ${inode})"
  fi
}

# ── Native (npm) helpers ──────────────────────────────────────────────────────
native_is_running() {
  [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

native_status() {
  if native_is_running; then
    local pid
    pid=$(cat "$PID_FILE")
    info "Running (PID ${pid}) → http://localhost:${PORT}"
    return 0
  fi

  # Clean up stale PID file
  if [[ -f "$PID_FILE" ]]; then
    warn "Stale PID file removed (process is gone)."
    rm -f "$PID_FILE"
  fi

  # Check whether something else is holding the port
  if ! port_is_free; then
    warn "This app is NOT running, but port ${PORT} is in use by: $(describe_port)"
    warn "Stop that process first if you want to start this app here."
    return 1
  fi

  info "Stopped."
  return 1
}

native_start() {
  if native_is_running; then
    warn "Already running (PID $(cat "$PID_FILE")). Use 'restart' to reload."
    return 0
  fi

  # Fail fast if port is taken by something else
  if ! port_is_free; then
    error "Port ${PORT} is already in use by: $(describe_port)"
    error "Stop that process first (or run this app on a different port)."
    error "If the Replit workflow is running, stop it before using manage.sh."
    exit 1
  fi

  info "Starting app on port ${PORT} (logs → ${LOG_FILE})…"
  nohup npm start >"$LOG_FILE" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_FILE"

  # Wait up to 15 s for the process to either stay alive or die
  local i=0
  while (( i < 15 )); do
    sleep 1; (( i++ ))
    if ! kill -0 "$pid" 2>/dev/null; then
      error "Process exited after ${i}s. Last lines of ${LOG_FILE}:"
      tail -20 "$LOG_FILE" >&2
      rm -f "$PID_FILE"
      exit 1
    fi
    # Stop waiting early once the port is actually bound
    if ! port_is_free; then
      break
    fi
  done

  if native_is_running; then
    info "Started (PID $(cat "$PID_FILE")) → http://localhost:${PORT}"
  else
    error "Process died. Last lines of ${LOG_FILE}:"
    tail -20 "$LOG_FILE" >&2
    rm -f "$PID_FILE"
    exit 1
  fi
}

native_stop() {
  if native_is_running; then
    local pid
    pid=$(cat "$PID_FILE")
    info "Stopping PID ${pid}…"
    kill "$pid" 2>/dev/null || true
    local i=0
    while kill -0 "$pid" 2>/dev/null && (( i < 10 )); do
      sleep 1; (( i++ ))
    done
    kill -9 "$pid" 2>/dev/null || true
    rm -f "$PID_FILE"
    info "Stopped."
  else
    warn "Not running (nothing to stop)."
    [[ -f "$PID_FILE" ]] && rm -f "$PID_FILE"
  fi
}

# ── Docker helpers ────────────────────────────────────────────────────────────
docker_check() {
  if ! command -v docker &>/dev/null; then
    error "Docker is not installed or not in PATH."
    exit 1
  fi
  if ! docker info &>/dev/null; then
    error "Docker daemon is not running. Start Docker Desktop (or the daemon) and retry."
    exit 1
  fi
}

docker_is_running() {
  docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${DOCKER_CONTAINER}$"
}

docker_exists() {
  docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^${DOCKER_CONTAINER}$"
}

docker_status() {
  docker_check
  if docker_is_running; then
    info "Container '${DOCKER_CONTAINER}' is running → http://localhost:${PORT}"
    docker ps --filter "name=^/${DOCKER_CONTAINER}$" \
              --format "  Image: {{.Image}}  Uptime: {{.Status}}"
    return 0
  elif docker_exists; then
    warn "Container '${DOCKER_CONTAINER}' exists but is stopped. Run: $0 --docker start"
    return 1
  else
    info "Container '${DOCKER_CONTAINER}' does not exist. Run: $0 --docker start"
    return 1
  fi
}

docker_build() {
  info "Building Docker image '${DOCKER_IMAGE}'…"
  docker build -t "$DOCKER_IMAGE" .
  info "Image built successfully."
}

docker_start() {
  docker_check
  if docker_is_running; then
    warn "Container already running. Use 'restart' to rebuild and reload."
    return 0
  fi
  docker_exists && docker rm "$DOCKER_CONTAINER" 2>/dev/null || true
  docker_build

  local env_flags=""
  [[ -f ".env" ]] && env_flags="--env-file .env"

  info "Starting container '${DOCKER_CONTAINER}' on port ${PORT}…"
  # shellcheck disable=SC2086
  docker run -d \
    --name "$DOCKER_CONTAINER" \
    -p "${PORT}:${PORT}" \
    $env_flags \
    "$DOCKER_IMAGE"

  info "Container started → http://localhost:${PORT}"
  info "Follow logs with: docker logs -f ${DOCKER_CONTAINER}"
}

docker_stop() {
  docker_check
  if docker_is_running; then
    info "Stopping container '${DOCKER_CONTAINER}'…"
    docker stop "$DOCKER_CONTAINER"
    docker rm   "$DOCKER_CONTAINER"
    info "Stopped and removed."
  elif docker_exists; then
    info "Container was already stopped; removing…"
    docker rm "$DOCKER_CONTAINER"
  else
    warn "No container named '${DOCKER_CONTAINER}' found."
  fi
}

# ── Dispatch ──────────────────────────────────────────────────────────────────
if $USE_DOCKER; then
  case "$COMMAND" in
    start)   docker_start ;;
    stop)    docker_stop ;;
    restart) docker_stop; docker_start ;;
    status)  docker_status || true ;;
  esac
else
  case "$COMMAND" in
    start)   native_start ;;
    stop)    native_stop ;;
    restart) native_stop; native_start ;;
    status)  native_status || true ;;
  esac
fi
