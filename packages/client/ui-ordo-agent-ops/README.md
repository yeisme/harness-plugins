# @yeisme/dsh-client-ui-ordo-agent-ops

English | [中文](README.zh.md)

Read-only compact Agent Ops sidebar contribution for DSH Web. The client module registers one `sidebar.footer.action` entry, reads the Host-owned `ordoAgentOps/snapshot` Remote, and renders a small status panel without importing Ordo or Workbench state.

The controller keeps one bounded in-flight read, resets its generation on connection reset or disposal, and ignores late answers from an older generation. It also tracks a snapshot-axis cursor over `snapshotRef`/`snapshotVersion`: duplicate versions are ignored idempotently, a ref rotation or version regression fails closed with a safe `owner_cursor_drift` error and no facts, and the next read reconciles by re-establishing the cursor from a fresh authoritative snapshot. The panel shows safe status, freshness, reason text, optional run/capacity summaries, and a disabled Workbench action until a re-authenticated deep-link contract exists. When the Host owner source is not mounted, the panel truthfully renders `needs_contract`.

## Model Experience

None, as this browser-only package registers no prompt, tool, model request, or session event.

#### KV Cache effect

None; the panel never assembles or sends model input.

## Known Limitations and Deferred Work

- **Snapshot-axis consumer only** — the cursor covers duplicate suppression, version/ref drift fail-close, and reconcile re-read over whole snapshots; Ordo event stream subscription, event-sequence gap detection, and action dispatch remain deferred to the owner event contract.
- **Owner contract required** — the fallback has no run, lease, worktree, capacity, or evidence facts; durable tenant authorization and Ordo projection mounting remain external owner work.
- **Workbench handoff deferred** — the button remains disabled until the platform provides a re-authenticated, context-bound deep-link contract.
- **No ToolView yet** — inspect, approval, reconcile, and evidence rendering remain a later DSH consumer slice.
