// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { WorkbenchIconButton, WorkbenchTextButton } from '../src/chrome/control.tsx'

afterEach(cleanup)

describe('WorkbenchIconButton (V3 2.2 semantic icon controls)', () => {
  it('derives aria-label AND tooltip from the single required label', () => {
    const { container } = render(<WorkbenchIconButton icon="split" label="Split right" onClick={() => {}} />)
    const button = container.querySelector('button')
    expect(button?.getAttribute('aria-label')).toBe('Split right')
    expect(container.querySelector('.pwr-tip')?.getAttribute('data-tip')).toBe('Split right')
    expect(button?.querySelector('svg')).not.toBeNull()
  })

  it('never ships a bare glyph: no text-only content and no native title duplication', () => {
    const { container } = render(<WorkbenchIconButton icon="close" label="Close tab" onClick={() => {}} />)
    const button = container.querySelector('button')
    expect(button?.getAttribute('title')).toBeNull()
    expect(button?.textContent?.trim()).toBe('')
  })

  it('disabled controls expose aria-disabled and swallow clicks', () => {
    const onClick = vi.fn()
    const { container } = render(<WorkbenchIconButton icon="maximize" label="Maximize pane" disabled onClick={onClick} />)
    const button = container.querySelector('button') as HTMLButtonElement
    expect(button.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('status is semantic data-status, not color-only, and default omits the attribute', () => {
    const { container, rerender } = render(<WorkbenchIconButton icon="restore" label="Restore" onClick={() => {}} />)
    expect(container.querySelector('button')?.getAttribute('data-status')).toBeNull()
    rerender(<WorkbenchIconButton icon="restore" label="Restore" status="critical" onClick={() => {}} />)
    expect(container.querySelector('button')?.getAttribute('data-status')).toBe('critical')
    rerender(<WorkbenchIconButton icon="pin" label="Pinned" status="active" onClick={() => {}} />)
    expect(container.querySelector('button')?.getAttribute('data-status')).toBe('active')
  })

  it('rejects non-semantic icon names at the boundary (no glyph injection)', () => {
    expect(() => render(<WorkbenchIconButton icon={'var(--x)' as never} label="Bad" onClick={() => {}} />)).toThrow(/frozen semantic name/)
  })

  it('badge content is decorative and hidden from the a11y tree', () => {
    const { container } = render(<WorkbenchIconButton icon="list" label="Manage tabs" badge="7" onClick={() => {}} />)
    const badge = container.querySelector('.pwr-icon-badge')
    expect(badge?.getAttribute('aria-hidden')).toBe('true')
    expect(badge?.textContent).toBe('7')
  })
})

describe('WorkbenchTextButton (V3 2.2 text-bearing toolbar controls)', () => {
  it('keeps label, tooltip, and visible text in one contract', () => {
    const { container } = render(<WorkbenchTextButton label="Open a view" onClick={() => {}}>Open</WorkbenchTextButton>)
    expect(screen.getByRole('button', { name: 'Open a view' })).toBeTruthy()
    expect(container.querySelector('.pwr-tip')?.getAttribute('data-tip')).toBe('Open a view')
    expect(screen.getByText('Open')).toBeTruthy()
  })
})

describe('pane chrome toolbar adoption (V3 2.2)', () => {
  it('tabs.tsx icon-only actions route through WorkbenchIconButton (source-level guard)', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(process.cwd(), 'src/tabs.tsx'), 'utf8')
    // every native title tooltip is paired with an accessible name (no glyph-only controls)
    const titles = (source.match(/\btitle:/g) ?? []).length
    const labels = (source.match(/'aria-label':/g) ?? []).length
    expect(labels).toBeGreaterThanOrEqual(titles)
    expect(titles).toBeGreaterThan(0)
    // the toolbar migrated its icon-only actions to the semantic wrapper
    expect(source).toContain("from './chrome/control.js'")
  })
})

describe('quick pick recommended grouping + sheet + listbox (V3 2.4)', () => {
  it('source carries the recommended group, listbox role, and narrow sheet CSS', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const picker = readFileSync(resolve(process.cwd(), 'src/chrome/quick-pick.tsx'), 'utf8')
    expect(picker).toContain("id: 'recommended'")
    expect(picker).toContain("view.pinned || view.preview")
    expect(picker).toContain("role: 'listbox'")
    const shared = readFileSync(resolve(process.cwd(), 'src/chrome/shared.ts'), 'utf8')
    const sheet = shared.slice(shared.indexOf('@media(max-width:390px){.pwr-picker'))
    expect(sheet).toContain('bottom:0')
    expect(sheet).toContain('max-height:72vh')
    // the fixed full-height overlay pattern is gone: picker is anchored (absolute) + sheet at 390px
    expect(shared).not.toContain('.pwr-picker{position:fixed')
  })
})
