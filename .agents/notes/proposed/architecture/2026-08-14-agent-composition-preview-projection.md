# Agent Composition Preview Projection

**Date**: 2026-08-14  
**Status**: Implemented  
**Change**: dsh-agent-composition-preview-v1  
**Agent**: Lane F (client-ui implementation)

## Overview

This note documents the architecture decisions for the agent composition preview projection system, which provides read-only access to agent preset composition facts through both CLI commands and a picker UI panel.

## Key Architectural Decisions

### 1. Standing-Scope Read Access Strategy

**Decision**: Add minimal additive read-only access points to core registries rather than exposing full internal structures.

**Rationale**:
- The projection service needs read access to tool metadata, system prompt sections, and composition facts
- Core packages (`dsh-tools`, `dsh-system-prompt`, `dsh-session-projection`) did not previously expose these details
- Adding full public APIs would be excessive for this read-only projection use case
- Minimal additive reads maintain encapsulation while enabling required functionality

**Implementation**:
```typescript
// dsh-tools: added sources() method
export interface ToolRegistry {
  sources(): Iterable<{name: string, source: string, schemaDigest: string}>
}

// dsh-system-prompt: added sectionSources() method  
export interface SystemPromptService {
  sectionSources(): Iterable<{id: string, source: string, digest: string}>
}

// dsh-session-projection: added attributions() method
export interface SessionProjectionService {
  attributions(): Iterable<{source: string, count: number}>
}
```

**Trade-offs**:
- ✅ Minimal surface area, clear intent
- ✅ No breaking changes to existing contracts
- ✅ Performance-friendly (iterators, not copies)
- ❌ Future projection needs may require additional read access points

### 2. Digest Normalization Strategy

**Decision**: Use canonical JSON stringification for digest computation across all composition sources.

**Rationale**:
- Composition data comes from heterogeneous sources (tools, prompts, session events)
- Different sources may use different serialization formats
- Canonical JSON ensures deterministic digest computation regardless of source format
- Digest consistency is critical for drift detection

**Implementation**:
```typescript
import { canonical } from '@deepseek-ai/dsh-json-canonical'

export function computeDigest(data: unknown): string {
  const normalized = canonical.stringify(data)
  return createHash('sha256').update(normalized).digest('hex')
}
```

**Properties**:
- Deterministic: same input → same digest
- Format-independent: object field order doesn't matter
- Collisions: SHA-256 provides strong collision resistance
- Performance: acceptable for typical composition sizes

**Alternatives Considered**:
1. **Direct JSON.stringify**: rejected due to field ordering sensitivity
2. **Custom normalization**: rejected due to maintenance burden
3. **No normalization**: rejected due to inconsistency risks

### 3. Drift Detection Using Lineage Digests

**Decision**: Compare frozen lineage composition digests against current composition, not mount capability digests.

**Rationale**:
- `capability_digest` at mount level is an incomplete picture (only shows tools+prompt digest)
- Lineage contains the full composition snapshot at copy time
- Comparing against full composition detects changes in any dimension:
  - Tool additions/removals
  - Prompt section edits
  - Permission changes
  - Metadata updates
- Even if mount doesn't exist, drift can be detected

**Implementation**:
```typescript
export function detectDrift(
  lineage: PresetLineage | null,
  currentComposition: Composition
): DriftStatus {
  if (!lineage || !lineage.compositionDigest) {
    return 'unknown' // No baseline to compare
  }
  
  const currentDigest = computeDigest(currentComposition)
  return currentDigest === lineage.compositionDigest ? 'none' : 'diverged'
}
```

**Trade-offs**:
- ✅ Detects all composition changes
- ✅ Works even without mount
- ✅ Clear semantics: "composition changed since copy"
- ❌ Cannot distinguish "source updated" from "local edit" (both show 'diverged')

### 4. Three-Layer Health Status

**Decision**: Expose three independent health indicators rather than a single aggregated status.

**Rationale**:
- Different failure modes require different user actions
- Shape errors (invalid preset) ≠ mount errors (load failure) ≠ ref errors (provenance issues)
- Aggregated status would hide important details
- Independent checks allow targeted diagnostics

**Schema**:
```typescript
export interface CompositionHealth {
  shape_ok: boolean        // Preset validates against schema
  mount_ok: boolean       // All required plugins load successfully  
  reason?: string         // Human-readable failure reason
  provable_mount_ref?: string  // Attestable reference to loaded composition
}
```

**User Experience**:
- UI shows three independent indicators with appropriate styling
- CLI shows structured JSON with all fields populated
- `reason` provides actionable guidance when any check fails

### 5. Maturity Slot Behavior

**Decision**: Maturity display is purely an optional slot injected by Ordo, not computed by DSH.

**Rationale**:
- Maturity assessment requires domain knowledge beyond DSH's scope
- Ordo is the designated owner for maturity/risk qualification
- DSH provides the display infrastructure but not the assessment
- Optional slot allows graceful degradation when Ordo is absent

**Implementation**:
```typescript
export interface CompositionPreview {
  // ... DSH-owned fields
  maturity?: {
    level: 'stable' | 'experimental' | 'deprecated'
    qualified?: boolean
    risk: 'low' | 'medium' | 'high'
  } // Only present when Ordo injects it
}
```

