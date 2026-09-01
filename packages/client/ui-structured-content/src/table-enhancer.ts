import { acquireStructuredContentStyles } from './structured-content.tsx'

const TABLE_FLAG = 'data-dsh-structured-markdown-table'
const TABLE_STYLES = `
[${TABLE_FLAG}]{position:relative;max-width:100%;max-height:360px;overflow:auto;overscroll-behavior:contain;border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md);background:var(--vk-bg-base)}
[${TABLE_FLAG}]>.sc-toolbar{position:sticky;top:0;left:0;width:min(100%,100vw);z-index:6}
[${TABLE_FLAG}] table{width:max-content;min-width:100%;border-collapse:separate;border-spacing:0;font-variant-numeric:tabular-nums}
[${TABLE_FLAG}] th,[${TABLE_FLAG}] td{min-width:96px;padding:7px 10px;border-right:1px solid var(--vk-border-l1);border-bottom:1px solid var(--vk-border-l1);text-align:left;vertical-align:top}
[${TABLE_FLAG}] th{position:sticky;top:34px;z-index:3;background:var(--vk-bg-layer-1);font-weight:680}
[${TABLE_FLAG}] tbody tr:nth-child(even) td{background:color-mix(in srgb,var(--vk-bg-layer-1) 45%,transparent)}
@media(max-width:719px){[${TABLE_FLAG}] th:first-child,[${TABLE_FLAG}] td:first-child{position:sticky;left:0;z-index:2;background:var(--vk-bg-base);box-shadow:1px 0 var(--vk-border-l2)}[${TABLE_FLAG}] th:first-child{z-index:4;background:var(--vk-bg-layer-1)}}
`

export interface MarkdownTableEnhancerLabels {
  readonly title?: string
  readonly copy?: string
  readonly copied?: string
}

interface TableRecord {
  readonly table: HTMLTableElement
  readonly wrapper: HTMLElement
  readonly toolbar: HTMLElement
  readonly copyButton: HTMLButtonElement
  readonly onCopy: () => void
  readonly oldTabIndex: string | null
  readonly oldRole: string | null
  readonly oldAriaLabel: string | null
}

function tableToTsv(table: HTMLTableElement): string {
  return [...table.rows].map(row => [...row.cells].map(cell => (cell.textContent ?? '').trim().replaceAll('\t', ' ')).join('\t')).join('\n')
}

/** Reversible compatibility adapter for host-rendered semantic Markdown tables. */
export class MarkdownTableEnhancer {
  private readonly labels: Required<MarkdownTableEnhancerLabels>
  private root: ParentNode | undefined
  private observer: MutationObserver | undefined
  private styleEl: HTMLStyleElement | undefined
  private releaseSharedStyles: (() => void) | undefined
  private readonly records = new Map<HTMLTableElement, TableRecord>()

  constructor(labels: MarkdownTableEnhancerLabels = {}) {
    this.labels = { title: 'Table', copy: 'Copy TSV', copied: 'Copied', ...labels }
  }

  start(root: ParentNode): void {
    if (this.observer !== undefined) return
    this.root = root
    const doc = root.nodeType === 9 ? root as Document : root.ownerDocument
    if (doc !== null) {
      this.releaseSharedStyles = acquireStructuredContentStyles(doc)
      this.styleEl = doc.createElement('style')
      this.styleEl.dataset.dshStructuredTableStyles = ''
      this.styleEl.textContent = TABLE_STYLES
      doc.head.append(this.styleEl)
    }
    this.observer = new MutationObserver(() => { this.scan() })
    this.observer.observe(root, { childList: true, subtree: true })
    this.scan()
  }

  stop(): void {
    this.observer?.disconnect()
    this.observer = undefined
    for (const record of this.records.values()) this.restore(record)
    this.records.clear()
    this.styleEl?.remove()
    this.styleEl = undefined
    this.releaseSharedStyles?.()
    this.releaseSharedStyles = undefined
    this.root = undefined
  }

  private scan(): void {
    if (this.root === undefined) return
    for (const [table, record] of this.records) {
      if (!table.isConnected || !record.wrapper.isConnected) {
        record.toolbar.remove()
        this.records.delete(table)
      }
    }
    for (const table of this.root.querySelectorAll<HTMLTableElement>('table')) {
      if (this.records.has(table) || table.closest('[data-dsh-preview-table]') !== null) continue
      this.enhance(table)
    }
  }

  private enhance(table: HTMLTableElement): void {
    const wrapper = table.parentElement
    if (wrapper === null || wrapper.hasAttribute(TABLE_FLAG) || wrapper.closest('[data-dsh-structured-content]') !== null) return
    if (wrapper.closest('[data-conversation-scroll],[data-dsh-file-markdown]') === null) return
    const columns = table.rows[0]?.cells.length ?? 0
    const toolbar = table.ownerDocument.createElement('div')
    toolbar.className = 'sc-toolbar'
    const title = table.ownerDocument.createElement('span')
    title.className = 'sc-title'
    title.textContent = `${this.labels.title} · ${columns}`
    const actions = table.ownerDocument.createElement('div')
    actions.className = 'sc-actions'
    const copy = table.ownerDocument.createElement('button')
    copy.type = 'button'
    copy.className = 'sc-action'
    copy.textContent = this.labels.copy
    // G21 dispose 收口：click 监听具名收纳，restore 时显式摘除
    // （不依赖 toolbar 脱离 DOM 后的被动回收）。
    const onCopy = (): void => {
      void table.ownerDocument.defaultView?.navigator.clipboard?.writeText(tableToTsv(table)).then(() => {
        copy.textContent = this.labels.copied
        table.ownerDocument.defaultView?.setTimeout(() => { copy.textContent = this.labels.copy }, 1500)
      }).catch(() => {})
    }
    copy.addEventListener('click', onCopy)
    actions.append(copy)
    toolbar.append(title, actions)
    wrapper.prepend(toolbar)
    const record: TableRecord = {
      table,
      wrapper,
      toolbar,
      copyButton: copy,
      onCopy,
      oldTabIndex: wrapper.getAttribute('tabindex'),
      oldRole: wrapper.getAttribute('role'),
      oldAriaLabel: wrapper.getAttribute('aria-label'),
    }
    wrapper.setAttribute(TABLE_FLAG, '')
    wrapper.setAttribute('data-dsh-structured-content', '')
    wrapper.setAttribute('data-kind', 'markdown-table')
    wrapper.setAttribute('data-surface', 'inline')
    wrapper.setAttribute('tabindex', '0')
    wrapper.setAttribute('role', 'region')
    wrapper.setAttribute('aria-label', `${this.labels.title}, ${columns} columns`)
    this.records.set(table, record)
  }

  private restore(record: TableRecord): void {
    record.copyButton.removeEventListener('click', record.onCopy)
    record.toolbar.remove()
    for (const attr of [TABLE_FLAG, 'data-dsh-structured-content', 'data-kind', 'data-surface']) record.wrapper.removeAttribute(attr)
    this.restoreAttr(record.wrapper, 'tabindex', record.oldTabIndex)
    this.restoreAttr(record.wrapper, 'role', record.oldRole)
    this.restoreAttr(record.wrapper, 'aria-label', record.oldAriaLabel)
  }

  private restoreAttr(element: HTMLElement, name: string, value: string | null): void {
    if (value === null) element.removeAttribute(name)
    else element.setAttribute(name, value)
  }
}
