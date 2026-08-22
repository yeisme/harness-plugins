// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DesktopWorkbenchShell } from '../src/client/desktop-workbench-shell.tsx'
import type { WorkbenchTabV1 } from '@yeisme/dsh-workbench-core'

const tabs: WorkbenchTabV1[] = [
  { id: 'desktop-files', moduleId: 'dsh-desktop-workbench', title: '文件', order: 20, closable: true, scope: 'session-maybe' },
]

afterEach(cleanup)

describe('DesktopWorkbenchShell', () => {
  it('renders the session sidebar and a workbench tab', () => {
    render(<DesktopWorkbenchShell tabs={tabs} renderTab={tab => <div>{tab.title}</div>} />)
    expect(screen.getByRole('complementary', { name: 'Sessions' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '文件' })).toBeTruthy()
    expect(document.querySelector('[data-dsh-desktop-workbench]')?.getAttribute('data-sidebar-visible')).toBe('true')
  })

  it('toggles the session sidebar and exposes an explicit return action', () => {
    const onClose = vi.fn()
    render(<DesktopWorkbenchShell tabs={tabs} renderTab={tab => <div>{tab.title}</div>} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: '隐藏会话侧栏' }))
    expect(document.querySelector('[data-dsh-desktop-workbench]')?.getAttribute('data-sidebar-visible')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: '返回 DSH 会话' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
