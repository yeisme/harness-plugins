# @yeisme/dsh-client-ui-command-experience-web

DSH Web command experience: unified command menu, selectors, and interactions through official contribution seams.

## Features

- **Zero RPC Discovery**: First command menu render requires no RPC calls
- **No DOM Patching**: Uses official command-menu contribution seam only
- **Full Accessibility**: ARIA attributes, keyboard navigation, screen reader support
- **Type Safe**: Full TypeScript with shared core types
- **React Integration**: Modern hooks-based API with Testing Library tests
- **Dual entry**: Slash Assist (max 8 rows) and Palette share one directory
- **Structured draft**: token, argument/selector, Escape restore, graded confirm
- **Receipt + Activity**: pending dedup, 4s success collapse, official `command/run|done`
- **Probe-first fallback**: old Command Menu remains when the new shell seam is missing

## Installation

This package is part of `@yeisme/dsh-command-experience` bundle. Install the bundle:

```bash
dsh plugin add @yeisme/dsh-command-experience
```

## Usage

### Command Menu

```tsx
import { CommandMenu } from '@yeisme/dsh-client-ui-command-experience-web';

function MyComponent() {
  const { state, dispatch } = useCommandState();

  return (
    <CommandMenu
      state={state}
      dispatch={dispatch}
      options={{
        showCategories: true,
        showDisabledCommands: false,
      }}
    />
  );
}
```

### Hooks

```tsx
import {
  useCommandDirectory,
  useCommandState,
  useCommandNavigation,
  useCommandExecutor,
} from '@yeisme/dsh-client-ui-command-experience-web';

function CommandPalette() {
  const { state, dispatch } = useCommandState();
  const { commands, findCommand } = useCommandDirectory(allCommands);
  const { selectedIndex, navigateUp, navigateDown } = useCommandNavigation(commands, selectedCommand);
  const { executeCommand, cancelCommand } = useCommandExecutor(dispatch);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') navigateDown();
      if (e.key === 'ArrowUp') navigateUp();
      if (e.key === 'Enter' && selectedCommand) executeCommand(selectedCommand);
      if (e.key === 'Escape') cancelCommand();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigateUp, navigateDown, executeCommand, cancelCommand, selectedCommand]);
}
```

### Discovery and Filtering

```tsx
const { commands, findCommand, findUniqueCommand } = useCommandDirectory(allCommands, {
  query: '/agent',  // Filter by prefix
  surface: 'web',    // Only web-compatible commands
  category: 'session',
});

// Find exact match
const agentCommand = findCommand('/agent');

// Find unique prefix match
const command = findUniqueCommand('/agen'); // Returns /agent
```

## API

### Components

- `CommandMenu`: Main command menu with keyboard navigation
- `CommandSelector`: Session/thread/workspace selector
- `ConfirmationDialog`: Destructive command confirmation
- `PendingReceipt`: Command execution status display

### Hooks

- `useCommandDirectory`: Command filtering and searching
- `useCommandState`: Reducer state management
- `useCommandNavigation`: Keyboard navigation
- `useCommandExecutor`: Command execution lifecycle
- `useCommandSelector`: Selector state management

### Utilities

- `getCommandAccessibilityLabel`: ARIA label generation
- `getCommandCategoryLabel`: Localized category names
- `getCommandDisabledReason`: Disabled state explanation
- `isCommandUnavailable`: Check if command is disabled/unavailable

## Keyboard Shortcuts

- `Ctrl+K` / `Cmd+K`: Open command menu
- `↑` / `↓`: Navigate commands
- `Enter`: Execute selected command
- `Escape`: Cancel/close

## Testing

```bash
# Unit tests
pnpm --filter @yeisme/dsh-client-ui-command-experience-web test

# Type checking
pnpm --filter @yeisme/dsh-client-ui-command-experience-web typecheck

# Build
pnpm --filter @yeisme/dsh-client-ui-command-experience-web build
```

## Integration with DSH

This package integrates with DSH through the official `command-menu` contribution seam:

- No DOM patching or monkey patching
- Capability probe for feature detection
- Graceful degradation when commands API unavailable
- Compatible with `@deepseek-ai/dsh-client-ui-commands` 0.1.0-rc.6+

## Safety

- All commands are owner-gated through shared core reducer
- No client-side command execution without owner confirmation
- Disabled commands show reasons, never dead buttons
- Destructive commands require explicit confirmation
- No credential or private data logging

## Dependencies

### Peer Dependencies

- `@deepseek-ai/cordis`: ^4.0.1
- `@deepseek-ai/dsh-client-runtime`: >=0.1.0-rc.6 <0.2.0
- `@deepseek-ai/dsh-client-ui-commands`: >=0.1.0-rc.6 <0.2.0
- `react`: ^18.2.0
- `react-dom`: ^18.2.0

### Workspace Dependencies

- `@yeisme/dsh-client-ui-command-experience-core`: workspace:^

## License

MIT
