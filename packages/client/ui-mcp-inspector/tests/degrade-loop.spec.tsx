// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { McpInspectorView } from '../src/client/McpInspectorView.tsx'

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
      expect(screen.getByText('Catalog unavailable; activity remains visible')).toBeDefined()
    } finally {
      errorSpy.mockRestore()
    }
  })
})
