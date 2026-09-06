#!/usr/bin/env bash
set -euo pipefail

packet_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
target_dir="${1:-.}"
prerequisite_dir="$(cd -- "$packet_dir/../unified-multi-pane-workbench" && pwd)"
expected_base="$(cat "$prerequisite_dir/base.txt")"
actual_base="$(git -C "$target_dir" rev-parse HEAD)"

if [[ "$actual_base" != "$expected_base" ]]; then
  echo 'The checkout does not match the reviewed DSH release base.' >&2
  exit 1
fi

if ! git -C "$target_dir" apply --reverse --check "$prerequisite_dir/changes.patch"; then
  echo 'Apply upstream-prs/unified-multi-pane-workbench before this reference patch.' >&2
  exit 1
fi

while IFS= read -r -d '' source_file; do
  relative_file="${source_file#"$prerequisite_dir/new-files/"}"
  if [[ ! -f "$target_dir/$relative_file" ]] || ! cmp -s "$source_file" "$target_dir/$relative_file"; then
    echo "Unified-workbench prerequisite file is missing or changed: $relative_file" >&2
    exit 1
  fi
done < <(find "$prerequisite_dir/new-files" -type f -print0)

git -C "$target_dir" apply --check "$packet_dir/changes.patch"
git -C "$target_dir" apply "$packet_dir/changes.patch"
echo 'Composer multi-reference patch applied.'
