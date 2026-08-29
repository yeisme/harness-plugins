#!/usr/bin/env bash
# Archive the uncommitted dsh fork working-tree changes into upstream-prs/<slug>/
# patch series, so the fork submodule can be retired without losing work.
#
# Read-only against the fork: never resets, stashes, or rewrites the fork index.
# Re-run safe: each run regenerates <slug>/ contents from the current fork state.
set -euo pipefail

FORK="${FORK:-/workspaces/yeisme-agent/client/deepseek-harness}"
DEST="${DEST:-$(cd "$(dirname "$0")" && pwd)}"
ONLY="${ONLY:-}"
BASE_SHA="$(git -C "$FORK" rev-parse HEAD)"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Tracked (modified or staged) paths per theme. `git diff HEAD -- <paths>`
# captures both staged and unstaged state, including staged-new files.
TRACKED=(
  "login-token-auth|apps/cli/README.md apps/cli/src/args.ts apps/cli/src/bin.ts apps/cli/tests/args.spec.ts \
packages/bundle/web-app/README.md packages/bundle/web-app/cordis.patch.yml packages/bundle/web-app/src/index.ts \
packages/bundle/web-app/src/startup.ts packages/bundle/web-app/tests/startup.spec.ts \
packages/client/connection/README.md packages/client/connection/src/index.ts \
packages/client/connection/tests/node-half.host.spec.ts packages/client/connection/tsconfig.host.json"
  "pane-workspace-layout|packages/client/ui-conversation/src/client/chat/ChatNodeSeat.tsx \
packages/client/ui-conversation/src/client/chat/ChatView.tsx \
packages/client/ui-conversation/src/client/contract/slots.ts \
packages/client/ui-conversation/tests/chat-view.client.spec.tsx packages/client/ui-conversation/package.json \
packages/client/ui-layout/README.i18n.yaml packages/client/ui-layout/README.md packages/client/ui-layout/README.zh.md \
packages/client/ui-layout/package.json packages/client/ui-layout/src/client/AppFrame.module.css \
packages/client/ui-layout/src/client/AppFrame.tsx packages/client/ui-layout/src/client/index.ts \
packages/client/ui-layout/src/client/service.ts packages/client/ui-layout/src/client/stores.ts \
packages/client/ui-layout/tests/app-frame.client.spec.tsx packages/client/ui-layout/tests/apply.client.spec.ts \
packages/client/ui-layout/tests/layout-store.client.spec.ts packages/client/ui-layout/tests/service.client.spec.ts"
  "plan-dock|packages/client/ui-plan/README.i18n.yaml packages/client/ui-plan/README.md packages/client/ui-plan/README.zh.md \
packages/client/ui-plan/src/client/PlanDocumentPanel.module.css packages/client/ui-plan/src/client/PlanDocumentPanel.tsx \
packages/client/ui-plan/src/client/index.ts packages/client/ui-plan/src/client/locales.ts \
packages/client/ui-plan/tests/browser-plugin.client.spec.ts packages/client/ui-plan/tests/plan-document-panel.client.spec.tsx \
packages/plan/plan-mode/README.i18n.yaml packages/plan/plan-mode/README.md packages/plan/plan-mode/README.zh.md \
packages/plan/plan-mode/src/index.ts packages/plan/plan-mode/src/types.ts \
packages/plan/plan-mode/tests/integration.spec.ts packages/plan/plan-mode/tests/plan-mode.spec.ts \
packages/plan/plan-mode/tests/projection.spec.ts \
packages/client/ui-tool/tests/tool-call-tree.client.spec.tsx \
apps/web/tests/snapshots/lifecycle-chrome/command-menu.expected.md \
.agents/notes/implemented/feature/2026-08-19-plan-dock-inline-edit-and-visual-polish.md"
)

# Untracked source files per theme, copied verbatim into <slug>/new-files/.
UNTRACKED=(
  "login-token-auth|apps/cli/src/auth-store.ts apps/cli/src/auth.ts apps/cli/tests/auth-store.spec.ts \
packages/client/connection/src/token-auth.ts packages/client/connection/tests/token-auth.host.spec.ts \
.agents/notes/proposed/architecture/2026-08-19-dsh-login-token-remote-access.md"
  "pane-workspace-layout|packages/client/ui-layout/scripts/run-workspace-browser-evidence.mjs \
packages/client/ui-layout/src/client/workspace-geometry.ts packages/client/ui-layout/src/client/workspace-layout.ts \
packages/client/ui-layout/tests/workspace-geometry.client.spec.ts packages/client/ui-layout/tests/workspace-layout.client.spec.ts \
.agents/notes/implemented/feature/2026-08-20-dsh-pane-workspace-layout.md \
.agents/notes/implemented/feature/2026-08-20-dsh-pane-workspace-layout.zh.md \
.agents/notes/implemented/feature/2026-08-20-dsh-pane-workspace-layout.i18n.yaml"
  "plan-dock|packages/client/ui-plan/src/client/PlanFullscreen.module.css packages/client/ui-plan/src/client/PlanFullscreen.tsx \
packages/client/ui-plan/src/client/PlanPaneView.tsx packages/client/ui-plan/src/client/PlanSidebar.module.css \
packages/client/ui-plan/src/client/PlanSidebar.tsx packages/client/ui-plan/src/client/plan-view-store.ts \
packages/client/ui-plan/tests/plan-pane-view.client.spec.ts \
.agents/notes/proposed/feature/2026-08-19-plan-sidebar-fullscreen-m2.md \
.agents/notes/proposed/feature/2026-08-19-plan-sidebar-fullscreen-m2.zh.md \
.agents/notes/proposed/feature/2026-08-19-plan-sidebar-fullscreen-m2.i18n.yaml"
)

