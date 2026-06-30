#!/usr/bin/env bash

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

DEFAULT_REMOTE_ALIAS="root"
DEFAULT_REMOTE_ENV_FILE="/root/image/deploy/bluegreen-host.env"
DEFAULT_NGINX_SITE="/etc/nginx/sites-enabled/gptch.cloud"
DEFAULT_NGINX_SNIPPET="/etc/nginx/snippets/gpt-image-playground-image.conf"
DEFAULT_PUBLIC_URL="https://gptch.cloud/image/"

REMOTE_ALIAS="$DEFAULT_REMOTE_ALIAS"
REMOTE_ENV_FILE="$DEFAULT_REMOTE_ENV_FILE"
NGINX_SITE="$DEFAULT_NGINX_SITE"
NGINX_SNIPPET="$DEFAULT_NGINX_SNIPPET"
PUBLIC_URL="$DEFAULT_PUBLIC_URL"
IMAGE_TAG=""
BUILD_SOURCE="head"
ALLOW_DIRTY_WORKTREE=0
SKIP_BUILD=0
TEMP_BUILD_DIR=""
BUILD_CONTEXT="$REPO_ROOT"

COLOR_RED="$(printf '\033[31m')"
COLOR_GREEN="$(printf '\033[32m')"
COLOR_YELLOW="$(printf '\033[33m')"
COLOR_BLUE="$(printf '\033[34m')"
COLOR_RESET="$(printf '\033[0m')"

cleanup() {
  if [ -n "$TEMP_BUILD_DIR" ] && [ -d "$TEMP_BUILD_DIR" ]; then
    rm -rf "$TEMP_BUILD_DIR"
  fi
}

trap cleanup EXIT

log_info() {
  printf "%s[INFO]%s %s\n" "$COLOR_BLUE" "$COLOR_RESET" "$1"
}

log_success() {
  printf "%s[SUCCESS]%s %s\n" "$COLOR_GREEN" "$COLOR_RESET" "$1"
}

log_warn() {
  printf "%s[WARN]%s %s\n" "$COLOR_YELLOW" "$COLOR_RESET" "$1"
}

log_error() {
  printf "%s[ERROR]%s %s\n" "$COLOR_RED" "$COLOR_RESET" "$1" >&2
}

die() {
  log_error "$1"
  exit 1
}

