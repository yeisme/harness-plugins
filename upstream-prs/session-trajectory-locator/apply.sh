#!/bin/bash
# Placeholder script for applying upstream changes if needed

set -e

echo "session-trajectory-locator - Upstream Seam Apply Script"
echo "========================================================"
echo ""
echo "Status: PROPOSAL (no changes.patch yet)"
echo ""
echo "This entry is a seam request for locating a session/request/event ref"
echo "inside the official session-pane trajectory UI. The patch will be"
echo "authored in a staging worktree once the contract is confirmed."
echo ""
echo "Usage: ./apply.sh <path-to-deepseek-harness>"
echo ""

if [ -z "$1" ]; then
  echo "Error: Please provide path to deepseek-harness repository"
  echo "Example: ./apply.sh ../deepseek-harness"
  exit 1
fi

DSH_PATH="$1"

if [ ! -d "$DSH_PATH" ]; then
  echo "Error: Directory not found: $DSH_PATH"
  exit 1
fi

echo "DeepSeek Harness path: $DSH_PATH"
echo ""
echo "Next steps:"
echo "1. Confirm the trajectory locator contract with the official session renderer owner"
echo "2. Implement changes.patch + new-files/ in a staging worktree on pr/session-trajectory-locator"
echo "3. Re-run this script to apply changes"
