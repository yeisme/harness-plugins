// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EikonaBatchBrowser } from '../src/eikona-batch-browser.tsx'
import { defaultCreatorStudioTranslator as t } from '../src/locales.ts'
afterEach(cleanup)
it('loads explicitly, preserves the current page on failure and retries the same cursor', async () => {
 const cursor = `${'a'.repeat(64)}-${'b'.repeat(64)}-${'c'.repeat(64)}.json`
 const item = { batchRef: 'batch:first', digest: `sha256:${'a'.repeat(64)}`, requestCount: 1, candidateCount: 2 }
 const list = vi.fn().mockResolvedValueOnce({ status: 'ready', projectRef: 'project:owner', items: [item], nextCursor: cursor }).mockResolvedValueOnce({ status: 'unavailable' }).mockResolvedValueOnce({ status: 'ready', projectRef: 'project:owner', items: [{ ...item, batchRef: 'batch:second' }] })
 const read = vi.fn(async () => ({ status: 'unavailable' as const }))
 render(<EikonaBatchBrowser list={list} read={read} t={t} />)
 expect(list).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('button', { name: '加载批次' }))
 await screen.findByText('batch:first')
 fireEvent.click(screen.getByRole('button', { name: '下一页' }))
 await screen.findByText('无法确认此批次版本，请恢复访问后重试。')
 expect(screen.getByText('batch:first')).toBeTruthy()
 fireEvent.click(screen.getByRole('button', { name: '重试读取' }))
 await screen.findByText('batch:second')
 expect(list.mock.calls[1]![0]).toEqual({ limit: 20, cursor })
 expect(list.mock.calls[2]![0]).toEqual(list.mock.calls[1]![0])
 expect(read).not.toHaveBeenCalled()
})
