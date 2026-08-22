#!/usr/bin/env bash
# Upstream canary: verify this plugin workspace against a released dsh
# upstream without tracking it by hand.
#
# Subcommands:
#   resolve                     print the latest published @deepseek-ai/dsh version
#   install-smoke [version]     build bundles, install every bundle into a
#                               throwaway dsh profile via the released CLI
#   overrides-test [version]    run typecheck/test/build with every
#                               @deepseek-ai/* dependency forced to its latest
#                               published version (package.json is restored after)
#
# The GitHub Actions workflow calls the same subcommands, so a local run and a
# CI run exercise identical paths.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DSH_PACKAGE="@deepseek-ai/dsh"

resolve_latest() {
  npm view "$DSH_PACKAGE" dist-tags.latest 2>/dev/null | tr -d '[:space:]'
}

run_dsh() {
  local version="$1"; shift
  DSH_HOME="$CANARY_HOME" npm exec --yes --package="$DSH_PACKAGE@$version" -- dsh "$@"
}

install_smoke() {
  local version="${1:-$(resolve_latest)}"
  [ -n "$version" ] || { echo "canary: no published $DSH_PACKAGE found" >&2; exit 1; }
  echo "== canary install-smoke against $DSH_PACKAGE@$version =="
  (cd "$ROOT" && pnpm install --frozen-lockfile --prefer-offline && pnpm build)
  CANARY_HOME="$(mktemp -d)"
  trap 'rm -rf "$CANARY_HOME"' EXIT
  local failed=()
  for bundle in "$ROOT"/packages/bundle/*/; do
    [ -f "$bundle/cordis.patch.yml" ] || continue
    name="$(basename "$bundle")"
    echo "-- dsh plugin --profile canary add $name"
    if run_dsh "$version" plugin --profile canary add "$bundle"; then
      echo "   ok: $name"
    else
      echo "   FAIL: $name"
      failed+=("$name")
    fi
  done
  if [ "${#failed[@]}" -gt 0 ]; then
    echo "canary: bundle install failed: ${failed[*]}" >&2
    exit 1
  fi
  echo "canary: all bundles installed into throwaway profile (dsh $version)"
}

overrides_test() {
  local version="${1:-}"
  echo "== canary overrides-test =="
  local pkg="$ROOT/package.json"
  backup="$(mktemp)"
  cp "$pkg" "$backup"
  restore() { [ -n "${backup:-}" ] && cp "$backup" "$pkg" || true; }
  trap restore EXIT
  # Force every @deepseek-ai/* workspace dependency to its newest publish.
  node -e '
    const fs = require("node:fs");
    const path = process.argv[1];
    const forced = process.argv[2] || "";
    const pkg = JSON.parse(fs.readFileSync(path, "utf8"));
    pkg.pnpm = pkg.pnpm || {};
    pkg.pnpm.overrides = pkg.pnpm.overrides || {};
    for (const section of ["dependencies", "devDependencies", "peerDependencies"]) {
      for (const name of Object.keys(pkg[section] || {})) {
        if (name.startsWith("@deepseek-ai/")) pkg.pnpm.overrides[name] = forced || "latest";
      }
    }
    fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n");
  ' "$pkg" "$version"
  (cd "$ROOT" && pnpm install --no-frozen-lockfile)
  echo "-- resolved @deepseek-ai/* versions --"
  (cd "$ROOT" && pnpm list --depth -1 -r --json 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const p of JSON.parse(s))for(const[n,i]of Object.entries(p.dependencies||{}))if(n.startsWith("@deepseek-ai/"))console.log(`${n}@${i.version}`)})')
  (cd "$ROOT" && pnpm typecheck && pnpm test && pnpm build)
  echo "canary: gates green against latest published @deepseek-ai/*"
}

case "${1:-}" in
  resolve) resolve_latest ;;
  install-smoke) shift; install_smoke "$@" ;;
  overrides-test) shift; overrides_test "$@" ;;
  *)
    echo "usage: $0 {resolve|install-smoke [version]|overrides-test [version]}" >&2
    exit 2
    ;;
esac
