// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { OPC_SCENE_SUMMARY_FIXTURE, type OpcScenePackageSummaryV1alpha1 } from '@yeisme/dsh-ai-drama-director'
import {
  DramaScenePackageContextView,
  OpcSceneDeliveryHandoffView,
  OpcSceneExceptionCardsView,
  OpcSceneReframeView,
} from '../src/client/opc-scene-views.tsx'
import { deriveDramaScenePackageExceptionView } from '../src/client/opc-scene-view.ts'

afterEach(cleanup)

function summary(overrides: Record<string, unknown>): OpcScenePackageSummaryV1alpha1 {
  return { ...OPC_SCENE_SUMMARY_FIXTURE, ...overrides } as OpcScenePackageSummaryV1alpha1
}

function contextView(input: Parameters<typeof deriveDramaScenePackageExceptionView>[0], props?: { reducedMotion?: boolean; onAction?: never }) {
  const view = deriveDramaScenePackageExceptionView(input)
  return { view, node: createElement(DramaScenePackageContextView, { view, ...props }) }
}

describe('DramaScenePackageContextView (opc-scene 2.1)', () => {
  it('answers Now/Why/Next with gates, blocker, one action, and a Workbench deep link', () => {
    const { node } = contextView({ summary: OPC_SCENE_SUMMARY_FIXTURE })
    render(node)
    expect(screen.getByText('Now')).toBeTruthy()
    expect(screen.getByText('Why')).toBeTruthy()
    expect(screen.getByText('Next')).toBeTruthy()
    expect(screen.getByText('Direction: pending')).toBeTruthy()
    expect(screen.getByText('Visual foundation: accepted')).toBeTruthy()
    expect(screen.getByText('Export: pending')).toBeTruthy()
    expect(screen.getByText('rights on scene:12@r42: rights_review_pending')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Confirm direction/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Open Workbench review/ })).toBeTruthy()
  })

  it('submits the owner action on click and element-scoped Enter, never when disabled', () => {
    const onAction = vi.fn()
    const enabled = deriveDramaScenePackageExceptionView({ summary: OPC_SCENE_SUMMARY_FIXTURE })
    const { container } = render(createElement(DramaScenePackageContextView, { view: enabled, onAction }))
    const button = screen.getByRole('button', { name: /Confirm direction/ })
    button.click()
    fireEvent.keyDown(button, { key: 'Enter' })
    expect(onAction).toHaveBeenCalledTimes(2)
    expect(onAction).toHaveBeenLastCalledWith(expect.objectContaining({ actionId: 'act:confirm-direction' }))

    const degraded = deriveDramaScenePackageExceptionView({ summary: summary({ freshness: 'stale', exceptions: [] }) })
    cleanup()
    render(createElement(DramaScenePackageContextView, { view: degraded, onAction }))
    const disabled = screen.getByRole('button', { name: /Confirm direction/ })
    expect(disabled.hasAttribute('disabled')).toBe(true)
    expect(disabled.getAttribute('aria-disabled')).toBe('true')
    disabled.click()
    fireEvent.keyDown(disabled, { key: 'Enter' })
    expect(onAction).toHaveBeenCalledTimes(2)
    expect(container).toBeTruthy()
  })

  it('shows a no-blocker line with the three gates instead of hiding them', () => {
    const clear = deriveDramaScenePackageExceptionView({
      summary: summary({ exceptions: [], readiness: 'clear' }),
    })
    render(createElement(DramaScenePackageContextView, { view: clear }))
    expect(screen.getByText('No blocker; human gates below')).toBeTruthy()
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3)
  })
})

