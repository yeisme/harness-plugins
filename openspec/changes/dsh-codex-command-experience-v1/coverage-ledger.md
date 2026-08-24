# Codex Command Coverage Ledger

This document tracks the coverage status of Codex commands relative to DSH implementation.

## Coverage Status Legend

- `equivalent` - Full feature parity with Codex command
- `adapted` - Functionally equivalent with DSH-specific adaptation
- `staged` - Implemented but awaiting upstream seam or production gate
- `conditional` - Only applicable under specific DSH conditions
- `not-applicable` - Does not apply to DSH (with documented reason)

## P0 Commands (First Release)

### Discovery & System

| Command | Coverage | DSH Owner | Current Seam | Notes |
|---------|----------|-----------|--------------|-------|
| `/help` | adapted | client | local | Local command help system |
| `/commands` | equivalent | client | `@deepseek-ai/dsh-commands` | Command palette integration |
| `/status` | staged | dsh | pending | System status projection |
| `/plugins` | equivalent | host | `@deepseek-ai/dsh-commands` | Plugin management |
| `/mcp` | equivalent | host | `@deepseek-ai/dsh-commands` | MCP server management |
| `/skills` | equivalent | host | `@deepseek-ai/dsh-commands` | Skills management |

### Session & Navigation

| Command | Coverage | DSH Owner | Current Seam | Notes |
|---------|----------|-----------|--------------|-------|
| `/new` | equivalent | dsh | owner action | Create new chat session |
| `/resume` | equivalent | dsh | owner action + projection | Resume saved session |
| `/rename` | equivalent | dsh | owner action | Rename current session |
| `/fork` | equivalent | dsh | owner action | Fork current chat |
| `/agent` | equivalent | dsh | owner action + projection | Thread picker (not preset) |
| `/subagents` | equivalent | dsh | owner action + projection | Subagent thread navigation |

### Model & Policy

| Command | Coverage | DSH Owner | Current Seam | Notes |
|---------|----------|-----------|--------------|-------|
| `/model` | equivalent | dsh | owner action | Model selection |
| `/reasoning` | staged | dsh | pending | Reasoning mode toggle |
| `/permissions` | staged | dsh | pending | Permission settings |
| `/preset` | equivalent | dsh | owner action | Preset picker (separated from /agent) |

### Work & Review

| Command | Coverage | DSH Owner | Current Seam | Notes |
|---------|----------|-----------|--------------|-------|
| `/plan` | staged | dsh | pending | Plan management |
| `/goal` | staged | dsh | pending | Goal management |
| `/compact` | equivalent | dsh | owner action | Compact conversation context |
| `/diff` | adapted | client | local | View diff of conversation |
| `/review` | staged | dsh | pending | Review mode |
| `/mention` | staged | dsh | pending | Mention handling |

### Utility & Lifecycle

| Command | Coverage | DSH Owner | Current Seam | Notes |
|---------|----------|-----------|--------------|-------|
| `/copy` | equivalent | client | local | Copy content to clipboard |
| `/feedback` | staged | dsh | pending | Send feedback |
| `/init` | not-applicable | n/a | n/a | Codex-specific initialization |
| `/logout` | staged | dsh | pending | Logout action |
| `/quit` | equivalent | client | local | Quit command |
| `/exit` | equivalent | client | local | Exit command (alias to /quit) |

## P1 Commands (Next Release)

