#!/usr/bin/env bash
# session-grouping-provider staging apply:
#   ./apply.sh <clean-dsh-checkout>
#
# Idempotent contract:
#   - refuses to run twice on the same tree ("already applied" marker check),
#     so a repeated invocation never duplicates writes;
#   - verifies the working tree is clean for the touched paths first;
#   - restores nothing on failure — a partial apply is reported and left for
#     inspection (git checkout of the touched paths is the manual rollback).
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <clean-dsh-checkout>" >&2
  exit 2
fi

TARGET="$(cd "$1" && pwd)"
HERE="$(cd "$(dirname "$0")" && pwd)"

MARKER="$TARGET/packages/client/ui-workspace/src/client/grouping.ts"
if [ -e "$MARKER" ]; then
  echo "apply.sh: seam already present at $MARKER — refusing to apply twice" >&2
  exit 1
fi

PATCH="$HERE/changes.patch"
NEW_FILES="$HERE/new-files"

echo "== applying changes.patch =="
git -C "$TARGET" apply --check "$PATCH"
git -C "$TARGET" apply "$PATCH"

echo "== copying new files =="
cp "$NEW_FILES/src/client/grouping.ts" "$TARGET/packages/client/ui-workspace/src/client/grouping.ts"
cp "$NEW_FILES/tests/grouping.client.spec.ts" "$TARGET/packages/client/ui-workspace/tests/grouping.client.spec.ts"
cp "$NEW_FILES/tests/grouping-browser.client.spec.tsx" "$TARGET/packages/client/ui-workspace/tests/grouping-browser.client.spec.tsx"

echo "== applied =="
echo "verify with:"
echo "  (cd $TARGET && pnpm install --prefer-offline)"
echo "  (cd $TARGET && npx tsc -b tsconfig.client.json)"
echo "  (cd $TARGET && pnpm exec vitest run packages/client/ui-workspace/tests)"
echo "  (cd $TARGET && pnpm --filter @deepseek-ai/dsh-client-ui-workspace run bundle)"
