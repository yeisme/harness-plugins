import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import { apply, buildProbeRows, ExamplePanel, panelPlacement } from '../src/client/index.js'
import { probeCapability } from '../src/probe.js'

/**
 * CLIENT 层参考面：probe-first 三态降级。seam 组合逐一验证：
 * 全到岗（入口可用）、数据 seam 缺席（入口可见但禁用+原因）、
 * pane 缺席（overlay 降级）、放置 seam 全缺（不注册不抛错）、
 * 宿主读取抛错（unavailable 原因如实呈现）。
 * fake ctx/slot registry 只实现结构面；渲染用 react-dom/server（无 DOM 依赖）。
 */

interface RegisteredView {
  readonly slot: string
  readonly input: Record<string, unknown>
  readonly component?: (props?: Record<string, unknown>) => unknown
  unregistered: boolean
}

interface Harness {
  readonly ctx: unknown
  readonly views: RegisteredView[]
}

function makeHarness(options: { slots?: boolean; pane?: boolean; data?: boolean; throwOnData?: boolean } = {}): Harness {
  const views: RegisteredView[] = []
  const record = (slot: string, input: Record<string, unknown>, component?: (props?: Record<string, unknown>) => unknown): (() => void) => {
    const view: RegisteredView = { slot, input, component, unregistered: false }
    views.push(view)
    return () => {
      view.unregistered = true
    }
  }
  const slots =
    options.slots === true
      ? {
          inject: (slot: string, factory: () => (() => void) | undefined): (() => void) => factory() ?? (() => {}),
          register: (input: Record<string, unknown>, component: (props?: Record<string, unknown>) => unknown): (() => void) =>
            record(String(input.name ?? ''), input, component),
        }
      : undefined
  const pane =
    options.pane === true
      ? {
          registerView: ({ descriptor }: { descriptor: Record<string, unknown>; component: () => unknown }): (() => void) =>
            record(String(descriptor.kind ?? ''), descriptor),
          openView: () => {},
        }
      : undefined
  const data =
    options.data === true
      ? { snapshot: () => ({ meta: { freshness: 'fresh' as const, version: 'v1' }, summary: { text: 'demo', truncated: false } }) }
      : undefined
  const ctx = {
    get: (name: string): unknown => {
      if (name === 'exampleCounter' && options.throwOnData === true) throw new Error('counter registry locked')
      if (name === 'slots') return slots
      if (name === 'paneWorkbench') return pane
      if (name === 'exampleCounter') return data
      return undefined
    },
  }
  return { ctx, views }
}

function headerMarkup(views: readonly RegisteredView[]): string {
  const header = views.find(view => view.slot === 'conversation.session.header.actions')
  expect(header, 'header entry should be registered').toBeDefined()
  const face = (header?.input as { inject?: () => object }).inject?.()
  const element = header?.component?.(face) as ReactElement
  return renderToStaticMarkup(element)
}

function probeRows(dataPresent: boolean) {
  return buildProbeRows({
    slots: probeCapability(() => ({})),
    pane: probeCapability(() => ({})),
    data: probeCapability(() => (dataPresent ? {} : undefined)),
  })
}

describe('all seams available', () => {
  it('places the panel as a pane view and renders an enabled header entry', () => {
    const harness = makeHarness({ slots: true, pane: true, data: true })
    const dispose = apply(harness.ctx)
    expect(harness.views.map(view => view.slot)).toEqual(['workspace.dsh-plugin-example', 'conversation.session.header.actions'])
    const markup = headerMarkup(harness.views)
    expect(markup).toContain('<button')
    expect(markup).not.toContain('disabled')
    dispose()
    expect(harness.views.every(view => view.unregistered)).toBe(true)
  })

  it('reports all probe rows available and pane placement', () => {
    expect(probeRows(true).map(row => row.status)).toEqual(['available', 'available', 'available'])
    expect(panelPlacement({ slots: probeCapability(() => ({})), pane: probeCapability(() => ({})) })).toBe('pane')
  })
})

describe('data seam missing (needs_contract)', () => {
  it('keeps the header entry visible but disabled with a readable reason', () => {
    const harness = makeHarness({ slots: true, pane: true })
    apply(harness.ctx)
    const markup = headerMarkup(harness.views)
    expect(markup).toContain('disabled')
    expect(markup).toContain('seam not shipped in this host (needs_contract)')
  })

  it('shows the degrade row inside the panel', () => {
    const markup = renderToStaticMarkup(ExamplePanel({ rows: probeRows(false) }) as ReactElement)
    expect(markup).toContain('exampleCounter: needs_contract')
    expect(markup).toContain('seam not shipped in this host (needs_contract)')
  })
})

describe('pane seam missing (overlay degrade)', () => {
  it('falls back to the shell.overlay resident seat', () => {
    const harness = makeHarness({ slots: true, data: true })
    apply(harness.ctx)
    expect(harness.views.map(view => view.slot).sort()).toEqual(['conversation.session.header.actions', 'shell.overlay'])
    expect(panelPlacement({ slots: probeCapability(() => ({})), pane: probeCapability(() => undefined) })).toBe('overlay')
  })
})

describe('host reads throwing (unavailable)', () => {
  it('surfaces the error message as the disable reason instead of swallowing it', () => {
    const harness = makeHarness({ slots: true, pane: true, throwOnData: true })
    apply(harness.ctx)
    const markup = headerMarkup(harness.views)
    expect(markup).toContain('disabled')
    expect(markup).toContain('seam unavailable: counter registry locked')
  })
})

describe('no registration surface at all (needs_contract across the board)', () => {
  it('registers nothing, does not throw, and returns an idempotent disposer', () => {
    const harness = makeHarness({})
    const dispose = apply(harness.ctx)
    expect(harness.views).toHaveLength(0)
    expect(() => dispose()).not.toThrow()
    expect(() => dispose()).not.toThrow()
    expect(panelPlacement({ slots: probeCapability(() => undefined), pane: probeCapability(() => undefined) })).toBe('none')
  })
})

describe('dispose symmetry', () => {
  it('unregisters every registered surface exactly once', () => {
    const harness = makeHarness({ slots: true, pane: true, data: true })
    const dispose = apply(harness.ctx)
    expect(harness.views).toHaveLength(2)
    dispose()
    dispose()
    expect(harness.views.every(view => view.unregistered)).toBe(true)
  })
})
