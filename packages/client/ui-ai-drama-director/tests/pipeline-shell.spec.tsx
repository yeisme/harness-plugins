// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import type { WorkSurfaceCapsuleV1 } from '@yeisme/dsh-plugin-contracts'
import { PipelineWorkbenchShell } from '../src/client/pipeline/workbench-shell.js'
import type { PipelineWorkbenchShellProps } from '../src/client/pipeline/types.js'

afterEach(cleanup)

function capsuleFixture(overrides: Partial<WorkSurfaceCapsuleV1> = {}): WorkSurfaceCapsuleV1 {
  return {
    contract_version: 'dsh.creative-pipeline.v1',
    project_ref: 'project:one',
    surface: 'workbench',
    unsaved_draft: false,
    pending_review: false,
    menu: {
      project: { text: 'Night Rain', truncated: false },
      surface: 'workbench',
      work_context: { text: 'Episode 01 · Shot 04', truncated: false },
      run_state: 'running',
      next_action: { text: 'Review candidate C2', truncated: false },
    },
    ...overrides,
  }
}

function shellProps(overrides: Partial<PipelineWorkbenchShellProps> = {}): PipelineWorkbenchShellProps {
  return {
    title: 'Pipeline',
    project: { ref: 'project:one', label: 'Night Rain' },
    projects: [
      { ref: 'project:one', label: 'Night Rain' },
      { ref: 'project:two', label: 'Harbor Lights', context: 'writing' },
    ],
    section: 'workflow',
    capsule: capsuleFixture(),
    onSelectProject: vi.fn(),
    onSelectSection: vi.fn(),
    onSwitchSurface: vi.fn(),
    onSelectRailItem: vi.fn(),
    onOpenProduction: vi.fn(),
    onSelectObject: vi.fn(),
    productions: [{ ref: 'production:one', title: 'Episode 01', meta: '12 shots' }],
    objects: [
      { id: 'node-1', kind: 'scene', title: 'Rooftop chase', status: 'ready' },
      { id: 'node-2', kind: 'shot', title: 'Shot 04', status: 'blocked', selected: true },
    ],
    inspectorTabs: {
      inspector: <p>Inspector body</p>,
      versions: <p>Versions body</p>,
      comments: <p>Comments body</p>,
    },
    runStrip: {
      log: [{ id: 'log-1', text: 'Run observed', status: 'running', meta: '08:12' }],
      validation: [{ id: 'val-1', text: 'Edge draft retained', status: 'blocked' }],
      queue: [],
    },
    ...overrides,
  }
}

