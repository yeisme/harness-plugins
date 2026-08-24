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
- `/plugins` - Plugin management
- `/mcp` - MCP servers
- `/skills` - Skills management

### Session & Navigation
- `/new` - Create new chat
- `/resume` - Resume saved session
- `/rename` - Rename session
- `/fork` - Fork current chat
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
├── Web adapter (future tasks 4.x)
└── TUI adapter (future tasks 5.x)
```

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
