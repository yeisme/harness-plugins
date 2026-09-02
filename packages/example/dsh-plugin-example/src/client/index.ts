/**
 * DSH plugin example browser entry（ModuleLoader face）— CLIENT 层参考面。
 *
 * probe-first 降级教义的完整演示（三态合同见 src/probe.ts）：
 * - `slots` seam：header 入口注册（缺席 → needs_contract，不注册任何死按钮）；
 * - `paneWorkbench` seam：面板落位（缺席 → 降级 shell.overlay 座位；两者都缺 →
 *   面板不出现，状态仍可查询）；
 * - `exampleCounter` 演示数据 seam：缺席/抛错 → 入口保持可见但禁用并给出
 *   可读原因（绝不伪造可用）。真实插件中该面经 typert Remote 到达
 * （参照 packages/host/dsh-token-usage 的 tokenUsage Remote）。
 *
 * 本包零运行时依赖：react/cordis 均为宿主提供的 optional peer，经
 * ModuleLoader require 注入；client.js 单文件自包含（bundle 层契约）。
 *
 * @module @yeisme/dsh-plugin-example/client
 */

import { createElement, type ReactNode } from 'react'
import { degradeReason, probeCapability, type ProbeResult } from '../probe.js'
import type { ExampleWireSnapshot } from '../wire.js'

export { applyExampleActionV1, createExampleStructuredSurfaceV1, previewExampleActionV1 } from '../structured-surface.js'
export type { ExampleActionPreviewV1 } from '../structured-surface.js'

export const name = 'dsh-plugin-example'
export const inject = ['slots'] as const

// ── 结构面（结构化探测：形状不对 = seam 未到岗，绝不硬造）───────────────────

/** 演示数据源：任何暴露 snapshot() 的 ctx 面（真实形态为 typert Remote）。 */
export interface ExampleDataSourceFace {
  snapshot(): ExampleWireSnapshot
}

/** header 动作 slot 的注入面（宿主把 inject() 结果作为 props 传给组件）。 */
export interface ExampleHeaderFace {
  open: () => void
  isReady: () => boolean
  disabledReason: () => string
}

interface SlotsFace {
  inject(slot: string, factory: () => (() => void) | undefined): () => void
  register(input: Record<string, unknown>, component: (props?: Record<string, unknown>) => ReactNode): () => void
}

