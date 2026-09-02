import { describe, expect, it } from 'vitest'
import {
  SELECTION_CONTEXT_KINDS_V2,
  SELECTION_STABLE_DEBOUNCE_MS,
  V1_ACTION_ALIASES,
  resolveV1ActionAlias,
  validateSelectionActionDescriptor,
  validateSelectionContextV2,
} from '../src/selection/contracts.ts'

function validDescriptor(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'acme:review',
    label: { default: 'Review', zh: '审阅' },
    contexts: ['text', 'source'],
    priority: 50,
    defaultSlot: 'more',
    visibility: 'optional',
    danger: 'preview-first',
    owner: 'dsh',
    presentation: 'popover',
    ...overrides,
  }
}

describe('selection descriptor validation (fail-closed)', () => {
  it('accepts a valid descriptor', () => {
    const result = validateSelectionActionDescriptor(validDescriptor())
    expect(result.ok).toBe(true)
  })

  it('rejects non-namespaced id', () => {
    expect(validateSelectionActionDescriptor(validDescriptor({ id: 'review' })).rejection).toBe('id_not_namespaced')
    expect(validateSelectionActionDescriptor(validDescriptor({ id: 'Review:Act' })).rejection).toBe('id_not_namespaced')
  })

  it('rejects unknown context', () => {
    const result = validateSelectionActionDescriptor(validDescriptor({ contexts: ['text', 'hologram'] }))
    expect(result.ok).toBe(false)
    expect(result.ok === false ? result.rejection : undefined).toBe('unknown_context')
  })

  it('rejects oversized or non-object labels', () => {
    const long = 'x'.repeat(49)
    expect(validateSelectionActionDescriptor(validDescriptor({ label: { default: long } })).rejection).toBe('label_too_long')
    expect(validateSelectionActionDescriptor(validDescriptor({ label: 'Review' })).rejection).toBe('label_too_long')
    expect(validateSelectionActionDescriptor(validDescriptor({ shortLabel: { default: 'x'.repeat(17) } })).rejection).toBe('label_too_long')
  })

  it('rejects credential-shaped fields', () => {
    expect(validateSelectionActionDescriptor(validDescriptor({ label: { default: 'api_key reader' } })).rejection).toBe('credential_shaped_field')
    expect(validateSelectionActionDescriptor(validDescriptor({ id: 'acme:api-key' })).rejection).toBe('credential_shaped_field')
    expect(validateSelectionActionDescriptor(validDescriptor({ requires: ['secret-token'] })).rejection).toBe('credential_shaped_field')
  })

  it('rejects unknown enums, bad priority, malformed shortcut and callback-like extras', () => {
    expect(validateSelectionActionDescriptor(validDescriptor({ danger: 'yolo' })).rejection).toBe('invalid_shape')
    expect(validateSelectionActionDescriptor(validDescriptor({ priority: 101 })).rejection).toBe('invalid_shape')
    expect(validateSelectionActionDescriptor(validDescriptor({ shortcut: { key: 'Ctrl' } })).rejection).toBe('invalid_shape')
    // callback/HTML 字段：strict 校验按未知/非法形状拒绝
    expect(validateSelectionActionDescriptor(validDescriptor({ render: () => {} })).rejection).toBe('invalid_shape')
    expect(validateSelectionActionDescriptor(validDescriptor({ onClick: 'alert(1)' })).rejection).toBe('invalid_shape')
  })

  it('accepts a well-formed shortcut', () => {
    const result = validateSelectionActionDescriptor(validDescriptor({ shortcut: { key: 'Alt+Enter' } }))
    expect(result.ok).toBe(true)
  })
})

describe('V1 alias mapping', () => {
  it('maps all seven V1 toolbar ids to canonical ids', () => {
    expect(Object.keys(V1_ACTION_ALIASES).sort()).toEqual(['add-to-batch', 'agent-edit', 'ask', 'comment', 'copy-quote', 'edit', 'open-full'])
    expect(resolveV1ActionAlias('agent-edit')).toBe('dsh:edit')
    expect(resolveV1ActionAlias('ask')).toBe('dsh:ask')
    // 未知 id 原样返回（fail-closed 由调用方处理）
    expect(resolveV1ActionAlias('nope')).toBe('nope')
  })
})

describe('selection context validation', () => {
  function validContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      contextId: 'sel-1',
      kind: 'text',
      source: 'conversation',
      stableForMs: SELECTION_STABLE_DEBOUNCE_MS + 10,
      capabilities: ['conversation.composer'],
      sensitive: false,
      ...overrides,
    }
  }

  it('accepts a stable, non-sensitive context', () => {
    const result = validateSelectionContextV2(validContext())
    expect(result.ok).toBe(true)
  })

  it('rejects unstable, opt-out and sensitive contexts', () => {
    expect(validateSelectionContextV2(validContext({ stableForMs: 10 })).reason).toBe('unstable')
    expect(validateSelectionContextV2(validContext({ hostOptOut: true })).reason).toBe('opt_out')
    expect(validateSelectionContextV2(validContext({ sensitive: true })).reason).toBe('sensitive')
  })

  it('rejects unknown kind/source and oversized capabilities', () => {
    expect(validateSelectionContextV2(validContext({ kind: 'hologram' })).reason).toBe('invalid_shape')
    expect(validateSelectionContextV2(validContext({ source: 'cloud' })).reason).toBe('invalid_shape')
    expect(validateSelectionContextV2(validContext({ capabilities: new Array(33).fill('cap') })).reason).toBe('invalid_capabilities')
  })

  it('kind vocabulary covers the five V2 kinds', () => {
    expect([...SELECTION_CONTEXT_KINDS_V2].sort()).toEqual(['editable-control', 'image-region', 'source', 'table-range', 'text'])
  })
})
