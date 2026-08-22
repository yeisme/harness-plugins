#!/usr/bin/env bash
# Apply this archived fork change onto a clean dsh checkout at base 141eb6fef834.
# Usage: ./apply.sh /path/to/deepseek-harness-checkout
set -euo pipefail
repo="${1:?usage: apply.sh <deepseek-harness-checkout>}"
git -C "$repo" apply --check "$(dirname "$0")/changes.patch"
git -C "$repo" apply "$(dirname "$0")/changes.patch"
if [ -d "$(dirname "$0")/new-files" ]; then
  (cd "$(dirname "$0")/new-files" && tar cf - .) | (cd "$repo" && tar xf -)
fi
echo "applied pane-workspace-layout"