interface PaneWorkbenchFace {
  registerView(input: { descriptor: Record<string, unknown>; component: () => ReactNode }): () => void
  openView(request: Record<string, unknown>): void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** 结构 seam 获取：吞掉读取异常（形状不对即未到岗），供 probeCapability 用。 */
function lookupRecord(ctx: unknown, key: string): Record<string, unknown> | undefined {
  try {
    const getter = (ctx as { get?: (name: string) => unknown }).get
    const raw = typeof getter === 'function' ? getter.call(ctx, key) : (ctx as Record<string, unknown>)[key]
    return isRecord(raw) ? raw : undefined
  } catch {
    return undefined
  }
}

/**
 * 数据 seam 获取：不吞异常——宿主读取抛错要如实呈现为 unavailable
 * （三态合同的可观测演示），而不是吞成 needs_contract 或伪造可用。
 */
function acquireDataSource(ctx: unknown): ExampleDataSourceFace | undefined {
  const getter = (ctx as { get?: (name: string) => unknown }).get
  const raw = typeof getter === 'function' ? getter.call(ctx, 'exampleCounter') : (ctx as Record<string, unknown>)['exampleCounter']
  if (!isRecord(raw) || typeof raw.snapshot !== 'function') return undefined
  return raw as unknown as ExampleDataSourceFace
}

function acquireSlots(ctx: unknown): SlotsFace | undefined {
  const candidate = lookupRecord(ctx, 'slots')
  if (candidate === undefined || typeof candidate.inject !== 'function' || typeof candidate.register !== 'function') return undefined
  return candidate as unknown as SlotsFace
}

function acquirePane(ctx: unknown): PaneWorkbenchFace | undefined {
  const candidate = lookupRecord(ctx, 'paneWorkbench')
  if (candidate === undefined || typeof candidate.registerView !== 'function' || typeof candidate.openView !== 'function') return undefined
  return candidate as unknown as PaneWorkbenchFace
}

// ── 面板与入口（纯函数组件：探测结果在 apply 时定格，无 hooks）──────────────

/** 面板可见的探测行：每个 seam 一行，缺什么、为什么，明说。 */
export interface ExampleProbeRow {
  readonly seam: string
  readonly status: ProbeResult<unknown>['status']
  readonly detail: string
}

/** 由三个 seam 的探测结果构造面板行（导出供测试与冒烟对账）。 */
export function buildProbeRows(probes: {
  readonly slots: ProbeResult<unknown>
  readonly pane: ProbeResult<unknown>
  readonly data: ProbeResult<unknown>
}): readonly ExampleProbeRow[] {
  const row = (seam: string, probe: ProbeResult<unknown>, readyDetail: string): ExampleProbeRow => ({
    seam,
    status: probe.status,
    detail: probe.status === 'available' ? readyDetail : degradeReason(probe),
  })
  return [
    row('slots', probes.slots, 'header entry registered'),
    row('paneWorkbench', probes.pane, 'panel placed as workspace view'),
    row('exampleCounter', probes.data, 'data seam live'),
  ]
}

export function ExamplePanel({ rows }: { readonly rows: readonly ExampleProbeRow[] }): ReactNode {
  return createElement(
    'section',
    { 'data-dsh-plugin-example-panel': true, 'aria-label': 'DSH plugin example' },
    createElement('h2', { 'data-dsh-plugin-example-title': true }, 'DSH Plugin Example'),
    createElement(
      'p',
      { 'data-dsh-plugin-example-note': true },
      'Probe-first reference plugin: every seam below is probed before use; a missing seam degrades visibly instead of registering a dead control.',
    ),
    createElement(
      'ul',
      { 'data-dsh-plugin-example-probes': true },
      ...rows.map(row =>
        createElement(
          'li',
          { key: row.seam, 'data-dsh-plugin-example-probe': row.seam, 'data-status': row.status },
          `${row.seam}: ${row.status} — ${row.detail}`,
        ),
      ),
    ),
  )
}

// ── apply：探测 → 注册 → 释放对称 ──────────────────────────────────────────

/**
 * Client 插件入口。返回 disposer：逆序释放全部注册（幂等），
 * HMR 卸载后不留陈旧行。
 */
export function apply(ctx: unknown): () => void {
  const dataProbe = probeCapability(() => acquireDataSource(ctx))
  const slotsProbe = probeCapability(() => acquireSlots(ctx))
  const paneProbe = probeCapability(() => acquirePane(ctx))

  const rows = buildProbeRows({ slots: slotsProbe, pane: paneProbe, data: dataProbe })
  const ready = dataProbe.status === 'available'
  const disabledReason = dataProbe.status === 'available' ? '' : degradeReason(dataProbe)

  const disposers: Array<() => void> = []

  // 面板落位：pane seam 优先，缺席降级 overlay 座位；两者都缺 → 面板不出现。
  const panel = (): ReactNode => createElement(ExamplePanel, { rows })
  if (paneProbe.status === 'available') {
    disposers.push(paneProbe.capability.registerView({
      descriptor: {
        kind: 'workspace.dsh-plugin-example',
        label: 'Example',
        componentKey: 'dsh-plugin-example-panel',
        role: 'navigator',
        preferredRegion: 'right',
        retention: 'keep-alive',
        singleton: true,
      },
      component: panel,
    }))
  } else if (slotsProbe.status === 'available') {
    const slots = slotsProbe.capability
    const register = slots.register.bind(slots)
    disposers.push(slots.inject('shell.overlay', () =>
      register({ name: 'shell.overlay', id: 'yeisme.dsh-plugin-example.panel', order: 95, label: 'Example' }, panel)))
  }

  // header 入口：可见；数据 seam 未到岗时禁用 + 可读原因（不伪造可用）。
  if (slotsProbe.status === 'available') {
    const slots = slotsProbe.capability
    const register = slots.register.bind(slots)
    const openPanel = (): void => {
      if (paneProbe.status === 'available') {
        paneProbe.capability.openView({
          kind: 'workspace.dsh-plugin-example',
          resourceKey: 'dsh-plugin-example:probe',
          role: 'navigator',
          preferredRegion: 'right',
          retention: 'keep-alive',
          singleton: true,
          title: 'Example',
        })
      }
      // overlay 降级路径：面板常驻 overlay 座位，open 无需额外动作。
    }
    disposers.push(slots.inject('conversation.session.header.actions', () =>
      register(
        {
          name: 'conversation.session.header.actions',
          id: 'dsh-plugin-example-open',
          order: 98,
          label: 'Example',
          inject: (): ExampleHeaderFace => ({
            open: openPanel,
            isReady: () => ready,
            disabledReason: () => disabledReason,
          }),
        },
        (props?: Record<string, unknown>) => {
          const face = (props ?? {}) as Partial<ExampleHeaderFace>
          const enabled = face.isReady?.() ?? false
          const reason = face.disabledReason?.() ?? 'example data seam missing'
          return createElement(
            'button',
            {
              type: 'button',
              'data-dsh-plugin-example-open': true,
              disabled: !enabled,
              title: enabled ? 'DSH plugin example' : reason,
              onClick: () => {
                face.open?.()
              },
            },
            'Example',
          )
        },
      )))
  }

  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    for (const dispose of [...disposers].reverse()) dispose()
  }
}

/** 面板落位结果（导出仅供测试与冒烟观察）。 */
export function panelPlacement(probes: {
  readonly slots: ProbeResult<unknown>
  readonly pane: ProbeResult<unknown>
}): 'pane' | 'overlay' | 'none' {
  if (probes.pane.status === 'available') return 'pane'
  if (probes.slots.status === 'available') return 'overlay'
  return 'none'
}

const DshPluginExampleClientPlugin = { name, inject, apply }
export default DshPluginExampleClientPlugin
