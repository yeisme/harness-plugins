import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface } from '@yeisme/dsh-client-ui-surface'
import { cycleSearchDialogFocus } from './search-focus.js'
import { useSearchVisualViewport } from './search-visual-viewport.js'
import { t } from './i18n/locale.js'

/** Container-width entry point; field state remains owned by the search coordinator. */
export function SearchCompactPanel(props: {
  label: string
  onReturn: () => void
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const viewportRoot = useRef<HTMLElement>(null)
  useSearchVisualViewport(viewportRoot, open)
  const trigger = useRef<HTMLSpanElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const close = () => {
    setOpen(false)
    const button = trigger.current?.querySelector('button')
    button?.focus()
    if (document.activeElement !== button) props.onReturn()
  }
  useEffect(() => {
    if (!open) return
    heading.current?.focus()
    const surface = trigger.current?.closest<HTMLElement>('[data-yeisme-surface]')
    if (!surface || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => {
      if ((entries[0]?.contentRect.width ?? 0) <= 420) return
      setOpen(false)
      props.onReturn()
    })
    observer.observe(surface)
    return () => observer.disconnect()
  }, [open])
  return <>
    <span ref={trigger} className="pwr-search-compact-entry"><Button variant="toolbar" size="sm" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>{props.label}</Button></span>
    {open && <Modal open title={props.label} headless onClose={close} className="pwr-search-compact-modal">
      <Surface kind="dialog" className="pwr-root pwr-search-compact-surface">
        <section ref={viewportRoot} className="pwr-search-compact-panel" onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
          if (event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); cycleSearchDialogFocus(event.currentTarget, event.shiftKey, heading.current) }
        }}>
          <header><h2 ref={heading} tabIndex={-1}>{props.label}</h2><Button variant="toolbar" size="sm" onClick={close}>{t('search.center.panelDone')}</Button></header>
          <div className="pwr-search-compact-panel-body">{props.children(close)}</div>
        </section>
      </Surface>
    </Modal>}
  </>
}

export const SEARCH_COMPACT_PANEL_STYLES = `
.pwr-search-compact-entry{display:none}
.pwr-search-compact-modal{width:min(480px,100%);padding:0;gap:0;border-radius:12px}
.pwr-search-compact-panel{display:flex;flex-direction:column;max-height:calc(100dvh - 48px);color:var(--vk-text-primary);background:var(--vk-bg-layer-1)}
.pwr-search-compact-panel header{display:flex;align-items:center;justify-content:space-between;gap:var(--vk-gap-md);padding:var(--vk-gap-lg)}
.pwr-search-compact-panel h2{font-size:var(--vk-font-heading);margin:0}
.pwr-search-compact-panel h2:focus{outline:2px solid var(--vk-border-focus)}
.pwr-search-compact-panel-body{overflow:auto;min-height:0}
.pwr-root .pwr-search-compact-panel .pwr-search-sidebar{display:block;width:auto;border:0;overflow:visible}
.pwr-root .pwr-search-query-controls[data-expanded] .pwr-search-advanced-controls{display:contents}
@container yeisme-surface (max-width:420px){
  .pwr-search-compact-entry{display:inline-flex;margin:0 var(--vk-gap-lg) var(--vk-gap-sm)}
  .pwr-root .pwr-search-category-select{display:none}
  .pwr-root .pwr-search-query-controls:not([data-expanded]) .pwr-search-advanced-controls{display:none}
}
@media(pointer:coarse){.pwr-search-compact-panel button,.pwr-search-compact-panel select,.pwr-search-compact-panel input{min-width:44px;min-height:44px}}
`
