# @yeisme/dsh-client-ui-command-experience-tui

DSH TUI command experience: a thin console adapter over the shared command directory and reducer.

The adapter probes a public TUI contribution/registry seam, contributes P0 commands for surface `tui`, and fails closed when that seam is missing. It does not invent a fake console, patch the host, or issue RPC on first discovery.

## Features

- **Public contribution seam**: `registerCommandConsole` / `contributeCommandConsole`
- **Fail-closed missing seam**: unregistered contribution with an explicit reason
- **Canonical `/` assist** plus **`:` legacy alias** with a migration hint
- **`/agent` thread picker** and **`/resume` session picker**
- **Disabled owner actions stay visible** with a reason (no dead buttons)
- **Zero RPC on first discovery**
- **Pure `update(state, event)` / `render(state, width, height)`** for conversation, assist, Command Center, argument, selector, confirm, destructive, dispatch, receipt, inspector, and session reset
- **Viewport-capped Slash Assist** (8/6/4/3) and `Ctrl+K` Command Center (Commands/Recent/Status)
- **Confirm defaults Cancel**; destructive needs the owner phrase; bare Enter does not confirm non-safe
- **Statusline `/status`** reuses `session.status.snapshot.v1alpha1` or shows unavailable
- **Sidecar debug** (event/frame counters); plugin does not read stdin, enter raw/alternate screen, or capture signals

## Installation

This package is part of the `@yeisme/dsh-command-experience` bundle:

```bash
dsh plugin --profile tui add @yeisme/dsh-command-experience
```

Official `dsh --profile tui` boot is not claimed by this adapter. Missing host seams stay fail-closed.

## Usage

```ts
import {
  applyCommandExperienceTui,
  commandExperienceTuiAdapter,
  createLocalCommandConsoleHost,
  resolveTuiAssistQuery,
} from '@yeisme/dsh-client-ui-command-experience-tui';
import { buildP0Catalog } from '@yeisme/dsh-client-ui-command-experience-core';

const catalog = buildP0Catalog();
const local = createLocalCommandConsoleHost();
const registration = applyCommandExperienceTui(local.host, catalog);

if (!registration.registered) {
  // Fail closed: contribution is unavailable with registration.reason
}

const slash = resolveTuiAssistQuery(catalog, '/');
const resume = resolveTuiAssistQuery(catalog, '/resume');
const colon = resolveTuiAssistQuery(catalog, ':agent');
```

## Testing

```bash
pnpm --filter @yeisme/dsh-client-ui-command-experience-tui test
pnpm --filter @yeisme/dsh-client-ui-command-experience-tui typecheck
pnpm --filter @yeisme/dsh-client-ui-command-experience-tui build
pnpm --filter @yeisme/dsh-command-experience test:integration
```

Golden frames cover 120×36, 80×24, 60×20, and 50×12. Resize round-trips keep draft, selection, receipt, and scroll anchor.

## License

MIT
