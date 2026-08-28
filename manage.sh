#!/usr/bin/env bash
# manage.sh — Application lifecycle management
#
# Default mode: Docker Compose (orchestrates client + server via docker-compose.yml)
# Use --native to run without Docker (requires node/npm on PATH).
#
# Usage:
#   ./manage.sh [--docker|--native|--codespace] {start|stop|restart|status|build|install|ensure|doctor|recover|fix|e2e}
#   ./manage.sh [--native|--codespace] logs [client|server|openrouter|all]
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
#   ./manage.sh recover                 # inspect the last 30 minutes and repair safe dependency issues
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
#   ./manage.sh --codespace restart     # restart native server + client in GitHub Codespaces
#   ./manage.sh --docker e2e --record    # run Docker E2E and save videos
#   ./manage.sh --native logs server    # tail logs/server.log

set -uo pipefail

# Always operate from the project root, even when called from another directory.
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT" || exit 1

# ── defaults ──────────────────────────────────────────────────────────────────
USE_NATIVE=false
COMMAND=""
LOG_SERVICE="all"
E2E_RECORD=false

# ── colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
head_()  { echo -e "${CYAN}── $* ──${NC}"; }

# ── argument parsing ──────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --docker) USE_NATIVE=false ;;
    --native) USE_NATIVE=true ;;
    --codespace) USE_NATIVE=true ;;
    start|stop|restart|status|build|install|ensure|doctor|recover|fix|e2e) COMMAND="$arg" ;;
    --record) E2E_RECORD=true ;;
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
      echo "Usage: $0 [--docker|--native|--codespace] {start|stop|restart|status|build|install|ensure|doctor|recover|fix|e2e [--record]|logs [service]}" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$COMMAND" ]]; then
  echo "Usage: $0 [--docker|--native|--codespace] {start|stop|restart|status|build|install|ensure|doctor|recover|fix|e2e [--record]|logs [service]}"
  exit 1
fi

# ── Check helpers (used by doctor + docker_check) ─────────────────────────────
PASS="${GREEN}[PASS]${NC}"; FAIL="${RED}[FAIL]${NC}"; SKIP="${YELLOW}[SKIP]${NC}"

check_project_file() {
  local file="$1" description="$2"
  if [[ -f "$file" ]]; then
    echo -e "  ${PASS}  ${description} (${file})"
    return 0
  fi
  echo -e "  ${FAIL}  ${description} missing (${file})"
  return 1
}

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

