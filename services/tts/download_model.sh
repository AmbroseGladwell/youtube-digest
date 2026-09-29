#!/usr/bin/env bash
# Fetches Kokoro v1.0 from the kokoro-onnx GitHub release into the given directory and
# refuses anything whose SHA-256 differs (docs/conventions/tts-testing-guide.md).
set -euo pipefail

dir="${1:-models}"
release="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
mkdir -p "$dir"

sha256() {
  if command -v sha256sum > /dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1
}

fetch() {
  local file="$1" expected="$2"
  if [ -f "$dir/$file" ] && [ "$(sha256 "$dir/$file")" = "$expected" ]; then
    return
  fi
  curl -fsSL -o "$dir/$file.part" "$release/$file"
  if [ "$(sha256 "$dir/$file.part")" != "$expected" ]; then
    rm -f "$dir/$file.part"
    echo "$file does not match its pinned SHA-256" >&2
    exit 1
  fi
  mv "$dir/$file.part" "$dir/$file"
}

fetch kokoro-v1.0.onnx 7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5
fetch voices-v1.0.bin bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d