describe('PipelineWorkbenchShell capsule', () => {
  it('reports surface switches through the callback without touching other props', () => {
    const props = shellProps({ capsule: capsuleFixture({ surface: 'agent' }) })
    render(<PipelineWorkbenchShell {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Workbench' }))
    expect(props.onSwitchSurface).toHaveBeenCalledWith('workbench')
    expect(props.onSwitchSurface).toHaveBeenCalledTimes(1)
    expect(props.onSelectProject).not.toHaveBeenCalled()
    expect(props.onSelectSection).not.toHaveBeenCalled()
    expect(props.onSelectObject).not.toHaveBeenCalled()
    expect(props.onOpenProduction).not.toHaveBeenCalled()
  })

  it('marks the active surface segment with aria-pressed', () => {
    render(<PipelineWorkbenchShell {...shellProps({ capsule: capsuleFixture({ surface: 'agent' }) })} />)
    expect(screen.getByRole('button', { name: 'Agent' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Workbench' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('renders run state with tone dot, text, and progress; blocked maps to critical', () => {
    const capsule = capsuleFixture({
      unsaved_draft: true,
      pending_review: true,
      run: { state: 'blocked', progress: { completed: 3, total: 8 } },
    })
    const { container } = render(<PipelineWorkbenchShell {...shellProps({ capsule })} />)
    const status = container.querySelector('.plw-capsule-run')
    expect(status).toBeTruthy()
    expect(status!.getAttribute('role')).toBe('status')
    expect(status!.textContent).toContain('blocked')
    expect(status!.textContent).toContain('3/8')
    expect(status!.querySelector('.vk-dot')?.getAttribute('data-tone')).toBe('critical')
    expect(screen.getByLabelText('Unsaved draft')).toBeTruthy()
    expect(screen.getByText('Pending review')).toBeTruthy()
    expect(container.querySelector('.plw-capsule')).toBeTruthy()
  })

  it('maps running/needs_contract/unknown run states to info/warn/critical tones with text', () => {
    for (const [state, tone] of [
      ['running', 'info'],
      ['needs_contract', 'warn'],
      ['unknown', 'critical'],
    ] as const) {
      cleanup()
      const { container } = render(<PipelineWorkbenchShell {...shellProps({ capsule: capsuleFixture({ run: { state } }) })} />)
      const status = container.querySelector('.plw-capsule-run')
      expect(status!.textContent).toContain(state)
      expect(status!.querySelector('.vk-dot')?.getAttribute('data-tone')).toBe(tone)
    }
  })

  it('expands the menu with project, surface, context, run, and next action', () => {
    const props = shellProps()
    render(<PipelineWorkbenchShell {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Work surface details' }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getByText('Night Rain')).toBeTruthy()
    expect(within(menu).getByText('Episode 01 · Shot 04')).toBeTruthy()
    expect(within(menu).getByText('running')).toBeTruthy()
    expect(within(menu).getByText('Review candidate C2')).toBeTruthy()
    fireEvent.click(within(menu).getByText('Agent'))
    expect(props.onSwitchSurface).toHaveBeenCalledWith('agent')
  })
})

describe('PipelineWorkbenchShell navigation', () => {
  it('renders a single nav landmark with section switches carrying aria-pressed', () => {
    const props = shellProps({ section: 'models' })
    render(<PipelineWorkbenchShell {...props} />)
    const navs = screen.getAllByRole('navigation')
    expect(navs.length).toBe(1)
    expect(within(navs[0]!).getByRole('button', { name: 'Models' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(navs[0]!).getByRole('button', { name: 'Workflow' }).getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(within(navs[0]!).getByRole('button', { name: 'Gallery' }))
    expect(props.onSelectSection).toHaveBeenCalledWith('gallery')
    expect(props.onSwitchSurface).not.toHaveBeenCalled()
  })

  it('opens the project dropdown and reports the selected project ref only', () => {
    const props = shellProps()
    render(<PipelineWorkbenchShell {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Project: Night Rain' }))
    fireEvent.click(screen.getByText('Harbor Lights · writing'))
    expect(props.onSelectProject).toHaveBeenCalledWith('project:two')
    expect(props.onSelectSection).not.toHaveBeenCalled()
    expect(props.onSwitchSurface).not.toHaveBeenCalled()
  })

  it('reports rail and production entries through their own callbacks', () => {
    const props = shellProps()
    render(<PipelineWorkbenchShell {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Scenes' }))
    expect(props.onSelectRailItem).toHaveBeenCalledWith('scene')
    fireEvent.click(screen.getByRole('button', { name: /Episode 01/ }))
    expect(props.onOpenProduction).toHaveBeenCalledWith('production:one')
  })
})

describe('PipelineWorkbenchShell layout and regions', () => {
  it('scopes styles under [data-pipeline-workbench] with 720px and 420px container queries', () => {
    render(<PipelineWorkbenchShell {...shellProps()} />)
    const style = Array.from(document.querySelectorAll('style')).find(node => node.textContent?.includes('data-pipeline-workbench'))
    expect(style).toBeTruthy()
    expect(style!.textContent).toContain('@container(max-width:720px)')
    expect(style!.textContent).toContain('@container(max-width:420px)')
    expect(style!.textContent).toContain('container-type:inline-size')
    expect(style!.textContent).toContain('--vk-')
    expect(style!.textContent).not.toContain('background:#')
  })

  it('renders rail, canvas host, inspector tabs, and bottom strip regions', () => {
    render(<PipelineWorkbenchShell {...shellProps()} />)
    expect(screen.getByLabelText('Assets and productions')).toBeTruthy()
    expect(document.querySelector('.plw-canvas-host')).toBeTruthy()
    expect(document.querySelector('.plw-inspector')).toBeTruthy()
    expect(screen.getByTestId('plw-run-strip')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Inspector' }).getAttribute('aria-selected')).toBe('true')
  })

  it('shows the canvas placeholder when no canvas binding is supplied', () => {
    render(<PipelineWorkbenchShell {...shellProps({ canvas: undefined })} />)
    expect(screen.getByText('Canvas is not connected')).toBeTruthy()
  })

  it('switches inspector tabs with click and arrow keys and keeps one tabpanel', () => {
    render(<PipelineWorkbenchShell {...shellProps()} />)
    const side = screen.getByTestId('plw-side-tabs')
    fireEvent.click(within(side).getByRole('tab', { name: 'Versions' }))
    expect(within(side).getByRole('tab', { name: 'Versions' }).getAttribute('aria-selected')).toBe('true')
    expect(within(side).getByText('Versions body')).toBeTruthy()
    expect(within(side).getAllByRole('tabpanel').length).toBe(1)
    fireEvent.keyDown(within(side).getByRole('tab', { name: 'Versions' }), { key: 'ArrowRight' })
    expect(within(side).getByRole('tab', { name: 'Comments' }).getAttribute('aria-selected')).toBe('true')
    expect(within(side).getByText('Comments body')).toBeTruthy()
  })

  it('keeps the compact object list wired to selection and the detail overlay', () => {
    const props = shellProps()
    render(<PipelineWorkbenchShell {...props} />)
    // The object list is the compact (<=420px) canvas fold: display:none above
    // the breakpoint, so it is hidden from the jsdom accessibility tree here.
    fireEvent.click(screen.getByRole('button', { name: /Shot 04/, hidden: true }))
    expect(props.onSelectObject).toHaveBeenCalledWith('node-2')
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('tab', { name: 'Inspector' })).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Versions' }))
    expect(within(dialog).getByText('Versions body')).toBeTruthy()
  })
})

describe('BottomRunStrip', () => {
  it('renders injected entries read-only: no buttons, inputs, or links inside', () => {
    render(<PipelineWorkbenchShell {...shellProps()} />)
    const strip = screen.getByTestId('plw-run-strip')
    expect(within(strip).getByText('Run observed')).toBeTruthy()
    expect(within(strip).getByText('Edge draft retained')).toBeTruthy()
    expect(within(strip).getByText('Render Queue')).toBeTruthy()
    expect(strip.querySelector('button')).toBeNull()
    expect(strip.querySelector('input,select,textarea,a')).toBeNull()
    const blocked = within(strip).getByText('Edge draft retained').closest('li')
    expect(blocked?.querySelector('.vk-dot')?.getAttribute('data-tone')).toBe('critical')
  })

  it('announces empty sections instead of fabricating entries', () => {
    render(<PipelineWorkbenchShell {...shellProps()} />)
    const queue = screen.getByLabelText('Render queue')
    expect(within(queue).getByRole('status').textContent).toContain('Nothing to show')
  })
})
