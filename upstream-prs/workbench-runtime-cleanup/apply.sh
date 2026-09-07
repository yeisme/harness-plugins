#!/usr/bin/env bash
set -euo pipefail
packet_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
target_dir="${1:?Usage: bash upstream-prs/workbench-runtime-cleanup/apply.sh <staging-checkout>}"
expected_base="$(cat "$packet_dir/../unified-multi-pane-workbench/base.txt")"
if [[ "$(git -C "$target_dir" rev-parse HEAD)" != "$expected_base" ]]; then
  echo 'The checkout does not match the reviewed DSH release base.' >&2
  exit 1
fi
if git -C "$target_dir" apply --unidiff-zero --reverse --check "$packet_dir/changes.patch" 2>/dev/null; then
  echo 'Workbench cleanup patch is already applied.'
  exit 0
fi
git -C "$target_dir" apply --unidiff-zero --check "$packet_dir/changes.patch"
git -C "$target_dir" apply --unidiff-zero "$packet_dir/changes.patch"
echo 'Workbench cleanup patch applied.'
