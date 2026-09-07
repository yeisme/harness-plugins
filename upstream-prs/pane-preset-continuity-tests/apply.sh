#!/usr/bin/env bash
set -euo pipefail
packet_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
target_dir="${1:?usage: apply.sh <deepseek-harness-checkout> [--check]}"
mode="${2:-apply}"
if [[ "$mode" != apply && "$mode" != --check ]]; then
  echo 'Unsupported mode; use --check for validation only.' >&2
  exit 1
fi
expected_base=a66e4702047846cdaa10c66c9d3df3951f5ea70d
if [[ "$(git -C "$target_dir" rev-parse HEAD)" != "$expected_base" ]]; then
  echo 'The checkout does not match the reviewed DSH release base.' >&2
  exit 1
fi
for file in workspace-model.ts workspace-service.ts; do
  relative="packages/client/ui-layout/src/client/$file"
  if ! cmp -s "$packet_dir/../unified-multi-pane-workbench/new-files/$relative" "$target_dir/$relative"; then
    echo "Apply the reviewed unified-multi-pane-workbench prerequisite first: $relative" >&2
    exit 1
  fi
done
relative=packages/client/ui-layout/tests/preset-continuity.client.spec.ts
source_file="$packet_dir/new-files/$relative"
target_file="$target_dir/$relative"
for directory in packages packages/client packages/client/ui-layout packages/client/ui-layout/tests; do
  if [[ -L "$target_dir/$directory" ]]; then
    echo "Refusing a symlinked destination directory: $directory" >&2
    exit 1
  fi
done
if [[ -L "$target_file" ]] || { [[ -e "$target_file" ]] && ! cmp -s "$source_file" "$target_file"; }; then
  echo "Refusing to replace a differing existing file: $relative" >&2
  exit 1
fi
if [[ "$mode" == --check ]]; then
  echo 'Preset continuity test packet checks passed.'
  exit 0
fi
if [[ ! -e "$target_file" ]]; then
  mkdir -p -- "$(dirname -- "$target_file")"
  (set -o noclobber; cat -- "$source_file" > "$target_file")
fi
echo 'Preset continuity tests applied; existing identical files preserved.'
