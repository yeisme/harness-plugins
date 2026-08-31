# @yeisme/dsh-browser-pane

Experimental **Browser Pane** bundle (v0.1 rc) — an Agent-collaboration
browser surface for DSH: the agent drives pages, you observe a live viewport,
and an exclusive human-takeover lease pauses agent input while you operate.

> **Status: experimental v0.1** — contracts, safe projections, a
> deterministic fake provider, and conformance are frozen. No real browser
> runtime is wired; see *Privacy & external owner* below.

## Install

```bash
pnpm add @yeisme/dsh-browser-pane
```

The bundle is optional and independent. It registers only when a compatible
`BrowserAutomationProviderV1` probes successfully; otherwise the entry stays
honest (`needs_contract` / `unavailable`) and renders no live controls.

## Capability states

| State | Meaning |
|---|---|
| `live` | provider probed; pages, viewport, and actions are active |
| `search_only` | provider caps the surface to search handoff |
| `needs_contract` | no provider or contract drift — nothing renders live |
| `unavailable` | provider probe failed or reported zero sessions |
| `stale` / `reconciling` | transient read-only states during event gaps |

## Agent / human control

Control is an **exclusive lease**. `browser.control.takeover` arms a pending
request; only the owner's grant flips it to `human` (with an expiry), which
pauses agent input at the owner boundary. Local input flows only while the
human lease is granted; release/expiry/denial returns control to the agent.
There is no dual control, no input replay, and no optimistic flips.

## Limitations

- No real browser process, page rendering, network, downloads, or credential
  handling — those belong to the future automation owner (separate OpenSpec).
- The viewport streams only through a locally injected
  `BrowserViewportTransportV1`; the pane never fetches media itself.
- Navigation drafts are ephemeral: the full target lives only in the pending
  draft and the single action request.

## Troubleshooting

| Symptom | Cause / action |
|---|---|
| Pane shows `needs_contract` | no provider in the Cordis context — check `dsh.browserPaneHost` |
| `unavailable` after probe | provider threw or found zero sessions |
| Viewport blank | no viewport transport injected — check `dsh.browserViewportTransport` |
| Input ignored | the human control lease is not granted |

## Rollback

Remove or disable the bundle — the pane simply stops registering; no owner
data is deleted. Removing a provider adapter returns the pane to
`needs_contract`.

## Privacy boundaries

- Safe projections carry opaque refs, bounded summaries, statuses, reason
  codes, versions, freshness, and safe locations (protocol + host only).
- Never present: cookies, headers, Authorization, tokens, credentials, raw or
  signed URLs, userinfo, absolute paths, raw DOM/screenshot/download bytes,
  raw prompts, provider payloads, private arguments, or reasoning text.
- Full navigation targets never enter projections, restore state, receipts,
  logs, telemetry, or evidence.