trim_trailing_slash() {
  local value="$1"
  while [ -n "$value" ] && [ "${value%/}" != "$value" ]; do
    value="${value%/}"
  done
  printf '%s' "$value"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

require_arg() {
  local flag="$1"
  local value="${2-}"
  if [ -z "$value" ]; then
    die "Missing value for $flag"
  fi
}

usage() {
  cat <<EOF
Blue/green deploy for GPT Image Playground on gptch.cloud/image

Usage:
  $SCRIPT_NAME [options]

Behavior:
  - Builds a linux/amd64 image locally by default from clean HEAD
  - Transfers it to the remote host over ssh
  - Replaces the inactive color first on loopback port 3200 or 3201
  - Switches only the dedicated /image nginx snippet
  - Preserves old containers as *-pre-deploy-* rollback snapshots

Options:
  --image-tag <tag>             Override the image tag.
                                Default: image:codex-<timestamp>
  --skip-build                  Skip local build and deploy an existing local image tag.
                                Requires --image-tag.
  --build-source <head|worktree>
                                Build from committed HEAD snapshot or the current worktree.
                                Default: head
  --allow-dirty-worktree        Allow --build-source worktree when git status is dirty.
  --remote <ssh-alias>          Remote SSH alias.
                                Default: $DEFAULT_REMOTE_ALIAS
  --remote-env-file <path>      Remote env file path.
                                Default: $DEFAULT_REMOTE_ENV_FILE
  --nginx-site <path>           Remote nginx site file.
                                Default: $DEFAULT_NGINX_SITE
  --nginx-snippet <path>        Remote nginx snippet file.
                                Default: $DEFAULT_NGINX_SNIPPET
  --public-url <url>            Public URL used for verification.
                                Default: $DEFAULT_PUBLIC_URL
  -h, --help                    Show this help.

Examples:
  $SCRIPT_NAME
  $SCRIPT_NAME --skip-build --image-tag image:codex-20260612183000
  $SCRIPT_NAME --build-source worktree --allow-dirty-worktree
EOF
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --image-tag)
        require_arg "$1" "${2-}"
        IMAGE_TAG="$2"
        shift 2
        ;;
      --skip-build)
        SKIP_BUILD=1
        shift
        ;;
      --build-source)
        require_arg "$1" "${2-}"
        case "$2" in
          head|worktree)
            BUILD_SOURCE="$2"
            ;;
          *)
            die "Unsupported build source: $2"
            ;;
        esac
        shift 2
        ;;
      --allow-dirty-worktree)
        ALLOW_DIRTY_WORKTREE=1
        shift
        ;;
      --remote)
        require_arg "$1" "${2-}"
        REMOTE_ALIAS="$2"
        shift 2
        ;;
      --remote-env-file)
        require_arg "$1" "${2-}"
        REMOTE_ENV_FILE="$2"
        shift 2
        ;;
      --nginx-site)
        require_arg "$1" "${2-}"
        NGINX_SITE="$2"
        shift 2
        ;;
      --nginx-snippet)
        require_arg "$1" "${2-}"
        NGINX_SNIPPET="$2"
        shift 2
        ;;
      --public-url)
        require_arg "$1" "${2-}"
        PUBLIC_URL="$2"
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "Unknown argument: $1"
        ;;
    esac
  done

  PUBLIC_URL="$(trim_trailing_slash "$PUBLIC_URL")/"

  if [ "$SKIP_BUILD" -eq 1 ] && [ -z "$IMAGE_TAG" ]; then
    die "--skip-build requires --image-tag"
  fi

  if [ -z "$IMAGE_TAG" ]; then
    IMAGE_TAG="image:codex-$(date +%Y%m%d%H%M%S)"
  fi
}

git_worktree_dirty() {
  [ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]
}

check_local_state() {
  log_info "Local git state:"
  git -C "$REPO_ROOT" status --short --branch

  if git_worktree_dirty; then
    if [ "$BUILD_SOURCE" = "head" ]; then
      log_warn "Worktree is dirty. This deploy will build from committed HEAD and exclude uncommitted local changes."
    elif [ "$ALLOW_DIRTY_WORKTREE" -eq 1 ]; then
      log_warn "Building from the current dirty worktree because --allow-dirty-worktree was provided."
    else
      die "Worktree is dirty. Commit the intended changes first, or re-run with --allow-dirty-worktree to deploy the current worktree on purpose."
    fi
  fi
}

prepare_build_context() {
  if [ "$SKIP_BUILD" -eq 1 ]; then
    return
  fi

  if [ "$BUILD_SOURCE" = "head" ]; then
    TEMP_BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/image-deploy-XXXXXX")"
    git -C "$REPO_ROOT" archive HEAD | tar -x -C "$TEMP_BUILD_DIR"
    BUILD_CONTEXT="$TEMP_BUILD_DIR"
    log_info "Prepared clean HEAD build context: $BUILD_CONTEXT"
    return
  fi

  BUILD_CONTEXT="$REPO_ROOT"
}

build_image() {
  if [ "$SKIP_BUILD" -eq 1 ]; then
    log_info "Skipping build; verifying existing local image $IMAGE_TAG"
    docker image inspect "$IMAGE_TAG" >/dev/null
  else
    log_info "Building linux/amd64 image $IMAGE_TAG"
    (
      cd "$BUILD_CONTEXT"
      docker buildx build --platform linux/amd64 -f deploy/Dockerfile -t "$IMAGE_TAG" --load .
    )
  fi

  local inspect_output
  inspect_output="$(docker image inspect "$IMAGE_TAG" --format 'id={{.Id}} os={{.Os}} arch={{.Architecture}}')"
  printf '%s\n' "$inspect_output"

  case "$inspect_output" in
    *"os=linux arch=amd64"*)
      ;;
    *)
      die "Image $IMAGE_TAG is not linux/amd64"
      ;;
  esac
}