title_for() {
  case "$1" in
    login-token-auth) echo "dsh login token remote access (--token CLI auth + client token-auth + web-app wiring)" ;;
    pane-workspace-layout) echo "dsh Core Pane-only workspace layout (right/bottom docking, no legacy Details column)" ;;
    plan-dock) echo "dsh plan dock (PlanDocumentPanel/PlanSidebar/PlanFullscreen, plan-mode commands, command-menu snapshot)" ;;
    *) echo "$1" ;;
  esac
}

for entry in "${TRACKED[@]}"; do
  slug="${entry%%|*}"; paths="${entry#*|}"
  [ -n "$ONLY" ] && [ "$slug" != "$ONLY" ] && continue
  dir="$DEST/$slug"
  mkdir -p "$dir"
  # shellcheck disable=SC2086
  git -C "$FORK" diff --unified=0 HEAD -- $paths > "$dir/changes.patch"
  untracked_paths=""
  for u in "${UNTRACKED[@]}"; do
    [ "${u%%|*}" = "$slug" ] && untracked_paths="${u#*|}"
  done
  if [ -n "$untracked_paths" ]; then
    # shellcheck disable=SC2086
    (cd "$FORK" && tar cf - $untracked_paths) | (cd "$dir" && rm -rf new-files && mkdir new-files && tar xf - -C new-files)
  fi
  cat > "$dir/apply.sh" <<EOF
#!/usr/bin/env bash
# Apply this archived fork change onto a clean dsh checkout at base ${BASE_SHA:0:12}.
# Usage: ./apply.sh /path/to/deepseek-harness-checkout
set -euo pipefail
repo="\${1:?usage: apply.sh <deepseek-harness-checkout>}"
here="\$(cd "\$(dirname "\$0")" && pwd)"
git -C "\$repo" apply --check --unidiff-zero "\$here/changes.patch"
git -C "\$repo" apply --unidiff-zero "\$here/changes.patch"
if [ -d "\$here/new-files" ]; then
  (cd "\$here/new-files" && tar cf - .) | (cd "\$repo" && tar xf -)
fi
echo "applied $slug"
EOF
  chmod +x "$dir/apply.sh"
  {
    echo "# $slug"
    echo
    echo "$(title_for "$slug")"
    echo
    echo "- Archived: ${STAMP}"
    echo "- Base commit: \`${BASE_SHA}\` (deepseek-harness, dsh 0.1.0-rc.8 merge)"
    echo "- \`changes.patch\`: diff of tracked files (includes staged additions)."
    echo "- \`new-files/\`: untracked source files to copy in (apply.sh handles this)."
    echo "- Apply: \`./apply.sh <clean-checkout>\` then run the package tests listed below."
    echo
    echo "## Files"
    echo '```'
    # shellcheck disable=SC2086
    git -C "$FORK" diff --stat HEAD -- $paths | sed '$d'
    if [ -n "${untracked_paths:-}" ]; then
      echo "# untracked additions:"
      # shellcheck disable=SC2086
      (cd "$FORK" && find $untracked_paths -type f 2>/dev/null | sort)
    fi
    echo '```'
  } > "$dir/README.md"
  echo "archived $slug ($(wc -l < "$dir/changes.patch") patch lines)"
done

# Preserve the last complete evidence bundle unless a full archive refresh is requested.
if [ -z "$ONLY" ]; then
  mkdir -p "$DEST/pane-workspace-layout"
  tar czf "$DEST/pane-workspace-layout/evidence.tar.gz" -C "$FORK" \
    temp/dsh-pane-initial.png temp/dsh-pane-files-right.png temp/dsh-pane-details-priority.png \
    temp/dsh-pane-maximized.png temp/dsh-pane-picker.png temp/dsh-pane-terminal-bottom.png \
    temp/dsh-session-open.png temp/integration-test-runs
  echo "evidence bundle: $(du -sh "$DEST/pane-workspace-layout/evidence.tar.gz" | cut -f1)"
fi

[ -n "$ONLY" ] || echo "base-sha ${BASE_SHA}" > "$DEST/.archive-base"
echo "done"
