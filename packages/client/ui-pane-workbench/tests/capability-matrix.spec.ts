// @vitest-environment jsdom
import { createElement } from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  openWorkspaceCapabilitiesView,
  registerWorkspaceCapabilitiesCommand,
  registerWorkspaceCapabilitiesView,
  WorkspaceCapabilitiesView,
  WORKSPACE_CAPABILITIES_COMMAND_ID,
  WORKSPACE_CAPABILITIES_VIEW_KIND,
} from '../src/capabilities-view.js'
import { apply } from '../src/client.js'
import { PaneCommandRegistry } from '../src/composition.js'
import { PaneWorkbenchController } from '../src/controller.js'
import {
  createExperienceTierTracker,
  isRedactedCapabilityMatrixEvidence,
  WORKSPACE_SEAM_IDS,
  type CapabilityMatrixEvidenceRecordV1,
  type WorkspaceProbeStateV1,
  type WorkspaceSeamProbeSetV1,
} from '../src/experience-tier.js'
import { setActiveLocale } from '../src/i18n/locale.js'
import { PaneViewRegistry } from '../src/view-registry.js'

afterEach(cleanup)
beforeEach(() => setActiveLocale('en'))

function probeSet(patches: Partial<Record<(typeof WORKSPACE_SEAM_IDS)[number], WorkspaceProbeStateV1>> = {}): WorkspaceSeamProbeSetV1 {
  const base = Object.fromEntries(WORKSPACE_SEAM_IDS.map(seam => [seam, 'missing'])) as Record<(typeof WORKSPACE_SEAM_IDS)[number], WorkspaceProbeStateV1>
  return Object.freeze({ ...base, ...patches })
}

const TIER1_PROBES = probeSet({
  'workspace.core-pane.v1': 'available',
  'shell.workspace.right': 'available',
  'shell.workspace.bottom': 'available',
  'command-surface': 'available',
})

describe('Workspace Capabilities view registration', () => {
  it('registers a picker-visible singleton view and a /workspace command', () => {
    const registry = new PaneViewRegistry({ capabilities: new Set(['pane.workbench.v1']) })
    const controller = new PaneWorkbenchController({ registry })
    const commands = new PaneCommandRegistry()
    const tracker = createExperienceTierTracker({ probe: () => TIER1_PROBES })
    const disposeView = registerWorkspaceCapabilitiesView(registry, tracker)
    const disposeCommand = registerWorkspaceCapabilitiesCommand(commands, controller)
    expect(registry.get(WORKSPACE_CAPABILITIES_VIEW_KIND)?.showInPicker).toBe(true)
    const entry = commands.snapshot().find(registration => registration.descriptor.id === WORKSPACE_CAPABILITIES_COMMAND_ID)
    expect(entry?.descriptor.slash?.name).toBe('workspace')
    void commands.execute(WORKSPACE_CAPABILITIES_COMMAND_ID)
    expect(Object.values(controller.getSnapshot().views).some(view => view.kind === WORKSPACE_CAPABILITIES_VIEW_KIND)).toBe(true)
    disposeCommand()
    disposeView()
    controller.dispose()
  })

  it('opens the view through the controller like other Core views (singleton)', () => {
    const registry = new PaneViewRegistry({ capabilities: new Set(['pane.workbench.v1']) })
    const controller = new PaneWorkbenchController({ registry })
    const tracker = createExperienceTierTracker({ probe: () => TIER1_PROBES })
    registerWorkspaceCapabilitiesView(registry, tracker)
    openWorkspaceCapabilitiesView(controller)
    openWorkspaceCapabilitiesView(controller)
    expect(Object.values(controller.getSnapshot().views).filter(view => view.kind === WORKSPACE_CAPABILITIES_VIEW_KIND)).toHaveLength(1)
    controller.dispose()
  })
})

