# DSH slash commands

English | [中文](slash-commands.zh.md)

The live `/` directory is owned by `@yeisme/dsh-command-experience`. Session
and agent commands stay receipt-gated owner actions. Inspect commands open
existing surfaces. Pane plugins contribute slash names without editing the
command-experience catalog.

## Common commands

| Command | Behavior | Missing target |
| --- | --- | --- |
| `/session` | Session hub: switch, rename, archive, restore | Disabled without `open-session` |
| `/agent` / `/agents` | Thread picker | Disabled without `open-thread` |
| `/mcp` | Open the Tools / MCP inspector conversation view | Disabled: MCP inspector plugin not installed |
| `/skills` | Open Agent Context on the skills tab | Disabled: Agent Context pane not installed |
| `/plugins` | List loaded plugin ids | Local inspect, no RPC |
| `/pane` | Pane picker; `/pane explorer` opens a unique kind | Disabled without Pane Workbench |
| `/explorer` / `/files` | Open `dsh.explorer` | Disabled if the view is not registered |
| `/git` | Open `dsh.source-control` | Disabled if the view is not registered |

First `/` discovery never issues RPC. Missing owner actions and missing
surfaces stay visible and disabled with a reason.

On the host plane these inspect commands are real official commands: they
appear in the composer menu next to the official ones and execute with a
durable `command/run` + `command/done` record. When a surface is missing the
execution returns that same reason as an explicit text result instead of
failing silently. Officially owned names (`goal`, `plan`, `model`, `compact`,
`feedback`, `permission`, `export`) are never projected — they stay with the
official plugins.

## Pane hot-plug

A new pane does not need a command-experience code change.

1. Register a picker-visible view. It appears under `/pane`.
2. Mark a command `presentation.launcher: true`. It appears as
   `/creator-open` (dots become hyphens).
3. Optional protocol field `slash.name` publishes a short name such as
   `/creator`.

Uninstalling the pane removes those rows immediately. Reserved P0 names
(`mcp`, `skills`, `session`, `agent`, …) cannot be stolen; a colliding
contribution stays disabled.

```ts
commands: [{
  id: 'creator.open',
  label: 'Open Creator Studio',
  presentation: { launcher: true },
  slash: { name: 'creator', category: 'pane' },
}]
```

## Custom host commands

Text-result commands still register on the official `commands` runtime:

```ts
export const inject = ['commands']

export function apply(ctx: Context): () => void {
  return registerYeismeCommand(ctx.get('commands'), {
    name: 'yeisme-foo',
    description: 'One-line owner projection.',
    handler: () => ({ kind: 'success', text: '...' }),
  })
}
```

Names must match `yeisme-[a-z0-9_-]+`. The live directory projects those
host commands into `/` without copying handlers.

Three registration rules keep a custom bundle from breaking the boot (see
Troubleshooting below for the failure modes):

1. `inject = ['commands']` is a wait-for contract, not decoration.
2. Never claim an official name; check `find()` before `register()`.
3. Return `{ kind, text }` results; the composer executes them without RPC.

## Troubleshooting

- **Command never appears in `/`**: the plugin must declare `inject = ['commands']`.
  With an empty inject the loader fiber can start before dsh-base provides the
  service and the fail-closed skip silently drops every registration.
- **Boot fails with `command "goal" is already registered`**: custom commands must
  not claim names the official runtime owns (`goal`, `plan`, `model`, `compact`,
  `feedback`, `permission`, `export`, …). The registry is first-come with hard
  duplicate failures; a hot-plug bundle must yield.
- **Whole plugin tree fails on one bundle**: a client bundle with a stray
  `require("module")`-style externals drift fails the entire client tree load
  ("Failed to load plugins" banner). Keep client builds free of Node builtins.

## Local verification

```bash
pnpm --filter @yeisme/dsh-client-ui-command-experience-core test
pnpm --filter @yeisme/dsh-command-experience test
pnpm --filter @yeisme/dsh-pane-protocol test
openspec validate dsh-slash-directory-hotplug-v1 --strict --no-interactive
```

### Real-runtime verification

Unit tests use synchronous fakes and cannot catch loader timing. Before
calling a registration change done, boot the real runtime:

```bash
pnpm --filter @yeisme/dsh-command-experience build   # the profile loads lib/, not src/
TMP=$(mktemp -d); DSH_HOME=$TMP dsh plugin --profile web add ./packages/bundle/dsh-command-experience
DSH_HOME=$TMP dsh --profile web --port <port> --no-open
```

Then drive the real UI (the browser e2e recipe lives in
`packages/host/yeisme-commands/scripts/run-slash-browser-evidence.mjs`):
open the page, connect a workspace, type `/` and confirm the menu rows.
Durable proof lands in the session log — `command/run` with the command name
and `command/done` with the handler result. A running `dsh web` server holds
its imports: restart it after rebuilding before retesting.