describe('OpcSceneExceptionCardsView (opc-scene 2.3)', () => {
  it('renders triggered cards with reason, evidence refs, and a disabled recovery action when degraded', () => {
    const view = deriveDramaScenePackageExceptionView({ summary: summary({ freshness: 'offline' }) })
    render(createElement(OpcSceneExceptionCardsView, { view }))
    const rights = screen.getByText('rights_review_pending').closest('li')!
    expect(rights.getAttribute('data-exception-kind')).toBe('rights')
    expect(rights.textContent).toContain('ev:rights-scan-7')
    const recovery = screen.getByRole('button', { name: /Approve rights review/ })
    expect(recovery.hasAttribute('disabled')).toBe(true)
    expect(recovery.textContent).toContain('state:mutations_disabled')
    // Owner-offline state card leads with a typed reason.
    const stateCard = screen.getByText('state:offline').closest('li')!
    expect(stateCard.getAttribute('data-exception-kind')).toBe('owner_offline')
  })

  it('renders reconcile-only text instead of a fabricated retry button', () => {
    const noRecovery = deriveDramaScenePackageExceptionView({
      summary: summary({ exceptions: [{ ...OPC_SCENE_SUMMARY_FIXTURE.exceptions[0]!, recoveryAction: undefined }] }),
    })
    render(createElement(OpcSceneExceptionCardsView, { view: noRecovery }))
    expect(screen.getByText(/Reconcile only: recon:rights-r42/)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('OpcSceneReframeView (opc-scene 2.4)', () => {
  it('keeps the primary aspect formal, cinematic behind upgrade confirmation, roles label-first', () => {
    const view = deriveDramaScenePackageExceptionView({ summary: OPC_SCENE_SUMMARY_FIXTURE })
    render(createElement(OpcSceneReframeView, { view }))
    expect(screen.getByText('Primary aspect 9:16')).toBeTruthy()
    const reframe = screen.getByText(/wide establishing shot recommended/).closest('li')!
    expect(reframe.getAttribute('data-reframe-aspect')).toBe('16:9')
    expect(reframe.getAttribute('data-reframe-depth')).toBe('cinematic')
    expect(reframe.textContent).toContain('explicit upgrade confirmation required')
    expect(screen.getByText('director')).toBeTruthy()
    // Digest identity stays out of the primary role list...
    expect(document.querySelector('ul[data-dsv-roles]')?.textContent).not.toContain('sha1')
    // ...and only exists inside the collapsed details region.
    const details = document.querySelector('details[data-dsv-roles-detail]')!
    expect(details.open).toBe(false)
    expect(details.textContent).toContain('sha1:9f2a')
  })
})

describe('OpcSceneDeliveryHandoffView (opc-scene 2.2, 2.5)', () => {
  it('distinguishes partial vs formal package, checksum, grant notes, and receipts', () => {
    const view = deriveDramaScenePackageExceptionView({ summary: OPC_SCENE_SUMMARY_FIXTURE })
    render(createElement(OpcSceneDeliveryHandoffView, { view }))
    expect(screen.getByText('partial')).toBeTruthy()
    expect(screen.getByText('false')).toBeTruthy()
    expect(screen.getByText('verified')).toBeTruthy()
    expect(screen.getByText(/partial_package: production_ready=false/)).toBeTruthy()
    expect(screen.getByText(/rcpt:action-77: succeeded/)).toBeTruthy()
    expect(screen.getByText(/rcpt:action-78: unknown/)).toBeTruthy()
    expect(screen.getByText(/evidence digest sha1:4d31c0/)).toBeTruthy()
  })

  it('exposes copyable CLI/API details behind a toggle and copies the owner strings verbatim', () => {
    const onCopy = vi.fn()
    const view = deriveDramaScenePackageExceptionView({ summary: OPC_SCENE_SUMMARY_FIXTURE })
    render(createElement(OpcSceneDeliveryHandoffView, { view, onCopy }))
    const toggle = screen.getByRole('button', { name: /Show action details/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    fireEvent.click(screen.getByRole('button', { name: 'Copy CLI' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy API' }))
    expect(onCopy).toHaveBeenCalledWith(OPC_SCENE_SUMMARY_FIXTURE.primaryAction?.cliDetail)
    expect(onCopy).toHaveBeenCalledWith(OPC_SCENE_SUMMARY_FIXTURE.primaryAction?.apiDetail)
  })

  it('returns focus to the toggle when the detail region closes via Escape', () => {
    const view = deriveDramaScenePackageExceptionView({ summary: OPC_SCENE_SUMMARY_FIXTURE })
    render(createElement(OpcSceneDeliveryHandoffView, { view }))
    const toggle = screen.getByRole('button', { name: /Show action details/ })
    fireEvent.click(toggle)
    const region = document.querySelector('div[data-dsv-action-details]')!
    const copyButton = screen.getByRole('button', { name: 'Copy CLI' })
    copyButton.focus()
    expect(document.activeElement).toBe(copyButton)
    fireEvent.keyDown(region, { key: 'Escape' })
    expect(screen.getByRole('button', { name: /Show action details/ })).toBeTruthy()
    expect(document.activeElement).toBe(toggle)
  })

  it('applies the no-motion class under reduced-motion preference', () => {
    const view = deriveDramaScenePackageExceptionView({ summary: OPC_SCENE_SUMMARY_FIXTURE })
    const { container } = render(createElement(DramaScenePackageContextView, { view, reducedMotion: true }))
    expect(container.querySelector('[data-dsv-context]')?.className).toContain('dsv-no-motion')
    const animated = deriveDramaScenePackageExceptionView({ summary: OPC_SCENE_SUMMARY_FIXTURE })
    const { container: other } = render(createElement(OpcSceneReframeView, { view: animated }))
    expect(other.querySelector('[data-dsv-reframe]')?.className).toContain('dsv-motion')
  })

  it('degrades to explicit unavailable facts when no summary exists', () => {
    render(createElement(OpcSceneDeliveryHandoffView, { view: deriveDramaScenePackageExceptionView({}) }))
    expect(screen.getByText('Delivery facts unavailable in this state')).toBeTruthy()
    expect(screen.getByText('Evidence facts unavailable in this state')).toBeTruthy()
  })
})