transfer_image() {
  log_info "Transferring image $IMAGE_TAG to $REMOTE_ALIAS"
  docker save "$IMAGE_TAG" | ssh "$REMOTE_ALIAS" 'docker load'
}

ensure_remote_deploy_dir() {
  local remote_dir
  remote_dir="$(dirname "$REMOTE_ENV_FILE")"
  log_info "Ensuring remote deploy directory exists: $REMOTE_ALIAS:$remote_dir"
  ssh "$REMOTE_ALIAS" "install -d -m 700 '$remote_dir'"
}

remote_exec() {
  local subcommand="$1"
  shift

  ssh "$REMOTE_ALIAS" bash -s -- \
    "$subcommand" \
    "$REMOTE_ENV_FILE" \
    "$NGINX_SITE" \
    "$NGINX_SNIPPET" \
    "$PUBLIC_URL" \
    "$@" <<'REMOTE'
set -euo pipefail

subcommand="$1"
shift
env_file="$1"
shift
nginx_site="$1"
shift
nginx_snippet="$1"
shift
public_url="$1"
shift

deploy_root_dir="$(dirname "$env_file")"

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'missing command: %s\n' "$1" >&2
    exit 1
  }
}

require_file() {
  local path="$1"
  [ -f "$path" ] || {
    printf 'missing file: %s\n' "$path" >&2
    exit 1
  }
}

ensure_common_prereqs() {
  require_command docker
  require_command curl
  require_command python3
  require_command nginx
  require_command systemctl
  install -d -m 700 "$deploy_root_dir"
  install -d -m 755 "$(dirname "$nginx_snippet")"
}

load_env_file() {
  require_file "$env_file"
  set -a
  # shellcheck disable=SC1090
  . "$env_file"
  set +a
}

set_env_value() {
  local key="$1"
  local value="$2"

  python3 - "$env_file" "$key" "$value" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
key = sys.argv[2]
value = sys.argv[3]
needle = f"{key}="
lines = path.read_text().splitlines()
updated = []
replaced = False

for line in lines:
    if line.startswith(needle):
        updated.append(f"{key}={value}")
        replaced = True
    else:
        updated.append(line)

if not replaced:
    updated.append(f"{key}={value}")

path.write_text("\n".join(updated) + "\n")
PY
}

current_active_port() {
  if [ ! -f "$nginx_snippet" ]; then
    return 1
  fi

  local line
  line="$(grep -Eo 'proxy_pass http://127\.0\.0\.1:[0-9]+/' "$nginx_snippet" | head -n 1 || true)"
  case "$line" in
    *":3200/"*)
      printf '3200\n'
      ;;
    *":3201/"*)
      printf '3201\n'
      ;;
    *)
      return 1
      ;;
  esac
}

next_backup_name() {
  local container_name="$1"
  local stamp suffix candidate
  stamp="$(date +%Y%m%d%H%M%S)"
  suffix=0
  while true; do
    if [ "$suffix" -eq 0 ]; then
      candidate="${container_name}-pre-deploy-${stamp}"
    else
      candidate="${container_name}-pre-deploy-${stamp}-${suffix}"
    fi
    if ! docker container inspect "$candidate" >/dev/null 2>&1; then
      printf '%s\n' "$candidate"
      return
    fi
    suffix=$((suffix + 1))
  done
}

