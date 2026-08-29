import { useLayoutEffect, type ReactNode } from 'react'
import { buildPanelStyles } from '@yeisme/dsh-client-ui-visual-kit'

export type StructuredContentKind = 'diagram' | 'markdown-table' | 'data-table'
export type StructuredContentSurface = 'inline' | 'pane'
export type StructuredContentStateV1 =
  | 'loading'
  | 'ready'
  | 'partial'
  | 'stale'
  | 'unsupported'
  | 'error'
  | 'offline'

export interface DiagramFocusV1 {
  readonly kind: 'diagram'
  readonly scale: number
  readonly x: number
  readonly y: number
  readonly nodeKey?: string | undefined
}

export interface TableFocusV1 {
  readonly kind: 'table'
  readonly rowKey?: string | undefined
  readonly columnId?: string | undefined
  readonly scrollLeft?: number | undefined
  readonly scrollTop?: number | undefined
}

export type StructuredContentFocusV1 = DiagramFocusV1 | TableFocusV1

const EXTRA_STYLES = `
[data-dsh-structured-content]{display:grid;grid-template-rows:auto minmax(0,1fr) auto;min-width:0;max-width:100%;color:var(--vk-text-primary);background:transparent;font:inherit}
[data-dsh-structured-content][data-surface='pane']{height:100%;min-height:0;background:var(--vk-bg-base)}
[data-dsh-structured-content] .sc-toolbar{position:relative;z-index:2;display:flex;align-items:center;gap:var(--vk-gap-sm);min-width:0;min-height:34px;padding:4px 6px;color:var(--vk-text-secondary);background:color-mix(in srgb,var(--vk-bg-layer-1) 92%,transparent);border-bottom:1px solid var(--vk-border-l1);font-size:var(--vk-font-small)}
[data-dsh-structured-content][data-surface='pane'] .sc-toolbar{position:sticky;top:0;padding:6px 10px;border-bottom-color:var(--vk-border-l2);backdrop-filter:blur(12px)}
[data-dsh-structured-content] .sc-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--vk-text-tertiary);font-weight:650}
[data-dsh-structured-content] .sc-actions{display:flex;align-items:center;gap:var(--vk-gap-sm);margin-left:auto;min-width:0}
[data-dsh-structured-content] .sc-action{display:inline-flex;align-items:center;justify-content:center;min-width:28px;min-height:28px;padding:0 8px;color:var(--vk-text-secondary);background:transparent;border:1px solid transparent;border-radius:var(--vk-radius-sm);cursor:pointer;font:inherit}
[data-dsh-structured-content] .sc-action:hover,[data-dsh-structured-content] .sc-action:focus-visible,[data-dsh-structured-content] .sc-action[aria-pressed='true']{color:var(--vk-text-primary);background:var(--vk-fill-hover);border-color:var(--vk-border-l1)}
[data-dsh-structured-content] .sc-viewport{position:relative;min-width:0;min-height:0;overflow:auto;overscroll-behavior:contain;background:transparent}
[data-dsh-structured-content][data-surface='pane'] .sc-viewport{background:var(--vk-bg-base)}
[data-dsh-structured-content] .sc-status{min-height:24px;padding:4px 8px;color:var(--vk-text-tertiary);background:var(--vk-bg-layer-1);border-top:1px solid var(--vk-border-l1);font-size:var(--vk-font-small)}
[data-dsh-structured-content] .sc-status[data-state='partial'],[data-dsh-structured-content] .sc-status[data-state='stale']{color:var(--vk-state-warn)}
[data-dsh-structured-content] .sc-status[data-state='error'],[data-dsh-structured-content] .sc-status[data-state='offline']{color:var(--vk-state-error)}
[data-dsh-structured-content] .sc-status[data-state='unsupported']{color:var(--vk-state-neutral)}
@media(pointer:coarse){[data-dsh-structured-content] .sc-action{min-width:44px;min-height:44px}}
`

export const STRUCTURED_CONTENT_STYLES = buildPanelStyles({
  scope: 'dsh-structured-content',
  extra: EXTRA_STYLES,
})

interface StyleRecord {
  readonly element: HTMLStyleElement
  refs: number
}

const stylesByDocument = new WeakMap<Document, StyleRecord>()

/** Inject shared styles once per document and return an exact ref-counted disposer. */
export function acquireStructuredContentStyles(doc: Document): () => void {
  const existing = stylesByDocument.get(doc)
  if (existing !== undefined && existing.element.isConnected) {
    existing.refs += 1
    return () => {
      existing.refs -= 1
      if (existing.refs <= 0) {
        existing.element.remove()
        stylesByDocument.delete(doc)
      }
    }
  }
  if (existing !== undefined) stylesByDocument.delete(doc)
  const element = doc.createElement('style')
  element.dataset.dshStructuredContentStyles = ''
  element.textContent = STRUCTURED_CONTENT_STYLES
  doc.head.append(element)
  const record: StyleRecord = { element, refs: 1 }
  stylesByDocument.set(doc, record)
  return () => {
    record.refs -= 1
    if (record.refs <= 0) {
      record.element.remove()
      stylesByDocument.delete(doc)
    }
  }
}

export interface StructuredContentFrameProps {
  readonly kind: StructuredContentKind
  readonly surface?: StructuredContentSurface | undefined
  readonly state?: StructuredContentStateV1 | undefined
  readonly ariaLabel: string
  readonly title?: string | undefined
  readonly statusText?: string | undefined
  readonly actions?: ReactNode | undefined
  readonly children: ReactNode
  readonly openInPaneLabel?: string | undefined
  readonly onOpenInPane?: (() => void) | undefined
  readonly className?: string | undefined
}

/** Shared content-first shell. Stable refs/content ownership remain with the caller. */
export function StructuredContentFrame({
  kind,
  surface = 'inline',
  state = 'ready',
  ariaLabel,
  title,
  statusText,
  actions,
  children,
  openInPaneLabel = 'Open in pane',
  onOpenInPane,
  className,
}: StructuredContentFrameProps) {
  useLayoutEffect(() => acquireStructuredContentStyles(document), [])
  const showToolbar = title !== undefined || actions !== undefined || onOpenInPane !== undefined
  const statusRole = state === 'error' || state === 'offline' ? 'alert' : 'status'
  return (
    <section
      aria-label={ariaLabel}
      className={className}
      data-dsh-structured-content
      data-kind={kind}
      data-surface={surface}
      data-state={state}
    >
      {showToolbar && (
        <header className="sc-toolbar">
          {title !== undefined && <span className="sc-title">{title}</span>}
          <div className="sc-actions">
            {actions}
            {onOpenInPane !== undefined && <button type="button" className="sc-action" onClick={onOpenInPane}>{openInPaneLabel}</button>}
          </div>
        </header>
      )}
      <div className="sc-viewport">{children}</div>
      {statusText !== undefined && <footer role={statusRole} className="sc-status" data-state={state}>{statusText}</footer>}
    </section>
  )
}
