#!/usr/bin/env bash
set -euo pipefail
packet_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
target_dir="${1:?Usage: bash upstream-prs/tools-pane-layout-v1/apply.sh <staging-checkout>}"
expected_base="$(cat "$packet_dir/../unified-multi-pane-workbench/base.txt")"
if [[ "$(git -C "$target_dir" rev-parse HEAD)" != "$expected_base" ]]; then
  echo 'The checkout does not match the reviewed DSH release base.' >&2
  exit 1
fi
test_file='apps/web/tests/tools-discovery-draft.e2e.ts'
if [[ -L "$target_dir/$test_file" ]] || { [[ -f "$target_dir/$test_file" ]] && ! cmp -s "$target_dir/$test_file" "$packet_dir/new-files/$test_file"; }; then
  echo 'Preserve the changed staging Tools acceptance test.' >&2
  exit 1
fi
if ! git -C "$target_dir" apply --reverse --check "$packet_dir/changes.patch" 2>/dev/null; then
  git -C "$target_dir" apply --check "$packet_dir/changes.patch"
  git -C "$target_dir" apply "$packet_dir/changes.patch"
fi
mkdir -p "$target_dir/apps/web/tests"
cp "$packet_dir/new-files/$test_file" "$target_dir/$test_file"
echo 'Tools Pane layout patch applied.'
