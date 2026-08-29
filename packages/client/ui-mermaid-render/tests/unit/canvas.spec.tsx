// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MermaidCanvas } from '../../src/client/canvas.tsx'
import { labelsFor } from '../../src/client/locales.ts'

describe('MermaidCanvas', () => {
  it('supports keyboard zoom/reset and capability-gated pane opening', () => {
    const focus = vi.fn()
    const open = vi.fn()
    render(<MermaidCanvas
      labels={labelsFor('en')}
      source="graph TD"
      svg="<svg><path d='M0 0'/></svg>"
      onFocusChange={focus}
      onSourceVisibleChange={() => {}}
      onOpenSvg={() => {}}
      onOpenInPane={open}
    />)
    const canvas = screen.getByRole('application', { name: 'Mermaid diagram canvas' })
    fireEvent.keyDown(canvas, { key: '+' })
    expect(focus).toHaveBeenLastCalledWith(expect.objectContaining({ scale: 1.2 }))
    fireEvent.click(screen.getByRole('button', { name: 'Open in pane' }))
    expect(open).toHaveBeenCalledOnce()
  })

  it('shows a visible alert while preserving source control on failure', () => {
    render(<MermaidCanvas labels={labelsFor('zh')} source="bad" error="解析失败" onSourceVisibleChange={() => {}} onOpenSvg={() => {}} />)
    expect(screen.getByRole('alert').textContent).toContain('解析失败')
    expect(screen.getByRole('button', { name: '收起源码' })).toBeTruthy()
  })
})