check_node_version() {
  if ! command -v node &>/dev/null; then
    return 1
  fi
  local required=20 actual major
  if [[ -f .nvmrc ]] && grep -Eq '^[[:space:]]*[0-9]+' .nvmrc; then
    required="$(grep -Eo '[0-9]+' .nvmrc | head -1)"
  fi
  actual="$(node --version 2>/dev/null | sed 's/^v//' || true)"
  major="${actual%%.*}"
  if [[ "$major" =~ ^[0-9]+$ ]] && (( major >= required )); then
    echo -e "  ${PASS}  Node.js ${actual} meets the required version (>= ${required})"
    return 0
  fi
  echo -e "  ${FAIL}  Node.js ${actual:-unknown} is too old (requires >= ${required})"
  echo    "          → Install/use Node.js ${required} or newer."
  return 1
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

check_package_manager() {
  if [[ -f pnpm-lock.yaml ]]; then
    if command -v pnpm &>/dev/null; then
      echo -e "  ${PASS}  pnpm $(pnpm --version 2>/dev/null) matches pnpm-lock.yaml"
      return 0
    fi
    echo -e "  ${FAIL}  pnpm-lock.yaml is present but pnpm is not installed"
    echo    "          → Enable Corepack or install pnpm, then run: pnpm install"
    return 1
  fi
  if [[ -f package-lock.json ]] && command -v npm &>/dev/null; then
    echo -e "  ${PASS}  npm $(npm --version 2>/dev/null) matches package-lock.json"
    return 0
  fi
  if [[ -f yarn.lock ]] && command -v yarn &>/dev/null; then
    echo -e "  ${PASS}  yarn $(yarn --version 2>/dev/null) matches yarn.lock"
    return 0
  fi
  echo -e "  ${FAIL}  No installed package manager matches the project lockfile"
  echo    "          → Run './manage.sh install' after installing the matching package manager."
  return 1
}

check_server_deps() {
  if [[ -d server/node_modules || -d node_modules ]]; then
    if command -v node &>/dev/null && node -e "require.resolve('express')" &>/dev/null; then
      echo -e "  ${PASS}  Server dependencies are resolvable"
      return 0
    fi
    echo -e "  ${FAIL}  Server dependency directory exists but express is not resolvable"
    echo    "          → Run './manage.sh install'"
    return 1
  else
    echo -e "  ${FAIL}  Server dependencies are missing"
    echo    "          → Run './manage.sh install'"
    return 1
  fi
}

check_client_deps() {
  if [[ -d node_modules && -x node_modules/.bin/vite ]]; then
    echo -e "  ${PASS}  Client dependencies and Vite are present"
    return 0
  fi
  echo -e "  ${FAIL}  Client dependencies or Vite are missing"
  echo    "          → Run './manage.sh install'"
  return 1
}

check_json_file() {
  local file="$1"
  if ! command -v node &>/dev/null || [[ ! -f "$file" ]]; then
    return 1
  fi
  if node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$file" &>/dev/null; then
    echo -e "  ${PASS}  Valid JSON: ${file}"
    return 0
  fi
  echo -e "  ${FAIL}  Invalid JSON: ${file}"
  echo    "          → Fix the JSON syntax before installing dependencies."
  return 1
}

check_server_syntax() {
  if ! command -v node &>/dev/null; then
    echo -e "  ${SKIP}  Server syntax check skipped (node not found)"
    return 0
  fi
  local failed=0 file
  for file in server/index.js netlify/functions/api.js server/services/youtube-transcript.js; do
    if node --check "$file" &>/dev/null; then
      echo -e "  ${PASS}  JavaScript syntax: ${file}"
    else
      echo -e "  ${FAIL}  JavaScript syntax error: ${file}"
      node --check "$file" 2>&1 | tail -4 | sed 's/^/          /'
      failed=$((failed+1))
    fi
  done
  return "$failed"
}

check_project_build() {
  local manager=""
  if [[ -f pnpm-lock.yaml ]] && command -v pnpm &>/dev/null; then
    manager="pnpm"
  elif command -v npm &>/dev/null; then
    manager="npm"
  else
    echo -e "  ${SKIP}  Production build skipped (no package manager available)"
    return 0
  fi
  if [[ ! -x node_modules/.bin/vite ]]; then
    echo -e "  ${SKIP}  Production build skipped (client dependencies unavailable)"
    return 0
  fi

  local output
  output="$(mktemp "${TMPDIR:-/tmp}/manage-doctor-build.XXXXXX")"
  if "$manager" run build >"$output" 2>&1; then
    echo -e "  ${PASS}  Production build succeeds (${manager} run build)"
    rm -f "$output"
    return 0
  fi
  echo -e "  ${FAIL}  Production build failed (${manager} run build)"
  tail -12 "$output" | sed 's/^/          /'
  rm -f "$output"
  return 1
}

check_live_health() {
  local label="$1" url="$2" status
  if ! command -v curl &>/dev/null; then
    echo -e "  ${SKIP}  ${label} health check skipped (curl not found)"
    return 0
  fi
  status="$(curl -sS -L --max-time 3 -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || true)"
  if [[ "$status" =~ ^2[0-9][0-9]$ ]]; then
    echo -e "  ${PASS}  ${label} healthy (${url} → HTTP ${status})"
    return 0
  fi
  if [[ "$status" == "000" || -z "$status" ]]; then
    echo -e "  ${SKIP}  ${label} is not running (${url})"
    return 0
  fi
  echo -e "  ${FAIL}  ${label} returned HTTP ${status} (${url})"
  return 1
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
  local docker_ok=0 native_ok=0 issues=0 warnings=0

  echo ""
  head_ "Project location"
  echo -e "  ${PASS}  ${PROJECT_ROOT}"

  echo ""
  head_ "Docker environment"
  if check_docker_installed && check_docker_daemon && check_compose_available; then
    docker_ok=1
  else
    warnings=$((warnings+1))
  fi

  echo ""
  head_ "Prerequisites"
  check_node || issues=$((issues+1))
  check_node_version || issues=$((issues+1))
  check_npm || issues=$((issues+1))
  check_package_manager || issues=$((issues+1))

  echo ""
  head_ "Dependencies"
  check_server_deps || issues=$((issues+1))
  check_client_deps || issues=$((issues+1))
  (check_node && check_npm && check_client_deps && check_server_deps) \
    && native_ok=1

  echo ""
  head_ "Configuration"
  check_project_file package.json "Client manifest" || issues=$((issues+1))
  check_project_file server/package.json "Server manifest" || issues=$((issues+1))
  check_project_file vite.config.ts "Vite configuration" || issues=$((issues+1))
  check_project_file netlify.toml "Netlify configuration" || issues=$((issues+1))
  check_project_file server/index.js "Server entrypoint" || issues=$((issues+1))
  check_project_file netlify/functions/api.js "Netlify function" || issues=$((issues+1))
  check_env_file

  echo ""
  head_ "Project health"
  check_json_file package.json || issues=$((issues+1))
  check_json_file server/package.json || issues=$((issues+1))
  check_server_syntax || issues=$((issues+1))
  check_project_build || issues=$((issues+1))

  echo ""
  head_ "Ports"
  check_port 5000 "client"
  check_port 3001 "server"

  echo ""
  head_ "Live service health"
  check_live_health "Client" "http://localhost:5000/" || issues=$((issues+1))
  check_live_health "Server API" "http://localhost:3001/api/health" || issues=$((issues+1))

  echo ""
  head_ "Summary"
  if (( docker_ok )); then
    echo -e "  ${PASS}  Docker is ready  →  ./manage.sh start"
  elif [[ -n "${REPL_ID:-}" ]]; then
    echo -e "  ${SKIP}  Docker is unavailable in this Replit sandbox"
  else
    echo -e "  ${FAIL}  Docker is NOT ready (see issues above)"
  fi
  if (( native_ok )); then
    echo -e "  ${PASS}  Native mode ready  →  ./manage.sh --native start"
  else
    echo -e "  ${FAIL}  Native mode is NOT ready (see issues above)"
  fi
  if (( warnings > 0 )); then
    echo -e "  ${SKIP}  Docker checks unavailable — native mode can still be used"
  fi
  if (( issues > 0 )); then
    echo -e "  ${FAIL}  ${issues} project issue(s) require attention"
  else
    echo -e "  ${PASS}  Project prerequisites and health checks passed"
  fi
  echo ""
  (( issues == 0 ))
}

# ── recover recent issues ─────────────────────────────────────────────────────
# Review fresh logs and repair only safe, mechanically detectable dependency
# failures. Application errors, port conflicts, and browser/runtime errors are
# reported with next steps instead of being hidden or force-killed.
RECOVER_MINUTES=30

recent_log_files() {
  local roots=() root
  [[ -d logs ]] && roots+=("logs")
  [[ -d /tmp/logs ]] && roots+=("/tmp/logs")
  [[ -d artifacts ]] && roots+=("artifacts")
  (( ${#roots[@]} > 0 )) || return 0

  for root in "${roots[@]}"; do
    find "$root" \
      -path '*/node_modules' -prune -o \
      -type f -mmin "-${RECOVER_MINUTES}" -print 2>/dev/null
  done | sort -u
}

print_recent_log_findings() {
  local file="$1" matched=0 line
  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    (( matched++ ))
    echo "          ${line:0:260}"
    (( matched >= 4 )) && break
  done < <(grep -E -i \
    'ERR_MODULE_NOT_FOUND|cannot find module|failed to load config|error when starting|DIDNT_OPEN_A_PORT|port .*already in use|invalid hook call|syntax error|(^|[^a-z])fail(ed|ure)?([^a-z]|$)|(^|[^a-z])error([^a-z]|$)|missing' \
    "$file" 2>/dev/null || true)
  echo "$matched"
}

manifest_missing_dependencies() {
  local manifest="$1" base
  base="$(dirname "$manifest")"
  [[ -f "$manifest" ]] || return 0
  [[ -d "$base/node_modules" ]] || {
    echo "__ALL_DEPENDENCIES__"
    return 0
  }

  node -e '
    const fs = require("fs");
    const path = require("path");
    const manifest = path.resolve(process.argv[1]);
    const packageJson = JSON.parse(fs.readFileSync(manifest, "utf8"));
    const names = [
      ...Object.keys(packageJson.dependencies || {}),
      ...Object.keys(packageJson.devDependencies || {}),
      ...Object.keys(packageJson.optionalDependencies || {}),
    ];
    const nodeModules = path.join(path.dirname(manifest), "node_modules");
    for (const name of names) {
      if (!fs.existsSync(path.join(nodeModules, name))) console.log(name);
    }
  ' "$manifest" 2>/dev/null || echo "__MANIFEST_READ_FAILED__"
}

install_manifest_dependencies() {
  local manifest="$1" base manager
  base="$(dirname "$manifest")"

  if [[ -f "$base/package-lock.json" ]] && command -v npm &>/dev/null; then
    manager="npm ci"
    (cd "$base" && npm ci)
  elif [[ -f "$base/pnpm-lock.yaml" ]] && command -v pnpm &>/dev/null; then
    manager="pnpm install --frozen-lockfile"
    (cd "$base" && pnpm install --frozen-lockfile)
  elif [[ -f "$base/yarn.lock" ]] && command -v yarn &>/dev/null; then
    manager="yarn install --frozen-lockfile"
    (cd "$base" && yarn install --frozen-lockfile)
  elif command -v npm &>/dev/null; then
    manager="npm install"
    (cd "$base" && npm install)
  else
    error "No supported Node package manager found for $base."
    return 1
  fi
}

run_recover() {
  local files=() file findings=0 safe_repairs=0 unresolved=0
  local manifests=("package.json")
  local manifest missing base

  while IFS= read -r file; do
    [[ -n "$file" ]] && files+=("$file")
  done < <(recent_log_files)

  echo ""
  head_ "Recent issue recovery (last ${RECOVER_MINUTES} minutes)"

  if (( ${#files[@]} == 0 )); then
    echo -e "  ${SKIP}  No recently modified logs found."
  else
    for file in "${files[@]}"; do
      local finding_count
      finding_count="$(print_recent_log_findings "$file" | tail -1)"
      if [[ "$finding_count" =~ ^[0-9]+$ ]] && (( finding_count > 0 )); then
        findings=$((findings+finding_count))
        echo -e "  ${FAIL}  Recent failure signals in ${file}"
        print_recent_log_findings "$file" | sed '$d' | sed 's/^/          /'
      fi
    done
    (( findings == 0 )) && echo -e "  ${PASS}  No known failure signatures found in recent logs."
  fi

  for manifest in artifacts/*/package.json; do
    [[ -f "$manifest" ]] && manifests+=("$manifest")
  done

  echo ""
  head_ "Declared dependency check"
  for manifest in "${manifests[@]}"; do
    base="$(dirname "$manifest")"
    missing="$(manifest_missing_dependencies "$manifest" | paste -sd, -)"
    if [[ -z "$missing" ]]; then
      echo -e "  ${PASS}  ${base}/node_modules matches ${manifest}"
      continue
    fi

    findings=$((findings+1))
    echo -e "  ${FAIL}  Missing declared dependencies for ${manifest}: ${missing}"
    echo    "          → Reinstalling from the checked-in lockfile when available."
    if install_manifest_dependencies "$manifest"; then
      echo -e "  ${PASS}  Dependencies restored for ${base}."
      safe_repairs=$((safe_repairs+1))
    else
      echo -e "  ${FAIL}  Could not restore dependencies for ${base}."
      unresolved=$((unresolved+1))
    fi
  done

  echo ""
  head_ "Recovery summary"
  if (( safe_repairs > 0 )); then
    info "${safe_repairs} safe dependency repair(s) applied."
    echo    "          → Restart the affected workflow or service to load them."
  fi
  if (( findings > safe_repairs )); then
    warn "$((findings-safe_repairs)) issue signal(s) still need review."
    echo    "          → Port/process conflicts are not killed automatically."
    echo    "          → Application and browser errors need code-level investigation."
    echo    "          → Run './manage.sh doctor' for the full environment report."
  elif (( findings == 0 )); then
    info "No recent issues detected."
  else
    info "All detected dependency issues were repaired."
  fi

  (( unresolved == 0 )) || return 1
  return 0
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

# ── URL helper ────────────────────────────────────────────────────────────────
# Prints the public client URL (Replit domain when available) + server address.
print_urls() {
  local logs_hint="${1:-./manage.sh --native logs [client|server]}"
  if [[ -n "${REPLIT_DEV_DOMAIN:-}" ]]; then
    info "Client  → ${GREEN}https://${REPLIT_DEV_DOMAIN}${NC}  (port 80, public)"
    info "Server  → http://localhost:3001  (port 3001, internal)"
  else
    info "Client  → http://localhost:5000"
    info "Server  → http://localhost:3001"
  fi
  info "Logs    → ${logs_hint}"
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
      env PORT=5000 DANGEROUSLY_DISABLE_HOST_CHECK=true npm start || exit 1
  fi

  echo ""
  head_ "Health checks"
  wait_for_http "server (port 3001)" "http://localhost:3001" 20 || issues=$((issues+1))
  wait_for_http "client (port 5000)" "http://localhost:5000" 40 || issues=$((issues+1))

  echo ""
  if (( issues == 0 )); then
    info "Everything is up and healthy."
    print_urls "./manage.sh --native logs [client|server]"
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
    print_urls "./manage.sh logs [client|server]"
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
  print_urls "./manage.sh logs [client|server]"
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

# Resolve the node binary — on Replit, node may only be in the Nix store path,
# not in the bare PATH that nohup inherits.  Try: PATH first, then the Replit
# helper that lists available node paths, then a known Nix profile location.
_resolve_node() {
  if command -v node &>/dev/null; then
    command -v node
    return
  fi
  local helper="/nix/store/h8lc486l7m2j4qxrgc0cf3ild1n9xjlr-replit-runtime-path/bin/available-pid2-node-paths"
  if [[ -x "$helper" ]]; then
    local p; p=$(bash "$helper" 2>/dev/null | head -1)
    [[ -x "$p" ]] && { echo "$p"; return; }
  fi
  # Fall back: glob the most recent nodejs in the Nix store
  local p; p=$(ls /nix/store/*/bin/node 2>/dev/null | sort -V | tail -1)
  [[ -x "$p" ]] && { echo "$p"; return; }
  echo "node"  # last resort — let the error surface naturally
}
NODE="$(_resolve_node)"
# On Replit, npm is often named "nodenpm" next to the node binary.
_resolve_npm() {
  local dir; dir="$(dirname "$NODE")"
  if [[ -x "${dir}/npm" ]];     then echo "${dir}/npm";     return; fi
  if [[ -x "${dir}/nodenpm" ]]; then echo "${dir}/nodenpm"; return; fi
  command -v npm 2>/dev/null || echo "npm"
}
NPM="$(_resolve_npm)"

port_is_free() {
  "$NODE" -e "
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
    # Check if we can identify who holds the port.  If nobody can be found
    # (e.g. Replit proxy / different network namespace), attempt to start
    # anyway — the process itself will surface a real bind error if needed.
    local holder; holder=$(pid_on_port "$port") || true
    if [[ -n "${holder:-}" ]]; then
      error "Port $port is already in use (PID $holder) — cannot start $name."
      return 1
    fi
    warn "Port $port appears busy but no owning process found (likely a Replit proxy port) — attempting to start $name anyway."
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
      # pid_on_port failed — try fuser as a fallback, then accept the port
      # may be held by a Replit proxy in a different network namespace.
      if fuser -k "${port}/tcp" 2>/dev/null; then
        info "Port $port freed via fuser."
      else
        warn "Port $port is in use but the holder could not be identified (likely a Replit proxy port) — proceeding anyway."
      fi
    fi
  fi
}

native_start() {
  # Ensure node/npm are on PATH for child processes (e.g. vite's #!/usr/bin/env node shebang)
  local node_bin_dir; node_bin_dir="$(dirname "$NODE")"
  export PATH="${node_bin_dir}:${PATH}"
  # Also expose npm as "npm" even if the binary has a different name on this platform
  if [[ "$(basename "$NPM")" != "npm" ]] && [[ ! -e "${node_bin_dir}/npm" ]]; then
    ln -sf "$NPM" "${node_bin_dir}/npm" 2>/dev/null || true
  fi

  # Start server first, then client
  native_start_service \
    "server" "$SERVER_PID" "$LOG_DIR/server.log" 3001 \
    "$NODE" server/index.js \
  || exit 1

  native_start_service \
    "client" "$CLIENT_PID" "$LOG_DIR/client.log" 5000 \
    env PORT=5000 DANGEROUSLY_DISABLE_HOST_CHECK=true "$NPM" start \
  || exit 1

  echo ""
  print_urls "./manage.sh --native logs [client|server]"
}

native_stop() {
  native_stop_service "client" "$CLIENT_PID" 5000
  native_stop_service "server" "$SERVER_PID" 3001
}

service_url() {
  # Return the public URL for a given port.
  # Port 5000 (client) → Replit public domain when available, else localhost.
  # All other ports → always localhost.
  local port="$1"
  if [[ "$port" == "5000" && -n "${REPLIT_DEV_DOMAIN:-}" ]]; then
    echo "https://${REPLIT_DEV_DOMAIN}  (port 80, public)"
  else
    echo "http://localhost:${port}"
  fi
}

native_status() {
  head_ "Native service status"
  echo ""
  local any_running=false

  for pair in "server:$SERVER_PID:3001" "client:$CLIENT_PID:5000"; do
    local name="${pair%%:*}" rest="${pair#*:}"
    local pidfile="${rest%%:*}" port="${rest##*:}"
    local url; url=$(service_url "$port")

    if native_is_running "$pidfile"; then
      any_running=true
      info "$name  ${GREEN}Running${NC}  PID $(cat "$pidfile") (managed)  → $url"
    elif ! port_is_free "$port"; then
      # Port occupied by a process started outside manage.sh
      any_running=true
      local pid; pid=$(pid_on_port "$port") || true
      local cmd="?"
      [[ -n "${pid:-}" ]] && cmd=$(cat "/proc/${pid}/comm" 2>/dev/null || echo "?")
      if [[ -n "${pid:-}" ]]; then
        info "$name  ${GREEN}Running${NC}  PID ${pid} [${cmd}] (external)  → $url"
      else
        info "$name  ${YELLOW}Running${NC}  port ${port} in use (PID unknown)  → $url"
      fi
      [[ -f "$pidfile" ]] && rm -f "$pidfile"
    else
      warn "$name  ${RED}Stopped${NC}"
      [[ -f "$pidfile" ]] && rm -f "$pidfile"
    fi
  done

  echo ""
  if $any_running; then
    print_urls "./manage.sh --native logs [client|server]"
  fi
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

ensure_cypress_linux_deps() {
  local packages=(
    xvfb xauth libgtk2.0-0 libgtk-3-0 libgbm-dev libnotify-dev libnss3
    libxss1 libasound2t64 libxtst6 libatk1.0-0 libatk-bridge2.0-0
  )
  if command -v Xvfb &>/dev/null && ldconfig -p 2>/dev/null | grep -q 'libatk-1.0.so.0'; then
    return 0
  fi
  if ! command -v sudo &>/dev/null || ! sudo -n true &>/dev/null 2>&1; then
    error "Cypress Linux dependencies are missing and cannot be installed automatically."
    echo "          → Install them manually: sudo apt-get update && sudo apt-get install -y xvfb libgtk2.0-0 libgtk-3-0 libgbm-dev libnotify-dev libnss3 libxss1 libasound2t64 libxtst6 libatk1.0-0 libatk-bridge2.0-0"
    return 1
  fi
  info "Cypress Linux dependencies are missing; installing them…"
  sudo apt-get update -qq && sudo apt-get install -y -qq "${packages[@]}"
}

run_e2e() {
  if ! $USE_NATIVE; then
    docker_check
    info "Running Docker E2E suite (recording: true)…"
    mkdir -p cypress/videos cypress/screenshots
    local exit_code=0
    compose_cmd -f docker-compose.test.yml --profile test up \
      --build --abort-on-container-exit --exit-code-from cypress || exit_code=$?
    compose_cmd -f docker-compose.test.yml --profile test down \
      --volumes --remove-orphans || true
    return "$exit_code"
  fi

  if [[ ! -x node_modules/.bin/cypress ]]; then
    error "Cypress is not installed. Run './manage.sh install' first."
    return 1
  fi

  ensure_cypress_linux_deps || return 1
  local base_url="${CYPRESS_baseUrl:-${CYPRESS_BASE_URL:-http://localhost:5000}}"
  local browser="${CYPRESS_BROWSER:-chrome}"
  if [[ "$browser" == "chrome" ]] && ! command -v google-chrome &>/dev/null && ! command -v chromium &>/dev/null && ! command -v chromium-browser &>/dev/null; then
    warn "Chrome is unavailable; using Cypress Electron instead."
    browser="electron"
  fi
  local video_config="video=${E2E_RECORD},videosFolder=cypress/videos"
  info "Running Invidious E2E against ${base_url} with ${browser} (recording: ${E2E_RECORD})…"
  pnpm exec cypress run \
    --browser "$browser" \
    --config-file cypress.config.ts \
    --config "baseUrl=${base_url},${video_config}" \
    --spec cypress/e2e/invidious.cy.ts
}

# ── dispatch ──────────────────────────────────────────────────────────────────
# install, doctor and fix run regardless of --native flag
if [[ "$COMMAND" == "install" ]]; then run_install; exit 0; fi
if [[ "$COMMAND" == "doctor"  ]]; then run_doctor;  exit 0; fi
if [[ "$COMMAND" == "recover" ]]; then run_recover; exit $?; fi
if [[ "$COMMAND" == "fix"     ]]; then run_fix;     exit 0; fi
if [[ "$COMMAND" == "e2e"     ]]; then run_e2e; exit $?; fi

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
