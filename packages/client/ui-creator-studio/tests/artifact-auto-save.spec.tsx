// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CreatorArtifactAutoSave } from '../src/artifact-auto-save.tsx'
import { defaultCreatorStudioTranslator as t } from '../src/locales.ts'
afterEach(() => { cleanup(); vi.useRealTimers() })
it('debounces edits, cancels on unmount, and never retries an unconfirmed save automatically', async () => {
  vi.useFakeTimers()
  const save = vi.fn(async () => false)
  const props = { available: true, blocked: false, dirty: true, revision: 'one', save, t }
  const view = render(<CreatorArtifactAutoSave {...props} />)
  fireEvent.click(screen.getByRole('checkbox', { name: '自动保存当前成果' }))
  await act(async () => { await vi.advanceTimersByTimeAsync(600) })
  view.rerender(<CreatorArtifactAutoSave {...props} revision="two" />)
  await act(async () => { await vi.advanceTimersByTimeAsync(600) })
  expect(save).not.toHaveBeenCalled()
  await act(async () => { await vi.advanceTimersByTimeAsync(200) })
  expect(save).toHaveBeenCalledTimes(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
  expect(save).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: '恢复自动保存' }))
  view.unmount()
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(save).toHaveBeenCalledTimes(1)
})
