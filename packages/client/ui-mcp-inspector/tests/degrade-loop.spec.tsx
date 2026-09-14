// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { McpInspectorView } from '../src/client/McpInspectorView.tsx'
import { CapabilityMapCard } from '../src/client/DebugCards.tsx'
import { ConnectDocController } from '../src/client/connect-doc.ts'
import { en } from '../src/client/locales.ts'
import type { ToolsTranslator } from '../src/client/McpInspectorView.tsx'
import type { ToolHubRemoteFace } from '../src/client/wire.ts'

const text = ((key: keyof typeof en, params: Readonly<Record<string, string | number>> = {}) =>
  String(en[key]).replace(/\{([A-Za-z0-9_]+)\}/g, (_match, name: string) => String(params[name] ?? `{${name}}`))) as ToolsTranslator

const stubFace = (over: Partial<Record<'connectDoc' | 'rediscover', () => Promise<unknown>>>) => ({
  list: async () => { throw new Error('not under test') },
  setEnabled: async () => { throw new Error('not under test') },
  ...over,
}) as ToolHubRemoteFace

function mapCard(faceOrUndefined: () => Promise<ToolHubRemoteFace | undefined>) {
  const controller = new ConnectDocController(faceOrUndefined)
  return { controller, view: createElement(CapabilityMapCard, { controller, text }) }
}

afterEach(cleanup)

const useSession = (selector: (snapshot: unknown) => unknown): unknown =>
  selector({ nodes: [], runningCalls: [] })

describe('McpInspectorView degrade path', () => {
  it('keeps the no-remote degrade snapshot stable instead of looping', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(createElement(McpInspectorView, { useSession }))
      // An unstable getSnapshot would make React log "The result of
      // getSnapshot should be cached" on every render and loop forever.
      await new Promise(resolve => { setTimeout(resolve, 50) })
      expect(errorSpy.mock.calls.some(call => String(call[0]).includes('getSnapshot'))).toBe(false)
      expect(screen.getByText('Catalog unavailable; recheck is available')).toBeDefined()
    } finally {
      errorSpy.mockRestore()
    }
  })
})

describe('capability map card degrade chain', () => {
  const doc = (docDigest: string) => ({ ok: true, docDigest, observedAt: 1_000, faces: [{ id: 'search', publicName: 'Search', kind: 'mcp', toolCount: 3 }] })

  it('renders disabled with a reason when the projection is missing or unavailable', async () => {
    for (const [label, resolve] of [
      ['old-host', async () => undefined],
      ['g4-not-landed', async () => stubFace({ connectDoc: async () => ({ ok: false, code: 'connect-doc-unavailable', message: 'gateway_connect_doc.v1 is not projected by any approved binding' }) })],
    ] as const) {
      const { view } = mapCard(resolve)
      render(view)
      await waitFor(() => { expect(document.querySelector('[data-capability-map]')?.getAttribute('data-map-state')).toBe('disabled') })
      expect(document.querySelector('[data-capability-map]')?.textContent).toContain(label === 'old-host' ? 'unavailable' : 'approved binding') // owner message rendered verbatim
      expect(document.querySelector('[data-map-rediscover]')).toBeNull()
      expect(document.querySelector('[data-map-digest]')).toBeNull()
      cleanup()
    }
  })

  it('renders error with a retry action on transport failure, never stale data', async () => {
    const { view } = mapCard(async () => stubFace({ connectDoc: async () => { throw new Error('private detail') } }))
    render(view)
    await waitFor(() => { expect(document.querySelector('[data-capability-map]')?.getAttribute('data-map-state')).toBe('error') })
    expect(document.querySelector('[data-map-reread]')).not.toBeNull()
    expect(document.querySelector('[data-map-digest]')).toBeNull()
    expect(document.body.textContent).not.toContain('private detail')
  })

  it('marks drift explicitly stale with a single re-discovery action and keeps rendered data', async () => {
    let answer = doc('0123456789abcdef')
    const { view } = mapCard(async () => stubFace({ connectDoc: async () => answer, rediscover: async () => ({ ok: true, generation: 2, docDigest: 'fedcba9876543210' }) }))
    render(view)
    await waitFor(() => { expect(document.querySelector('[data-capability-map]')?.getAttribute('data-map-state')).toBe('ready') })
    answer = doc('fedcba9876543210')
    const controller = (view.props as { controller: ConnectDocController }).controller
    await controller.read()
    await waitFor(() => { expect(document.querySelector('[data-capability-map]')?.getAttribute('data-map-state')).toBe('stale') })
    const banner = document.querySelector('.tools-map-mismatch')
    expect(banner?.getAttribute('role')).toBe('alert')
    expect(banner?.textContent).toContain('0123456789abcdef')
    expect(banner?.textContent).toContain('fedcba9876543210')
    expect(document.querySelector('[data-map-stale="true"]')).not.toBeNull()
    expect(document.querySelectorAll('[data-map-rediscover]')).toHaveLength(1)
    // Explicit re-discovery adopts the owner-confirmed digest and clears the banner.
    ;(document.querySelector('[data-map-rediscover]') as HTMLButtonElement).click()
    await waitFor(() => { expect(document.querySelector('[data-capability-map]')?.getAttribute('data-map-state')).toBe('ready') })
    expect(document.querySelector('.tools-map-mismatch')).toBeNull()
    expect(document.querySelector('[data-capability-map]')?.getAttribute('data-map-digest')).toBe('fedcba9876543210')
  })
})
