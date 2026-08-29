// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'

afterEach(() => { cleanup() })
import { EditInlineEditor, makeEditAction } from '../src/client/edit.tsx'
import { RetryButton } from '../src/client/retry.tsx'
import { computeEditTarget } from '../src/client/boundary.ts'

/** 6.4 a11y + 6.5 附件显式禁用（非文本不静默丢失）组件级验证。 */

function userNode(seq: number, content: unknown[]) {
  return { kind: 'user', seq, content, time: 0 }
}

function snapshotOf(nodes: unknown[], turnEnds: number[]) {
  return { nodes, turnEnds: new Set(turnEnds), removed: false, running: false }
}

/** Stable snapshot identity: uSES re-renders forever if getSnapshot allocates. */
const idleState = { phase: 'idle' as const }
const fakeController = {
  store: { subscribe: () => () => {}, getSnapshot: () => idleState },
  run: async () => {},
  reset: () => {},
  supportsFirstRound: () => false,
} as never

const t = (key: string) => key
const useSession = (select: (value: never) => unknown) => select(snapshotOf([], []) as never)

describe('EditInlineEditor a11y (6.4)', () => {
  it('carries group semantics, describedby wiring, autofocus, and a saving status announcement', () => {
    const html = renderToStaticMarkup(createElement(EditInlineEditor, {
      initialText: 'hello', saving: true, error: 'boom',
      saveLabel: 'Save', cancelLabel: 'Cancel', savingLabel: 'Saving…', emptyLabel: 'Empty',
      placeholder: 'Edit message', hint: 'Creates a branch',
      onSave: () => {}, onCancel: () => {},
    }))
    expect(html).toContain('role="group"')
    expect(html).toContain('aria-describedby')
    expect(html).toContain('autofocus')
    expect(html).toContain('role="status"')
    expect(html).toContain('Saving…')
    expect(html).toContain('role="alert"')
  })
})

describe('Edit attachment boundary (6.5)', () => {
  const imageContent = [{ type: 'image_url', imageUrl: { url: 'blob:x' } }, { type: 'text', text: 'look' }]
  const textContent = [{ type: 'text', text: 'plain' }]

  it('boundary returns not-text for messages carrying non-text blocks', () => {
    const decision = computeEditTarget(snapshotOf([userNode(10, imageContent)], [3, 12]) as never, 10)
    expect(decision).toEqual({ ok: false, reason: 'not-text' })
    const ok = computeEditTarget(snapshotOf([userNode(10, textContent)], [3, 12]) as never, 10)
    expect(ok.ok).toBe(true)
  })

  it('renders a disabled trigger with an sr-only reason and never an editor for image messages', () => {
    const EditAction = makeEditAction(fakeController)
    const snap = snapshotOf([userNode(10, imageContent)], [3, 12])
    const { container } = render(createElement(EditAction, {
      seq: 10,
      useSession: (select: (value: never) => unknown) => select(snap as never),
      sessionId: 's1' as never,
      t,
    }))
    const html = container.innerHTML
    expect(html).toContain('disabled')
    expect(html).toContain('role="note"')
    expect(html).toContain('edit.disabled.notText')
    expect(html).toContain('aria-label="edit.trigger"')
    expect(container.querySelector('button')?.querySelector('svg')).not.toBeNull()
    expect(container.querySelector('button')?.textContent).toBe('')
    expect(html).not.toContain('<textarea')
  })
})

describe('RetryButton a11y (6.4)', () => {
  it('exposes the disable reason as sr-only text and announces loading', () => {
    const disabled = renderToStaticMarkup(createElement(RetryButton, {
      disabled: true, disabledReason: 'Only text', label: 'Retry', loadingLabel: 'Retrying', onRetry: () => {},
    }))
    expect(disabled).toContain('role="note"')
    expect(disabled).toContain('Only text')
    const loading = renderToStaticMarkup(createElement(RetryButton, {
      disabled: false, loading: true, label: 'Retry', loadingLabel: 'Retrying', onRetry: () => {},
    }))
    expect(loading).toContain('aria-busy="true"')
    expect(loading).toContain('role="status"')
  })
})