describe('Workspace Capabilities view rendering', () => {
  it('renders tier, one row per seam, reasons and unlock hints for unavailable seams', () => {
    const tracker = createExperienceTierTracker({ probe: () => TIER1_PROBES })
    const { container } = render(createElement(WorkspaceCapabilitiesView, { tracker }))
    expect(container.querySelector('[data-capabilities-tier]')?.getAttribute('data-capabilities-tier')).toBe('1')
    expect(container.textContent).toContain('Tier 1 · Core pane docking')
    expect(container.querySelectorAll('[data-capability-seam]')).toHaveLength(WORKSPACE_SEAM_IDS.length)
    expect(container.querySelector('[data-capability-seam="workspace.core-pane.v1"]')?.textContent).toContain('Available')
    const terminalRow = container.querySelector('[data-capability-seam="terminal-host-v2"]')
    expect(terminalRow?.textContent).toContain('Missing')
    expect(terminalRow?.textContent).toContain('Requires the interactive terminal host seam.')
    // Unlock hints only on unavailable rows: terminal, preview, artifact.
    expect(container.querySelectorAll('[data-capability-unlock]')).toHaveLength(3)
    expect(container.innerHTML).not.toMatch(/https?:|file:|\/workspaces/)
  })

  it('renders standard reason copy in zh', () => {
    setActiveLocale('zh')
    const tracker = createExperienceTierTracker({ probe: () => probeSet({ 'workspace.core-pane.v1': 'contract_mismatch' }) })
    const { container } = render(createElement(WorkspaceCapabilitiesView, { tracker }))
    expect(container.textContent).toContain('Tier 0 · 发布版 overlay')
    expect(container.querySelector('[data-capability-seam="workspace.core-pane.v1"]')?.textContent).toContain('检测到残缺的 seam')
  })

  it('emits unlock_hint_clicked with only the seam category', () => {
    const records: CapabilityMatrixEvidenceRecordV1[] = []
    const tracker = createExperienceTierTracker({ probe: () => TIER1_PROBES })
    const { container } = render(createElement(WorkspaceCapabilitiesView, { tracker, onEvidence: record => records.push(record) }))
    const unlock = container.querySelector('[data-capability-unlock="terminal-host-v2"]')
    expect(unlock).not.toBeNull()
    fireEvent.click(unlock as Element)
    const clicked = records.filter(record => record.kind === 'unlock_hint_clicked')
    expect(clicked).toHaveLength(1)
    expect(clicked[0]).toMatchObject({ seamCategory: 'terminal_host' })
    expect(isRedactedCapabilityMatrixEvidence(clicked[0])).toBe(true)
  })

  it('emits disabled_reason_shown once per reason category, not per row or re-render', () => {
    const records: CapabilityMatrixEvidenceRecordV1[] = []
    // core-pane + right + bottom share the workspace_seam_missing category.
    const tracker = createExperienceTierTracker({ probe: () => probeSet() })
    const view = render(createElement(WorkspaceCapabilitiesView, { tracker, onEvidence: record => records.push(record) }))
    const shown = records.filter(record => record.kind === 'disabled_reason_shown')
    const categories = shown.map(record => record.reasonCategory)
    expect(categories.length).toBeGreaterThan(0)
    expect(new Set(categories).size).toBe(categories.length)
    expect(categories).toContain('workspace_seam_missing')
    const count = records.length
    view.rerender(createElement(WorkspaceCapabilitiesView, { tracker, onEvidence: record => records.push(record) }))
    expect(records).toHaveLength(count)
  })

  it('re-renders from a re-judged snapshot after hot-plug invalidation', () => {
    let probes = probeSet()
    const tracker = createExperienceTierTracker({ probe: () => probes })
    const { container } = render(createElement(WorkspaceCapabilitiesView, { tracker }))
    expect(container.querySelector('[data-capabilities-tier]')?.getAttribute('data-capabilities-tier')).toBe('0')
    probes = TIER1_PROBES
    act(() => { tracker.invalidate() })
    expect(container.querySelector('[data-capabilities-tier]')?.getAttribute('data-capabilities-tier')).toBe('1')
    expect(container.textContent).toContain('Tier 1 · Core pane docking')
  })
})

