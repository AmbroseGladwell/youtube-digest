#!/bin/sh
# Production's speech-to-text app on Modal, run under overview-prod by `task deploy:stt`: its
# STT_TOKEN becomes the Modal secret `overview-stt-prod`, the app is deployed under that name, and
# a call without the token is checked to be refused. No value is printed
# (docs/features/speech-to-text.md, "Switching it on").
set -eu
cd "$(dirname "$0")"
[ -n "${STT_TOKEN:-}" ] || { echo "overview-prod has no STT_TOKEN" >&2; exit 1; }
[ "${#STT_TOKEN}" -ge 32 ] || { echo "overview-prod's STT_TOKEN is shorter than 32 characters" >&2; exit 1; }
[ -n "${MODAL_TOKEN_ID:-}" ] && [ -n "${MODAL_TOKEN_SECRET:-}" ] || {
  echo "overview-prod has no MODAL_TOKEN_ID and MODAL_TOKEN_SECRET (a Modal API token made for production)" >&2
  exit 1
}
.venv/bin/modal secret create --force overview-stt-prod STT_TOKEN="$STT_TOKEN" > /dev/null
echo "Modal secret overview-stt-prod set"
OVERVIEW_STT_APP=overview-stt-prod .venv/bin/modal deploy modal_app.py
url="https://theoverviewapp--overview-stt-prod-jobs.us-east.modal.run"
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$url/jobs" -H "content-type: application/json" -d '{}')
[ "$status" = "401" ] || { echo "Expected $url to refuse a call without the token, got $status" >&2; exit 1; }
echo "$url refuses a call without the token"
