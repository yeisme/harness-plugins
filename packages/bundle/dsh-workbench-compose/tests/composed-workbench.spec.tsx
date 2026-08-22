// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ComposedWorkbench } from '../src/client/composed-workbench.tsx'
import type { ComposedWorkbenchProps, ComposedWorkbenchExtraProps } from '../src/client/composed-workbench.tsx'
import { createStaticHostProjection } from '../src/host-projection.ts'
import { createFileTreeHostAdapter, type FileEntryV1 } from '@yeisme/dsh-file-document'
import type { MediaRefV1 } from '@yeisme/dsh-rich-media'

afterEach(cleanup)

const media: MediaRefV1 = {
  owner: 'dsh',
  kind: 'image',
  ref: 'img-1',
  version: 'v1',
  mediaType: 'image/png',
  title: 'Sample image',
  capabilities: ['preview'],
}

const file: FileEntryV1 = {
  id: 'file-1',
  name: 'notes.txt',
  kind: 'text',
  mediaType: 'text/plain',
  size: 12,
  capabilities: ['preview', 'open'],
}

const projection = createStaticHostProjection({ media: [media], fileEntries: [file] })

function renderWorkbench(extra: Partial<ComposedWorkbenchExtraProps> = {}) {
  const props = {
    wide: true,
    t: ((key: string) => key) as never,
    hostProjection: projection,
    useSessions: () => ({ current: undefined }),
    useWorkspaces: () => ({ items: [] }),
    ...extra,
  } as unknown as ComposedWorkbenchProps & ComposedWorkbenchExtraProps
  return render(<ComposedWorkbench {...props} />)
}

describe('ComposedWorkbench integration', () => {
  it('opens and shows all module tabs', () => {
    renderWorkbench()
    fireEvent.click(screen.getByRole('button', { name: 'aria' }))
    expect(screen.getByRole('tab', { name: '媒体库' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '文件' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '文档' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '终端' })).toBeTruthy()
  })

  it('renders media from the host projection', () => {
    renderWorkbench()
    fireEvent.click(screen.getByRole('button', { name: 'aria' }))
    expect(screen.getByText('Sample image')).toBeTruthy()
  })

  it('renders file entries in the file tab', () => {
    renderWorkbench()
    fireEvent.click(screen.getByRole('button', { name: 'aria' }))
    fireEvent.click(screen.getByRole('tab', { name: '文件' }))
    expect(screen.getByText('notes.txt')).toBeTruthy()
  })

  it('opens command palette from the header', () => {
    renderWorkbench()
    fireEvent.click(screen.getByRole('button', { name: 'aria' }))
    fireEvent.click(screen.getByRole('button', { name: 'commands' }))
    expect(screen.getByRole('dialog', { name: 'Workbench commands' })).toBeTruthy()
  })

  it('renders a terminal status projection in the terminal tab', () => {
    renderWorkbench({ terminalState: 'connected', terminalStatus: 'session 3 · exit 0' })
    fireEvent.click(screen.getByRole('button', { name: 'aria' }))
    fireEvent.click(screen.getByRole('tab', { name: '终端' }))
    expect(screen.getByText(/已连接 · session 3 · exit 0/)).toBeTruthy()
  })

  it('loads the file tree on demand from a Host adapter when the Files tab opens', async () => {
    const listDirectory = vi.fn(async () => ({
      path: '/workspace',
      entries: [{ name: 'src', path: '/workspace/src', hidden: false }],
    }))
    const fileTreeAdapter = createFileTreeHostAdapter(listDirectory)
    renderWorkbench({ fileTreeAdapter })
    expect(listDirectory).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'aria' }))
    expect(listDirectory).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('tab', { name: '文件' }))
    expect(await screen.findByText('src')).toBeTruthy()
    expect(listDirectory).toHaveBeenCalledTimes(1)
  })

})
