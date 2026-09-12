#!/usr/bin/env bash
set -euo pipefail

packet_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
target_dir="${1:-.}"
expected_base="a66e4702047846cdaa10c66c9d3df3951f5ea70d"

if [[ "$(git -C "$target_dir" rev-parse HEAD)" != "$expected_base" ]]; then
  echo 'The checkout does not match the reviewed DSH release base.' >&2
  exit 1
fi
if git -C "$target_dir" apply --reverse --check "$packet_dir/changes.patch"; then
  echo 'Tools draft target packet is already applied.'
  exit 0
fi
git -C "$target_dir" apply --check "$packet_dir/changes.patch"
git -C "$target_dir" apply "$packet_dir/changes.patch"
echo 'Tools draft target packet applied.'