**UI Behavior**:
- With Ordo: show maturity badges with appropriate styling
- Without Ordo: hide maturity section entirely (no "unknown" placeholder)

## Component Architecture

### Projection Service Layer

**Location**: `packages/preset/agent-composition-preview/` (upstream deepseek-harness)

**Responsibilities**:
- Aggregate composition data from all registries
- Compute canonical digests
- Detect drift against lineage
- Validate three-layer health
- Return typed `dsh.composition.preview.v0` envelope

**Key Contracts**:
```typescript
export interface AgentCompositionPreview {
  project(presetId: string): Promise<CompositionPreview>
  smoke(presetId: string): Promise<CompositionSmoke>
}

export interface CompositionPreview {
  preset: {id: string, name: string, description: string}
  composition: {
    tools: Array<{name: string, source: string, schemaDigest: string}>
    promptSections: Array<{id: string, source: string, digest: string}>
    permissions: {sandbox: boolean, approvalPolicy: string, contribSource: string}
  }
  health: CompositionHealth
  drift: 'none' | 'diverged' | 'unknown'
  capabilityDigest: string
  maturity?: MaturityData
  projectionUnits: Array<ProjectionUnit>
}
```

### CLI Surface Layer

**Location**: `apps/cli/` (upstream deepseek-harness)

**Commands**:
- `dsh composition preview --preset <id> --json`: Full projection envelope
- `dsh composition smoke --preset <id>`: Validation + cleanup

**Evidence**:
- E2E tests: `apps/cli/tests/composition.e2e.ts` (4/4 passing)
- Built-bin verification: standard/minimal/code presets all validate

### Client UI Layer

**Location**: `packages/client/ui-agent-preset/` (harness-plugins)

**Components**:
- `PreviewPanel`: Modal displaying full projection data
- `PreviewAction`: Trigger button for preset rows/seats

**Integration**:
- Slot registration with `@deepseek-ai/dsh-client-ui-agent-preset`
- Host bridge to `AgentCompositionPreview.project()`
- Accessibility: keyboard nav, focus trap, ARIA, reduced motion

**Evidence**:
- 29/29 unit tests passing
- Build successful
- Type check clean

## Testing Strategy

### Focused/Local Tests
- Projection service unit tests: 15/15 passing
- Agent presets lineage tests: 136/136 passing  
- Core tools/system-prompt/session-projection read access tests: 509/509 passing
- CLI args tests: 8/8 passing
- UI component tests: 29/29 passing

### End-to-End Tests
- CLI composition tests: 4/4 passing (built bin, real profile)
- Built-bin manual verification: standard/minimal/code presets validated
- Negative fixture testing: unknown preset correctly exits with error

### Snapshot Tests
- CLI output snapshots validate envelope format
- Smoke output validates redaction and summary

## Deployment and Integration

### Bundle Registration

**Current State**: `@yeisme/dsh-client-ui-agent-preset` is built but not registered to any bundle.

**Required Integration**:
```yaml
# Bundle cordis.patch.yml or package.json
dsh:
  client:
    inject:
      - @yeisme/dsh-client-ui-agent-preset
```

**Recommended Bundle**: `dsh-desktop-workbench` or new specialized bundle

### Host Bridge Connection

**Current State**: PreviewPanel uses placeholder error message.

**Required Integration**:
```typescript
// Replace placeholder with real host service call
const preview = await ctx.agentCompositionPreview.project(presetId)
setProjection(preview)
```

### Cross-Repository Dependencies

**Harness-Plugins ➜ DeepSeek-Harness**:
- UI package depends on projection service (upstream)
- CLI commands depend on core packages (upstream)
- Evidence collection requires cross-repo testing

## Known Limitations

1. **Source Plugin Identity**: The `source_plugin` field from the original spec is not implemented. Registry layer doesn't carry plugin identity; would require structural changes to `dsh-tools`/`dsh-system-prompt` registries. Deferred to follow-up work.

2. **Host Bridge Placeholder**: Current UI shows error message instead of real data. Requires integration lane to connect to upstream service.

3. **Slot Registration**: Actual slot registration pending upstream `@deepseek-ai/dsh-client-ui-agent-preset` availability.

4. **Bundle Activation**: Package needs bundle registration to be active in production profiles.

## Future Work

1. **Source Plugin Tracking**: Add plugin identity to tool and prompt metadata
2. **Enhanced Drift Detection**: Distinguish source updates from local edits
3. **Model-Visible Preview Tool**: Implement `agent_preview` tool with ToolView display (documented in TOOLVIEW_CONTRACT.md)
4. **HMR Verification**: Full hot-module reload testing in real runtime
5. **Performance Optimization**: Cache projection results for repeated access

## References

- OpenSpec Change: dsh-agent-composition-preview-v1
- Spec: dsh-agent-preview-experience
- Implementation: packages/preset/agent-composition-preview/, packages/client/ui-agent-preset/
- Tests: apps/cli/tests/composition.e2e.ts, packages/client/ui-agent-preset/tests/
- ToolView Contract: packages/client/ui-agent-preset/TOOLVIEW_CONTRACT.md

---

**Agent Note Category**: architecture  
**Related Changes**: dsh-agent-composition-preview-v1  
**Owner**: DSH maintainers