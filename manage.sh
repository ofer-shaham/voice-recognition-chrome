#!/usr/bin/env bash
# manage.sh — Application lifecycle management
#
# Default mode: Docker Compose (orchestrates client + server via docker-compose.yml)
# Use --native to run without Docker (requires node/npm on PATH).
#
# Usage:
#   ./manage.sh [--native] {start|stop|restart|status|build|install|ensure|doctor|fix}
#   ./manage.sh [--native] logs [client|server|openrouter|all]
#
# Docker Compose services:
#   client      React dev server  → http://localhost:5000
#   server      OpenRouter proxy  → http://localhost:3001
#   openrouter  Alias for 'server'
#
# Examples:
#   ./manage.sh --native ensure         # check prereqs, install deps, start & health-check
#   ./manage.sh install                 # install all client + server npm dependencies
#   ./manage.sh doctor                  # diagnose Docker + environment issues
#   ./manage.sh fix                     # auto-fix detected issues
#   ./manage.sh start                   # docker compose up (build if needed)
#   ./manage.sh stop                    # docker compose down
#   ./manage.sh restart                 # rebuild + restart both services
#   ./manage.sh status                  # show container states
#   ./manage.sh build                   # rebuild images
#   ./manage.sh logs                    # follow all logs
#   ./manage.sh logs server             # follow server / OpenRouter logs
#   ./manage.sh logs client             # follow React client logs
#   ./manage.sh --native start          # start server + client natively (no Docker)
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
    start|stop|restart|status|build|install|ensure|doctor|fix) COMMAND="$arg" ;;
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
      echo "Usage: $0 [--native] {start|stop|restart|status|build|install|ensure|doctor|fix|logs [service]}" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$COMMAND" ]]; then
  echo "Usage: $0 [--native] {start|stop|restart|status|build|install|ensure|doctor|fix|logs [service]}"
  exit 1
fi

# ── Check helpers (used by doctor + docker_check) ─────────────────────────────
PASS="${GREEN}[PASS]${NC}"; FAIL="${RED}[FAIL]${NC}"; SKIP="${YELLOW}[SKIP]${NC}"

check_docker_installed() {
  if command -v docker &>/dev/null; then
    echo -e "  ${PASS}  docker $(docker --version 2>/dev/null | awk '{print $3}' | tr -d ',')"
    return 0
  else
    echo -e "  ${FAIL}  docker not found in PATH"
    echo    "          → Install Docker Desktop: https://docs.docker.com/get-docker/"
    echo    "          → Or run without Docker:  ./manage.sh --native start"
    return 1
  fi
}

check_docker_daemon() {
  if docker info &>/dev/null 2>&1; then
    local ctx; ctx=$(docker context show 2>/dev/null || echo "default")
    echo -e "  ${PASS}  Docker daemon running (context: ${ctx})"
    return 0
  else
    # Replit sandbox: dockerd cannot run — steer users to native mode
    if [[ -n "${REPL_ID:-}" ]]; then
      echo -e "  ${SKIP}  Docker daemon unavailable in Replit sandbox"
      echo    "          → Use native mode instead: ./manage.sh --native start"
      return 1
    fi
    echo -e "  ${FAIL}  Docker daemon is not running"
    case "$(uname -s)" in
      Darwin)
        echo    "          → Start Docker Desktop from Applications"
        echo    "          → Or via CLI: open -a Docker"
        ;;
      Linux)
        echo    "          → sudo systemctl start docker"
        echo    "          → If using Rootless Docker: systemctl --user start docker"
        echo    "          → Check socket: ls -la /var/run/docker.sock"
        ;;
      MINGW*|MSYS*|CYGWIN*)
        echo    "          → Start Docker Desktop from the system tray / Start Menu"
        ;;
    esac
    echo    "          → Or run without Docker: ./manage.sh --native start"
    return 1
  fi
}

