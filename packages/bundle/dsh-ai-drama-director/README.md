# @yeisme/dsh-ai-drama-director

AI Drama Director bundle for DeepSeek Harness. Provides typed `/drama` commands, Context/Story/Visual/Audio/Run/Review panes, and the default Director preset for show/episode/scene/shot context management and review.

## Installation

```bash
dsh plugin --profile web add @yeisme/dsh-ai-drama-director
```

Or from this checkout:

```bash
dsh plugin --profile web add ./packages/bundle/dsh-ai-drama-director
```

## Features

- **Typed Commands**: `/drama`, `/drama open`, `/drama plan`, `/drama review`, `/drama evidence`, `/drama handoff`
- **Director Preset**: Context, Review, Run panes by default; Story, Visual, Audio on-demand
- **Safe Handoff**: Open in Workbench with refs-only payload
- **Fail-Closed**: Commands disabled without creator-studio projection; panes hidden without capability

## Capabilities

- `dsh-ai-drama-command-surface`: Typed /drama command surface
- `dsh-ai-drama-pane-preset`: Director preset with first-support and secondary panes
- `dsh-ai-drama-context-handoff`: Workbench handoff with safe refs
- `dsh-ai-drama-product-evidence`: Redacted product evidence

## Behavior

The bundle follows the Director Pack design:
- Commands stay disabled when drama owner projection is missing
- Panes stay hidden when required capabilities are unavailable
- No polling: snapshot + event push only
- Unknown results never auto-retry
- Handoff carries only refs, not session tokens or private data

## License

MIT
