# @yeisme/dsh-command-experience

DSH Codex Command Experience bundle - unified `/` command experience across Web and TUI surfaces with Codex-style command coverage, `/agent` thread picker, and `/resume` session picker.

## Installation

### Web Profile
```bash
dsh plugin --profile web add @yeisme/dsh-command-experience
```

### TUI Profile
```bash
dsh plugin --profile tui add @yeisme/dsh-command-experience
```

### Removal
```bash
dsh plugin --profile web remove @yeisme/dsh-command-experience
dsh plugin --profile tui remove @yeisme/dsh-command-experience
```

## Features

### Unified Command Directory
- Single source of truth for command metadata across Web and TUI
- Canonical names, aliases, descriptions, categories
- Availability, danger levels, and action kinds
- Codex compatibility coverage tracking

### Command State Machine
- Shared interaction flow: `idle → assist → selected → argument/selector/confirmation → dispatching → receipt`
- Draft preservation and focus restoration
- Idempotent receipt handling
- Stale detection and recovery

### Live directory and pane hot-plug
- P0 catalog, pane launcher commands, and host `commands` projections share one `/` directory
- New picker-visible panes appear under `/pane` without editing this package
- `presentation.launcher: true` publishes `/creator-open`; optional `slash.name` publishes `/creator`
- Uninstalling a pane removes its rows immediately; reserved names stay with P0

### `/mcp` `/skills` `/plugins`
- Host plane: registered as real official commands (menu rows + durable
  `command/run` / `command/done` records) once the `commands` service is up
- `/mcp` opens or points at the Tools inspector conversation view
- `/skills` opens Agent Context on the skills tab
- `/plugins` lists loaded plugin ids locally from the cordis loader entry
  table (the same source as the official plugin inventory)
- Missing surfaces stay visible and disabled with a reason; execution
  returns that reason as an explicit text result

### `/agent` Thread Picker
- Switch between main agent and subagent threads
- Hierarchical thread projection from DSH
- Opaque thread refs - no local state copying
- Stale target handling without auto-selection

### `/resume` Session Picker
- Safe projection of saved sessions
- Local filtering without building local index
- Owner-authored open action with receipt
- Failure keeps current session and draft

### `/session` Session Hub
- Management hub layered over the same `open-session` channel as `/resume`
- Pick a session, then choose an action: Switch, Rename, Archive, Restore
- `/session archive` pre-arms archive mode; `/session rename <title>` deep-links
- Archive routes through the owner preview and receipt gates and refuses
  recursive payloads; the hub never offers delete
- Archived targets swap the Archive action for Restore
- Missing owner actions stay visible and disabled with a reason

### `/archive` and `/delete` (staged)
- Standalone catalog entries with `confirm` / `destructive` danger grades
- Stay staged and disabled until the owner supplies a preview and a
  receipt path; no impact data is invented client-side

### Shared Keymap (mouse-free operation)
- One binding table drives Web and TUI: `Ctrl/Cmd+K` toggle,
  arrows / `Ctrl+N` / `Ctrl+P` navigation, `Home` / `End` jumps,
  `Enter` execute, `Escape` cancel, `Tab` safe-prefix completion,
  `Ctrl/Cmd+Enter` confirm (bare `Enter` never confirms a danger gate),
  `Escape` / `Ctrl+D` close a receipt
- Bare `j` / `k` stay opt-in config: they would swallow query letters
- Cursor movement lives in the shared reducer; a vanished candidate
  clears the cursor instead of snapping to a neighbor
- Shortcut bindings live in adapter configuration, never in command
  metadata (the sanitizer rejects shortcut fields in descriptors)

### Legacy Compatibility
- `:` alias for `/` (with migration hints)
- `/agent <preset>` routes to `/preset` with deprecation notice
- Expand-then-contract migration plan

### Codex Command Coverage
Complete coverage matrix tracking:
- `equivalent` - Full feature parity
- `adapted` - DSH-specific adaptation
- `staged` - Implemented but awaiting seam/gate
- `conditional` - Platform-specific conditions
- `not-applicable` - Does not apply to DSH

## P0 Commands (First Release)

### Discovery & System
- `/help` - Command help
- `/commands` - Command palette
- `/status` - System status
- `/plugins` - List loaded plugins
- `/mcp` - Open MCP / Tools inspector
- `/skills` - Open Agent Context skills
- `/pane` - Open a workspace pane
- `/explorer` / `/files` - Open the file explorer pane
- `/git` - Open source control

