#!/usr/bin/env bash
# Apply this archived fork change onto a clean dsh checkout at base b150a551b8d4.
# Usage: ./apply.sh /path/to/deepseek-harness-checkout
set -euo pipefail
repo="${1:?usage: apply.sh <deepseek-harness-checkout>}"
here="$(cd "$(dirname "$0")" && pwd)"
git -C "$repo" apply --check --unidiff-zero "$here/changes.patch"
git -C "$repo" apply --unidiff-zero "$here/changes.patch"
if [ -d "$here/new-files" ]; then
  (cd "$here/new-files" && tar cf - .) | (cd "$repo" && tar xf -)
fi
echo "applied login-token-auth"
