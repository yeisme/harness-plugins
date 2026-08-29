/**
 * DSH Web mermaid 渲染浏览器入口。
 *
 * 不注册 slot、不 shadowing 任何宿主渲染：只以观察器把已稳定的
 * ```mermaid``` fence 增量嫁接为净化 SVG figure。kill-switch：
 * `localStorage['dsh-mermaid'] === 'off'`。
 *
 * @module @yeisme/dsh-client-ui-mermaid-render/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { MarkdownTableEnhancer } from '@yeisme/dsh-client-ui-structured-content'
import { labelsFor } from './locales.ts'
import { createMermaidRenderer } from './render.ts'
import { MermaidGraftController } from './observer.ts'

export { MermaidGraftController, findMermaidFenceCodes, hydrateMermaidFences } from './observer.ts'
export type { GraftOptions } from './observer.ts'
export { createMermaidRenderer } from './render.ts'
export type { MermaidRenderer, MermaidTheme } from './render.ts'
export { labelsFor } from './locales.ts'
export type { MermaidLabels } from './locales.ts'
export { sanitizeMermaidSvg } from './sanitize.ts'
export { MermaidCanvas, type MermaidCanvasProps } from './canvas.tsx'

export const name = 'client-ui-mermaid-render'
export const inject = [] as const

/** Mount the client face and return an exact disposer. */
export async function apply(ctx: ClientContext): Promise<() => void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}
  const english = /^en\b|^en-/i.test(window.navigator.language.trim())
  const tableEnhancer = new MarkdownTableEnhancer(english
    ? { title: 'Table', copy: 'Copy TSV', copied: 'Copied' }
    : { title: '表格', copy: '复制 TSV', copied: '已复制' })
  tableEnhancer.start(document.documentElement)
  let disabled = false
  try {
    disabled = window.localStorage?.getItem('dsh-mermaid') === 'off'
  } catch {
    disabled = false
  }
  if (disabled) {
    ctx.effect(() => () => { tableEnhancer.stop() }, 'dsh-structured-table: enhancer lifecycle')
    return () => { tableEnhancer.stop() }
  }
  const controller = new MermaidGraftController({
    labels: labelsFor(window.navigator.language),
    renderer: createMermaidRenderer(),
  })
  controller.start(document.documentElement)
  ctx.effect(() => () => { controller.stop(); tableEnhancer.stop() }, 'dsh-structured-content: graft lifecycle')
  return () => { controller.stop(); tableEnhancer.stop() }
}
