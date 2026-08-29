# @yeisme/dsh-session-cookie-manager

DSH login-state profile manager, Phase 1. Installable web bundle:

- Host face: no-op — cookie jar storage and apply/switch stay with DSH Host.
- Client face: ModuleLoader `{ apply }`. Missing Pane Workbench stays
  fail-closed (plugin loads, no throw, no fake slot). When `paneWorkbench`
  is present, `registerLoginProfilesPaneViews` mounts the metadata-only
  panel. No credential value ever reaches the browser; applying a real jar
  waits for the `web.cookieJars` upstream seam and fails visible meanwhile.

Design: root `openspec/changes/dsh-web-session-cookie-manager-v1/`.
Implementation: `openspec/changes/dsh-session-cookie-manager-plugin-v1/`.
