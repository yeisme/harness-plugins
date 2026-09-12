#!/usr/bin/env bash
set -euo pipefail
packet_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
target_dir="${1:-.}"
if git -C "$target_dir" apply --reverse --check "$packet_dir/changes.patch" 2>/dev/null; then
  echo 'Session catalog scope packet is already applied.'
  exit 0
fi
if [[ "$(git hash-object "$target_dir/packages/api/session-controller/src/types.ts")" != "715d778cecc4be0a4f2b6170b7f1494c95e7c442" ]]; then
  echo 'Session catalog source differs from the reviewed baseline.' >&2
  exit 1
fi
if [[ "$(git hash-object "$target_dir/packages/api/session-controller/src/tool-catalog.ts")" != "c89c49cccddb1216f3d84caef5ba4b57aab680d3" ]]; then
  echo 'Session catalog source differs from the reviewed baseline.' >&2
  exit 1
fi
if [[ "$(git hash-object "$target_dir/packages/api/session-controller/src/skill-catalog.ts")" != "e0bc7aad797e7631cd913b2d2df01846dcb0dfee" ]]; then
  echo 'Session catalog source differs from the reviewed baseline.' >&2
  exit 1
fi
git -C "$target_dir" apply --check "$packet_dir/changes.patch"
if [[ "${2:-}" == '--check' ]]; then exit 0; fi
git -C "$target_dir" apply "$packet_dir/changes.patch"
echo 'Session catalog scope packet applied.'
