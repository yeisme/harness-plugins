import { useEffect, useRef, useState } from 'react'
import { formatT, t } from './i18n/locale.js'

/** Announce visible counts, never queries, resource IDs, titles or snippets. */
export function SearchResultAnnouncement(props: {
  contextKey: string
  keys: readonly string[]
  selectedKey?: string
  busy: boolean
  composing: boolean
  enabled: boolean
}) {
  const [message, setMessage] = useState('')
  const previous = useRef<{ context: string; keys: readonly string[]; selected?: string }>()
  const lost = useRef(false)
  const keysKey = JSON.stringify(props.keys)
  useEffect(() => {
    const before = previous.current
    if (before?.context !== props.contextKey) lost.current = false
    else if (before.selected !== undefined && before.keys.includes(before.selected) && !props.keys.includes(before.selected)) lost.current = true
    previous.current = { context: props.contextKey, keys: props.keys, selected: props.selectedKey }
  }, [props.contextKey, keysKey, props.selectedKey])
  useEffect(() => {
    if (props.composing || !props.enabled) { setMessage(''); return }
    const timer = setTimeout(() => {
      const shown = new Set(props.keys).size
      const count = formatT(shown === 1 ? 'search.center.announcedVisibleOne' : 'search.center.announcedVisible', { count: shown })
      setMessage(props.busy ? t('search.center.announcedUpdating') : `${lost.current ? `${t('search.center.announcedSelectionLost')} ` : ''}${count}`)
      if (!props.busy) lost.current = false
    }, 500)
    return () => clearTimeout(timer)
  }, [props.contextKey, keysKey, props.busy, props.composing, props.enabled])
  return <div className="pwr-search-announcement" role="status" aria-live="polite" aria-atomic="true">{message}</div>
}

export const SEARCH_ANNOUNCEMENT_STYLES = `
.pwr-search-announcement{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
.pwr-search-input input::-webkit-search-cancel-button{display:none;-webkit-appearance:none}
`
