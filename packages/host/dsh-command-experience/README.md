# @yeisme/dsh-command-experience-host

DSH Command Experience host adapter - provides DSH owner action/receipt projection and capability probing for the command experience bundle.

## Purpose

This package bridges the pure command experience core with DSH runtime capabilities:

- **Capability Probe**: Detects DSH version and available capabilities
- **Owner Action Adapter**: Interface for thread/session projections and action submission
- **Type Safety**: Opaque refs and structured receipts

## Installation

```bash
pnpm add @yeisme/dsh-command-experience-host
```

## Usage

```typescript
import {
  // Capability probing
  probeCapabilities,
  formatProbeError,
  TARGET_DSH_VERSION,

  // Owner action adapter
  type OwnerActionAdapter,
  createThreadOpenRequest,
  createSessionResumeRequest,
  createMockAdapter,
} from '@yeisme/dsh-command-experience-host';

// Probe capabilities on bundle activation
const probeResult = await probeCapabilities();
if (!probeResult.canActivate) {
  console.error(formatProbeError(probeResult));
}

// Create action requests
const request = createThreadOpenRequest(threadRef, correlationId);
await adapter.submitAction(request);

// Mock adapter for testing
const mockAdapter = createMockAdapter({
  threads: [/* thread projections */],
  sessions: [/* session projections */],
});
```

## Architecture

### Capability Probe (`capability-probe.ts`)
- Detects DSH version and required exports
- Tests for command directory, thread/session projection, owner actions
- Returns detailed activation results with missing capabilities

### Owner Action Adapter (`owner-action-adapter.ts`)
- Interface for DSH runtime integration
- Request builders for common actions
- Receipt validation and idempotency helpers
- Mock adapter for testing

## Opaque References

The plugin treats DSH-provided references as opaque:

- `ThreadRef` - Opaque reference to agent/subagent thread
- `SessionRef` - Opaque reference to saved session
- `PresetRef` - Opaque reference to model preset

These are provided by DSH owner and must not be constructed or interpreted by the plugin.

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
