// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { WorkbenchShell } from '../src/client/shell.tsx'
import type { ComponentProps } from 'react'
import type { WorkbenchTabV1 } from '../src/types.ts'

afterEach(cleanup)

const tabs: WorkbenchTabV1[] = [
  { id: 'one', moduleId: 'm', title: 'One', order: 0, closable: false, scope: 'session-maybe' },
  { id: 'two', moduleId: 'm', title: 'Two', order: 1, closable: true, scope: 'session-maybe' },
  { id: 'three', moduleId: 'm', title: 'Three', order: 2, closable: false, scope: 'session-maybe' },
]

function renderShell(active = 'one', overrides: Partial<ComponentProps<typeof WorkbenchShell>> = {}) {
  const onSelectTab = vi.fn()
  const onCloseTab = vi.fn()
  const onReorderTabs = vi.fn()
  render(
    <WorkbenchShell
      tabs={tabs}
      activeTabId={active}
      onSelectTab={onSelectTab}
      onCloseTab={onCloseTab}
      onReorderTabs={onReorderTabs}
      renderTab={tab => <div>{tab.title} content</div>}
      {...overrides}
    />,
  )
  return { onSelectTab, onCloseTab, onReorderTabs }
}

describe('WorkbenchShell keyboard interaction', () => {
  it('ArrowRight selects the next tab', () => {
    const { onSelectTab } = renderShell('one')
    fireEvent.keyDown(screen.getByRole('tab', { name: 'One' }), { key: 'ArrowRight' })
    expect(onSelectTab).toHaveBeenCalledWith('two')
  })

  it('ArrowLeft wraps to the last tab', () => {
    const { onSelectTab } = renderShell('one')
    fireEvent.keyDown(screen.getByRole('tab', { name: 'One' }), { key: 'ArrowLeft' })
    expect(onSelectTab).toHaveBeenCalledWith('three')
  })

  it('Home selects the first tab', () => {
    const { onSelectTab } = renderShell('three')
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Three' }), { key: 'Home' })
    expect(onSelectTab).toHaveBeenCalledWith('one')
  })

  it('End selects the last tab', () => {
    const { onSelectTab } = renderShell('one')
    fireEvent.keyDown(screen.getByRole('tab', { name: 'One' }), { key: 'End' })
    expect(onSelectTab).toHaveBeenCalledWith('three')
  })

  it('Delete closes a closable tab', () => {
    const { onCloseTab } = renderShell('two')
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Two' }), { key: 'Delete' })
    expect(onCloseTab).toHaveBeenCalledWith('two')
  })
})

describe('WorkbenchShell close and reorder', () => {
  it('renders a separate close button for closable tabs', () => {
    renderShell('one')
    const close = screen.getByRole('button', { name: 'Close Two' })
    expect(close.tagName).toBe('BUTTON')
    expect(screen.queryByRole('button', { name: 'Close One' })).toBeNull()
  })

  it('close button closes the tab without selecting it as a nested button', () => {
    const { onCloseTab } = renderShell('one')
    fireEvent.click(screen.getByRole('button', { name: 'Close Two' }))
    expect(onCloseTab).toHaveBeenCalledWith('two')
  })

  it('Alt+ArrowLeft reorders the focused tab left without selecting it', () => {
    const { onReorderTabs, onSelectTab } = renderShell('two')
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Two' }), { key: 'ArrowLeft', altKey: true })
    expect(onReorderTabs).toHaveBeenCalledWith('two', 'one')
    expect(onSelectTab).not.toHaveBeenCalled()
  })

  it('Alt+ArrowRight reorders the focused tab right without selecting it', () => {
    const { onReorderTabs, onSelectTab } = renderShell('two')
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Two' }), { key: 'ArrowRight', altKey: true })
    expect(onReorderTabs).toHaveBeenCalledWith('two', 'three')
    expect(onSelectTab).not.toHaveBeenCalled()
  })

  it('drop reorders source before target', () => {
    const { onReorderTabs } = renderShell('one')
    const source = screen.getByRole('tab', { name: 'One' })
    const target = screen.getByRole('tab', { name: 'Three' })
    fireEvent.dragStart(source, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } })
    fireEvent.drop(target, { dataTransfer: { getData: vi.fn(() => 'one') } })
    expect(onReorderTabs).toHaveBeenCalledWith('one', 'three')
  })
})