check_compose_available() {
  if docker compose version &>/dev/null 2>&1; then
    echo -e "  ${PASS}  docker compose (v2) $(docker compose version --short 2>/dev/null)"
    return 0
  elif command -v docker-compose &>/dev/null; then
    echo -e "  ${PASS}  docker-compose (v1) $(docker-compose --version 2>/dev/null | awk '{print $NF}')"
    return 0
  else
    echo -e "  ${FAIL}  Neither 'docker compose' (v2) nor 'docker-compose' (v1) found"
    echo    "          → Upgrade Docker Desktop (includes Compose v2)"
    echo    "          → Or install plugin: https://docs.docker.com/compose/install/"
    return 1
  fi
}

check_node() {
  if command -v node &>/dev/null; then
    echo -e "  ${PASS}  node $(node --version)"
    return 0
  else
    echo -e "  ${FAIL}  node not found"
    echo    "          → Install Node.js: https://nodejs.org/"
    return 1
  fi
}

check_npm() {
  if command -v npm &>/dev/null; then
    echo -e "  ${PASS}  npm $(npm --version)"
    return 0
  else
    echo -e "  ${FAIL}  npm not found (usually bundled with Node.js)"
    return 1
  fi
}

check_server_deps() {
  if [[ -d server/node_modules ]]; then
    echo -e "  ${PASS}  server/node_modules present"
    return 0
  else
    echo -e "  ${FAIL}  server/node_modules missing"
    echo    "          → Run: cd server && npm install"
    return 1
  fi
}

check_client_deps() {
  if [[ -d node_modules ]]; then
    echo -e "  ${PASS}  node_modules present"
    return 0
  else
    echo -e "  ${FAIL}  node_modules missing"
    echo    "          → Run: npm install --legacy-peer-deps"
    return 1
  fi
}

check_env_file() {
  if [[ -f .env ]]; then
    if grep -q "^OPENROUTER_API_KEY=.\+" .env 2>/dev/null; then
      echo -e "  ${PASS}  .env found with OPENROUTER_API_KEY set"
    else
      echo -e "  ${SKIP}  .env found but OPENROUTER_API_KEY is empty or missing"
      echo    "          → Edit .env and set OPENROUTER_API_KEY=sk-or-..."
    fi
    return 0
  else
    echo -e "  ${SKIP}  .env not found (needed for Docker Compose API key)"
    echo    "          → cp .env.example .env  then fill in OPENROUTER_API_KEY"
    return 0  # not fatal; Replit Secrets or UI key can supply the key
  fi
}

check_port() {
  local port="$1" label="$2"
  if port_is_free "$port"; then
    echo -e "  ${PASS}  port ${port} (${label}) is free"
  else
    # Try to identify what's using it
    local hex_port; printf -v hex_port '%04X' "$port"
    local inode; inode=$(awk -v p=":${hex_port}" 'NR>1 && $2~p && $4=="0A"{print $10;exit}' /proc/net/tcp /proc/net/tcp6 2>/dev/null || true)
    local who="unknown process"
    if [[ -n "$inode" ]]; then
      for dir in /proc/[0-9]*/fd; do
        if ls -la "$dir" 2>/dev/null | grep -q "socket:\[${inode}\]"; then
          local pid; pid=$(echo "$dir" | cut -d/ -f3)
          local cmd; cmd=$(cat "/proc/${pid}/comm" 2>/dev/null || echo "unknown")
          who="PID ${pid} (${cmd})"
          break
        fi
      done
    fi
    echo -e "  ${SKIP}  port ${port} (${label}) in use by ${who}"
    echo    "          → This is expected if the service is already running"
  fi
}

# ── doctor ────────────────────────────────────────────────────────────────────
run_doctor() {
  local docker_ok=0 native_ok=0 issues=0

  echo ""
  head_ "Docker environment"
  check_docker_installed && check_docker_daemon && check_compose_available \
    && docker_ok=1 || issues=$((issues+1))

  echo ""
  head_ "Native (node/npm) environment"
  check_node   || issues=$((issues+1))
  check_npm    || issues=$((issues+1))
  check_server_deps || issues=$((issues+1))
  check_client_deps || issues=$((issues+1))
  (check_node && check_npm && [[ -d server/node_modules ]] && [[ -d node_modules ]]) \
    && native_ok=1

  echo ""
  head_ "Configuration"
  check_env_file

  echo ""
  head_ "Ports"
  check_port 5000 "client"
  check_port 3001 "server"

  echo ""
  head_ "Summary"
  if (( docker_ok )); then
    echo -e "  ${PASS}  Docker is ready  →  ./manage.sh start"
  else
    echo -e "  ${FAIL}  Docker is NOT ready (see issues above)"
  fi
  if (( native_ok )); then
    echo -e "  ${PASS}  Native mode ready  →  ./manage.sh --native start"
  else
    echo -e "  ${FAIL}  Native mode is NOT ready (see issues above)"
  fi
  echo ""
}

