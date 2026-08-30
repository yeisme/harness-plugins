// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { FilePane } from '../src/client/file-pane.tsx'
import type { FileEntryV1 } from '@yeisme/dsh-file-document'
import type { FileHostV1 } from '@yeisme/dsh-file-host'

afterEach(cleanup)

const entries: readonly FileEntryV1[] = [
  { id: 'dir-1', name: 'src', kind: 'directory', capabilities: ['open'] },
  { id: 'file-1', parentId: 'dir-1', name: 'README.md', kind: 'text', mediaType: 'text/markdown', capabilities: ['preview', 'open'] },
]

function fakeFileHost(): FileHostV1 {
  return {
    version: '0.1.0-rc.1',
    capability: 'file-host',
    async listEntries(parentRef) {
      if (parentRef === undefined) return [entries[0]]
      if (parentRef === 'dir-1') return [entries[1]]
      return []
    },
    async readText(entry) {
      if (entry.id !== 'file-1') return undefined
      return { content: '# readme', truncated: false, binary: false }
    },
  }
}

describe('FilePane', () => {
  it('renders root directory entries from the file host', async () => {
    render(<FilePane host={fakeFileHost()} />)
    expect(await screen.findByText('src')).toBeTruthy()
  })

  it('does not claim live watch without FileWatchCapabilityV1', async () => {
    const { container } = render(<FilePane host={fakeFileHost()} />)
    await screen.findByText('src')
    const pane = container.querySelector('[data-dsh-file-pane]') as HTMLElement
    expect(pane.getAttribute('data-file-watch')).toBe('ondemand')
    expect(pane.getAttribute('data-freshness')).toBe('contract_mismatch')
    expect(pane.textContent).not.toMatch(/live|watching|setInterval/i)
    expect(screen.getByText(/missing FileWatchCapabilityV1/)).toBeTruthy()
  })

  it('loads child entries when a directory is expanded', async () => {
    render(<FilePane host={fakeFileHost()} />)
    const toggle = await screen.findByRole('button', { name: 'Expand src' })
    toggle.click()
    expect(await screen.findByText('README.md')).toBeTruthy()
  })

  it('opens a file on single click when onOpenEntry is provided', async () => {
    const onOpenEntry = vi.fn()
    render(<FilePane host={fakeFileHost()} showPreviewPanel={false} onOpenEntry={onOpenEntry} />)
    const toggle = await screen.findByRole('button', { name: 'Expand src' })
    toggle.click()
    const file = await screen.findByText('README.md')
    file.click()
    expect(onOpenEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 'file-1', name: 'README.md' }))
  })

  it('previews text after a file is selected', async () => {
    render(<FilePane host={fakeFileHost()} />)
    const toggle = await screen.findByRole('button', { name: 'Expand src' })
    toggle.click()
    const file = await screen.findByText('README.md')
    file.click()
    // V3 4.5: markdown sources render through the escape-first renderer as a heading
    expect(await screen.findByRole('heading', { name: 'readme', level: 1 })).toBeTruthy()
  })
})
