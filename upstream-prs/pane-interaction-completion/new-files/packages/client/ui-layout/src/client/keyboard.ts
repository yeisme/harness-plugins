/** Shell shortcuts never consume text editing, terminal input, or composition events. */
export function workbenchShortcut(event: KeyboardEvent): 'navigation' | 'single' | 'columns' | 'rows' | 'menu' | null {
  if (event.defaultPrevented || event.isComposing || event.repeat || !(event.ctrlKey || event.metaKey) || event.shiftKey) return null
  const target = event.target
  if (target instanceof Element && target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],.monaco-editor,.cm-editor,.xterm,dialog')) return null
  if (!event.altKey) return event.key.toLowerCase() === 'b' ? 'navigation' : null
  const key = event.code || event.key
  if (key === 'Digit1' || key === '1' || key === 'Enter') return 'single'
  if (key === 'Digit2' || key === '2') return 'columns'
  if (key === 'Digit3' || key === '3') return 'rows'
  if (key === 'KeyL' || key.toLowerCase() === 'l') return 'menu'
  return null
}
