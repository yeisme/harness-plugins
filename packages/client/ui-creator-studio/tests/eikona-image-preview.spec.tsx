// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EikonaImagePreview } from '../src/eikona-image-preview.tsx'
import { defaultCreatorStudioTranslator as t } from '../src/locales.ts'
import type { EikonaImageResult } from '@yeisme/dsh-creator-studio-host/contracts'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const props = { artifactRef: 'eikona://artifacts/run/one', contentDigest: 'a'.repeat(64), title: 'Candidate', t }
const ready: EikonaImageResult = { status: 'ready', value: { artifactRef: props.artifactRef, contentDigest: props.contentDigest, mediaType: 'image/png', byteLength: 4, base64: 'iVBORw==' } }
it('reads only after confirmation and revokes the temporary URL when closed', async () => {
  const create = vi.fn(() => 'blob:fixture'), revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
  const read = vi.fn(async () => ready)
  render(<EikonaImagePreview {...props} read={read} />)
  fireEvent.click(screen.getByRole('button', { name: '预览图片' }))
  expect(read).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '确认读取图片' }))
  await screen.findByRole('img', { name: 'Candidate' })
  expect(read).toHaveBeenCalledOnce()
  expect(read.mock.calls[0]?.[0]).toMatchObject({ artifactRef: props.artifactRef, contentDigest: props.contentDigest, confirmed: true })
  fireEvent.click(screen.getByRole('button', { name: '关闭预览' }))
  expect(revoke).toHaveBeenCalledWith('blob:fixture')
  expect(screen.queryByRole('img')).toBeNull()
})
it('does not create a Blob for a response arriving after the preview unmounts', async () => {
  const create = vi.fn(), revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
  let finish!: (value: EikonaImageResult) => void
  const read = vi.fn(() => new Promise<EikonaImageResult>(resolve => { finish = resolve }))
  const view = render(<EikonaImagePreview {...props} read={read} />)
  fireEvent.click(screen.getByRole('button', { name: '预览图片' }))
  fireEvent.click(screen.getByRole('button', { name: '确认读取图片' }))
  view.unmount(); finish(ready); await Promise.resolve()
  expect(create).not.toHaveBeenCalled()
})