| Command | Coverage | DSH Owner | Current Seam | Advancement Conditions |
|---------|----------|-----------|--------------|----------------------|
| `/clear` | staged | dsh | pending | New chat + view clear seam |
| `/archive` | staged | dsh | pending | Owner preview + receipt seam |
| `/delete` | staged | dsh | pending | Owner preview + confirmation seam |
| `/side` | not-applicable | n/a | n/a | Codex ephemeral side-chat |
| `/btw` | not-applicable | n/a | n/a | Alias to /side |
| `/usage` | staged | dsh | pending | Usage statistics projection |
| `/debug-config` | conditional | dsh | pending | Debug mode condition |
| `/theme` | staged | client | pending | Theme switching |
| `/statusline` | staged | client | pending | Status line configuration |
| `/keymap` | staged | client | pending | Keymap customization |
| `/ps` | staged | dsh | pending | Process status (TUI-specific) |
| `/stop` | staged | dsh | pending | Stop action |
| `/raw` | staged | client | pending | Raw mode toggle |
| `/history` | adapted | dsh | owner action | Adapted to /resume for sessions |
| `/doctor` | staged | dsh | pending | Diagnostic mode |
| `/settings` | staged | client | pending | Settings UI |
| `/tools` | staged | dsh | pending | Tool management |
| `/context` | staged | dsh | pending | Context management |
| `/jobs` | not-applicable | n/a | n/a | Codex job system |
| `/search` | staged | dsh | pending | Search in conversations |
| `/export` | staged | dsh | pending | Export functionality |

## P2 Commands (Platform-Specific)

| Command | Coverage | DSH Owner | Current Seam | Reason |
|---------|----------|-----------|--------------|--------|
| `/fast` | not-applicable | n/a | n/a | Codex-specific model switching |
| `/personality` | not-applicable | n/a | n/a | Codex personality system |
| `/memories` | not-applicable | n/a | n/a | Codex memory feature |
| `/apps` | not-applicable | n/a | n/a | Codex apps ecosystem |
| `/hooks` | not-applicable | n/a | n/a | Codex webhooks |
| `/import` | not-applicable | n/a | n/a | Codex import feature |
| `/ide` | not-applicable | n/a | n/a | Codex IDE integration |
| `/ide-context` | not-applicable | n/a | n/a | Codex IDE context |
| `/approve` | not-applicable | n/a | n/a | Codex approval system |
| `/experimental` | not-applicable | n/a | n/a | Codex experimental features |
| `/app` | not-applicable | n/a | n/a | Codex app management |
| `/cloud` | not-applicable | n/a | n/a | Codex cloud features |
| `/cloud-environment` | not-applicable | n/a | n/a | Codex cloud environment |
| `/local` | not-applicable | n/a | n/a | Codex local models |
| `/project` | not-applicable | n/a | n/a | Codex project management |
| `/worktree` | not-applicable | n/a | n/a | Codex worktree integration |
| `/vim` | not-applicable | n/a | n/a | Codex vim integration |
| `/title` | staged | dsh | pending | Session title (covered by /rename) |
| `/pets` | not-applicable | n/a | n/a | Codex pets feature |
| `/pet` | not-applicable | n/a | n/a | Codex pet interaction |
| `/setup-default-sandbox` | not-applicable | n/a | n/a | Codex sandbox setup |
| `/sandbox-add-read-dir` | not-applicable | n/a | n/a | Codex sandbox configuration |

## Migration Notes

### Legacy Compatibility

- `:` → `/` (with migration hints, planned removal requires future OpenSpec)
- `/agent <preset>` → `/preset <preset>` (deprecated, removal requires future OpenSpec)

### Semantic Changes

- **`/agent`**: Changed from preset picker to thread picker (breaking change protected by compatibility period)
- **`/preset`**: New command for preset selection (separated from `/agent`)
- **`/history`**: Adapted to `/resume` for session management (no local history duplication)

## Verification Commands

```bash
# Test core functionality
pnpm --filter @yeisme/dsh-client-ui-command-experience-core run test

# Test host adapter
pnpm --filter @yeisme/dsh-command-experience-host run test

# Test bundle
pnpm --filter @yeisme/dsh-command-experience run test

# Integration tests (to be added)
pnpm --filter @yeisme/dsh-command-experience run test:integration
```

## Last Probe Version

Target DSH version: `0.1.0-rc.8`
Last validated: 2026-08-24

## Notes

- Coverage matrix reflects current DSH `0.1.0-rc.8` capabilities
- Commands marked `staged` require upstream seams or implementation
- Commands marked `not-applicable` are Codex-specific without DSH equivalent
- This ledger is updated as DSH capabilities evolve
