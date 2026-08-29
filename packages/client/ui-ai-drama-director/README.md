# @yeisme/dsh-client-ui-ai-drama-director

AI Drama Director client for DeepSeek Harness. Implements the six current-episode operational panes plus the additive single-show control room.

## Panes

- **Context**: Current Show/Episode/Scene/Shot refs, readiness, primary blocker, next action
- **Review**: Next anomaly, compare, and owner decision surface
- **Run**: Ordo/Aigora attempt, cost/ETA, receipt/reconcile
- **Story**: Episode plan and structure projection
- **Visual**: Visual asset references and thumbnails
- **Audio**: Audio asset references and playback

The panes prefer the shared `CreatorStudioRuntimeV1`. If only the legacy
Creator remote exists, Director uses an explicit-refresh, read-only adapter and
does not create a second poller or retry mutations.

## Show control room

- **Show Board**: paged episodes, stage/status/attention filters, owner-gated context switch
- **Review Inbox**: cross-episode selection, compare, owner batch preview, selection-owner annotations
- **Asset Wall**: paged owner-safe assets and image/video/audio comparison
- **Delivery**: version difference, rights/evidence readiness, blockers, owner actions and receipt history

The controller is bound to one tenant/workspace/show context. Selection is
limited to 100 loaded targets and resets on filter, show, snapshot or runtime
generation changes. `stale`, `partial`, `gap`, `offline` and `unknown` states
disable mutation and never trigger an automatic retry.

## Commands

- `/drama`: Open command center with current context
- `/drama open`: Switch show/episode/scene/shot context
- `/drama plan`: Open Story/Plan projection
- `/drama review`: Locate next anomaly or decision
- `/drama evidence`: Open run/receipt/verification
- `/drama handoff`: Open in Workbench
- `/drama show`: Open Episode Board
- `/drama inbox`: Open Review Inbox
- `/drama assets`: Open Asset Wall
- `/drama delivery`: Open Delivery readiness

The existing `director` preset remains unchanged. The additive `show-control`
preset opens Show Board, Review Inbox, Run and Delivery; Asset Wall is on
demand. Workbench remains an optional high-density analysis handoff.

## License

MIT
