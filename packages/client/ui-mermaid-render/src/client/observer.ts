/**
 * mermaid graft 控制器。
 *
 * 宿主 markdown 管线的 fence 有两种 DOM 形态：流式中是裸
 * `pre > code.language-mermaid`；settle 后是 `div.md-code-block` 卡片
 * （头部 lang 标签 + `pre > code`，code 不带 class）。两种形态都识别，
 * 锚点由 findMermaidFenceCodes 统一给出，并有真实 CodeBlock 的锚点
 * 回归测试钉死。
 * 观察到锚点后先过"稳定门"（文本 STABLE_MS 不变且在文档内），
 * 再把净化后的 SVG figure 作为 `pre` 的兄弟节点插入并隐藏 `pre`。
 * 流式中的 fence 每块都在变，永不触发；React 重挂载/回滚由观察器自愈；
 * stop() 完全还原 DOM。
 */

import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { DiagramFocusV1, StructuredContentSurface } from '@yeisme/dsh-client-ui-structured-content'
import type { MermaidRenderer, MermaidTheme } from './render.ts'
import type { MermaidLabels } from './locales.ts'
import { MermaidCanvas } from './canvas.tsx'

const FIGURE_FLAG = 'data-dsh-mermaid-figure'
const ON_CLASS = 'dsh-mermaid-on'

const STYLE_TEXT = `
figure[${FIGURE_FLAG}]{margin:8px 0;min-width:0;overflow:hidden}
figure[${FIGURE_FLAG}] .dsh-mermaid-stage{display:grid;place-items:center;min-height:180px;overflow:hidden;touch-action:none;cursor:grab;background:var(--vk-bg-base)}
figure[${FIGURE_FLAG}] .dsh-mermaid-stage:active{cursor:grabbing}
figure[${FIGURE_FLAG}] .dsh-mermaid-transform{transform-origin:center;transition:transform 120ms ease-out;will-change:transform}
figure[${FIGURE_FLAG}] .dsh-mermaid-transform svg{display:block;max-width:none;height:auto}
figure[${FIGURE_FLAG}].is-failed{border-left:2px solid var(--vk-tone-critical)}
@media(prefers-reduced-motion:reduce){figure[${FIGURE_FLAG}] .dsh-mermaid-transform{transition:none}}
`

export interface GraftOptions {
  readonly labels: MermaidLabels
  readonly renderer: MermaidRenderer
  readonly stableMs?: number | undefined
  readonly maxSourceBytes?: number | undefined
  readonly surface?: StructuredContentSurface | undefined
  readonly initialFocus?: DiagramFocusV1 | undefined
  readonly onFocusChange?: ((focus: DiagramFocusV1) => void) | undefined
  readonly onOpenInPane?: ((source: string, focus: DiagramFocusV1) => void) | undefined
}

interface GraftRecord {
  readonly host: HTMLElement
  readonly figure: HTMLElement
  readonly reactRoot: Root
  readonly source: string
  svg?: string
  error?: string
  failed: boolean
}

/**
 * 找出当前文档里的 mermaid fence code 元素（流式与 settled 两种形态）。
 * settled 形态以 `div.md-code-block` 头部的 lang 标签文本为准；
 * 流式形态以 `language-mermaid` class 为准（同一元素去重）。
 */
export function findMermaidFenceCodes(root: ParentNode): HTMLElement[] {
  const found = new Set<HTMLElement>()
  for (const el of root.querySelectorAll<HTMLElement>('pre > code.language-mermaid')) found.add(el)
  for (const block of root.querySelectorAll<HTMLElement>('div.md-code-block')) {
    const label = block.firstElementChild?.firstElementChild?.firstElementChild?.textContent
    if (label?.trim().toLowerCase() !== 'mermaid') continue
    for (const code of block.querySelectorAll<HTMLElement>('pre > code')) {
      if (!code.classList.contains('language-mermaid')) found.add(code)
    }
  }
  return [...found]
}

