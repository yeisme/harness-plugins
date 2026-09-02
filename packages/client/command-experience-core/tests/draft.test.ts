import { describe, expect, it } from 'vitest'
import {
  buildP0Catalog,
  commandDraftReducer,
  createInitialDraft,
  draftAllowsBareEnter,
  draftCanDispatch,
} from '../src/index'

describe('CommandDraftV1', () => {
  const catalog = buildP0Catalog({
    availableActions: new Set([
      'open-session',
      'new-chat',
      'fork-chat',
      'rename-session',
      'compact-context',
      'set-model',
      'set-permissions',
      'delete-session',
    ]),
  })
  const session = catalog.find((item) => item.canonicalName === 'session')!
  const compact = catalog.find((item) => item.canonicalName === 'compact')!
  const del = catalog.find((item) => item.canonicalName === 'delete')!
  const rename = catalog.find((item) => item.canonicalName === 'rename')!
  const status = catalog.find((item) => item.canonicalName === 'status')!

  it('restores the original composer draft through layered Escape', () => {
    let draft = createInitialDraft()
    draft = commandDraftReducer(draft, {
      type: 'START_ASSIST',
      query: '/',
      originalDraft: 'keep this paragraph',
    })
    draft = commandDraftReducer(draft, { type: 'SELECT', command: session })
    expect(draft.step).toBe('selector')
    expect(draft.nestedSelectorOpen).toBe(true)
    expect(draft.visibleDraft).toBe('/session')

    draft = commandDraftReducer(draft, { type: 'ESCAPE' })
    expect(draft.step).toBe('selected')
    expect(draft.nestedSelectorOpen).toBe(false)

    draft = commandDraftReducer(draft, { type: 'ESCAPE' })
    expect(draft.step).toBe('idle')
    expect(draft.visibleDraft).toBe('keep this paragraph')
    expect(draft.canonicalName).toBeNull()
  })

  it('collects a command token, argument text, and selector ref without persisting raw args', () => {
    let draft = commandDraftReducer(createInitialDraft(), {
      type: 'START_ASSIST',
      query: '/rename',
      originalDraft: '',
    })
    draft = commandDraftReducer(draft, { type: 'SELECT', command: rename })
    expect(draft.step).toBe('argument')
    expect(draft.visibleDraft).toBe('/rename')
    draft = commandDraftReducer(draft, { type: 'SET_ARGUMENT', text: 'New title' })
    expect(draft.argumentText).toBe('New title')
    expect(draft.visibleDraft).toBe('/rename New title')
    expect(JSON.stringify(draft)).not.toMatch(/credential|apiKey|\/home\//)

    draft = commandDraftReducer(createInitialDraft(), {
      type: 'START_ASSIST',
      query: '/session',
      originalDraft: '',
    })
    draft = commandDraftReducer(draft, { type: 'SELECT', command: session })
    expect(draftCanDispatch(draft, session)).toBe(false)
    draft = commandDraftReducer(draft, { type: 'SET_REF', ref: 'sess_abc' })
    expect(draft.selectedRef).toBe('sess_abc')
    expect(draftCanDispatch(draft, session)).toBe(true)
  })

  it('does not confirm non-safe commands on bare Enter', () => {
    let draft = commandDraftReducer(createInitialDraft(), {
      type: 'START_ASSIST',
      query: '/compact',
      originalDraft: '',
    })
    draft = commandDraftReducer(draft, { type: 'SELECT', command: compact })
    expect(draft.step).toBe('confirmation-inline')
    expect(draftAllowsBareEnter(draft)).toBe(false)
    const afterEnter = commandDraftReducer(draft, { type: 'ENTER' })
    expect(afterEnter.step).toBe('confirmation-inline')
    expect(afterEnter.receiptStatus).toBeNull()

    const confirmed = commandDraftReducer(draft, { type: 'CONFIRM' })
    expect(confirmed.step).toBe('dispatching')
    expect(confirmed.receiptStatus).toBe('pending')
  })

  it('uses blocking confirmation for destructive commands and ignores a second dispatch while pending', () => {
    let draft = commandDraftReducer(createInitialDraft(), {
      type: 'START_ASSIST',
      query: '/delete',
      originalDraft: '',
    })
    draft = commandDraftReducer(draft, { type: 'SELECT', command: del })
    expect(draft.step).toBe('selector')
    draft = commandDraftReducer(draft, { type: 'SET_REF', ref: 'sess_doomed' })
    draft = commandDraftReducer(draft, { type: 'REQUEST_CONFIRM' })
    expect(draft.step).toBe('confirmation-blocking')
    const entered = commandDraftReducer(draft, { type: 'ENTER' })
    expect(entered.step).toBe('confirmation-blocking')

    draft = commandDraftReducer(draft, { type: 'CONFIRM' })
    const correlationId = draft.correlationId
    expect(draft.step).toBe('dispatching')
    const duplicate = commandDraftReducer(draft, { type: 'DISPATCH', correlationId: 'other' })
    expect(duplicate.correlationId).toBe(correlationId)
    expect(duplicate.step).toBe('dispatching')
  })

  it('does not dispatch a disabled command from assist', () => {
    const disabledCatalog = buildP0Catalog()
    const mcp = disabledCatalog.find((item) => item.canonicalName === 'mcp')!
    let draft = commandDraftReducer(createInitialDraft(), {
      type: 'START_ASSIST',
      query: '/mcp',
      originalDraft: '',
    })
    draft = commandDraftReducer(draft, { type: 'SELECT', command: mcp })
    expect(draft.step).toBe('assist')
    expect(draftCanDispatch(draft, mcp)).toBe(false)
    const dispatched = commandDraftReducer(draft, { type: 'ENTER' })
    expect(dispatched.receiptStatus).not.toBe('pending')
  })

  it('folds a matching receipt and ignores a stale correlation', () => {
    let draft = commandDraftReducer(createInitialDraft(), {
      type: 'START_ASSIST',
      query: '/status',
      originalDraft: 'hello',
    })
    draft = commandDraftReducer(draft, { type: 'SELECT', command: { ...status, availability: { state: 'available' } } })
    draft = commandDraftReducer(draft, { type: 'DISPATCH', correlationId: 'cmd-1' })
    const stale = commandDraftReducer(draft, {
      type: 'RECEIPT',
      status: 'success',
      correlationId: 'cmd-other',
    })
    expect(stale.step).toBe('dispatching')
    const done = commandDraftReducer(draft, {
      type: 'RECEIPT',
      status: 'success',
      correlationId: 'cmd-1',
      message: 'ok',
    })
    expect(done.step).toBe('receipt-success')
    expect(done.visibleDraft).toBe('')
  })
})
