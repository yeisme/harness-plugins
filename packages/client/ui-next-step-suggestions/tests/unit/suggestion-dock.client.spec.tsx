// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SuggestionDock } from '../../src/client/SuggestionDock.tsx'
import type { PlanOptionsProjectionValue } from '../../src/client/types.ts'

afterEach(cleanup)

const planValue: PlanOptionsProjectionValue = {
  latest: {
    planId: 'plan-1',
    round: 1,
    status: 'proposed',
    options: [
      { optionId: 'fast', title: '快速方案', summary: 'fast', markdown: '# Fast', recommended: true },
      { optionId: 'safe', title: '稳妥方案', summary: 'safe', markdown: '# Safe' },
    ],
  },
  revisions: [],
}

const emptySnapshot = {
  openState: 'open',
  removed: false,
  running: false,
  pending: [],
  partial: null,
  turnEnds: new Map(),
  nodes: [],
}

const completedSnapshot = {
  ...emptySnapshot,
  turnEnds: new Map([[3, 12]]),
  nodes: [{
    kind: 'assistant',
    seq: 11,
    turn: 3,
    step: 1,
    blocks: [{ kind: 'text', text: 'Finished the requested Web work.' }],
  }],
}

function memoryStorage(): Storage {
  const entries = new Map<string, string>()
  return {
    get length() { return entries.size },
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => [...entries.keys()][index] ?? null,
    removeItem: (key: string) => { entries.delete(key) },
    setItem: (key: string, value: string) => { entries.set(key, value) },
  }
}

function renderDock(options: {
  draft?: string
  storage?: Storage
  plan?: PlanOptionsProjectionValue | null
  snapshot?: typeof emptySnapshot
} = {}) {
  const setDraft = vi.fn()
  const submit = vi.fn()
  const projection = options.plan === undefined ? planValue : options.plan ?? undefined
  const snapshot = options.snapshot ?? emptySnapshot
  const utils = render(
    <SuggestionDock
      useSession={((selector: (state: typeof emptySnapshot) => unknown) => selector(snapshot)) as never}
      useProjection={(() => projection) as never}
      useInput={((selector: (state: { draft: string }) => string) => selector({ draft: options.draft ?? '' })) as never}
      inputActions={{ setDraft, submit } as never}
      getSources={() => []}
      storage={options.storage}
      t={((key: string) => key) as never}
    />,
  )
  return { setDraft, submit, ...utils }
}