stop_running_backups() {
  local container_name="$1"
  local backups backup

  backups="$(docker ps --format '{{.Names}}' | awk -v prefix="${container_name}-pre-deploy-" 'index($0, prefix) == 1 { print }')"
  if [ -z "$backups" ]; then
    return
  fi

  while IFS= read -r backup; do
    [ -n "$backup" ] || continue
    docker stop "$backup" >/dev/null 2>&1 || true
    printf 'stopped_backup=%s\n' "$backup"
  done <<EOF
$backups
EOF
}

replace_color() {
  local color="$1"
  local image="$2"
  local container_name port image_key restart_policy

  load_env_file

  case "$color" in
    blue)
      container_name="${BLUE_CONTAINER:-image-blue}"
      port="${BLUE_PORT:-3200}"
      image_key="APP_BLUE_IMAGE"
      restart_policy="${BLUE_RESTART_POLICY:-unless-stopped}"
      ;;
    green)
      container_name="${GREEN_CONTAINER:-image-green-amd64}"
      port="${GREEN_PORT:-3201}"
      image_key="APP_GREEN_IMAGE"
      restart_policy="${GREEN_RESTART_POLICY:-unless-stopped}"
      ;;
    *)
      printf 'unsupported color: %s\n' "$color" >&2
      exit 1
      ;;
  esac

  set_env_value "$image_key" "$image"

  stop_running_backups "$container_name"

  if docker container inspect "$container_name" >/dev/null 2>&1; then
    docker stop "$container_name" >/dev/null 2>&1 || true
    docker rename "$container_name" "$(next_backup_name "$container_name")"
  fi

  if docker container inspect "$container_name" >/dev/null 2>&1; then
    printf 'container name still occupied after backup rename: %s\n' "$container_name" >&2
    exit 1
  fi

  if ! docker run -d \
    --name "$container_name" \
    --restart "$restart_policy" \
    -p "127.0.0.1:${port}:${PORT:-80}" \
    -e DEFAULT_API_URL="${DEFAULT_API_URL:-https://gptch.cloud/v1}" \
    -e ENABLE_API_PROXY="${ENABLE_API_PROXY:-false}" \
    -e LOCK_API_PROXY="${LOCK_API_PROXY:-false}" \
    -e HOST="${HOST:-0.0.0.0}" \
    -e PORT="${PORT:-80}" \
    --health-cmd 'wget -q -O - http://127.0.0.1/ >/dev/null || exit 1' \
    --health-interval 30s \
    --health-timeout 10s \
    --health-retries 3 \
    "$image" >/dev/null; then
    docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | grep -E '^image-(blue|green-amd64)' || true
    exit 1
  fi

  for _ in $(seq 1 30); do
    if curl -fsS --max-time 5 "http://127.0.0.1:${port}/" >/tmp/image-home.html \
      && curl -fsS --max-time 5 "http://127.0.0.1:${port}/manifest.webmanifest" >/dev/null \
      && curl -fsS --max-time 5 "http://127.0.0.1:${port}/sw.js" >/dev/null; then
      grep -qi 'GPT Image Playground' /tmp/image-home.html || {
        printf 'homepage did not contain expected title on port %s\n' "$port" >&2
        exit 1
      }
      docker inspect "$container_name" --format 'container={{.Name}} image={{.Config.Image}} status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}'
      printf 'color=%s port=%s healthy=true\n' "$color" "$port"
      rm -f /tmp/image-home.html
      return
    fi
    sleep 2
  done

  rm -f /tmp/image-home.html
  printf 'failed loopback verification for color=%s port=%s\n' "$color" "$port" >&2
  docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | grep -E '^image-(blue|green-amd64)' || true
  docker logs --tail 200 "$container_name" || true
  exit 1
}

write_nginx_snippet() {
  local target_port="$1"

  cat >"$nginx_snippet" <<EOF
location = /image {
    return 301 /image/;
}

location ^~ /image/ {
    proxy_pass http://127.0.0.1:${target_port}/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_redirect off;
}
EOF
}

