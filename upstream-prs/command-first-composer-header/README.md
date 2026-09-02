# Command-first Composer / Header / viewport seams

## Purpose

Minimal upstream note for official Composer slash-assist anchor, Header
session-status trigger, TUI viewport/frame/logical-key, and statusline
seams. Plugin completion does not wait on these seams.

## Status

Probe-first. Missing seams fail visible: Web keeps the Command Menu
fallback; TUI stays on the typed console contribution; `/status` degrades
Popover → Pane → safe text; TUI statusline shows `status unavailable`.

## Local contract (completion gate)

```bash
pnpm --filter @yeisme/dsh-client-ui-command-experience-core test
pnpm --filter @yeisme/dsh-client-ui-command-experience-web test
pnpm --filter @yeisme/dsh-client-ui-command-experience-tui test
pnpm --filter @yeisme/dsh-session-status-host test
pnpm --filter @yeisme/dsh-client-ui-session-status test
pnpm --filter @yeisme/dsh-command-experience test:integration
```

Official `dsh web` boot is not a plugin completion gate.