describe('SuggestionDock', () => {
  it('renders nothing when there are no suggestions', () => {
    const { container } = render(
      <SuggestionDock
        useSession={((selector: (state: typeof emptySnapshot) => unknown) => selector(emptySnapshot)) as never}
        useProjection={(() => undefined) as never}
        useInput={((selector: (state: { draft: string }) => string) => selector({ draft: '' })) as never}
        inputActions={{ setDraft: vi.fn(), submit: vi.fn() } as never}
        getSources={() => []}
        t={((key: string) => key) as never}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders plan option chips', () => {
    renderDock()
    expect(screen.getByRole('button', { name: /快速方案/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /稳妥方案/ })).toBeTruthy()
  })

  it('shows a recap and exactly three fallback actions after completion', () => {
    renderDock({ plan: null, snapshot: completedSnapshot })
    expect(screen.getByText('Finished the requested Web work.')).toBeTruthy()
    expect(screen.getAllByRole('button')).toHaveLength(3)
    expect(screen.getByRole('button', { name: /suggestions.reviewResult/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /suggestions.runVerification/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /suggestions.continueNextStep/ })).toBeTruthy()
  })

  it('keeps specific owner suggestions ahead of the completion fallback', () => {
    renderDock({ snapshot: completedSnapshot })
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.queryByText('Finished the requested Web work.')).toBeNull()
  })

  it('clicking a fallback action writes the draft without submitting', () => {
    const { setDraft, submit } = renderDock({ plan: null, snapshot: completedSnapshot })
    fireEvent.click(screen.getByRole('button', { name: /suggestions.reviewResult/ }))
    expect(setDraft).toHaveBeenCalledWith('suggestions.prompt.reviewResult')
    expect(submit).not.toHaveBeenCalled()
  })

  it('clicking a chip fills the draft and does not submit', () => {
    const { setDraft, submit } = renderDock({ draft: 'existing' })
    fireEvent.click(screen.getByRole('button', { name: /快速方案/ }))
    expect(setDraft).toHaveBeenCalledWith('existing\n/plan-select {"optionId":"fast"}')
    expect(submit).not.toHaveBeenCalled()
  })

  it('multi-select apply appends all selected prompts', () => {
    const { setDraft } = renderDock({ draft: '' })
    fireEvent.click(screen.getByRole('checkbox', { name: /multiSelect/i }))
    fireEvent.click(screen.getByRole('button', { name: /快速方案/ }))
    fireEvent.click(screen.getByRole('button', { name: /稳妥方案/ }))
    fireEvent.click(screen.getByRole('button', { name: /suggestions.apply/ }))
    expect(setDraft).toHaveBeenCalledWith('/plan-select {"optionId":"fast"}\n/plan-select {"optionId":"safe"}')
  })

  it('parallel action composes a parallel prompt', () => {
    const { setDraft } = renderDock({ draft: '' })
    fireEvent.click(screen.getByRole('checkbox', { name: /multiSelect/i }))
    fireEvent.click(screen.getByRole('button', { name: /快速方案/ }))
    fireEvent.click(screen.getByRole('button', { name: /稳妥方案/ }))
    fireEvent.click(screen.getByRole('button', { name: /suggestions.parallel/ }))
    const called = setDraft.mock.calls[0]![0] as string
    expect(called).toContain('请并行执行以下方案')
    expect(called).toContain('/plan-select {"optionId":"fast"}')
    expect(called).toContain('/plan-select {"optionId":"safe"}')
  })

  it('cycles focus in multi-select and Escape clears selection and exits', () => {
    renderDock({ plan: null, snapshot: completedSnapshot })
    const multiSelect = screen.getByRole('checkbox', { name: /multiSelect/i }) as HTMLInputElement
    fireEvent.click(multiSelect)
    const chips = screen.getAllByRole('button')

    chips[0]!.focus()
    fireEvent.keyDown(chips[0]!, { key: 'Tab' })
    expect(document.activeElement).toBe(chips[1])
    fireEvent.keyDown(chips[1]!, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(chips[2])
    fireEvent.keyDown(chips[2]!, { key: 'Tab' })
    expect(document.activeElement).toBe(chips[0])
    fireEvent.keyDown(chips[0]!, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(chips[2])

    fireEvent.click(chips[2]!)
    expect(chips[2]!.getAttribute('aria-pressed')).toBe('true')
    fireEvent.keyDown(chips[2]!, { key: 'Escape' })
    expect(multiSelect.checked).toBe(false)
    expect(chips[2]!.getAttribute('aria-pressed')).toBeNull()
  })
})

describe('SuggestionDock apply preference', () => {
  it('toggles the replace preference and replaces the draft on chip click', () => {
    const { setDraft } = renderDock({ draft: 'existing' })
    fireEvent.click(screen.getByRole('button', { name: /快速方案/ }))
    expect(setDraft).toHaveBeenLastCalledWith('existing\n/plan-select {"optionId":"fast"}')
    fireEvent.click(screen.getByRole('checkbox', { name: /replaceMode/i }))
    fireEvent.click(screen.getByRole('button', { name: /快速方案/ }))
    expect(setDraft).toHaveBeenLastCalledWith('/plan-select {"optionId":"fast"}')
  })

  it('persists the preference across remounts', () => {
    const storage = memoryStorage()
    const first = renderDock({ storage })
    fireEvent.click(first.getByRole('checkbox', { name: /replaceMode/i }))
    first.unmount()

    const second = renderDock({ draft: 'kept draft', storage })
    fireEvent.click(second.getByRole('button', { name: /快速方案/ }))
    expect(second.setDraft).toHaveBeenLastCalledWith('/plan-select {"optionId":"fast"}')
    expect(storage.getItem('nextStepSuggestions.applyPreference')).toBe('replace')
  })

  it('multi-select apply replaces the draft when the preference is replace', () => {
    const { setDraft } = renderDock({ draft: 'old' })
    fireEvent.click(screen.getByRole('checkbox', { name: /replaceMode/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /multiSelect/i }))
    fireEvent.click(screen.getByRole('button', { name: /快速方案/ }))
    fireEvent.click(screen.getByRole('button', { name: /稳妥方案/ }))
    fireEvent.click(screen.getByRole('button', { name: /suggestions.apply/ }))
    expect(setDraft).toHaveBeenLastCalledWith('/plan-select {"optionId":"fast"}\n/plan-select {"optionId":"safe"}')
  })
})
