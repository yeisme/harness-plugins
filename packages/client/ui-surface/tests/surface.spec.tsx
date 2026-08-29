// @vitest-environment jsdom
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  Surface,
  SurfaceActionBar,
  SurfaceContextBar,
  SurfaceSection,
  SurfaceState,
  surfaceStyles,
  type SurfaceKind,
} from '../src/index.tsx'

afterEach(cleanup)

describe('shared Web surface composition', () => {
  it('preserves quoted container-grid CSS during server rendering', () => {
    const html = renderToStaticMarkup(<Surface kind="workspace"><SurfaceContextBar title="Creator" nav="Start" /></Surface>)
    expect(html).toContain("grid-template-areas:'copy status actions' 'nav nav nav'")
    expect(html).not.toContain('grid-template-areas:&')
  })

  it('renders every supported surface kind with one scoped style contract', () => {
    const kinds: SurfaceKind[] = ['navigator', 'workspace', 'inspector', 'dialog', 'micro']
    for (const kind of kinds) {
      const view = render(createElement(Surface, { kind, 'aria-label': kind }, kind))
      expect(document.querySelector(`[data-surface-kind="${kind}"]`)).toBeTruthy()
      expect(document.querySelector('[data-yeisme-surface-styles]')?.textContent).toBe(surfaceStyles)
      view.unmount()
    }
  })

  it('composes context, section and actions without owning atomic controls', () => {
    render(<Surface kind="navigator">
      <SurfaceContextBar title="Repository" context="repo:one" status="fresh" nav={<button type="button">Changes</button>} actions={<button type="button">Refresh</button>} />
      <div className="ys-body"><SurfaceSection title="Changes" description="Tracked changes" meta="2"><span>rows</span></SurfaceSection></div>
      <SurfaceActionBar sticky><button type="button">Commit</button></SurfaceActionBar>
    </Surface>)
    expect(screen.getByText('Repository')).toBeTruthy()
    expect(screen.getByRole('navigation')).toBeTruthy()
    expect(screen.getByText('Tracked changes')).toBeTruthy()
    expect(document.querySelector('.ys-action-bar')?.getAttribute('data-sticky')).toBe('true')
  })

  it('maps error to alert and other states to polite status', () => {
    const view = render(<Surface kind="inspector"><SurfaceState phase="error" title="Failed" description="Try again" /></Surface>)
    expect(screen.getByRole('alert').getAttribute('aria-live')).toBe('assertive')
    view.rerender(<Surface kind="inspector"><SurfaceState phase="stale" title="Stale" /></Surface>)
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
    expect(screen.getByRole('status').getAttribute('data-phase')).toBe('stale')
  })

  it('ships container, field, coarse-pointer and reduced-motion rules', () => {
    expect(surfaceStyles).toContain('container:yeisme-surface/inline-size')
    expect(surfaceStyles).toContain('@container yeisme-surface (max-width:720px)')
    expect(surfaceStyles).toContain('@container yeisme-surface (max-width:420px)')
    expect(surfaceStyles).toContain('.ys-field>select')
    expect(surfaceStyles).toContain('@media(pointer:coarse)')
    expect(surfaceStyles).toContain('@media(prefers-reduced-motion:reduce)')
  })
})