# ── fix ───────────────────────────────────────────────────────────────────────
FIX_="${CYAN}[FIX]${NC}"

run_fix() {
  local fixed=0

  echo ""
  head_ "Automated fixes"

  # ── 1. client node_modules ─────────────────────────────────────────────────
  if [[ ! -d node_modules ]]; then
    echo -e "  ${FIX_}  Installing client dependencies (npm install --legacy-peer-deps)…"
    if npm install --legacy-peer-deps; then
      echo -e "  ${PASS}  Client dependencies installed."
      fixed=$((fixed+1))
    else
      echo -e "  ${FAIL}  npm install failed — check the output above."
    fi
  else
    echo -e "  ${PASS}  Client node_modules present — skipping."
  fi

  # ── 2. server node_modules ─────────────────────────────────────────────────
  if [[ ! -d server/node_modules ]]; then
    echo -e "  ${FIX_}  Installing server dependencies (cd server && npm install)…"
    if (cd server && npm install); then
      echo -e "  ${PASS}  Server dependencies installed."
      fixed=$((fixed+1))
    else
      echo -e "  ${FAIL}  npm install (server) failed — check the output above."
    fi
  else
    echo -e "  ${PASS}  Server node_modules present — skipping."
  fi

  # ── 3. .env file ──────────────────────────────────────────────────────────
  if [[ ! -f .env ]]; then
    echo -e "  ${FIX_}  Creating .env from .env.example…"
    if cp .env.example .env; then
      echo -e "  ${PASS}  .env created."
      echo    "          Edit .env and set OPENROUTER_API_KEY=sk-or-…"
      fixed=$((fixed+1))
    else
      echo -e "  ${FAIL}  Could not copy .env.example → .env"
    fi
  elif ! grep -q "^OPENROUTER_API_KEY=.\+" .env 2>/dev/null; then
    echo -e "  ${SKIP}  .env exists but OPENROUTER_API_KEY is empty."
    echo    "          → Edit .env and set OPENROUTER_API_KEY=sk-or-…"
  else
    echo -e "  ${PASS}  .env with OPENROUTER_API_KEY — skipping."
  fi

  # ── 4. Docker daemon ───────────────────────────────────────────────────────
  if ! command -v docker &>/dev/null; then
    echo -e "  ${SKIP}  Docker not installed — install it manually:"
    echo    "          → https://docs.docker.com/get-docker/"
    echo    "          → Then re-run: ./manage.sh fix"
  elif docker info &>/dev/null 2>&1; then
    echo -e "  ${PASS}  Docker daemon already running — skipping."
  elif [[ -n "${REPL_ID:-}" ]]; then
    # Replit sandbox: dockerd cannot run (no privilege), switch to native mode
    echo -e "  ${FIX_}  Replit detected — Docker daemon cannot run in this sandbox."
    echo    "          Switching default to --native mode for you."
    echo    "          Run: ./manage.sh --native start"
    echo -e "  ${PASS}  Native mode is fully supported (node + npm are present)."
  else
    echo -e "  ${FIX_}  Attempting to start Docker daemon…"
    local daemon_started=false
    case "$(uname -s)" in
      Darwin)
        open -a Docker 2>/dev/null && daemon_started=true
        ;;
      Linux)
        if sudo systemctl start docker 2>/dev/null; then
          daemon_started=true
        elif systemctl --user start docker 2>/dev/null; then
          daemon_started=true
        fi
        ;;
    esac

    if $daemon_started; then
      echo -n "          Waiting for daemon to respond"
      local i=0
      while (( i < 20 )); do
        sleep 1; i=$((i+1)); echo -n "."
        docker info &>/dev/null 2>&1 && break
      done
      echo ""
      if docker info &>/dev/null 2>&1; then
        echo -e "  ${PASS}  Docker daemon is now running."
        fixed=$((fixed+1))
      else
        echo -e "  ${FAIL}  Daemon did not respond within 20 s."
        case "$(uname -s)" in
          Darwin) echo "          → Try opening Docker Desktop manually." ;;
          Linux)  echo "          → sudo systemctl start docker" ;;
        esac
      fi
    else
      echo -e "  ${SKIP}  Could not start Docker automatically."
      case "$(uname -s)" in
        Darwin) echo "          → open -a Docker" ;;
        Linux)  echo "          → sudo systemctl start docker" ;;
        *)      echo "          → Start Docker Desktop manually." ;;
      esac
      echo    "          → Or skip Docker entirely: ./manage.sh --native start"
    fi
  fi

  # ── 5. Stale PID files ─────────────────────────────────────────────────────
  local stale=0
  for pidfile in .server.pid .client.pid .app.pid; do
    if [[ -f "$pidfile" ]]; then
      local pid; pid=$(cat "$pidfile")
      if ! kill -0 "$pid" 2>/dev/null; then
        echo -e "  ${FIX_}  Removing stale PID file $pidfile (PID $pid gone)."
        rm -f "$pidfile"
        stale=$((stale+1)); fixed=$((fixed+1))
      fi
    fi
  done
  (( stale == 0 )) && echo -e "  ${PASS}  No stale PID files."

  # ── summary ────────────────────────────────────────────────────────────────
  echo ""
  if (( fixed > 0 )); then
    info "$fixed fix(es) applied. Re-running diagnostics…"
    echo ""
    run_doctor
  else
    info "Nothing needed fixing. Run './manage.sh doctor' for a full status report."
  fi
}

