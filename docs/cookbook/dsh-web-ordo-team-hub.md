# Using the DSH Web Ordo Team Hub

[English](dsh-web-ordo-team-hub.md) | [中文](dsh-web-ordo-team-hub.zh.md)

> Status: the V1 contract is specified, but the bundle implementation is pending. The current Ordo Agent Ops pane remains the fallback.

## 1. Check the assembled profile

Inspect the real DSH Web composition:

```bash
dsh --profile web --dump-config
```

The Team V1 entry must appear only when the Host and Ordo advertise compatible `team_collaboration.v1` capabilities. A missing capability must render an unavailable reason instead of a dead button.

## 2. Open the Agents Hub

Use the existing Agents icon. The Hub keeps two explicit views:

- `Session Agents` for the current DSH session descendants.
- `Ordo Teams` for Ordo Delivery tasks, role slots, Room, Activity, control, and receipts.

The browser never connects to the Ordo broker or launches a CLI process. The Harness Host loads the authoritative snapshot, validates events, and proxies server-authored actions.

## 3. Run the golden Delivery journey

After the Ordo Team V1 commands are implemented, inspect a Delivery before opening Web:

```bash
ordo team delivery show <delivery-id> --json
ordo team delivery watch <delivery-id> --events
```

In the Hub:

1. Select the Delivery and a blocked or active task.
2. Confirm that Task Queue, graph, and Inspector use the same task and role refs.
3. Open Room, post or reply explicitly, and promote only through an available typed action.
4. If another surface holds control, use `Take Control` and review the current holder, revision, and effect.
5. Submit handoff, candidate, or acceptance actions only after the owner preview is current.
6. Treat the Delivery as complete only after an accepted receipt and integration facts appear.

The Hub does not expose target-branch merge, push, or deploy actions.

## 4. Interpret maturity and control

- `experimental_fixture`: contract/UI fixture only.
- `fake_runtime`: simulated attempts; an eight-writer fixture is not live qualification.
- `qualified_live`: Ordo has current runtime and fanout evidence.
- `unavailable`: the owner contract or Host seam is missing or incompatible.

`Read only · TUI has control` means Web can inspect everything but cannot submit mutations. Surface control does not replace writer leases, approvals, verification, or runtime qualification.

## 5. Recover from degraded states

| State | Expected behavior |
| --- | --- |
| `stale` / `offline` | Keep trusted facts read-only and reconnect or reload the snapshot. |
| `cursor_expired` / `event_gap` | Stop applying deltas and load a new snapshot. |
| `lost_control` | Close stale confirmations and offer server-authored Take Control. |
| `approval_required` | Show the preview and exact approval action; never self-approve. |
| `unknown` / `reconcile_required` | Disable retry, replacement writers, and lease release. |
| `contract_mismatch` | Disable Team V1 and use the legacy fallback when available. |

## 6. Verify the plugin repository

Run from `agent/harness-plugins`:

```bash
openspec validate dsh-web-ordo-team-hub-v1 --strict --no-interactive
pnpm run doc-sync
pnpm run typecheck
pnpm run test
pnpm run test:visual
pnpm run check:bundles
pnpm run check:surfaces
pnpm run build
```

Integration evidence belongs in `temp/integration-test-runs/<run-id>/` and must redact tokens, prompts, provider payloads, private tool arguments, absolute paths, and full reasoning.

## 7. Roll back

Disable the Team V1 capability or view registration. Keep Session Agents and the legacy Ordo Agent Ops pane enabled. No browser-side domain migration or cleanup is required.