ensure_nginx_include() {
  require_file "$nginx_site"

  python3 - "$nginx_site" "$nginx_snippet" <<'PY'
from pathlib import Path
import re
import sys

site = Path(sys.argv[1])
snippet = sys.argv[2]
include_line = f"    include {snippet};"
text = site.read_text()

if include_line in text:
    raise SystemExit(0)

pattern = re.compile(r"^(\s*location\s+/\s*\{)", re.MULTILINE)
match = pattern.search(text)
if not match:
    raise SystemExit("could not find root location block in nginx site")

insert_at = match.start(1)
text = text[:insert_at] + include_line + "\n" + text[insert_at:]
site.write_text(text)
PY
}

switch_nginx() {
  local target_port="$1"
  local site_backup snippet_backup snippet_exists public_check

  site_backup="$(mktemp)"
  cp -p "$nginx_site" "$site_backup"
  snippet_backup="$(mktemp)"
  snippet_exists=0

  if [ -f "$nginx_snippet" ]; then
    cp -p "$nginx_snippet" "$snippet_backup"
    snippet_exists=1
  fi

  restore_nginx() {
    cp -p "$site_backup" "$nginx_site"
    if [ "$snippet_exists" -eq 1 ]; then
      cp -p "$snippet_backup" "$nginx_snippet"
    else
      rm -f "$nginx_snippet"
    fi
    nginx -t >/dev/null
    systemctl reload nginx
  }

  write_nginx_snippet "$target_port"
  ensure_nginx_include

  if ! nginx -t >/dev/null; then
    restore_nginx
    printf 'nginx config test failed after switching /image snippet\n' >&2
    exit 1
  fi

  systemctl reload nginx

  public_check="$(curl -fsS --max-time 10 "$public_url" || true)"
  if ! printf '%s' "$public_check" | grep -qi 'GPT Image Playground'; then
    restore_nginx
    printf 'public verification failed for %s\n' "$public_url" >&2
    exit 1
  fi

  rm -f "$site_backup" "$snippet_backup"
  printf 'public_url=%s public_ok=true active_port=%s\n' "$public_url" "$target_port"
}

deploy() {
  local image_tag="$1"
  local active_port active_color target_color target_port

  ensure_common_prereqs
  load_env_file

  active_port=""
  if active_port="$(current_active_port 2>/dev/null)"; then
    :
  else
    active_port=""
  fi

  case "$active_port" in
    3200)
      active_color="blue"
      target_color="green"
      target_port="${GREEN_PORT:-3201}"
      ;;
    3201)
      active_color="green"
      target_color="blue"
      target_port="${BLUE_PORT:-3200}"
      ;;
    "")
      active_color="none"
      target_color="blue"
      target_port="${BLUE_PORT:-3200}"
      ;;
    *)
      printf 'unsupported active port in snippet: %s\n' "$active_port" >&2
      exit 1
      ;;
  esac

  printf 'active_color=%s target_color=%s target_port=%s image_tag=%s\n' \
    "$active_color" "$target_color" "$target_port" "$image_tag"

  replace_color "$target_color" "$image_tag"
  switch_nginx "$target_port"

  printf 'deploy_complete active_color=%s rollback_color=%s\n' "$target_color" "$active_color"
}

case "$subcommand" in
  deploy)
    ensure_common_prereqs
    deploy "$1"
    ;;
  *)
    printf 'unsupported remote subcommand: %s\n' "$subcommand" >&2
    exit 1
    ;;
esac
REMOTE
}

main() {
  parse_args "$@"

  require_command git
  require_command tar
  require_command docker
  require_command ssh

  check_local_state
  prepare_build_context
  build_image
  transfer_image
  ensure_remote_deploy_dir
  remote_exec deploy "$IMAGE_TAG"

  log_success "Deploy finished for $PUBLIC_URL with image $IMAGE_TAG"
}

main "$@"