### Session & Navigation
- `/new` - Create new chat
- `/resume` - Resume saved session
- `/session` - Session management hub (switch / rename / archive / restore)
- `/rename` - Rename session
- `/fork` - Fork current chat
- `/archive` - Archive session (staged, owner preview required)
- `/delete` - Delete session (staged, owner preview required)
- `/agent` - Switch agent thread
- `/subagents` - View subagents

### Model & Policy
- `/model` - Model selection
- `/reasoning` - Reasoning mode
- `/permissions` - Permission settings
- `/preset` - Preset selection

### Work & Review
- `/plan` - Plan management
- `/goal` - Goal management
- `/compact` - Compact context
- `/diff` - View diff
- `/review` - Review mode
- `/mention` - Mention handling

### Utility & Lifecycle
- `/copy` - Copy content
- `/feedback` - Send feedback
- `/init` - Initialize
- `/logout` - Logout
- `/quit` - Quit
- `/exit` - Exit

## Architecture

```
@yeisme/dsh-command-experience (bundle)
├── @yeisme/dsh-client-ui-command-experience-core (shared types & reducer)
├── @yeisme/dsh-command-experience-host (DSH adapter)
├── @yeisme/dsh-client-ui-command-experience-web (Web contribution adapter)
└── @yeisme/dsh-client-ui-command-experience-tui (TUI console contribution adapter)
```

The TUI adapter probes a public `registerCommandConsole` / `contributeCommandConsole` seam. Missing seams fail closed: the contribution stays unregistered with an explicit reason. No fake console, no host patching, and no RPC on first discovery. Canonical `/` assist, the `:` legacy alias (with a migration hint), `/agent` thread picker, and `/resume` session picker all resolve against the shared catalog. Missing owner actions stay visible and disabled with a reason.

### Host registration contract

The host face (`src/index.ts` → `bindSlashRuntime`) follows three rules that
only surface in the real loader (unit-test fakes are synchronously ready and
hide all of them; see `openspec/changes/dsh-slash-directory-hotplug-v1` design
§D5):

1. **Wait for `commands`.** The plugin declares `inject: ['commands']`. With an
   empty inject the loader fiber can start before dsh-base provides the
   service, and the fail-closed skip silently drops every registration.
2. **Yield official names.** The official registry is first-come with hard
   duplicate failures. `OFFICIAL_OWNED_INSPECT_NAMES` (`goal`, `plan`) never
   project to the host, and every registration re-checks `find()` first —
   claiming `goal` before `dsh-command-goal` fails the whole plugin tree.
3. **Project the loader entry table.** The host context has no `plugins`
   service and `registry.keys()` is not the plugin list; surface probes and
   `/plugins` read `ctx.loader.entries()` (id + module name + phase), the
   same source as `@deepseek-ai/dsh-host-plugin-inventory`.

A running `dsh` server holds its imports — rebuild (`pnpm build`) and restart
the profile before retesting registration changes.

## Requirements

- DSH `>=0.1.0-rc.8`
- `@deepseek-ai/dsh-commands`
- `@deepseek-ai/dsh-client-runtime`

## Capability Probing

The bundle probes for required capabilities on activation:
- Command directory availability
- Thread projection capability
- Session projection capability
- Owner action support
- Action receipt support

Missing capabilities result in:
- Fatal activation failure (for base requirements)
- Disabled commands with reasons (for optional features)

## Compatibility

### TUI Legacy Prefix
- `:` works as alias for `/` with migration hints
- `//text` sends `/text` as literal prompt
- Removal requires future OpenSpec

### Legacy `/agent <preset>`
- Routes to `/preset` with deprecation notice
- Bare `/agent` always opens thread picker
- Removal requires future OpenSpec

## Testing

```bash
pnpm test
```

## Building

```bash
pnpm build
```

## Integration Evidence

Integration test runs are written to `temp/integration-test-runs/<run-id>/` with:
- `summary.json` - Test summary
- `command.txt` - Commands executed
- `stdout.log` - Standard output
- `stderr.log` - Standard error
- `env.json` - Environment info (redacted)

## License

MIT

## Migration from Legacy

If you were using the old `:` prefix or `/agent <preset>` syntax:

1. The new canonical prefix is `/` (e.g., `/resume`, `/agent`)
2. The old `:` prefix still works but shows migration hints
3. Use `/preset` for preset selection instead of `/agent <preset>`
4. See project documentation for full migration guide
