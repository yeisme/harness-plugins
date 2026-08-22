// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CreatorStudioController } from '../src/controller.ts'
import { CreatorStudioView } from '../src/views.tsx'
import { creatorSnapshot } from './fixtures.ts'

afterEach(cleanup)

async function readyController(): Promise<CreatorStudioController> {
  const controller = new CreatorStudioController({
    snapshot: async () => ({ ok: true, value: creatorSnapshot() }),
    dispatch: async () => ({ ok: true, value: { status: 'accepted', receiptRef: 'receipt:one' } }),
    resolveArtifact: async () => ({ ok: true, value: null }),
  })
  await controller.refresh()
  return controller
}

describe('Creator Studio task views', () => {
  it('renders quick creation, six owner states, and the Scaena stage pulse', async () => {
    const controller = await readyController()
    const onOpenMode = vi.fn()
    render(<CreatorStudioView mode="home" controller={controller} pane={{ openView: vi.fn() }} onOpenMode={onOpenMode} />)
    expect(screen.getByRole('heading', { name: '快速创作' })).toBeTruthy()
    expect(screen.getByText('雨夜来客')).toBeTruthy()
    expect(document.querySelectorAll('.cs-owner-row')).toHaveLength(6)
    const quickImage = [...document.querySelectorAll<HTMLButtonElement>('.cs-quick-card')].find(button => button.textContent?.includes('图像'))
    expect(quickImage).toBeTruthy()
    fireEvent.click(quickImage!)
    expect(onOpenMode).toHaveBeenCalledWith('visual')
  })

  it('renders Sonora waveform and owner-gated action composer', async () => {
    const controller = await readyController()
    render(<CreatorStudioView mode="audio" controller={controller} pane={{ openView: vi.fn() }} onOpenMode={vi.fn()} />)
    expect(screen.getByText('主角对白 Take 1')).toBeTruthy()
    expect(document.querySelector('.cs-waveform')).toBeTruthy()
    expect(document.querySelector('[data-action-composer="sonora.create"]')).toBeTruthy()
  })
})
