// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EikonaAssetBrowser } from '../src/eikona-asset-browser.tsx'
import { defaultCreatorStudioTranslator as t } from '../src/locales.ts'
import type { EikonaAssetPage, EikonaImageResult } from '@yeisme/dsh-creator-studio-host/contracts'
afterEach(cleanup)
it('selects only a fixed candidate explicitly and drops late selection feedback after project switch', async () => {
  const selection = { artifactRef: 'eikona://artifacts/run/one', contentDigest: 'a'.repeat(64) }
  const read = vi.fn(async (): Promise<EikonaAssetPage> => ({ status: 'ready', items: [
    { ref: selection.artifactRef, contentDigest: selection.contentDigest, title: 'Fixed image', versionStatus: 'observed_digest' },
    { ref: 'eikona://artifacts/run/legacy', title: 'Legacy image', versionStatus: 'unverified' },
  ] }))
  let finish!: (value: any) => void
  const selectCandidate = vi.fn(() => new Promise<any>(resolve => { finish = resolve }))
  const view = render(<EikonaAssetBrowser scopeKey="one" read={read} selectCandidate={selectCandidate} t={t} />)
  fireEvent.click(screen.getByRole('button', { name: t('eikona.loadAssets') }))
  await screen.findByText('Fixed image')
  const buttons = screen.getAllByRole('button', { name: t('eikona.selectForAdoption') })
  expect((buttons[1] as HTMLButtonElement).disabled).toBe(true)
  expect(selectCandidate).not.toHaveBeenCalled()
  fireEvent.click(buttons[0]!)
  fireEvent.click(buttons[0]!)
  expect(selectCandidate).toHaveBeenCalledExactlyOnceWith({ selection })
  view.rerender(<EikonaAssetBrowser scopeKey="two" read={read} selectCandidate={selectCandidate} t={t} />)
  await act(async () => { finish({ status: 'selected', selection }) })
  expect(screen.queryByText(t('eikona.candidateSelected'))).toBeNull()
  expect(screen.queryByText('Fixed image')).toBeNull()
})

it('reports explicit selection and clearing separately from adopting a result', async () => {
  const selection = { artifactRef: 'eikona://artifacts/run/one', contentDigest: 'a'.repeat(64) }
  const selectCandidate = vi.fn().mockResolvedValueOnce({ status: 'selected', selection }).mockResolvedValueOnce({ status: 'cleared' })
  const read = vi.fn(async (): Promise<EikonaAssetPage> => ({ status: 'ready', items: [{ ref: selection.artifactRef, contentDigest: selection.contentDigest, title: 'Fixed', versionStatus: 'observed_digest' }] }))
  render(<EikonaAssetBrowser scopeKey="one" read={read} selectCandidate={selectCandidate} t={t} />)
  fireEvent.click(screen.getByRole('button', { name: t('eikona.loadAssets') }))
  await screen.findByText('Fixed')
  fireEvent.click(screen.getByRole('button', { name: t('eikona.selectForAdoption') }))
  await screen.findByText(t('eikona.candidateSelected'))
  expect(screen.queryByRole('checkbox')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: t('eikona.clearAdoptionSelection') }))
  await screen.findByText(t('eikona.selectionCleared'))
  expect(selectCandidate.mock.calls[1]).toEqual([{ selection: null }])
})
it('keeps fixed selections across pages and can clear them without reading images', async () => {
  const page = (id: string, cursor?: string): EikonaAssetPage => ({ status: 'ready', items: [{ ref: `eikona://artifacts/run/${id}`, title: id, versionStatus: 'observed_digest', contentDigest: id.repeat(64), mediaType: 'image/png' }], ...(cursor ? { nextCursor: cursor } : {}) })
  const read = vi.fn().mockResolvedValueOnce(page('a', 'second')).mockResolvedValueOnce(page('b', 'third')).mockResolvedValueOnce(page('c'))
  const readImage = vi.fn(async (): Promise<EikonaImageResult> => ({ status: 'unavailable' }))
  render(<EikonaAssetBrowser scopeKey="one" read={read} readImage={readImage} t={t} />)
  fireEvent.click(screen.getByRole('button', { name: t('eikona.loadAssets') }))
  await screen.findByText('a')
  fireEvent.click(screen.getByRole('button', { name: t('eikona.selectComparison') }))
  fireEvent.click(screen.getByRole('button', { name: t('eikona.nextAssets') }))
  await screen.findByText('b')
  fireEvent.click(screen.getByRole('button', { name: t('eikona.selectComparison') }))
  expect(screen.getByText('a · b')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: t('eikona.nextAssets') }))
  await screen.findByText('c')
  expect((screen.getByRole('button', { name: t('eikona.selectComparison') }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: t('eikona.clearComparison') }))
  expect(screen.queryByText('a · b')).toBeNull()
  expect((screen.getByRole('button', { name: t('eikona.selectComparison') }) as HTMLButtonElement).disabled).toBe(false)
  expect(readImage).not.toHaveBeenCalled()
})
const first: EikonaAssetPage = { status: 'ready', items: [{ ref: 'eikona://artifacts/run/one', title: 'First asset', versionStatus: 'unverified' }], nextCursor: 'next-one' }
it('loads explicitly, retains a page after failure and navigates owner cursors', async () => {
  const read = vi.fn<(input: { cursor?: string; limit: number }) => Promise<EikonaAssetPage>>()
    .mockResolvedValueOnce(first).mockResolvedValueOnce({ status: 'unavailable' })
    .mockResolvedValueOnce({ status: 'ready', items: [{ ref: 'eikona://artifacts/run/two', title: 'Second asset', versionStatus: 'unverified' }] })
    .mockResolvedValueOnce(first)
  render(<EikonaAssetBrowser scopeKey="one" read={read} t={t} />)
  expect(read).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '加载资产' }))
  await screen.findByText('First asset')
  expect(screen.getByText('版本待核验')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '下一页' }))
  await screen.findByText('读取失败，请检查连接或权限后重试。')
  expect(screen.getByText('First asset')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '重试读取' }))
  await screen.findByText('Second asset')
  expect(read.mock.calls[2]?.[0]).toEqual({ limit: 50, cursor: 'next-one' })
  fireEvent.click(screen.getByRole('button', { name: '上一页' }))
  await screen.findByText('First asset')
  expect(read.mock.calls[3]?.[0]).toEqual({ limit: 50 })
})
it('ignores the previous project response and prevents duplicate requests', async () => {
  let release!: (page: EikonaAssetPage) => void
  const read = vi.fn(() => new Promise<EikonaAssetPage>(resolve => { release = resolve }))
  const view = render(<EikonaAssetBrowser scopeKey="one" read={read} t={t} />)
  const button = screen.getByRole('button', { name: '加载资产' })
  fireEvent.click(button); fireEvent.click(button)
  expect(read).toHaveBeenCalledOnce()
  view.rerender(<EikonaAssetBrowser scopeKey="two" read={read} t={t} />)
  release(first)
  await waitFor(() => expect(screen.queryByText('First asset')).toBeNull())
  expect(read).toHaveBeenCalledOnce()
})
