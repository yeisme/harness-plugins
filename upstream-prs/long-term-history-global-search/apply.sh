#!/bin/bash
# Apply the long-term-history-global-search note series onto a deepseek-harness checkout.
# Notes-only series: no source patch, only .agents/notes/proposed additions.
set -e

if [ -z "$1" ]; then
  echo "Usage: ./apply.sh <path-to-deepseek-harness>"
  exit 1
fi
DSH_PATH="$1"
[ -d "$DSH_PATH" ] || { echo "Error: Directory not found: $DSH_PATH"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cp -v "$SCRIPT_DIR"/.agents/notes/proposed/architecture/*.md "$DSH_PATH/.agents/notes/proposed/architecture/"
cp -v "$SCRIPT_DIR"/.agents/notes/proposed/feature/*.md "$DSH_PATH/.agents/notes/proposed/feature/"
echo "Applied. Verify with: pnpm run verify-agent-note-format && pnpm run verify-translation-pairing && pnpm run verify-md-wrap"
