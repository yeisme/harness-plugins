// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EikonaStudioPages, EikonaCapabilityNotice } from '../src/eikona-studio.tsx'
import { defaultCreatorStudioTranslator, createCreatorStudioTranslator } from '../src/locales.ts'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('mounts candidates on demand, pauses their media when leaving and retains visited content', () => {
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  render(<EikonaStudioPages t={defaultCreatorStudioTranslator} configure={<input aria-label="Draft" defaultValue="original" />}
    candidates={<video data-testid="candidate-media" />} assets={<p>Assets</p>} />)
  expect(screen.queryByTestId('candidate-media')).toBeNull()
  fireEvent.click(screen.getByRole('tab', { name: '候选与修改' }))
  const video = screen.getByTestId('candidate-media')
  fireEvent.click(screen.getByRole('tab', { name: '资产与来源' }))
  expect(pause).toHaveBeenCalledOnce()
  expect(video.closest('[role=tabpanel]')?.hasAttribute('hidden')).toBe(true)
  fireEvent.click(screen.getByRole('tab', { name: '候选与修改' }))
  expect(screen.getByTestId('candidate-media')).toBe(video)
})

it('explains service readiness in Chinese and English without creating execution controls', () => {
  const resources = [{ ref: 'eikona:capability:generate', version: '1', kind: 'owner-capability', title: 'eikona.generation.submit', status: 'needs_contract', evidenceRefs: [] }]
  const view = render(<EikonaCapabilityNotice resources={resources} t={defaultCreatorStudioTranslator} />)
  expect(screen.getByText('生成图像')).toBeTruthy()
  expect(screen.getByText('服务尚未就绪，请检查 Eikona 配置')).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull()
  view.rerender(<EikonaCapabilityNotice resources={resources} t={createCreatorStudioTranslator('en')} />)
  expect(screen.getByText('Generate images')).toBeTruthy()
  expect(screen.getByText('Service not ready; check Eikona settings')).toBeTruthy()
})