export class MermaidGraftController {
  private readonly labels: MermaidLabels
  private readonly renderer: MermaidRenderer
  private readonly stableMs: number
  private readonly maxSourceBytes: number
  private readonly surface: StructuredContentSurface
  private readonly initialFocus: DiagramFocusV1 | undefined
  private readonly onFocusChange: ((focus: DiagramFocusV1) => void) | undefined
  private readonly onOpenInPane: ((source: string, focus: DiagramFocusV1) => void) | undefined
  private root: ParentNode | undefined
  private observer: MutationObserver | undefined
  private styleEl: HTMLStyleElement | undefined
  private themeQuery: MediaQueryList | undefined
  private readonly timers = new Map<Element, ReturnType<typeof setTimeout>>()
  private readonly keys = new WeakMap<Element, string>()
  private readonly records = new Map<Element, GraftRecord>()
  private blobUrl: string | undefined

  constructor(options: GraftOptions) {
    this.labels = options.labels
    this.renderer = options.renderer
    this.stableMs = options.stableMs ?? 400
    this.maxSourceBytes = options.maxSourceBytes ?? 64 * 1024
    this.surface = options.surface ?? 'inline'
    this.initialFocus = options.initialFocus
    this.onFocusChange = options.onFocusChange
    this.onOpenInPane = options.onOpenInPane
  }

  /** 注入样式、起观察器并做首扫。 */
  start(root: ParentNode): void {
    if (this.observer !== undefined) return
    this.root = root
    const doc = root.nodeType === 9 ? (root as Document) : root.ownerDocument
    if (doc !== null) {
      this.styleEl = doc.createElement('style')
      this.styleEl.textContent = STYLE_TEXT
      doc.head.append(this.styleEl)
      const view = doc.defaultView
      this.themeQuery = view != null && typeof view.matchMedia === 'function'
        ? view.matchMedia('(prefers-color-scheme: dark)')
        : undefined
      this.themeQuery?.addEventListener('change', this.onThemeChange)
      if (this.themeQuery?.matches === true) this.renderer.setTheme('dark')
    }
    this.observer = new MutationObserver(() => { this.scan() })
    this.observer.observe(root, { childList: true, subtree: true, characterData: true })
    this.scan()
  }

  /** 完全还原：断观察器、清定时器、拆 figure、还原 display/class、移除样式。 */
  stop(): void {
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
    this.observer?.disconnect()
    this.observer = undefined
    this.themeQuery?.removeEventListener('change', this.onThemeChange)
    this.themeQuery = undefined
    for (const [codeEl, record] of this.records) {
      record.reactRoot.unmount()
      record.figure.remove()
      codeEl.classList.remove(ON_CLASS)
      record.host.style.display = ''
    }
    this.records.clear()
    this.styleEl?.remove()
    this.styleEl = undefined
    if (this.blobUrl !== undefined && this.root !== undefined) {
      this.root.ownerDocument?.defaultView?.URL.revokeObjectURL(this.blobUrl)
      this.blobUrl = undefined
    }
    this.renderer.dispose()
    this.root = undefined
  }

  /** 手动主题切换入口（测试与未来 dsh 主题 seat 复用）。 */
  setTheme(theme: MermaidTheme): void {
    this.renderer.setTheme(theme)
    void this.rerenderAll()
  }

  private readonly onThemeChange = (event: MediaQueryListEvent): void => {
    this.renderer.setTheme(event.matches ? 'dark' : 'default')
    void this.rerenderAll()
  }

  private scan(): void {
    if (this.root === undefined) return
    for (const [codeEl, record] of this.records) {
      if (!codeEl.isConnected || !record.host.isConnected) {
        record.reactRoot.unmount()
        record.figure.remove()
        this.records.delete(codeEl)
      }
    }
    for (const el of findMermaidFenceCodes(this.root)) {
      if (this.records.has(el)) continue
      this.consider(el)
    }
  }

