#!/usr/bin/env bash
set -euo pipefail
repo="${1:?usage: apply.sh <deepseek-harness-checkout>}"
here="$(cd "$(dirname "$0")" && pwd)"
if [ -s "$here/changes.patch" ]; then
  git -C "$repo" apply --check "$here/changes.patch"
  git -C "$repo" apply "$here/changes.patch"
fi
if [ -d "$here/new-files" ]; then
  (cd "$here/new-files" && tar cf - .) | (cd "$repo" && tar xf -)
fi
echo "applied git-typed-actions"
