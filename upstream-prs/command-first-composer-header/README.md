# Command-first Composer / Header / viewport seams

## Purpose

Minimal upstream note for official Composer slash-assist anchor and Header
session-status trigger. Plugin completion does not wait on these seams.

## Status

Probe-first. Missing seams fail visible: Web keeps the Command Menu
fallback; `/status` degrades Popover → Pane → safe text.

## Local contract (completion gate)

```bash
pnpm --filter @yeisme/dsh-client-ui-command-experience-core test
pnpm --filter @yeisme/dsh-client-ui-command-experience-web test
pnpm --filter @yeisme/dsh-session-status-host test
pnpm --filter @yeisme/dsh-client-ui-session-status test
pnpm --filter @yeisme/dsh-command-experience test:integration
```

Official `dsh web` boot is not a plugin completion gate.