# ── install ───────────────────────────────────────────────────────────────────
run_install() {
  echo ""
  head_ "Installing project dependencies"

  echo ""
  info "Client dependencies (npm install --legacy-peer-deps)…"
  if npm install --legacy-peer-deps; then
    echo -e "  ${PASS}  Client dependencies installed."
  else
    echo -e "  ${FAIL}  Client npm install failed — check the output above."
    return 1
  fi

  echo ""
  info "Server dependencies (cd server && npm install)…"
  if (cd server && npm install); then
    echo -e "  ${PASS}  Server dependencies installed."
  else
    echo -e "  ${FAIL}  Server npm install failed — check the output above."
    return 1
  fi

  echo ""
  info "All dependencies installed. Run './manage.sh --native start' or './manage.sh start'."
}

# ── ensure ────────────────────────────────────────────────────────────────────
# Idempotent: prereqs → deps → start → HTTP health-check

http_probe() {
  # Returns 0 if URL answers with any HTTP status (connection succeeds)
  local url="$1"
  node -e "
    const http = require('http');
    const { URL } = require('url');
    try {
      const u = new URL('${url}');
      const req = http.request(
        { hostname: u.hostname, port: u.port || 80, path: u.pathname || '/', method: 'GET' },
        (r) => { process.exit(r.statusCode < 500 ? 0 : 1); }
      );
      req.on('error', () => process.exit(1));
      req.setTimeout(3000, () => { req.destroy(); process.exit(1); });
      req.end();
    } catch(_) { process.exit(1); }
  " 2>/dev/null
}

wait_for_http() {
  local label="$1" url="$2" max="${3:-25}"
  local i=0
  echo -n "          Waiting for ${label}"
  while (( i < max )); do
    if http_probe "$url"; then
      echo " ready"
      echo -e "  ${PASS}  ${label} → ${url}"
      return 0
    fi
    echo -n "."; sleep 1; (( i++ ))
  done
  echo " timeout"
  echo -e "  ${FAIL}  ${label} did not respond after ${max}s"
  return 1
}

