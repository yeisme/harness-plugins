// @vitest-environment jsdom
import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FileDocumentPanel } from '../src/client/file-document-panel.tsx'
import type { FileEntryV1 } from '../src/types.ts'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const rootEntry: FileEntryV1 = {
  id: 'dir-1',
  name: 'src',
  kind: 'directory',
  capabilities: ['open'],
}

const childEntry: FileEntryV1 = {
  id: 'dir-2',
  parentId: 'dir-1',
  name: 'client',
  kind: 'directory',
  capabilities: ['open'],
}

function Wrapper({ onLoad }: { onLoad?: () => void }) {
  const [entries, setEntries] = useState<readonly FileEntryV1[]>([rootEntry])
  const loadChildren = async (): Promise<void> => {
    onLoad?.()
    setEntries(previous => previous.some(entry => entry.id === childEntry.id) ? previous : [...previous, childEntry])
  }
  return createElement(FileDocumentPanel, { tabId: 'files', entries, loadChildren })
}

let container: HTMLDivElement
let root: Root

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('FileDocumentPanel lazy loading', () => {
  it('calls loadChildren when expanding a directory and renders loaded children', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    const onLoad = vi.fn()
    act(() => root.render(createElement(Wrapper, { onLoad })))

    const toggle = container.querySelector('button[aria-label="Expand src"]') as HTMLButtonElement
    expect(toggle).toBeTruthy()
    act(() => toggle.click())
    await act(async () => {})
    expect(onLoad).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('client')
  })
})
