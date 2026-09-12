#!/usr/bin/env bash
set -euo pipefail
packet_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
target_dir="${1:-.}"
source_file="$target_dir/packages/skill/skill/src/index.ts"
expected_blob="0e730a712929ce5547173892e5148b7a4e8b90fa"
if git -C "$target_dir" apply --reverse --check "$packet_dir/changes.patch" 2>/dev/null; then
  echo 'Skill document reader packet is already applied.'
  exit 0
fi
if [[ "$(git hash-object "$source_file")" != "$expected_blob" ]]; then
  echo 'Skills source differs from the reviewed baseline.' >&2
  exit 1
fi
git -C "$target_dir" apply --check "$packet_dir/changes.patch"
if [[ "${2:-}" == '--check' ]]; then exit 0; fi
git -C "$target_dir" apply "$packet_dir/changes.patch"
echo 'Skill document reader packet applied.'
