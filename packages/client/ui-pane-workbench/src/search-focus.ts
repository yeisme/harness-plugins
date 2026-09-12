/** Keep modal Tab navigation within visible controls, without document-wide focus listeners. */
export function cycleSearchDialogFocus(root: HTMLElement, backwards: boolean, fallback: HTMLElement | null): void {
  const controls = [...root.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex],[contenteditable="true"]')]
    .filter(element => element.tabIndex >= 0 && !element.matches(':disabled')
      && element.closest('[inert],[aria-hidden="true"]') === null
      && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden')
  if (controls.length === 0) { fallback?.focus(); return }
  const active = root.ownerDocument.activeElement
  const current = controls.findIndex(control => control === active)
  if (current >= 0) {
    controls[(current + (backwards ? -1 : 1) + controls.length) % controls.length]?.focus()
    return
  }
  // A preview heading is focusable for announcement but excluded from the Tab order.
  const inOrder = backwards ? [...controls].reverse() : controls
  const next = active instanceof Node ? inOrder.find(control =>
    (active.compareDocumentPosition(control) & (backwards ? Node.DOCUMENT_POSITION_PRECEDING : Node.DOCUMENT_POSITION_FOLLOWING)) !== 0) : undefined
  const target = next ?? inOrder[0]
  target?.focus()
}

/** Derive a theme-aware focus color locally; keep the host token values intact. */
export const SEARCH_FOCUS_STYLES = `
.pwr-root.pwr-search-surface,.pwr-root.pwr-search-compact-surface{--vk-border-focus:color-mix(in srgb,var(--vk-accent) 55%,var(--vk-text-primary))}
`
