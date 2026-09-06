#!/usr/bin/env bash
set -euo pipefail
packet_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
target_dir="${1:?Usage: apply.sh /path/to/staging-checkout}"
expected_base="$(cat "$packet_dir/base.txt")"
actual_base="$(git -C "$target_dir" rev-parse HEAD)"
if [[ "$actual_base" != "$expected_base" ]]; then
  echo 'The checkout does not match the reviewed DSH release base.' >&2
  exit 1
fi
git -C "$target_dir" apply --check "$packet_dir/changes.patch"
while IFS= read -r -d '' source_file; do
  relative_file="${source_file#"$packet_dir/new-files/"}"
  if [[ -e "$target_dir/$relative_file" ]]; then
    echo "Refusing to replace existing file: $relative_file" >&2
    exit 1
  fi
done < <(find "$packet_dir/new-files" -type f -print0)
git -C "$target_dir" apply "$packet_dir/changes.patch"
cp -R "$packet_dir/new-files/." "$target_dir/"
echo 'Unified workspace patch applied. Build the staged host before launching it.'
