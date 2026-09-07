#!/usr/bin/env bash
set -euo pipefail
packet_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
target_dir="${1:?Usage: bash upstream-prs/pane-interaction-completion/apply.sh <staging-checkout>}"
expected_base="$(cat "$packet_dir/../unified-multi-pane-workbench/base.txt")"
if [[ "$(git -C "$target_dir" rev-parse HEAD)" != "$expected_base" ]]; then
  echo 'The checkout does not match the reviewed DSH release base.' >&2
  exit 1
fi
for file in packages/client/ui-layout/src/client/keyboard.ts packages/client/ui-layout/tests/keyboard.client.spec.ts; do
  if [[ -L "$target_dir/$file" ]] || { [[ -f "$target_dir/$file" ]] && ! cmp -s "$target_dir/$file" "$packet_dir/new-files/$file"; }; then
    echo "Preserve the modified staging file: $file" >&2
    exit 1
  fi
done
if ! git -C "$target_dir" apply --unidiff-zero --reverse --check "$packet_dir/changes.patch" 2>/dev/null; then
  git -C "$target_dir" apply --unidiff-zero --check "$packet_dir/changes.patch"
  git -C "$target_dir" apply --unidiff-zero "$packet_dir/changes.patch"
fi
for file in packages/client/ui-layout/src/client/keyboard.ts packages/client/ui-layout/tests/keyboard.client.spec.ts; do
  mkdir -p "$(dirname "$target_dir/$file")"
  cp "$packet_dir/new-files/$file" "$target_dir/$file"
done
echo 'Pane interaction patch applied.'
