#!/usr/bin/env bash
set -euo pipefail
packet_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
target_dir="${1:-.}"
(cd "$target_dir" && sha256sum -c "$packet_dir/baseline.sha256")
git -C "$target_dir" apply --check "$packet_dir/changes.patch"
git -C "$target_dir" apply "$packet_dir/changes.patch"
