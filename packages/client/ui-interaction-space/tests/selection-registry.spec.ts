import { describe, expect, it } from 'vitest'
import { SelectionActionRegistryV2 } from '../src/selection/registry.ts'
import { BUILTIN_CONTEXT_ORDERS, BUILTIN_SELECTION_ACTIONS, registerBuiltinSelectionActions, SELECTION_CAPABILITY_BATCH, SELECTION_CAPABILITY_CONVERSATION, SELECTION_CAPABILITY_EDIT, SELECTION_CAPABILITY_REFERENCE, SELECTION_CAPABILITY_REFERENCE_ACTIVATE, SELECTION_CAPABILITY_TARGET_CHOOSE, SELECTION_CAPABILITY_TEXT_QUOTE } from '../src/selection/builtin-actions.ts'
import type { SelectionContextKindV2 } from '../src/selection/contracts.ts'

function descriptor(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    label: { default: id },
    contexts: ['text'] as SelectionContextKindV2[],
    priority: 50,
    defaultSlot: 'more',
    visibility: 'optional',
    danger: 'safe',
    owner: 'dsh',
    presentation: 'local',
    ...overrides,
  }
}

const ALL_CAPS = [SELECTION_CAPABILITY_CONVERSATION, SELECTION_CAPABILITY_REFERENCE, SELECTION_CAPABILITY_REFERENCE_ACTIVATE, SELECTION_CAPABILITY_TEXT_QUOTE, SELECTION_CAPABILITY_TARGET_CHOOSE, SELECTION_CAPABILITY_EDIT, SELECTION_CAPABILITY_BATCH]

