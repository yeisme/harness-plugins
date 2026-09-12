import { useEffect, type RefObject } from 'react'

/** Bound only this search surface; never resize the host or an adjacent Pane. */
export function useSearchVisualViewport(root: RefObject<HTMLElement>, active = true): void {
  useEffect(() => {
    const element = root.current
    const viewport = typeof window === 'undefined' ? undefined : window.visualViewport
    if (!active || !element || !viewport) return
    const card = element.closest<HTMLElement>('.pwr-search-modal,.pwr-search-compact-modal')
    const target = card ?? element
    const properties = ['--pwr-search-vv-height', '--pwr-search-vv-width', '--pwr-search-vv-top', '--pwr-search-vv-left', '--pwr-search-vv-inset-top']
    let frame: number | undefined
    let previousScrollTop: number | undefined
    const clear = () => {
      target.removeAttribute('data-search-visual-viewport')
      if (previousScrollTop !== undefined) { element.scrollTop = previousScrollTop; previousScrollTop = undefined }
      for (const property of properties) target.style.removeProperty(property)
    }
    const measure = () => {
      frame = undefined
      const { height, width, offsetTop, offsetLeft } = viewport
      if (![height, width, offsetTop, offsetLeft].every(Number.isFinite) || height <= 0 || width <= 0
        || (height > 480 && height >= window.innerHeight - 1 && width >= window.innerWidth - 1 && offsetTop === 0 && offsetLeft === 0)) {
        clear(); return
      }
      previousScrollTop ??= element.scrollTop
      const top = card ? offsetTop + 12 : element.getBoundingClientRect().top
      target.style.setProperty('--pwr-search-vv-inset-top', `${card ? 0 : Math.max(0, offsetTop - top)}px`)
      target.style.setProperty('--pwr-search-vv-height', `${Math.max(0, offsetTop + height - top - 12)}px`)
      target.style.setProperty('--pwr-search-vv-width', `${Math.max(0, width - 24)}px`)
      target.style.setProperty('--pwr-search-vv-top', `${top}px`)
      target.style.setProperty('--pwr-search-vv-left', `${offsetLeft + width / 2}px`)
      target.setAttribute('data-search-visual-viewport', card ? 'dialog' : 'pane')
    }
    const schedule = () => { if (frame === undefined) frame = window.requestAnimationFrame(measure) }
    viewport.addEventListener('resize', schedule)
    viewport.addEventListener('scroll', schedule)
    window.addEventListener('resize', schedule)
    measure()
    return () => {
      viewport.removeEventListener('resize', schedule)
      viewport.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame !== undefined) window.cancelAnimationFrame(frame)
      clear()
    }
  }, [root, active])
}

export const SEARCH_VISUAL_VIEWPORT_STYLES = `
.pwr-search-modal[data-search-visual-viewport=dialog],.pwr-search-compact-modal[data-search-visual-viewport=dialog]{position:fixed;top:var(--pwr-search-vv-top);left:var(--pwr-search-vv-left);transform:translateX(-50%);width:min(680px,var(--pwr-search-vv-width));max-height:var(--pwr-search-vv-height);margin:0}
.pwr-search-compact-modal[data-search-visual-viewport=dialog]{width:min(480px,var(--pwr-search-vv-width))}
.pwr-search-modal[data-search-visual-viewport] .pwr-search,.pwr-search-compact-modal[data-search-visual-viewport] .pwr-search-compact-panel,.pwr-root .pwr-search[data-search-visual-viewport=pane]{max-height:calc(var(--pwr-search-vv-height) - env(safe-area-inset-bottom,0px));overflow:auto;overscroll-behavior:contain}
.pwr-root .pwr-search[data-search-visual-viewport=pane]{padding-top:var(--pwr-search-vv-inset-top)}
.pwr-search-modal[data-search-visual-viewport] .pwr-search>*,.pwr-root .pwr-search[data-search-visual-viewport=pane]>*{flex-shrink:0}
.pwr-search-modal[data-search-visual-viewport] .pwr-search-content,.pwr-root .pwr-search[data-search-visual-viewport=pane] .pwr-search-content{overflow:visible;flex:none}
.pwr-search-modal[data-search-visual-viewport] .pwr-search-main,.pwr-root .pwr-search[data-search-visual-viewport=pane] .pwr-search-main{overflow:visible}
`
