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

function renderDock(options: { draft?: string; storage?: Storage } = {}) {
  const setDraft = vi.fn()
  const submit = vi.fn()
  const utils = render(
    <SuggestionDock
      useProjection={(() => planValue) as never}
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
