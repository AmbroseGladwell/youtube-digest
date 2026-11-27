#!/bin/sh
# Kokoro on a Modal GPU (OV-423), run under overview-dev or overview-prod by `task deploy:tts:modal`:
# TTS_TOKEN becomes the Modal secret named after the app, the app is deployed, and a call without the
# token is checked to be refused. No value is printed (docs/features/tts-pre-rendered-speech.md).
set -eu
cd "$(dirname "$0")"
app="${OVERVIEW_TTS_APP:-overview-tts}"
[ -n "${TTS_TOKEN:-}" ] || { echo "this Bitwarden project has no TTS_TOKEN" >&2; exit 1; }
[ "${#TTS_TOKEN}" -ge 32 ] || { echo "TTS_TOKEN is shorter than 32 characters" >&2; exit 1; }
.venv/bin/modal secret create --force "$app" TTS_TOKEN="$TTS_TOKEN" > /dev/null
echo "Modal secret $app set"
OVERVIEW_TTS_APP="$app" .venv/bin/modal deploy modal_app.py
url="https://theoverviewapp--$app-speaker-web.modal.run"
status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 120 "$url/health")
[ "$status" = "401" ] || { echo "Expected $url to refuse a call without the token, got $status" >&2; exit 1; }
echo "$url refuses a call without the token"
