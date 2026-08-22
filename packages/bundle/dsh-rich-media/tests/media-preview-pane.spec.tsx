// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MediaPreviewPane } from '../src/client/media-preview-pane.tsx'
import type { MediaRefV1 } from '../src/host/types.ts'

afterEach(cleanup)

const image: MediaRefV1 = {
  owner: 'dsh',
  kind: 'image',
  ref: 'img-1',
  version: 'v1',
  mediaType: 'image/png',
  title: '封面图',
  capabilities: ['preview', 'open', 'download'],
}

const pdf: MediaRefV1 = {
  owner: 'dsh',
  kind: 'pdf',
  ref: 'pdf-1',
  version: 'v1',
  mediaType: 'application/pdf',
  title: '设计说明.pdf',
  capabilities: ['preview', 'open', 'download'],
}

describe('MediaPreviewPane', () => {
  it('keeps resource selection separate from the preview surface', async () => {
    render(<MediaPreviewPane media={[image, pdf]} resolveUrl={async item => `https://cdn.example/${item.ref}`} />)
    expect(screen.getByRole('listbox', { name: '媒体资源' })).toBeTruthy()
    expect(screen.getByRole('option', { name: /封面图/ })).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('img', { name: '封面图' }).getAttribute('src')).toBe('https://cdn.example/img-1'))

    fireEvent.click(screen.getByRole('option', { name: /设计说明\.pdf/ }))
    await waitFor(() => expect(screen.getByTitle('设计说明.pdf').tagName).toBe('IFRAME'))
    expect(screen.getByTitle('设计说明.pdf').getAttribute('sandbox')).toBe('allow-same-origin')
  })

  it('fails closed when a preview URL is not authorized', () => {
    render(<MediaPreviewPane media={[pdf]} />)
    expect(screen.getByRole('status').textContent).toContain('等待资源授权后预览。')
    expect(screen.queryByTitle('设计说明.pdf')).toBeNull()
  })
})