native_ensure() {
  local issues=0

  echo ""
  head_ "Prerequisites"
  if command -v node &>/dev/null; then
    echo -e "  ${PASS}  node $(node --version)"
  else
    echo -e "  ${FAIL}  node not found — install Node.js: https://nodejs.org/"; exit 1
  fi
  if command -v npm &>/dev/null; then
    echo -e "  ${PASS}  npm $(npm --version)"
  else
    echo -e "  ${FAIL}  npm not found (usually bundled with Node.js)"; exit 1
  fi

  echo ""
  head_ "Dependencies"
  if [[ -d node_modules ]]; then
    echo -e "  ${PASS}  Client node_modules present — skipping install."
  else
    echo -e "  ${FIX_}  Client node_modules missing — running npm install…"
    if npm install --legacy-peer-deps; then
      echo -e "  ${PASS}  Client dependencies installed."
    else
      echo -e "  ${FAIL}  Client npm install failed."; exit 1
    fi
  fi

  if [[ -d server/node_modules ]]; then
    echo -e "  ${PASS}  Server node_modules present — skipping install."
  else
    echo -e "  ${FIX_}  Server node_modules missing — running npm install…"
    if (cd server && npm install); then
      echo -e "  ${PASS}  Server dependencies installed."
    else
      echo -e "  ${FAIL}  Server npm install failed."; exit 1
    fi
  fi

  echo ""
  head_ "Services"

  if ! port_is_free 3001; then
    echo -e "  ${PASS}  Server already listening on port 3001."
  else
    native_start_service \
      "server" "$SERVER_PID" "$LOG_DIR/server.log" 3001 \
      node server/index.js || exit 1
  fi

  if ! port_is_free 5000; then
    echo -e "  ${PASS}  Client already listening on port 5000."
  else
    native_start_service \
      "client" "$CLIENT_PID" "$LOG_DIR/client.log" 5000 \
      npm start || exit 1
  fi

  echo ""
  head_ "Health checks"
  wait_for_http "server (port 3001)" "http://localhost:3001" 20 || issues=$((issues+1))
  wait_for_http "client (port 5000)" "http://localhost:5000" 40 || issues=$((issues+1))

  echo ""
  if (( issues == 0 )); then
    info "Everything is up and healthy."
    info "Client  → http://localhost:5000"
    info "Server  → http://localhost:3001"
    info "Logs    → ./manage.sh --native logs [client|server]"
  else
    error "${issues} service(s) failed the health check."
    info  "Check logs: ./manage.sh --native logs [client|server]"
    exit 1
  fi
}

compose_ensure() {
  echo ""
  head_ "Prerequisites"
  check_docker_installed || exit 1
  check_docker_daemon    || exit 1
  check_compose_available || exit 1

  echo ""
  head_ "Services"
  info "Bringing containers up (building if needed)…"
  compose_cmd up -d --build
  echo ""
  compose_cmd ps

  echo ""
  head_ "Health checks"
  local issues=0
  wait_for_http "server (port 3001)" "http://localhost:3001" 30 || issues=$((issues+1))
  wait_for_http "client (port 5000)" "http://localhost:5000" 40 || issues=$((issues+1))

  echo ""
  if (( issues == 0 )); then
    info "Everything is up and healthy."
    info "Client  → http://localhost:5000"
    info "Server  → http://localhost:3001"
  else
    error "${issues} service(s) failed the health check."
    info  "Check logs: ./manage.sh logs [client|server]"
    exit 1
  fi
}

# ── Docker Compose helpers ────────────────────────────────────────────────────
compose_cmd() {
  if docker compose version &>/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose &>/dev/null; then
    docker-compose "$@"
  else
    error "Neither 'docker compose' nor 'docker-compose' found."
    echo  "       Run './manage.sh doctor' to diagnose and get fix instructions." >&2
    exit 1
  fi
}

docker_check() {
  if ! command -v docker &>/dev/null; then
    error "Docker is not installed or not in PATH."
    echo  "       Run './manage.sh doctor' to diagnose and get fix instructions." >&2
    echo  "       Alternative: ./manage.sh --native start  (no Docker required)" >&2
    exit 1
  fi
  if ! docker info &>/dev/null 2>&1; then
    error "Docker daemon is not running."
    echo  "" >&2
    case "$(uname -s)" in
      Darwin) echo  "       → Start Docker Desktop (open -a Docker)" >&2 ;;
      Linux)  echo  "       → sudo systemctl start docker" >&2 ;;
      *)      echo  "       → Start Docker Desktop" >&2 ;;
    esac
    echo  "       → Or run without Docker: ./manage.sh --native start" >&2
    echo  "       → Full diagnostics:      ./manage.sh doctor" >&2
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

