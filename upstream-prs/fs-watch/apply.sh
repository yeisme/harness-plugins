#!/usr/bin/env bash
# Apply the fs-watch contract onto a DSH checkout.
# Usage: ./apply.sh /path/to/deepseek-harness-checkout
set -euo pipefail
repo="${1:?usage: apply.sh <deepseek-harness-checkout>}"
here="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$here/changes.patch" ] && [ -s "$here/changes.patch" ]; then
  git -C "$repo" apply --check "$here/changes.patch"
  git -C "$repo" apply "$here/changes.patch"
fi
if [ -d "$here/new-files" ]; then
  (cd "$here/new-files" && tar cf - .) | (cd "$repo" && tar xf -)
fi
echo "applied fs-watch contract skeleton"
