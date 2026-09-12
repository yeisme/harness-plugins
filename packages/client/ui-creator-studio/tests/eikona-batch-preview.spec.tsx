// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EikonaBatchPreview } from '../src/eikona-batch-preview.tsx'
import { defaultCreatorStudioTranslator as t } from '../src/locales.ts'
afterEach(cleanup)
const resource = { ref: 'batch:one', version: `sha256:${'a'.repeat(64)}`, kind: 'batch-input', title: '镜头参考批次', status: 'available', evidenceRefs: [] }
it('reads only the selected fixed batch on click and refuses a substituted result', async () => {
  const read = vi.fn(async () => ({ status: 'ready' as const, projectRef: 'project:owner', batchRef: resource.ref, digest: `sha256:${'b'.repeat(64)}`, requestCount: 1, candidateCount: 2, executionAuthorized: false as const }))
  render(<EikonaBatchPreview resource={resource} read={read} t={t} />)
  expect(read).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '查看批次' }))
  await screen.findByText('无法确认此批次版本，请恢复访问后重试。')
  expect(read).toHaveBeenCalledExactlyOnceWith({ batchRef: resource.ref, digest: resource.version })
})
