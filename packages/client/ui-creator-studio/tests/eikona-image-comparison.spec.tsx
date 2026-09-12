// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EikonaImageComparison, type EikonaComparisonItem } from '../src/eikona-image-comparison.tsx'
import { defaultCreatorStudioTranslator as t } from '../src/locales.ts'
import type { EikonaImageQuery, EikonaImageResult } from '@yeisme/dsh-creator-studio-host/contracts'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const items: [EikonaComparisonItem, EikonaComparisonItem] = [
  { ref: 'eikona://artifacts/run/left', contentDigest: 'a'.repeat(64), title: 'Left candidate' },
  { ref: 'eikona://artifacts/run/right', contentDigest: 'b'.repeat(64), title: 'Right candidate' },
]
const ready = (query: EikonaImageQuery): EikonaImageResult => ({ status: 'ready', value: { artifactRef: query.artifactRef, contentDigest: query.contentDigest, mediaType: 'image/png', byteLength: 4, base64: 'iVBORw==' } })
function urls() {
  const create = vi.fn().mockReturnValueOnce('blob:left').mockReturnValueOnce('blob:right'), revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
  return { create, revoke }
}
it('requires explicit confirmation, pins both claims and releases both images on close', async () => {
  const { create, revoke } = urls(), read = vi.fn(async (query: EikonaImageQuery) => ready(query))
  render(<EikonaImageComparison items={items} read={read} t={t} />)
  expect(read).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: t('eikona.loadComparison') }))
  await screen.findByRole('button', { name: t('eikona.compareSide') })
  expect(read).toHaveBeenCalledTimes(2)
  for (const [index, item] of items.entries()) expect(read.mock.calls[index]?.[0]).toMatchObject({ artifactRef: item.ref, contentDigest: item.contentDigest, confirmed: true })
  expect(read.mock.calls[0]?.[0].idempotencyKey).not.toBe(read.mock.calls[1]?.[0].idempotencyKey)
  expect(create).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByRole('button', { name: t('eikona.compareSide') }))
  expect(document.querySelector('[data-dsh-media-compare]')?.getAttribute('data-mode')).toBe('side-by-side')
  fireEvent.click(screen.getByRole('button', { name: t('eikona.closePreview') }))
  expect(revoke.mock.calls).toEqual([['blob:left'], ['blob:right']])
  expect(document.querySelector('[data-dsh-media-compare]')).toBeNull()
})
it('does not display a partial pair and retains read identities for an explicit retry', async () => {
  const { create } = urls()
  let fail = true
  const read = vi.fn(async (query: EikonaImageQuery): Promise<EikonaImageResult> => fail && query.artifactRef === items[1].ref ? { status: 'permission_denied' } : ready(query))
  render(<EikonaImageComparison items={items} read={read} t={t} />)
  fireEvent.click(screen.getByRole('button', { name: t('eikona.loadComparison') }))
  await screen.findByText(t('eikona.previewFailed'))
  expect(create).not.toHaveBeenCalled()
  fail = false
  fireEvent.click(screen.getByRole('button', { name: t('eikona.loadComparison') }))
  await screen.findByRole('button', { name: t('eikona.compareSide') })
  expect(read.mock.calls[2]?.[0]).toEqual(read.mock.calls[0]?.[0])
  expect(read.mock.calls[3]?.[0]).toEqual(read.mock.calls[1]?.[0])
})
it('discards both late results after unmount without creating URLs', async () => {
  const { create } = urls(), finish: (() => void)[] = []
  const read = (query: EikonaImageQuery) => new Promise<EikonaImageResult>(resolve => finish.push(() => resolve(ready(query))))
  const view = render(<EikonaImageComparison items={items} read={read} t={t} />)
  fireEvent.click(screen.getByRole('button', { name: t('eikona.loadComparison') }))
  view.unmount()
  await act(async () => { finish.forEach(resolve => resolve()) })
  expect(create).not.toHaveBeenCalled()
})