describe('SelectionActionRegistryV2', () => {
  it('registers built-ins and resolves the text matrix (1+2+More)', () => {
    const registry = new SelectionActionRegistryV2()
    registerBuiltinSelectionActions(registry)
    const resolved = registry.resolve({ kind: 'text', capabilities: ALL_CAPS }, { customOrder: BUILTIN_CONTEXT_ORDERS.text })
    expect(resolved.primary?.descriptor.id).toBe('dsh:reference')
    expect(resolved.secondary.map(view => view.descriptor.id)).toEqual(['dsh:ask-with-reference', 'dsh:ask'])
    expect(resolved.more.map(view => view.descriptor.id)).toEqual(['dsh:comment', 'dsh:copy-quote', 'dsh:reference-details', 'dsh:edit', 'dsh:add-to-batch', 'dsh:add-text-quote', 'dsh:choose-conversation', 'dsh:open-full'])
    registry.dispose()
  })

  it('keeps reference primary for editable controls', () => {
    const registry = new SelectionActionRegistryV2()
    registerBuiltinSelectionActions(registry)
    const resolved = registry.resolve({ kind: 'editable-control', capabilities: ALL_CAPS }, { customOrder: BUILTIN_CONTEXT_ORDERS['editable-control'] })
    expect(resolved.primary?.descriptor.id).toBe('dsh:reference')
    expect(resolved.secondary.map(view => view.descriptor.id)).toEqual(['dsh:ask-with-reference', 'dsh:edit'])
    registry.dispose()
  })

  it('keeps reference primary for table and image contexts', () => {
    const registry = new SelectionActionRegistryV2()
    registerBuiltinSelectionActions(registry)
    const table = registry.resolve({ kind: 'table-range', capabilities: ALL_CAPS }, { customOrder: BUILTIN_CONTEXT_ORDERS['table-range'] })
    expect(table.primary?.descriptor.id).toBe('dsh:reference')
    const image = registry.resolve({ kind: 'image-region', capabilities: ALL_CAPS }, { customOrder: BUILTIN_CONTEXT_ORDERS['image-region'] })
    expect(image.primary?.descriptor.id).toBe('dsh:reference')
    expect(image.more.map(view => view.descriptor.id)).toContain('dsh:edit')
    registry.dispose()
  })

  it('puts capability-missing actions only in More disabled with reason', () => {
    const registry = new SelectionActionRegistryV2()
    registerBuiltinSelectionActions(registry)
    // edit capability 缺失：text 场景
    const resolved = registry.resolve({ kind: 'text', capabilities: [SELECTION_CAPABILITY_CONVERSATION, SELECTION_CAPABILITY_BATCH] }, { customOrder: BUILTIN_CONTEXT_ORDERS.text })
    expect(resolved.primary?.descriptor.id).toBe('dsh:ask')
    const editView = resolved.more.find(view => view.descriptor.id === 'dsh:edit')
    expect(editView?.disabled).toBe(true)
    expect(editView?.disabledReason?.default).toBeDefined()
    // 不出现可点击但无 owner 的 edit
    expect(resolved.secondary.some(view => view.descriptor.id === 'dsh:edit')).toBe(false)
    registry.dispose()
  })

  it('gates the conversation-first reference actions on probe capabilities', () => {
    const registry = new SelectionActionRegistryV2()
    registerBuiltinSelectionActions(registry)
    const byId = new Map(BUILTIN_SELECTION_ACTIONS.map(item => [item.id, item]))
    // canonical id / slot / owner 固定合同
    expect(byId.get('dsh:ask-with-reference')).toMatchObject({ defaultSlot: 'secondary', owner: 'host', presentation: 'pane', danger: 'safe', priority: 95 })
    expect(byId.get('dsh:reference-details')).toMatchObject({ defaultSlot: 'more', owner: 'host', presentation: 'popover', danger: 'safe', priority: 65 })
    expect(byId.get('dsh:add-text-quote')).toMatchObject({ defaultSlot: 'more', owner: 'host', presentation: 'pane', danger: 'safe', priority: 55 })
    expect(byId.get('dsh:choose-conversation')).toMatchObject({ defaultSlot: 'more', owner: 'host', danger: 'safe' })
    expect(byId.get('dsh:reference')?.label).toMatchObject({ default: 'Add to chat', zh: '添加到对话' })

    // 只有 structured reference 能力：details 可用，ask-with-reference 因
    // activation probe 缺席禁用并给原因，不伪造可聚焦的部分动作。
    const structuredOnly = registry.resolve({ kind: 'text', capabilities: [SELECTION_CAPABILITY_REFERENCE] }, { customOrder: BUILTIN_CONTEXT_ORDERS.text })
    expect(structuredOnly.primary?.descriptor.id).toBe('dsh:reference')
    const askWithReference = structuredOnly.more.find(view => view.descriptor.id === 'dsh:ask-with-reference')
    expect(askWithReference?.disabled).toBe(true)
    expect(askWithReference?.disabledReason?.default).toContain('focus the composer')
    expect(structuredOnly.more.find(view => view.descriptor.id === 'dsh:reference-details')?.disabled).toBe(false)
    expect(structuredOnly.more.find(view => view.descriptor.id === 'dsh:add-text-quote')?.disabled).toBe(true)
    expect(structuredOnly.more.find(view => view.descriptor.id === 'dsh:choose-conversation')?.disabled).toBe(true)

    // activation probe 通过后 ask-with-reference 落在 primary 旁的 secondary。
    const withActivation = registry.resolve({ kind: 'text', capabilities: [SELECTION_CAPABILITY_REFERENCE, SELECTION_CAPABILITY_REFERENCE_ACTIVATE, SELECTION_CAPABILITY_TARGET_CHOOSE, SELECTION_CAPABILITY_TEXT_QUOTE] }, { customOrder: BUILTIN_CONTEXT_ORDERS.text })
    expect(withActivation.secondary[0]?.descriptor.id).toBe('dsh:ask-with-reference')
    expect(withActivation.more.find(view => view.descriptor.id === 'dsh:choose-conversation')?.disabled).toBe(false)
    registry.dispose()
  })

  it('hides optional actions the user turned off and honors hidden built-ins', () => {
    const registry = new SelectionActionRegistryV2()
    registerBuiltinSelectionActions(registry)
    registry.register(descriptor('acme:review'))
    const hidden = new Set(['acme:review', 'dsh:open-full'])
    const resolved = registry.resolve({ kind: 'text', capabilities: ALL_CAPS }, { hiddenActionIds: hidden, customOrder: BUILTIN_CONTEXT_ORDERS.text })
    const ids = [resolved.primary, ...resolved.secondary, ...resolved.more].map(view => view.descriptor.id)
    expect(ids).not.toContain('acme:review')
    expect(ids).not.toContain('dsh:open-full')
    registry.dispose()
  })

  it('custom order reorders but never promotes disabled or confirm-danger actions', () => {
    const registry = new SelectionActionRegistryV2()
    registerBuiltinSelectionActions(registry)
    registry.register(descriptor('acme:nuke', { danger: 'confirm' }))
    // edit 无 capability 仍被排第一位：只进 More disabled
    const resolved = registry.resolve({ kind: 'text', capabilities: [] }, { customOrder: ['dsh:edit', 'acme:nuke', 'dsh:copy-quote'] })
    expect(resolved.primary?.descriptor.id).toBe('dsh:copy-quote')
    const editView = resolved.more.find(view => view.descriptor.id === 'dsh:edit')
    expect(editView?.disabled).toBe(true)
    expect(resolved.more.some(view => view.descriptor.id === 'acme:nuke')).toBe(true)
    expect(resolved.secondary.some(view => view.descriptor.id === 'acme:nuke')).toBe(false)
    registry.dispose()
  })

  it('deterministic tie-break: priority DESC then install order then id ASC', () => {
    const registry = new SelectionActionRegistryV2()
    registry.register(descriptor('z:last', { priority: 10 }))
    registry.register(descriptor('b:mid', { priority: 10 }))
    registry.register(descriptor('a:top', { priority: 20 }))
    const resolved = registry.resolve({ kind: 'text', capabilities: [] })
    expect(resolved.primary?.descriptor.id).toBe('a:top')
    expect(resolved.secondary[0]?.descriptor.id).toBe('z:last')
    expect(resolved.secondary[1]?.descriptor.id).toBe('b:mid')
    registry.dispose()
  })

  it('rejects duplicate ids/aliases and keeps other actions working', () => {
    const registry = new SelectionActionRegistryV2()
    registerBuiltinSelectionActions(registry)
    const before = registry.resolve({ kind: 'text', capabilities: ALL_CAPS }, { customOrder: BUILTIN_CONTEXT_ORDERS.text })
    expect(registry.register(descriptor('dsh:ask')).rejection).toBe('duplicate_registration')
    expect(registry.register(descriptor('acme:ask', { aliases: ['ask'] })).rejection).toBe('duplicate_id_or_alias')
    const after = registry.resolve({ kind: 'text', capabilities: ALL_CAPS }, { customOrder: BUILTIN_CONTEXT_ORDERS.text })
    expect(after.primary?.descriptor.id).toBe(before.primary?.descriptor.id)
    registry.dispose()
  })

  it('dispose removes extension actions from projections (hot unload)', () => {
    const registry = new SelectionActionRegistryV2()
    registerBuiltinSelectionActions(registry)
    const result = registry.register(descriptor('acme:review', { priority: 99 }))
    expect(result.ok).toBe(true)
    let resolved = registry.resolve({ kind: 'text', capabilities: [] })
    expect(resolved.primary?.descriptor.id).toBe('acme:review')
    result.handle?.dispose()
    resolved = registry.resolve({ kind: 'text', capabilities: [] })
    expect(resolved.primary?.descriptor.id).not.toBe('acme:review')
    registry.dispose()
  })

  it('V1 aliases resolve to canonical descriptors', () => {
    const registry = new SelectionActionRegistryV2()
    registerBuiltinSelectionActions(registry)
    expect(registry.lookup('agent-edit')?.id).toBe('dsh:edit')
    expect(registry.lookup('copy-quote')?.id).toBe('dsh:copy-quote')
    expect(registry.lookup('nope')).toBeUndefined()
    registry.dispose()
  })

  it('built-in set is complete and every context order only lists registered ids', () => {
    const registry = new SelectionActionRegistryV2()
    registerBuiltinSelectionActions(registry)
    const ids = new Set(registry.list().map(d => d.id))
    expect(BUILTIN_SELECTION_ACTIONS.length).toBeGreaterThanOrEqual(7)
    for (const order of Object.values(BUILTIN_CONTEXT_ORDERS)) {
      for (const id of order) expect(ids.has(id)).toBe(true)
    }
    registry.dispose()
  })
})
