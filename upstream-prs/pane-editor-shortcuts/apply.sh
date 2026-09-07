#!/usr/bin/env bash
set -euo pipefail
packet_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
target_dir="${1:?Usage: bash upstream-prs/pane-editor-shortcuts/apply.sh <staging-checkout>}"
expected_base="$(cat "$packet_dir/../unified-multi-pane-workbench/base.txt")"
[[ "$(git -C "$target_dir" rev-parse HEAD)" == "$expected_base" ]] || { echo 'Unsupported DSH release base.' >&2; exit 1; }
if ! git -C "$target_dir" apply --unidiff-zero --reverse --check "$packet_dir/changes.patch" 2>/dev/null; then
  git -C "$target_dir" apply --unidiff-zero --check "$packet_dir/changes.patch"
  git -C "$target_dir" apply --unidiff-zero "$packet_dir/changes.patch"
fi
echo 'Editor-style pane shortcuts patch applied.'