describe('apply() tier wiring', () => {
  interface MockHost {
    readonly ctx: { get(name: string): unknown; provide: ReturnType<typeof vi.fn> }
    readonly services: Record<string, unknown>
    readonly calls: string[]
    readonly face: () => {
      experienceTier: { getSnapshot(): { tier: number }; subscribe(l: () => void): () => void; invalidate(): unknown }
      views: { get(kind: string): { showInPicker?: boolean } | undefined }
      commands: { snapshot(): readonly { descriptor: { id: string } }[] }
      executeCommand(id: string): Promise<unknown>
      controller: { getSnapshot(): { views: Record<string, { kind: string }> } }
    }
  }

  function makeHost(options: { coreSeams: boolean; commands?: unknown; tier2?: boolean }): MockHost {
    const calls: string[] = []
    const slots = {
      spec: (name: string) => options.coreSeams && name.startsWith('shell.workspace.') ? { kind: 'single', scope: 'root' } : undefined,
      inject: (_name: string, setup: () => () => void) => setup(),
      register: () => vi.fn(),
    }
    const layoutHandle = {
      update: vi.fn(),
      getSnapshot: () => ({ attached: true, rightVisible: false, bottomVisible: false, rightWidth: 480, bottomRatio: 0.34, activeRegion: 'right' as const }),
      subscribe: () => () => {},
      dispose: vi.fn(),
    }
    const services: Record<string, unknown> = { slots }
    if (options.coreSeams) services['workspaceLayout'] = { corePaneVersion: 'workspace.core-pane.v1', attach: vi.fn(() => layoutHandle) }
    if (options.commands !== undefined) services['commands'] = options.commands
    if (options.tier2 === true) {
      services['dsh.terminalHost'] = { capability: 'terminal-host', attachTerminal: () => ({}) }
      services['dsh.previewResource'] = { capabilities: ['PreviewResourceV1'], openPreview: async () => ({}), readPreview: async () => ({}), releasePreview: async () => undefined }
      services['dsh.artifactIntents'] = { capabilities: ['ArtifactIntentV1'] }
    }
    const provide = vi.fn()
    const ctx = { get: (name: string) => { calls.push(name); return services[name] }, provide }
    return {
      ctx,
      services,
      calls,
      face: () => provide.mock.calls.find(call => call[0] === 'paneWorkbench')?.[1] as never,
    }
  }

  it('exposes a session tier projection on the client face (overlay Tier 0)', () => {
    const host = makeHost({ coreSeams: false })
    const dispose = apply(host.ctx as never)
    expect(host.face().experienceTier.getSnapshot().tier).toBe(0)
    expect(host.face().views.get(WORKSPACE_CAPABILITIES_VIEW_KIND)?.showInPicker).toBe(true)
    expect(host.face().commands.snapshot().some(entry => entry.descriptor.id === WORKSPACE_CAPABILITIES_COMMAND_ID)).toBe(true)
    dispose()
  })

  it('judges Tier 1 on Core seams and Tier 2 when every seam is present', () => {
    const tier1 = makeHost({ coreSeams: true })
    const dispose1 = apply(tier1.ctx as never)
    expect(tier1.face().experienceTier.getSnapshot().tier).toBe(1)
    dispose1()
    const tier2 = makeHost({ coreSeams: true, commands: { list: () => [] }, tier2: true })
    const dispose2 = apply(tier2.ctx as never)
    expect(tier2.face().experienceTier.getSnapshot().tier).toBe(2)
    dispose2()
  })

  it('caches probes per session and re-judges on command-surface hot-plug', () => {
    const listeners = new Set<() => void>()
    const host = makeHost({
      coreSeams: false,
      commands: {
        list: () => [],
        subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener) },
      },
    })
    const dispose = apply(host.ctx as never)
    const face = host.face()
    expect(face.experienceTier.getSnapshot().tier).toBe(0)
    face.experienceTier.getSnapshot()
    face.experienceTier.getSnapshot()
    expect(host.calls.filter(name => name === 'dsh.terminalHost')).toHaveLength(1)

    // Seam hot-plug: workspace seams appear, the command surface announces the change.
    const notified = vi.fn()
    face.experienceTier.subscribe(notified)
    const slots = host.services['slots'] as { spec: (name: string) => unknown }
    slots.spec = name => name.startsWith('shell.workspace.') ? { kind: 'single', scope: 'root' } : undefined
    host.services['workspaceLayout'] = { corePaneVersion: 'workspace.core-pane.v1', attach: vi.fn() }
    for (const listener of listeners) listener()
    expect(face.experienceTier.getSnapshot().tier).toBe(1)
    expect(notified).toHaveBeenCalledTimes(1)
    expect(host.calls.filter(name => name === 'dsh.terminalHost')).toHaveLength(2)
    dispose()
  })
})
