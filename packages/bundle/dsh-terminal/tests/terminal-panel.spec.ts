import { isValidElement } from 'react'
import { describe, expect, it } from 'vitest'
import { TerminalPanel, type TerminalPanelProps } from '../src/client/terminal-panel.tsx'

describe('TerminalPanel', () => {
  it('returns an honest compatibility state without creating a fake terminal', () => {
    const element = TerminalPanel({} as TerminalPanelProps)
    expect(isValidElement(element)).toBe(true)
    const props = JSON.stringify(element.props)
    expect(props).toContain('Terminal compatibility status')
    expect(props).toContain('不会显示占位输出或伪输入框')
    expect(props).toContain('data-terminal-state')
  })

  it('projects a safe connected status state', () => {
    const element = TerminalPanel({ state: 'connected', status: 'session 3 · exit 0' } as TerminalPanelProps)
    const props = JSON.stringify(element.props)
    expect(props).toContain('已连接')
    expect(props).toContain('session 3 · exit 0')
    expect(props).toContain('data-terminal-state')
  })
})
