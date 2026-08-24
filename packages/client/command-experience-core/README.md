# @yeisme/dsh-client-ui-command-experience-core

DSH Codex command experience core package - shared types, directory utilities, and reducer for unified command experience across Web and TUI surfaces.

## Purpose

This package provides the pure functional core of the command experience system:

- **Types**: Shared TypeScript types for commands, state machine, and interactions
- **Directory**: Command directory management with filtering, sorting, and conflict detection
- **Reducer**: State machine for command interaction flow

This package has no runtime dependencies on DSH or React - it's pure TypeScript/JavaScript that can be consumed by both Web and TUI adapters.

## Installation

```bash
pnpm add @yeisme/dsh-client-ui-command-experience-core
```

## Usage

```typescript
import {
  // Types
  type CommandExperienceEntryV1,
  type CommandReducerState,
  type CommandReducerAction,

  // Directory utilities
  filterCommands,
  sortCommands,
  findExactMatch,

  // Reducer
  commandReducer,
  createInitialState,
  actions,
} from '@yeisme/dsh-client-ui-command-experience-core';

// Create initial state
const state = createInitialState();

// Use reducer
const nextState = commandReducer(state, actions.startAssist('/resume', 'draft text'));

// Filter and sort commands
const availableCommands = sortCommands(
  filterCommands(allCommands, {
    surface: 'web',
    minAvailability: 'available'
  }),
  'category'
);
```

## Architecture

The core is split into three main modules:

### Types (`types.ts`)
- Command definition types (`CommandExperienceEntryV1`)
- State machine types (`CommandReducerState`, `CommandReducerAction`)
- Coverage types for Codex compatibility tracking

### Directory (`directory.ts`)
Pure functions for command directory management:
- `mergeCommandSources()` - Combine commands from multiple sources with conflict detection
- `filterCommands()` - Filter by surface, availability, category, query
- `sortCommands()` - Sort by category, alphabetical, or usage
- `findExactMatch()` - Find exact command match
- `findUniquePrefixMatch()` - Find unique prefix match

### Reducer (`reducer.ts`)
Pure reducer for command interaction state machine:
- `idle → assist → selected → argument/selector/confirmation → dispatching → receipt`
- Supports draft preservation and focus restoration
- Handles idempotent receipts

## Testing

```bash
pnpm test
```

## Building

```bash
pnpm build
```

## License

MIT
