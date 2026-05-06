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
#   ./manage.sh status              # check native process
#   ./manage.sh --docker restart    # rebuild & restart container

set -euo pipefail

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
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ── Native (npm) helpers ──────────────────────────────────────────────────────
native_is_running() {
  [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

native_status() {
  if native_is_running; then
    info "Running (PID $(cat "$PID_FILE")) → http://localhost:${PORT}"
    return 0
  elif [[ -f "$PID_FILE" ]]; then
    warn "Stopped — stale PID file found, cleaning up."
    rm -f "$PID_FILE"
    return 1
  else
    info "Stopped."
    return 1
  fi
}

native_start() {
  if native_is_running; then
    warn "Already running (PID $(cat "$PID_FILE")). Use 'restart' to reload."
    return 0
  fi
  info "Starting app on port ${PORT} (logs → ${LOG_FILE})…"
  nohup npm start >"$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  sleep 1
  if native_is_running; then
    info "Started (PID $(cat "$PID_FILE"))."
  else
    error "Process exited immediately. Check ${LOG_FILE} for details."
    rm -f "$PID_FILE"
    exit 1
  fi
}

native_stop() {
  if native_is_running; then
    local pid
    pid=$(cat "$PID_FILE")
    info "Stopping PID ${pid}…"
    kill "$pid"
    # Wait up to 10s for graceful shutdown
    local i=0
    while kill -0 "$pid" 2>/dev/null && (( i < 10 )); do
      sleep 1; (( i++ ))
    done
    kill -9 "$pid" 2>/dev/null || true
    rm -f "$PID_FILE"
    info "Stopped."
  else
    warn "Not running."
  fi
}

# ── Docker helpers ────────────────────────────────────────────────────────────
docker_check() {
  if ! command -v docker &>/dev/null; then
    error "Docker is not installed or not in PATH."
    exit 1
  fi
  if ! docker info &>/dev/null; then
    error "Docker daemon is not running."
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
    docker ps --filter "name=^${DOCKER_CONTAINER}$" --format "  Image: {{.Image}}  Status: {{.Status}}"
    return 0
  elif docker_exists; then
    warn "Container '${DOCKER_CONTAINER}' exists but is stopped."
    return 1
  else
    info "Container '${DOCKER_CONTAINER}' does not exist."
    return 2
  fi
}

docker_build() {
  info "Building Docker image '${DOCKER_IMAGE}'…"
  docker build -t "$DOCKER_IMAGE" .
  info "Image built."
}

docker_start() {
  docker_check
  if docker_is_running; then
    warn "Container already running. Use 'restart' to rebuild."
    return 0
  fi
  # Remove any stopped container with the same name
  docker_exists && docker rm "$DOCKER_CONTAINER" 2>/dev/null || true
  docker_build

  # Pass env vars: prefer .env file, fall back to current environment
  local env_flags=""
  if [[ -f ".env" ]]; then
    env_flags="--env-file .env"
  fi

  info "Starting container '${DOCKER_CONTAINER}' on port ${PORT}…"
  # shellcheck disable=SC2086
  docker run -d \
    --name "$DOCKER_CONTAINER" \
    -p "${PORT}:${PORT}" \
    $env_flags \
    "$DOCKER_IMAGE"

  info "Container started → http://localhost:${PORT}"
  info "Logs: docker logs -f ${DOCKER_CONTAINER}"
}

docker_stop() {
  docker_check
  if docker_is_running; then
    info "Stopping container '${DOCKER_CONTAINER}'…"
    docker stop "$DOCKER_CONTAINER"
    docker rm  "$DOCKER_CONTAINER"
    info "Stopped and removed."
  elif docker_exists; then
    info "Container was stopped; removing…"
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
    status)  docker_status ;;
  esac
else
  case "$COMMAND" in
    start)   native_start ;;
    stop)    native_stop ;;
    restart) native_stop; native_start ;;
    status)  native_status ;;
  esac
fi
