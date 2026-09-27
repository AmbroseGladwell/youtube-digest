#!/usr/bin/env bash
# The four things anyone does with secrets here, each one bws call away
# (docs/conventions/secrets.md). Values never go through this script's output.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

PROJECT="${BWS_PROJECT:-overview-dev}"
KEYCHAIN_SERVICE="overview-bws"

projectId() {
  local id
  id="$(bws project list | jq -r --arg name "$PROJECT" '.[] | select(.name == $name) | .id')"
  if [ -z "$id" ]; then
    echo "No Bitwarden project named $PROJECT is visible to this access token. Create it with: task secrets:seed" >&2
    exit 1
  fi
  echo "$id"
}

case "${1:-}" in
  login)
    echo "Paste the machine access token from Bitwarden Secrets Manager (it is not echoed):"
    security add-generic-password -U -a "$USER" -s "$KEYCHAIN_SERVICE" -w
    echo "Stored in the login keychain as $KEYCHAIN_SERVICE. Re-enter the dev shell (direnv reload) to pick it up."
    ;;
  render)
    bws run --project-id "$(projectId)" -- node scripts/renderEnv.mjs .env.tpl .env
    echo "Rendered .env from .env.tpl. Per-machine values go in .env.local."
    ;;
  run)
    shift
    bws run --project-id "$(projectId)" -- "$@"
    ;;
  fly-import)
    # The rendered lines go straight down a pipe into fly secrets import: nothing is
    # written to disk, typed, or shown.
    bws run --project-id "$(projectId)" -- node scripts/renderEnv.mjs .env.prod.tpl - | fly secrets import
    ;;
  seed)
    if ! bws project list | jq -e --arg name "$PROJECT" '.[] | select(.name == $name)' > /dev/null; then
      bws project create "$PROJECT" > /dev/null
      echo "Created project $PROJECT"
    fi
    id="$(projectId)"
    existing="$(bws secret list "$id" | jq -r '.[].key')"
    keys="$(grep -v '^#' .env.tpl | grep -o '\${[A-Z0-9_]*}' | tr -d '${}'; grep -v '^#' scripts/sanityCheck.env | grep -v '^$')"
    for key in $keys; do
      if grep -qx "$key" <<< "$existing"; then
        echo "$key: already in $PROJECT"
        continue
      fi
      value="$(grep "^${key}=" .env 2> /dev/null | cut -d= -f2- || true)"
      if [ -z "$value" ]; then
        echo "$key: no value in .env, add it in Bitwarden yourself"
        continue
      fi
      bws secret create "$key" "$value" "$id" > /dev/null
      echo "$key: created from .env"
    done
    ;;
  *)
    echo "usage: scripts/secrets.sh login | render | run -- <command> | fly-import | seed" >&2
    exit 2
    ;;
esac
