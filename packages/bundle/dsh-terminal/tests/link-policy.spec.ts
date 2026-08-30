// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { openTerminalLink, terminalLinkPolicy } from '../src/client/link-policy.ts'

describe('terminalLinkPolicy (V3 6.7 safe URL policy)', () => {
  it('approves only clean https URLs', () => {
    expect(terminalLinkPolicy('https://example.com/docs?a=1')).toMatchObject({ action: 'external' })
    expect(terminalLinkPolicy('  https://example.com/x  ')).toMatchObject({ action: 'external' })
  })

  it('denies file:, javascript:, http:, custom schemes, and scheme-less input', () => {
    expect(terminalLinkPolicy('file:///etc/passwd')).toMatchObject({ action: 'deny', reason: 'scheme' })
    expect(terminalLinkPolicy('javascript:alert(1)')).toMatchObject({ action: 'deny', reason: 'scheme' })
    expect(terminalLinkPolicy('http://insecure.example')).toMatchObject({ action: 'deny', reason: 'scheme' })
    expect(terminalLinkPolicy('dshresolver://resolve?path=/x')).toMatchObject({ action: 'deny', reason: 'scheme' })
  })

  it('denies relative or unresolved paths — they never become fetches', () => {
    expect(terminalLinkPolicy('./report.pdf')).toMatchObject({ action: 'deny', reason: 'relative' })
    expect(terminalLinkPolicy('/absolute/path')).toMatchObject({ action: 'deny', reason: 'relative' })
    expect(terminalLinkPolicy('')).toMatchObject({ action: 'deny', reason: 'relative' })
  })

  it('never auto-executes: denied links and unconfirmed externals do nothing', () => {
    const open = vi.fn()
    Object.assign(window, { open })
    expect(openTerminalLink('file:///etc/passwd')).toBe(false)
    expect(openTerminalLink('https://example.com/x', () => false)).toBe(false)
    expect(open).not.toHaveBeenCalled()
    expect(openTerminalLink('https://example.com/x', () => true)).toBe(true)
    expect(open).toHaveBeenCalledWith('https://example.com/x', '_blank', 'noopener,noreferrer')
  })
})
