// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { FileOpenPane } from '../src/client/file-open-pane.tsx'
import type { FileEntryV1 } from '@yeisme/dsh-file-document'
import type { FileHostV1 } from '@yeisme/dsh-file-host'

afterEach(cleanup)

const entry: FileEntryV1 = {
  id: 'file-1',
  name: 'README.md',
  kind: 'text',
  mediaType: 'text/markdown',
  capabilities: ['preview', 'open'],
}

describe('FileOpenPane', () => {
  it('renders markdown by default and can switch to source', async () => {
    const host: FileHostV1 = {
      version: '0.1.0-rc.1',
      capability: 'file-host',
      async listEntries() { return [entry] },
      async readText() { return { content: '# opened', truncated: false, binary: false } },
    }
    render(<FileOpenPane host={host} entry={entry} />)
    expect(await screen.findByRole('heading', { name: 'opened' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'README.md' })).toBeTruthy()
    expect(document.querySelector('[data-dsh-file-open-pane]')?.getAttribute('data-file-view')).toBe('preview')
    screen.getByRole('button', { name: '源文件' }).click()
    expect(await screen.findByText('# opened')).toBeTruthy()
    expect(document.querySelector('[data-dsh-file-open-pane]')?.getAttribute('data-file-view')).toBe('source')
  })
})
