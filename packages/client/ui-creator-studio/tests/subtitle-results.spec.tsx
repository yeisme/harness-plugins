// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ArtifactRefV1, PaneActionReceiptV1 } from '@yeisme/dsh-pane-protocol'
import { CreatorSubtitleResults } from '../src/subtitle-results.tsx'
import { createCreatorStudioTranslator } from '../src/locales.ts'

const artifact: ArtifactRefV1 = { schema: 'pane.artifact.v1alpha1', owner: 'sonora', kind: 'subtitle', ref: 'sonora://subtitle-export/test', version: 'digest-one', mediaType: 'text/vtt', title: 'WebVTT', evidenceRefs: [], capabilities: [] }
const receipt: PaneActionReceiptV1 = { status: 'completed', owner: 'sonora', actionId: 'subtitle.export', receiptRef: artifact.ref, outputArtifacts: [artifact] }
const content = 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\n字幕内容\n'
const result = { artifact, contentRevision: artifact.version, content }
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

it.each(['zh', 'en'] as const)('opens only on request and downloads the verified complete text', async messages => {
  const t = createCreatorStudioTranslator(messages)
  const read = vi.fn(async () => result)
  const createURL = vi.fn((_blob: Blob) => 'blob:fixture')
  const revokeURL = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: createURL, revokeObjectURL: revokeURL })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  const ui = render(<CreatorSubtitleResults receipt={receipt} read={read} t={t} />)
  expect(read).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: t('subtitle.results.open', { title: 'WebVTT' }) }))
  await waitFor(() => expect(ui.container.textContent).toContain('字幕内容'))
  expect(read).toHaveBeenCalledWith(artifact)
  vi.useFakeTimers()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: t('subtitle.results.download') })) })
  const blob = createURL.mock.calls[0]![0] as Blob
  expect(blob.size).toBe(new TextEncoder().encode(content).byteLength)
  expect(blob.type).toBe('text/vtt; charset=utf-8')
  expect(click.mock.instances[0]?.download).toBe('subtitles.vtt')
  expect(read).toHaveBeenCalledTimes(2)
  act(() => { vi.advanceTimersByTime(1000) })
  expect(revokeURL).toHaveBeenCalledWith('blob:fixture')
})

it('does not turn unavailable or mismatched content into a downloadable file', async () => {
  const t = createCreatorStudioTranslator('en')
  const read = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce({ ...result, contentRevision: 'wrong-version' })
  render(<CreatorSubtitleResults receipt={receipt} read={read} t={t} />)
  fireEvent.click(screen.getByRole('button', { name: 'View WebVTT' }))
  await screen.findByText(t('subtitle.results.unavailable'))
  expect(screen.queryByRole('button', { name: t('subtitle.results.download') })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: t('state.retry') }))
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
  expect(screen.queryByRole('button', { name: t('subtitle.results.download') })).toBeNull()
})

it('rechecks authorization at download instead of saving cached preview text', async () => {
  const t = createCreatorStudioTranslator('en')
  const read = vi.fn().mockResolvedValueOnce(result).mockResolvedValueOnce(undefined)
  const createURL = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: createURL, revokeObjectURL: vi.fn() })
  render(<CreatorSubtitleResults receipt={receipt} read={read} t={t} />)
  fireEvent.click(screen.getByRole('button', { name: 'View WebVTT' }))
  await screen.findByRole('button', { name: t('subtitle.results.download') })
  fireEvent.click(screen.getByRole('button', { name: t('subtitle.results.download') }))
  await screen.findByText(t('subtitle.results.unavailable'))
  expect(read).toHaveBeenCalledTimes(2)
  expect(createURL).not.toHaveBeenCalled()
})

it('keeps the current reading position when a new receipt arrives', async () => {
  const t = createCreatorStudioTranslator('en')
  const read = vi.fn(async () => result)
  const ui = render(<CreatorSubtitleResults receipt={receipt} read={read} t={t} />)
  fireEvent.click(screen.getByRole('button', { name: 'View WebVTT' }))
  await waitFor(() => expect(ui.container.textContent).toContain('字幕内容'))
  ui.rerender(<CreatorSubtitleResults receipt={{ ...receipt, outputArtifacts: [{ ...artifact, ref: 'sonora://subtitle-export/new', title: 'New export' }] }} read={read} t={t} />)
  expect(ui.container.textContent).toContain('字幕内容')
  expect(screen.getByRole('button', { name: 'View New export' })).toBeTruthy()
  expect(screen.getByText('Viewing: WebVTT · Version digest-one')).toBeTruthy()
  expect(read).toHaveBeenCalledTimes(1)
})

it('discards late reads when the project context key changes', async () => {
  const t = createCreatorStudioTranslator('en')
  let resolve!: (value: typeof result) => void
  const read = vi.fn(() => new Promise<typeof result>(done => { resolve = done }))
  const ui = render(<CreatorSubtitleResults key="project-one" receipt={receipt} read={read} t={t} />)
  fireEvent.click(screen.getByRole('button', { name: 'View WebVTT' }))
  ui.rerender(<CreatorSubtitleResults key="project-two" receipt={null} read={read} t={t} />)
  await act(async () => { resolve(result) })
  expect(ui.container.textContent).not.toContain('字幕内容')
})
