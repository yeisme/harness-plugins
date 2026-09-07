# Spatial Board Asset Orchestration UI Slice

## Scope

This clean-room UI slice adds an Infinite Canvas-style interaction vocabulary to the existing `@xyflow/react` Board without importing upstream source, styles, or assets. It composes Workbench typed refs only; it is not a media editor, generator, or owner client.

## Data boundary

1. Asset Library writes only `application/x-yeisme-workbench-asset-ref+json` containing exactly `{assetRef, sourceVersion}`.
2. Board parses that closed payload, re-reads the Asset in the active tenant/workspace, and rejects scope/version/status/freshness/rights/capability failures.
3. A valid placement calls existing `CreateNode` with `targetType: "asset"`, a fixed safe geometry, current Board revision, and a new idempotency key.
4. The Board refreshes its authoritative viewport after receipt or failure; it does not optimistically append an Asset node.

No transfer or Board state contains title/body, prompt, bytes, private path, arbitrary URL, credential, or Owner payload.

## Interaction and access

- Toolbar: zoom in/out, fit view, selection mode, undo/redo, connect, and group.
- Board: pan, lasso/multi-select, connect, node drag, right-click menu, and a minimap.
- Keyboard: arrows move the focused node, `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+G`, Delete/Backspace, `Shift+F10`, and Escape all have safe equivalent actions or focus restore.
- Asset add is available as drag/drop and an explicit picker action. If the consumer capability is unavailable, the UI remains disabled with `needs_contract` semantics.

## Scaena seam

The Inspector may call an injected host bridge only with a matching `OwnerDeepLinkV1` issued for `ownerId="scaena"`, `resourceKind="asset"`, `view="studio"`, the selected safe ref, and active workspace. The Board does not turn that descriptor into a URL and does not send any generation command. Missing/invalid descriptor or missing bridge is a safe `needs_contract` state.

## Verification target

Component coverage proves payload closure, receipt-backed insertion, conflict/no-ghost behavior, tombstone rejection, keyboard context/focus restore, and descriptor/bridge gating. Browser coverage proves toolbar/context/menu, mobile/reduced-motion/Axe behavior, and the route-level unavailable-contract fallback.