# Return the PID of the process listening on PORT, using /proc/net/tcp.
# Works without lsof/fuser/ss — pure bash + /proc.
pid_on_port() {
  local port=$1
  local hex_port; hex_port=$(printf '%04X' "$port")

  # Find the socket inode for this listening port
  local inode=""
  for f in /proc/net/tcp /proc/net/tcp6; do
    [[ -f "$f" ]] || continue
    inode=$(awk -v p=":${hex_port}" 'NR>1 && $2~p"$" && $4=="0A" { print $10; exit }' "$f")
    [[ -n "$inode" ]] && break
  done
  [[ -z "$inode" ]] && return 1

  # Scan /proc/*/fd for a socket link matching that inode
  local pid=""
  for fd_dir in /proc/[0-9]*/fd; do
    if ls -la "$fd_dir" 2>/dev/null | grep -q "socket:\[${inode}\]"; then
      pid="${fd_dir%/fd}"; pid="${pid#/proc/}"
      break
    fi
  done
  [[ -z "$pid" ]] && return 1
  echo "$pid"
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
  local name="$1" pidfile="$2" port="$3"

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
    warn "$name is not running (no PID file)."
    [[ -f "$pidfile" ]] && rm -f "$pidfile"
  fi

  # Free the port regardless — handles processes started outside manage.sh
  # (e.g. Replit workflows, manual node invocations).
  if ! port_is_free "$port"; then
    local squatter; squatter=$(pid_on_port "$port") || true
    if [[ -n "${squatter:-}" ]]; then
      warn "Port $port held by PID $squatter — killing it…"
      kill "$squatter" 2>/dev/null || true
      local j=0
      while ! port_is_free "$port" && (( j < 8 )); do sleep 1; (( j++ )); done
      kill -9 "$squatter" 2>/dev/null || true
      info "Port $port freed."
    else
      warn "Port $port is in use but the holder could not be identified — proceeding anyway."
    fi
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
  native_stop_service "client" "$CLIENT_PID" 5000
  native_stop_service "server" "$SERVER_PID" 3001
}

native_status() {
  head_ "Native service status"
  for pair in "server:$SERVER_PID:3001" "client:$CLIENT_PID:5000"; do
    local name="${pair%%:*}" rest="${pair#*:}"
    local pidfile="${rest%%:*}" port="${rest##*:}"
    if native_is_running "$pidfile"; then
      info "$name  Running (PID $(cat "$pidfile"), managed) → http://localhost:$port"
    elif ! port_is_free "$port"; then
      # Port is occupied — find the PID via /proc even without a PID file
      local pid; pid=$(pid_on_port "$port") || true
      local cmd=""
      [[ -n "${pid:-}" ]] && cmd=$(cat "/proc/${pid}/comm" 2>/dev/null || echo "?")
      if [[ -n "${pid:-}" ]]; then
        info "$name  Running (PID ${pid} [${cmd}], external) → http://localhost:$port"
      else
        info "$name  Running (port ${port} in use) → http://localhost:$port"
      fi
      [[ -f "$pidfile" ]] && rm -f "$pidfile"
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
# install, doctor and fix run regardless of --native flag
if [[ "$COMMAND" == "install" ]]; then run_install; exit 0; fi
if [[ "$COMMAND" == "doctor"  ]]; then run_doctor;  exit 0; fi
if [[ "$COMMAND" == "fix"     ]]; then run_fix;     exit 0; fi

if $USE_NATIVE; then
  case "$COMMAND" in
    start)   native_start ;;
    stop)    native_stop ;;
    restart) native_stop; native_start ;;
    status)  native_status || true ;;
    build)   warn "'build' is only relevant in Docker mode." ;;
    ensure)  native_ensure ;;
    logs)    native_logs ;;
  esac
else
  case "$COMMAND" in
    start)   compose_start ;;
    stop)    compose_stop ;;
    restart) compose_restart ;;
    status)  compose_status || true ;;
    build)   compose_build ;;
    ensure)  compose_ensure ;;
    logs)    compose_logs ;;
  esac
fi