  private consider(codeEl: HTMLElement): void {
    const text = codeEl.textContent ?? ''
    if (text.length === 0 || text.length > this.maxSourceBytes) return
    if (this.keys.get(codeEl) === text && this.timers.has(codeEl)) return
    this.keys.set(codeEl, text)
    const timer = this.timers.get(codeEl)
    if (timer !== undefined) clearTimeout(timer)
    this.timers.set(codeEl, setTimeout(() => {
      this.timers.delete(codeEl)
      if (codeEl.isConnected && (codeEl.textContent ?? '') === text) void this.graft(codeEl, text)
    }, this.stableMs))
  }

  private async graft(codeEl: HTMLElement, source: string): Promise<void> {
    if (this.records.has(codeEl)) return
    const pre = codeEl.parentElement
    if (pre === null || pre.tagName.toLowerCase() !== 'pre') return
    const host = (pre.closest('.md-code-block') as HTMLElement | null) ?? pre
    // 上一次挂载遗留的兄弟 figure（React 重挂载竞态）先清掉。
    for (const stale of Array.from(host.parentElement?.querySelectorAll(`figure[${FIGURE_FLAG}]`) ?? [])) {
      if (stale.previousElementSibling === host || stale.nextElementSibling === host) stale.remove()
    }
    const { figure, reactRoot } = this.buildFigure()
    host.insertAdjacentElement('afterend', figure)
    const record: GraftRecord = { host, figure, reactRoot, source, failed: false }
    this.records.set(codeEl, record)
    this.renderRecord(record)
    try {
      const svg = await this.renderer.render(source)
      if (!codeEl.isConnected) {
        reactRoot.unmount()
        figure.remove()
        this.records.delete(codeEl)
        return
      }
      record.svg = svg
      codeEl.classList.add(ON_CLASS)
      host.style.display = 'none'
      this.renderRecord(record)
    } catch (error) {
      record.failed = true
      figure.classList.add('is-failed')
      record.error = `${this.labels.failed}: ${error instanceof Error ? error.message : String(error)}`
      host.style.display = ''
      codeEl.classList.remove(ON_CLASS)
      this.renderRecord(record)
    }
  }

  private buildFigure(): { figure: HTMLElement; reactRoot: Root } {
    const doc = this.root?.ownerDocument ?? document
    const figure = doc.createElement('figure')
    figure.setAttribute(FIGURE_FLAG, '')
    return { figure, reactRoot: createRoot(figure) }
  }

  private renderRecord(record: GraftRecord): void {
    record.reactRoot.render(createElement(MermaidCanvas, {
      labels: this.labels,
      source: record.source,
      svg: record.svg,
      error: record.error,
      surface: this.surface,
      initialFocus: this.initialFocus,
      onFocusChange: this.onFocusChange,
      onSourceVisibleChange: (visible: boolean) => { record.host.style.display = visible || record.failed ? '' : 'none' },
      onOpenSvg: () => { this.openSvg(record.svg) },
      onOpenInPane: this.onOpenInPane === undefined ? undefined : (focus: DiagramFocusV1) => { this.onOpenInPane?.(record.source, focus) },
    }))
  }

  private openSvg(svg: string | undefined): void {
    if (svg === undefined) return
    const view = this.root?.ownerDocument?.defaultView
    if (view == null) return
    if (this.blobUrl !== undefined) view.URL.revokeObjectURL(this.blobUrl)
    this.blobUrl = view.URL.createObjectURL(new view.Blob([svg], { type: 'image/svg+xml' }))
    view.open(this.blobUrl, '_blank')
  }

  private async rerenderAll(): Promise<void> {
    for (const [codeEl, record] of this.records) {
      if (record.failed) continue
      try {
        const svg = await this.renderer.render(record.source)
        if (codeEl.isConnected) {
          record.svg = svg
          this.renderRecord(record)
        }
      } catch { /* 主题重渲染失败保留现图 */ }
    }
  }
}

/**
 * Hydrate mermaid fences under an arbitrary root. Used by file Markdown
 * preview tests and any surface that already has settled HTML. The chat
 * plugin still owns a document-wide observer via `apply()`.
 */
export function hydrateMermaidFences(root: ParentNode, options: GraftOptions): () => void {
  const controller = new MermaidGraftController(options)
  controller.start(root)
  return () => { controller.stop() }
}
