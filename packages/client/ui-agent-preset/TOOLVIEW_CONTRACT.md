# ToolView Display Contract

## Contract: Model-Facing Preview Tool (retain-next)

This document records the ToolView display contract for future model-visible `agent_preview` tool implementation, as required by task 3.2.

### Implementation Status

**Current Slice (dsh-agent-composition-preview-v1 tasks 3.1/3.2):**
- ❌ Does NOT implement a model-visible `agent_preview` tool
- ❌ Does NOT add new session event types
- ✅ Implements read-only picker Preview panel via direct host bridge

**Future Implementation (retain-next):**
If a model-visible `agent_preview` tool is implemented, it MUST satisfy the contracts below.

### Contract 1: Model-Visible ⟺ Logged

Any model-visible input MUST have a corresponding session event that can be reconstructed from the session log.

**Requirements for future `agent_preview` tool:**
1. Tool invocation MUST be logged in session events
2. Tool result MUST be logged in session events
3. Session replay MUST reconstruct both request and response
4. All model-visible inputs MUST be reconstructible from session log

**Session Event Schema (future):**
```typescript
interface AgentPreviewCallEvent {
  type: 'tool.call'
  tool: 'agent_preview'
  arguments: {
    preset_id: string
  }
  timestamp: string
  call_id: string
}

interface AgentPreviewResultEvent {
  type: 'tool.result'
  tool: 'agent_preview'
  result: CompositionPreview // redacted
  timestamp: string
  call_id: string
}
```

### Contract 2: ToolView Display

Model tool results SHOULD be displayed via ToolView using `tool.call.toolview` slot.

**Requirements for future display:**
1. Display MUST go through ToolView slot
2. MUST show safe summary and digest only
3. MUST NOT show raw prompt text or full schema
4. MUST NOT expose private tool arguments
5. MUST NOT expose absolute paths or credentials

**ToolView Component Requirements:**
```tsx
// Future implementation example
function AgentPreviewToolView({ result }: { result: CompositionPreview }) {
  return (
    <div className="toolview-preview">
      <h4>Preset: {result.preset.id}</h4>
      <HealthBadge health={result.health} />
      <DriftBadge drift={result.drift} />
      <ToolsList tools={result.composition.tools} />
      {/* NO raw content, NO private arguments */}
    </div>
  )
}
```

### Contract 3: Redaction

Even when model-generated, display MUST be redacted.

**Safe to Display:**
- ✅ Tool names
- ✅ Schema digests (full or truncated)
- ✅ Prompt section IDs
- ✅ Permission preset names
- ✅ Health status
- ✅ Drift status

**NOT Safe to Display:**
- ❌ Raw prompt text content
- ❌ Full tool schema content
- ❌ Private tool arguments
- ❌ Absolute file paths
- ❌ PIDs or credentials
- ❌ Provider payloads

### Current Implementation Constraints

**What We DO Today (tasks 3.1/3.2):**
- Direct host bridge call to `AgentCompositionPreview.project(id)`
- No agent tool invocation
- No session events
- No model-visible logging

**What We DON'T Do Today:**
- No model-facing `agent_preview` tool
- No session event modifications
- No ToolView integration yet

**Why This Design:**
- Picker Preview is a user-facing convenience feature
- Does NOT require model involvement
- Does NOT need session persistence
- Keeps model interaction costs zero

### Future Implementation Checklist

When implementing model-visible `agent_preview`:

- [ ] Define session event schema for tool call
- [ ] Define session event schema for tool result
- [ ] Ensure both are reconstructible from session log
- [ ] Add schema to session-projection types
- [ ] Implement ToolView slot component
- [ ] Register ToolView with `tool.call.toolview`
- [ ] Add redaction tests for all displayed fields
- [ ] Add session replay tests
- [ ] Update this contract document with actual schema

### Testing Requirements

**Future Tests Required:**
1. Session event is logged on tool call
2. Session event is logged on tool result
3. Session replay reconstructs both
4. ToolView component redacts all unsafe fields
5. Private arguments never reach ToolView
6. Absolute paths are redacted
7. Full schema content is not displayed

---

## References

- [OpenSpec Change: dsh-agent-composition-preview-v1](../../../openspec/changes/dsh-agent-composition-preview-v1/)
- [Spec: dsh-agent-preview-experience](../../../openspec/changes/dsh-agent-composition-preview-v1/specs/dsh-agent-preview-experience/spec.md)
- Task 3.2: "记录 ToolView 展示契约"
