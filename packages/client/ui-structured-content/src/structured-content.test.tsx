// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StructuredContentFrame } from './structured-content.tsx'

afterEach(() => {
  document.head.querySelectorAll('[data-dsh-structured-content-styles]').forEach(node => { node.remove() })
})

describe('StructuredContentFrame', () => {
  it('renders content-first chrome and capability-gates pane opening', () => {
    const open = vi.fn()
    render(<StructuredContentFrame kind="diagram" ariaLabel="Architecture diagram" title="Diagram" onOpenInPane={open}><svg /></StructuredContentFrame>)
    expect(screen.getByRole('region', { name: 'Architecture diagram' }).getAttribute('data-surface')).toBe('inline')
    fireEvent.click(screen.getByRole('button', { name: 'Open in pane' }))
    expect(open).toHaveBeenCalledOnce()
  })

  it('uses alert semantics for visible failures', () => {
    render(<StructuredContentFrame kind="data-table" ariaLabel="Results" state="error" statusText="Failed"><table /></StructuredContentFrame>)
    expect(screen.getByRole('alert').textContent).toContain('Failed')
  })

  it('injects one shared style element for multiple frames', () => {
    render(<><StructuredContentFrame kind="diagram" ariaLabel="One"><div /></StructuredContentFrame><StructuredContentFrame kind="markdown-table" ariaLabel="Two"><div /></StructuredContentFrame></>)
    expect(document.head.querySelectorAll('[data-dsh-structured-content-styles]')).toHaveLength(1)
  })
})
