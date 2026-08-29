# DSH web pane experience tiers

English | [中文](dsh-web-pane-tiers.zh.md)

The pane experience on `dsh web` is tiered by which seams the installed DSH
provides. The tier is detected at runtime by Pane Workbench and shown in the
Workspace Capabilities view — nothing is silently dead.

| Tier | Requires | You get |
| --- | --- | --- |
| 0 | any published DSH | Full single-region workbench in the overlay host: real tabs (pin/preview/overflow/bulk close), in-region drag reorder, Quick Pick, menus, keyboard paths |
| 1 | `workspace.core-pane.v1` + `shell.workspace.right/bottom` | Full docking: split, cross-region move/drag, maximize, Workspace Designer apply |
| 2 | Tier 1 + TerminalHostV2 + PreviewResourceV1 + official Artifact seam | Real PTY terminals, production previews, official artifact handoff |

Rules that hold on every tier:

- Missing seams degrade honestly: the entry stays visible, disabled, with a
  reason and an unlock pointer. No fake host, no polling fallback.
- Layout persistence is canonical: a Tier 1 layout survives a Tier 0 session
  round-trip; overlay collapse is render-only.
- Tier state is recomputed every session and re-detected on hot plug; it is
  never persisted.

## AI Drama Director on Tier 0

1. Install the bundle: `dsh plugin add` with the `dsh-ai-drama-director` line.
2. Type `/drama` in the command directory. Commands are contributed as
   `PaneCommandDescriptor` with `slash.name: 'drama'`; if the command
   experience is absent, the group stays disabled with a reason and the panes
   still work.
3. `/drama open` picks a show; the Director preset applies as an ordered tab
   set in the single region (Context / Review / Run; Story / Visual / Audio on
   demand from Quick Pick).
4. Review/repair run through typed owner actions with admission; denied means
   disabled with the owner reason.
5. "Open in Workbench" uses a host-approved, expiring handoff. Bridge V2
   opens the Workbench `/agent` Creative Production, Review, or Evidence lens;
   the Workbench server reauthorizes the principal and re-fetches owner data.
   Legacy consumers remain explicitly labelled during the compatibility window.

## Troubleshooting

- An entry is disabled: open Workspace Capabilities, find the row, read the
  reason and the unlock anchor.
- `contract_mismatch` means the seam exists but is incomplete (for example a
  partial `workspaceLayout`); upgrading DSH is the unlock.
- Split/dock controls are visible but disabled on Tier 0 by design; they
  unlock when the workspace docking seam ships.

## Terminals and side chat today

The tier table above still describes the *xterm raw-VT* terminal as Tier 2.
Two panes are available sooner: the line-oriented terminal console (DSH
0.1.1-rc.2+ via the official `ctx.terminals` capability) and the side chat
(any published release). See [terminal and side chat](dsh-web-pane-terminal-sidechat.md).
