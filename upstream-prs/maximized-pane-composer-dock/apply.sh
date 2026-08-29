#!/usr/bin/env bash
set -euo pipefail
repo="${1:?usage: apply.sh <deepseek-harness-checkout>}"
here="$(cd "$(dirname "$0")" && pwd)"
git -C "$repo" apply --check "$here/changes.patch"
git -C "$repo" apply "$here/changes.patch"
echo "applied maximized-pane-composer-dock"
