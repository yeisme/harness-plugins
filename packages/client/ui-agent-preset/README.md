# @yeisme/dsh-client-ui-agent-preset

DSH agent preset client UI: Read-only Preview panel for composition facts, health, drift, and maturity slot.

## Scope

This package provides client-side React components for displaying read-only composition previews of agent presets in the DSH Web picker. It does **not** modify presets, start sessions, or compute maturity/risk locally.

## Components

### `PreviewPanel`

Main modal component that displays:
- Tools list (name, source, schema digest)
- Prompt sections (id, source, digest - no content)
- Permissions (sandbox mode, approval policy, contrib source)
- Three-layer health status (shape, mount, provable ref)
- Drift status (none/diverged/unknown)
- Optional maturity slot (only when Ordo provides it)
- Capability digest (first 12 characters)
- Projection units

**Features:**
- Full keyboard navigation (Escape to close, Tab navigation)
- Focus trap within modal
- Focus return to trigger on close
- Screen reader announcements
- Reduced motion support
- ARIA labels and roles

### `PreviewAction`

Button component that triggers the preview panel for a specific preset.

## Integration

### Slot Registration

The Preview action registers with `@deepseek-ai/dsh-client-ui-agent-preset` slots to appear in:
- `AgentPresetRow` actions
- `AgentPresetSeat` actions

```typescript
import { initPreviewUI } from '@yeisme/dsh-client-ui-agent-preset/client'

// Initialize preview UI when your app loads
initPreviewUI()
```

### Ordo Integration

The maturity slot is **optional** and only displays when Ordo projection data is injected. DSH does NOT compute maturity, risk, or qualified status locally.

## Usage

```tsx
import { PreviewPanel, PreviewAction } from '@yeisme/dsh-client-ui-agent-preset/client'

function PresetRow() {
  return (
    <>
      <PreviewAction presetId="standard" label="Preview" />
      {/* ... */}
    </>
  )
}

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <button ref={triggerRef} onClick={() => setIsOpen(true)}>
        Preview
      </button>

      <PreviewPanel
        presetId="standard"
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
      />
    </>
  )
}
```

## Data Flow

1. User clicks Preview action on preset row/seat
2. Panel opens and calls `AgentCompositionPreview.project(id)` via host bridge
3. Host service fetches composition projection from registries
4. Panel displays:
   - Health status (shape_ok, mount_ok, reason, provable_mount_ref)
   - Drift status (lineage comparison)
   - Tools, sections, permissions, digest
   - Optional maturity slot (if Ordo injection available)
5. Panel closes; focus returns to trigger

## Accessibility

- **Keyboard**: Escape to close, Tab/Shift+Tab to navigate, focus trap
- **Screen Reader**: ARIA roles, labels, live regions for status updates
- **Motion**: Reduced motion support (CSS prefers-reduced-motion)
- **Focus**: Predictable focus management, return to trigger on close

## Constraints

### What This Package Does NOT Do

- ❌ Modify presets or composition files
- ❌ Change default selection
- ❌ Start agents, sessions, or turns
- ❌ Compute maturity, risk, or qualified status locally
- ❌ Display raw prompt text, full schema content, or private arguments
- ❌ Auto-correct drift or overwrite user copies

### Maturity Slot Behavior

- **With Ordo injection**: Displays Ordo-provided maturity data
- **Without Ordo injection**: Hides maturity/risk/qualified badges (does NOT show "unverified")

## Known Limitations

1. **Host Bridge Integration**: Preview panel currently shows placeholder data. Must be integrated with `AgentCompositionPreview.project(id)` host service.

2. **Slot Registration**: Actual slot registration with `@deepseek-ai/dsh-client-ui-agent-preset` is pending upstream availability.

3. **Bundle Registration**: This package needs to be added to a DSH bundle (e.g., `@yeisme/dsh-desktop-workbench` or a new bundle) to be active.

## Testing

```bash
# Type check
pnpm run typecheck

# Unit tests
pnpm run test

# Build
pnpm run build
```

## License

MIT

## Links

- [OpenSpec Change: dsh-agent-composition-preview-v1](../../../openspec/changes/dsh-agent-composition-preview-v1/)
- [Spec: dsh-agent-preview-experience](../../../openspec/changes/dsh-agent-composition-preview-v1/specs/dsh-agent-preview-experience/spec.md)
