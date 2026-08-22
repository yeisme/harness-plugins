// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CommandPalette } from '../src/client/command-palette.tsx'
import type { WorkbenchCommandV1 } from '../src/types.ts'

afterEach(cleanup)

const commands: WorkbenchCommandV1[] = [
  { id: 'media.open', moduleId: 'm', title: 'Open media' },
  { id: 'file.open', moduleId: 'm', title: 'Open file' },
  { id: 'terminal.open', moduleId: 'm', title: 'Open terminal' },
]

describe('CommandPalette', () => {
  it('filters commands by query', () => {
    render(<CommandPalette commands={commands} onRunCommand={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('Type a command…'), { target: { value: 'file' } })
    expect(screen.getByRole('option', { name: /Open file/ })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /Open media/ })).toBeNull()
  })

  it('runs the active command on Enter', () => {
    const onRunCommand = vi.fn()
    render(<CommandPalette commands={commands} onRunCommand={onRunCommand} onClose={vi.fn()} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' })
    expect(onRunCommand).toHaveBeenCalledWith('media.open')
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<CommandPalette commands={commands} onRunCommand={vi.fn()} onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('groups commands by module id', () => {
    const grouped = [
      { id: 'media.open', moduleId: 'dsh-rich-media', title: 'Open media', shortcutHint: 'M' },
      { id: 'file.open', moduleId: 'dsh-file-document', title: 'Open file' },
    ]
    render(<CommandPalette commands={grouped} onRunCommand={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('dsh-rich-media')).toBeTruthy()
    expect(screen.getByText('dsh-file-document')).toBeTruthy()
    expect(screen.getByRole('option', { name: /Open media/ }).textContent).toContain('M')
  })

  it('shows recently used commands in a recent section', () => {
    const onRunCommand = vi.fn()
    render(<CommandPalette commands={commands} onRunCommand={onRunCommand} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('option', { name: /Open file/ }))
    expect(onRunCommand).toHaveBeenCalledWith('file.open')
    expect(screen.getByText('Recent')).toBeTruthy()
    const options = screen.getAllByRole('option')
    expect(options[0]?.textContent).toContain('Open file')
  })

  it('uses a localized recent label', () => {
    render(<CommandPalette commands={commands} onRunCommand={vi.fn()} onClose={vi.fn()} recentLabel="最近使用" />)
    fireEvent.click(screen.getByRole('option', { name: /Open file/ }))
    expect(screen.getByText('最近使用')).toBeTruthy()
  })
})
