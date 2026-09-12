// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { DomainStudioView } from '../src/domain-studio.tsx'
import { CreatorStudioController } from '../src/controller.ts'
import { ImageViewport } from '../src/image-viewport.tsx'
import { defaultCreatorStudioTranslator as t } from '../src/locales.ts'
import { creatorSnapshot } from './fixtures.ts'

afterEach(cleanup)

it.each(['eikona', 'scaena'] as const)('mounts %s without the shared navigation and does not dispatch on open', async owner => {
  const value = creatorSnapshot(), dispatch = vi.fn()
  const controller = new CreatorStudioController({ snapshot: vi.fn(), dispatch, resolveArtifact: vi.fn(), snapshotOwner: async () => ({ ok: true, value: { ...value, owners: value.owners.filter(item => item.owner === owner) } }) }, owner)
  await controller.refresh()
  const result = render(<DomainStudioView owner={owner} mode={owner === 'eikona' ? 'visual' : 'production'} controller={controller} pane={{ openView: vi.fn() }} onOpenMode={vi.fn()} />)
  expect(screen.getByText(t(`studio.${owner}`))).toBeTruthy()
  expect(result.container.querySelector('[data-lifecycle]')).toBeNull()
  expect(screen.queryByText('Creator Studio')).toBeNull()
  expect(dispatch).not.toHaveBeenCalled()
  result.unmount(); controller.dispose()
})

it('shows a project binding explanation instead of a raw Gateway error', async () => {
  const controller = new CreatorStudioController({ snapshot: vi.fn(), dispatch: vi.fn(), resolveArtifact: vi.fn(), snapshotOwner: async () => ({ ok: false, error: { code: 'gateway/service-unavailable' } } as never) }, 'eikona')
  await controller.refresh()
  render(<DomainStudioView owner="eikona" mode="visual" controller={controller} pane={{ openView: vi.fn() }} onOpenMode={vi.fn()} />)
  expect(screen.getByText(t('studio.contextMissing'))).toBeTruthy()
  expect(screen.queryByText('gateway/service-unavailable')).toBeNull()
  controller.dispose()
})

it('zooms locally without changing the image URL and resets for a new image', () => {
  const result = render(<ImageViewport url="blob:first" title="Candidate" t={t} />)
  const img = screen.getByRole('img')
  Object.defineProperties(img, { naturalWidth: { value: 1200 }, naturalHeight: { value: 800 } })
  fireEvent.load(img)
  fireEvent.click(screen.getByRole('button', { name: t('image.actualSize') }))
  expect(img.getAttribute('style')).toContain('width: 1200px')
  fireEvent.click(screen.getByRole('button', { name: t('image.zoomIn') }))
  expect(img.getAttribute('style')).toContain('width: 1500px')
  expect(img.getAttribute('src')).toBe('blob:first')
  result.rerender(<ImageViewport url="blob:second" title="Candidate" t={t} />)
  expect(screen.getByRole('button', { name: t('image.fit') }).getAttribute('aria-pressed')).toBe('true')
})
